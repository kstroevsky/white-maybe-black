import { memo } from 'react';

import { displayCoords, parseCoord } from '@/domain/model/coordinates';
import type { Board as GameBoard, Coord } from '@/domain';
import { text } from '@/shared/i18n/catalog';
import type { Language } from '@/shared/i18n/types';

import { BoardCell } from '@/ui/cells/BoardCell';

type BoardProps = {
  board: GameBoard;
  language: Language;
  legalTargets: Coord[];
  selectedCell: Coord | null;
  selectableCoords: Coord[];
  onSelectCell: (coord: Coord) => void;
};

const DISPLAY_CELLS = displayCoords().map((coord) => ({
  coord,
  isDarkField: parseCoord(coord).row <= 3,
}));

/** Presentational board grid that renders cell state and click targets from store-derived props. */
export const Board = memo(function Board({
  board,
  language,
  legalTargets,
  selectedCell,
  selectableCoords,
  onSelectCell,
}: BoardProps) {
  const selectable = new Set(selectableCoords);
  const targets = new Set(legalTargets);

  return (
    <section className="board-panel" aria-label={text(language, 'boardAriaLabel')}>
      <div className="board-frame">
        <div className="board-layout">
          <div className="board-axis board-axis--rows">
            {[6, 5, 4, 3, 2, 1].map((row) => (
              <span key={row}>{row}</span>
            ))}
          </div>
          <div className="board-grid-wrap">
            <div className="board-grid">
              {DISPLAY_CELLS.map(({ coord, isDarkField }) => (
                <BoardCell
                  key={coord}
                  cell={board[coord]}
                  coord={coord}
                  isDarkField={isDarkField}
                  language={language}
                  isLegalTarget={targets.has(coord)}
                  isSelected={selectedCell === coord}
                  isSelectable={selectable.has(coord)}
                  onClick={onSelectCell}
                />
              ))}
            </div>
            <div className="board-axis board-axis--columns">
              {['A', 'B', 'C', 'D', 'E', 'F'].map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
