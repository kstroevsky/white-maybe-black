import {
  countCheckersForPlayer,
  getCell,
  getCellHeight,
  getController,
  getTopChecker,
  isEmptyCell,
  isSingleChecker,
  isStack,
} from '@/domain/model/board';
import { allCoords, isAdjacent } from '@/domain/model/coordinates';
import type { Board, Coord, GameState, Player, ValidationResult } from '@/domain/model/types';

/** True when the cell contains exactly one frozen checker. */
export function isFrozenSingle(board: Board, coord: Coord): boolean {
  if (!isSingleChecker(board, coord)) {
    return false;
  }

  return Boolean(getTopChecker(board, coord)?.frozen);
}

/** True when the cell contains exactly one active (not frozen) checker. */
export function isActiveSingle(board: Board, coord: Coord): boolean {
  if (!isSingleChecker(board, coord)) {
    return false;
  }

  return !getTopChecker(board, coord)?.frozen;
}

/** True when the cell is a stack controlled by the given player. */
export function isControlledStack(board: Board, coord: Coord, player: Player): boolean {
  return isStack(board, coord) && getController(board, coord) === player;
}

/** True when the player owns an active single checker on the coordinate. */
export function isMovableSingle(board: Board, coord: Coord, player: Player): boolean {
  const checker = getTopChecker(board, coord);
  return isSingleChecker(board, coord) && checker?.owner === player && !checker.frozen;
}

/** Checks climb/transfer landing constraints for occupied target cells. */
export function canLandOnOccupiedCell(board: Board, target: Coord): boolean {
  if (isEmptyCell(board, target)) {
    return false;
  }

  if (isFrozenSingle(board, target)) {
    return false;
  }

  return getCellHeight(board, target) < 3;
}

/** Checks whether a jump may pass over a middle cell for the moving player. */
export function canJumpOverCell(board: Board, movingPlayer: Player, target: Coord): boolean {
  if (!isSingleChecker(board, target)) {
    return false;
  }

  const checker = getTopChecker(board, target);

  if (!checker) {
    return false;
  }

  if (checker.frozen) {
    return checker.owner === movingPlayer;
  }

  return true;
}

/** Enforces board shape invariants that must hold after every legal action. */
export function validateBoard(board: Board): ValidationResult {
  for (const coord of allCoords()) {
    const cell = getCell(board, coord);

    if (cell.checkers.length > 3) {
      return { valid: false, reason: `Cell ${coord} exceeds height 3.` };
    }

    if (cell.checkers.length > 1 && cell.checkers.some((checker) => checker.frozen)) {
      return {
        valid: false,
        reason: `Stacks may not contain frozen checkers (${coord}).`,
      };
    }

    if (cell.checkers.length === 1 && !cell.checkers[0]) {
      return { valid: false, reason: `Invalid single checker state at ${coord}.` };
    }
  }

  return { valid: true };
}

/** Validates board invariants and fixed total checker counts for both players. */
export function validateGameState(state: GameState): ValidationResult {
  const boardValidation = validateBoard(state.board);

  if (!boardValidation.valid) {
    return boardValidation;
  }

  if (countCheckersForPlayer(state.board, 'white') !== 18) {
    return { valid: false, reason: 'White must have exactly 18 checkers.' };
  }

  if (countCheckersForPlayer(state.board, 'black') !== 18) {
    return { valid: false, reason: 'Black must have exactly 18 checkers.' };
  }

  return { valid: true };
}

/** Alias used by app layer to keep validator naming explicit. */
export function isAdjacentCoord(source: Coord, target: Coord): boolean {
  return isAdjacent(source, target);
}
