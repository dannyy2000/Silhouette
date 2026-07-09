import { mockCollateralTokenAbi } from "./abi/MockCollateralToken";
import { stakingRateOracleAbi } from "./abi/StakingRateOracle";
import { swapCoreAbi } from "./abi/SwapCore";

// Deployed to Starknet Sepolia. See README.md "Deployment" for explorer
// links and redeploy instructions.
export const CONTRACTS = {
  collateralToken: {
    address:
      process.env.NEXT_PUBLIC_COLLATERAL_TOKEN_ADDRESS ??
      "0x016e27eb35d9faf774600b3cedf2236743fea410c876a4a57d7cbc371c61a245",
    abi: mockCollateralTokenAbi,
  },
  rateOracle: {
    address:
      process.env.NEXT_PUBLIC_RATE_ORACLE_ADDRESS ??
      "0x043afc7db2618c4e5a7c886951c1e018bcd72324eb352f360c7bc174af400976",
    abi: stakingRateOracleAbi,
  },
  swapCore: {
    address:
      process.env.NEXT_PUBLIC_SWAP_CORE_ADDRESS ??
      "0x05842b6f42dbd0f0ceb399795d60b4d4461fb8a48b75ed9161e2b37ea6f51451",
    abi: swapCoreAbi,
  },
} as const;
