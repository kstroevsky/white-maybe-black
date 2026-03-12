import { describe, expect, it } from 'vitest';

import { AI_DIFFICULTY_PRESETS, chooseComputerAction, orderMoves } from '@/ai';
import { applyAction, createInitialState, getLegalActions, hashPosition } from '@/domain';
import type { GameState, TurnAction } from '@/domain/model/types';
import { resetFactoryIds, withConfig } from '@/test/factories';

import {
  actionKey,
  createHomeFieldWinState,
  createOpponentThreatState,
  createSixStackWinState,
  createTickingClock,
} from '@/ai/test/searchTestUtils';

describe('computer opponent search', () => {
  it('exposes the shipped difficulty presets', () => {
    expect(AI_DIFFICULTY_PRESETS).toEqual({
      easy: {
        timeBudgetMs: 120,
        maxDepth: 2,
        quietMoveLimit: 8,
        balancedTopCount: 3,
        balancedThreshold: 0.08,
        repetitionPenalty: 120,
        selfUndoPenalty: 220,
        rootCandidateLimit: 4,
      },
      medium: {
        timeBudgetMs: 400,
        maxDepth: 4,
        quietMoveLimit: 16,
        balancedTopCount: 2,
        balancedThreshold: 0.03,
        repetitionPenalty: 180,
        selfUndoPenalty: 320,
        rootCandidateLimit: 5,
      },
      hard: {
        timeBudgetMs: 1200,
        maxDepth: 6,
        quietMoveLimit: 28,
        balancedTopCount: 2,
        balancedThreshold: 0.015,
        repetitionPenalty: 240,
        selfUndoPenalty: 420,
        rootCandidateLimit: 6,
      },
    });
  });

  it('always returns a legal move on sampled runtime states', () => {
    resetFactoryIds();
    const states = [
      createHomeFieldWinState(),
      createSixStackWinState(),
      createOpponentThreatState(),
    ];

    for (const state of states) {
      const result = chooseComputerAction({
        difficulty: 'easy',
        now: createTickingClock(),
        random: () => 0,
        ruleConfig: withConfig(),
        state,
      });
      const legalActions = getLegalActions(state, withConfig());

      expect(result.action).not.toBeNull();
      expect(legalActions.map(actionKey)).toContain(actionKey(result.action));
    }
  });

  it('finds immediate home-field and six-stack wins', () => {
    resetFactoryIds();
    const homeFieldResult = chooseComputerAction({
      difficulty: 'easy',
      now: createTickingClock(0.001),
      random: () => 0,
      ruleConfig: withConfig(),
      state: createHomeFieldWinState(),
    });
    const sixStackResult = chooseComputerAction({
      difficulty: 'easy',
      now: createTickingClock(0.001),
      random: () => 0,
      ruleConfig: withConfig(),
      state: createSixStackWinState(),
    });

    expect(homeFieldResult.action).toEqual({
      type: 'moveSingleToEmpty',
      source: 'C3',
      target: 'C4',
    });
    expect(homeFieldResult.completedRootMoves).toBe(1);
    expect(homeFieldResult.fallbackKind).toBe('none');
    expect(homeFieldResult.timedOut).toBe(false);
    expect(sixStackResult.action).toEqual({
      type: 'climbOne',
      source: 'A5',
      target: 'A6',
    });
    expect(sixStackResult.completedRootMoves).toBe(1);
    expect(sixStackResult.fallbackKind).toBe('none');
    expect(sixStackResult.timedOut).toBe(false);
    expect(homeFieldResult.principalVariation).toHaveLength(1);
    expect(homeFieldResult.rootCandidates).toHaveLength(1);
    expect(homeFieldResult.diagnostics.betaCutoffs).toBeGreaterThanOrEqual(0);
  });

  it('blocks the opponent from winning on the next move', () => {
    resetFactoryIds();
    const state = createOpponentThreatState();
    const result = chooseComputerAction({
      difficulty: 'easy',
      now: createTickingClock(),
      random: () => 0,
      ruleConfig: withConfig(),
      state,
    });

    expect(result.action).not.toBeNull();

    const nextState = applyAction(state, result.action as TurnAction, withConfig());
    const opponentWinsImmediately = getLegalActions(nextState, withConfig()).some((action) => {
      const replyState = applyAction(nextState, action, withConfig());

      return (
        replyState.status === 'gameOver' &&
        replyState.victory.type === 'sixStacks' &&
        replyState.victory.winner === 'black'
      );
    });

    expect(opponentWinsImmediately).toBe(false);
  });

  it('marks and de-prioritizes self-undo moves that return to the grandparent position', () => {
    const config = withConfig();
    const state = createInitialState(config);
    const orderedBase = orderMoves(state, state.currentPlayer, config, AI_DIFFICULTY_PRESETS.hard, {
      includeAllQuietMoves: true,
    });
    const quietCandidate = orderedBase.find(
      (entry) =>
        !entry.isTactical &&
        entry.action.type !== 'jumpSequence' &&
        entry.action.type !== 'manualUnfreeze',
    );

    expect(quietCandidate).toBeDefined();
    if (!quietCandidate) {
      return;
    }

    const ordered = orderMoves(state, state.currentPlayer, config, AI_DIFFICULTY_PRESETS.hard, {
      grandparentPositionKey: hashPosition(quietCandidate.nextState),
      includeAllQuietMoves: true,
      selfUndoPenalty: 10_000,
    });
    const baseEntry = orderedBase.find(
      (entry) => actionKey(entry.action) === actionKey(quietCandidate.action),
    );
    const undoEntry = ordered.find(
      (entry) => actionKey(entry.action) === actionKey(quietCandidate.action),
    );

    expect(baseEntry).toBeDefined();
    expect(undoEntry).toBeDefined();
    if (!baseEntry || !undoEntry) {
      return;
    }

    expect(undoEntry.isSelfUndo).toBe(true);
    expect(undoEntry.score).toBeLessThan(baseEntry.score);
  });

  it('penalizes repeated quiet moves based on positionCounts', () => {
    const config = withConfig();
    const state = createInitialState(config);
    const orderedBase = orderMoves(state, state.currentPlayer, config, AI_DIFFICULTY_PRESETS.hard, {
      includeAllQuietMoves: true,
      repetitionPenalty: 0,
    });
    const quietCandidate = orderedBase.find(
      (entry) =>
        !entry.isTactical &&
        entry.action.type !== 'jumpSequence' &&
        entry.action.type !== 'manualUnfreeze',
    );

    expect(quietCandidate).toBeDefined();
    if (!quietCandidate) {
      return;
    }

    const repeatedKey = hashPosition(quietCandidate.nextState);
    const loopState: GameState = {
      ...state,
      positionCounts: {
        ...state.positionCounts,
        [repeatedKey]: 2,
      },
    };
    const orderedRepeated = orderMoves(
      loopState,
      loopState.currentPlayer,
      config,
      AI_DIFFICULTY_PRESETS.hard,
      {
        includeAllQuietMoves: true,
        repetitionPenalty: 6_000,
      },
    );
    const baseEntry = orderedBase.find(
      (entry) => actionKey(entry.action) === actionKey(quietCandidate.action),
    );
    const repeatedEntry = orderedRepeated.find(
      (entry) => actionKey(entry.action) === actionKey(quietCandidate.action),
    );

    expect(baseEntry).toBeDefined();
    expect(repeatedEntry).toBeDefined();
    if (!baseEntry || !repeatedEntry) {
      return;
    }

    expect(repeatedEntry.isRepetition).toBe(true);
    expect(repeatedEntry.score).toBeLessThan(baseEntry.score);
  });

  it('keeps best root move parity-stable across odd/even depths on tactical wins', () => {
    const state = createHomeFieldWinState();
    const originalHardPreset = { ...AI_DIFFICULTY_PRESETS.hard };
    let depthThree;
    let depthFour;

    AI_DIFFICULTY_PRESETS.hard.timeBudgetMs = 10_000;

    try {
      AI_DIFFICULTY_PRESETS.hard.maxDepth = 3;
      depthThree = chooseComputerAction({
        difficulty: 'hard',
        now: createTickingClock(0.001),
        random: () => 0,
        ruleConfig: withConfig(),
        state,
      });
      AI_DIFFICULTY_PRESETS.hard.maxDepth = 4;
      depthFour = chooseComputerAction({
        difficulty: 'hard',
        now: createTickingClock(0.001),
        random: () => 0,
        ruleConfig: withConfig(),
        state,
      });
    } finally {
      Object.assign(AI_DIFFICULTY_PRESETS.hard, originalHardPreset);
    }

    expect(actionKey(depthThree.action)).toBe(actionKey(depthFour.action));
    expect(depthThree.fallbackKind).toBe('none');
    expect(depthFour.fallbackKind).toBe('none');
  });
});
