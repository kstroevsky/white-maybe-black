import type { StoreApi } from 'zustand/vanilla';

import { createEmptyTargetMap } from '@/domain';

import { createAiController } from '@/app/store/createGameStore/aiController';
import { createDerivationCache } from '@/app/store/createGameStore/derivations';
import { isComputerTurn } from '@/app/store/createGameStore/match';
import { createPersistenceRuntime } from '@/app/store/createGameStore/persistenceRuntime';
import { createPublicGameStoreActions } from '@/app/store/createGameStore/publicActions';
import { buildSessionFromSlices, createRuntimeState, getSessionSlices } from '@/app/store/createGameStore/session';
import {
  createInitialInteractionState,
  createJumpOnlyTargetMap,
  getJumpContinuationSelection,
} from '@/app/store/createGameStore/selection';
import { createStoreTransitions } from '@/app/store/createGameStore/transitions';
import type {
  GameStoreState,
  InitialPersistenceState,
  StoreOptions,
} from '@/app/store/createGameStore/types';

type StoreSetter = (
  partial:
    | Partial<GameStoreState>
    | ((state: GameStoreState) => Partial<GameStoreState>),
) => void;

type CreateGameStoreStateRuntimeOptions = {
  archive: StoreOptions['archive'];
  initialPersistence: InitialPersistenceState;
  options: StoreOptions;
  storage?: Storage;
};

/** Builds the zustand state creator plus post-create boot hooks for one store instance. */
export function createGameStoreStateRuntime({
  archive,
  initialPersistence,
  options,
  storage,
}: CreateGameStoreStateRuntimeOptions) {
  const initialRuntimeState = createRuntimeState(initialPersistence.session);
  const { getBoardDerivation, getCellDerivation } = createDerivationCache();
  const initialBoardDerivation = getBoardDerivation(
    initialRuntimeState.gameState,
    initialRuntimeState.ruleConfig,
  );
  const initialJumpContinuation = getJumpContinuationSelection(initialRuntimeState.gameState);
  const initialInteraction = createInitialInteractionState(
    initialRuntimeState.gameState,
    initialJumpContinuation,
  );

  let persistInitialState: (() => void) | null = null;
  let startArchiveHydration: (() => void) | null = null;

  function stateCreator(set: StoreSetter, get: () => GameStoreState): GameStoreState {
    const persistenceRuntime = createPersistenceRuntime({
      archive: archive ?? null,
      createSessionId: options.createSessionId,
      initialPersistence,
      storage,
    });

    let transitions: ReturnType<typeof createStoreTransitions> | null = null;

    const aiController = createAiController({
      commitAction: (action, aiDecision) => {
        if (!transitions) {
          return;
        }

        transitions.commitAction(action, aiDecision);
      },
      get,
      options,
      set,
    });

    transitions = createStoreTransitions({
      consumeStartupHydrationOnMutation: persistenceRuntime.consumeStartupHydrationOnMutation,
      disposeAiWorker: aiController.disposeAiWorker,
      get,
      getBoardDerivation,
      persistRuntimeSession: persistenceRuntime.persistRuntimeSession,
      resetAiState: aiController.resetAiState,
      set,
      syncComputerTurn: aiController.syncComputerTurn,
      updateSessionMeta: persistenceRuntime.updateSessionMeta,
    });

    persistInitialState = () => {
      persistenceRuntime.persistInitialState(() =>
        buildSessionFromSlices(getSessionSlices(get())),
      );
    };

    startArchiveHydration = () => {
      persistenceRuntime.startArchiveHydration({
        applySession: transitions.applySession,
        onHydrationFallback: (historyHydrationStatus) => {
          set({ historyHydrationStatus });
        },
      });
    };

    return {
      ...initialRuntimeState,
      ...initialBoardDerivation,
      aiError: null,
      aiStatus: 'idle',
      historyHydrationStatus: initialPersistence.historyHydrationStatus,
      selectedCell: initialJumpContinuation?.source ?? null,
      selectedActionType: initialJumpContinuation ? 'jumpSequence' : null,
      selectedTargetMap: initialJumpContinuation
        ? createJumpOnlyTargetMap(initialJumpContinuation.targets)
        : createEmptyTargetMap(),
      availableActionKinds: initialJumpContinuation ? ['jumpSequence'] : [],
      draftJumpPath: [],
      legalTargets: initialJumpContinuation?.targets ?? [],
      interaction: initialInteraction,
      importBuffer: '',
      importError: null,
      lastAiDecision: null,
      pendingAiRequestId: null,
      exportBuffer: '',
      ...createPublicGameStoreActions({
        applyHistoryStep: transitions.applyHistoryStep,
        applySession: transitions.applySession,
        beginFreshFullSession: persistenceRuntime.beginFreshFullSession,
        commitAction: transitions.commitAction,
        consumeStartupHydrationOnMutation: persistenceRuntime.consumeStartupHydrationOnMutation,
        disposeAiWorker: aiController.disposeAiWorker,
        get,
        getBoardDerivation,
        getCellDerivation,
        persistCurrentState: transitions.persistCurrentState,
        resetAiState: aiController.resetAiState,
        set,
        syncComputerTurn: aiController.syncComputerTurn,
      }),
    };
  }

  function runPostCreate(store: StoreApi<GameStoreState>): void {
    queueMicrotask(() => {
      persistInitialState?.();
      startArchiveHydration?.();

      const state = store.getState();

      if (isComputerTurn(state.gameState, state.matchSettings)) {
        state.retryComputerMove();
      }
    });
  }

  return {
    runPostCreate,
    stateCreator,
  };
}
