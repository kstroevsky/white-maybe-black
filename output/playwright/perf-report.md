# Performance Report

Generated: 2026-03-12T15:05:31.107Z

## Summary
- [GOOD] Desktop FCP: 88ms
- [GOOD] Mobile FCP: 48ms
- [BAD] Desktop move dialog: 395.9ms
- [BAD] Mobile move dialog: 339.2ms
- [GOOD] Mobile hard AI opening: 1280.3ms
- [GOOD] Domain full action scan: 0.2075ms
- [GOOD] Domain cell action scan: 0.0002ms
- [GOOD] Hash position: 0.0053ms

## Load
- Desktop: FCP 88ms, LCP 88ms, load 29.5ms
- Mobile: FCP 48ms, LCP 48ms, load 25.9ms

## Render / UI
- Desktop DOM nodes: 405, checker nodes: 36
- Mobile DOM nodes: 335, checker nodes: 36
- Desktop move dialog open: 395.9ms
- Mobile move dialog open: 339.2ms
- Mobile tab switch: Info 55.9ms, History 57.6ms

## AI
- Mobile opening turn: easy 191.5ms, medium 487.8ms, hard 1280.3ms
- Mobile reply turn: easy 193.2ms, medium 485.9ms, hard 1276.8ms

## Domain
- hashPosition avg: 0.0053ms
- getLegalActions avg: 0.2075ms
- getLegalActionsForCell avg: 0.0002ms
- selectable scan avg: 0.1997ms
- hasLegalAction check avg: 0.0107ms
- Cell-vs-full action speedup: 1037.5x
- Hash-vs-full action speedup: 39.15x

## Lifecycle
- Store lifecycle now terminates AI workers on `visibilitychange:hidden`, `pagehide`, and store destroy/unmount.
- Covered by store lifecycle tests in `createGameStore.test.ts`.
