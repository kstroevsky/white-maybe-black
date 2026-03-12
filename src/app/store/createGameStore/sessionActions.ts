import { checkVictory, createInitialState, deserializeSession, serializeSession, withRuleDefaults } from '@/domain';

import { getRuleConfigForNewMatch } from '@/app/store/createGameStore/match';
import { buildSessionFromSlices } from '@/app/store/createGameStore/session';
import { createIdleSelection } from '@/app/store/createGameStore/selection';
import type { GameStoreState } from '@/app/store/createGameStore/types';

import type { PublicActionsOptions } from '@/app/store/createGameStore/publicActionTypes';

/** Creates public actions that mutate persisted session, rules, and setup state. */
export function createSessionActions({
  applySession,
  beginFreshFullSession,
  consumeStartupHydrationOnMutation,
  disposeAiWorker,
  get,
  getBoardDerivation,
  persistCurrentState,
  resetAiState,
  set,
  syncComputerTurn,
}: PublicActionsOptions): Pick<
  GameStoreState,
  | 'importSessionFromBuffer'
  | 'refreshExportBuffer'
  | 'setImportBuffer'
  | 'setPreference'
  | 'setRuleConfig'
  | 'setSetupMatchSettings'
  | 'startNewGame'
> {
  return {
    importSessionFromBuffer: () => {
      const state = get();

      try {
        const session = deserializeSession(state.importBuffer);
        const nextHistoryHydrationStatus = beginFreshFullSession();
        applySession(session, {
          historyHydrationStatus: nextHistoryHydrationStatus,
        });
      } catch {
        set({
          importError: 'importFailed',
        });
      }
    },
    refreshExportBuffer: () => {
      const state = get();
      set({
        exportBuffer: serializeSession(buildSessionFromSlices(state), { pretty: true }),
      });
    },
    setImportBuffer: (value) => {
      set({ importBuffer: value });
    },
    setPreference: (partial) => {
      const state = get();
      const nextHistoryHydrationStatus = consumeStartupHydrationOnMutation();
      const preferences = {
        ...state.preferences,
        ...partial,
      };
      const nextData = {
        ruleConfig: state.ruleConfig,
        preferences,
        matchSettings: state.matchSettings,
        gameState: state.gameState,
        turnLog: state.turnLog,
        past: state.past,
        future: state.future,
      };

      set({
        historyHydrationStatus: nextHistoryHydrationStatus,
        preferences,
        interaction:
          !preferences.passDeviceOverlayEnabled && state.interaction.type === 'passingDevice'
            ? { type: 'idle' }
            : state.interaction,
      });
      persistCurrentState(nextData);
    },
    setRuleConfig: (partial) => {
      disposeAiWorker();
      const state = get();
      const nextHistoryHydrationStatus = consumeStartupHydrationOnMutation();
      const ruleConfig = withRuleDefaults({
        ...state.ruleConfig,
        ...partial,
      });
      let nextGameState = state.gameState;

      if (nextGameState.status === 'active') {
        const victory = checkVictory(nextGameState, ruleConfig);

        if (victory.type !== 'none') {
          nextGameState = {
            ...nextGameState,
            pendingJump: null,
            status: 'gameOver',
            victory,
          };
        }
      }

      const nextData = {
        ruleConfig,
        preferences: state.preferences,
        matchSettings: state.matchSettings,
        gameState: nextGameState,
        turnLog: state.turnLog,
        past: state.past,
        future: state.future,
        historyCursor: nextGameState.history.length,
        ...getBoardDerivation(nextGameState, ruleConfig),
      };

      set({
        ...nextData,
        historyHydrationStatus: nextHistoryHydrationStatus,
        ...createIdleSelection(nextGameState),
        ...resetAiState(),
      });
      persistCurrentState(nextData);
      syncComputerTurn();
    },
    setSetupMatchSettings: (partial) => {
      const state = get();

      set({
        setupMatchSettings: {
          ...state.setupMatchSettings,
          ...partial,
        },
      });
    },
    startNewGame: (matchSettings = get().setupMatchSettings) => {
      disposeAiWorker();
      const state = get();
      const nextHistoryHydrationStatus = beginFreshFullSession();
      const nextRuleConfig = getRuleConfigForNewMatch(state.ruleConfig, matchSettings);
      const nextGameState = createInitialState(nextRuleConfig);
      const nextData = {
        ruleConfig: nextRuleConfig,
        preferences: state.preferences,
        matchSettings,
        gameState: nextGameState,
        turnLog: [],
        past: [],
        future: [],
        historyCursor: 0,
        ...getBoardDerivation(nextGameState, nextRuleConfig),
      };

      set({
        ...nextData,
        historyHydrationStatus: nextHistoryHydrationStatus,
        ...createIdleSelection(nextGameState),
        ...resetAiState(),
        importBuffer: '',
        importError: null,
        lastAiDecision: null,
        setupMatchSettings: matchSettings,
      });
      persistCurrentState(nextData);
      syncComputerTurn();
    },
  };
}
