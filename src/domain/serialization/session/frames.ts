import { createSnapshot } from '@/domain/model/board';
import type { GameState, TurnRecord } from '@/domain/model/types';
import type { UndoFrame } from '@/shared/types/session';

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
