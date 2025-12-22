/**
 * AI Web Worker
 *
 * Offloads AI computation to a separate thread to avoid blocking the main UI thread.
 * This is especially important for iOS devices where long-running scripts can cause
 * the browser to become unresponsive.
 *
 * This worker implements:
 * - Expectimax search for move selection
 * - Monte Carlo simulation for win probability
 * - Adaptive performance based on message parameters
 */

// Game state types (simplified for worker)
const ALL_COLUMNS = [0, 1, 2];
const ALL_DIE_VALUES = [1, 2, 3, 4, 5, 6];

// Performance configuration (can be overridden per-request)
let maxNodes = 300000;
let currentNodesExplored = 0;

/**
 * Check if a column is full
 */
function isColumnFull(column) {
  return column.every((d) => d !== null);
}

/**
 * Get empty slots in a column
 */
function getEmptySlots(column) {
  return column.filter((d) => d === null).length;
}

/**
 * Check if a grid is full
 */
function isGridFull(grid) {
  return grid.every(isColumnFull);
}

/**
 * Calculate column score with multipliers for matching dice
 */
function calculateColumnScore(column) {
  const counts = new Map();

  for (const die of column) {
    if (die !== null) {
      counts.set(die, (counts.get(die) || 0) + 1);
    }
  }

  let total = 0;
  for (const [value, count] of counts) {
    // Matching dice multiply: value × count × count
    total += value * count * count;
  }

  return total;
}

/**
 * Calculate grid score
 */
function calculateGridScore(grid) {
  return grid.reduce((sum, col) => sum + calculateColumnScore(col), 0);
}

/**
 * Get opponent player
 */
function getOpponent(player) {
  return player === "player1" ? "player2" : "player1";
}

/**
 * Deep clone a game state
 */
function cloneState(state) {
  return {
    grids: {
      player1: state.grids.player1.map((col) => [...col]),
      player2: state.grids.player2.map((col) => [...col]),
    },
    currentPlayer: state.currentPlayer,
    currentDie: state.currentDie,
    phase: state.phase,
    winner: state.winner,
    turnNumber: state.turnNumber,
    moveHistory: [...state.moveHistory],
  };
}

/**
 * Apply a move to a state (returns new state)
 */
function applyMove(state, column) {
  if (state.phase !== "placing" || state.currentDie === null) {
    return null;
  }

  const grid = state.grids[state.currentPlayer];
  if (isColumnFull(grid[column])) {
    return null;
  }

  const dieValue = state.currentDie;
  const currentPlayer = state.currentPlayer;
  const opponent = getOpponent(currentPlayer);

  // Clone grids
  const newGrids = {
    player1: state.grids.player1.map((col) => [...col]),
    player2: state.grids.player2.map((col) => [...col]),
  };

  // Place die in column
  const emptyIndex = newGrids[currentPlayer][column].indexOf(null);
  if (emptyIndex !== -1) {
    newGrids[currentPlayer][column][emptyIndex] = dieValue;
  }

  // Remove matching dice from opponent
  newGrids[opponent][column] = newGrids[opponent][column].map((d) =>
    d === dieValue ? null : d,
  );
  // Compact column
  const nonNullDice = newGrids[opponent][column].filter((d) => d !== null);
  newGrids[opponent][column] = [
    nonNullDice[0] ?? null,
    nonNullDice[1] ?? null,
    nonNullDice[2] ?? null,
  ];

  // Check for game end
  const gameEnded = isGridFull(newGrids[currentPlayer]);

  let winner = null;
  if (gameEnded) {
    const score1 = calculateGridScore(newGrids.player1);
    const score2 = calculateGridScore(newGrids.player2);
    if (score1 > score2) winner = "player1";
    else if (score2 > score1) winner = "player2";
    else winner = "draw";
  }

  return {
    newState: {
      grids: newGrids,
      currentPlayer: gameEnded ? currentPlayer : opponent,
      currentDie: null,
      phase: gameEnded ? "ended" : "rolling",
      winner,
      turnNumber: state.turnNumber + 1,
      moveHistory: [...state.moveHistory, { column, dieValue }],
    },
  };
}

/**
 * Roll a specific die value
 */
function rollSpecificDie(state, value) {
  return {
    ...state,
    currentDie: value,
    phase: "placing",
  };
}

/**
 * Calculate score gain from a move
 */
function calculateMoveScoreGain(grid, column, dieValue) {
  const currentScore = calculateColumnScore(grid[column]);
  const newColumn = [...grid[column]];
  const emptyIndex = newColumn.indexOf(null);

  if (emptyIndex === -1) return 0;

  newColumn[emptyIndex] = dieValue;
  return calculateColumnScore(newColumn) - currentScore;
}

/**
 * Calculate opponent score loss from placing a die
 */
function calculateOpponentScoreLoss(opponentGrid, column, dieValue) {
  const currentScore = calculateColumnScore(opponentGrid[column]);
  const newColumn = opponentGrid[column].map((d) =>
    d === dieValue ? null : d,
  );
  return currentScore - calculateColumnScore(newColumn);
}

/**
 * Quick move evaluation for move ordering
 */
function evaluateMoveQuick(state, column, dieValue, player) {
  const opponent = getOpponent(player);
  const scoreGain = calculateMoveScoreGain(
    state.grids[player],
    column,
    dieValue,
  );
  const opponentLoss = calculateOpponentScoreLoss(
    state.grids[opponent],
    column,
    dieValue,
  );
  return scoreGain + opponentLoss;
}

/**
 * Get game progress (0 = start, 1 = end)
 */
function getGameProgress(state) {
  const totalSlots = 18;
  const filledSlots =
    state.grids.player1.flat().filter((d) => d !== null).length +
    state.grids.player2.flat().filter((d) => d !== null).length;
  return filledSlots / totalSlots;
}

/**
 * Evaluate a position for a player
 */
function evaluate(state, player, config) {
  const opponent = getOpponent(player);
  const myGrid = state.grids[player];
  const oppGrid = state.grids[opponent];

  // Game end bonuses
  if (state.phase === "ended") {
    if (state.winner === player) return 10000;
    if (state.winner === opponent) return -10000;
    return 0; // Draw
  }

  const myScore = calculateGridScore(myGrid);
  const oppScore = calculateGridScore(oppGrid);

  if (!config.advancedEval) {
    return myScore - oppScore;
  }

  // Advanced evaluation with positional heuristics
  let positionalScore = 0;
  const gameProgress = getGameProgress(state);

  for (const col of ALL_COLUMNS) {
    const myColumn = myGrid[col];
    const oppColumn = oppGrid[col];
    const myEmpty = getEmptySlots(myColumn);

    // Count combo potential
    const myDice = myColumn.filter((d) => d !== null);
    if (myDice.length > 0) {
      const counts = new Map();
      for (const die of myDice) {
        counts.set(die, (counts.get(die) || 0) + 1);
      }

      for (const [value, count] of counts) {
        if (count === 2 && myEmpty >= 1) {
          positionalScore += value * 3 * (1 - gameProgress * 0.5);
        } else if (count === 1 && myEmpty >= 2) {
          positionalScore += value * 1.5 * (1 - gameProgress * 0.5);
        }
      }
    }

    // Attack potential
    if (!isColumnFull(oppColumn)) {
      for (const value of ALL_DIE_VALUES) {
        const potentialDamage = calculateOpponentScoreLoss(oppGrid, col, value);
        if (potentialDamage > 0) {
          positionalScore +=
            (potentialDamage / 6) *
            (1 - gameProgress * 0.3) *
            config.offenseWeight;
        }
      }
    }
  }

  return (myScore - oppScore) * config.offenseWeight + positionalScore;
}

/**
 * Order moves for better search
 */
function orderMoves(state, columns, player) {
  const currentDie = state.currentDie;
  if (currentDie === null) return columns;

  const scored = columns.map((col) => ({
    col,
    score: evaluateMoveQuick(state, col, currentDie, player),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.col);
}

/**
 * MAX node in expectimax
 */
function maxNode(state, depth, player, config) {
  currentNodesExplored++;

  if (
    currentNodesExplored > maxNodes ||
    state.phase === "ended" ||
    depth === 0
  ) {
    return evaluate(state, player, config);
  }

  if (state.phase === "rolling") {
    return chanceNode(state, depth, player, config);
  }

  const grid = state.grids[state.currentPlayer];
  const legalColumns = ALL_COLUMNS.filter((i) => !isColumnFull(grid[i]));

  if (legalColumns.length === 0) {
    return evaluate(state, player, config);
  }

  const orderedColumns = orderMoves(state, legalColumns, state.currentPlayer);
  let maxValue = -Infinity;

  for (const column of orderedColumns) {
    const result = applyMove(state, column);
    if (!result) continue;

    let value;
    if (result.newState.phase === "ended") {
      value = evaluate(result.newState, player, config);
    } else if (result.newState.currentPlayer === player) {
      value = chanceNode(result.newState, depth - 1, player, config);
    } else {
      value = minNode(result.newState, depth - 1, player, config);
    }

    maxValue = Math.max(maxValue, value);
  }

  return maxValue;
}

/**
 * MIN node in expectimax
 */
function minNode(state, depth, player, config) {
  currentNodesExplored++;

  if (
    currentNodesExplored > maxNodes ||
    state.phase === "ended" ||
    depth === 0
  ) {
    return evaluate(state, player, config);
  }

  if (state.phase === "rolling") {
    return chanceNode(state, depth, player, config);
  }

  const grid = state.grids[state.currentPlayer];
  const legalColumns = ALL_COLUMNS.filter((i) => !isColumnFull(grid[i]));

  if (legalColumns.length === 0) {
    return evaluate(state, player, config);
  }

  let minValue = Infinity;

  for (const column of legalColumns) {
    const result = applyMove(state, column);
    if (!result) continue;

    let value;
    if (result.newState.phase === "ended") {
      value = evaluate(result.newState, player, config);
    } else if (result.newState.currentPlayer === player) {
      value = chanceNode(result.newState, depth - 1, player, config);
    } else {
      value = chanceNode(result.newState, depth - 1, player, config);
    }

    minValue = Math.min(minValue, value);
  }

  return minValue;
}

/**
 * CHANCE node in expectimax (dice roll)
 */
function chanceNode(state, depth, player, config) {
  currentNodesExplored++;

  if (currentNodesExplored > maxNodes) {
    return evaluate(state, player, config);
  }

  if (state.phase !== "rolling") {
    if (state.currentPlayer === player) {
      return maxNode(state, depth, player, config);
    }
    return minNode(state, depth, player, config);
  }

  // Average over all dice values
  let totalValue = 0;

  for (const dieValue of ALL_DIE_VALUES) {
    const rolledState = rollSpecificDie(state, dieValue);

    let value;
    if (rolledState.currentPlayer === player) {
      value = maxNode(rolledState, depth, player, config);
    } else {
      value = minNode(rolledState, depth, player, config);
    }

    totalValue += value / 6;
  }

  return totalValue;
}

/**
 * Main expectimax search
 */
function expectimax(state, player, config) {
  currentNodesExplored = 0;

  if (state.phase !== "placing" || state.currentDie === null) {
    return { bestMove: null, value: 0, nodesExplored: 0 };
  }

  const grid = state.grids[state.currentPlayer];
  const legalColumns = ALL_COLUMNS.filter((i) => !isColumnFull(grid[i]));

  if (legalColumns.length === 0) {
    return { bestMove: null, value: 0, nodesExplored: 0 };
  }

  if (legalColumns.length === 1) {
    return { bestMove: legalColumns[0], value: 0, nodesExplored: 1 };
  }

  const orderedColumns = orderMoves(state, legalColumns, player);

  let bestMove = null;
  let bestValue = -Infinity;

  for (const column of orderedColumns) {
    const result = applyMove(state, column);
    if (!result) continue;

    let value;
    if (result.newState.phase === "ended") {
      value = evaluate(result.newState, player, config);
    } else {
      value = chanceNode(result.newState, config.depth - 1, player, config);
    }

    if (value > bestValue) {
      bestValue = value;
      bestMove = column;
    }
  }

  return {
    bestMove,
    value: bestValue,
    nodesExplored: currentNodesExplored,
  };
}

/**
 * Get best move using expectimax
 */
function getBestMove(state, config) {
  if (state.phase !== "placing" || state.currentDie === null) {
    return null;
  }

  const player = state.currentPlayer;
  const grid = state.grids[player];
  const legalColumns = ALL_COLUMNS.filter((i) => !isColumnFull(grid[i]));

  if (legalColumns.length === 0) return null;
  if (legalColumns.length === 1) return legalColumns[0];

  // Greedy strategy for depth 0
  if (config.depth === 0) {
    const scored = legalColumns.map((col) => ({
      col,
      score: evaluateMoveQuick(state, col, state.currentDie, player),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.col ?? legalColumns[0];
  }

  // Random move based on difficulty
  if (config.randomness > 0 && Math.random() < config.randomness) {
    return legalColumns[Math.floor(Math.random() * legalColumns.length)];
  }

  // Use expectimax
  const result = expectimax(state, player, config);
  return result.bestMove ?? legalColumns[0];
}

/**
 * Simulate a game for Monte Carlo
 */
function simulateGame(state, policy, heuristicRatio) {
  let currentState = cloneState(state);
  let moves = 50;

  while (currentState.phase !== "ended" && moves > 0) {
    moves--;

    if (currentState.phase === "rolling") {
      const dieValue = Math.floor(Math.random() * 6) + 1;
      currentState = rollSpecificDie(currentState, dieValue);
    }

    if (currentState.phase === "placing") {
      const grid = currentState.grids[currentState.currentPlayer];
      const legalColumns = ALL_COLUMNS.filter((i) => !isColumnFull(grid[i]));

      if (legalColumns.length === 0) break;

      let column;
      if (
        policy === "random" ||
        (policy === "mixed" && Math.random() >= heuristicRatio)
      ) {
        column = legalColumns[Math.floor(Math.random() * legalColumns.length)];
      } else {
        // Heuristic move
        if (currentState.currentDie === null) {
          column = legalColumns[0];
        } else {
          const scored = legalColumns.map((col) => ({
            col,
            score: evaluateMoveQuick(
              currentState,
              col,
              currentState.currentDie,
              currentState.currentPlayer,
            ),
          }));
          scored.sort((a, b) => b.score - a.score);
          column = scored[0].col;
        }
      }

      const result = applyMove(currentState, column);
      if (!result) break;
      currentState = result.newState;
    }
  }

  return {
    winner: currentState.winner,
    scoreDiff:
      calculateGridScore(currentState.grids.player1) -
      calculateGridScore(currentState.grids.player2),
  };
}

/**
 * Run Monte Carlo simulation for a move
 */
function simulateMove(state, column, config) {
  const result = applyMove(state, column);
  if (!result) {
    return {
      column,
      wins: 0,
      losses: 0,
      draws: 0,
      totalGames: 0,
      winProbability: 0,
      averageScoreDiff: 0,
    };
  }

  const player = state.currentPlayer;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalScoreDiff = 0;

  for (let i = 0; i < config.simulations; i++) {
    const simResult = simulateGame(
      result.newState,
      config.policy,
      config.heuristicRatio,
    );

    if (simResult.winner === player) wins++;
    else if (simResult.winner === "draw") draws++;
    else if (simResult.winner !== null) losses++;

    const scoreDiff =
      player === "player1" ? simResult.scoreDiff : -simResult.scoreDiff;
    totalScoreDiff += scoreDiff;
  }

  const totalGames = wins + losses + draws;

  return {
    column,
    wins,
    losses,
    draws,
    totalGames,
    winProbability: totalGames > 0 ? wins / totalGames : 0,
    averageScoreDiff: totalGames > 0 ? totalScoreDiff / totalGames : 0,
  };
}

/**
 * Analyze all moves with Monte Carlo
 */
function analyzeAllMoves(state, config) {
  if (state.phase !== "placing" || state.currentDie === null) {
    return {
      moves: [],
      bestMove: null,
      simulationsPerMove: config.simulations,
    };
  }

  const player = state.currentPlayer;
  const grid = state.grids[player];
  const oppGrid = state.grids[getOpponent(player)];
  const dieValue = state.currentDie;

  const legalColumns = ALL_COLUMNS.filter((i) => !isColumnFull(grid[i]));

  if (legalColumns.length === 0) {
    return {
      moves: [],
      bestMove: null,
      simulationsPerMove: config.simulations,
    };
  }

  const moves = legalColumns.map((column) => {
    const simResult = simulateMove(state, column, config);
    const immediateScoreGain = calculateMoveScoreGain(grid, column, dieValue);
    const opponentDiceRemoved = oppGrid[column].filter(
      (d) => d === dieValue,
    ).length;

    return {
      column,
      winProbability: simResult.winProbability,
      expectedScore: simResult.averageScoreDiff,
      immediateScoreGain,
      opponentDiceRemoved,
    };
  });

  moves.sort((a, b) => b.winProbability - a.winProbability);

  return {
    moves,
    bestMove: moves.length > 0 ? moves[0].column : null,
    simulationsPerMove: config.simulations,
  };
}

/**
 * Handle messages from main thread
 */
self.onmessage = (event) => {
  const { type, payload, id } = event.data;

  try {
    let result;

    switch (type) {
      case "getBestMove": {
        const { state, config, performanceConfig } = payload;
        if (performanceConfig?.maxNodes) {
          maxNodes = performanceConfig.maxNodes;
        }
        result = getBestMove(state, config);
        break;
      }

      case "expectimax": {
        const { state, player, config, performanceConfig } = payload;
        if (performanceConfig?.maxNodes) {
          maxNodes = performanceConfig.maxNodes;
        }
        result = expectimax(state, player, config);
        break;
      }

      case "analyzeAllMoves": {
        const { state, config } = payload;
        result = analyzeAllMoves(state, config);
        break;
      }

      case "quickAnalysis": {
        const { state, simulations } = payload;
        result = analyzeAllMoves(state, {
          simulations: simulations || 200,
          policy: "mixed",
          heuristicRatio: 0.3,
        });
        break;
      }

      case "deepAnalysis": {
        const { state, simulations } = payload;
        result = analyzeAllMoves(state, {
          simulations: simulations || 2000,
          policy: "heuristic",
          heuristicRatio: 0.7,
        });
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    self.postMessage({ id, type: "success", result });
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
