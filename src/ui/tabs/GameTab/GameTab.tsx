import { useShallow } from 'zustand/react/shallow';

import { useGameStore } from '@/app/providers/GameStoreProvider';
import type { Coord } from '@/domain';
import { Board } from '@/ui/board/Board';
import { GameControlPanel } from '@/ui/panels/GameControlPanel';
import { ScoreCompactTable } from '@/ui/panels/ScoreCompactTable';

import styles from './style.module.scss';

const NO_SELECTABLE_COORDS: Coord[] = [];

export function GameTab() {
  const { board, language, scoreSummary, legalTargets, selectedCell, selectableCoords, onSelectCell } = useGameStore(
    useShallow((state) => ({
      board: state.gameState.board,
      language: state.preferences.language,
      scoreSummary: state.scoreSummary,
      legalTargets: state.legalTargets,
      selectedCell: state.selectedCell,
      selectableCoords:
        state.interaction.type === 'passingDevice' ? NO_SELECTABLE_COORDS : state.selectableCoords,
      onSelectCell: state.selectCell,
    })),
  );

  return (
    <div className={styles.root} role="tabpanel">
      {scoreSummary ? <ScoreCompactTable language={language} scoreSummary={scoreSummary} /> : null}
      <div className={styles.layout}>
        <div className={styles.boardSlot}>
          <Board
            board={board}
            language={language}
            legalTargets={legalTargets}
            selectedCell={selectedCell}
            selectableCoords={selectableCoords}
            onSelectCell={onSelectCell}
          />
        </div>
        <div className={styles.panelSlot}>
          <GameControlPanel />
        </div>
      </div>
    </div>
  );
}
