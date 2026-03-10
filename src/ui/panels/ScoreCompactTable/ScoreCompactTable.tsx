import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';
import type { ScoreSummary } from '@/domain';
import type { GlossaryTermId } from '@/features/glossary/terms';
import { text } from '@/shared/i18n/catalog';
import type { Language } from '@/shared/i18n/types';
import { GlossaryTooltip } from '@/ui/tooltips/GlossaryTooltip';

import styles from './style.module.scss';

type ScoreCompactTableProps = {
  compact?: boolean;
  language: Language;
  scoreSummary: ScoreSummary;
};

type ScoreRow = {
  black: number;
  label: string;
  termId: GlossaryTermId;
  white: number;
};

export function ScoreCompactTable({ compact = false, language, scoreSummary }: ScoreCompactTableProps) {
  const isCompactViewport = useIsMobileViewport(720);
  const isCompactLayout = compact || isCompactViewport;
  const metrics: ScoreRow[] = [
    {
      label: text(language, 'scoreHomeSingles'),
      termId: 'homeFieldSingles',
      white: scoreSummary.homeFieldSingles.white,
      black: scoreSummary.homeFieldSingles.black,
    },
    {
      label: text(language, 'scoreControlledStacks'),
      termId: 'controlledStacks',
      white: scoreSummary.controlledStacks.white,
      black: scoreSummary.controlledStacks.black,
    },
    {
      label: text(language, 'scoreFrontRowStacks'),
      termId: 'frontRowStacks',
      white: scoreSummary.controlledHomeRowHeightThreeStacks.white,
      black: scoreSummary.controlledHomeRowHeightThreeStacks.black,
    },
    {
      label: text(language, 'scoreFrozenEnemySingles'),
      termId: 'frozenEnemySingles',
      white: scoreSummary.frozenEnemySingles.white,
      black: scoreSummary.frozenEnemySingles.black,
    },
  ];

  const playerRows = [
    {
      label: text(language, 'scoreWhite'),
      values: metrics.map((metric) => metric.white),
    },
    {
      label: text(language, 'scoreBlack'),
      values: metrics.map((metric) => metric.black),
    },
  ];

  return (
    <div className={styles.root} data-layout={isCompactLayout ? 'compact' : 'desktop'}>
      <div className={styles.header}>
        <strong>{text(language, 'scoreMode')}</strong>
        <GlossaryTooltip compact={isCompactLayout} language={language} termId="scoreMode" />
      </div>
      {isCompactLayout ? (
        <div className={styles.mobileTable} role="table" aria-label={text(language, 'scoreMode')}>
          <div className={styles.mobileHead} role="row">
            <span role="columnheader" />
            <span className={styles.mobilePlayerHead} role="columnheader">
              {text(language, 'scoreWhite')}
            </span>
            <span className={styles.mobilePlayerHead} role="columnheader">
              {text(language, 'scoreBlack')}
            </span>
          </div>
          {metrics.map((metric) => (
            <div key={metric.termId} className={styles.mobileRow} role="row">
              <div className={styles.mobileMetric} role="rowheader">
                <span>{metric.label}</span>
                <GlossaryTooltip compact language={language} termId={metric.termId} />
              </div>
              <span className={styles.value} role="cell">
                {metric.white}
              </span>
              <span className={styles.value} role="cell">
                {metric.black}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.scrollArea}>
          <div className={styles.table} role="table" aria-label={text(language, 'scoreMode')}>
            <div className={styles.row} data-head="true" role="row">
              <div className={styles.cornerCell} aria-hidden="true" />
              {metrics.map((metric) => (
                <div key={metric.termId} className={styles.metricHead} role="columnheader">
                  <span>{metric.label}</span>
                  <GlossaryTooltip language={language} termId={metric.termId} />
                </div>
              ))}
            </div>
            {playerRows.map((row) => (
              <div key={row.label} className={styles.row} role="row">
                <span className={styles.player} role="rowheader">
                  {row.label}
                </span>
                {row.values.map((value, index) => (
                  <span key={`${row.label}-${metrics[index].termId}`} className={styles.value} role="cell">
                    {value}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
