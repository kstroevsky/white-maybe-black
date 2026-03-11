import { lazy, Suspense, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGameStore } from '@/app/providers/GameStoreProvider';

const MoveInputModal = lazy(() => import('./MoveInputModal').then((module) => ({ default: module.MoveInputModal })));

export function MoveInputPanel() {
  const {
    availableActionKinds,
    selectedActionType,
    selectedCell,
    onCancel,
  } = useGameStore(
    useShallow((state) => ({
      availableActionKinds: state.availableActionKinds,
      selectedActionType: state.selectedActionType,
      selectedCell: state.selectedCell,
      onCancel: state.cancelInteraction,
    })),
  );

  const isChoiceModalOpen =
    selectedCell !== null && selectedActionType === null && availableActionKinds.length > 0;

  useEffect(() => {
    if (!isChoiceModalOpen) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChoiceModalOpen, onCancel]);

  return (
    <Suspense>
      {isChoiceModalOpen ? <MoveInputModal/> : null}
    </Suspense>
  );
}
