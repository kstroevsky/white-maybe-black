import { startTransition, useEffect, useId, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useGameStore } from '@/app/providers/GameStoreProvider';
import { text } from '@/shared/i18n/catalog';
import type { Language } from '@/shared/i18n/types';
import { HistorySection } from '@/ui/panels/HistorySection';
import { MoveInputPanel } from '@/ui/panels/MoveInputPanel';
import { Button } from '@/ui/primitives/Button';

import { GameInfoPane } from './GameInfoPane';
import styles from './style.module.scss';

export type MobileTrayTab = 'actions' | 'history' | 'info';

const TABS: MobileTrayTab[] = ['actions', 'history', 'info'];

function getTabLabel(language: Language, tab: MobileTrayTab): string {
  switch (tab) {
    case 'actions':
      return text(language, 'trayActions');
    case 'history':
      return text(language, 'history');
    case 'info':
      return text(language, 'trayInfo');
  }
}

export function MobileGameTray() {
  const trayId = useId();
  const [activeTab, setActiveTab] = useState<MobileTrayTab>('actions');
  const { availableActionCount, language, selectedActionType, selectedCell } = useGameStore(
    useShallow((state) => ({
      availableActionCount: state.availableActionKinds.length,
      language: state.preferences.language,
      selectedActionType: state.selectedActionType,
      selectedCell: state.selectedCell,
    })),
  );

  useEffect(() => {
    if (selectedCell || selectedActionType || availableActionCount > 0) {
      setActiveTab('actions');
    }
  }, [availableActionCount, selectedActionType, selectedCell]);

  return (
    <section className={styles.mobileTray}>
      <div
        className={styles.mobileTrayTabs}
        role="tablist"
        aria-label={text(language, 'gameTraySectionsLabel')}
      >
        {TABS.map((tab) => (
          <Button
            key={tab}
            fullWidth
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`${trayId}-${tab}`}
            variant={activeTab === tab ? 'active' : 'ghost'}
            onClick={() => startTransition(() => setActiveTab(tab))}
          >
            {getTabLabel(language, tab)}
          </Button>
        ))}
      </div>

      <div className={styles.mobileTrayBody}>
        {activeTab === 'actions' ? (
          <div id={`${trayId}-actions`} className={styles.mobileTrayPane} role="tabpanel">
            <MoveInputPanel />
          </div>
        ) : null}
        {activeTab === 'history' ? (
          <div id={`${trayId}-history`} className={styles.mobileTrayPane} role="tabpanel">
            <HistorySection />
          </div>
        ) : null}
        {activeTab === 'info' ? (
          <div id={`${trayId}-info`} className={styles.mobileTrayPane} role="tabpanel">
            <GameInfoPane />
          </div>
        ) : null}
      </div>
    </section>
  );
}
