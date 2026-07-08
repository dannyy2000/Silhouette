use starknet::ContractAddress;
use snforge_std::{declare, ContractClassTrait, DeclareResultTrait};
use silhouette::interfaces::i_collateral_token::ICollateralTokenDispatcher;
use silhouette::staking_rate_oracle::IStakingRateOracleDispatcher;
use silhouette::swap_core::ISwapCoreDispatcher;

pub fn owner() -> ContractAddress {
    starknet::contract_address_const::<'owner'>()
}

pub fn fixed_party() -> ContractAddress {
    starknet::contract_address_const::<'fixed'>()
}

pub fn variable_party() -> ContractAddress {
    starknet::contract_address_const::<'variable'>()
}

pub fn deploy_mock_token() -> ICollateralTokenDispatcher {
    let contract = declare("MockCollateralToken").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![]).unwrap();
    ICollateralTokenDispatcher { contract_address: address }
}

pub fn deploy_oracle(owner_addr: ContractAddress) -> IStakingRateOracleDispatcher {
    let contract = declare("StakingRateOracle").unwrap().contract_class();
    let (address, _) = contract.deploy(@array![owner_addr.into()]).unwrap();
    IStakingRateOracleDispatcher { contract_address: address }
}

pub fn deploy_swap_core(
    collateral_token: ContractAddress, rate_oracle: ContractAddress,
) -> ISwapCoreDispatcher {
    let contract = declare("SwapCore").unwrap().contract_class();
    let (address, _) = contract
        .deploy(@array![collateral_token.into(), rate_oracle.into()])
        .unwrap();
    ISwapCoreDispatcher { contract_address: address }
}
