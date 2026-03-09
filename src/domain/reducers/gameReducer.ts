import { createSnapshot } from '@/domain/model/board';
import { hashPosition } from '@/domain/model/hash';
import { withRuleDefaults } from '@/domain/model/ruleConfig';
import type { Board, GameState, Player, RuleConfig, TurnAction, ValidationResult } from '@/domain/model/types';
import {
  applyValidatedActionToBoard,
  getJumpContinuationTargets,
  getLegalActions,
  validateAction,
} from '@/domain/rules/moveGeneration';
import { checkVictory } from '@/domain/rules/victory';

/** Returns the opposing player for turn handoff. */
function getOpponent(player: Player): Player {
  return player === 'white' ? 'black' : 'white';
}

/** Type guard for helpers that may return either board or validation object. */
function isValidationResult(value: Board | ValidationResult): value is ValidationResult {
  return 'valid' in value;
}

/** Creates baseline next-turn state before pass/victory post-processing. */
function nextStateSeed(state: GameState, board: GameState['board'], player: Player): GameState {
  return {
    board,
    currentPlayer: player,
    moveNumber: state.moveNumber + 1,
    status: 'active',
    victory: { type: 'none' },
    history: state.history,
    positionCounts: { ...state.positionCounts },
  };
}

/** Counts legal actions for a specified player in a hypothetical state. */
function getLegalActionCount(state: GameState, player: Player, config: RuleConfig): number {
  return getLegalActions({ ...state, currentPlayer: player }, config).length;
}

/** Returns true when the acting player must continue jumping from the new landing. */
function hasJumpContinuation(
  state: GameState,
  action: TurnAction,
): boolean {
  if (action.type !== 'jumpSequence') {
    return false;
  }

  return getJumpContinuationTargets(state, action.source, action.path).length > 0;
}

/** Authoritative state transition: validate, apply, resolve pass/victory, append history. */
export function applyAction(
  state: GameState,
  action: TurnAction,
  config: Partial<RuleConfig> = {},
): GameState {
  const resolvedConfig = withRuleDefaults(config);
  const validation = validateAction(state, action, resolvedConfig);
  let validationError: string | null = null;

  if (!validation.valid) {
    validationError = validation.reason;
  }

  if (validationError) {
    throw new Error(validationError);
  }

  const nextBoard = applyValidatedActionToBoard(state, action);

  if (isValidationResult(nextBoard)) {
    if (!nextBoard.valid) {
      throw new Error(nextBoard.reason);
    }

    throw new Error('Unexpected successful validation result.');
  }

  const actor = state.currentPlayer;
  const nextPlayer = hasJumpContinuation(state, action)
    ? actor
    : getOpponent(actor);
  const immediateState = nextStateSeed(state, nextBoard, nextPlayer);
  const winAfterMove = checkVictory(immediateState, resolvedConfig);
  const autoPasses: Player[] = [];
  let finalState = immediateState;

  // Victory after direct action has the highest priority.
  if (winAfterMove.type !== 'none') {
    finalState = {
      ...immediateState,
      currentPlayer: actor,
      status: 'gameOver',
      victory: winAfterMove,
    };
  } else if (getLegalActionCount(immediateState, immediateState.currentPlayer, resolvedConfig) === 0) {
    // Forced pass if the next player has no legal actions.
    autoPasses.push(immediateState.currentPlayer);
    const retryPlayer = actor;

    if (getLegalActionCount(immediateState, retryPlayer, resolvedConfig) === 0) {
      // Neither side can move: stalemate draw.
      autoPasses.push(retryPlayer);
      finalState = {
        ...immediateState,
        currentPlayer: actor,
        status: 'gameOver',
        victory: { type: 'stalemateDraw' },
      };
    } else {
      finalState = {
        ...immediateState,
        currentPlayer: retryPlayer,
      };
    }
  }

  const positionHash = hashPosition(finalState);
  finalState.positionCounts[positionHash] = (finalState.positionCounts[positionHash] ?? 0) + 1;

  if (finalState.status !== 'gameOver') {
    const finalVictory = checkVictory(finalState, resolvedConfig);

    if (finalVictory.type !== 'none') {
      finalState = {
        ...finalState,
        status: 'gameOver',
        victory: finalVictory,
      };
    }
  }

  const beforeState = createSnapshot(state);
  const afterState = createSnapshot(finalState);

  finalState.history = [
    ...state.history,
    {
      actor,
      action: structuredClone(action),
      beforeState,
      afterState,
      autoPasses,
      victoryAfter: structuredClone(finalState.victory),
      positionHash,
    },
  ];

  return finalState;
}
