// i_collateral_token.cairo
//
// Placeholder collateral-token interface for the POC.
//
// Today this is implemented by `mock_collateral_token.cairo` — a plain,
// fully public ERC-20-style token.
//
// transfer_from is allowance-based (approve then transfer_from), same as
// a standard ERC-20 — Starknet's get_caller_address() is the *immediate*
// caller, not the original account, so swap_core.cairo calling
// transfer_from on a user's behalf can't be authorized by comparing
// addresses directly. Both parties must call
// `approve(swap_core_address, amount)` before post_offer/accept_offer.
//
// Once Silhouette has STRK20 SDK access (gated, partner-only as of this
// writing), this interface is what gets swapped out: `transfer`/
// `transfer_from` calls here get replaced with STRK20 shielded-balance
// deposit/withdraw calls, so `swap_core.cairo` does not need to change at
// all. Keeping the swap logic and the collateral-movement logic behind
// this interface is what makes that swap possible later without touching
// settlement math.

use starknet::ContractAddress;

#[starknet::interface]
pub trait ICollateralToken<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState,
        sender: ContractAddress,
        recipient: ContractAddress,
        amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn allowance(
        self: @TContractState, owner: ContractAddress, spender: ContractAddress,
    ) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn mint(ref self: TContractState, recipient: ContractAddress, amount: u256);
}
