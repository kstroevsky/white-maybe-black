import { createSnapshot } from '@/domain/model/board';
import { hashPosition } from '@/domain/model/hash';
import { withRuleDefaults } from '@/domain/model/ruleConfig';
import type { EngineState, GameState, Player, RuleConfig, TurnAction } from '@/domain/model/types';
import { applyValidatedAction, getLegalActions, validateAction } from '@/domain/rules/moveGeneration';
import { checkVictory } from '@/domain/rules/victory';

type EngineAdvanceResult = {
  autoPasses: Player[];
  state: EngineState;
};

/** Returns the opposing player for turn handoff. */
function getOpponent(player: Player): Player {
  return player === 'white' ? 'black' : 'white';
}

/** Creates baseline next-turn state before pass/victory post-processing. */
function nextStateSeed(
  state: EngineState,
  board: EngineState['board'],
  player: Player,
  pendingJump: EngineState['pendingJump'],
): EngineState {
  return {
    board,
    currentPlayer: player,
    moveNumber: state.moveNumber + 1,
    status: 'active',
    victory: { type: 'none' },
    pendingJump,
    positionCounts: { ...state.positionCounts },
  };
}

/** Counts legal actions for a specified player in a hypothetical state. */
function getLegalActionCount(state: EngineState, player: Player, config: RuleConfig): number {
  return getLegalActions(
    {
      ...state,
      currentPlayer: player,
      pendingJump: null,
    },
    config,
  ).length;
}

/** Applies one action to the engine state without appending turn history. */
function advanceEngineStateInternal(
  state: EngineState,
  action: TurnAction,
  config: Partial<RuleConfig> = {},
): EngineAdvanceResult {
  const resolvedConfig = withRuleDefaults(config);
  const validation = validateAction(state, action, resolvedConfig);

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const appliedState = applyValidatedAction(state, action);

  if ('valid' in appliedState) {
    if (!appliedState.valid) {
      throw new Error(appliedState.reason);
    }

    throw new Error('Unexpected successful validation result.');
  }

  const actor = state.currentPlayer;
  const nextPlayer = appliedState.pendingJump ? actor : getOpponent(actor);
  const immediateState = nextStateSeed(
    state,
    appliedState.board,
    nextPlayer,
    appliedState.pendingJump,
  );
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
      pendingJump: null,
    };
  } else if (
    !immediateState.pendingJump &&
    getLegalActionCount(immediateState, immediateState.currentPlayer, resolvedConfig) === 0
  ) {
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
        pendingJump: null,
      };
    } else {
      finalState = {
        ...immediateState,
        currentPlayer: retryPlayer,
      };
    }
  }

  const positionHash = hashPosition(finalState);
  finalState = {
    ...finalState,
    positionCounts: {
      ...finalState.positionCounts,
      [positionHash]: (finalState.positionCounts[positionHash] ?? 0) + 1,
    },
  };

  if (finalState.status !== 'gameOver') {
    const finalVictory = checkVictory(finalState, resolvedConfig);

    if (finalVictory.type !== 'none') {
      finalState = {
        ...finalState,
        status: 'gameOver',
        victory: finalVictory,
        pendingJump: null,
      };
    }
  }

  return {
    autoPasses,
    state: finalState,
  };
}

/** History-free state transition used by UI, serialization, and AI search. */
export function advanceEngineState(
  state: EngineState,
  action: TurnAction,
  config: Partial<RuleConfig> = {},
): EngineState {
  return advanceEngineStateInternal(state, action, config).state;
}

/** Authoritative state transition: validate, apply, resolve pass/victory, append history. */
export function applyAction(
  state: GameState,
  action: TurnAction,
  config: Partial<RuleConfig> = {},
): GameState {
  const { autoPasses, state: finalEngineState } = advanceEngineStateInternal(state, action, config);
  const positionHash = hashPosition(finalEngineState);
  const beforeState = createSnapshot(state);
  const afterState = createSnapshot({
    ...finalEngineState,
    history: state.history,
  });

  return {
    ...finalEngineState,
    history: [
      ...state.history,
      {
        actor: state.currentPlayer,
        action: structuredClone(action),
        beforeState,
        afterState,
        autoPasses,
        victoryAfter: structuredClone(finalEngineState.victory),
        positionHash,
      },
    ],
  };
}
