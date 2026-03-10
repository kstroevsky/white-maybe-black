import { useSyncExternalStore } from 'react';

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

function getQuery(maxWidth: number): string {
  return `(max-width: ${maxWidth}px)`;
}

function getSnapshot(maxWidth: number): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(getQuery(maxWidth)).matches;
  }

  return window.innerWidth <= maxWidth;
}

function subscribe(maxWidth: number, onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const notify = () => onStoreChange();
  const query = getQuery(maxWidth);
  const mediaQuery =
    typeof window.matchMedia === 'function'
      ? (window.matchMedia(query) as LegacyMediaQueryList)
      : null;

  if (mediaQuery?.addEventListener) {
    mediaQuery.addEventListener('change', notify);
  } else if (mediaQuery?.addListener) {
    mediaQuery.addListener(notify);
  }
  window.addEventListener('resize', notify);

  return () => {
    if (mediaQuery?.removeEventListener) {
      mediaQuery.removeEventListener('change', notify);
    } else if (mediaQuery?.removeListener) {
      mediaQuery.removeListener(notify);
    }
    window.removeEventListener('resize', notify);
  };
}

export function useIsMobileViewport(maxWidth = 720): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(maxWidth, onStoreChange),
    () => getSnapshot(maxWidth),
    () => false,
  );
}
