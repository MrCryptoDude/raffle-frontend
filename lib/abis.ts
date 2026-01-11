export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

export const raffleManagerAbi = [
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "rType", type: "uint8" }, { name: "tickets", type: "uint256" }], outputs: [] },
  {
    type: "function",
    name: "getRoundInfo",
    stateMutability: "view",
    inputs: [{ name: "rType", type: "uint8" }],
    outputs: [
      { name: "roundId", type: "uint256" },
      { name: "targetPot", type: "uint256" },
      { name: "deposited", type: "uint256" },
      { name: "totalTickets", type: "uint32" },
      { name: "drawing", type: "bool" },
      { name: "requestId", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "getLastResult",
    stateMutability: "view",
    inputs: [{ name: "rType", type: "uint8" }],
    outputs: [
      { name: "roundId", type: "uint256" },
      { name: "w1", type: "address" },
      { name: "w2", type: "address" },
      { name: "w3", type: "address" },
      { name: "p1", type: "uint256" },
      { name: "p2", type: "uint256" },
      { name: "p3", type: "uint256" },
      { name: "stakersCut", type: "uint256" },
      { name: "timestamp", type: "uint256" },
    ],
  },
  // Round history (newest-first)
  {
    type: "function",
    name: "getHistory",
    stateMutability: "view",
    inputs: [{ name: "rType", type: "uint8" }, { name: "offset", type: "uint256" }, { name: "limit", type: "uint256" }],
    outputs: [
      {
        name: "out",
        type: "tuple[]",
        components: [
          { name: "roundId", type: "uint256" },
          { name: "w1", type: "address" },
          { name: "w2", type: "address" },
          { name: "w3", type: "address" },
          { name: "p1", type: "uint256" },
          { name: "p2", type: "uint256" },
          { name: "p3", type: "uint256" },
          { name: "stakersCut", type: "uint256" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "Finalized",
    inputs: [
      { name: "rType", type: "uint8", indexed: true },
      { name: "roundId", type: "uint256", indexed: true },
      { name: "w1", type: "address", indexed: false },
      { name: "w2", type: "address", indexed: false },
      { name: "w3", type: "address", indexed: false },
      { name: "p1", type: "uint256", indexed: false },
      { name: "p2", type: "uint256", indexed: false },
      { name: "p3", type: "uint256", indexed: false },
      { name: "stakersCut", type: "uint256", indexed: false },
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

  // keeper-style, not shown in UI
  { type: "function", name: "rollEpochIfReady", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;
