import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyAction,
  checkVictory,
  createInitialState,
  deserializeSession,
  getLegalActions,
  getScoreSummary,
  restoreGameState,
  serializeSession,
} from '@/domain';
import { createEmptyBoard } from '@/domain/model/board';
import { hashPosition } from '@/domain/model/hash';
import type { GameState } from '@/domain/model/types';
import {
  boardWithPieces,
  checker,
  createSession,
  gameStateWithBoard,
  resetFactoryIds,
  undoFrame,
  withConfig,
} from '@/test/factories';

describe('game engine victory and serialization', () => {
  beforeEach(() => {
    resetFactoryIds();
  });

  it('detects home-field and six-stack victories', () => {
    const board = createEmptyBoard();
    const whiteCoords = [
      'A4',
      'B4',
      'C4',
      'D4',
      'E4',
      'F4',
      'A5',
      'B5',
      'C5',
      'D5',
      'E5',
      'F5',
      'A6',
      'B6',
      'C6',
      'D6',
      'E6',
      'F6',
    ] as const;

    whiteCoords.forEach((coord) => {
      board[coord].checkers = [checker('white')];
    });

    const homeFieldState = gameStateWithBoard(board);

    expect(checkVictory(homeFieldState, withConfig())).toEqual({
      type: 'homeField',
      winner: 'white',
    });

    const stackBoard = createEmptyBoard();

    (['A6', 'B6', 'C6', 'D6', 'E6', 'F6'] as const).forEach((coord) => {
      stackBoard[coord].checkers = [checker('white'), checker('white'), checker('white')];
    });

    const stackState = gameStateWithBoard(stackBoard);

    expect(checkVictory(stackState, withConfig())).toEqual({
      type: 'sixStacks',
      winner: 'white',
    });
  });

  it('does not count mixed-color front-row stacks as a six-stack victory', () => {
    const board = createEmptyBoard();

    (['A6', 'B6', 'C6', 'D6', 'E6', 'F6'] as const).forEach((coord) => {
      board[coord].checkers = [checker('black'), checker('white'), checker('white')];
    });

    const state = gameStateWithBoard(board);

    expect(checkVictory(state, withConfig())).toEqual({ type: 'none' });
  });

  it('marks threefold repetition draws from position counts', () => {
    const board = boardWithPieces({
      A1: [checker('white')],
      B2: [checker('black')],
      C3: [checker('white')],
      D4: [checker('black')],
    });
    const state = gameStateWithBoard(board);
    const repeatedHash = hashPosition({ board, currentPlayer: 'white' });
    const repeatedState: GameState = {
      ...state,
      positionCounts: {
        ...state.positionCounts,
        [repeatedHash]: 3,
      },
    };

    expect(checkVictory(repeatedState, withConfig({ drawRule: 'threefold' }))).toEqual({
      type: 'threefoldDraw',
    });
  });

  it('treats equivalent boards with different checker ids as the same repetition position', () => {
    const boardA = boardWithPieces({
      A1: [checker('white', false, 'white-a')],
      B2: [checker('black', true, 'black-a')],
    });
    const boardB = boardWithPieces({
      A1: [checker('white', false, 'white-b')],
      B2: [checker('black', true, 'black-b')],
    });
    const hashA = hashPosition({ board: boardA, currentPlayer: 'white' });
    const hashB = hashPosition({ board: boardB, currentPlayer: 'white' });
    const stateB: GameState = {
      ...gameStateWithBoard(boardB),
      positionCounts: {
        [hashA]: 3,
      },
    };

    expect(hashA).toBe(hashB);
    expect(checkVictory(stateB, withConfig({ drawRule: 'threefold' }))).toEqual({
      type: 'threefoldDraw',
    });
  });

  it('serializes and deserializes sessions', () => {
    const session = createSession(createInitialState());
    const serialized = serializeSession(session);
    const prettySerialized = serializeSession(session, { pretty: true });
    const restored = deserializeSession(serialized);
    const restoredGameState = restoreGameState(restored.present, restored.turnLog);

    expect(serialized).not.toContain('\n');
    expect(prettySerialized).toContain('\n');
    expect(restored.version).toBe(3);
    expect(restoredGameState.currentPlayer).toBe('white');
    expect(() => deserializeSession('{"version":1,"present":{}}')).toThrow();
  });

  it('migrates legacy bilingual preferences and normalizes stale position counts on deserialize', () => {
    const state = createInitialState();
    const legacySerialized = JSON.stringify({
      version: 1,
      ruleConfig: withConfig(),
      preferences: {
        passDeviceOverlayEnabled: true,
        languageMode: 'bilingual',
      },
      present: {
        ...state,
        positionCounts: {
          staleHash: 9,
        },
      },
      past: [],
      future: [],
    });
    const restored = deserializeSession(legacySerialized);
    const restoredState = restoreGameState(restored.present, restored.turnLog);
    const currentHash = hashPosition(restoredState);

    expect(restored.preferences.language).toBe('russian');
    expect(restored.present.positionCounts).toEqual({
      [currentHash]: 1,
    });
  });

  it('restores shared-turn-log sessions with history cursor and position counts intact', () => {
    const config = withConfig();
    const state0 = createInitialState(config);
    const state1 = applyAction(state0, { type: 'climbOne', source: 'A1', target: 'B2' }, config);
    const state2 = applyAction(state1, getLegalActions(state1, config)[0], config);
    const session = createSession(state2, {
      turnLog: state2.history,
      past: [undoFrame(state0), undoFrame(state1)],
    });
    const restored = deserializeSession(serializeSession(session));
    const restoredState = restoreGameState(restored.present, restored.turnLog);

    expect(restored.present.historyCursor).toBe(state2.history.length);
    expect(restoredState.history).toHaveLength(2);
    expect(restoredState.positionCounts).toEqual(state2.positionCounts);
    expect(restoredState.victory).toEqual(state2.victory);
  });

  it('keeps v2 serialized sessions well below the legacy nested-history baseline', () => {
    const config = withConfig();
    const playoutStates = [createInitialState(config)];
    let state = playoutStates[0];

    for (let turn = 0; turn < 24; turn += 1) {
      const actions = getLegalActions(state, config);
      state = applyAction(state, actions[turn % actions.length], config);
      playoutStates.push(state);
    }

    const session = createSession(state, {
      turnLog: state.history,
      past: playoutStates.slice(0, -1).map(undoFrame),
    });
    const serialized = serializeSession(session);

    expect(serialized.length).toBeLessThan(1_000_000);
  });

  it('computes score summaries for the initial position', () => {
    const score = getScoreSummary(createInitialState());

    expect(score.homeFieldSingles.white).toBe(0);
    expect(score.homeFieldSingles.black).toBe(0);
  });
});
