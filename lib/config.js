import { parseAbi } from "viem";
import { base, baseSepolia } from "wagmi/chains";

export const IS_MAINNET = process.env.NEXT_PUBLIC_NETWORK !== "sepolia"; // Base mainnet unless set to "sepolia"
export const CHAIN = IS_MAINNET ? base : baseSepolia;
export const USDC = IS_MAINNET
  ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC on Base
  : "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // test USDC on Base Sepolia
export const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
export const APP_URL = (process.env.NEXT_PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
export const BASE_PRICE = 100000n; // $0.10 (USDC has 6 decimals)
export const POS = ["FWD", "MID", "MID", "DEF", "DEF", "GK"];
export const ROWS = [[0], [1, 2], [3, 4], [5]];

export const ABI = parseAbi([
  "function createSquad(string name, uint8[6] players, uint256 fid, uint256 deadline, bytes sig)",
  "function mint(uint256 id, uint256 fid, uint256 deadline, bytes sig)",
  "function finalizeRound()",
  "function claim(uint256 round)",
  "function currentRound() view returns (uint256)",
  "function roundEnd() view returns (uint256)",
  "function roundTotal(uint256) view returns (uint256)",
  "function leader(uint256) view returns (uint256)",
  "function getRoundSquads(uint256) view returns (uint256[])",
  "function getSquad(uint256) view returns ((string name, address creator, uint64 round, uint32 mints, uint8[6] players, uint256 paid, uint256 creatorFid))",
  "function cardPrice(uint256) view returns (uint256)",
  "function hasCard(uint256, uint256) view returns (bool)",
  "function paidBy(uint256, address) view returns (uint256)",
  "function pendingClaim(uint256, address) view returns (uint256)",
]);

export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address a) view returns (uint256)",
]);
