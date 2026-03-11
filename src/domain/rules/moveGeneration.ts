import {
  addCheckers,
  cloneBoardStructure,
  ensureMutableCell,
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
  EngineState,
  GameState,
  JumpSequenceAction,
  PendingJump,
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

export type AppliedActionState = {
  board: Board;
  pendingJump: PendingJump | null;
};

export type TargetMap = Record<ActionKind, Coord[]>;

/** Creates empty per-action target buckets used by UI state and selectors. */
export function createEmptyTargetMap(): TargetMap {
  return {
    jumpSequence: [],
    manualUnfreeze: [],
    climbOne: [],
    moveSingleToEmpty: [],
    splitOneFromStack: [],
    splitTwoFromStack: [],
    friendlyStackTransfer: [],
  };
}

/** Builds unique key for jump-loop prevention (coord + full board state). */
export function createJumpStateKey(coord: Coord, board: Board): string {
  return `${coord}::${hashBoard(board)}`;
}

/** Rebuilds visited jump states from a committed chain when history is available. */
function getCommittedJumpVisitedStates(
  state: Pick<GameState, 'history'>,
  source: Coord,
  movingPlayer: Player,
): Set<string> {
  const chain: Array<Extract<TurnAction, { type: 'jumpSequence' }> & {
    beforeBoard: Board;
    afterBoard: Board;
  }> = [];
  let expectedLanding = source;

  for (let index = state.history.length - 1; index >= 0; index -= 1) {
    const record = state.history[index];

    if (record.actor !== movingPlayer || record.action.type !== 'jumpSequence') {
      break;
    }

    const landing = record.action.path.at(-1);

    if (!landing || landing !== expectedLanding) {
      break;
    }

    chain.push({
      ...record.action,
      beforeBoard: record.beforeState.board,
      afterBoard: record.afterState.board,
    });
    expectedLanding = record.action.source;
  }

  if (!chain.length) {
    return new Set();
  }

  const visited = new Set<string>();
  const orderedChain = chain.reverse();
  const chainStart = orderedChain[0];

  visited.add(createJumpStateKey(chainStart.source, chainStart.beforeBoard));

  for (const segment of orderedChain) {
    const landing = segment.path.at(-1);

    if (!landing) {
      continue;
    }

    visited.add(createJumpStateKey(landing, segment.afterBoard));
  }

  return visited;
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
function applySingleJumpSegment(
  board: Board,
  source: Coord,
  landing: Coord,
  movingPlayer: Player,
  clonedCoords: Set<Coord>,
): ValidationResult {
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

  ensureMutableCell(board, source, clonedCoords);
  ensureMutableCell(board, landing, clonedCoords);
  ensureMutableCell(board, middleCoord, clonedCoords);

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
  const nextBoard = cloneBoardStructure(board);
  const clonedCoords = new Set<Coord>();
  let currentCoord = source;
  const visited = new Set(visitedSeed ?? []);

  if (!visited.size) {
    visited.add(createJumpStateKey(source, board));
  }

  for (const landing of path) {
    const stepResult = applySingleJumpSegment(
      nextBoard,
      currentCoord,
      landing,
      movingPlayer,
      clonedCoords,
    );

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

/** Returns adjacent empty targets used by one-step single-checker movement. */
function getSingleStepTargets(board: Board, source: Coord): Coord[] {
  return DIRECTION_VECTORS.flatMap((direction) => {
    const target = getAdjacentCoord(source, direction);

    if (!target || !isEmptyCell(board, target)) {
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

/** Returns visited jump-state set carried by the engine state or seeded from the source. */
function getVisitedJumpStates(
  state: Pick<EngineState, 'board' | 'pendingJump'> & Partial<Pick<GameState, 'history'>>,
  source: Coord,
): Set<string> {
  if (state.pendingJump?.source === source) {
    return new Set(state.pendingJump.visitedStateKeys);
  }

  if (state.history?.length) {
    const movingPlayer = getMovingPlayer(state.board, source);

    if (movingPlayer) {
      const committedVisited = getCommittedJumpVisitedStates(
        { history: state.history },
        source,
        movingPlayer,
      );

      if (committedVisited.size) {
        return committedVisited;
      }
    }
  }

  return new Set([createJumpStateKey(source, state.board)]);
}

/** Returns filtered legal jump continuation targets for one board/visited context. */
function getJumpTargetsForContext(
  board: Board,
  source: Coord,
  movingPlayer: Player,
  visited: Set<string>,
): Coord[] {
  return getJumpTargetsOnBoard(board, source, movingPlayer).filter((target) => {
    const resolution = resolveJumpPath(board, source, [target], movingPlayer, visited);

    return 'board' in resolution;
  });
}

/** Returns next legal jump targets from a source plus optional pre-applied draft path. */
export function getJumpContinuationTargets(
  state: Pick<EngineState, 'board' | 'pendingJump'> &
    Partial<Pick<GameState, 'history' | 'currentPlayer'>>,
  source: Coord,
  draftPath: Coord[],
): Coord[] {
  if (state.pendingJump && state.pendingJump.source !== source) {
    return [];
  }

  const movingPlayer = getMovingPlayer(state.board, source);

  if (!movingPlayer) {
    return [];
  }

  let currentCoord = source;
  let currentBoard = state.board;
  let visited = getVisitedJumpStates(state, source);

  for (const landing of draftPath) {
    const partial = resolveJumpPath(currentBoard, currentCoord, [landing], movingPlayer, visited);

    if (!('board' in partial)) {
      return [];
    }

    currentBoard = partial.board;
    currentCoord = partial.currentCoord;
    visited = partial.visited;
  }

  return getJumpTargetsForContext(currentBoard, currentCoord, movingPlayer, visited);
}

/** Groups legal actions by kind into UI-ready target buckets. */
export function buildTargetMap(actions: TurnAction[]): TargetMap {
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
    createEmptyTargetMap(),
  );
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

  if (state.pendingJump && state.pendingJump.source !== coord) {
    return [];
  }

  if (isFrozenSingle(state.board, coord) && getTopChecker(state.board, coord)?.owner === state.currentPlayer) {
    if (state.pendingJump) {
      return [];
    }

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

  if (state.pendingJump) {
    return actions;
  }

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
  if (state.pendingJump) {
    return getLegalActionsForCell(state, state.pendingJump.source, config);
  }

  return allCoords().flatMap((coord) => getLegalActionsForCell(state, coord, config));
}

/** Lightweight structural equality for action matching in validator checks. */
function actionsEqual(left: TurnAction, right: TurnAction): boolean {
  switch (left.type) {
    case 'manualUnfreeze':
      return right.type === 'manualUnfreeze' && left.coord === right.coord;
    case 'jumpSequence':
      return (
        right.type === 'jumpSequence' &&
        left.source === right.source &&
        left.path.length === right.path.length &&
        left.path.every((coord, index) => coord === right.path[index])
      );
    case 'climbOne':
      return right.type === 'climbOne' && left.source === right.source && left.target === right.target;
    case 'moveSingleToEmpty':
      return (
        right.type === 'moveSingleToEmpty' &&
        left.source === right.source &&
        left.target === right.target
      );
    case 'splitOneFromStack':
      return (
        right.type === 'splitOneFromStack' &&
        left.source === right.source &&
        left.target === right.target
      );
    case 'splitTwoFromStack':
      return (
        right.type === 'splitTwoFromStack' &&
        left.source === right.source &&
        left.target === right.target
      );
    case 'friendlyStackTransfer':
      return (
        right.type === 'friendlyStackTransfer' &&
        left.source === right.source &&
        left.target === right.target
      );
  }
}

/** Shared source ownership validation for action variants with a source coordinate. */
function validateCommonSource(
  state: Pick<EngineState, 'board' | 'pendingJump'>,
  source: Coord,
  player: Player,
): ValidationResult {
  if (state.pendingJump && state.pendingJump.source !== source) {
    return {
      valid: false,
      reason: `Jump continuation must continue from ${state.pendingJump.source}.`,
    };
  }

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
  state: Pick<EngineState, 'board' | 'currentPlayer' | 'pendingJump' | 'status'>,
  action: TurnAction,
  config: Partial<RuleConfig> = {},
): ValidationResult {
  if (state.status === 'gameOver') {
    return { valid: false, reason: 'The game is already over.' };
  }

  if (state.pendingJump && action.type !== 'jumpSequence') {
    return {
      valid: false,
      reason: `Jump continuation must continue from ${state.pendingJump.source}.`,
    };
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

      if (action.path.length !== 1) {
        return {
          valid: false,
          reason: 'Jump actions are applied one landing at a time.',
        };
      }

      const sourceTopChecker = getTopChecker(state.board, action.source);

      if (!sourceTopChecker || sourceTopChecker.frozen) {
        return { valid: false, reason: 'Frozen single checkers cannot jump.' };
      }

      const legalAction = getLegalActionsForCell(state, action.source, config).find((candidate) =>
        actionsEqual(candidate, action),
      );

      if (legalAction) {
        return { valid: true };
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

      return {
        valid: false,
        reason: `Illegal jump from ${action.source} to ${action.path[0]}.`,
      };
    }
    case 'climbOne':
    case 'moveSingleToEmpty':
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
  state: Pick<EngineState, 'board' | 'currentPlayer' | 'pendingJump' | 'status'>,
  action: TurnAction,
  config: Partial<RuleConfig> = {},
): ValidationResult | Board {
  const resolvedConfig = withRuleDefaults(config);
  const validation = validateAction(state, action, resolvedConfig);

  if (!validation.valid) {
    return validation;
  }

  return applyValidatedActionToBoard(state, action);
}

/** Applies a previously validated action and returns next board plus jump-continuation state. */
export function applyValidatedAction(
  state: Pick<EngineState, 'board' | 'currentPlayer' | 'pendingJump' | 'status'>,
  action: TurnAction,
): ValidationResult | AppliedActionState {
  const board = cloneBoardStructure(state.board);
  const clonedCoords = new Set<Coord>();

  switch (action.type) {
    case 'manualUnfreeze':
      ensureMutableCell(board, action.coord, clonedCoords);
      setSingleCheckerFrozen(board, action.coord, false);
      return {
        board,
        pendingJump: null,
      };
    case 'jumpSequence': {
      const movingPlayer = getMovingPlayer(state.board, action.source);

      if (!movingPlayer) {
        return { valid: false, reason: `No moving player found at ${action.source}.` };
      }

      const result = resolveJumpPath(
        state.board,
        action.source,
        action.path,
        movingPlayer,
        getVisitedJumpStates(state, action.source),
      );

      if (!('board' in result)) {
        return result;
      }

      const continuationTargets = getJumpTargetsForContext(
        result.board,
        result.currentCoord,
        movingPlayer,
        result.visited,
      );

      return {
        board: result.board,
        pendingJump: continuationTargets.length
          ? {
              source: result.currentCoord,
              visitedStateKeys: [...result.visited],
            }
          : null,
      };
    }
    case 'climbOne': {
      ensureMutableCell(board, action.source, clonedCoords);
      ensureMutableCell(board, action.target, clonedCoords);
      const movingCheckers = removeTopCheckers(board, action.source, 1);
      addCheckers(board, action.target, movingCheckers);
      return {
        board,
        pendingJump: null,
      };
    }
    case 'moveSingleToEmpty': {
      ensureMutableCell(board, action.source, clonedCoords);
      ensureMutableCell(board, action.target, clonedCoords);
      const movingCount = isStack(board, action.source) ? getCellHeight(board, action.source) : 1;
      const movingCheckers = removeTopCheckers(board, action.source, movingCount);
      addCheckers(board, action.target, movingCheckers);
      return {
        board,
        pendingJump: null,
      };
    }
    case 'splitOneFromStack': {
      ensureMutableCell(board, action.source, clonedCoords);
      ensureMutableCell(board, action.target, clonedCoords);
      const movingCheckers = removeTopCheckers(board, action.source, 1);
      addCheckers(board, action.target, movingCheckers);
      return {
        board,
        pendingJump: null,
      };
    }
    case 'splitTwoFromStack': {
      ensureMutableCell(board, action.source, clonedCoords);
      ensureMutableCell(board, action.target, clonedCoords);
      const movingCheckers = removeTopCheckers(board, action.source, 2);
      addCheckers(board, action.target, movingCheckers);
      return {
        board,
        pendingJump: null,
      };
    }
    case 'friendlyStackTransfer': {
      ensureMutableCell(board, action.source, clonedCoords);
      ensureMutableCell(board, action.target, clonedCoords);
      const movingCheckers = removeTopCheckers(board, action.source, 1);
      addCheckers(board, action.target, movingCheckers);
      return {
        board,
        pendingJump: null,
      };
    }
  }
}

/** Applies a previously validated action while preserving references for untouched cells. */
export function applyValidatedActionToBoard(
  state: Pick<EngineState, 'board' | 'currentPlayer' | 'pendingJump' | 'status'>,
  action: TurnAction,
): ValidationResult | Board {
  const nextState = applyValidatedAction(state, action);

  return 'valid' in nextState ? nextState : nextState.board;
}
