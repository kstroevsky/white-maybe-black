import type { ActionKind, Player, TurnAction, TurnRecord, Victory } from '@/domain';
import type { Language } from '@/shared/i18n/types';
import type { InteractionState } from '@/shared/types/session';

const TEXT = {
  english: {
    appTitle: 'White Maybe Black',
    appTagline: 'Local hot-seat play on one screen.',
    tabGame: 'Game',
    tabInstructions: 'Instructions',
    tabSettings: 'Settings',
    languageSwitchLabel: 'Language switch',
    appSectionsLabel: 'App sections',
    languageRussian: 'Русский',
    languageEnglish: 'English',
    boardAriaLabel: 'Game board',
    cellLabel: 'Cell',
    continue: 'Continue',
    close: 'Close',
    moveNumberLabel: 'Move',
    statusLabel: 'Status',
    gameResult: 'Final result',
    selectedCellLabel: 'Selected cell',
    moveChoiceDialog: 'Choose a move',
    moveChoiceModalHint: 'Move type selection opens in a dialog over the board.',
    moveInput: 'Move input',
    noActionsSelected: 'Select a checker or controlled stack to see actions.',
    moveUnavailable: 'No legal move types for the current selection.',
    jumpPathLabel: 'Jump source',
    jumpPathHint: 'Each highlighted landing applies one jump segment immediately.',
    clear: 'Clear',
    trayActions: 'Actions',
    trayInfo: 'Info',
    gameTraySectionsLabel: 'Game tray sections',
    glossaryHint: 'Use the ? buttons for compact rule notes and scoring terms.',
    scoreDisabledHint: 'Score mode is off for this session.',
    scoreMode: 'Score mode',
    scoreWhite: 'White',
    scoreBlack: 'Black',
    scoreHomeSingles: 'Home singles',
    scoreControlledStacks: 'Controlled stacks',
    scoreFrontRowStacks: 'Front-row 3-stacks',
    scoreFrozenEnemySingles: 'Frozen enemy singles',
    rulesAndSession: 'Rules and session',
    matchSetup: 'Match setup',
    matchSetupHint: 'Applies when you start a new game.',
    opponentMode: 'Opponent',
    hotSeat: 'Hot-seat',
    computerOpponent: 'Play vs computer',
    playAs: 'Play as',
    aiDifficulty: 'Difficulty',
    difficultyEasy: 'Easy',
    difficultyMedium: 'Medium',
    difficultyHard: 'Hard',
    startNewGame: 'Start new game',
    matchModeLabel: 'Mode',
    computerThinking: 'Computer thinking…',
    retryComputerMove: 'Retry computer move',
    computerMoveFailed: 'Computer move failed.',
    passDeviceOverlay: 'Pass-device overlay',
    'rule.nonAdjacentFriendlyTransfer': 'Non-adjacent friendly transfer',
    'rule.threefoldDraw': 'Threefold repetition draw',
    'rule.basicScore': 'Basic score summary',
    undo: 'Undo',
    redo: 'Redo',
    restart: 'Restart',
    historyCursor: 'History cursor',
    history: 'History',
    historyLastTen: 'Last 10 moves',
    exportImport: 'Export / Import',
    refreshExport: 'Refresh export',
    currentSessionJson: 'Current session JSON',
    importJson: 'Import JSON',
    importSession: 'Import session',
    importFailed: 'Failed to import the session JSON.',
    whiteHomeSingles: 'White home singles',
    blackHomeSingles: 'Black home singles',
    whiteStacks: 'White stacks',
    blackStacks: 'Black stacks',
    whiteFrontRowStacks: 'White front-row 3-stacks',
    blackFrontRowStacks: 'Black front-row 3-stacks',
    whiteFrozenEnemySingles: 'White frozen enemy singles',
    blackFrozenEnemySingles: 'Black frozen enemy singles',
    instructionsTitle: 'Canonical instructions',
    instructionsSubtitle: 'The game state stays live while you read.',
    gameActive: 'Active',
  },
  russian: {
    appTitle: 'White Maybe Black',
    appTagline: 'Локальная hot-seat партия на одном экране.',
    tabGame: 'Игра',
    tabInstructions: 'Инструкция',
    tabSettings: 'Настройки',
    languageSwitchLabel: 'Переключение языка',
    appSectionsLabel: 'Разделы приложения',
    languageRussian: 'Русский',
    languageEnglish: 'English',
    boardAriaLabel: 'Игровое поле',
    cellLabel: 'Клетка',
    continue: 'Продолжить',
    close: 'Закрыть',
    moveNumberLabel: 'Ход',
    statusLabel: 'Статус',
    gameResult: 'Итог партии',
    selectedCellLabel: 'Выбранная клетка',
    moveChoiceDialog: 'Выберите ход',
    moveChoiceModalHint: 'Тип хода выбирается в окне поверх доски.',
    moveInput: 'Выбор действия',
    noActionsSelected: 'Выберите шашку или свою горку, чтобы увидеть ходы.',
    moveUnavailable: 'Для текущего выбора нет допустимых типов хода.',
    jumpPathLabel: 'Источник прыжка',
    jumpPathHint: 'Каждая подсвеченная цель сразу применяет один участок прыжка.',
    clear: 'Сбросить',
    trayActions: 'Ходы',
    trayInfo: 'Инфо',
    gameTraySectionsLabel: 'Секции игровой панели',
    glossaryHint: 'Используйте кнопки ? для кратких пояснений по правилам и подсчёту.',
    scoreDisabledHint: 'Подсчёт в этой партии отключён.',
    scoreMode: 'Подсчёт',
    scoreWhite: 'Белые',
    scoreBlack: 'Чёрные',
    scoreHomeSingles: 'Одиночные на своём поле',
    scoreControlledStacks: 'Контролируемые горки',
    scoreFrontRowStacks: 'Горки 3 на переднем ряду',
    scoreFrozenEnemySingles: 'Замороженные чужие одиночные',
    rulesAndSession: 'Правила и партия',
    matchSetup: 'Параметры матча',
    matchSetupHint: 'Применится при старте новой партии.',
    opponentMode: 'Соперник',
    hotSeat: 'Hot-seat',
    computerOpponent: 'Играть с компьютером',
    playAs: 'Играть за',
    aiDifficulty: 'Сложность',
    difficultyEasy: 'Лёгкий',
    difficultyMedium: 'Средний',
    difficultyHard: 'Сильный',
    startNewGame: 'Начать новую партию',
    matchModeLabel: 'Режим',
    computerThinking: 'Компьютер думает…',
    retryComputerMove: 'Повторить ход компьютера',
    computerMoveFailed: 'Компьютер не смог сделать ход.',
    passDeviceOverlay: 'Экран передачи устройства',
    'rule.nonAdjacentFriendlyTransfer': 'Дальний перенос на свою горку',
    'rule.threefoldDraw': 'Ничья по трёхкратному повторению',
    'rule.basicScore': 'Базовый подсчёт',
    undo: 'Назад',
    redo: 'Вперёд',
    restart: 'Новая партия',
    historyCursor: 'Позиция истории',
    history: 'История',
    historyLastTen: 'Последние 10 ходов',
    exportImport: 'Экспорт / импорт',
    refreshExport: 'Обновить экспорт',
    currentSessionJson: 'Текущий JSON партии',
    importJson: 'Импорт JSON',
    importSession: 'Импортировать партию',
    importFailed: 'Не удалось импортировать JSON партии.',
    whiteHomeSingles: 'Белые одиночные на своём поле',
    blackHomeSingles: 'Чёрные одиночные на своём поле',
    whiteStacks: 'Белые горки',
    blackStacks: 'Чёрные горки',
    whiteFrontRowStacks: 'Белые горки 3 на переднем ряду',
    blackFrontRowStacks: 'Чёрные горки 3 на переднем ряду',
    whiteFrozenEnemySingles: 'Белые заморозили чужих одиночных',
    blackFrozenEnemySingles: 'Чёрные заморозили чужих одиночных',
    instructionsTitle: 'Каноническая инструкция',
    instructionsSubtitle: 'Состояние партии сохраняется, пока вы читаете.',
    gameActive: 'Игра продолжается',
  },
} as const;

export type TextKey = keyof (typeof TEXT)['english'];

const PLAYER_LABELS: Record<Language, Record<Player, string>> = {
  english: {
    white: 'White',
    black: 'Black',
  },
  russian: {
    white: 'Белые',
    black: 'Чёрные',
  },
};

const ACTION_LABELS: Record<Language, Record<ActionKind, string>> = {
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

type InteractionCopy = {
  idle: string;
  pieceSelected: (source: string) => string;
  actionTypeSelected: (actionLabel: string) => string;
  choosingTarget: (actionLabel: string, source: string) => string;
  buildingJumpChain: (source: string) => string;
  turnResolved: (nextPlayerLabel: string) => string;
  passingDevice: (nextPlayerLabel: string) => string;
  gameOver: string;
};

const INTERACTION_COPY: Record<Language, InteractionCopy> = {
  english: {
    idle: 'Select a checker or controlled stack.',
    pieceSelected: (source) => `Selected ${source}. Choose a move type.`,
    actionTypeSelected: (action) => `Action ${action} is selected.`,
    choosingTarget: (action, source) => `Choose a target for ${action} from ${source}.`,
    buildingJumpChain: (source) =>
      `Choose the next jump landing from ${source}. Each click applies one segment immediately.`,
    turnResolved: (nextPlayer) => `Turn resolved. ${nextPlayer} is next.`,
    passingDevice: (nextPlayer) => `Pass the device to ${nextPlayer}.`,
    gameOver: 'Game over.',
  },
  russian: {
    idle: 'Выберите шашку или контролируемую горку.',
    pieceSelected: (source) => `Выбрана ${source}. Теперь выберите тип хода.`,
    actionTypeSelected: (action) => `Выбрано действие «${action}».`,
    choosingTarget: (action, source) => `Выберите цель для «${action}» из ${source}.`,
    buildingJumpChain: (source) =>
      `Выберите следующую цель прыжка из ${source}. Каждый клик применяет один участок сразу.`,
    turnResolved: (nextPlayer) => `Ход завершён. Дальше ходят ${nextPlayer.toLowerCase()}.`,
    passingDevice: (nextPlayer) => `Передайте устройство: ходят ${nextPlayer.toLowerCase()}.`,
    gameOver: 'Игра окончена.',
  },
};

type VictoryCopy = {
  none: string;
  homeField: (winner: string) => string;
  sixStacks: (winner: string) => string;
  threefoldDraw: string;
  stalemateDraw: string;
};

const VICTORY_COPY: Record<Language, VictoryCopy> = {
  english: {
    none: TEXT.english.gameActive,
    homeField: (winner) => `${winner} win by home field`,
    sixStacks: (winner) => `${winner} win by six stacks`,
    threefoldDraw: 'Draw by threefold repetition',
    stalemateDraw: 'Draw by stalemate',
  },
  russian: {
    none: TEXT.russian.gameActive,
    homeField: (winner) => `${winner} победили через своё поле`,
    sixStacks: (winner) => `${winner} победили шестью горками`,
    threefoldDraw: 'Ничья по трёхкратному повторению',
    stalemateDraw: 'Ничья по блокировке',
  },
};

type ResultTitleCopy = {
  winner: (winner: string) => string;
  draw: string;
  gameOver: string;
};

const RESULT_TITLE_COPY: Record<Language, ResultTitleCopy> = {
  english: {
    winner: (winner) => `${winner} win`,
    draw: 'Draw',
    gameOver: 'Game over',
  },
  russian: {
    winner: (winner) => `${winner} победили`,
    draw: 'Ничья',
    gameOver: 'Игра окончена',
  },
};

type MiscCopy = {
  turnBanner: (player: string) => string;
  passOverlayLabel: (player: string) => string;
  historySummary: (count: number, cursor: number) => string;
  tooltipMoreAbout: (title: string) => string;
  autoPassPrefix: string;
};

const MISC_COPY: Record<Language, MiscCopy> = {
  english: {
    turnBanner: (player) => `${player} turn`,
    passOverlayLabel: (player) => `Pass the device to ${player}.`,
    historySummary: (count, cursor) => `Total: ${count} · History cursor: ${cursor}`,
    tooltipMoreAbout: (title) => `More about ${title}`,
    autoPassPrefix: ' | auto-pass: ',
  },
  russian: {
    turnBanner: (player) => `${player} ходят`,
    passOverlayLabel: (player) => `Передайте устройство: ${player.toLowerCase()}.`,
    historySummary: (count, cursor) => `Всего: ${count} · Позиция истории: ${cursor}`,
    tooltipMoreAbout: (title) => `Подробнее: ${title}`,
    autoPassPrefix: ' | автопас: ',
  },
};

/** Returns localized static UI text by language and key. */
export function text(language: Language, key: TextKey): string {
  return TEXT[language][key];
}

/** Returns localized player label. */
export function playerLabel(language: Language, player: Player): string {
  return PLAYER_LABELS[language][player];
}

/** Returns localized action label used in buttons and history summaries. */
export function actionLabel(language: Language, actionKind: ActionKind): string {
  return ACTION_LABELS[language][actionKind];
}

/** Returns localized turn banner text for current actor. */
export function formatTurnBanner(language: Language, player: Player): string {
  return MISC_COPY[language].turnBanner(playerLabel(language, player));
}

/** Returns localized pass-device helper copy. */
export function formatPassOverlayLabel(language: Language, player: Player): string {
  return MISC_COPY[language].passOverlayLabel(playerLabel(language, player));
}

/** Returns localized compact history summary. */
export function formatHistorySummary(language: Language, count: number, cursor: number): string {
  return MISC_COPY[language].historySummary(count, cursor);
}

/** Returns localized glossary tooltip trigger aria-label. */
export function formatGlossaryTooltipLabel(language: Language, title: string): string {
  return MISC_COPY[language].tooltipMoreAbout(title);
}

/** Returns localized title used in game result modal. */
export function formatGameResultTitle(language: Language, victory: Victory): string {
  const copy = RESULT_TITLE_COPY[language];

  switch (victory.type) {
    case 'homeField':
    case 'sixStacks':
      return copy.winner(playerLabel(language, victory.winner));
    case 'threefoldDraw':
    case 'stalemateDraw':
      return copy.draw;
    case 'none':
      return copy.gameOver;
  }
}

/** Returns localized status line for current interaction state machine node. */
export function describeInteraction(language: Language, interaction: InteractionState): string {
  const copy = INTERACTION_COPY[language];

  switch (interaction.type) {
    case 'idle':
      return copy.idle;
    case 'pieceSelected':
      return copy.pieceSelected(interaction.source);
    case 'actionTypeSelected':
      return copy.actionTypeSelected(actionLabel(language, interaction.actionType));
    case 'choosingTarget':
      return copy.choosingTarget(actionLabel(language, interaction.actionType), interaction.source);
    case 'buildingJumpChain':
      return copy.buildingJumpChain(interaction.source);
    case 'turnResolved':
      return copy.turnResolved(playerLabel(language, interaction.nextPlayer));
    case 'passingDevice':
      return copy.passingDevice(playerLabel(language, interaction.nextPlayer));
    case 'gameOver':
      return copy.gameOver;
  }
}

/** Formats action payload into human-readable history entry fragment. */
export function formatAction(language: Language, action: TurnAction): string {
  switch (action.type) {
    case 'manualUnfreeze':
      return `${actionLabel(language, action.type)} ${action.coord}`;
    case 'jumpSequence':
      return `${actionLabel(language, action.type)} ${action.source} -> ${action.path.join(' -> ')}`;
    case 'climbOne':
    case 'moveSingleToEmpty':
    case 'splitOneFromStack':
    case 'splitTwoFromStack':
    case 'friendlyStackTransfer':
      return `${actionLabel(language, action.type)} ${action.source} -> ${action.target}`;
  }
}

/** Formats current victory status into localized short text. */
export function formatVictory(language: Language, victory: Victory): string {
  const copy = VICTORY_COPY[language];

  switch (victory.type) {
    case 'none':
      return copy.none;
    case 'homeField':
      return copy.homeField(playerLabel(language, victory.winner));
    case 'sixStacks':
      return copy.sixStacks(playerLabel(language, victory.winner));
    case 'threefoldDraw':
      return copy.threefoldDraw;
    case 'stalemateDraw':
      return copy.stalemateDraw;
  }
}

/** Formats one turn record for the history list in reverse chronological order. */
export function formatTurnRecord(language: Language, record: TurnRecord): string {
  const actor = playerLabel(language, record.actor);
  const autoPasses = record.autoPasses.length
    ? `${MISC_COPY[language].autoPassPrefix}${record.autoPasses.map((player) => playerLabel(language, player)).join(', ')}`
    : '';

  return `${actor}: ${formatAction(language, record.action)}${autoPasses}`;
}
