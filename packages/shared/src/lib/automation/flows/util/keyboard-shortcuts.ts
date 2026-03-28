/**
 * Определения горячих клавиш для graph canvas.
 *
 * Чистые данные (pure data): нет React, нет DOM-зависимостей.
 * Используется компонентами в packages/web для привязки клавиш
 * и тестами в packages/shared для верификации набора shortcuts.
 *
 * P2-B05: Горячие клавиши Delete + Ctrl+A.
 * Undo/Redo отложен в Phase 3.
 */

/**
 * Тип определения горячей клавиши.
 *
 * Каждая клавиша имеет:
 * - id: уникальный идентификатор для тестов и логирования
 * - key: клавиша (совпадает с KeyboardEvent.key)
 * - ctrlOrMeta: требуется ли Ctrl (Windows/Linux) или Cmd (macOS)
 * - shift: требуется ли Shift
 * - description: описание действия для UI
 * - category: группа горячей клавиши
 */
export type KeyboardShortcutDefinition = {
    id: string
    key: string | string[]
    ctrlOrMeta: boolean
    shift: boolean
    description: string
    category: KeyboardShortcutCategory
}

/**
 * Категории горячих клавиш.
 */
export type KeyboardShortcutCategory = 'selection' | 'deletion' | 'navigation' | 'editing'

/**
 * Идентификаторы горячих клавиш graph canvas.
 */
export const GRAPH_SHORTCUT_IDS = {
    DELETE_SELECTED: 'delete-selected',
    SELECT_ALL: 'select-all',
    ESCAPE: 'escape-deselect',
    MULTI_SELECT: 'multi-select',
} as const

export type GraphShortcutId = typeof GRAPH_SHORTCUT_IDS[keyof typeof GRAPH_SHORTCUT_IDS]

/**
 * Определения горячих клавиш graph canvas.
 *
 * Delete/Backspace: удалить выделенные элементы (ReactFlow onDelete).
 * Ctrl+A: выделить все ноды и рёбра.
 * Escape: снять выделение.
 * Shift+Click: множественное выделение (ReactFlow multiSelectionKeyCode).
 */
export const GRAPH_KEYBOARD_SHORTCUTS: Record<GraphShortcutId, KeyboardShortcutDefinition> = {
    [GRAPH_SHORTCUT_IDS.DELETE_SELECTED]: {
        id: GRAPH_SHORTCUT_IDS.DELETE_SELECTED,
        key: ['Delete', 'Backspace'],
        ctrlOrMeta: false,
        shift: false,
        description: 'Delete selected nodes and edges',
        category: 'deletion',
    },
    [GRAPH_SHORTCUT_IDS.SELECT_ALL]: {
        id: GRAPH_SHORTCUT_IDS.SELECT_ALL,
        key: 'a',
        ctrlOrMeta: true,
        shift: false,
        description: 'Select all nodes and edges',
        category: 'selection',
    },
    [GRAPH_SHORTCUT_IDS.ESCAPE]: {
        id: GRAPH_SHORTCUT_IDS.ESCAPE,
        key: 'Escape',
        ctrlOrMeta: false,
        shift: false,
        description: 'Deselect all',
        category: 'selection',
    },
    [GRAPH_SHORTCUT_IDS.MULTI_SELECT]: {
        id: GRAPH_SHORTCUT_IDS.MULTI_SELECT,
        key: 'Shift',
        ctrlOrMeta: false,
        shift: true,
        description: 'Hold to add to selection',
        category: 'selection',
    },
}

/**
 * Возвращает все определения горячих клавиш в виде массива.
 *
 * @returns Массив KeyboardShortcutDefinition
 */
export function getGraphKeyboardShortcuts(): KeyboardShortcutDefinition[] {
    return Object.values(GRAPH_KEYBOARD_SHORTCUTS)
}

/**
 * Возвращает горячие клавиши отфильтрованные по категории.
 *
 * @param category - категория для фильтрации
 * @returns массив определений горячих клавиш данной категории
 */
export function getShortcutsByCategory(category: KeyboardShortcutCategory): KeyboardShortcutDefinition[] {
    return getGraphKeyboardShortcuts().filter((s) => s.category === category)
}

/**
 * Проверяет, соответствует ли KeyboardEvent определению горячей клавиши.
 *
 * Чистая функция: принимает поля KeyboardEvent, не зависит от DOM.
 * Проверяет key + ctrlOrMeta + shift.
 *
 * @param eventKey - KeyboardEvent.key
 * @param eventCtrl - KeyboardEvent.ctrlKey || KeyboardEvent.metaKey
 * @param eventShift - KeyboardEvent.shiftKey
 * @param shortcut - определение горячей клавиши
 * @returns true если событие соответствует shortcut
 */
export function matchesShortcut(
    eventKey: string,
    eventCtrl: boolean,
    eventShift: boolean,
    shortcut: KeyboardShortcutDefinition,
): boolean {
    const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key]
    const keyMatch = keys.some((k) => k.toLowerCase() === eventKey.toLowerCase())
    const ctrlMatch = shortcut.ctrlOrMeta === eventCtrl
    const shiftMatch = shortcut.shift === eventShift
    return keyMatch && ctrlMatch && shiftMatch
}

/**
 * ReactFlow deleteKeyCode значение для передачи как prop.
 *
 * Массив клавиш, которые ReactFlow слушает для удаления выделенных элементов.
 * Должен совпадать с GRAPH_KEYBOARD_SHORTCUTS['delete-selected'].key.
 */
export const GRAPH_DELETE_KEY_CODE: string[] = ['Backspace', 'Delete']

/**
 * ReactFlow multiSelectionKeyCode значение.
 *
 * Клавиша для множественного выделения (Shift+Click).
 */
export const GRAPH_MULTI_SELECTION_KEY = 'Shift'
