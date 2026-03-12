import type { ActionKind, Player } from '@/domain';
import type { Language } from '@/shared/i18n/types';

export const PLAYER_LABELS: Record<Language, Record<Player, string>> = {
  english: {
    white: 'White',
    black: 'Black',
  },
  russian: {
    white: 'Белые',
    black: 'Чёрные',
  },
};

export const ACTION_LABELS: Record<Language, Record<ActionKind, string>> = {
  english: {
    jumpSequence: 'Jump',
    manualUnfreeze: 'Unfreeze',
    climbOne: 'Climb',
    moveSingleToEmpty: 'Step to empty',
    splitOneFromStack: 'Split 1',
    splitTwoFromStack: 'Split 2',
    friendlyStackTransfer: 'Friendly transfer',
  },
  russian: {
    jumpSequence: 'Прыжок',
    manualUnfreeze: 'Разморозка',
    climbOne: 'Восхождение',
    moveSingleToEmpty: 'Шаг на пустую',
    splitOneFromStack: 'Сход 1',
    splitTwoFromStack: 'Сход 2',
    friendlyStackTransfer: 'Перенос к своей',
  },
};
