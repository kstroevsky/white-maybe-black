import { createEmptyBoard, createSnapshot } from '@/domain/model/board';
import { allCoords, parseCoord } from '@/domain/model/coordinates';
import { hashPosition } from '@/domain/model/hash';
import type { Board, Checker, GameState, Player, RuleConfig } from '@/domain/model/types';

/** Creates one active checker with deterministic id used in tests and serialization. */
function createChecker(owner: Player, index: number): Checker {
  return {
    id: `${owner}-${String(index).padStart(2, '0')}`,
    owner,
    frozen: false,
  };
}

/** Creates the default opening board (white on rows 1-3, black on rows 4-6). */
export function createInitialBoard(): Board {
  const board = createEmptyBoard();
  let whiteIndex = 1;
  let blackIndex = 1;

  for (const coord of allCoords()) {
    const { row } = parseCoord(coord);

    if (row <= 3) {
      board[coord].checkers = [createChecker('white', whiteIndex++)];
      continue;
    }

    board[coord].checkers = [createChecker('black', blackIndex++)];
  }

  return board;
}

/** Creates initial game state with snapshot fields and seeded position repetition counter. */
export function createInitialState(_config: Partial<RuleConfig> = {}): GameState {
  const board = createInitialBoard();
  const baseState: GameState = {
    board,
    currentPlayer: 'white',
    moveNumber: 1,
    status: 'active',
    victory: { type: 'none' },
    history: [],
    positionCounts: {},
  };
  const initialHash = hashPosition(baseState);

  return {
    ...createSnapshot(baseState),
    history: [],
    positionCounts: {
      [initialHash]: 1,
    },
  };
}
