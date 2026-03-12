import {
  buildTargetMap,
  getLegalActionsForCell,
  getScoreSummary,
  type Coord,
  type GameState,
  type RuleConfig,
} from '@/domain';
import { hashPosition } from '@/domain/model/hash';
import { uniqueValues } from '@/shared/utils/collections';

import { ruleConfigKey } from '@/app/store/createGameStore/match';
import type { BoardDerivation, CellDerivation } from '@/app/store/createGameStore/types';

/** Creates memoized board- and cell-level derivation helpers for the store instance. */
export function createDerivationCache() {
  let boardDerivationCache:
    | (BoardDerivation & {
        key: string;
      })
    | null = null;
  let cellDerivationCache:
    | (CellDerivation & {
        key: string;
      })
    | null = null;

  function getBoardDerivation(gameState: GameState, ruleConfig: RuleConfig): BoardDerivation {
    const key = `${hashPosition(gameState)}::${gameState.status}::${ruleConfigKey(ruleConfig)}`;

    if (boardDerivationCache?.key === key) {
      return boardDerivationCache;
    }

    const selectableCoords =
      gameState.status === 'gameOver'
        ? []
        : (Object.keys(gameState.board).filter((coord) =>
            getLegalActionsForCell(gameState, coord as Coord, ruleConfig).length > 0,
          ) as Coord[]);
    const scoreSummary =
      ruleConfig.scoringMode === 'basic' ? getScoreSummary(gameState) : null;

    boardDerivationCache = {
      key,
      selectableCoords,
      scoreSummary,
    };

    return boardDerivationCache;
  }

  function getCellDerivation(
    gameState: GameState,
    coord: Coord,
    ruleConfig: RuleConfig,
  ): CellDerivation {
    const key = `${hashPosition(gameState)}::${gameState.status}::${ruleConfigKey(ruleConfig)}::${coord}`;

    if (cellDerivationCache?.key === key) {
      return cellDerivationCache;
    }

    const actions = getLegalActionsForCell(gameState, coord, ruleConfig);
    const availableActionKinds = uniqueValues(actions.map((action) => action.type));
    const selectedTargetMap = buildTargetMap(actions);

    cellDerivationCache = {
      key,
      availableActionKinds,
      selectedTargetMap,
    };

    return cellDerivationCache;
  }

  return {
    getBoardDerivation,
    getCellDerivation,
  };
}
