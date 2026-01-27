export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const raffleManagerAbi = [
  // -------------------------
  // Core
  // -------------------------
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "rTypeU8", type: "uint8" },
      { name: "tickets", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getRoundInfo",
    stateMutability: "view",
    inputs: [{ name: "rTypeU8", type: "uint8" }],
    outputs: [
      { name: "roundId", type: "uint256" },
      { name: "targetPot", type: "uint256" },
      { name: "deposited", type: "uint256" },
      { name: "totalTickets", type: "uint32" },
      { name: "drawing", type: "bool" },
      { name: "requestId", type: "uint256" },
    ],
  },

  // -------------------------
  // Claim buckets
  // -------------------------
  {
    type: "function",
    name: "winnings",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "refunds",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },

  // -------------------------
  // Reveal
  // -------------------------
  {
    type: "function",
    name: "revealableRound",
    stateMutability: "view",
    inputs: [
      { name: "rTypeU8", type: "uint8" },
      { name: "user", type: "address" },
    ],
    outputs: [
      { name: "ok", type: "bool" },
      { name: "roundId", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "reveal",
    stateMutability: "nonpayable",
    inputs: [{ name: "rTypeU8", type: "uint8" }],
    outputs: [],
  },

  // -------------------------
  // History
  // -------------------------
  {
    type: "function",
    name: "getHistory",
    stateMutability: "view",
    inputs: [
      { name: "rTypeU8", type: "uint8" },
      { name: "start", type: "uint256" },
      { name: "count", type: "uint256" },
    ],
    outputs: [
      {
        name: "out",
        type: "tuple[]",
        components: [
          { name: "roundId", type: "uint256" },
          { name: "requestId", type: "uint256" },
          { name: "w1", type: "address" },
          { name: "w2", type: "address" },
          { name: "w3", type: "address" },
          { name: "p1", type: "uint256" },
          { name: "p2", type: "uint256" },
          { name: "p3", type: "uint256" },
          { name: "runnerEach", type: "uint256" },
          { name: "winnersTotal", type: "uint256" },
          { name: "stakersPaid", type: "uint256" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },

  // -------------------------
  // Events
  // -------------------------
  {
    type: "event",
    name: "Finalized",
    inputs: [
      { name: "rType", type: "uint8", indexed: true },
      { name: "roundId", type: "uint256", indexed: true },
      { name: "requestId", type: "uint256", indexed: false },
      { name: "w1", type: "address", indexed: false },
      { name: "w2", type: "address", indexed: false },
      { name: "w3", type: "address", indexed: false },
      { name: "p1", type: "uint256", indexed: false },
      { name: "p2", type: "uint256", indexed: false },
      { name: "p3", type: "uint256", indexed: false },
      { name: "runnerEach", type: "uint256", indexed: false },
      { name: "winnersTotal", type: "uint256", indexed: false },
      { name: "stakersPaid", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "winningsPaid", type: "uint256", indexed: false },
      { name: "refundsPaid", type: "uint256", indexed: false },
      { name: "totalPaid", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

/**
 * Dual-stream StakingRewards ABI (USDC + BRRR)
 * Keep this aligned with src/StakingRewards.sol (Option B, per-token distributors).
 */
export const stakingAbi = [
  // write
  { type: "function", name: "stake", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "rollEpochIfReady", stateMutability: "nonpayable", inputs: [], outputs: [] },

  // views (stake balances)
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },

  // views (earned)
  { type: "function", name: "earnedUSDC", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "earnedBRRR", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },

  // epoch helpers
  { type: "function", name: "epochEndsAtUSDC", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "epochEndsAtBRRR", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "getRewardForCurrentEpochUSDC", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "getRewardForCurrentEpochBRRR", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },

  // queued/pending
  { type: "function", name: "queuedRewardsUSDC", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "pendingNextEpochRewardsUSDC", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "queuedRewardsBRRR", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "pendingNextEpochRewardsBRRR", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },

  // distributors (useful for sanity checks)
  { type: "function", name: "rewardsDistributorUSDC", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "rewardsDistributorBRRR", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const;

/**
 * RpsManager ABI (the one you deployed on Base Sepolia)
 * Matches forge inspect output: play(uint256,uint8) returns (uint256) and settle(uint256)
 * plus GameStarted / GameResolved events.
 */
export const rpsManagerAbi = [
  // constants/views
  { type: "function", name: "brrr", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "staking", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "MIN_BET", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "MAX_BET", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "FEE_BPS", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "gameCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },

  // games(uint256) view returns (...)
  {
    type: "function",
    name: "games",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "player", type: "address" },
      { name: "bet", type: "uint256" },
      { name: "playerMove", type: "uint8" },
      { name: "houseMove", type: "uint8" },
      { name: "requestId", type: "uint256" },
      { name: "outcome", type: "uint8" },
      { name: "createdAt", type: "uint40" },
      { name: "resolvedAt", type: "uint40" },
      { name: "settled", type: "bool" },
    ],
  },

  // actions
  {
    type: "function",
    name: "play",
    stateMutability: "nonpayable",
    inputs: [
      { name: "betAmount", type: "uint256" },
      { name: "playerMover", type: "uint8" },
    ],
    outputs: [{ name: "gameId", type: "uint256" }],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "gameId", type: "uint256" }],
    outputs: [],
  },

  // events (names must match exactly)
  {
    type: "event",
    name: "GameStarted",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "bet", type: "uint256", indexed: false },
      { name: "playerMove", type: "uint8", indexed: false },
      { name: "requestId", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "GameResolved",
    inputs: [
      { name: "gameId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "playerMove", type: "uint8", indexed: false },
      { name: "houseMove", type: "uint8", indexed: false },
      { name: "outcome", type: "uint8", indexed: false },
      { name: "bet", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
      { name: "payoutToPlayer", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const vrfAdapterAbi = [
  {
    type: "function",
    name: "getRandom",
    stateMutability: "view",
    inputs: [{ name: "requestId", type: "uint256" }],
    outputs: [
      { name: "ok", type: "bool" },
      { name: "word", type: "uint256" },
    ],
  },
] as const;

