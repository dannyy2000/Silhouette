// swap_core.cairo
//
// Silhouette core swap contract:
//
//   Fixed party: locks collateral, receives a guaranteed rate every
//   staking epoch.
//   Variable party: locks collateral, receives the actual staking rate,
//   pays the fixed party the difference (or is paid, if actual > fixed).
//
// Settlement is automatic (well: permissionless — anyone can call
// settle_epoch once the oracle has posted the epoch's rate).
//
// Payment formula:
//   payment = notional * rate_bps / 1_000_000
// where rate_bps comes from staking_rate_oracle.cairo.
//
// PRIVACY NOTE (read this before assuming more than is true):
// This file, as written, moves collateral through
// interfaces/i_collateral_token.cairo, currently implemented by the
// fully public mock_collateral_token.cairo. That makes this a Level 1
// skeleton in the plain sense — the swap logic is correct and complete,
// but nothing is actually shielded yet. Privacy gets added in two steps,
// neither of which changes this file's logic:
//   1. Swap ICollateralToken's implementation for an STRK20
//      shielded-balance adapter (holding/positions become private
//      between settlements — this is "Tier 1" in the project README).
//   2. Separately, and later, replace the plaintext math in
//      settle_epoch below with a custom Cairo circuit proven via
//      SNIP-36 that never materializes notional/payment in the clear,
//      even momentarily ("Tier 2" — not started, real R&D).
// See README.md for the full explanation of why this is split this way.

use starknet::ContractAddress;

#[derive(Drop, Serde, starknet::Store)]
pub struct Offer {
    pub fixed_party: ContractAddress,
    pub notional: u256,
    pub fixed_rate_bps: u256,
    pub duration_epochs: u64,
    pub collateral: u256,
    pub status: u8, // 0 = open, 1 = accepted, 2 = cancelled
}

#[derive(Drop, Serde, starknet::Store)]
pub struct Swap {
    pub offer_id: u64,
    pub fixed_party: ContractAddress,
    pub variable_party: ContractAddress,
    pub notional: u256,
    pub fixed_rate_bps: u256,
    pub duration_epochs: u64,
    pub start_epoch: u64,
    pub epochs_settled: u64,
    pub fixed_collateral: u256,
    pub variable_collateral: u256,
    pub status: u8, // 0 = active, 1 = completed, 2 = liquidated
}

#[derive(Drop, Serde, starknet::Store)]
pub struct EpochSettlement {
    pub fixed_payment: u256,
    pub variable_payment: u256,
    pub settled_at: u64,
}

#[starknet::interface]
pub trait ISwapCore<TContractState> {
    fn post_offer(
        ref self: TContractState,
        notional: u256,
        fixed_rate_bps: u256,
        duration_epochs: u64,
        collateral: u256,
    ) -> u64;
    fn accept_offer(ref self: TContractState, offer_id: u64, variable_collateral: u256) -> u64;
    fn settle_epoch(ref self: TContractState, swap_id: u64, epoch: u64) -> (u256, u256);
    fn close_swap(ref self: TContractState, swap_id: u64);
    fn cancel_offer(ref self: TContractState, offer_id: u64);
    fn get_offer(self: @TContractState, offer_id: u64) -> Option<Offer>;
    fn get_swap(self: @TContractState, swap_id: u64) -> Option<Swap>;
    fn get_epoch_settlement(
        self: @TContractState, swap_id: u64, epoch: u64,
    ) -> Option<EpochSettlement>;
    fn get_offer_count(self: @TContractState) -> u64;
    fn get_swap_count(self: @TContractState) -> u64;
}

#[starknet::contract]
mod SwapCore {
    use starknet::{ContractAddress, get_caller_address, get_contract_address, get_block_timestamp};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use super::{Offer, Swap, EpochSettlement};
    use crate::interfaces::i_collateral_token::{
        ICollateralTokenDispatcher, ICollateralTokenDispatcherTrait,
    };
    use crate::staking_rate_oracle::{IStakingRateOracleDispatcher, IStakingRateOracleDispatcherTrait};

    const PRECISION: u256 = 1_000_000;
    // Variable party is liquidated if collateral falls below 110% of
    // remaining obligation.
    const MARGIN_NUMERATOR: u256 = 110;
    const MARGIN_DENOMINATOR: u256 = 100;

    #[storage]
    struct Storage {
        collateral_token: ContractAddress,
        rate_oracle: ContractAddress,
        offers: Map<u64, Offer>,
        offer_exists: Map<u64, bool>,
        swaps: Map<u64, Swap>,
        swap_exists: Map<u64, bool>,
        epoch_settlements: Map<(u64, u64), EpochSettlement>,
        epoch_settlement_exists: Map<(u64, u64), bool>,
        offer_nonce: u64,
        swap_nonce: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        OfferPosted: OfferPosted,
        SwapCreated: SwapCreated,
        EpochSettled: EpochSettled,
        Liquidation: Liquidation,
        SwapClosed: SwapClosed,
        OfferCancelled: OfferCancelled,
    }

    #[derive(Drop, starknet::Event)]
    struct OfferPosted {
        #[key]
        offer_id: u64,
        fixed_party: ContractAddress,
        notional: u256,
        fixed_rate_bps: u256,
        duration_epochs: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct SwapCreated {
        #[key]
        swap_id: u64,
        offer_id: u64,
        variable_party: ContractAddress,
        start_epoch: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct EpochSettled {
        #[key]
        swap_id: u64,
        epoch: u64,
        fixed_payment: u256,
        variable_payment: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Liquidation {
        #[key]
        swap_id: u64,
        epoch: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct SwapClosed {
        #[key]
        swap_id: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct OfferCancelled {
        #[key]
        offer_id: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, collateral_token: ContractAddress, rate_oracle: ContractAddress,
    ) {
        self.collateral_token.write(collateral_token);
        self.rate_oracle.write(rate_oracle);
    }

    #[abi(embed_v0)]
    impl SwapCoreImpl of super::ISwapCore<ContractState> {
        // Fixed party posts a rate offer and locks collateral in escrow.
        fn post_offer(
            ref self: ContractState,
            notional: u256,
            fixed_rate_bps: u256,
            duration_epochs: u64,
            collateral: u256,
        ) -> u64 {
            assert(notional > 0, 'invalid notional');
            assert(collateral > 0, 'invalid collateral');
            assert(duration_epochs > 0, 'invalid duration');

            let caller = get_caller_address();
            let this = get_contract_address();
            let token = ICollateralTokenDispatcher { contract_address: self.collateral_token.read() };
            token.transfer_from(caller, this, collateral);

            let new_id = self.offer_nonce.read() + 1;
            self.offers.write(new_id, Offer {
                fixed_party: caller,
                notional,
                fixed_rate_bps,
                duration_epochs,
                collateral,
                status: 0,
            });
            self.offer_exists.write(new_id, true);
            self.offer_nonce.write(new_id);

            self.emit(OfferPosted {
                offer_id: new_id, fixed_party: caller, notional, fixed_rate_bps, duration_epochs,
            });
            new_id
        }

        // Variable party accepts an open offer and locks their collateral.
        fn accept_offer(ref self: ContractState, offer_id: u64, variable_collateral: u256) -> u64 {
            assert(self.offer_exists.read(offer_id), 'offer not found');
            let mut offer = self.offers.read(offer_id);
            assert(offer.status == 0, 'offer not open');
            assert(variable_collateral > 0, 'invalid collateral');

            let caller = get_caller_address();
            let this = get_contract_address();
            let token = ICollateralTokenDispatcher { contract_address: self.collateral_token.read() };
            token.transfer_from(caller, this, variable_collateral);

            offer.status = 1;
            self.offers.write(offer_id, offer);

            // Swaps start at the epoch immediately after the last one the
            // oracle has a submitted rate for — settle_epoch requires a
            // rate to exist for every epoch it settles, so a swap can
            // never start on an epoch whose rate is already known (that
            // epoch is in the past). Once Phase 2 wires this contract to
            // Starknet's native staking contract directly (see
            // staking_rate_oracle.cairo), start_epoch can instead read a
            // live epoch counter from that contract.
            let oracle = IStakingRateOracleDispatcher { contract_address: self.rate_oracle.read() };
            let start_epoch = oracle.get_latest_epoch() + 1;

            let new_swap_id = self.swap_nonce.read() + 1;
            let offer_snapshot = self.offers.read(offer_id);
            self.swaps.write(new_swap_id, Swap {
                offer_id,
                fixed_party: offer_snapshot.fixed_party,
                variable_party: caller,
                notional: offer_snapshot.notional,
                fixed_rate_bps: offer_snapshot.fixed_rate_bps,
                duration_epochs: offer_snapshot.duration_epochs,
                start_epoch,
                epochs_settled: 0,
                fixed_collateral: offer_snapshot.collateral,
                variable_collateral,
                status: 0,
            });
            self.swap_exists.write(new_swap_id, true);
            self.swap_nonce.write(new_swap_id);

            self.emit(SwapCreated {
                swap_id: new_swap_id, offer_id, variable_party: caller, start_epoch,
            });
            new_swap_id
        }

        // Settle a single epoch for an active swap. Callable by anyone.
        fn settle_epoch(ref self: ContractState, swap_id: u64, epoch: u64) -> (u256, u256) {
            assert(self.swap_exists.read(swap_id), 'swap not found');
            let mut swap = self.swaps.read(swap_id);
            assert(swap.status == 0, 'swap not active');
            assert(!self.epoch_settlement_exists.read((swap_id, epoch)), 'epoch already settled');
            assert(epoch >= swap.start_epoch, 'epoch out of range');
            assert(epoch < swap.start_epoch + swap.duration_epochs, 'epoch out of range');

            let oracle = IStakingRateOracleDispatcher { contract_address: self.rate_oracle.read() };
            let rate_data = match oracle.get_epoch_rate(epoch) {
                Option::Some(r) => r,
                Option::None => panic!("oracle rate not found"),
            };
            let actual_rate = rate_data.rate_bps;

            let fixed_pmt = (swap.notional * swap.fixed_rate_bps) / PRECISION;
            let actual_pmt = (swap.notional * actual_rate) / PRECISION;
            let new_epochs_settled = swap.epochs_settled + 1;

            self.epoch_settlements.write((swap_id, epoch), EpochSettlement {
                fixed_payment: fixed_pmt, variable_payment: actual_pmt,
                settled_at: get_block_timestamp(),
            });
            self.epoch_settlement_exists.write((swap_id, epoch), true);

            if actual_rate >= swap.fixed_rate_bps {
                // Variable wins: net moves from fixed collateral to variable.
                let net = actual_pmt - fixed_pmt;
                let capped_net = if swap.fixed_collateral >= net { net } else { swap.fixed_collateral };
                swap.fixed_collateral -= capped_net;
                swap.variable_collateral += capped_net;
                swap.epochs_settled = new_epochs_settled;
                self.swaps.write(swap_id, swap);
            } else {
                // Fixed wins: net moves from variable collateral to fixed.
                // Liquidate if variable margin drops below 110% of the
                // remaining obligation.
                let net = fixed_pmt - actual_pmt;
                let can_pay = swap.variable_collateral >= net;
                let actual_net = if can_pay { net } else { swap.variable_collateral };
                let new_var_col = if can_pay { swap.variable_collateral - net } else { 0 };
                let new_fixed_col = swap.fixed_collateral + actual_net;

                let remaining = swap.duration_epochs - new_epochs_settled;
                let remaining_obligation = (remaining.into() * swap.notional * swap.fixed_rate_bps) / PRECISION;
                let min_margin = (remaining_obligation * MARGIN_NUMERATOR) / MARGIN_DENOMINATOR;

                if !can_pay || new_var_col < min_margin {
                    self.emit(Liquidation { swap_id, epoch });
                    let token = ICollateralTokenDispatcher {
                        contract_address: self.collateral_token.read(),
                    };
                    if new_fixed_col > 0 {
                        token.transfer(swap.fixed_party, new_fixed_col);
                    }
                    if new_var_col > 0 {
                        token.transfer(swap.variable_party, new_var_col);
                    }
                    swap.epochs_settled = new_epochs_settled;
                    swap.fixed_collateral = 0;
                    swap.variable_collateral = 0;
                    swap.status = 2;
                    self.swaps.write(swap_id, swap);
                } else {
                    swap.epochs_settled = new_epochs_settled;
                    swap.fixed_collateral = new_fixed_col;
                    swap.variable_collateral = new_var_col;
                    self.swaps.write(swap_id, swap);
                }
            }

            self.emit(EpochSettled {
                swap_id, epoch, fixed_payment: fixed_pmt, variable_payment: actual_pmt,
            });
            (fixed_pmt, actual_pmt)
        }

        // Release remaining collateral to both parties once every epoch in
        // the swap's duration has been settled.
        fn close_swap(ref self: ContractState, swap_id: u64) {
            assert(self.swap_exists.read(swap_id), 'swap not found');
            let mut swap = self.swaps.read(swap_id);
            assert(swap.status == 0, 'swap not active');
            assert(swap.epochs_settled == swap.duration_epochs, 'not all epochs settled');

            let token = ICollateralTokenDispatcher { contract_address: self.collateral_token.read() };
            if swap.fixed_collateral > 0 {
                token.transfer(swap.fixed_party, swap.fixed_collateral);
            }
            if swap.variable_collateral > 0 {
                token.transfer(swap.variable_party, swap.variable_collateral);
            }
            swap.status = 1;
            swap.fixed_collateral = 0;
            swap.variable_collateral = 0;
            self.swaps.write(swap_id, swap);

            self.emit(SwapClosed { swap_id });
        }

        // Fixed party cancels an open (unaccepted) offer and reclaims collateral.
        fn cancel_offer(ref self: ContractState, offer_id: u64) {
            assert(self.offer_exists.read(offer_id), 'offer not found');
            let mut offer = self.offers.read(offer_id);
            assert(offer.status == 0, 'offer not open');
            assert(get_caller_address() == offer.fixed_party, 'not authorized');

            let token = ICollateralTokenDispatcher { contract_address: self.collateral_token.read() };
            token.transfer(offer.fixed_party, offer.collateral);

            offer.status = 2;
            self.offers.write(offer_id, offer);
            self.emit(OfferCancelled { offer_id });
        }

        fn get_offer(self: @ContractState, offer_id: u64) -> Option<Offer> {
            if self.offer_exists.read(offer_id) {
                Option::Some(self.offers.read(offer_id))
            } else {
                Option::None
            }
        }

        fn get_swap(self: @ContractState, swap_id: u64) -> Option<Swap> {
            if self.swap_exists.read(swap_id) {
                Option::Some(self.swaps.read(swap_id))
            } else {
                Option::None
            }
        }

        fn get_epoch_settlement(
            self: @ContractState, swap_id: u64, epoch: u64,
        ) -> Option<EpochSettlement> {
            if self.epoch_settlement_exists.read((swap_id, epoch)) {
                Option::Some(self.epoch_settlements.read((swap_id, epoch)))
            } else {
                Option::None
            }
        }

        // Highest offer id assigned so far. Offer ids are sequential
        // starting at 1, so a frontend can discover all offers by
        // iterating 1..=get_offer_count() and calling get_offer per id —
        // there's no on-chain enumeration/indexing beyond that.
        fn get_offer_count(self: @ContractState) -> u64 {
            self.offer_nonce.read()
        }

        // Highest swap id assigned so far. Same iteration pattern as
        // get_offer_count.
        fn get_swap_count(self: @ContractState) -> u64 {
            self.swap_nonce.read()
        }
    }
}
