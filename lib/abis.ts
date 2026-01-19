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
  // Reveal (participant-only settlement trigger)
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
  // Events (must match contract exactly)
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

export const stakingAbi = [
  { type: "function", name: "stake", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },

  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "earned", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },

  { type: "function", name: "queuedRewards", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "pendingNextEpochRewards", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "getRewardForCurrentEpoch", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "epochEndsAt", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },

  { type: "function", name: "totalCumulativeRewardsNotified", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "totalCumulativeRewardsPaid", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },

  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "periodFinish", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "rewardRate", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },

  { type: "function", name: "rollEpochIfReady", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

// rpsAbi unchanged (keep yours)
export const rpsAbi = [
  {
    type: "function",
    name: "commit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "betIndex", type: "uint8" },
      { name: "commitment", type: "bytes32" },
    ],
    outputs: [
      { name: "matchId", type: "uint256" },
      { name: "matchedNow", type: "bool" },
    ],
  },
  { type: "function", name: "cancel", stateMutability: "nonpayable", inputs: [{ name: "matchId", type: "uint256" }], outputs: [] },
  {
    type: "function",
    name: "reveal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "uint256" },
      { name: "choice", type: "uint8" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [],
  },
  { type: "function", name: "claimTimeout", stateMutability: "nonpayable", inputs: [{ name: "matchId", type: "uint256" }], outputs: [] },
  {
    type: "function",
    name: "getMatch",
    stateMutability: "view",
    inputs: [{ name: "matchId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "betIndex", type: "uint8" },
          { name: "betAmount", type: "uint256" },
          { name: "p1", type: "address" },
          { name: "p2", type: "address" },
          { name: "c1", type: "bytes32" },
          { name: "c2", type: "bytes32" },
          { name: "r1", type: "uint8" },
          { name: "r2", type: "uint8" },
          { name: "revealed1", type: "bool" },
          { name: "revealed2", type: "bool" },
          { name: "createdAt", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  { type: "function", name: "BETS", stateMutability: "view", inputs: [{ name: "", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "waitingMatch", stateMutability: "view", inputs: [{ name: "betIndex", type: "uint8" }], outputs: [{ name: "", type: "uint256" }] },

  {
    type: "event",
    name: "Committed",
    inputs: [
      { name: "matchId", type: "uint256", indexed: true },
      { name: "betIndex", type: "uint8", indexed: true },
      { name: "player", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Matched",
    inputs: [
      { name: "matchId", type: "uint256", indexed: true },
      { name: "betIndex", type: "uint8", indexed: true },
      { name: "p1", type: "address", indexed: false },
      { name: "p2", type: "address", indexed: false },
      { name: "betAmount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Finalized",
    inputs: [
      { name: "matchId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: false },
      { name: "tie", type: "bool", indexed: false },
      { name: "payoutWinner", type: "uint256", indexed: false },
      { name: "payoutLoser", type: "uint256", indexed: false },
      { name: "feeToStakers", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TimeoutClaimed",
    inputs: [
      { name: "matchId", type: "uint256", indexed: true },
      { name: "winner", type: "address", indexed: false },
      { name: "payoutWinner", type: "uint256", indexed: false },
      { name: "feeToStakers", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
