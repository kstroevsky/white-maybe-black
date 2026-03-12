import type { GameState, RuleConfig } from '@/domain';
import type { MatchSettings } from '@/shared/types/session';

/** Stable cache key used for rule-dependent derivation memoization. */
export function ruleConfigKey(config: RuleConfig): string {
  return [
    config.allowNonAdjacentFriendlyStackTransfer ? '1' : '0',
    config.drawRule,
    config.scoringMode,
  ].join(':');
}

/** Detects whether the current session should involve the AI worker. */
export function isComputerMatch(matchSettings: MatchSettings): boolean {
  return matchSettings.opponentMode === 'computer';
}

/** Applies match-specific rule overrides required by the computer game mode. */
export function getRuleConfigForNewMatch(
  ruleConfig: RuleConfig,
  matchSettings: MatchSettings,
): RuleConfig {
  if (!isComputerMatch(matchSettings) || ruleConfig.drawRule !== 'none') {
    return ruleConfig;
  }

  return {
    ...ruleConfig,
    drawRule: 'threefold',
  };
}

/** Detects whether it is currently the computer player's turn to move. */
export function isComputerTurn(
  gameState: Pick<GameState, 'currentPlayer'>,
  matchSettings: MatchSettings,
): boolean {
  return isComputerMatch(matchSettings) && gameState.currentPlayer !== matchSettings.humanPlayer;
}
