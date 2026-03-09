import { allCoords } from '@/domain/model/coordinates';
import { getCell } from '@/domain/model/board';
import type { Board, GameState, StateSnapshot } from '@/domain/model/types';

/** Produces deterministic board hash used for history and threefold detection. */
export function hashBoard(board: Board): string {
  return allCoords()
    .map((coord) => {
      const signature = getCell(board, coord).checkers
        .map((checker) => `${checker.owner[0]}${checker.frozen ? 'f' : 'a'}`)
        .join('|');
      return `${coord}:${signature}`;
    })
    .join(';');
}

/** Produces full position hash (board + side to move). */
export function hashPosition(state: Pick<GameState, 'board' | 'currentPlayer'> | StateSnapshot): string {
  return `${state.currentPlayer}::${hashBoard(state.board)}`;
}
