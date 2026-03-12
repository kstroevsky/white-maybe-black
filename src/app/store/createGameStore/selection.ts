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
  JumpContinuationSelection,
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

/** Restricts the target map to the currently forced jump continuation. */
export function createJumpOnlyTargetMap(targets: Coord[]): TargetMap {
  const targetMap = createEmptyTargetMap();
  targetMap.jumpSequence = targets.slice();
  return targetMap;
}

/** Detects whether the active player must continue a jump chain. */
export function getJumpContinuationSelection(
  gameState: GameState,
): JumpContinuationSelection | null {
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

/** Rebuilds the selection state for a forced jump continuation. */
export function createJumpContinuationState(
  source: Coord,
  targets: Coord[],
): SelectionStateSlice {
  return createSelectionState(
    source,
    'jumpSequence',
    {
      type: 'buildingJumpChain',
      source,
      path: [],
      availableTargets: targets,
    },
    {
      legalTargets: targets,
      draftJumpPath: [],
      availableActionKinds: ['jumpSequence'],
      selectedTargetMap: createJumpOnlyTargetMap(targets),
    },
  );
}

/** Creates the initial interaction state used during store boot. */
export function createInitialInteractionState(
  gameState: GameState,
  jumpContinuation: JumpContinuationSelection | null,
): InteractionState {
  if (jumpContinuation) {
    return {
      type: 'buildingJumpChain',
      source: jumpContinuation.source,
      path: [],
      availableTargets: jumpContinuation.targets,
    };
  }

  return gameState.status === 'gameOver' ? { type: 'gameOver' } : { type: 'idle' };
}

/** Applies either forced-jump or neutral selection state to a payload. */
export function createSelectionUpdate(
  gameState: GameState,
  jumpContinuation: JumpContinuationSelection | null,
): SelectionStateSlice {
  if (!jumpContinuation) {
    return createIdleSelection(gameState);
  }

  return createJumpContinuationState(jumpContinuation.source, jumpContinuation.targets);
}
