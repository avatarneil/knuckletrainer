import { applyMove } from "@/engine/moves";
import { calculateGridScore } from "@/engine/scorer";
import { quickAnalysis } from "@/engine/training";
import type { ColumnIndex, GameState, MoveAnalysis } from "@/engine/types";
import { getOpponent } from "@/engine/types";

export interface SpectatorMoveInsight extends MoveAnalysis {
  explanation: string;
  isBest: boolean;
}

export interface SpectatorCoachAnalysis {
  bestMove: ColumnIndex | null;
  moves: SpectatorMoveInsight[];
  simulationsPerMove: number;
}

export interface SpectatorMoveExplanation {
  title: string;
  detail: string;
}

interface PlayerNames {
  player1: string;
  player2: string;
}

export function getSpectatorAnalysisKey(state: GameState): string {
  return JSON.stringify({
    currentDie: state.currentDie,
    currentPlayer: state.currentPlayer,
    grids: state.grids,
    phase: state.phase,
    turnNumber: state.turnNumber,
  });
}

export function buildSpectatorCoachAnalysis(
  state: GameState,
  simulations = 160
): SpectatorCoachAnalysis {
  const analysis = quickAnalysis(state, simulations);

  return {
    bestMove: analysis.bestMove,
    moves: analysis.moves.map((move) => ({
      ...move,
      explanation: explainCandidateMove(state, move),
      isBest: move.column === analysis.bestMove,
    })),
    simulationsPerMove: analysis.simulationsPerMove,
  };
}

function explainCandidateMove(state: GameState, move: MoveAnalysis): string {
  if (state.currentDie === null) {
    return "No die is ready to place.";
  }

  const player = state.currentPlayer;
  const opponent = getOpponent(player);
  const grid = state.grids[player];
  const dieValue = state.currentDie;
  const result = applyMove(state, move.column);
  const opponentScoreLoss = result
    ? calculateGridScore(state.grids[opponent]).total -
      calculateGridScore(result.newState.grids[opponent]).total
    : 0;
  const matchingDice = grid[move.column].filter((die) => die === dieValue).length;

  if (move.opponentDiceRemoved > 0) {
    return `Removes ${formatDiceCount(move.opponentDiceRemoved)} and drops the other grid by ${opponentScoreLoss}.`;
  }

  if (matchingDice > 0) {
    return `Stacks with ${matchingDice} matching ${matchingDice === 1 ? "die" : "dice"} for a ${move.immediateScoreGain}-point column gain.`;
  }

  if (opponentScoreLoss > 0) {
    return `Defends this column by reducing the opposing score by ${opponentScoreLoss}.`;
  }

  if (move.immediateScoreGain >= 6) {
    return `Builds immediate value with a ${move.immediateScoreGain}-point score gain.`;
  }

  return `Keeps the board flexible with a ${move.immediateScoreGain}-point gain.`;
}

function formatDiceCount(count: number): string {
  return `${count} opposing ${count === 1 ? "die" : "dice"}`;
}

export function explainLatestSpectatorMove(
  previousState: GameState,
  currentState: GameState,
  playerNames: PlayerNames
): SpectatorMoveExplanation | null {
  const latestMove = currentState.moveHistory.at(-1);
  if (!latestMove || currentState.moveHistory.length <= previousState.moveHistory.length) {
    return null;
  }

  if (previousState.phase !== "placing" || previousState.currentDie !== latestMove.dieValue) {
    return null;
  }

  const mover = previousState.currentPlayer;
  const opponent = getOpponent(mover);
  const result = applyMove(previousState, latestMove.column);
  if (!result) {
    return null;
  }

  const beforeMoverScore = calculateGridScore(previousState.grids[mover]).total;
  const afterMoverScore = calculateGridScore(result.newState.grids[mover]).total;
  const beforeOpponentScore = calculateGridScore(previousState.grids[opponent]).total;
  const afterOpponentScore = calculateGridScore(result.newState.grids[opponent]).total;
  const ownGain = afterMoverScore - beforeMoverScore;
  const opponentLoss = beforeOpponentScore - afterOpponentScore;
  const scoreSwing = ownGain + opponentLoss;
  const removedCount = result.removedDice?.count ?? 0;
  const playerName = playerNames[mover];
  const columnLabel = `column ${latestMove.column + 1}`;

  if (removedCount > 0) {
    return {
      detail: `${playerName} placed a ${latestMove.dieValue} in ${columnLabel}, removed ${formatDiceCount(removedCount)}, and swung the score by ${scoreSwing}.`,
      title: "Removal swing",
    };
  }

  const matchingDiceBefore = previousState.grids[mover][latestMove.column].filter(
    (die) => die === latestMove.dieValue
  ).length;

  if (matchingDiceBefore > 0) {
    return {
      detail: `${playerName} stacked a ${latestMove.dieValue} in ${columnLabel}, turning the placement into a ${ownGain}-point gain.`,
      title: "Stack value",
    };
  }

  if (opponentLoss > 0) {
    return {
      detail: `${playerName} used ${columnLabel} to reduce the opposing grid by ${opponentLoss} points.`,
      title: "Defensive block",
    };
  }

  return {
    detail: `${playerName} took ${ownGain} points in ${columnLabel}; the score swing was ${scoreSwing}.`,
    title: "Score swing",
  };
}
