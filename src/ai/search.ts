import {
  advanceEngineState,
  getLegalActions,
  hashPosition,
  type EngineState,
  type Player,
  type RuleConfig,
  type TurnAction,
} from '@/domain';
import { evaluateState } from '@/ai/evaluation';
import { orderMoves } from '@/ai/moveOrdering';
import { AI_DIFFICULTY_PRESETS } from '@/ai/presets';
import type { AiDifficultyPreset, AiSearchResult, ChooseComputerActionRequest } from '@/ai/types';

type BoundFlag = 'exact' | 'lower' | 'upper';

type TranspositionEntry = {
  bestAction: TurnAction | null;
  depth: number;
  flag: BoundFlag;
  score: number;
};

// A hard cap keeps worker memory usage predictable in the browser.
const TRANSPOSITION_LIMIT = 50_000;
const AI_SEARCH_TIMEOUT = 'AI_SEARCH_TIMEOUT';

function actionKey(action: TurnAction): string {
  switch (action.type) {
    case 'manualUnfreeze':
      return `${action.type}:${action.coord}`;
    case 'jumpSequence':
      return `${action.type}:${action.source}:${action.path.join('>')}`;
    default:
      return `${action.type}:${action.source}:${action.target}`;
  }
}

function createSearchTimeoutError(): Error {
  return new Error(AI_SEARCH_TIMEOUT);
}

function isSearchTimeout(error: unknown): boolean {
  return error instanceof Error && error.message === AI_SEARCH_TIMEOUT;
}

function throwIfTimedOut(now: () => number, deadline: number): void {
  if (now() >= deadline) {
    throw createSearchTimeoutError();
  }
}

/**
 * Applies easy/medium randomness after search is complete.
 * Hard mode becomes deterministic because `pickTopCount` is `1`.
 */
function selectCandidateActions(
  ranked: Array<{ action: TurnAction; score: number }>,
  maxCount: number,
  threshold: number,
  random: () => number,
): TurnAction {
  const best = ranked[0];

  if (maxCount <= 1 || ranked.length === 1) {
    return best.action;
  }

  const tolerance = Math.max(1, Math.abs(best.score) * threshold);
  const candidates = ranked
    .filter((entry) => Math.abs(best.score - entry.score) <= tolerance)
    .slice(0, maxCount);

  return candidates[Math.floor(random() * candidates.length)]?.action ?? best.action;
}

function sortRankedActions(
  ranked: Array<{ action: TurnAction; score: number }>,
): Array<{ action: TurnAction; score: number }> {
  ranked.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return actionKey(left.action).localeCompare(actionKey(right.action));
  });

  return ranked;
}

/** Checks whether the side to move can end the game immediately from the current node. */
function hasImmediateThreat(state: EngineState, ruleConfig: RuleConfig): boolean {
  return getLegalActions(state, ruleConfig).some((action) => {
    const nextState = advanceEngineState(state, action, ruleConfig);
    return nextState.status === 'gameOver';
  });
}

/** Extends unstable leaves by one ply so jump chains and mate-in-one spots are not cut off early. */
function shouldExtend(state: EngineState, ruleConfig: RuleConfig, extensionsUsed: number): boolean {
  return extensionsUsed === 0 && (state.pendingJump !== null || hasImmediateThreat(state, ruleConfig));
}

/** Uses the domain hash as the transposition-table key for search-equivalent positions. */
function makeTableKey(state: EngineState): string {
  return hashPosition(state);
}

type SearchContext = {
  deadline: number;
  evaluatedNodes: number;
  now: () => number;
  pvMoveByDepth: Map<number, TurnAction>;
  preset: AiDifficultyPreset;
  rootPlayer: Player;
  ruleConfig: RuleConfig;
  table: Map<string, TranspositionEntry>;
};

/**
 * Core recursive search.
 *
 * The implementation uses negamax, so every recursive score is negated instead of splitting
 * into separate maximizing and minimizing branches.
 */
function negamax(
  state: EngineState,
  depth: number,
  alpha: number,
  beta: number,
  extensionsUsed: number,
  currentDepth: number,
  context: SearchContext,
): number {
  throwIfTimedOut(context.now, context.deadline);

  const originalAlpha = alpha;
  const tableKey = makeTableKey(state);
  const cached = context.table.get(tableKey);

  // Reuse sufficiently deep cached bounds before expanding the node again.
  if (cached && cached.depth >= depth) {
    if (cached.flag === 'exact') {
      return cached.score;
    }

    if (cached.flag === 'lower') {
      alpha = Math.max(alpha, cached.score);
    } else {
      beta = Math.min(beta, cached.score);
    }

    if (alpha >= beta) {
      return cached.score;
    }
  }

  if (depth === 0 && shouldExtend(state, context.ruleConfig, extensionsUsed)) {
    depth = 1;
    extensionsUsed += 1;
  }

  if (depth === 0 || state.status === 'gameOver') {
    context.evaluatedNodes += 1;
    return evaluateState(state, context.rootPlayer, context.ruleConfig);
  }

  const orderedMoves = orderMoves(
    state,
    context.rootPlayer,
    context.ruleConfig,
    context.preset,
    {
      deadline: context.deadline,
      now: context.now,
      pvMove: context.pvMoveByDepth.get(currentDepth),
      ttMove: cached?.bestAction,
    },
  );

  if (!orderedMoves.length) {
    context.evaluatedNodes += 1;
    return evaluateState(state, context.rootPlayer, context.ruleConfig);
  }

  let bestAction: TurnAction | null = cached?.bestAction ?? null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const entry of orderedMoves) {
    const score = -negamax(
      entry.nextState,
      depth - 1,
      -beta,
      -alpha,
      extensionsUsed,
      currentDepth + 1,
      context,
    );

    if (score > bestScore) {
      bestScore = score;
      bestAction = entry.action;
    }

    alpha = Math.max(alpha, score);

    // Standard alpha-beta cutoff: this branch can no longer improve the parent decision.
    if (alpha >= beta) {
      break;
    }
  }

  const flag: BoundFlag =
    bestScore <= originalAlpha ? 'upper' : bestScore >= beta ? 'lower' : 'exact';

  // FIFO eviction is enough for the current worker scope and board size.
  if (context.table.size >= TRANSPOSITION_LIMIT) {
    const oldestKey = context.table.keys().next().value;

    if (oldestKey) {
      context.table.delete(oldestKey);
    }
  }

  context.table.set(tableKey, {
    bestAction,
    depth,
    flag,
    score: bestScore,
  });

  if (bestAction) {
    context.pvMoveByDepth.set(currentDepth, bestAction);
  }

  return bestScore;
}

/** Chooses one computer move using iterative deepening negamax with alpha-beta pruning. */
export function chooseComputerAction({
  difficulty,
  now = () => performance.now(),
  random = Math.random,
  ruleConfig,
  state,
}: ChooseComputerActionRequest): AiSearchResult {
  const preset = AI_DIFFICULTY_PRESETS[difficulty];
  const startedAt = now();
  const deadline = startedAt + preset.timeBudgetMs;
  const legalActions = getLegalActions(state, ruleConfig);
  let fallbackScore: number | null = null;

  function getFallbackScore(): number {
    fallbackScore ??= evaluateState(state, state.currentPlayer, ruleConfig);
    return fallbackScore;
  }

  // No legal moves means the reducer already produced a terminal or pass-resolved state.
  if (!legalActions.length) {
    return {
      action: null,
      completedDepth: 0,
      completedRootMoves: 0,
      elapsedMs: 0,
      evaluatedNodes: 0,
      fallbackKind: 'none',
      score: getFallbackScore(),
      timedOut: false,
    };
  }

  // Fast-path direct wins before spending time on deeper search.
  try {
    for (const action of legalActions) {
      throwIfTimedOut(now, deadline);

      const nextState = advanceEngineState(state, action, ruleConfig);

      throwIfTimedOut(now, deadline);

      if (
        nextState.status === 'gameOver' &&
        (nextState.victory.type === 'homeField' || nextState.victory.type === 'sixStacks') &&
        nextState.victory.winner === state.currentPlayer
      ) {
        return {
          action,
          completedDepth: 1,
          completedRootMoves: 1,
          elapsedMs: now() - startedAt,
          evaluatedNodes: 1,
          fallbackKind: 'none',
          score: 1_000_000,
          timedOut: false,
        };
      }
    }
  } catch (error) {
    if (!isSearchTimeout(error)) {
      throw error;
    }

    return {
      action: legalActions[0],
      completedDepth: 0,
      completedRootMoves: 0,
      elapsedMs: now() - startedAt,
      evaluatedNodes: 0,
      fallbackKind: 'legalOrder',
      score: getFallbackScore(),
      timedOut: true,
    };
  }

  const context: SearchContext = {
    deadline,
    evaluatedNodes: 0,
    now,
    pvMoveByDepth: new Map<number, TurnAction>(),
    preset,
    rootPlayer: state.currentPlayer,
    ruleConfig,
    table: new Map<string, TranspositionEntry>(),
  };

  let completedDepth = 0;
  let completedRootMoves = 0;
  let bestAction = legalActions[0];
  let bestScore = 0;
  let fallbackKind: AiSearchResult['fallbackKind'] = 'none';
  let timedOut = false;

  // Iterative deepening keeps a stable best-so-far answer if the time budget expires mid-search.
  for (let depth = 1; depth <= preset.maxDepth; depth += 1) {
    const ranked: Array<{ action: TurnAction; score: number }> = [];

    try {
      throwIfTimedOut(now, deadline);

      const orderedMoves = orderMoves(
        state,
        context.rootPlayer,
        ruleConfig,
        preset,
        {
          actions: legalActions,
          deadline,
          includeAllQuietMoves: true,
          now,
          pvMove: context.pvMoveByDepth.get(0),
          ttMove: context.table.get(makeTableKey(state))?.bestAction,
        },
      );

      for (const entry of orderedMoves) {
        throwIfTimedOut(now, deadline);

        const score = -negamax(
          entry.nextState,
          depth - 1,
          Number.NEGATIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          0,
          1,
          context,
        );

        ranked.push({
          action: entry.action,
          score,
        });
      }
    } catch (error) {
      if (isSearchTimeout(error)) {
        timedOut = true;

        if (ranked.length > 0) {
          const partialRanked = sortRankedActions(ranked);
          const partialBest = partialRanked[0];

          bestAction = partialBest.action;
          bestScore = partialBest.score;
          completedRootMoves = partialRanked.length;
          fallbackKind = 'partialCurrentDepth';
        } else if (completedDepth > 0) {
          fallbackKind = 'previousDepth';
        } else {
          fallbackKind = 'legalOrder';
          bestScore = getFallbackScore();
          completedRootMoves = 0;
        }

        break;
      }

      throw error;
    }

    // Rank the current iteration before deciding whether to continue deeper.
    sortRankedActions(ranked);

    if (!ranked.length) {
      break;
    }

    completedDepth = depth;
    completedRootMoves = ranked.length;
    bestScore = ranked[0].score;
    bestAction = selectCandidateActions(
      ranked,
      preset.pickTopCount,
      preset.randomThreshold,
      random,
    );
    fallbackKind = 'none';

    context.pvMoveByDepth.set(0, bestAction);
  }

  return {
    action: bestAction,
    completedDepth,
    completedRootMoves,
    elapsedMs: now() - startedAt,
    evaluatedNodes: context.evaluatedNodes,
    fallbackKind,
    score: bestScore,
    timedOut,
  };
}
