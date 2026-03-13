import {
  createEmptyTargetMap,
  getJumpContinuationTargets,
  type ActionKind,
  type Coord,
  type GameState,
  type TargetMap,
} from '@/domain';
import { uniqueValues } from '@/shared/utils/collections';
import type { InteractionState } from '@/shared/types/session';

import type {
  GameStoreData,
  JumpFollowUpSelection,
  SelectionStateSlice,
} from '@/app/store/createGameStore/types';

/** Builds the selection/interaction slice in one place to keep updates consistent. */
export function createSelectionState(
  source: Coord | null,
  actionType: ActionKind | null,
  interaction: InteractionState,
  options: {
    legalTargets?: Coord[];
    draftJumpPath?: Coord[];
    availableActionKinds?: ActionKind[];
    selectedTargetMap?: TargetMap;
  } = {},
): SelectionStateSlice {
  return {
    selectedCell: source,
    selectedActionType: actionType,
    selectedTargetMap: options.selectedTargetMap ?? createEmptyTargetMap(),
    availableActionKinds: options.availableActionKinds ?? [],
    interaction,
    legalTargets: options.legalTargets ?? [],
    draftJumpPath: options.draftJumpPath ?? [],
  };
}

/** Returns the neutral selection state for the current game status. */
export function createIdleSelection(
  gameState: Pick<GameState, 'status'>,
): SelectionStateSlice {
  return createSelectionState(
    null,
    null,
    gameState.status === 'gameOver' ? { type: 'gameOver' } : { type: 'idle' },
  );
}

/** Restricts the target map to the currently selected jump landing options. */
export function createJumpOnlyTargetMap(targets: Coord[]): TargetMap {
  const targetMap = createEmptyTargetMap();
  targetMap.jumpSequence = targets.slice();
  return targetMap;
}

/** Detects whether the active player has an optional post-jump follow-up move. */
export function getJumpFollowUpSelection(
  gameState: GameState,
): JumpFollowUpSelection | null {
  if (gameState.status === 'gameOver' || !gameState.pendingJump) {
    return null;
  }

  const targets = uniqueValues(
    getJumpContinuationTargets(gameState, gameState.pendingJump.source, []),
  );

  if (!targets.length) {
    return null;
  }

  return {
    source: gameState.pendingJump.source,
    targets,
  };
}

/** Rebuilds the neutral selection state for an optional post-jump follow-up. */
export function createJumpFollowUpState(
  source: Coord,
  targets: Coord[],
): SelectionStateSlice {
  return createSelectionState(
    null,
    null,
    {
      type: 'jumpFollowUp',
      source,
      availableTargets: targets,
    },
  );
}

/** Creates the initial interaction state used during store boot. */
export function createInitialInteractionState(
  gameState: GameState,
  jumpFollowUp: JumpFollowUpSelection | null,
): InteractionState {
  if (jumpFollowUp) {
    return {
      type: 'jumpFollowUp',
      source: jumpFollowUp.source,
      availableTargets: jumpFollowUp.targets,
    };
  }

  return gameState.status === 'gameOver' ? { type: 'gameOver' } : { type: 'idle' };
}

/** Applies either forced-jump or neutral selection state to a payload. */
export function createSelectionUpdate(
  gameState: GameState,
  jumpFollowUp: JumpFollowUpSelection | null,
): SelectionStateSlice {
  if (!jumpFollowUp) {
    return createIdleSelection(gameState);
  }

  return createJumpFollowUpState(jumpFollowUp.source, jumpFollowUp.targets);
}
