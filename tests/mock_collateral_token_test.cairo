use starknet::contract_address_const;
use snforge_std::{start_cheat_caller_address, stop_cheat_caller_address};
use silhouette::interfaces::i_collateral_token::ICollateralTokenDispatcherTrait;
use crate::utils::deploy_mock_token;

fn alice() -> starknet::ContractAddress {
    contract_address_const::<'alice'>()
}

fn bob() -> starknet::ContractAddress {
    contract_address_const::<'bob'>()
}

#[test]
fn test_mint_and_balance() {
    let token = deploy_mock_token();
    token.mint(alice(), 1000);
    assert(token.balance_of(alice()) == 1000, 'wrong balance');
}

#[test]
fn test_transfer() {
    let token = deploy_mock_token();
    token.mint(alice(), 1000);

    start_cheat_caller_address(token.contract_address, alice());
    token.transfer(bob(), 400);
    stop_cheat_caller_address(token.contract_address);

    assert(token.balance_of(alice()) == 600, 'alice wrong');
    assert(token.balance_of(bob()) == 400, 'bob wrong');
}

#[test]
fn test_transfer_from_with_allowance() {
    let token = deploy_mock_token();
    token.mint(alice(), 1000);
    let spender = contract_address_const::<'spender'>();

    start_cheat_caller_address(token.contract_address, alice());
    token.approve(spender, 500);
    stop_cheat_caller_address(token.contract_address);

    start_cheat_caller_address(token.contract_address, spender);
    token.transfer_from(alice(), bob(), 300);
    stop_cheat_caller_address(token.contract_address);

    assert(token.balance_of(alice()) == 700, 'alice wrong');
    assert(token.balance_of(bob()) == 300, 'bob wrong');
    assert(token.allowance(alice(), spender) == 200, 'allowance wrong');
}

#[test]
#[should_panic(expected: 'insufficient allowance')]
fn test_transfer_from_without_allowance_fails() {
    let token = deploy_mock_token();
    token.mint(alice(), 1000);

    start_cheat_caller_address(token.contract_address, bob());
    token.transfer_from(alice(), bob(), 100);
    stop_cheat_caller_address(token.contract_address);
}

#[test]
#[should_panic(expected: 'insufficient balance')]
fn test_transfer_insufficient_balance_fails() {
    let token = deploy_mock_token();

    start_cheat_caller_address(token.contract_address, alice());
    token.transfer(bob(), 100);
    stop_cheat_caller_address(token.contract_address);
}
