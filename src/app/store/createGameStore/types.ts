import type { StoreApi } from 'zustand/vanilla';

import type { AiSearchResult, AiWorkerRequest, AiWorkerResponse } from '@/ai';
import type {
  ActionKind,
  Coord,
  GameState,
  RuleConfig,
  ScoreSummary,
  TargetMap,
  TurnRecord,
} from '@/domain';
import type {
  AppPreferences,
  InteractionState,
  MatchSettings,
  SerializableSession,
  UndoFrame,
} from '@/shared/types/session';

import type { SessionArchive } from '@/app/store/sessionArchive';

/** Store-local AI status used by the UI and worker lifecycle. */
export type AiStatus = 'idle' | 'thinking' | 'error';

/** Tracks how much of the archived history has been restored into the live store. */
export type HistoryHydrationStatus = 'hydrating' | 'recentOnly' | 'full';

/** Minimal worker contract used by the store and by tests. */
export type AiWorkerLike = {
  onerror: ((event: ErrorEvent) => void) | null;
  onmessage: ((event: MessageEvent<AiWorkerResponse>) => void) | null;
  postMessage: (message: AiWorkerRequest) => void;
  terminate: () => void;
};

/** Pure data slice stored in zustand before action methods are attached. */
export type GameStoreData = {
  aiError: string | null;
  aiStatus: AiStatus;
  ruleConfig: RuleConfig;
  preferences: AppPreferences;
  matchSettings: MatchSettings;
  setupMatchSettings: MatchSettings;
  gameState: GameState;
  turnLog: TurnRecord[];
  past: UndoFrame[];
  future: UndoFrame[];
  selectedCell: Coord | null;
  selectedActionType: ActionKind | null;
  selectedTargetMap: TargetMap;
  availableActionKinds: ActionKind[];
  draftJumpPath: Coord[];
  legalTargets: Coord[];
  selectableCoords: Coord[];
  scoreSummary: ScoreSummary | null;
  interaction: InteractionState;
  historyCursor: number;
  historyHydrationStatus: HistoryHydrationStatus;
  importBuffer: string;
  importError: string | null;
  lastAiDecision: AiSearchResult | null;
  pendingAiRequestId: number | null;
  exportBuffer: string;
};

/** Public store API consumed by the UI layer. */
export type GameStoreState = GameStoreData & {
  acknowledgePassScreen: () => void;
  cancelInteraction: () => void;
  chooseActionType: (actionType: ActionKind) => void;
  goToHistoryCursor: (targetCursor: number) => void;
  importSessionFromBuffer: () => void;
  redo: () => void;
  refreshExportBuffer: () => void;
  retryComputerMove: () => void;
  restart: () => void;
  selectCell: (coord: Coord) => void;
  setImportBuffer: (value: string) => void;
  setSetupMatchSettings: (partial: Partial<MatchSettings>) => void;
  setPreference: (partial: Partial<AppPreferences>) => void;
  setRuleConfig: (partial: Partial<RuleConfig>) => void;
  startNewGame: (matchSettings?: MatchSettings) => void;
  undo: () => void;
};

export type GameStore = StoreApi<GameStoreState>;

/** Factory options used by tests and the browser runtime. */
export type StoreOptions = {
  archive?: SessionArchive | null;
  createAiWorker?: () => AiWorkerLike | null;
  createSessionId?: () => string;
  initialSession?: SerializableSession;
  storage?: Storage;
};

/** Session fields persisted after every structural state transition. */
export type SessionSlices = Pick<
  GameStoreData,
  'ruleConfig' | 'preferences' | 'matchSettings' | 'gameState' | 'turnLog' | 'past' | 'future'
>;

/** Synchronous boot result before async archive hydration begins. */
export type InitialPersistenceState = {
  historyHydrationStatus: HistoryHydrationStatus;
  needsPersistenceSync: boolean;
  revision: number;
  session: SerializableSession;
  sessionId: string;
  startupHydrationMode: 'compact' | 'default' | null;
};

/** Shared shape returned by board-level derivation helpers. */
export type BoardDerivation = Pick<GameStoreData, 'selectableCoords' | 'scoreSummary'>;

/** Shared shape returned by selected-cell derivation helpers. */
export type CellDerivation = Pick<
  GameStoreData,
  'availableActionKinds' | 'selectedTargetMap'
>;

/** Shared selection slice used by helper builders and public actions. */
export type SelectionStateSlice = Pick<
  GameStoreData,
  | 'selectedCell'
  | 'selectedActionType'
  | 'selectedTargetMap'
  | 'availableActionKinds'
  | 'interaction'
  | 'legalTargets'
  | 'draftJumpPath'
>;

/** Forced-jump continuation state reconstructed from the engine. */
export type JumpContinuationSelection = {
  source: Coord;
  targets: Coord[];
};
