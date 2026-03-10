import { GameControlPanel } from '@/ui/panels/GameControlPanel';
import { TurnSummaryStrip } from '@/ui/panels/StatusSection';
import { Panel } from '@/ui/primitives/Panel';
import { useIsMobileViewport } from '@/shared/hooks/useIsMobileViewport';

import { BoardStage } from './BoardStage';
import { DesktopScoreStrip } from './DesktopScoreStrip';
import { MobileGameTray } from './MobileGameTray';
import styles from './style.module.scss';

export function GameTab() {
  const isCompactLayout = useIsMobileViewport(960);

  return (
    <div className={styles.root} role="tabpanel" data-layout={isCompactLayout ? 'compact' : 'desktop'}>
      {isCompactLayout ? (
        <div className={styles.compactShell}>
          <div className={styles.boardSlot}>
            <BoardStage />
          </div>
          <Panel className={styles.summaryPanel}>
            <TurnSummaryStrip compact />
          </Panel>
          <MobileGameTray />
        </div>
      ) : (
        <>
          <DesktopScoreStrip />
          <div className={styles.layout}>
            <div className={styles.boardSlot}>
              <BoardStage />
            </div>
            <div className={styles.panelSlot}>
              <GameControlPanel />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
