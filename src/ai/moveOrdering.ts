import {
  advanceEngineState,
  getLegalActions,
  type EngineState,
  type Player,
  type RuleConfig,
  type TurnAction,
} from '@/domain';
import { getCellHeight, getTopChecker } from '@/domain/model/board';
import { FRONT_HOME_ROW, HOME_ROWS } from '@/domain/model/constants';
import { getAdjacentCoord, getJumpDirection, parseCoord } from '@/domain/model/coordinates';
import type { AiDifficultyPreset } from '@/ai/types';

export type OrderedAction = {
  action: TurnAction;
  isTactical: boolean;
  nextState: EngineState;
  score: number;
};

export type OrderMovesOptions = {
  actions?: TurnAction[];
  deadline?: number;
  includeAllQuietMoves?: boolean;
  now?: () => number;
  pvMove?: TurnAction | null;
  ttMove?: TurnAction | null;
};

const AI_SEARCH_TIMEOUT = 'AI_SEARCH_TIMEOUT';

function throwIfTimedOut(deadline?: number, now?: () => number): void {
  if (deadline === undefined || !now) {
    return;
  }

  if (now() >= deadline) {
    throw new Error(AI_SEARCH_TIMEOUT);
  }
}

/** Serializes one action into a comparable key used for PV/TT move matching. */
function actionKey(action: TurnAction): string {
  switch (action.type) {
    case 'manualUnfreeze':
      return `${action.type}:${action.coord}`;
    case 'jumpSequence':
      return `${action.type}:${action.source}:${action.path.join('>')}`;
    default:
      return `${action.type}:${action.source}:${action.target}`;
  }
}

/** Matches previously preferred moves against freshly generated legal actions. */
function isSameAction(left: TurnAction | null | undefined, right: TurnAction): boolean {
  if (!left) {
    return false;
  }

  return actionKey(left) === actionKey(right);
}

/** Detects stack-building moves that directly improve a front-row scoring structure. */
function growsFrontRowStack(
  state: EngineState,
  action: TurnAction,
  nextState: EngineState,
  player: Player,
): boolean {
  if (action.type === 'manualUnfreeze') {
    return false;
  }

  const target = action.type === 'jumpSequence' ? action.path.at(-1) : action.target;

  if (!target) {
    return false;
  }

  const { row } = parseCoord(target);

  if (row !== FRONT_HOME_ROW[player]) {
    return false;
  }

  return getCellHeight(nextState.board, target) > getCellHeight(state.board, target);
}

/** Flags moves that push material into a player's home field. */
function improvesHomeField(action: TurnAction, player: Player): boolean {
  if (action.type === 'manualUnfreeze') {
    return false;
  }

  const target = action.type === 'jumpSequence' ? action.path.at(-1) : action.target;

  if (!target) {
    return false;
  }

  const { row } = parseCoord(target);

  return HOME_ROWS[player].has(row as never);
}

/** Returns a small positive bonus when the jump freezes an enemy or thaws an own frozen single. */
function getFreezeSwingBonus(state: EngineState, action: TurnAction, player: Player): number {
  if (action.type !== 'jumpSequence') {
    return 0;
  }

  const landing = action.path[0];
  const direction = landing ? getJumpDirection(action.source, landing) : null;
  const jumpedCoord = direction ? getAdjacentCoord(action.source, direction) : null;

  if (!jumpedCoord) {
    return 0;
  }

  const jumpedChecker = getTopChecker(state.board, jumpedCoord);

  if (!jumpedChecker) {
    return 0;
  }

  if (jumpedChecker.owner === player) {
    return jumpedChecker.frozen ? 1 : 0;
  }

  return jumpedChecker.frozen ? 0 : 1;
}

/** Orders moves for alpha-beta search and prunes quiet moves by preset breadth. */
export function orderMoves(
  state: EngineState,
  _perspectivePlayer: Player,
  ruleConfig: RuleConfig,
  preset: AiDifficultyPreset,
  {
    actions,
    deadline,
    includeAllQuietMoves = false,
    now,
    pvMove,
    ttMove,
  }: OrderMovesOptions = {},
): OrderedAction[] {
  const actor = state.currentPlayer;
  const ordered = (actions ?? getLegalActions(state, ruleConfig)).map<OrderedAction>((action) => {
    throwIfTimedOut(deadline, now);

    const nextState = advanceEngineState(state, action, ruleConfig);
    const winsImmediately =
      nextState.status === 'gameOver' &&
      (nextState.victory.type === 'homeField' || nextState.victory.type === 'sixStacks') &&
      nextState.victory.winner === actor;
    const frontRowGrowth = growsFrontRowStack(state, action, nextState, actor);
    const homeProgress = improvesHomeField(action, actor);
    const freezeSwingBonus = getFreezeSwingBonus(state, action, actor);
    const isTactical =
      winsImmediately ||
      action.type === 'jumpSequence' ||
      action.type === 'manualUnfreeze' ||
      frontRowGrowth ||
      homeProgress ||
      freezeSwingBonus > 0;

    let score = 0;

    if (isSameAction(ttMove, action)) {
      score += 200_000;
    }

    if (isSameAction(pvMove, action)) {
      score += 150_000;
    }

    if (winsImmediately) {
      score += 100_000;
    }

    if (action.type === 'jumpSequence') {
      score += 25_000;
    }

    if (action.type === 'manualUnfreeze') {
      score += 18_000;
    }

    if (frontRowGrowth) {
      score += 8_000;
    }

    if (homeProgress) {
      score += 4_000;
    }

    if (freezeSwingBonus > 0) {
      score += freezeSwingBonus * 2_000;
    }

    return {
      action,
      isTactical,
      nextState,
      score,
    };
  });

  ordered.sort((left, right) => right.score - left.score);

  if (includeAllQuietMoves) {
    return ordered;
  }

  // Harder difficulties search deeper and wider, but tactical moves are always preserved.
  const tacticalMoves = ordered.filter((entry) => entry.isTactical);
  const quietMoves = ordered
    .filter((entry) => !entry.isTactical)
    .slice(0, preset.quietMoveLimit);

  return [...tacticalMoves, ...quietMoves];
}
