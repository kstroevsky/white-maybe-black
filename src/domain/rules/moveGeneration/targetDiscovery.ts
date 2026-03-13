import {
  getCellHeight,
  getController,
  getTopChecker,
  isEmptyCell,
  isStack,
} from '@/domain/model/board';
import { DIRECTION_VECTORS } from '@/domain/model/constants';
import {
  allCoords,
  getAdjacentCoord,
} from '@/domain/model/coordinates';
import { withRuleDefaults } from '@/domain/model/ruleConfig';
import type {
  Coord,
  EngineState,
  JumpSequenceAction,
  Player,
  RuleConfig,
  TurnAction,
} from '@/domain/model/types';
import {
  canLandOnOccupiedCell,
  isControlledStack,
  isFrozenSingle,
  isMovableSingle,
} from '@/domain/validators/stateValidators';

import { getJumpContinuationTargets } from '@/domain/rules/moveGeneration/jump';
import { buildTargetMap } from '@/domain/rules/moveGeneration/targetMap';
import type { TargetMap } from '@/domain/rules/moveGeneration/types';

/** Returns adjacent occupied targets that can accept one checker by climb. */
function getClimbTargets(board: EngineState['board'], source: Coord): Coord[] {
  return DIRECTION_VECTORS.flatMap((direction) => {
    const target = getAdjacentCoord(source, direction);

    if (!target || !canLandOnOccupiedCell(board, target)) {
      return [];
    }

    return [target];
  });
}

/** Returns adjacent empty targets used by one-step single-checker movement. */
function getSingleStepTargets(board: EngineState['board'], source: Coord): Coord[] {
  return DIRECTION_VECTORS.flatMap((direction) => {
    const target = getAdjacentCoord(source, direction);

    if (!target || !isEmptyCell(board, target)) {
      return [];
    }

    return [target];
  });
}

/** Returns adjacent empty cells used by stack split actions. */
function getSplitTargets(board: EngineState['board'], source: Coord): Coord[] {
  return DIRECTION_VECTORS.flatMap((direction) => {
    const target = getAdjacentCoord(source, direction);

    if (!target || !isEmptyCell(board, target)) {
      return [];
    }

    return [target];
  });
}

/** Returns legal same-owner stack transfer destinations under current rule config. */
function getFriendlyTransferTargets(
  board: EngineState['board'],
  source: Coord,
  player: Player,
  config: RuleConfig,
): Coord[] {
  if (!config.allowNonAdjacentFriendlyStackTransfer || !isControlledStack(board, source, player)) {
    return [];
  }

  return allCoords().filter((coord) => {
    if (coord === source) {
      return false;
    }

    return (
      isStack(board, coord) &&
      getController(board, coord) === player &&
      getCellHeight(board, coord) < 3
    );
  });
}

/** Returns legal target coordinates per action kind for one selected cell. */
export function getLegalTargetsForCell(
  state: Pick<EngineState, 'board' | 'currentPlayer' | 'pendingJump' | 'status'>,
  coord: Coord,
  config: Partial<RuleConfig> = {},
): TargetMap {
  return buildTargetMap(getLegalActionsForCell(state, coord, config));
}

/** Generates all legal actions for the current player from a specific coordinate. */
export function getLegalActionsForCell(
  state: Pick<EngineState, 'board' | 'currentPlayer' | 'pendingJump' | 'status'>,
  coord: Coord,
  config: Partial<RuleConfig> = {},
): TurnAction[] {
  const resolvedConfig = withRuleDefaults(config);

  if (state.status === 'gameOver') {
    return [];
  }

  if (isFrozenSingle(state.board, coord) && getTopChecker(state.board, coord)?.owner === state.currentPlayer) {
    return [{ type: 'manualUnfreeze', coord }];
  }

  const player = state.currentPlayer;
  const isPlayerSingle = isMovableSingle(state.board, coord, player);
  const isPlayerStack = isControlledStack(state.board, coord, player);

  if (!isPlayerSingle && !isPlayerStack) {
    return [];
  }

  const actions: TurnAction[] = [];

  actions.push(
    ...getJumpContinuationTargets(state, coord, []).map<JumpSequenceAction>((target) => ({
      type: 'jumpSequence',
      source: coord,
      path: [target],
    })),
  );

  const splitTargets = isPlayerStack ? getSplitTargets(state.board, coord) : [];

  actions.push(
    ...getClimbTargets(state.board, coord).map((target) => ({
      type: 'climbOne' as const,
      source: coord,
      target,
    })),
  );

  if (isPlayerSingle || isPlayerStack) {
    actions.push(
      ...getSingleStepTargets(state.board, coord).map((target) => ({
        type: 'moveSingleToEmpty' as const,
        source: coord,
        target,
      })),
    );
  }

  if (isPlayerStack) {
    actions.push(
      ...splitTargets.map((target) => ({
        type: 'splitOneFromStack' as const,
        source: coord,
        target,
      })),
    );

    if (getCellHeight(state.board, coord) >= 2) {
      actions.push(
        ...splitTargets.map((target) => ({
          type: 'splitTwoFromStack' as const,
          source: coord,
          target,
        })),
      );
    }

    actions.push(
      ...getFriendlyTransferTargets(state.board, coord, player, resolvedConfig).map((target) => ({
        type: 'friendlyStackTransfer' as const,
        source: coord,
        target,
      })),
    );
  }

  return actions;
}

/** Generates every legal action for the current player across the whole board. */
export function getLegalActions(
  state: Pick<EngineState, 'board' | 'currentPlayer' | 'pendingJump' | 'status'>,
  config: Partial<RuleConfig> = {},
): TurnAction[] {
  return allCoords().flatMap((coord) => getLegalActionsForCell(state, coord, config));
}
