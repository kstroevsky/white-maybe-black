import { useShallow } from 'zustand/react/shallow';

import { useGameStore } from '@/app/providers/GameStoreProvider';
import type { Coord } from '@/domain';
import { Board } from '@/ui/board/Board';
import { GameControlPanel } from '@/ui/panels/ControlPanel';

const NO_SELECTABLE_COORDS: Coord[] = [];

/** Game tab combines board and compact gameplay panel in a fixed-height workspace. */
export function GameTab() {
  const { board, language, legalTargets, selectedCell, selectableCoords, onSelectCell } = useGameStore(
    useShallow((state) => ({
      board: state.gameState.board,
      language: state.preferences.language,
      legalTargets: state.legalTargets,
      selectedCell: state.selectedCell,
      selectableCoords:
        state.interaction.type === 'passingDevice' ? NO_SELECTABLE_COORDS : state.selectableCoords,
      onSelectCell: state.selectCell,
    })),
  );

  return (
    <div className="app-layout" role="tabpanel">
      <Board
        board={board}
        language={language}
        legalTargets={legalTargets}
        selectedCell={selectedCell}
        selectableCoords={selectableCoords}
        onSelectCell={onSelectCell}
      />
      <GameControlPanel />
    </div>
  );
}
