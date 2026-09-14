import { parseAbi, keccak256, encodeAbiParameters, formatUnits, type Address, type Hex } from "viem";

import type { RpsChain } from "./rpsChains";

/** The player-versus-player game. Unset until it is deployed. */
export const RPS_PVP_ADDRESS = (process.env.NEXT_PUBLIC_RPS_PVP || "") as Address | "";

/** Enums travel as uint8. Move.None is 0 so an unset move never looks real. */
export const rpsPvpAbi = parseAbi([
  "struct Game { address creator; uint40 createdAt; uint40 openUntil; uint8 status; uint8 result; address challenger; uint40 joinedAt; uint40 revealBy; uint8 creatorMove; uint8 challengerMove; uint256 stake; bytes32 commitment; }",
  "struct OpenGame { uint256 id; address creator; uint256 stake; uint64 createdAt; uint64 openUntil; }",
  "function token() view returns (address)",
  "function FEE_BPS() view returns (uint16)",
  "function revealWindow() view returns (uint32)",
  "function joinWindow() view returns (uint32)",
  "function tierCounts() view returns (uint256[] tiers, uint256[] counts)",
  "function lobby(uint256 stake) view returns (OpenGame[] rows)",
  "function recentGamesOf(address player, uint256 limit) view returns (uint256[] ids, Game[] list)",
  "function getGame(uint256 id) view returns (Game)",
  "function createGame(uint256 stake, bytes32 commitment) returns (uint256 id)",
  "function join(uint256 id, uint8 move)",
  "function reveal(uint256 id, uint8 move, bytes32 salt)",
  "function claimUnrevealed(uint256 id)",
  "function cancel(uint256 id)",
  "event GameCreated(uint256 indexed id, address indexed creator, uint256 stake, bytes32 commitment, uint64 openUntil)",
  "error NotAStakeTier(uint256 stake)",
  "error CommitmentReused()",
  "error TransferShortfall(uint256 expected)",
  "error NotOpen(uint256 id)",
  "error NotJoined(uint256 id)",
  "error NotCreator(uint256 id, address caller)",
  "error GameLapsed(uint256 id, uint64 openUntil)",
  "error CannotPlayYourself()",
  "error InvalidMove(uint8 move)",
  "error BadReveal()",
  "error RevealStillOpen(uint64 until)",
  "error RevealWindowClosed(uint64 until)",
]);

export type Move = 1 | 2 | 3;
export const MOVES: Move[] = [1, 2, 3];
export const MOVE_LABEL: Record<number, string> = { 1: "ROCK", 2: "PAPER", 3: "SCISSORS" };
export const MOVE_EMOJI: Record<number, string> = { 1: "🪨", 2: "📄", 3: "✂️" };

export const Status = { Open: 0, Joined: 1, Settled: 2, Cancelled: 3 } as const;
export const Result = { Pending: 0, CreatorWin: 1, ChallengerWin: 2, Draw: 3 } as const;

export type Game = {
  creator: Address;
  createdAt: number;
  openUntil: number;
  status: number;
  result: number;
  challenger: Address;
  joinedAt: number;
  revealBy: number;
  creatorMove: number;
  challengerMove: number;
  stake: bigint;
  commitment: Hex;
};

/**
 * A game on any chain, in one shape the interface can render. Accounts are
 * strings because Solana keys are not EVM addresses.
 */
export type AnyGame = {
  chain: RpsChain;
  id: bigint;
  creator: string;
  /** Null until someone joins. */
  challenger: string | null;
  stake: bigint;
  status: number;
  result: number;
  createdAt: number;
  openUntil: number;
  joinedAt: number;
  revealBy: number;
  creatorMove: number;
  challengerMove: number;
  commitment: Hex;
};

/** A game waiting in the lobby, on whichever chain it lives. */
export type OpenRow = { chain: RpsChain; id: bigint; creator: string; stake: bigint; createdAt: number; openUntil: number };

/** Unique across chains: the same id can exist on two of them. */
export const gameKey = (g: { chain: RpsChain; id: bigint }) => `${g.chain.key}:${g.id}`;

/** EVM addresses compare without case; Solana keys are case sensitive. */
export function sameAccount(a: string | null | undefined, b: string | null | undefined, chain: RpsChain) {
  if (!a || !b) return false;
  return chain.kind === "evm" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** Matches `keccak256(abi.encode(move, salt, player))` in the contract. */
export function commitmentFor(move: Move, salt: Hex, player: Address): Hex {
  return keccak256(
    encodeAbiParameters([{ type: "uint8" }, { type: "bytes32" }, { type: "address" }], [move, salt, player])
  );
}

export function newSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}

/**
 * The creator's move and salt, kept in this browser until the game settles.
 *
 * Keyed by commitment rather than game id, because it has to be written before
 * the transaction is sent - if the tab dies between sending and the receipt,
 * the id was never learned but the secret must still be there. Losing it means
 * the game cannot be revealed and forfeits at the deadline.
 */
type Secret = { move: Move; salt: Hex };

function secretKey(chain: string, contract: string, commitment: Hex) {
  return `brrr:rpspvp:${chain}:${contract.toLowerCase()}:${commitment.toLowerCase()}`;
}

export function saveSecret(chain: string, contract: string, commitment: Hex, secret: Secret) {
  try {
    localStorage.setItem(secretKey(chain, contract, commitment), JSON.stringify(secret));
  } catch {}
}

export function loadSecret(chain: string, contract: string, commitment: Hex): Secret | null {
  try {
    const raw = localStorage.getItem(secretKey(chain, contract, commitment));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Secret;
    return MOVES.includes(parsed.move) && /^0x[0-9a-fA-F]{64}$/.test(parsed.salt) ? parsed : null;
  } catch {
    return null;
  }
}

export function forgetSecret(chain: string, contract: string, commitment: Hex) {
  try {
    localStorage.removeItem(secretKey(chain, contract, commitment));
  } catch {}
}

/** "$25", or "$2.5" for anything not a whole dollar. */
export function dollars(amount: bigint, decimals: number): string {
  const s = formatUnits(amount, decimals);
  return `$${s.endsWith(".0") ? s.slice(0, -2) : s}`;
}

export function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** "4:07", or "12s" under a minute. */
export function countdown(secondsLeft: number): string {
  const s = Math.max(0, Math.floor(secondsLeft));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** What a finished or running game means for the player looking at it. */
export function outcomeFor(
  g: { status: number; result: number; creator: string },
  me?: string
): "WIN" | "LOSS" | "DRAW" | null {
  if (g.status !== Status.Settled || !me) return null;
  if (g.result === Result.Draw) return "DRAW";
  const iAmCreator = g.creator.toLowerCase() === me.toLowerCase();
  const creatorWon = g.result === Result.CreatorWin;
  return iAmCreator === creatorWon ? "WIN" : "LOSS";
}

const FRIENDLY: Record<string, string> = {
  NotAStakeTier: "That amount is not one of the tables.",
  TransferShortfall: "The token arrived short, so the game refused it.",
  CommitmentReused: "That move secret was already used. Try again.",
  NotOpen: "Someone else took that game first.",
  GameLapsed: "That game stopped taking players.",
  CannotPlayYourself: "You cannot join your own game.",
  BadReveal: "The saved move does not match this game.",
  RevealWindowClosed: "Too late - the reveal window closed.",
  RevealStillOpen: "The creator still has time to reveal.",
  NotCreator: "Only the creator can do that yet.",
};

export function friendlyError(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; cause?: { data?: { errorName?: string } } };
  const name = err?.cause?.data?.errorName;
  if (name && FRIENDLY[name]) return FRIENDLY[name];
  const text = err?.shortMessage || err?.message || "Transaction failed";
  if (/user rejected|denied/i.test(text)) return "Cancelled in wallet.";
  for (const [key, msg] of Object.entries(FRIENDLY)) if (text.includes(key)) return msg;
  return text.split("\n")[0];
}
