import { applyMove, rollSpecificDie } from "./moves";
import { createInitialState, getScores } from "./state";
import { quickAnalysis } from "./training";
import type {
  ColumnIndex,
  DifficultyLevel,
  DieValue,
  GameMode,
  GameState,
  MoveAnalysis,
  Player,
} from "./types";

export interface PostGameCoachMoment {
  id: string;
  turnNumber: number;
  dieValue: DieValue;
  chosenColumn: ColumnIndex;
  recommendedColumn: ColumnIndex;
  chosenMove: MoveAnalysis;
  recommendedMove: MoveAnalysis;
  analysis: MoveAnalysis[];
  stateBeforeMove: GameState;
  winProbabilityDelta: number;
  scoreSwingDelta: number;
  immediateScoreDelta: number;
  missedDiceRemoved: number;
  lesson: string;
}

export interface PostGameCoachBrief {
  finalScore: {
    player1: number;
    player2: number;
  };
  difficulty: DifficultyLevel;
  trainingMode: boolean;
  turnCount: number;
  winner: Player | "draw";
  moments: PostGameCoachMoment[];
  summary: string;
}

interface BuildPostGameCoachBriefOptions {
  mode: GameMode;
  difficulty: DifficultyLevel;
  trainingMode: boolean;
  simulations?: number;
}

interface CandidateMoment extends PostGameCoachMoment {
  impactScore: number;
}

const MIN_WIN_PROBABILITY_DELTA = 0.08;
const MIN_SCORE_SWING_DELTA = 4;
const DEFAULT_SIMULATIONS = 80;

function formatColumn(column: ColumnIndex): string {
  return `Column ${column + 1}`;
}

function createLesson(moment: {
  chosenColumn: ColumnIndex;
  recommendedColumn: ColumnIndex;
  recommendedMove: MoveAnalysis;
  winProbabilityDelta: number;
  scoreSwingDelta: number;
  missedDiceRemoved: number;
}): string {
  const recommended = formatColumn(moment.recommendedColumn);
  const chosen = formatColumn(moment.chosenColumn);
  const winDelta = Math.round(moment.winProbabilityDelta * 100);

  if (moment.missedDiceRemoved > 0) {
    return `${recommended} would have removed ${moment.recommendedMove.opponentDiceRemoved} AI dice and improved the position over ${chosen}.`;
  }

  if (moment.scoreSwingDelta >= MIN_SCORE_SWING_DELTA) {
    return `${recommended} projected a ${moment.scoreSwingDelta.toFixed(1)} point score swing over ${chosen}.`;
  }

  return `${recommended} had the strongest win projection, about ${winDelta} points better than ${chosen}.`;
}

function isMeaningfulMoment(moment: {
  winProbabilityDelta: number;
  scoreSwingDelta: number;
  immediateScoreDelta: number;
  missedDiceRemoved: number;
}): boolean {
  return (
    moment.winProbabilityDelta >= MIN_WIN_PROBABILITY_DELTA ||
    moment.scoreSwingDelta >= MIN_SCORE_SWING_DELTA ||
    moment.immediateScoreDelta >= MIN_SCORE_SWING_DELTA ||
    moment.missedDiceRemoved > 0
  );
}

function buildCandidateMoment(
  stateBeforeMove: GameState,
  chosenColumn: ColumnIndex,
  analysis: MoveAnalysis[]
): CandidateMoment | null {
  const recommendedMove = analysis[0];
  const chosenMove = analysis.find((move) => move.column === chosenColumn);

  if (!recommendedMove || !chosenMove || recommendedMove.column === chosenColumn) {
    return null;
  }

  const winProbabilityDelta = Math.max(
    0,
    recommendedMove.winProbability - chosenMove.winProbability
  );
  const scoreSwingDelta = Math.max(0, recommendedMove.expectedScore - chosenMove.expectedScore);
  const immediateScoreDelta = Math.max(
    0,
    recommendedMove.immediateScoreGain - chosenMove.immediateScoreGain
  );
  const missedDiceRemoved = Math.max(
    0,
    recommendedMove.opponentDiceRemoved - chosenMove.opponentDiceRemoved
  );

  if (
    !isMeaningfulMoment({
      immediateScoreDelta,
      missedDiceRemoved,
      scoreSwingDelta,
      winProbabilityDelta,
    })
  ) {
    return null;
  }

  const impactScore =
    winProbabilityDelta * 100 +
    scoreSwingDelta +
    immediateScoreDelta * 0.5 +
    missedDiceRemoved * 12;

  const moment = {
    analysis,
    chosenColumn,
    chosenMove,
    dieValue: stateBeforeMove.currentDie as DieValue,
    id: `turn-${stateBeforeMove.turnNumber}`,
    immediateScoreDelta,
    missedDiceRemoved,
    recommendedColumn: recommendedMove.column,
    recommendedMove,
    scoreSwingDelta,
    stateBeforeMove,
    turnNumber: stateBeforeMove.turnNumber,
    winProbabilityDelta,
  };

  return {
    ...moment,
    impactScore,
    lesson: createLesson(moment),
  };
}

export function buildPostGameCoachBrief(
  finalState: GameState,
  options: BuildPostGameCoachBriefOptions
): PostGameCoachBrief | null {
  if (options.mode !== "ai" || finalState.phase !== "ended" || finalState.winner === null) {
    return null;
  }

  try {
    let replayState = createInitialState();
    const candidates: CandidateMoment[] = [];

    for (let moveIndex = 0; moveIndex < finalState.moveHistory.length; moveIndex++) {
      const move = finalState.moveHistory[moveIndex];
      if (!move || replayState.phase !== "rolling") {
        break;
      }

      const stateBeforeMove = rollSpecificDie(replayState, move.dieValue);
      if (stateBeforeMove.phase !== "placing") {
        break;
      }

      if (stateBeforeMove.currentPlayer === "player1") {
        const result = quickAnalysis(stateBeforeMove, options.simulations ?? DEFAULT_SIMULATIONS);
        const candidate = buildCandidateMoment(stateBeforeMove, move.column, result.moves);
        if (candidate) {
          candidates.push(candidate);
        }
      }

      const applied = applyMove(stateBeforeMove, move.column);
      if (!applied) {
        break;
      }
      replayState = applied.newState;
    }

    candidates.sort((a, b) => b.impactScore - a.impactScore);
    const primaryMoment = candidates[0];
    if (!primaryMoment) {
      return null;
    }

    const { impactScore: _impactScore, ...moment } = primaryMoment;

    return {
      difficulty: options.difficulty,
      finalScore: getScores(finalState),
      moments: [moment],
      summary: moment.lesson,
      trainingMode: options.trainingMode,
      turnCount: finalState.turnNumber,
      winner: finalState.winner,
    };
  } catch {
    return null;
  }
}
