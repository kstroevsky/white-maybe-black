import type { OrderedAction } from '@/ai/moveOrdering';
import type { AiDifficultyPreset, AiSearchDiagnostics } from '@/ai/types';
import type { RuleConfig, TurnAction } from '@/domain';

export type BoundFlag = 'exact' | 'lower' | 'upper';

export type TranspositionEntry = {
  bestAction: TurnAction | null;
  depth: number;
  flag: BoundFlag;
  score: number;
};

export type RootRankedAction = Pick<
  OrderedAction,
  'action' | 'isForced' | 'isRepetition' | 'isSelfUndo' | 'isTactical'
> & {
  score: number;
};

export type SearchContext = {
  deadline: number;
  diagnostics: AiSearchDiagnostics;
  evaluatedNodes: number;
  historyScores: Map<string, number>;
  killerMovesByDepth: Map<number, TurnAction[]>;
  now: () => number;
  preset: AiDifficultyPreset;
  pvMoveByDepth: Map<number, TurnAction>;
  rootPreviousOwnAction: TurnAction | null;
  quiescenceDepthLimit: number;
  rootSelfUndoPositionKey: string | null;
  ruleConfig: RuleConfig;
  table: Map<string, TranspositionEntry>;
  continuationScores: Map<string, number>;
};
