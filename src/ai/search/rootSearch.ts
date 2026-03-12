import { evaluateState } from '@/ai/evaluation';
import { orderMoves } from '@/ai/moveOrdering';
import { AI_DIFFICULTY_PRESETS } from '@/ai/presets';
import type { AiSearchResult, ChooseComputerActionRequest } from '@/ai/types';
import { getLegalActions, type TurnAction } from '@/domain';

import {
  getMovePenalty,
  getRootPreviousOwnAction,
  getRootSelfUndoPositionKey,
  MAX_QUIESCENCE_DEPTH,
} from '@/ai/search/heuristics';
import { negamax } from '@/ai/search/negamax';
import {
  buildPrincipalVariation,
  createEmptyResult,
  createSearchDiagnostics,
  orderRootCandidates,
  selectCandidateAction,
  sortRankedActions,
} from '@/ai/search/result';
import {
  actionKey,
  isSearchTimeout,
  makeTableKey,
  throwIfTimedOut,
} from '@/ai/search/shared';
import type { RootRankedAction, SearchContext, TranspositionEntry } from '@/ai/search/types';

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

  if (!legalActions.length) {
    return {
      ...createEmptyResult(null, getFallbackScore()),
      fallbackKind: 'none',
    };
  }

  const context: SearchContext = {
    continuationScores: new Map<string, number>(),
    deadline,
    diagnostics: createSearchDiagnostics(),
    evaluatedNodes: 0,
    historyScores: new Map<string, number>(),
    killerMovesByDepth: new Map<number, TurnAction[]>(),
    now,
    preset,
    pvMoveByDepth: new Map<number, TurnAction>(),
    rootPreviousOwnAction: getRootPreviousOwnAction(state),
    quiescenceDepthLimit: preset.maxDepth + MAX_QUIESCENCE_DEPTH,
    rootSelfUndoPositionKey: getRootSelfUndoPositionKey(state),
    ruleConfig,
    table: new Map<string, TranspositionEntry>(),
  };

  let completedDepth = 0;
  let completedRootMoves = 0;
  let bestAction = legalActions[0];
  let bestScore = getFallbackScore();
  let fallbackKind: AiSearchResult['fallbackKind'] = 'none';
  let timedOut = false;
  let rootCandidates: RootRankedAction[] = [];

  try {
    const rootOrderedMoves = orderMoves(state, state.currentPlayer, ruleConfig, preset, {
      actions: legalActions,
      deadline,
      grandparentPositionKey: context.rootSelfUndoPositionKey,
      historyScores: context.historyScores,
      includeAllQuietMoves: true,
      killerMoves: [],
      now,
      previousActionKey: null,
      pvMove: null,
      repetitionPenalty: preset.repetitionPenalty,
      samePlayerPreviousAction: context.rootPreviousOwnAction,
      selfUndoPenalty: preset.selfUndoPenalty,
      continuationScores: context.continuationScores,
      ttMove: null,
    });

    for (const entry of rootOrderedMoves) {
      if (
        entry.nextState.status === 'gameOver' &&
        (entry.nextState.victory.type === 'homeField' ||
          entry.nextState.victory.type === 'sixStacks') &&
        entry.nextState.victory.winner === state.currentPlayer
      ) {
        return {
          action: entry.action,
          completedDepth: 1,
          completedRootMoves: 1,
          diagnostics: context.diagnostics,
          elapsedMs: now() - startedAt,
          evaluatedNodes: 1,
          fallbackKind: 'none',
          principalVariation: [entry.action],
          rootCandidates: [
            {
              action: entry.action,
              isForced: entry.isForced,
              isRepetition: entry.isRepetition,
              isSelfUndo: entry.isSelfUndo,
              isTactical: entry.isTactical,
              score: 1_000_000,
            },
          ],
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
      diagnostics: context.diagnostics,
      elapsedMs: now() - startedAt,
      evaluatedNodes: 0,
      fallbackKind: 'legalOrder',
      principalVariation: [legalActions[0]],
      rootCandidates: [
        {
          action: legalActions[0],
          isForced: false,
          isRepetition: false,
          isSelfUndo: false,
          isTactical: false,
          score: getFallbackScore(),
        },
      ],
      score: getFallbackScore(),
      timedOut: true,
    };
  }

  const rootPositionKey = makeTableKey(state);

  for (let depth = 1; depth <= preset.maxDepth; depth += 1) {
    const ranked: RootRankedAction[] = [];

    try {
      throwIfTimedOut(now, deadline);

      const orderedMoves = orderMoves(state, state.currentPlayer, ruleConfig, preset, {
        actions: legalActions,
        deadline,
        grandparentPositionKey: context.rootSelfUndoPositionKey,
        historyScores: context.historyScores,
        includeAllQuietMoves: true,
        killerMoves: context.killerMovesByDepth.get(0) ?? [],
        now,
        previousActionKey: null,
        pvMove: context.pvMoveByDepth.get(0),
        repetitionPenalty: preset.repetitionPenalty,
        samePlayerPreviousAction: context.rootPreviousOwnAction,
        selfUndoPenalty: preset.selfUndoPenalty,
        continuationScores: context.continuationScores,
        ttMove: context.table.get(rootPositionKey)?.bestAction,
      });

      for (const entry of orderedMoves) {
        throwIfTimedOut(now, deadline);

        let score = -negamax(
          entry.nextState,
          depth - 1,
          Number.NEGATIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          1,
          [rootPositionKey, makeTableKey(entry.nextState)],
          [entry.action],
          actionKey(entry.action),
          context,
        );

        score -= getMovePenalty(entry, context);

        ranked.push({
          action: entry.action,
          isForced: entry.isForced,
          isRepetition: entry.isRepetition,
          isSelfUndo: entry.isSelfUndo,
          isTactical: entry.isTactical,
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
          rootCandidates = partialRanked;
          fallbackKind = 'partialCurrentDepth';
        } else if (completedDepth > 0) {
          fallbackKind = 'previousDepth';
        } else {
          fallbackKind = 'legalOrder';
          bestScore = getFallbackScore();
          completedRootMoves = 0;
          rootCandidates = [
            {
              action: legalActions[0],
              isForced: false,
              isRepetition: false,
              isSelfUndo: false,
              isTactical: false,
              score: bestScore,
            },
          ];
        }

        break;
      }

      throw error;
    }

    sortRankedActions(ranked);

    if (!ranked.length) {
      break;
    }

    completedDepth = depth;
    completedRootMoves = ranked.length;
    rootCandidates = ranked;
    bestScore = ranked[0].score;
    bestAction = selectCandidateAction(ranked, preset, random).action;
    fallbackKind = 'none';

    context.pvMoveByDepth.set(0, bestAction);
  }

  return {
    action: bestAction,
    completedDepth,
    completedRootMoves,
    diagnostics: context.diagnostics,
    elapsedMs: now() - startedAt,
    evaluatedNodes: context.evaluatedNodes,
    fallbackKind,
    principalVariation: buildPrincipalVariation(state, bestAction, completedDepth, context),
    rootCandidates: orderRootCandidates(rootCandidates, preset.rootCandidateLimit),
    score: bestScore,
    timedOut,
  };
}
