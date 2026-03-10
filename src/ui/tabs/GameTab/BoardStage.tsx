import { useShallow } from 'zustand/react/shallow';

import { useGameStore } from '@/app/providers/GameStoreProvider';
import type { Coord } from '@/domain';
import { Board } from '@/ui/board/Board';

const NO_SELECTABLE_COORDS: Coord[] = [];

export function BoardStage() {
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
    <Board
      board={board}
      language={language}
      legalTargets={legalTargets}
      selectedCell={selectedCell}
      selectableCoords={selectableCoords}
      onSelectCell={onSelectCell}
    />
  );
}
