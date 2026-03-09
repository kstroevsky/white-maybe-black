import { lazy, startTransition, Suspense, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useGameStore } from '@/app/providers/GameStoreProvider';
import { playerLabel, text } from '@/shared/i18n/catalog';
import type { Language } from '@/shared/i18n/types';

const GameTab = lazy(() => import('@/ui/tabs/GameTab').then((module) => ({ default: module.GameTab })));
const InstructionsTab = lazy(() =>
  import('@/ui/tabs/InstructionsTab').then((module) => ({ default: module.InstructionsTab })),
);
const SettingsTab = lazy(() =>
  import('@/ui/tabs/SettingsTab').then((module) => ({ default: module.SettingsTab })),
);

type AppTab = 'game' | 'instructions' | 'settings';

/** Returns overlay title for turn handoff screen. */
function getTurnOverlayTitle(language: Language, player: 'white' | 'black'): string {
  return language === 'russian'
    ? `${playerLabel(language, player)} ходят`
    : `${playerLabel(language, player)} turn`;
}

/** Returns localized instruction text for pass-device overlay. */
function getPassOverlayLabel(language: Language, player: 'white' | 'black'): string {
  return language === 'russian'
    ? `Передайте устройство: ${playerLabel(language, player).toLowerCase()}.`
    : `Pass the device to ${playerLabel(language, player)}.`;
}

/** Shared hot-seat overlay isolated from non-overlay app state. */
function TurnOverlay() {
  const { interaction, language, acknowledgePassScreen } = useGameStore(
    useShallow((state) => ({
      interaction: state.interaction,
      language: state.preferences.language,
      acknowledgePassScreen: state.acknowledgePassScreen,
    })),
  );

  if (interaction.type !== 'passingDevice' && interaction.type !== 'turnResolved') {
    return null;
  }

  return (
    <div className="pass-overlay" role="presentation">
      <div className="pass-overlay__panel">
        <p>{getTurnOverlayTitle(language, interaction.nextPlayer)}</p>
        <small>{getPassOverlayLabel(language, interaction.nextPlayer)}</small>
        <button type="button" className="button" onClick={acknowledgePassScreen}>
          {text(language, 'continue')}
        </button>
      </div>
    </div>
  );
}

/** Root screen component wiring isolated store-connected views into the app shell. */
export function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('game');
  const { language, setPreference } = useGameStore(
    useShallow((state) => ({
      language: state.preferences.language,
      setPreference: state.setPreference,
    })),
  );

  return (
    <>
      <main className="app-shell">
        <header className="app-header">
          <div className="app-header__main">
            <div>
              <h1>{text(language, 'appTitle')}</h1>
              <p>{text(language, 'appTagline')}</p>
            </div>
            <div className="language-switch" aria-label={text(language, 'languageSwitchLabel')}>
              <button
                type="button"
                className={language === 'russian' ? 'button button--active' : 'button button--ghost'}
                onClick={() => setPreference({ language: 'russian' })}
              >
                {text(language, 'languageRussian')}
              </button>
              <button
                type="button"
                className={language === 'english' ? 'button button--active' : 'button button--ghost'}
                onClick={() => setPreference({ language: 'english' })}
              >
                {text(language, 'languageEnglish')}
              </button>
            </div>
          </div>
          <div className="app-tabs" role="tablist" aria-label={text(language, 'appSectionsLabel')}>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'game'}
              className={activeTab === 'game' ? 'tab-button tab-button--active' : 'tab-button'}
              onClick={() => startTransition(() => setActiveTab('game'))}
            >
              {text(language, 'tabGame')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'instructions'}
              className={activeTab === 'instructions' ? 'tab-button tab-button--active' : 'tab-button'}
              onClick={() => startTransition(() => setActiveTab('instructions'))}
            >
              {text(language, 'tabInstructions')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'settings'}
              className={activeTab === 'settings' ? 'tab-button tab-button--active' : 'tab-button'}
              onClick={() => startTransition(() => setActiveTab('settings'))}
            >
              {text(language, 'tabSettings')}
            </button>
          </div>
        </header>

        <section className="app-content">
          <Suspense fallback={<div className="tab-loading" aria-hidden="true" />}>
            {activeTab === 'game' ? <GameTab /> : null}
            {activeTab === 'instructions' ? <InstructionsTab /> : null}
            {activeTab === 'settings' ? <SettingsTab /> : null}
          </Suspense>
        </section>
      </main>

      <TurnOverlay />
    </>
  );
}
