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
  const { currentPlayer, interaction, moveNumber, selectedCell, victory, language } = useGameStore(
    useShallow((state) => ({
      currentPlayer: state.gameState.currentPlayer,
      interaction: state.interaction,
      moveNumber: state.gameState.moveNumber,
      selectedCell: state.selectedCell,
      victory: state.gameState.victory,
      language: state.preferences.language,
    })),
  );
  const victoryTermId = getVictoryTermId(victory);

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

function ScoreSection() {
  const { language, scoreSummary } = useGameStore(
    useShallow((state) => ({
      language: state.preferences.language,
      scoreSummary: state.scoreSummary,
    })),
  );

  if (!scoreSummary) {
    return null;
  }

  const scoreItems = [
    {
      label: text(language, 'whiteHomeSingles'),
      termId: 'homeFieldSingles' as const,
      value: scoreSummary.homeFieldSingles.white,
    },
    {
      label: text(language, 'blackHomeSingles'),
      termId: 'homeFieldSingles' as const,
      value: scoreSummary.homeFieldSingles.black,
    },
    {
      label: text(language, 'whiteStacks'),
      termId: 'controlledStacks' as const,
      value: scoreSummary.controlledStacks.white,
    },
    {
      label: text(language, 'blackStacks'),
      termId: 'controlledStacks' as const,
      value: scoreSummary.controlledStacks.black,
    },
    {
      label: text(language, 'whiteFrontRowStacks'),
      termId: 'frontRowStacks' as const,
      value: scoreSummary.controlledHomeRowHeightThreeStacks.white,
    },
    {
      label: text(language, 'blackFrontRowStacks'),
      termId: 'frontRowStacks' as const,
      value: scoreSummary.controlledHomeRowHeightThreeStacks.black,
    },
    {
      label: text(language, 'whiteFrozenEnemySingles'),
      termId: 'frozenEnemySingles' as const,
      value: scoreSummary.frozenEnemySingles.white,
    },
    {
      label: text(language, 'blackFrozenEnemySingles'),
      termId: 'frozenEnemySingles' as const,
      value: scoreSummary.frozenEnemySingles.black,
    },
  ];

  return (
    <section className="panel">
      <div className="panel__header panel__header--with-tooltip">
        <h2>{text(language, 'scoreMode')}</h2>
        <GlossaryTooltip language={language} termId="scoreMode" />
      </div>
      <dl className="score-grid">
        {scoreItems.map((item) => (
          <div key={`${item.label}-${item.value}`}>
            <dt className="score-grid__term">
              <span>{item.label}</span>
              <GlossaryTooltip language={language} termId={item.termId} />
            </dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RulesSessionSection() {
  const {
    canRedo,
    canUndo,
    historyCursor,
    language,
    preferences,
    ruleConfig,
    onRedo,
    onRestart,
    onSetPreference,
    onSetRuleConfig,
    onUndo,
  } = useGameStore(
    useShallow((state) => ({
      canRedo: state.future.length > 0,
      canUndo: state.past.length > 0,
      historyCursor: state.historyCursor,
      language: state.preferences.language,
      preferences: state.preferences,
      ruleConfig: state.ruleConfig,
      onRedo: state.redo,
      onRestart: state.restart,
      onSetPreference: state.setPreference,
      onSetRuleConfig: state.setRuleConfig,
      onUndo: state.undo,
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
        <button type="button" className="button button--ghost" onClick={onUndo} disabled={!canUndo}>
          {text(language, 'undo')}
        </button>
        <button type="button" className="button button--ghost" onClick={onRedo} disabled={!canRedo}>
          {text(language, 'redo')}
        </button>
        <button type="button" className="button" onClick={onRestart}>
          {text(language, 'restart')}
        </button>
      </div>
      <p className="panel__text">
        <strong>{text(language, 'historyCursor')}:</strong> {historyCursor}
      </p>
    </section>
  );
}

function HistorySection() {
  const { historyCursor, language, turnLog } = useGameStore(
    useShallow((state) => ({
      historyCursor: state.historyCursor,
      language: state.preferences.language,
      turnLog: state.turnLog,
    })),
  );
  const deferredHistory = useDeferredValue(turnLog.slice(0, historyCursor));

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>{text(language, 'history')}</h2>
      </div>
      <ol className="history-list">
        {[...deferredHistory].reverse().map((record, index) => (
          <li key={`${record.positionHash}-${index}`}>{formatTurnRecord(language, record)}</li>
        ))}
      </ol>
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

/** Side panel coordinating actions, settings, history, and session import/export controls. */
export function ControlPanel() {
  return (
    <aside className="side-panel">
      <StatusSection />
      <MoveInputSection />
      <ScoreSection />
      <RulesSessionSection />
      <HistorySection />
      <ExportImportSection />
    </aside>
  );
}
