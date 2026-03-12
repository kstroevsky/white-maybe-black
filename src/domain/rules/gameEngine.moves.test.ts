import { beforeEach, describe, expect, it } from 'vitest';

import {
  applyAction,
  createInitialState,
  getJumpContinuationTargets,
  getLegalActionsForCell,
  validateAction,
} from '@/domain';
import {
  boardWithPieces,
  checker,
  gameStateWithBoard,
  resetFactoryIds,
  withConfig,
} from '@/test/factories';

describe('game engine moves', () => {
  beforeEach(() => {
    resetFactoryIds();
  });

  it('creates the exact initial setup', () => {
    const state = createInitialState();

    expect(state.currentPlayer).toBe('white');
    expect(state.board.A1.checkers[0].owner).toBe('white');
    expect(state.board.F3.checkers[0].owner).toBe('white');
    expect(state.board.A4.checkers[0].owner).toBe('black');
    expect(state.board.F6.checkers[0].owner).toBe('black');
    expect(Object.values(state.board).every((cell) => cell.checkers.length === 1)).toBe(true);
  });

  it('jumps over own checker without freezing and can continue a chain', () => {
    const state = gameStateWithBoard(
      boardWithPieces({
        A1: [checker('white')],
        B2: [checker('white')],
        D4: [checker('white')],
      }),
    );

    const actions = getLegalActionsForCell(state, 'A1', withConfig());
    const jumpAction = actions.find((action) => action.type === 'jumpSequence');

    expect(jumpAction).toEqual({
      type: 'jumpSequence',
      source: 'A1',
      path: ['C3'],
    });
    expect(getJumpContinuationTargets(state, 'A1', ['C3'])).toEqual(['E5']);
  });

  it('requires jump chains to be executed one landing at a time', () => {
    const state = gameStateWithBoard(
      boardWithPieces({
        A1: [checker('white')],
        B2: [checker('white')],
      }),
    );

    expect(getJumpContinuationTargets(state, 'A1', ['C3'])).toEqual([]);
    expect(
      getLegalActionsForCell(state, 'A1', withConfig()).filter(
        (action) => action.type === 'jumpSequence',
      ),
    ).toEqual([
      {
        type: 'jumpSequence',
        source: 'A1',
        path: ['C3'],
      },
    ]);

    expect(
      validateAction(
        state,
        {
          type: 'jumpSequence',
          source: 'A1',
          path: ['C3', 'A1'],
        },
        withConfig(),
      ),
    ).toEqual({
      valid: false,
      reason: 'Jump actions are applied one landing at a time.',
    });
  });

  it('freezes an opponent when jumping and unfreezes own frozen checker when jumping', () => {
    const freezeState = gameStateWithBoard(
      boardWithPieces({
        A1: [checker('white')],
        B2: [checker('black')],
      }),
    );
    const afterFreeze = applyAction(
      freezeState,
      {
        type: 'jumpSequence',
        source: 'A1',
        path: ['C3'],
      },
      withConfig(),
    );

    expect(afterFreeze.board.B2.checkers[0].frozen).toBe(true);

    const thawState = gameStateWithBoard(
      boardWithPieces({
        A1: [checker('white')],
        B2: [checker('white', true)],
      }),
    );
    const afterThaw = applyAction(
      thawState,
      {
        type: 'jumpSequence',
        source: 'A1',
        path: ['C3'],
      },
      withConfig(),
    );

    expect(afterThaw.board.B2.checkers[0].frozen).toBe(false);
  });

  it('allows only owner to jump over frozen single checker', () => {
    const blockedState = gameStateWithBoard(
      boardWithPieces({
        A1: [checker('black')],
        B2: [checker('white', true)],
        F6: [checker('white')],
      }),
      {
        currentPlayer: 'black',
      },
    );

    expect(
      validateAction(
        blockedState,
        {
          type: 'jumpSequence',
          source: 'A1',
          path: ['C3'],
        },
        withConfig(),
      ),
    ).toEqual({ valid: false, reason: 'Cannot jump over B2.' });

    const ownerState = gameStateWithBoard(
      boardWithPieces({
        A1: [checker('white')],
        B2: [checker('white', true)],
        F6: [checker('black')],
      }),
    );
    const afterOwnerJump = applyAction(
      ownerState,
      {
        type: 'jumpSequence',
        source: 'A1',
        path: ['C3'],
      },
      withConfig(),
    );

    expect(afterOwnerJump.board.B2.checkers[0].frozen).toBe(false);
  });

  it('keeps turn ownership on jump continuation and allows manual next-segment choice', () => {
    const state = gameStateWithBoard(
      boardWithPieces({
        A1: [checker('white')],
        B2: [checker('white')],
        C4: [checker('black')],
        D4: [checker('black')],
        F6: [checker('black')],
      }),
    );
    const afterFirstJump = applyAction(
      state,
      {
        type: 'jumpSequence',
        source: 'A1',
        path: ['C3'],
      },
      withConfig(),
    );

    expect(afterFirstJump.currentPlayer).toBe('white');
    const jumpActions = getLegalActionsForCell(afterFirstJump, 'C3', withConfig()).filter(
      (action) => action.type === 'jumpSequence',
    );
    expect(jumpActions).toContainEqual({
      type: 'jumpSequence',
      source: 'C3',
      path: ['E5'],
    });

    const afterSecondJump = applyAction(
      afterFirstJump,
      {
        type: 'jumpSequence',
        source: 'C3',
        path: ['E5'],
      },
      withConfig(),
    );

    expect(afterSecondJump.currentPlayer).toBe('black');
  });

  it('ends turn when only repeating jump-back continuation exists', () => {
    const state = gameStateWithBoard(
      boardWithPieces({
        A1: [checker('white')],
        B2: [checker('white')],
        F6: [checker('black')],
      }),
    );
    const afterFirstJump = applyAction(
      state,
      {
        type: 'jumpSequence',
        source: 'A1',
        path: ['C3'],
      },
      withConfig(),
    );

    expect(afterFirstJump.currentPlayer).toBe('black');
    expect(
      getJumpContinuationTargets(
        {
          ...afterFirstJump,
          currentPlayer: 'white',
        },
        'C3',
        [],
      ),
    ).toEqual([]);
  });

  it('keeps non-repeating continuation targets while excluding jump-back loops', () => {
    const state = gameStateWithBoard(
      boardWithPieces({
        A1: [checker('white')],
        B2: [checker('white')],
        D4: [checker('white')],
        F6: [checker('black')],
      }),
    );
    const afterFirstJump = applyAction(
      state,
      {
        type: 'jumpSequence',
        source: 'A1',
        path: ['C3'],
      },
      withConfig(),
    );

    expect(afterFirstJump.currentPlayer).toBe('white');
    const jumpActions = getLegalActionsForCell(afterFirstJump, 'C3', withConfig()).filter(
      (action) => action.type === 'jumpSequence',
    );

    expect(jumpActions).toContainEqual({
      type: 'jumpSequence',
      source: 'C3',
      path: ['E5'],
    });
    expect(jumpActions).not.toContainEqual({
      type: 'jumpSequence',
      source: 'C3',
      path: ['A1'],
    });
  });
});
