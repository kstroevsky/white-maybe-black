import { useGameStore } from '@/app/providers/GameStoreProvider';
import { InstructionsView } from '@/ui/panels/InstructionsView';

/** Instructions tab keeps rules text in an internally scrolling container. */
export function InstructionsTab() {
  const language = useGameStore((state) => state.preferences.language);

  return (
    <div className="tab-scroll" role="tabpanel">
      <InstructionsView language={language} />
    </div>
  );
}
