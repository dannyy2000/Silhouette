use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use silhouette::interfaces::i_collateral_token::{
    ICollateralTokenDispatcher, ICollateralTokenDispatcherTrait,
};
use silhouette::staking_rate_oracle::{
    IStakingRateOracleDispatcher, IStakingRateOracleDispatcherTrait,
};
use silhouette::swap_core::{ISwapCoreDispatcher, ISwapCoreDispatcherTrait};
use crate::utils::{deploy_mock_token, deploy_oracle, deploy_swap_core, owner, fixed_party, variable_party};

fn setup() -> (ICollateralTokenDispatcher, IStakingRateOracleDispatcher, ISwapCoreDispatcher) {
    let token = deploy_mock_token();
    let oracle = deploy_oracle(owner());
    let swap_core = deploy_swap_core(token.contract_address, oracle.contract_address);

    token.mint(fixed_party(), 100_000_000);
    token.mint(variable_party(), 100_000_000);

    (token, oracle, swap_core)
}

fn create_swap(
    token: ICollateralTokenDispatcher,
    swap_core: ISwapCoreDispatcher,
    notional: u256,
    fixed_rate_bps: u256,
    duration_epochs: u64,
    fixed_collateral: u256,
    variable_collateral: u256,
) -> u64 {
    start_cheat_caller_address(token.contract_address, fixed_party());
    token.approve(swap_core.contract_address, fixed_collateral);
    stop_cheat_caller_address(token.contract_address);

    start_cheat_caller_address(swap_core.contract_address, fixed_party());
    let offer_id = swap_core.post_offer(notional, fixed_rate_bps, duration_epochs, fixed_collateral);
    stop_cheat_caller_address(swap_core.contract_address);

    start_cheat_caller_address(token.contract_address, variable_party());
    token.approve(swap_core.contract_address, variable_collateral);
    stop_cheat_caller_address(token.contract_address);

    start_cheat_caller_address(swap_core.contract_address, variable_party());
    let swap_id = swap_core.accept_offer(offer_id, variable_collateral);
    stop_cheat_caller_address(swap_core.contract_address);

    swap_id
}

#[test]
fn test_full_lifecycle() {
    let (token, oracle, swap_core) = setup();

    let swap_id = create_swap(token, swap_core, 10_000_000, 80, 2, 5_000_000, 7_500_000);

    let swap = swap_core.get_swap(swap_id).unwrap();
    assert(swap.start_epoch == 1, 'wrong start epoch');
    assert(swap.status == 0, 'wrong status');
    assert(token.balance_of(swap_core.contract_address) == 12_500_000, 'wrong escrow');
    assert(swap_core.get_offer_count() == 1, 'wrong offer count');
    assert(swap_core.get_swap_count() == 1, 'wrong swap count');

    // Epoch 1: actual rate (95 bps) > fixed rate (80 bps) — variable wins.
    start_cheat_caller_address(oracle.contract_address, owner());
    oracle.submit_epoch_rate(1, 950_000_000, 10_000_000_000_000);
    stop_cheat_caller_address(oracle.contract_address);

    let (fixed_pmt, variable_pmt) = swap_core.settle_epoch(swap_id, 1);
    assert(fixed_pmt == 800, 'wrong fixed pmt');
    assert(variable_pmt == 950, 'wrong variable pmt');

    let swap_after_1 = swap_core.get_swap(swap_id).unwrap();
    assert(swap_after_1.fixed_collateral == 5_000_000 - 150, 'fixed col epoch 1');
    assert(swap_after_1.variable_collateral == 7_500_000 + 150, 'var col epoch 1');

    // Epoch 2: actual rate (55 bps) < fixed rate (80 bps) — fixed wins.
    start_cheat_caller_address(oracle.contract_address, owner());
    oracle.submit_epoch_rate(2, 550_000_000, 10_000_000_000_000);
    stop_cheat_caller_address(oracle.contract_address);

    swap_core.settle_epoch(swap_id, 2);

    let swap_after_2 = swap_core.get_swap(swap_id).unwrap();
    assert(swap_after_2.epochs_settled == 2, 'not all settled');
    assert(swap_after_2.fixed_collateral == 4_999_850 + 250, 'fixed col epoch 2');
    assert(swap_after_2.variable_collateral == 7_500_150 - 250, 'var col epoch 2');

    swap_core.close_swap(swap_id);

    let closed = swap_core.get_swap(swap_id).unwrap();
    assert(closed.status == 1, 'not completed');
    assert(closed.fixed_collateral == 0, 'fixed col not released');
    assert(closed.variable_collateral == 0, 'var col not released');
    assert(token.balance_of(fixed_party()) == 100_000_100, 'fixed final balance');
    assert(token.balance_of(variable_party()) == 99_999_900, 'variable final balance');
}

#[test]
fn test_cancel_offer() {
    let (token, _oracle, swap_core) = setup();

    start_cheat_caller_address(token.contract_address, fixed_party());
    token.approve(swap_core.contract_address, 5_000_000);
    stop_cheat_caller_address(token.contract_address);

    start_cheat_caller_address(swap_core.contract_address, fixed_party());
    let offer_id = swap_core.post_offer(10_000_000, 80, 2, 5_000_000);
    swap_core.cancel_offer(offer_id);
    stop_cheat_caller_address(swap_core.contract_address);

    let offer = swap_core.get_offer(offer_id).unwrap();
    assert(offer.status == 2, 'not cancelled');
    assert(token.balance_of(fixed_party()) == 100_000_000, 'collateral not returned');
}

#[test]
#[should_panic(expected: 'epoch already settled')]
fn test_double_settlement_rejected() {
    let (token, oracle, swap_core) = setup();
    let swap_id = create_swap(token, swap_core, 10_000_000, 80, 2, 5_000_000, 7_500_000);

    start_cheat_caller_address(oracle.contract_address, owner());
    oracle.submit_epoch_rate(1, 800_000_000, 10_000_000_000_000);
    stop_cheat_caller_address(oracle.contract_address);

    swap_core.settle_epoch(swap_id, 1);
    swap_core.settle_epoch(swap_id, 1);
}

#[test]
#[should_panic(expected: "oracle rate not found")]
fn test_oracle_rate_not_found_panics() {
    let (token, _oracle, swap_core) = setup();
    let swap_id = create_swap(token, swap_core, 10_000_000, 80, 2, 5_000_000, 7_500_000);

    swap_core.settle_epoch(swap_id, 1);
}

#[test]
fn test_liquidation_path() {
    let (token, oracle, swap_core) = setup();
    // Variable collateral (500) can't cover the fixed party's payout
    // (800) once the actual rate drops to 0 — should force-liquidate.
    let swap_id = create_swap(token, swap_core, 10_000_000, 80, 3, 5_000_000, 500);

    start_cheat_caller_address(oracle.contract_address, owner());
    oracle.submit_epoch_rate(1, 0, 10_000_000_000_000);
    stop_cheat_caller_address(oracle.contract_address);

    swap_core.settle_epoch(swap_id, 1);

    let swap = swap_core.get_swap(swap_id).unwrap();
    assert(swap.status == 2, 'not liquidated');
    assert(swap.fixed_collateral == 0, 'fixed col not zeroed');
    assert(swap.variable_collateral == 0, 'var col not zeroed');
}
