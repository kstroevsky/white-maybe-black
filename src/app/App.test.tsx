import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';

import { App } from '@/app/App';
import { GameStoreProvider } from '@/app/providers/GameStoreProvider';
import { createInitialState } from '@/domain';
import { createSession, resetFactoryIds } from '@/test/factories';

function renderApp() {
  return render(
    <GameStoreProvider initialSession={createSession(createInitialState())}>
      <App />
    </GameStoreProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    resetFactoryIds();
  });

  it('reveals legal move buttons after selecting a cell', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Cell A1' }));

    expect(screen.getByRole('button', { name: 'Climb' })).toBeInTheDocument();
  });

  it('ignores illegal destinations and keeps the turn unchanged', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Cell A1' }));
    await user.click(screen.getByRole('button', { name: 'Climb' }));
    await user.click(screen.getByRole('button', { name: 'Cell F6' }));

    expect(screen.getByText('White turn')).toBeInTheDocument();
    expect(screen.queryByText(/White: Climb/)).not.toBeInTheDocument();
  });

  it('applies a move, updates history, and switches the turn behind the pass overlay', async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole('button', { name: 'Cell A1' }));
    await user.click(screen.getByRole('button', { name: 'Climb' }));
    await user.click(screen.getByRole('button', { name: 'Cell B2' }));

    expect(screen.getAllByText('Black turn')).toHaveLength(2);
    expect(screen.getByText(/White: Climb A1 -> B2/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Black turn')).toBeInTheDocument();
  });

  it('locks move input when the game is over', async () => {
    const user = userEvent.setup();
    render(
      <GameStoreProvider
        initialSession={createSession({
          ...createInitialState(),
          status: 'gameOver',
          victory: { type: 'threefoldDraw' },
        })}
      >
        <App />
      </GameStoreProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Cell A1' }));

    expect(screen.getByText('Draw by threefold repetition')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Climb' })).not.toBeInTheDocument();
  });
});
