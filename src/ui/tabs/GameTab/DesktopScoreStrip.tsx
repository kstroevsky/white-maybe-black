import { useShallow } from 'zustand/react/shallow';

import { useGameStore } from '@/app/providers/GameStoreProvider';
import { ScoreCompactTable } from '@/ui/panels/ScoreCompactTable';

export function DesktopScoreStrip() {
  const { language, scoreSummary } = useGameStore(
    useShallow((state) => ({
      language: state.preferences.language,
      scoreSummary: state.scoreSummary,
    })),
  );

  if (!scoreSummary) {
    return null;
  }

  return <ScoreCompactTable language={language} scoreSummary={scoreSummary} />;
}
