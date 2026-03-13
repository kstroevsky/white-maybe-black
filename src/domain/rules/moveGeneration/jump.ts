import {
  addCheckers,
  cloneBoardStructure,
  ensureMutableCell,
  getCellHeight,
  getTopChecker,
  isEmptyCell,
  isStack,
  removeTopCheckers,
  setSingleCheckerFrozen,
} from '@/domain/model/board';
import { DIRECTION_VECTORS } from '@/domain/model/constants';
import {
  getAdjacentCoord,
  getJumpDirection,
  getJumpLandingCoord,
} from '@/domain/model/coordinates';
import { hashBoard } from '@/domain/model/hash';
import type {
  Board,
  Coord,
  EngineState,
  GameState,
  Player,
  ValidationResult,
} from '@/domain/model/types';
import { canJumpOverCell, validateBoard } from '@/domain/validators/stateValidators';

import type { PartialJumpResolution } from '@/domain/rules/moveGeneration/types';

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
  const chain: Array<
    Extract<GameState['history'][number]['action'], { type: 'jumpSequence' }> & {
      beforeBoard: Board;
      afterBoard: Board;
    }
  > = [];
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
export function getMovingPlayer(board: Board, source: Coord): Player | null {
  return getTopChecker(board, source)?.owner ?? null;
}

/** Jumping from stacks moves the whole stack as one unit. */
function isWholeStackJump(board: Board, source: Coord): boolean {
  return isStack(board, source);
}

/** Applies one jump segment, including freeze/unfreeze side effects on the jumped checker. */
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
export function resolveJumpPath(
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

/** Returns visited jump-state set carried by the engine state or seeded from the source. */
export function getVisitedJumpStates(
  state: Pick<EngineState, 'board' | 'pendingJump'> & Partial<Pick<GameState, 'history'>>,
  source: Coord,
): Set<string> {
  const pendingJump = state.pendingJump;

  if (pendingJump?.source === source) {
    return new Set(pendingJump.visitedStateKeys);
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
export function getJumpTargetsForContext(
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
