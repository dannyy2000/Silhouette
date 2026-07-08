use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use silhouette::staking_rate_oracle::IStakingRateOracleDispatcherTrait;
use crate::utils::{deploy_oracle, owner};

fn other() -> starknet::ContractAddress {
    starknet::contract_address_const::<'other'>()
}

#[test]
fn test_submit_and_read_epoch_rate() {
    let oracle = deploy_oracle(owner());

    start_cheat_caller_address(oracle.contract_address, owner());
    let rate = oracle.submit_epoch_rate(85, 800_000_000, 10_000_000_000_000);
    stop_cheat_caller_address(oracle.contract_address);

    assert(rate == 80, 'wrong rate');
    let stored = oracle.get_epoch_rate(85).unwrap();
    assert(stored.rate_bps == 80, 'wrong stored rate');
    assert(oracle.get_latest_epoch() == 85, 'wrong latest epoch');
}

#[test]
#[should_panic(expected: 'not authorized')]
fn test_non_owner_cannot_submit() {
    let oracle = deploy_oracle(owner());

    start_cheat_caller_address(oracle.contract_address, other());
    oracle.submit_epoch_rate(1, 100, 1000);
    stop_cheat_caller_address(oracle.contract_address);
}

#[test]
#[should_panic(expected: 'epoch rate exists')]
fn test_duplicate_epoch_rejected() {
    let oracle = deploy_oracle(owner());

    start_cheat_caller_address(oracle.contract_address, owner());
    oracle.submit_epoch_rate(1, 100, 1000);
    oracle.submit_epoch_rate(1, 200, 1000);
    stop_cheat_caller_address(oracle.contract_address);
}

#[test]
#[should_panic(expected: 'zero staked')]
fn test_zero_staked_rejected() {
    let oracle = deploy_oracle(owner());

    start_cheat_caller_address(oracle.contract_address, owner());
    oracle.submit_epoch_rate(1, 100, 0);
    stop_cheat_caller_address(oracle.contract_address);
}
