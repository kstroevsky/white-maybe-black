import { beforeEach, describe, expect, it } from 'vitest';

import { createGameStore } from '@/app/store/createGameStore';
import { applyAction, createInitialState, getLegalActions } from '@/domain';
import { createSession, resetFactoryIds, undoFrame, withConfig } from '@/test/factories';

describe('createGameStore', () => {
  beforeEach(() => {
    resetFactoryIds();
  });

  it('keeps export JSON stale until explicitly refreshed', () => {
    const store = createGameStore({
      initialSession: createSession(createInitialState()),
      storage: undefined,
    });

    expect(store.getState().exportBuffer).toBe('');

    store.getState().refreshExportBuffer();
    const initialExport = store.getState().exportBuffer;

    expect(initialExport).toContain('\n');
    expect(initialExport).toContain('"version": 2');

    store.getState().setImportBuffer('{"draft": true}');
    expect(store.getState().exportBuffer).toBe(initialExport);

    store.getState().setPreference({ language: 'english' });
    expect(store.getState().exportBuffer).toBe(initialExport);

    store.getState().selectCell('A1');
    store.getState().chooseActionType('climbOne');
    store.getState().selectCell('B2');
    store.getState().acknowledgePassScreen();
    expect(store.getState().exportBuffer).toBe(initialExport);

    store.getState().undo();
    expect(store.getState().exportBuffer).toBe(initialExport);

    store.getState().redo();
    expect(store.getState().exportBuffer).toBe(initialExport);

    store.getState().refreshExportBuffer();

    expect(store.getState().exportBuffer).not.toBe(initialExport);
  });

  it('restores undo and redo from shared turn-log frames', () => {
    const config = withConfig();
    const state0 = createInitialState(config);
    const state1 = applyAction(state0, { type: 'climbOne', source: 'A1', target: 'B2' }, config);
    const state2 = applyAction(state1, getLegalActions(state1, config)[0], config);
    const store = createGameStore({
      initialSession: createSession(state2, {
        turnLog: state2.history,
        past: [undoFrame(state0), undoFrame(state1)],
      }),
      storage: undefined,
    });

    expect(store.getState().historyCursor).toBe(2);
    expect(store.getState().gameState.history).toHaveLength(2);

    store.getState().undo();

    expect(store.getState().historyCursor).toBe(1);
    expect(store.getState().gameState.history).toHaveLength(1);
    expect(store.getState().gameState.positionCounts).toEqual(state1.positionCounts);

    store.getState().redo();

    expect(store.getState().historyCursor).toBe(2);
    expect(store.getState().gameState.history).toHaveLength(2);
    expect(store.getState().gameState.positionCounts).toEqual(state2.positionCounts);
  });
});
