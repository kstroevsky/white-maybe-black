import { useShallow } from 'zustand/react/shallow';

import { useGameStore } from '@/app/providers/GameStoreProvider';
import { Button } from '@/ui/primitives/Button';
import { formatPassOverlayLabel, formatTurnBanner, text } from '@/shared/i18n/catalog';

import styles from './style.module.scss';

export function TurnOverlay() {
  const { interaction, language, matchSettings, acknowledgePassScreen } = useGameStore(
    useShallow((state) => ({
      interaction: state.interaction,
      language: state.preferences.language,
      matchSettings: state.matchSettings,
      acknowledgePassScreen: state.acknowledgePassScreen,
    })),
  );

  if (matchSettings.opponentMode === 'computer') {
    return null;
  }

  if (interaction.type !== 'passingDevice' && interaction.type !== 'turnResolved') {
    return null;
  }

  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.panel}>
        <p>{formatTurnBanner(language, interaction.nextPlayer)}</p>
        <small>{formatPassOverlayLabel(language, interaction.nextPlayer)}</small>
        <Button onClick={acknowledgePassScreen}>{text(language, 'continue')}</Button>
      </div>
    </div>
  );
}
