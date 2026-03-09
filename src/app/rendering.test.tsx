import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useShallow } from 'zustand/react/shallow';

import { GameStoreProvider, useGameStore } from '@/app/providers/GameStoreProvider';
import type { Coord } from '@/domain';
import { createInitialState } from '@/domain';
import { Board } from '@/ui/board/Board';
import { createSession, resetFactoryIds } from '@/test/factories';

const NO_SELECTABLE_COORDS: Coord[] = [];

type RenderProbeProps = {
  onRender: () => void;
};

function BoardProbe({ onRender }: RenderProbeProps) {
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

  onRender();

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

function MoveProbe({ onRender }: RenderProbeProps) {
  const availableActionKinds = useGameStore((state) => state.availableActionKinds);

  onRender();

  return <output data-testid="move-probe">{availableActionKinds.join(',')}</output>;
}

function SessionProbe({ onRender }: RenderProbeProps) {
  const { importBuffer, setImportBuffer } = useGameStore(
    useShallow((state) => ({
      importBuffer: state.importBuffer,
      setImportBuffer: state.setImportBuffer,
    })),
  );

  onRender();

  return (
    <textarea
      aria-label="Import probe"
      value={importBuffer}
      onChange={(event) => setImportBuffer(event.target.value)}
    />
  );
}

function renderProbes(
  boardRender: () => void,
  moveRender: () => void,
  sessionRender: () => void,
) {
  return render(
    <GameStoreProvider initialSession={createSession(createInitialState())}>
      <BoardProbe onRender={boardRender} />
      <MoveProbe onRender={moveRender} />
      <SessionProbe onRender={sessionRender} />
    </GameStoreProvider>,
  );
}

describe('render containment', () => {
  beforeEach(() => {
    resetFactoryIds();
  });

  it('does not rerender the board when only the import buffer changes', async () => {
    const user = userEvent.setup();
    const boardRender = vi.fn();
    const moveRender = vi.fn();
    const sessionRender = vi.fn();
    renderProbes(boardRender, moveRender, sessionRender);

    expect(boardRender).toHaveBeenCalledTimes(1);
    expect(moveRender).toHaveBeenCalledTimes(1);
    expect(sessionRender).toHaveBeenCalledTimes(1);

    await user.type(screen.getByRole('textbox', { name: 'Import probe' }), 'abc');

    expect(boardRender).toHaveBeenCalledTimes(1);
    expect(moveRender).toHaveBeenCalledTimes(1);
    expect(sessionRender.mock.calls.length).toBeGreaterThan(1);
  });

  it('updates board selection and move actions without rerendering the session subtree', async () => {
    const user = userEvent.setup();
    const boardRender = vi.fn();
    const moveRender = vi.fn();
    const sessionRender = vi.fn();
    renderProbes(boardRender, moveRender, sessionRender);

    await user.click(screen.getByRole('button', { name: 'Клетка A1' }));

    expect(screen.getByTestId('move-probe')).toHaveTextContent('climbOne');
    expect(boardRender.mock.calls.length).toBeGreaterThan(1);
    expect(moveRender.mock.calls.length).toBeGreaterThan(1);
    expect(sessionRender).toHaveBeenCalledTimes(1);
  });
});
