import { hashPosition, type EngineState, type TurnAction } from '@/domain';

/** Shared timeout sentinel used across search and move ordering. */
export const AI_SEARCH_TIMEOUT = 'AI_SEARCH_TIMEOUT';

/** Serializes an action into a stable key for ordering, caches, and tests. */
export function actionKey(action: TurnAction): string {
  switch (action.type) {
    case 'manualUnfreeze':
      return `${action.type}:${action.coord}`;
    case 'jumpSequence':
      return `${action.type}:${action.source}:${action.path.join('>')}`;
    default:
      return `${action.type}:${action.source}:${action.target}`;
  }
}

/** Detects the sentinel timeout error produced by the search engine. */
export function isSearchTimeout(error: unknown): boolean {
  return error instanceof Error && error.message === AI_SEARCH_TIMEOUT;
}

/** Aborts the current search phase once the preset deadline has elapsed. */
export function throwIfTimedOut(now: () => number, deadline: number): void {
  if (now() >= deadline) {
    throw new Error(AI_SEARCH_TIMEOUT);
  }
}

/** Builds the transposition-table key for one engine state. */
export function makeTableKey(state: EngineState): string {
  return hashPosition(state);
}
