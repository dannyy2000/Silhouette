export const stakingRateOracleAbi = [
  {
    "type": "impl",
    "name": "StakingRateOracleImpl",
    "interface_name": "silhouette::staking_rate_oracle::IStakingRateOracle"
  },
  {
    "type": "struct",
    "name": "core::integer::u256",
    "members": [
      {
        "name": "low",
        "type": "core::integer::u128"
      },
      {
        "name": "high",
        "type": "core::integer::u128"
      }
    ]
  },
  {
    "type": "struct",
    "name": "silhouette::staking_rate_oracle::EpochRate",
    "members": [
      {
        "name": "strk_reward",
        "type": "core::integer::u256"
      },
      {
        "name": "total_btc_staked",
        "type": "core::integer::u256"
      },
      {
        "name": "rate_bps",
        "type": "core::integer::u256"
      },
      {
        "name": "submitted_at",
        "type": "core::integer::u64"
      }
    ]
  },
  {
    "type": "enum",
    "name": "core::option::Option::<silhouette::staking_rate_oracle::EpochRate>",
    "variants": [
      {
        "name": "Some",
        "type": "silhouette::staking_rate_oracle::EpochRate"
      },
      {
        "name": "None",
        "type": "()"
      }
    ]
  },
  {
    "type": "interface",
    "name": "silhouette::staking_rate_oracle::IStakingRateOracle",
    "items": [
      {
        "type": "function",
        "name": "submit_epoch_rate",
        "inputs": [
          {
            "name": "epoch",
            "type": "core::integer::u64"
          },
          {
            "name": "strk_reward",
            "type": "core::integer::u256"
          },
          {
            "name": "total_btc_staked",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "core::integer::u256"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "get_epoch_rate",
        "inputs": [
          {
            "name": "epoch",
            "type": "core::integer::u64"
          }
        ],
        "outputs": [
          {
            "type": "core::option::Option::<silhouette::staking_rate_oracle::EpochRate>"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_latest_rate",
        "inputs": [],
        "outputs": [
          {
            "type": "core::option::Option::<silhouette::staking_rate_oracle::EpochRate>"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_latest_epoch",
        "inputs": [],
        "outputs": [
          {
            "type": "core::integer::u64"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_owner",
        "inputs": [],
        "outputs": [
          {
            "type": "core::starknet::contract_address::ContractAddress"
          }
        ],
        "state_mutability": "view"
      }
    ]
  },
  {
    "type": "constructor",
    "name": "constructor",
    "inputs": [
      {
        "name": "owner",
        "type": "core::starknet::contract_address::ContractAddress"
      }
    ]
  },
  {
    "type": "event",
    "name": "silhouette::staking_rate_oracle::StakingRateOracle::RateSubmitted",
    "kind": "struct",
    "members": [
      {
        "name": "epoch",
        "type": "core::integer::u64",
        "kind": "key"
      },
      {
        "name": "rate_bps",
        "type": "core::integer::u256",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "silhouette::staking_rate_oracle::StakingRateOracle::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "RateSubmitted",
        "type": "silhouette::staking_rate_oracle::StakingRateOracle::RateSubmitted",
        "kind": "nested"
      }
    ]
  }
] as const;
