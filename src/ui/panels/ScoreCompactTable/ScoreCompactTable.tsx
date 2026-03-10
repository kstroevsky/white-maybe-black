import type { ScoreSummary } from '@/domain';
import type { GlossaryTermId } from '@/features/glossary/terms';
import { text } from '@/shared/i18n/catalog';
import type { Language } from '@/shared/i18n/types';
import { GlossaryTooltip } from '@/ui/tooltips/GlossaryTooltip';

import styles from './style.module.scss';

type ScoreCompactTableProps = {
  language: Language;
  scoreSummary: ScoreSummary;
};

type ScoreRow = {
  black: number;
  label: string;
  termId: GlossaryTermId;
  white: number;
};

export function ScoreCompactTable({ language, scoreSummary }: ScoreCompactTableProps) {
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
    <div className={styles.root}>
      <div className={styles.header}>
        <strong>{text(language, 'scoreMode')}</strong>
        <GlossaryTooltip language={language} termId="scoreMode" />
      </div>
      <div className={styles.table} role="table" aria-label={text(language, 'scoreMode')}>
        <div className={styles.row} data-head="true" role="row">
          <span role="columnheader" />
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
              <span key={`${row.label}-${metrics[index].termId}`} role="cell">
                {value}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
