export const swapCoreAbi = [
  {
    "type": "impl",
    "name": "SwapCoreImpl",
    "interface_name": "silhouette::swap_core::ISwapCore"
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
    "name": "silhouette::swap_core::Offer",
    "members": [
      {
        "name": "fixed_party",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "notional",
        "type": "core::integer::u256"
      },
      {
        "name": "fixed_rate_bps",
        "type": "core::integer::u256"
      },
      {
        "name": "duration_epochs",
        "type": "core::integer::u64"
      },
      {
        "name": "collateral",
        "type": "core::integer::u256"
      },
      {
        "name": "status",
        "type": "core::integer::u8"
      }
    ]
  },
  {
    "type": "enum",
    "name": "core::option::Option::<silhouette::swap_core::Offer>",
    "variants": [
      {
        "name": "Some",
        "type": "silhouette::swap_core::Offer"
      },
      {
        "name": "None",
        "type": "()"
      }
    ]
  },
  {
    "type": "struct",
    "name": "silhouette::swap_core::Swap",
    "members": [
      {
        "name": "offer_id",
        "type": "core::integer::u64"
      },
      {
        "name": "fixed_party",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "variable_party",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "notional",
        "type": "core::integer::u256"
      },
      {
        "name": "fixed_rate_bps",
        "type": "core::integer::u256"
      },
      {
        "name": "duration_epochs",
        "type": "core::integer::u64"
      },
      {
        "name": "start_epoch",
        "type": "core::integer::u64"
      },
      {
        "name": "epochs_settled",
        "type": "core::integer::u64"
      },
      {
        "name": "fixed_collateral",
        "type": "core::integer::u256"
      },
      {
        "name": "variable_collateral",
        "type": "core::integer::u256"
      },
      {
        "name": "status",
        "type": "core::integer::u8"
      }
    ]
  },
  {
    "type": "enum",
    "name": "core::option::Option::<silhouette::swap_core::Swap>",
    "variants": [
      {
        "name": "Some",
        "type": "silhouette::swap_core::Swap"
      },
      {
        "name": "None",
        "type": "()"
      }
    ]
  },
  {
    "type": "struct",
    "name": "silhouette::swap_core::EpochSettlement",
    "members": [
      {
        "name": "fixed_payment",
        "type": "core::integer::u256"
      },
      {
        "name": "variable_payment",
        "type": "core::integer::u256"
      },
      {
        "name": "settled_at",
        "type": "core::integer::u64"
      }
    ]
  },
  {
    "type": "enum",
    "name": "core::option::Option::<silhouette::swap_core::EpochSettlement>",
    "variants": [
      {
        "name": "Some",
        "type": "silhouette::swap_core::EpochSettlement"
      },
      {
        "name": "None",
        "type": "()"
      }
    ]
  },
  {
    "type": "interface",
    "name": "silhouette::swap_core::ISwapCore",
    "items": [
      {
        "type": "function",
        "name": "post_offer",
        "inputs": [
          {
            "name": "notional",
            "type": "core::integer::u256"
          },
          {
            "name": "fixed_rate_bps",
            "type": "core::integer::u256"
          },
          {
            "name": "duration_epochs",
            "type": "core::integer::u64"
          },
          {
            "name": "collateral",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "core::integer::u64"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "accept_offer",
        "inputs": [
          {
            "name": "offer_id",
            "type": "core::integer::u64"
          },
          {
            "name": "variable_collateral",
            "type": "core::integer::u256"
          }
        ],
        "outputs": [
          {
            "type": "core::integer::u64"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "settle_epoch",
        "inputs": [
          {
            "name": "swap_id",
            "type": "core::integer::u64"
          },
          {
            "name": "epoch",
            "type": "core::integer::u64"
          }
        ],
        "outputs": [
          {
            "type": "(core::integer::u256, core::integer::u256)"
          }
        ],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "close_swap",
        "inputs": [
          {
            "name": "swap_id",
            "type": "core::integer::u64"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "cancel_offer",
        "inputs": [
          {
            "name": "offer_id",
            "type": "core::integer::u64"
          }
        ],
        "outputs": [],
        "state_mutability": "external"
      },
      {
        "type": "function",
        "name": "get_offer",
        "inputs": [
          {
            "name": "offer_id",
            "type": "core::integer::u64"
          }
        ],
        "outputs": [
          {
            "type": "core::option::Option::<silhouette::swap_core::Offer>"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_swap",
        "inputs": [
          {
            "name": "swap_id",
            "type": "core::integer::u64"
          }
        ],
        "outputs": [
          {
            "type": "core::option::Option::<silhouette::swap_core::Swap>"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_epoch_settlement",
        "inputs": [
          {
            "name": "swap_id",
            "type": "core::integer::u64"
          },
          {
            "name": "epoch",
            "type": "core::integer::u64"
          }
        ],
        "outputs": [
          {
            "type": "core::option::Option::<silhouette::swap_core::EpochSettlement>"
          }
        ],
        "state_mutability": "view"
      },
      {
        "type": "function",
        "name": "get_offer_count",
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
        "name": "get_swap_count",
        "inputs": [],
        "outputs": [
          {
            "type": "core::integer::u64"
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
        "name": "collateral_token",
        "type": "core::starknet::contract_address::ContractAddress"
      },
      {
        "name": "rate_oracle",
        "type": "core::starknet::contract_address::ContractAddress"
      }
    ]
  },
  {
    "type": "event",
    "name": "silhouette::swap_core::SwapCore::OfferPosted",
    "kind": "struct",
    "members": [
      {
        "name": "offer_id",
        "type": "core::integer::u64",
        "kind": "key"
      },
      {
        "name": "fixed_party",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "notional",
        "type": "core::integer::u256",
        "kind": "data"
      },
      {
        "name": "fixed_rate_bps",
        "type": "core::integer::u256",
        "kind": "data"
      },
      {
        "name": "duration_epochs",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "silhouette::swap_core::SwapCore::SwapCreated",
    "kind": "struct",
    "members": [
      {
        "name": "swap_id",
        "type": "core::integer::u64",
        "kind": "key"
      },
      {
        "name": "offer_id",
        "type": "core::integer::u64",
        "kind": "data"
      },
      {
        "name": "variable_party",
        "type": "core::starknet::contract_address::ContractAddress",
        "kind": "data"
      },
      {
        "name": "start_epoch",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "silhouette::swap_core::SwapCore::EpochSettled",
    "kind": "struct",
    "members": [
      {
        "name": "swap_id",
        "type": "core::integer::u64",
        "kind": "key"
      },
      {
        "name": "epoch",
        "type": "core::integer::u64",
        "kind": "data"
      },
      {
        "name": "fixed_payment",
        "type": "core::integer::u256",
        "kind": "data"
      },
      {
        "name": "variable_payment",
        "type": "core::integer::u256",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "silhouette::swap_core::SwapCore::Liquidation",
    "kind": "struct",
    "members": [
      {
        "name": "swap_id",
        "type": "core::integer::u64",
        "kind": "key"
      },
      {
        "name": "epoch",
        "type": "core::integer::u64",
        "kind": "data"
      }
    ]
  },
  {
    "type": "event",
    "name": "silhouette::swap_core::SwapCore::SwapClosed",
    "kind": "struct",
    "members": [
      {
        "name": "swap_id",
        "type": "core::integer::u64",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "silhouette::swap_core::SwapCore::OfferCancelled",
    "kind": "struct",
    "members": [
      {
        "name": "offer_id",
        "type": "core::integer::u64",
        "kind": "key"
      }
    ]
  },
  {
    "type": "event",
    "name": "silhouette::swap_core::SwapCore::Event",
    "kind": "enum",
    "variants": [
      {
        "name": "OfferPosted",
        "type": "silhouette::swap_core::SwapCore::OfferPosted",
        "kind": "nested"
      },
      {
        "name": "SwapCreated",
        "type": "silhouette::swap_core::SwapCore::SwapCreated",
        "kind": "nested"
      },
      {
        "name": "EpochSettled",
        "type": "silhouette::swap_core::SwapCore::EpochSettled",
        "kind": "nested"
      },
      {
        "name": "Liquidation",
        "type": "silhouette::swap_core::SwapCore::Liquidation",
        "kind": "nested"
      },
      {
        "name": "SwapClosed",
        "type": "silhouette::swap_core::SwapCore::SwapClosed",
        "kind": "nested"
      },
      {
        "name": "OfferCancelled",
        "type": "silhouette::swap_core::SwapCore::OfferCancelled",
        "kind": "nested"
      }
    ]
  }
] as const;
