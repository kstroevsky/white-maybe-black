import { createContext, useContext, useRef } from 'react';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand';

import { createGameStore } from '@/app/store/createGameStore';
import type { GameStoreState } from '@/app/store/createGameStore';
import type { SerializableSession } from '@/shared/types/session';

type CreateGameStoreOptions = Parameters<typeof createGameStore>[0];

const GameStoreContext = createContext<StoreApi<GameStoreState> | null>(null);

type GameStoreProviderProps = {
  children: React.ReactNode;
  initialSession?: SerializableSession;
  storeOptions?: Omit<CreateGameStoreOptions, 'initialSession'>;
};

/** Creates and exposes one store instance for the whole React subtree. */
export function GameStoreProvider({
  children,
  initialSession,
  storeOptions,
}: GameStoreProviderProps) {
  const storeRef = useRef<StoreApi<GameStoreState> | null>(null);

  if (!storeRef.current) {
    storeRef.current = createGameStore({ ...storeOptions, initialSession });
  }

  return (
    <GameStoreContext.Provider value={storeRef.current}>
      {children}
    </GameStoreContext.Provider>
  );
}

/** Typed zustand selector hook bound to `GameStoreProvider` context. */
export function useGameStore<T>(selector: (state: GameStoreState) => T): T {
  const store = useContext(GameStoreContext);

  if (!store) {
    throw new Error('useGameStore must be used within GameStoreProvider.');
  }

  return useStore(store, selector);
}
