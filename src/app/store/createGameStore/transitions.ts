import { applyAction, createUndoFrame, type TurnAction } from '@/domain';
import type { SerializableSession } from '@/shared/types/session';
import type { AiSearchResult } from '@/ai';
import type { InteractionState } from '@/shared/types/session';

import { getHistoryStepData } from '@/app/store/createGameStore/history';
import { isComputerMatch, isComputerTurn } from '@/app/store/createGameStore/match';
import {
  buildSessionFromSlices,
  createRuntimeState,
} from '@/app/store/createGameStore/session';
import {
  createIdleSelection,
  createSelectionState,
  createSelectionUpdate,
  getJumpContinuationSelection,
} from '@/app/store/createGameStore/selection';
import type {
  AiStatus,
  BoardDerivation,
  GameStoreData,
  GameStoreState,
  HistoryHydrationStatus,
  SessionSlices,
} from '@/app/store/createGameStore/types';

type StoreSetter = (
  partial:
    | Partial<GameStoreState>
    | ((state: GameStoreState) => Partial<GameStoreState>),
) => void;

type ApplySessionOptions = {
  historyHydrationStatus?: HistoryHydrationStatus;
  persist?: boolean;
  revision?: number;
  sessionId?: string;
};

type StoreTransitionsOptions = {
  consumeStartupHydrationOnMutation: () => HistoryHydrationStatus;
  disposeAiWorker: () => void;
  get: () => GameStoreState;
  getBoardDerivation: (
    gameState: GameStoreState['gameState'],
    ruleConfig: GameStoreState['ruleConfig'],
  ) => BoardDerivation;
  persistRuntimeSession: (
    session: SerializableSession,
    options?: {
      incrementRevision?: boolean;
      persistArchive?: boolean;
    },
  ) => void;
  resetAiState: (
    status?: AiStatus,
  ) => Pick<GameStoreData, 'aiError' | 'aiStatus' | 'pendingAiRequestId'>;
  set: StoreSetter;
  syncComputerTurn: () => void;
  updateSessionMeta: (options?: ApplySessionOptions) => HistoryHydrationStatus;
};

/** Creates store transitions that coordinate UI state around pure engine updates. */
export function createStoreTransitions({
  consumeStartupHydrationOnMutation,
  disposeAiWorker,
  get,
  getBoardDerivation,
  persistRuntimeSession,
  resetAiState,
  set,
  syncComputerTurn,
  updateSessionMeta,
}: StoreTransitionsOptions) {
  function persistCurrentState(nextState: SessionSlices): void {
    persistRuntimeSession(buildSessionFromSlices(nextState), {
      persistArchive: true,
    });
  }

  function commitAction(action: TurnAction, aiDecision: AiSearchResult | null = null): void {
    const state = get();
    const nextHistoryHydrationStatus = consumeStartupHydrationOnMutation();
    const nextGameState = applyAction(state.gameState, action, state.ruleConfig);
    const nextTurnLog = nextGameState.history;
    const nextPast = [...state.past, createUndoFrame(state.gameState)];
    const nextFuture: GameStoreState['future'] = [];
    const jumpContinuation = getJumpContinuationSelection(nextGameState);
    const computerMatch = isComputerMatch(state.matchSettings);
    const nextInteraction: InteractionState = jumpContinuation
      ? {
          type: 'buildingJumpChain',
          source: jumpContinuation.source,
          path: [],
          availableTargets: jumpContinuation.targets,
        }
      : nextGameState.status === 'gameOver'
        ? { type: 'gameOver' }
        : computerMatch
          ? { type: 'idle' }
          : state.preferences.passDeviceOverlayEnabled
            ? { type: 'passingDevice', nextPlayer: nextGameState.currentPlayer }
            : { type: 'turnResolved', nextPlayer: nextGameState.currentPlayer };
    const nextBoardDerivation = getBoardDerivation(nextGameState, state.ruleConfig);
    const nextData = {
      ruleConfig: state.ruleConfig,
      preferences: state.preferences,
      matchSettings: state.matchSettings,
      gameState: nextGameState,
      turnLog: nextTurnLog,
      past: nextPast,
      future: nextFuture,
      historyCursor: nextGameState.history.length,
      ...nextBoardDerivation,
    };

    set({
      ...nextData,
      historyHydrationStatus: nextHistoryHydrationStatus,
      ...(jumpContinuation
        ? createSelectionUpdate(nextGameState, jumpContinuation)
        : createSelectionState(null, null, nextInteraction)),
      ...resetAiState(),
      importError: null,
      lastAiDecision: aiDecision ?? state.lastAiDecision,
    });
    persistCurrentState(nextData);
    syncComputerTurn();

    if (
      !state.preferences.passDeviceOverlayEnabled &&
      nextGameState.status !== 'gameOver' &&
      !isComputerTurn(nextGameState, state.matchSettings)
    ) {
      queueMicrotask(() => {
        const latest = get();

        if (latest.interaction.type === 'turnResolved') {
          set({
            interaction: { type: 'idle' },
          });
        }
      });
    }
  }

  return {
    applyHistoryStep(direction: 'backward' | 'forward'): boolean {
      disposeAiWorker();
      const state = get();
      const nextHistoryHydrationStatus = consumeStartupHydrationOnMutation();
      const nextData = getHistoryStepData(state, direction, getBoardDerivation);

      if (!nextData) {
        return false;
      }

      set({
        ...nextData,
        historyHydrationStatus: nextHistoryHydrationStatus,
        ...createIdleSelection(nextData.gameState),
        ...resetAiState(),
      });
      persistCurrentState(nextData);
      syncComputerTurn();

      return true;
    },
    applySession(session: SerializableSession, options: ApplySessionOptions = {}): void {
      disposeAiWorker();
      const historyHydrationStatus = updateSessionMeta(options);
      const runtimeState = createRuntimeState(session);
      const nextBoardDerivation = getBoardDerivation(
        runtimeState.gameState,
        runtimeState.ruleConfig,
      );
      const jumpContinuation = getJumpContinuationSelection(runtimeState.gameState);

      set((current) => ({
        ...runtimeState,
        ...nextBoardDerivation,
        ...createSelectionUpdate(runtimeState.gameState, jumpContinuation),
        ...resetAiState(),
        historyHydrationStatus,
        lastAiDecision: null,
        importBuffer: '',
        importError: null,
        exportBuffer: current.exportBuffer,
      }));

      if (options.persist !== false) {
        persistRuntimeSession(session);
      }

      syncComputerTurn();
    },
    commitAction,
    persistCurrentState,
  };
}
