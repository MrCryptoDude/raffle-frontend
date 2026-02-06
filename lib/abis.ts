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

/**
 * Admin functions for governance proposals
 * These are the ONLY functions that should be callable via governance
 */
export const adminAbi = [
  // Pause/Unpause (if contracts have Pausable)
  { type: "function", name: "pause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "unpause", stateMutability: "nonpayable", inputs: [], outputs: [] },
  
  // Fee management
  { type: "function", name: "setFeeBps", stateMutability: "nonpayable", inputs: [{ name: "newFeeBps", type: "uint256" }], outputs: [] },
  { type: "function", name: "setStakingFee", stateMutability: "nonpayable", inputs: [{ name: "newFeeBps", type: "uint256" }], outputs: [] },
  
  // Distributor management
  { type: "function", name: "setRewardsDistributorUSDC", stateMutability: "nonpayable", inputs: [{ name: "distributor", type: "address" }], outputs: [] },
  { type: "function", name: "setRewardsDistributorBRRR", stateMutability: "nonpayable", inputs: [{ name: "distributor", type: "address" }], outputs: [] },
  { type: "function", name: "addUsdcDistributor", stateMutability: "nonpayable", inputs: [{ name: "distributor", type: "address" }], outputs: [] },
  { type: "function", name: "removeUsdcDistributor", stateMutability: "nonpayable", inputs: [{ name: "distributor", type: "address" }], outputs: [] },
  
  // Game settings
  { type: "function", name: "setMinBet", stateMutability: "nonpayable", inputs: [{ name: "newMin", type: "uint256" }], outputs: [] },
  { type: "function", name: "setMaxBet", stateMutability: "nonpayable", inputs: [{ name: "newMax", type: "uint256" }], outputs: [] },
  { type: "function", name: "setBettingWindow", stateMutability: "nonpayable", inputs: [{ name: "blocks", type: "uint256" }], outputs: [] },
  
  // Emergency functions
  { type: "function", name: "emergencyWithdraw", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "rescueTokens", stateMutability: "nonpayable", inputs: [{ name: "token", type: "address" }, { name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  
  // VRF/Oracle updates
  { type: "function", name: "setVrfAdapter", stateMutability: "nonpayable", inputs: [{ name: "adapter", type: "address" }], outputs: [] },
  { type: "function", name: "setAutomationForwarder", stateMutability: "nonpayable", inputs: [{ name: "forwarder", type: "address" }], outputs: [] },
  
  // Ownership
  { type: "function", name: "transferOwnership", stateMutability: "nonpayable", inputs: [{ name: "newOwner", type: "address" }], outputs: [] },
  { type: "function", name: "acceptOwnership", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export const governorAbi = [
  {
    type: "event",
    name: "ProposalCreated",
    inputs: [
      { indexed: true, name: "proposalId", type: "uint256" },
      { indexed: true, name: "proposer", type: "address" },
      { indexed: false, name: "targets", type: "address[]" },
      { indexed: false, name: "values", type: "uint256[]" },
      { indexed: false, name: "signatures", type: "string[]" },
      { indexed: false, name: "calldatas", type: "bytes[]" },
      { indexed: false, name: "voteStart", type: "uint256" },
      { indexed: false, name: "voteEnd", type: "uint256" },
      { indexed: false, name: "description", type: "string" },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "state",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "proposalVotes",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [
      { name: "againstVotes", type: "uint256" },
      { name: "forVotes", type: "uint256" },
      { name: "abstainVotes", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "proposalSnapshot",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "proposalDeadline",
    stateMutability: "view",
    inputs: [{ name: "proposalId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "quorum",
    stateMutability: "view",
    inputs: [{ name: "timepoint", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "hashProposal",
    stateMutability: "pure",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "descriptionHash", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "propose",
    stateMutability: "nonpayable",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "proposalId", type: "uint256" }],
  },
  {
    type: "function",
    name: "castVote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proposalId", type: "uint256" },
      { name: "support", type: "uint8" },
    ],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "execute",
    stateMutability: "payable",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "descriptionHash", type: "bytes32" },
    ],
    outputs: [{ name: "proposalId", type: "uint256" }],
  },
  {
    type: "function",
    name: "queue",
    stateMutability: "nonpayable",
    inputs: [
      { name: "targets", type: "address[]" },
      { name: "values", type: "uint256[]" },
      { name: "calldatas", type: "bytes[]" },
      { name: "descriptionHash", type: "bytes32" },
    ],
    outputs: [{ name: "proposalId", type: "uint256" }],
  },
] as const;




