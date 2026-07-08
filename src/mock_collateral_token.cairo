// mock_collateral_token.cairo
//
// Testnet stand-in for shielded BTC collateral. Plain, fully public
// balances. This contract exists purely so swap_core.cairo has something
// real to call during the POC; it gets replaced by an STRK20
// shielded-balance integration once SDK access is granted (see
// interfaces/i_collateral_token.cairo for where that swap happens).
//
// Anyone can mint on testnet. Do not deploy this to mainnet.

#[starknet::contract]
mod MockCollateralToken {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        total_supply: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
        Approval: Approval,
        Mint: Mint,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        #[key]
        from: ContractAddress,
        #[key]
        to: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Approval {
        #[key]
        owner: ContractAddress,
        #[key]
        spender: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Mint {
        #[key]
        to: ContractAddress,
        amount: u256,
    }

    #[abi(embed_v0)]
    impl MockCollateralTokenImpl of crate::interfaces::i_collateral_token::ICollateralToken<ContractState> {
        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self._move(caller, recipient, amount);
            true
        }

        fn transfer_from(
            ref self: ContractState,
            sender: ContractAddress,
            recipient: ContractAddress,
            amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.allowances.read((sender, caller));
            assert(current_allowance >= amount, 'insufficient allowance');
            self.allowances.write((sender, caller), current_allowance - amount);
            self._move(sender, recipient, amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self.allowances.write((caller, spender), amount);
            self.emit(Approval { owner: caller, spender, amount });
            true
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.allowances.read((owner, spender))
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn mint(ref self: ContractState, recipient: ContractAddress, amount: u256) {
            let bal = self.balances.read(recipient);
            self.balances.write(recipient, bal + amount);
            self.total_supply.write(self.total_supply.read() + amount);
            self.emit(Mint { to: recipient, amount });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _move(
            ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u256,
        ) {
            let from_bal = self.balances.read(from);
            assert(from_bal >= amount, 'insufficient balance');
            self.balances.write(from, from_bal - amount);
            let to_bal = self.balances.read(to);
            self.balances.write(to, to_bal + amount);
            self.emit(Transfer { from, to, amount });
        }
    }
}
