import { Panel } from '@/ui/primitives/Panel';

import { MoveInputPanel } from '../MoveInputPanel';
import { TurnSummaryStrip } from './TurnSummaryStrip';

import styles from './style.module.scss';

export function StatusSection() {
  return (
    <Panel className={styles.root}>
      <TurnSummaryStrip />
      <MoveInputPanel />
    </Panel>
  );
}
