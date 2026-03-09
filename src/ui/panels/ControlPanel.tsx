import { startTransition, useDeferredValue } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { RULE_TOGGLE_DESCRIPTORS } from '@/domain';
import type { GameState, Victory } from '@/domain';
import { useGameStore } from '@/app/providers/GameStoreProvider';
import type { GlossaryTermId } from '@/features/glossary/terms';
import {
  actionLabel,
  describeInteraction,
  formatTurnRecord,
  formatVictory,
  playerLabel,
  text,
} from '@/shared/i18n/catalog';
import type { Language } from '@/shared/i18n/types';
import { GlossaryTooltip } from '@/ui/tooltips/GlossaryTooltip';

/** Generates deterministic ids for checkbox input/label wiring. */
function checkboxId(section: string, name: string): string {
  return `${section}-${name}`;
}

/** Returns localized turn banner text. */
function getTurnLabel(language: Language, currentPlayer: GameState['currentPlayer']): string {
  return language === 'russian'
    ? `${playerLabel(language, currentPlayer)} ходят`
    : `${playerLabel(language, currentPlayer)} turn`;
}

/** Maps terminal status to glossary term for contextual help tooltip. */
function getVictoryTermId(victory: Victory): GlossaryTermId | null {
  switch (victory.type) {
    case 'homeField':
      return 'homeFieldVictory';
    case 'sixStacks':
      return 'sixStacksVictory';
    case 'threefoldDraw':
      return 'threefoldDraw';
    default:
      return null;
  }
}

function StatusSection() {
  const { currentPlayer, interaction, moveNumber, scoreSummary, selectedCell, victory, language } = useGameStore(
    useShallow((state) => ({
      currentPlayer: state.gameState.currentPlayer,
      interaction: state.interaction,
      moveNumber: state.gameState.moveNumber,
      scoreSummary: state.scoreSummary,
      selectedCell: state.selectedCell,
      victory: state.gameState.victory,
      language: state.preferences.language,
    })),
  );
  const victoryTermId = getVictoryTermId(victory);

  const scoreRows = scoreSummary
    ? [
        {
          label: text(language, 'scoreHomeSingles'),
          termId: 'homeFieldSingles' as const,
          white: scoreSummary.homeFieldSingles.white,
          black: scoreSummary.homeFieldSingles.black,
        },
        {
          label: text(language, 'scoreControlledStacks'),
          termId: 'controlledStacks' as const,
          white: scoreSummary.controlledStacks.white,
          black: scoreSummary.controlledStacks.black,
        },
        {
          label: text(language, 'scoreFrontRowStacks'),
          termId: 'frontRowStacks' as const,
          white: scoreSummary.controlledHomeRowHeightThreeStacks.white,
          black: scoreSummary.controlledHomeRowHeightThreeStacks.black,
        },
        {
          label: text(language, 'scoreFrozenEnemySingles'),
          termId: 'frozenEnemySingles' as const,
          white: scoreSummary.frozenEnemySingles.white,
          black: scoreSummary.frozenEnemySingles.black,
        },
      ]
    : [];

  return (
    <section className="panel">
      <div className="turn-banner">
        <p>{getTurnLabel(language, currentPlayer)}</p>
        <small>{describeInteraction(language, interaction)}</small>
      </div>
      <p className="panel__text">
        <strong>{text(language, 'moveNumberLabel')}:</strong> {moveNumber}
      </p>
      <p className="panel__text panel__text--with-tooltip">
        <strong>{text(language, 'statusLabel')}:</strong> {formatVictory(language, victory)}
        {victoryTermId ? <GlossaryTooltip language={language} termId={victoryTermId} /> : null}
      </p>
      {selectedCell ? (
        <p className="panel__text">
          <strong>{text(language, 'selectedCellLabel')}:</strong> {selectedCell}
        </p>
      ) : null}
      {scoreSummary ? (
        <div className="score-compact">
          <div className="score-compact__header">
            <strong>{text(language, 'scoreMode')}</strong>
            <GlossaryTooltip language={language} termId="scoreMode" />
          </div>
          <div className="score-compact__table" role="table" aria-label={text(language, 'scoreMode')}>
            <div className="score-compact__row score-compact__row--head" role="row">
              <span role="columnheader" />
              <span role="columnheader">{text(language, 'scoreWhite')}</span>
              <span role="columnheader">{text(language, 'scoreBlack')}</span>
            </div>
            {scoreRows.map((row) => (
              <div key={row.label} className="score-compact__row" role="row">
                <div className="score-compact__label" role="rowheader">
                  <span>{row.label}</span>
                  <GlossaryTooltip language={language} termId={row.termId} />
                </div>
                <span role="cell">{row.white}</span>
                <span role="cell">{row.black}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MoveInputSection() {
  const {
    availableActionKinds,
    language,
    selectedActionType,
    selectedCell,
    onCancel,
    onChooseAction,
  } = useGameStore(
    useShallow((state) => ({
      availableActionKinds: state.availableActionKinds,
      language: state.preferences.language,
      selectedActionType: state.selectedActionType,
      selectedCell: state.selectedCell,
      onCancel: state.cancelInteraction,
      onChooseAction: state.chooseActionType,
    })),
  );

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>{text(language, 'moveInput')}</h2>
      </div>
      <div className="action-grid">
        {availableActionKinds.length ? (
          availableActionKinds.map((actionKind) => (
            <div key={actionKind} className="action-chip">
              <button
                type="button"
                className={selectedActionType === actionKind ? 'button button--active' : 'button'}
                onClick={() => onChooseAction(actionKind)}
              >
                {actionLabel(language, actionKind)}
              </button>
              <GlossaryTooltip language={language} termId={actionKind} />
            </div>
          ))
        ) : (
          <p className="panel__text">{text(language, 'noActionsSelected')}</p>
        )}
      </div>
      {selectedActionType === 'jumpSequence' && selectedCell ? (
        <>
          <p className="panel__text">
            <strong>{text(language, 'jumpPathLabel')}:</strong> {selectedCell}
          </p>
          <p className="panel__text">{text(language, 'jumpPathHint')}</p>
        </>
      ) : null}
      <div className="inline-actions">
        <button type="button" className="button button--ghost" onClick={onCancel}>
          {text(language, 'clear')}
        </button>
      </div>
    </section>
  );
}

function RulesSessionSection() {
  const {
    language,
    preferences,
    ruleConfig,
    onRestart,
    onSetPreference,
    onSetRuleConfig,
  } = useGameStore(
    useShallow((state) => ({
      language: state.preferences.language,
      preferences: state.preferences,
      ruleConfig: state.ruleConfig,
      onRestart: state.restart,
      onSetPreference: state.setPreference,
      onSetRuleConfig: state.setRuleConfig,
    })),
  );

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>{text(language, 'rulesAndSession')}</h2>
      </div>
      <div className="settings-list">
        {RULE_TOGGLE_DESCRIPTORS.map((descriptor) => {
          const inputId = checkboxId('rules', descriptor.key);

          return (
            <div key={descriptor.key} className="settings-row">
              <label htmlFor={inputId}>
                <input
                  id={inputId}
                  type="checkbox"
                  checked={descriptor.isEnabled(ruleConfig)}
                  onChange={(event) => onSetRuleConfig(descriptor.getPatch(event.target.checked))}
                />
                <span>{text(language, descriptor.labelKey)}</span>
              </label>
              <GlossaryTooltip language={language} termId={descriptor.glossaryTermId} />
            </div>
          );
        })}
        <div className="settings-row">
          <label htmlFor={checkboxId('session', 'overlay')}>
            <input
              id={checkboxId('session', 'overlay')}
              type="checkbox"
              checked={preferences.passDeviceOverlayEnabled}
              onChange={(event) =>
                onSetPreference({
                  passDeviceOverlayEnabled: event.target.checked,
                })
              }
            />
            <span>{text(language, 'passDeviceOverlay')}</span>
          </label>
          <GlossaryTooltip language={language} termId="passDeviceOverlay" />
        </div>
      </div>
      <div className="inline-actions">
        <button type="button" className="button" onClick={onRestart}>
          {text(language, 'restart')}
        </button>
      </div>
    </section>
  );
}

function HistorySection() {
  const { canRedo, canUndo, historyCursor, language, onGoToHistoryCursor, onRedo, onUndo, turnLog } = useGameStore(
    useShallow((state) => ({
      canRedo: state.future.length > 0,
      canUndo: state.past.length > 0,
      historyCursor: state.historyCursor,
      language: state.preferences.language,
      onGoToHistoryCursor: state.goToHistoryCursor,
      onRedo: state.redo,
      onUndo: state.undo,
      turnLog: state.turnLog,
    })),
  );
  const deferredTurnLog = useDeferredValue(turnLog);
  const historyEntries = deferredTurnLog
    .map((record, index) => ({ record, index }))
    .reverse();

  return (
    <section className="panel panel--history">
      <div className="panel__header">
        <h2>{text(language, 'history')}</h2>
      </div>
      <ol className="history-list">
        {historyEntries.map(({ record, index }) => {
          const isFuture = index >= historyCursor;

          return (
            <li key={`${record.positionHash}-${index}`}>
              <button
                type="button"
                className={isFuture ? 'history-item history-item--future' : 'history-item'}
                onClick={() => onGoToHistoryCursor(index + 1)}
                disabled={index + 1 === historyCursor}
              >
                {formatTurnRecord(language, record)}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="inline-actions">
        <button type="button" className="button button--ghost" onClick={onUndo} disabled={!canUndo}>
          {text(language, 'undo')}
        </button>
        <button type="button" className="button button--ghost" onClick={onRedo} disabled={!canRedo}>
          {text(language, 'redo')}
        </button>
      </div>
      <p className="panel__text">
        <strong>{text(language, 'historyCursor')}:</strong> {historyCursor}
      </p>
    </section>
  );
}

function ExportImportSection() {
  const {
    exportBuffer,
    importBuffer,
    importError,
    language,
    onImportBufferChange,
    onImportSession,
    onRefreshExport,
  } = useGameStore(
    useShallow((state) => ({
      exportBuffer: state.exportBuffer,
      importBuffer: state.importBuffer,
      importError: state.importError,
      language: state.preferences.language,
      onImportBufferChange: state.setImportBuffer,
      onImportSession: state.importSessionFromBuffer,
      onRefreshExport: state.refreshExportBuffer,
    })),
  );

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>{text(language, 'exportImport')}</h2>
      </div>
      <div className="inline-actions">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => startTransition(() => onRefreshExport())}
        >
          {text(language, 'refreshExport')}
        </button>
      </div>
      <label className="field-label" htmlFor="export-session">
        {text(language, 'currentSessionJson')}
      </label>
      <textarea id="export-session" className="session-textarea" readOnly value={exportBuffer} />
      <label className="field-label" htmlFor="import-session">
        {text(language, 'importJson')}
      </label>
      <textarea
        id="import-session"
        className="session-textarea"
        value={importBuffer}
        onChange={(event) => onImportBufferChange(event.target.value)}
      />
      {importError ? <p className="panel__error">{text(language, 'importFailed')}</p> : null}
      <div className="inline-actions">
        <button type="button" className="button" onClick={onImportSession}>
          {text(language, 'importSession')}
        </button>
      </div>
    </section>
  );
}

/** Game-tab side panel: status, move input, and history. */
export function GameControlPanel() {
  return (
    <aside className="side-panel side-panel--game">
      <StatusSection />
      <MoveInputSection />
      <HistorySection />
    </aside>
  );
}

/** Settings-tab side panel: rules, session controls, and import/export. */
export function SettingsPanel() {
  return (
    <aside className="side-panel side-panel--settings">
      <RulesSessionSection />
      <ExportImportSection />
    </aside>
  );
}

/** Backward-compatible export retained for existing imports. */
export function ControlPanel() {
  return <GameControlPanel />;
}
