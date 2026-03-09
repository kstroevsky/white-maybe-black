import { createEmptyBoard, createSnapshot } from '@/domain/model/board';
import { allCoords } from '@/domain/model/coordinates';
import { hashPosition } from '@/domain/model/hash';
import { withRuleDefaults } from '@/domain/model/ruleConfig';
import type {
  Board,
  Checker,
  Coord,
  GameState,
  Player,
  RuleConfig,
  StateSnapshot,
  TurnAction,
  TurnRecord,
  Victory,
} from '@/domain/model/types';
import { validateGameState } from '@/domain/validators/stateValidators';
import type {
  AppPreferences,
  DeserializedSession,
  SerializableSession,
  SerializableSessionV1,
  UndoFrame,
} from '@/shared/types/session';
import { isRecord } from '@/shared/utils/collections';

const COORD_SET = new Set(allCoords());

type SerializeSessionOptions = {
  pretty?: boolean;
};

/** Builds a lightweight undo frame from the current game state. */
export function createUndoFrame(state: GameState): UndoFrame {
  return {
    snapshot: createSnapshot(state),
    positionCounts: { ...state.positionCounts },
    historyCursor: state.history.length,
  };
}

/** Rehydrates runtime game state from a lightweight frame plus shared turn log. */
export function restoreGameState(frame: UndoFrame, turnLog: TurnRecord[]): GameState {
  return {
    ...frame.snapshot,
    history: turnLog.slice(0, frame.historyCursor),
    positionCounts: { ...frame.positionCounts },
  };
}

/** Runtime guard that narrows unknown payload to a valid player token. */
function assertPlayer(value: unknown, label: string): Player {
  if (value !== 'white' && value !== 'black') {
    throw new Error(`Invalid ${label}.`);
  }

  return value;
}

/** Runtime guard that validates coordinate values against board coordinates. */
function assertCoord(value: unknown, label: string): Coord {
  if (typeof value !== 'string' || !COORD_SET.has(value as Coord)) {
    throw new Error(`Invalid ${label}.`);
  }

  return value as Coord;
}

/** Runtime guard and normalizer for persisted victory payloads. */
function assertVictory(value: unknown): Victory {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new Error('Invalid victory state.');
  }

  switch (value.type) {
    case 'none':
    case 'threefoldDraw':
    case 'stalemateDraw':
      return { type: value.type };
    case 'homeField':
    case 'sixStacks':
      return {
        type: value.type,
        winner: assertPlayer(value.winner, 'victory winner'),
      };
    default:
      throw new Error('Unsupported victory state.');
  }
}

/** Runtime guard for rule config with fallback to current defaults. */
function assertRuleConfig(value: unknown): RuleConfig {
  if (!isRecord(value)) {
    throw new Error('Invalid rule config.');
  }

  return withRuleDefaults({
    allowNonAdjacentFriendlyStackTransfer:
      typeof value.allowNonAdjacentFriendlyStackTransfer === 'boolean'
        ? value.allowNonAdjacentFriendlyStackTransfer
        : undefined,
    drawRule:
      value.drawRule === 'none' || value.drawRule === 'threefold'
        ? value.drawRule
        : undefined,
    scoringMode:
      value.scoringMode === 'off' || value.scoringMode === 'basic'
        ? value.scoringMode
        : undefined,
  });
}

/** Runtime guard for app preferences, including legacy language migration. */
function assertPreferences(value: unknown): AppPreferences {
  if (!isRecord(value)) {
    throw new Error('Invalid preferences.');
  }

  const legacyLanguageMode =
    value.languageMode === 'english' ||
    value.languageMode === 'russian' ||
    value.languageMode === 'bilingual'
      ? value.languageMode
      : null;

  return {
    passDeviceOverlayEnabled:
      typeof value.passDeviceOverlayEnabled === 'boolean'
        ? value.passDeviceOverlayEnabled
        : true,
    language:
      value.language === 'english' || value.language === 'russian'
        ? value.language
        : legacyLanguageMode === 'english'
          ? 'english'
          : 'russian',
  };
}

/** Runtime guard for single checker payload. */
function assertChecker(value: unknown): Checker {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.frozen !== 'boolean') {
    throw new Error('Invalid checker.');
  }

  return {
    id: value.id,
    owner: assertPlayer(value.owner, 'checker owner'),
    frozen: value.frozen,
  };
}

/** Runtime guard for full board payload with per-cell checker parsing. */
function assertBoard(value: unknown): Board {
  if (!isRecord(value)) {
    throw new Error('Invalid board.');
  }

  const board = createEmptyBoard();

  for (const coord of allCoords()) {
    const rawCell = value[coord];

    if (!isRecord(rawCell) || !Array.isArray(rawCell.checkers)) {
      throw new Error(`Invalid cell at ${coord}.`);
    }

    board[coord] = {
      checkers: rawCell.checkers.map(assertChecker),
    };
  }

  return board;
}

/** Runtime guard for one serialized action union variant. */
function assertAction(value: unknown): TurnAction {
  if (!isRecord(value) || typeof value.type !== 'string') {
    throw new Error('Invalid action.');
  }

  switch (value.type) {
    case 'manualUnfreeze':
      return {
        type: 'manualUnfreeze',
        coord: assertCoord(value.coord, 'manualUnfreeze.coord'),
      };
    case 'jumpSequence':
      if (!Array.isArray(value.path)) {
        throw new Error('Invalid jump path.');
      }

      return {
        type: 'jumpSequence',
        source: assertCoord(value.source, 'jumpSequence.source'),
        path: value.path.map((entry, index) => assertCoord(entry, `jumpSequence.path[${index}]`)),
      };
    case 'climbOne':
    case 'splitOneFromStack':
    case 'splitTwoFromStack':
    case 'friendlyStackTransfer':
      return {
        type: value.type,
        source: assertCoord(value.source, `${value.type}.source`),
        target: assertCoord(value.target, `${value.type}.target`),
      };
    default:
      throw new Error('Unsupported action type.');
  }
}

/** Runtime guard for game snapshot records embedded in history. */
function assertStateSnapshot(value: unknown): StateSnapshot {
  if (!isRecord(value)) {
    throw new Error('Invalid state snapshot.');
  }

  return {
    board: assertBoard(value.board),
    currentPlayer: assertPlayer(value.currentPlayer, 'snapshot currentPlayer'),
    moveNumber:
      typeof value.moveNumber === 'number' && Number.isInteger(value.moveNumber) && value.moveNumber > 0
        ? value.moveNumber
        : 1,
    status: value.status === 'active' || value.status === 'gameOver' ? value.status : 'active',
    victory: assertVictory(value.victory),
  };
}

/** Runtime guard for one historical turn record. */
function assertTurnRecord(value: unknown): TurnRecord {
  if (!isRecord(value) || !Array.isArray(value.autoPasses)) {
    throw new Error('Invalid turn record.');
  }

  return {
    actor: assertPlayer(value.actor, 'turn record actor'),
    action: assertAction(value.action),
    beforeState: assertStateSnapshot(value.beforeState),
    afterState: assertStateSnapshot(value.afterState),
    autoPasses: value.autoPasses.map((entry, index) => assertPlayer(entry, `autoPasses[${index}]`)),
    victoryAfter: assertVictory(value.victoryAfter),
    positionHash: typeof value.positionHash === 'string' ? value.positionHash : '',
  };
}

/** Runtime guard for repetition counter map. */
function assertPositionCounts(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, number>>((counts, [key, entry]) => {
    if (typeof entry === 'number' && Number.isFinite(entry)) {
      counts[key] = entry;
    }
    return counts;
  }, {});
}

/** Increments a repetition counter entry for board+side-to-move state. */
function incrementPositionCount(
  counts: Record<string, number>,
  state: Pick<StateSnapshot, 'board' | 'currentPlayer'>,
): void {
  const positionHash = hashPosition(state);
  counts[positionHash] = (counts[positionHash] ?? 0) + 1;
}

/** Recomputes canonical hashes for turn records. */
function normalizeTurnLog(turnLog: TurnRecord[]): TurnRecord[] {
  return turnLog.map((record) => ({
    ...record,
    positionHash: hashPosition(record.afterState),
  }));
}

/** Rebuilds history hashes and position counts from canonical snapshots. */
function normalizeGameState(gameState: GameState): GameState {
  const history = normalizeTurnLog(gameState.history);
  const positionCounts: Record<string, number> = {};

  if (history.length) {
    incrementPositionCount(positionCounts, history[0].beforeState);

    for (const record of history) {
      incrementPositionCount(positionCounts, record.afterState);
    }
  } else {
    incrementPositionCount(positionCounts, gameState);
  }

  return {
    ...gameState,
    history,
    positionCounts,
  };
}

/** Runtime guard for complete game state plus invariant validation. */
function assertGameState(value: unknown): GameState {
  if (!isRecord(value) || !Array.isArray(value.history)) {
    throw new Error('Invalid game state.');
  }

  const gameState = normalizeGameState({
    ...assertStateSnapshot(value),
    history: value.history.map(assertTurnRecord),
    positionCounts: assertPositionCounts(value.positionCounts),
  });
  const validation = validateGameState(gameState);

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  return gameState;
}

/** Runtime guard for undo/redo state arrays. */
function assertGameStates(value: unknown): GameState[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected game states array.');
  }

  return value.map(assertGameState);
}

/** Runtime guard for lightweight undo/redo frame. */
function assertUndoFrame(value: unknown, turnLogLength: number): UndoFrame {
  if (!isRecord(value)) {
    throw new Error('Invalid undo frame.');
  }

  const historyCursor =
    typeof value.historyCursor === 'number' &&
    Number.isInteger(value.historyCursor) &&
    value.historyCursor >= 0 &&
    value.historyCursor <= turnLogLength
      ? value.historyCursor
      : null;

  if (historyCursor === null) {
    throw new Error('Invalid undo frame history cursor.');
  }

  return {
    snapshot: assertStateSnapshot(value.snapshot),
    positionCounts: assertPositionCounts(value.positionCounts),
    historyCursor,
  };
}

/** Runtime guard for shared turn log arrays. */
function assertTurnLog(value: unknown): TurnRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid turn log.');
  }

  return normalizeTurnLog(value.map(assertTurnRecord));
}

/** Validates one v2 frame by rehydrating runtime state. */
function assertValidFrame(frame: UndoFrame, turnLog: TurnRecord[]): UndoFrame {
  const validation = validateGameState(restoreGameState(frame, turnLog));

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  return frame;
}

/** Selects the longest historical action log available in a legacy v1 session. */
function getCanonicalTurnLog(states: GameState[]): TurnRecord[] {
  const longestState = states.reduce<GameState | null>((candidate, state) => {
    if (!candidate || state.history.length > candidate.history.length) {
      return state;
    }

    return candidate;
  }, null);

  return normalizeTurnLog(longestState?.history ?? []);
}

/** Converts legacy v1 session payloads into v2 storage shape. */
function migrateSession(session: SerializableSessionV1): SerializableSession {
  const turnLog = getCanonicalTurnLog([session.present, ...session.past, ...session.future]);

  return {
    version: 2,
    ruleConfig: session.ruleConfig,
    preferences: session.preferences,
    turnLog,
    present: createUndoFrame(session.present),
    past: session.past.map(createUndoFrame),
    future: session.future.map(createUndoFrame),
  };
}

/** Runtime guard for full v1 session payload. */
function assertLegacySession(value: unknown): SerializableSessionV1 {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error('Unsupported session payload.');
  }

  return {
    version: 1,
    ruleConfig: assertRuleConfig(value.ruleConfig),
    preferences: assertPreferences(value.preferences),
    present: assertGameState(value.present),
    past: assertGameStates(value.past),
    future: assertGameStates(value.future),
  };
}

/** Runtime guard for full v2 session payload. */
function assertSession(value: unknown): SerializableSession {
  if (!isRecord(value) || value.version !== 2) {
    throw new Error('Unsupported session payload.');
  }

  const turnLog = assertTurnLog(value.turnLog);
  const present = assertValidFrame(assertUndoFrame(value.present, turnLog.length), turnLog);

  if (!Array.isArray(value.past) || !Array.isArray(value.future)) {
    throw new Error('Invalid session history frames.');
  }

  return {
    version: 2,
    ruleConfig: assertRuleConfig(value.ruleConfig),
    preferences: assertPreferences(value.preferences),
    turnLog,
    present,
    past: value.past.map((entry) => assertValidFrame(assertUndoFrame(entry, turnLog.length), turnLog)),
    future: value.future.map((entry) => assertValidFrame(assertUndoFrame(entry, turnLog.length), turnLog)),
  };
}

/** Serializes full session payload for local persistence and export. */
export function serializeSession(
  session: SerializableSession,
  options: SerializeSessionOptions = {},
): string {
  return JSON.stringify(session, null, options.pretty ? 2 : undefined);
}

/** Deserializes session JSON and normalizes every payload to the v2 session shape. */
export function deserializeSession(serialized: string): SerializableSession {
  const parsed = JSON.parse(serialized) as unknown;
  const session: DeserializedSession =
    isRecord(parsed) && parsed.version === 1
      ? assertLegacySession(parsed)
      : assertSession(parsed);

  return session.version === 1 ? migrateSession(session) : session;
}
