import { hashPosition } from '@/domain/model/hash';
import type { GameState, StateSnapshot, TurnRecord } from '@/domain/model/types';
import { validateGameState } from '@/domain/validators/stateValidators';
import type { UndoFrame } from '@/shared/types/session';

import { restoreGameState } from '@/domain/serialization/session/frames';
import {
  assertPositionCounts,
  assertStateSnapshot,
  assertTurnRecord,
} from '@/domain/serialization/session/guards';
import { isRecord } from '@/shared/utils/collections';

/** Increments a repetition counter entry for board+side-to-move state. */
function incrementPositionCount(
  counts: Record<string, number>,
  state: Pick<StateSnapshot, 'board' | 'currentPlayer' | 'pendingJump'>,
): void {
  const positionHash = hashPosition(state);
  counts[positionHash] = (counts[positionHash] ?? 0) + 1;
}

/** Recomputes canonical hashes for turn records. */
export function normalizeTurnLog(turnLog: TurnRecord[]): TurnRecord[] {
  return turnLog.map((record) => ({
    ...record,
    positionHash: hashPosition(record.afterState),
  }));
}

/** Rebuilds history hashes and position counts from canonical snapshots. */
export function normalizeGameState(gameState: GameState): GameState {
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
export function assertGameState(value: unknown): GameState {
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
export function assertGameStates(value: unknown): GameState[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected game states array.');
  }

  return value.map(assertGameState);
}

/** Runtime guard for lightweight undo/redo frame. */
export function assertUndoFrame(value: unknown, turnLogLength: number): UndoFrame {
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
export function assertTurnLog(value: unknown): TurnRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid turn log.');
  }

  return normalizeTurnLog(value.map(assertTurnRecord));
}

/** Validates one v2/v3 frame by rehydrating runtime state. */
export function assertValidFrame(frame: UndoFrame, turnLog: TurnRecord[]): UndoFrame {
  const validation = validateGameState(restoreGameState(frame, turnLog));

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  return frame;
}

/** Selects the longest historical action log available in a legacy v1 session. */
export function getCanonicalTurnLog(states: GameState[]): TurnRecord[] {
  const longestState = states.reduce<GameState | null>((candidate, state) => {
    if (!candidate || state.history.length > candidate.history.length) {
      return state;
    }

    return candidate;
  }, null);

  return normalizeTurnLog(longestState?.history ?? []);
}
