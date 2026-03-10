import { useShallow } from 'zustand/react/shallow';

import type { GameState, Victory } from '@/domain';
import { useGameStore } from '@/app/providers/GameStoreProvider';
import type { GlossaryTermId } from '@/features/glossary/terms';
import { describeInteraction, formatVictory, playerLabel, text } from '@/shared/i18n/catalog';
import type { Language } from '@/shared/i18n/types';
import { GlossaryTooltip } from '@/ui/tooltips/GlossaryTooltip';

import styles from './style.module.scss';

type TurnSummaryStripProps = {
  compact?: boolean;
};

function getTurnLabel(language: Language, currentPlayer: GameState['currentPlayer']): string {
  return language === 'russian'
    ? `${playerLabel(language, currentPlayer)} ходят`
    : `${playerLabel(language, currentPlayer)} turn`;
}

export function getVictoryTermId(victory: Victory): GlossaryTermId | null {
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

export function TurnSummaryStrip({ compact = false }: TurnSummaryStripProps) {
  const { currentPlayer, interaction, language, moveNumber, selectedCell, victory } = useGameStore(
    useShallow((state) => ({
      currentPlayer: state.gameState.currentPlayer,
      interaction: state.interaction,
      language: state.preferences.language,
      moveNumber: state.gameState.moveNumber,
      selectedCell: state.selectedCell,
      victory: state.gameState.victory,
    })),
  );
  const victoryTermId = getVictoryTermId(victory);

  return (
    <div className={styles.summary} data-compact={compact || undefined}>
      <div className={styles.turnBanner}>
        <p>{getTurnLabel(language, currentPlayer)}</p>
        <small>{describeInteraction(language, interaction)}</small>
      </div>

      <div className={styles.metaGrid}>
        <p className={styles.textRow}>
          <strong>{text(language, 'moveNumberLabel')}:</strong> {moveNumber}
        </p>
        <p className={styles.textRowInline}>
          <strong>{text(language, 'statusLabel')}:</strong> {formatVictory(language, victory)}
          {victoryTermId ? <GlossaryTooltip language={language} termId={victoryTermId} /> : null}
        </p>
        {selectedCell ? (
          <p className={styles.textRow}>
            <strong>{text(language, 'selectedCellLabel')}:</strong> {selectedCell}
          </p>
        ) : null}
      </div>
    </div>
  );
}
