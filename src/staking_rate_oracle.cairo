// staking_rate_oracle.cairo
//
// Stores the verified yield rate for each staking epoch, which
// swap_core.cairo reads at settlement.
//
// Rate definition:
//   rate_bps = strk_reward * 1_000_000 / total_btc_staked_sats
// i.e. STRK emitted to BTC stakers, per 1,000,000 sats of BTC staked,
// for one staking epoch.
//
// Phase 1 (this file, POC): contract owner submits the rate manually
// after each epoch.
//
// Phase 2 (not built yet): Starknet's own staking contract already holds
// total BTC staked, total STRK staked, and the emission split on-chain,
// on the same chain as this contract. That means Phase 2 here is a
// direct cross-contract read of Starknet's native staking state — no
// cross-chain proof needed, since the yield source and the swap contract
// live on the same chain. This is genuinely simpler to get to "no admin
// trust" than a cross-chain equivalent would be.

use starknet::ContractAddress;

#[derive(Drop, Serde, starknet::Store)]
pub struct EpochRate {
    pub strk_reward: u256,
    pub total_btc_staked: u256,
    pub rate_bps: u256,
    pub submitted_at: u64,
}

#[starknet::interface]
pub trait IStakingRateOracle<TContractState> {
    fn submit_epoch_rate(
        ref self: TContractState, epoch: u64, strk_reward: u256, total_btc_staked: u256,
    ) -> u256;
    fn get_epoch_rate(self: @TContractState, epoch: u64) -> Option<EpochRate>;
    fn get_latest_rate(self: @TContractState) -> Option<EpochRate>;
    fn get_latest_epoch(self: @TContractState) -> u64;
    fn get_owner(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
mod StakingRateOracle {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };
    use super::EpochRate;

    const PRECISION: u256 = 1_000_000;

    #[storage]
    struct Storage {
        owner: ContractAddress,
        epoch_rates: Map<u64, EpochRate>,
        epoch_rate_exists: Map<u64, bool>,
        latest_epoch: u64,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RateSubmitted: RateSubmitted,
    }

    #[derive(Drop, starknet::Event)]
    struct RateSubmitted {
        #[key]
        epoch: u64,
        rate_bps: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, owner: ContractAddress) {
        self.owner.write(owner);
    }

    #[abi(embed_v0)]
    impl StakingRateOracleImpl of super::IStakingRateOracle<ContractState> {
        fn submit_epoch_rate(
            ref self: ContractState, epoch: u64, strk_reward: u256, total_btc_staked: u256,
        ) -> u256 {
            assert(get_caller_address() == self.owner.read(), 'not authorized');
            assert(!self.epoch_rate_exists.read(epoch), 'epoch rate exists');
            assert(total_btc_staked > 0, 'zero staked');

            let rate_bps = (strk_reward * PRECISION) / total_btc_staked;
            let record = EpochRate {
                strk_reward, total_btc_staked, rate_bps, submitted_at: get_block_timestamp(),
            };
            self.epoch_rates.write(epoch, record);
            self.epoch_rate_exists.write(epoch, true);

            if epoch >= self.latest_epoch.read() {
                self.latest_epoch.write(epoch);
            }

            self.emit(RateSubmitted { epoch, rate_bps });
            rate_bps
        }

        fn get_epoch_rate(self: @ContractState, epoch: u64) -> Option<EpochRate> {
            if self.epoch_rate_exists.read(epoch) {
                Option::Some(self.epoch_rates.read(epoch))
            } else {
                Option::None
            }
        }

        fn get_latest_rate(self: @ContractState) -> Option<EpochRate> {
            self.get_epoch_rate(self.latest_epoch.read())
        }

        fn get_latest_epoch(self: @ContractState) -> u64 {
            self.latest_epoch.read()
        }

        fn get_owner(self: @ContractState) -> ContractAddress {
            self.owner.read()
        }
    }
}
