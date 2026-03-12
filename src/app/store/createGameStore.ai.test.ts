import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createGameStore } from '@/app/store/createGameStore';
import { applyAction, createInitialState, getLegalActions } from '@/domain';
import type { MatchSettings } from '@/shared/types/session';
import { createSession, resetFactoryIds, undoFrame, withConfig } from '@/test/factories';

import {
  createAiResult,
  createMemoryStorage,
  createQuotaExceededError,
  FakeAiWorker,
} from '@/app/store/createGameStore.testUtils';

describe('createGameStore AI integration', () => {
  beforeEach(() => {
    resetFactoryIds();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps the computer turn flow alive when local storage quota is exceeded on a new game', () => {
    const worker = new FakeAiWorker();
    const storage = createMemoryStorage({}, {
      onSetItem: () => {
        throw createQuotaExceededError();
      },
    });
    const store = createGameStore({
      createAiWorker: () => worker,
      storage,
    });

    expect(() =>
      store.getState().startNewGame({
        opponentMode: 'computer',
        humanPlayer: 'black',
        aiDifficulty: 'easy',
      }),
    ).not.toThrow();
    expect(store.getState().aiStatus).toBe('thinking');
    expect(worker.requests).toHaveLength(1);
  });

  it('still schedules the computer reply when a committed move cannot be written to local storage', () => {
    const worker = new FakeAiWorker();
    const storage = createMemoryStorage({}, {
      onSetItem: () => {
        throw createQuotaExceededError();
      },
    });
    const store = createGameStore({
      createAiWorker: () => worker,
      storage,
    });

    store.getState().startNewGame({
      opponentMode: 'computer',
      humanPlayer: 'white',
      aiDifficulty: 'easy',
    });
    store.getState().selectCell('A1');
    store.getState().chooseActionType('climbOne');

    expect(() => store.getState().selectCell('B2')).not.toThrow();
    expect(store.getState().aiStatus).toBe('thinking');
    expect(worker.requests).toHaveLength(1);
  });

  it('starts a computer match as black and locks input while the AI is thinking', () => {
    const worker = new FakeAiWorker();
    const store = createGameStore({
      createAiWorker: () => worker,
      storage: undefined,
    });

    store.getState().startNewGame({
      opponentMode: 'computer',
      humanPlayer: 'black',
      aiDifficulty: 'easy',
    });

    expect(store.getState().matchSettings).toEqual<MatchSettings>({
      opponentMode: 'computer',
      humanPlayer: 'black',
      aiDifficulty: 'easy',
    });
    expect(store.getState().aiStatus).toBe('thinking');
    expect(worker.requests).toHaveLength(1);

    store.getState().selectCell('A1');
    expect(store.getState().selectedCell).toBeNull();

    const aiAction = getLegalActions(store.getState().gameState, store.getState().ruleConfig)[0];
    expect(aiAction).toBeDefined();
    if (!aiAction) {
      return;
    }

    worker.reply(createAiResult({ action: aiAction }));

    const humanSource = store.getState().selectableCoords[0];
    expect(store.getState().interaction.type).toBe('idle');
    expect(humanSource).toBeDefined();
    if (!humanSource) {
      return;
    }

    store.getState().selectCell(humanSource);
    expect(store.getState().selectedCell).toBe(humanSource);
  });

  it('defaults new computer matches to threefold draws when the current draw rule is none', () => {
    const store = createGameStore({
      storage: undefined,
    });

    expect(store.getState().ruleConfig.drawRule).toBe('none');

    store.getState().startNewGame({
      opponentMode: 'computer',
      humanPlayer: 'white',
      aiDifficulty: 'medium',
    });

    expect(store.getState().ruleConfig.drawRule).toBe('threefold');
  });

  it('undoes the full human-plus-computer turn pair in computer mode', () => {
    const worker = new FakeAiWorker();
    const store = createGameStore({
      createAiWorker: () => worker,
      storage: undefined,
    });

    store.getState().startNewGame({
      opponentMode: 'computer',
      humanPlayer: 'white',
      aiDifficulty: 'easy',
    });

    store.getState().selectCell('A1');
    store.getState().chooseActionType('climbOne');
    store.getState().selectCell('B2');

    const aiAction = getLegalActions(store.getState().gameState, store.getState().ruleConfig)[0];
    worker.reply(createAiResult({ action: aiAction }));

    expect(store.getState().gameState.currentPlayer).toBe('white');

    store.getState().undo();

    expect(store.getState().historyCursor).toBe(0);
    expect(store.getState().gameState.currentPlayer).toBe('white');
  });

  it('auto-schedules AI only when a loaded computer session is at the live tip', async () => {
    const liveWorker = new FakeAiWorker();
    createGameStore({
      createAiWorker: () => liveWorker,
      initialSession: createSession(createInitialState(), {
        matchSettings: {
          opponentMode: 'computer',
          humanPlayer: 'black',
          aiDifficulty: 'easy',
        },
      }),
      storage: undefined,
    });

    await Promise.resolve();
    expect(liveWorker.requests).toHaveLength(1);

    const rewoundWorker = new FakeAiWorker();
    const state0 = createInitialState();
    const state1 = applyAction(
      state0,
      { type: 'climbOne', source: 'A1', target: 'B2' },
      withConfig(),
    );
    const rewoundStore = createGameStore({
      createAiWorker: () => rewoundWorker,
      initialSession: createSession(state1, {
        matchSettings: {
          opponentMode: 'computer',
          humanPlayer: 'black',
          aiDifficulty: 'easy',
        },
        past: [undoFrame(state0)],
        present: undoFrame(state0),
        turnLog: state1.history,
      }),
      storage: undefined,
    });

    await Promise.resolve();

    expect(rewoundWorker.requests).toHaveLength(0);
    expect(rewoundStore.getState().historyCursor).toBe(0);
  });

  it('recovers from a hung computer worker via the watchdog timeout', () => {
    vi.useFakeTimers();

    const workers: FakeAiWorker[] = [];
    const store = createGameStore({
      createAiWorker: () => {
        const worker = new FakeAiWorker();

        workers.push(worker);
        return worker;
      },
      storage: undefined,
    });

    store.getState().startNewGame({
      opponentMode: 'computer',
      humanPlayer: 'black',
      aiDifficulty: 'easy',
    });

    vi.advanceTimersByTime(371);

    expect(workers[0]?.terminated).toBe(true);
    expect(store.getState().aiStatus).toBe('error');

    store.getState().retryComputerMove();

    expect(store.getState().aiStatus).toBe('thinking');
    expect(workers).toHaveLength(2);
    expect(workers[1]?.requests).toHaveLength(1);
  });

  it('ignores stale AI replies after restarting the worker', () => {
    vi.useFakeTimers();

    const workers: FakeAiWorker[] = [];
    const store = createGameStore({
      createAiWorker: () => {
        const worker = new FakeAiWorker();

        workers.push(worker);
        return worker;
      },
      storage: undefined,
    });

    store.getState().startNewGame({
      opponentMode: 'computer',
      humanPlayer: 'black',
      aiDifficulty: 'easy',
    });

    const firstWorker = workers[0];
    const staleRequestId = firstWorker?.requests[0]?.requestId;

    vi.advanceTimersByTime(371);
    store.getState().retryComputerMove();

    const secondWorker = workers[1];
    const freshRequestId = secondWorker?.requests[0]?.requestId;
    const legalAction = getLegalActions(
      store.getState().gameState,
      store.getState().ruleConfig,
    )[0];

    expect(freshRequestId).toBe(2);
    expect(legalAction).toBeDefined();
    if (!secondWorker || !legalAction) {
      return;
    }

    secondWorker.dispatch(staleRequestId as number, createAiResult({ action: legalAction }));

    expect(store.getState().aiStatus).toBe('thinking');
    expect(store.getState().gameState.history).toHaveLength(0);

    secondWorker.dispatch(freshRequestId as number, createAiResult({ action: legalAction }));

    expect(store.getState().aiStatus).toBe('idle');
    expect(store.getState().gameState.history).toHaveLength(1);
  });
});
