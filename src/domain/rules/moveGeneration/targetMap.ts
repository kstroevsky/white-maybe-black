import type { TurnAction } from '@/domain/model/types';

import type { TargetMap } from '@/domain/rules/moveGeneration/types';

/** Creates empty per-action target buckets used by UI state and selectors. */
export function createEmptyTargetMap(): TargetMap {
  return {
    jumpSequence: [],
    manualUnfreeze: [],
    climbOne: [],
    moveSingleToEmpty: [],
    splitOneFromStack: [],
    splitTwoFromStack: [],
    friendlyStackTransfer: [],
  };
}

/** Groups legal actions by kind into UI-ready target buckets. */
export function buildTargetMap(actions: TurnAction[]): TargetMap {
  return actions.reduce<TargetMap>(
    (map, action) => {
      switch (action.type) {
        case 'manualUnfreeze':
          return map;
        case 'jumpSequence':
          map.jumpSequence.push(action.path[0]);
          return map;
        default:
          map[action.type].push(action.target);
          return map;
      }
    },
    createEmptyTargetMap(),
  );
}
