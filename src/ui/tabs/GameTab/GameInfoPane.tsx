import { useShallow } from 'zustand/react/shallow';

import { useGameStore } from '@/app/providers/GameStoreProvider';
import { describeInteraction, formatVictory, text } from '@/shared/i18n/catalog';
import { ScoreCompactTable } from '@/ui/panels/ScoreCompactTable';
import { getVictoryTermId } from '@/ui/panels/StatusSection/TurnSummaryStrip';
import { Panel } from '@/ui/primitives/Panel';
import { GlossaryTooltip } from '@/ui/tooltips/GlossaryTooltip';

import styles from './style.module.scss';

export function GameInfoPane() {
  const { interaction, language, scoreSummary, victory } = useGameStore(
    useShallow((state) => ({
      interaction: state.interaction,
      language: state.preferences.language,
      scoreSummary: state.scoreSummary,
      victory: state.gameState.victory,
    })),
  );
  const victoryTermId = getVictoryTermId(victory);

  return (
    <div className={styles.infoPane}>
      {scoreSummary ? (
        <ScoreCompactTable compact language={language} scoreSummary={scoreSummary} />
      ) : (
        <Panel className={styles.infoCard}>
          <div className={styles.infoHeading}>
            <strong>{text(language, 'scoreMode')}</strong>
          </div>
          <p className={styles.infoText}>{text(language, 'scoreDisabledHint')}</p>
        </Panel>
      )}

      <Panel className={styles.infoCard}>
        <div className={styles.infoHeading}>
          <strong>{text(language, 'trayInfo')}</strong>
        </div>
        <p className={styles.infoRow}>
          <strong>{text(language, 'statusLabel')}:</strong> {formatVictory(language, victory)}
          {victoryTermId ? <GlossaryTooltip language={language} termId={victoryTermId} /> : null}
        </p>
        <p className={styles.infoText}>{describeInteraction(language, interaction)}</p>
        <p className={styles.infoHint}>{text(language, 'glossaryHint')}</p>
      </Panel>
    </div>
  );
}
