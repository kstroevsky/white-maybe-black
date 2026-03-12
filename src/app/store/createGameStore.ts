import { createStore } from 'zustand/vanilla';

import { createGameStoreStateRuntime } from '@/app/store/createGameStore/stateCreator';
import { getInitialPersistenceState } from '@/app/store/createGameStore/persistence';
import { createIndexedDbSessionArchive } from '@/app/store/sessionArchive';
import type {
  GameStore,
  GameStoreData,
  GameStoreState,
  HistoryHydrationStatus,
  StoreOptions,
} from '@/app/store/createGameStore/types';

export type {
  GameStore,
  GameStoreData,
  GameStoreState,
  HistoryHydrationStatus,
  StoreOptions,
} from '@/app/store/createGameStore/types';

/** Public store factory that composes the internal store modules. */
export function createGameStore(options: StoreOptions = {}): GameStore {
  const storage =
    options.storage ??
    (typeof window !== 'undefined' ? window.localStorage : undefined);
  const archive =
    options.archive ??
    (typeof window !== 'undefined' ? createIndexedDbSessionArchive() : null);
  const initialPersistence = getInitialPersistenceState({
    ...options,
    archive,
    storage,
  });
  const runtime = createGameStoreStateRuntime({
    archive,
    initialPersistence,
    options,
    storage,
  });
  const store = createStore<GameStoreState>(runtime.stateCreator);

  runtime.runPostCreate(store);

  return store;
}
