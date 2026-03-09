import {
  addCheckers,
  cloneBoard,
  getCellHeight,
  getController,
  getTopChecker,
  isEmptyCell,
  isStack,
  removeTopCheckers,
  setSingleCheckerFrozen,
} from '@/domain/model/board';
import { DIRECTION_VECTORS } from '@/domain/model/constants';
import {
  allCoords,
  getAdjacentCoord,
  getJumpDirection,
  getJumpLandingCoord,
} from '@/domain/model/coordinates';
import { hashBoard } from '@/domain/model/hash';
import { withRuleDefaults } from '@/domain/model/ruleConfig';
import type {
  ActionKind,
  Board,
  Coord,
  GameState,
  JumpSequenceAction,
  Player,
  RuleConfig,
  TurnAction,
  ValidationResult,
} from '@/domain/model/types';
import {
  canJumpOverCell,
  canLandOnOccupiedCell,
  isControlledStack,
  isFrozenSingle,
  isMovableSingle,
  validateBoard,
} from '@/domain/validators/stateValidators';

type PartialJumpResolution = {
  board: Board;
  currentCoord: Coord;
  visited: Set<string>;
};

type TargetMap = Record<ActionKind, Coord[]>;

/** Builds unique key for jump-loop prevention (coord + full board state). */
function createJumpStateKey(coord: Coord, board: Board): string {
  return `${coord}::${hashBoard(board)}`;
}

/** Returns owner of the top checker at source coordinate. */
function getMovingPlayer(board: Board, source: Coord): Player | null {
  return getTopChecker(board, source)?.owner ?? null;
}

/** Jumping from stacks moves whole stack as one unit. */
function isWholeStackJump(board: Board, source: Coord): boolean {
  return isStack(board, source);
}

/** Applies one jump segment, including freeze/unfreeze side effects on jumped checker. */
function applySingleJumpSegment(board: Board, source: Coord, landing: Coord, movingPlayer: Player): ValidationResult {
  const direction = getJumpDirection(source, landing);

  if (!direction) {
    return { valid: false, reason: `Target ${landing} is not a legal jump landing from ${source}.` };
  }

  const middleCoord = getAdjacentCoord(source, direction);

  if (!middleCoord) {
    return { valid: false, reason: 'Jump segment has no middle coordinate.' };
  }

  if (!canJumpOverCell(board, movingPlayer, middleCoord)) {
    return { valid: false, reason: `Cannot jump over ${middleCoord}.` };
  }

  if (!isEmptyCell(board, landing)) {
    return { valid: false, reason: `Jump landing ${landing} must be empty.` };
  }

  const movingCount = isWholeStackJump(board, source) ? getCellHeight(board, source) : 1;
  const movingCheckers = removeTopCheckers(board, source, movingCount);

  addCheckers(board, landing, movingCheckers);

  const middleChecker = getTopChecker(board, middleCoord);

  if (!middleChecker) {
    return { valid: false, reason: `Middle checker missing at ${middleCoord}.` };
  }

  if (middleChecker.owner !== movingPlayer) {
    setSingleCheckerFrozen(board, middleCoord, true);
  } else if (middleChecker.frozen) {
    setSingleCheckerFrozen(board, middleCoord, false);
  }

  return validateBoard(board);
}

/** Resolves an entire jump path and blocks repetition of a prior jump state. */
function resolveJumpPath(
  board: Board,
  source: Coord,
  path: Coord[],
  movingPlayer: Player,
  visitedSeed?: Set<string>,
): ValidationResult | PartialJumpResolution {
  const nextBoard = cloneBoard(board);
  let currentCoord = source;
  const visited = new Set(visitedSeed ?? []);

  if (!visited.size) {
    visited.add(createJumpStateKey(source, board));
  }

  for (const landing of path) {
    const stepResult = applySingleJumpSegment(nextBoard, currentCoord, landing, movingPlayer);

    if (!stepResult.valid) {
      return stepResult;
    }

    currentCoord = landing;
    const stateKey = createJumpStateKey(currentCoord, nextBoard);

    if (visited.has(stateKey)) {
      return {
        valid: false,
        reason: `Jump path repeats a previous position at ${landing}.`,
      };
    }

    visited.add(stateKey);
  }

  return {
    board: nextBoard,
    currentCoord,
    visited,
  };
}

/** Returns immediate legal jump landings from a coordinate on a specific board. */
function getJumpTargetsOnBoard(board: Board, source: Coord, movingPlayer: Player): Coord[] {
  return DIRECTION_VECTORS.flatMap((direction) => {
    const jumpedCoord = getAdjacentCoord(source, direction);
    const landingCoord = getJumpLandingCoord(source, direction);

    if (!jumpedCoord || !landingCoord) {
      return [];
    }

    if (!canJumpOverCell(board, movingPlayer, jumpedCoord)) {
      return [];
    }

    if (!isEmptyCell(board, landingCoord)) {
      return [];
    }

    return [landingCoord];
  });
}

/** Returns adjacent occupied targets that can accept one checker by climb. */
function getClimbTargets(board: Board, source: Coord): Coord[] {
  return DIRECTION_VECTORS.flatMap((direction) => {
    const target = getAdjacentCoord(source, direction);

    if (!target || !canLandOnOccupiedCell(board, target)) {
      return [];
    }

    return [target];
  });
}

/** Returns adjacent empty cells used by stack split actions. */
function getSplitTargets(board: Board, source: Coord): Coord[] {
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
  board: Board,
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

/** Recursively enumerates all legal jump sequences from a source coordinate. */
function collectJumpSequences(
  board: Board,
  source: Coord,
  movingPlayer: Player,
  path: Coord[],
  visited: Set<string>,
): JumpSequenceAction[] {
  const actions: JumpSequenceAction[] = path.length
    ? [{ type: 'jumpSequence', source, path }]
    : [];
  const currentCoord = path.at(-1) ?? source;
  const targets = getJumpTargetsOnBoard(board, currentCoord, movingPlayer);

  for (const target of targets) {
    const result = resolveJumpPath(board, currentCoord, [target], movingPlayer, visited);

    if (!('board' in result)) {
      continue;
    }

    actions.push(
      ...collectJumpSequences(result.board, source, movingPlayer, [...path, target], result.visited),
    );
  }

  return actions;
}

/** Returns next legal jump targets when the UI is building a multi-jump path. */
export function getJumpContinuationTargets(
  state: GameState,
  source: Coord,
  draftPath: Coord[],
): Coord[] {
  const movingPlayer = getMovingPlayer(state.board, source);

  if (!movingPlayer) {
    return [];
  }

  let currentCoord = source;
  let currentBoard = cloneBoard(state.board);
  let visited = new Set<string>([createJumpStateKey(source, state.board)]);

  for (const landing of draftPath) {
    const partial = resolveJumpPath(currentBoard, currentCoord, [landing], movingPlayer, visited);

    if (!('board' in partial)) {
      return [];
    }

    currentBoard = partial.board;
    currentCoord = partial.currentCoord;
    visited = partial.visited;
  }

  // Filter out landings that would immediately create an invalid repeated jump state.
  return getJumpTargetsOnBoard(currentBoard, currentCoord, movingPlayer).filter((target) => {
    const resolution = resolveJumpPath(currentBoard, currentCoord, [target], movingPlayer, visited);

    if (!('board' in resolution)) {
      return false;
    }

    return true;
  });
}

/** Groups legal actions by kind into UI-ready target buckets. */
function buildTargetMap(actions: TurnAction[]): TargetMap {
  return actions.reduce<TargetMap>(
    (map, action) => {
      switch (action.type) {
        case 'manualUnfreeze':
          return map;
        case 'jumpSequence':
          map.jumpSequence.push(action.path[0]);
          return map;
        default:
          map[action.type].push(action.target);
          return map;
      }
    },
    {
      jumpSequence: [],
      manualUnfreeze: [],
      climbOne: [],
      splitOneFromStack: [],
      splitTwoFromStack: [],
      friendlyStackTransfer: [],
    },
  );
}

/** Returns legal target coordinates per action kind for one selected cell. */
export function getLegalTargetsForCell(
  state: GameState,
  coord: Coord,
  config: Partial<RuleConfig> = {},
): TargetMap {
  return buildTargetMap(getLegalActionsForCell(state, coord, config));
}

/** Generates all legal actions for the current player from a specific coordinate. */
export function getLegalActionsForCell(
  state: GameState,
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
  const movingPlayer = getMovingPlayer(state.board, coord);

  if (movingPlayer) {
    actions.push(
      ...collectJumpSequences(
        state.board,
        coord,
        movingPlayer,
        [],
        new Set([createJumpStateKey(coord, state.board)]),
      ),
    );
  }

  actions.push(
    ...getClimbTargets(state.board, coord).map((target) => ({
      type: 'climbOne' as const,
      source: coord,
      target,
    })),
  );

  if (isPlayerStack) {
    actions.push(
      ...getSplitTargets(state.board, coord).map((target) => ({
        type: 'splitOneFromStack' as const,
        source: coord,
        target,
      })),
    );

    if (getCellHeight(state.board, coord) >= 2) {
      actions.push(
        ...getSplitTargets(state.board, coord).map((target) => ({
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
  state: GameState,
  config: Partial<RuleConfig> = {},
): TurnAction[] {
  return allCoords().flatMap((coord) => getLegalActionsForCell(state, coord, config));
}

/** Lightweight structural equality for action matching in validator checks. */
function actionsEqual(left: TurnAction, right: TurnAction): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Shared source ownership validation for action variants with a source coordinate. */
function validateCommonSource(
  state: GameState,
  source: Coord,
  player: Player,
): ValidationResult {
  const topChecker = getTopChecker(state.board, source);

  if (!topChecker) {
    return { valid: false, reason: `No checker at ${source}.` };
  }

  if (topChecker.owner !== player) {
    return { valid: false, reason: `Source ${source} is not controlled by ${player}.` };
  }

  return { valid: true };
}

/** Validates action legality against current state and optional rule configuration. */
export function validateAction(
  state: GameState,
  action: TurnAction,
  config: Partial<RuleConfig> = {},
): ValidationResult {
  if (state.status === 'gameOver') {
    return { valid: false, reason: 'The game is already over.' };
  }

  switch (action.type) {
    case 'manualUnfreeze': {
      if (!isFrozenSingle(state.board, action.coord)) {
        return { valid: false, reason: `${action.coord} is not a frozen single checker.` };
      }

      if (getTopChecker(state.board, action.coord)?.owner !== state.currentPlayer) {
        return { valid: false, reason: 'Only the owner may manually unfreeze a checker.' };
      }

      return { valid: true };
    }
    case 'jumpSequence': {
      const sourceValidation = validateCommonSource(state, action.source, state.currentPlayer);

      if (!sourceValidation.valid) {
        return sourceValidation;
      }

      if (!action.path.length) {
        return { valid: false, reason: 'Jump sequence must contain at least one landing.' };
      }

      const sourceTopChecker = getTopChecker(state.board, action.source);

      if (!sourceTopChecker || sourceTopChecker.frozen) {
        return { valid: false, reason: 'Frozen single checkers cannot jump.' };
      }

      const movingPlayer = sourceTopChecker.owner;
      const resolution = resolveJumpPath(
        state.board,
        action.source,
        action.path,
        movingPlayer,
        new Set([createJumpStateKey(action.source, state.board)]),
      );

      if (!('board' in resolution)) {
        return resolution;
      }

      return { valid: true };
    }
    case 'climbOne':
    case 'splitOneFromStack':
    case 'splitTwoFromStack':
    case 'friendlyStackTransfer': {
      const sourceValidation = validateCommonSource(state, action.source, state.currentPlayer);

      if (!sourceValidation.valid) {
        return sourceValidation;
      }

      const legalAction = getLegalActionsForCell(state, action.source, config).find((candidate) =>
        actionsEqual(candidate, action),
      );

      return legalAction
        ? { valid: true }
        : { valid: false, reason: `Illegal ${action.type} from ${action.source} to ${action.target}.` };
    }
  }
}

/** Applies a validated action and returns next board state (or validation error). */
export function applyActionToBoard(
  state: GameState,
  action: TurnAction,
  config: Partial<RuleConfig> = {},
): ValidationResult | Board {
  const resolvedConfig = withRuleDefaults(config);
  const validation = validateAction(state, action, resolvedConfig);

  if (!validation.valid) {
    return validation;
  }

  const board = cloneBoard(state.board);

  switch (action.type) {
    case 'manualUnfreeze':
      setSingleCheckerFrozen(board, action.coord, false);
      return board;
    case 'jumpSequence': {
      const movingPlayer = getMovingPlayer(board, action.source);

      if (!movingPlayer) {
        return { valid: false, reason: `No moving player found at ${action.source}.` };
      }

      const result = resolveJumpPath(board, action.source, action.path, movingPlayer);

      return 'board' in result ? result.board : result;
    }
    case 'climbOne': {
      const movingCheckers = removeTopCheckers(
        board,
        action.source,
        isStack(board, action.source) ? 1 : 1,
      );
      addCheckers(board, action.target, movingCheckers);
      return board;
    }
    case 'splitOneFromStack': {
      const movingCheckers = removeTopCheckers(board, action.source, 1);
      addCheckers(board, action.target, movingCheckers);
      return board;
    }
    case 'splitTwoFromStack': {
      const movingCheckers = removeTopCheckers(board, action.source, 2);
      addCheckers(board, action.target, movingCheckers);
      return board;
    }
    case 'friendlyStackTransfer': {
      const movingCheckers = removeTopCheckers(board, action.source, 1);
      addCheckers(board, action.target, movingCheckers);
      return board;
    }
  }
}
