import { describe, it, expect } from 'vitest'
import {
    GRAPH_SHORTCUT_IDS,
    GRAPH_KEYBOARD_SHORTCUTS,
    GRAPH_DELETE_KEY_CODE,
    GRAPH_MULTI_SELECTION_KEY,
    getGraphKeyboardShortcuts,
    getShortcutsByCategory,
    matchesShortcut,
    type KeyboardShortcutDefinition,
    type GraphShortcutId,
} from '../../src/lib/automation/flows/util/keyboard-shortcuts'

describe('keyboard-shortcuts', () => {
    describe('GRAPH_SHORTCUT_IDS', () => {
        it('should have DELETE_SELECTED id', () => {
            expect(GRAPH_SHORTCUT_IDS.DELETE_SELECTED).toBe('delete-selected')
        })

        it('should have SELECT_ALL id', () => {
            expect(GRAPH_SHORTCUT_IDS.SELECT_ALL).toBe('select-all')
        })

        it('should have ESCAPE id', () => {
            expect(GRAPH_SHORTCUT_IDS.ESCAPE).toBe('escape-deselect')
        })

        it('should have MULTI_SELECT id', () => {
            expect(GRAPH_SHORTCUT_IDS.MULTI_SELECT).toBe('multi-select')
        })

        it('should have exactly 6 shortcut ids', () => {
            expect(Object.keys(GRAPH_SHORTCUT_IDS)).toHaveLength(6)
        })
    })

    describe('GRAPH_KEYBOARD_SHORTCUTS', () => {
        it('should have definitions for all shortcut ids', () => {
            const ids = Object.values(GRAPH_SHORTCUT_IDS)
            for (const id of ids) {
                expect(GRAPH_KEYBOARD_SHORTCUTS[id]).toBeDefined()
                expect(GRAPH_KEYBOARD_SHORTCUTS[id].id).toBe(id)
            }
        })

        it('delete-selected should use Delete and Backspace keys', () => {
            const shortcut = GRAPH_KEYBOARD_SHORTCUTS[GRAPH_SHORTCUT_IDS.DELETE_SELECTED]
            expect(shortcut.key).toEqual(['Delete', 'Backspace'])
            expect(shortcut.ctrlOrMeta).toBe(false)
            expect(shortcut.shift).toBe(false)
        })

        it('select-all should use Ctrl+A', () => {
            const shortcut = GRAPH_KEYBOARD_SHORTCUTS[GRAPH_SHORTCUT_IDS.SELECT_ALL]
            expect(shortcut.key).toBe('a')
            expect(shortcut.ctrlOrMeta).toBe(true)
            expect(shortcut.shift).toBe(false)
        })

        it('escape should use Escape key without modifiers', () => {
            const shortcut = GRAPH_KEYBOARD_SHORTCUTS[GRAPH_SHORTCUT_IDS.ESCAPE]
            expect(shortcut.key).toBe('Escape')
            expect(shortcut.ctrlOrMeta).toBe(false)
            expect(shortcut.shift).toBe(false)
        })

        it('multi-select should use Shift', () => {
            const shortcut = GRAPH_KEYBOARD_SHORTCUTS[GRAPH_SHORTCUT_IDS.MULTI_SELECT]
            expect(shortcut.key).toBe('Shift')
            expect(shortcut.shift).toBe(true)
        })

        it('all shortcuts should have description', () => {
            for (const shortcut of Object.values(GRAPH_KEYBOARD_SHORTCUTS)) {
                expect(shortcut.description).toBeTruthy()
                expect(typeof shortcut.description).toBe('string')
            }
        })

        it('all shortcuts should have valid category', () => {
            const validCategories = ['selection', 'deletion', 'navigation', 'editing']
            for (const shortcut of Object.values(GRAPH_KEYBOARD_SHORTCUTS)) {
                expect(validCategories).toContain(shortcut.category)
            }
        })
    })

    describe('GRAPH_DELETE_KEY_CODE', () => {
        it('should contain Delete and Backspace', () => {
            expect(GRAPH_DELETE_KEY_CODE).toContain('Delete')
            expect(GRAPH_DELETE_KEY_CODE).toContain('Backspace')
        })

        it('should have exactly 2 keys', () => {
            expect(GRAPH_DELETE_KEY_CODE).toHaveLength(2)
        })

        it('should contain same keys as delete shortcut definition', () => {
            const deleteShortcut = GRAPH_KEYBOARD_SHORTCUTS[GRAPH_SHORTCUT_IDS.DELETE_SELECTED]
            const shortcutKeys = Array.isArray(deleteShortcut.key) ? deleteShortcut.key : [deleteShortcut.key]
            for (const key of GRAPH_DELETE_KEY_CODE) {
                expect(shortcutKeys).toContain(key)
            }
            expect(GRAPH_DELETE_KEY_CODE).toHaveLength(shortcutKeys.length)
        })
    })

    describe('GRAPH_MULTI_SELECTION_KEY', () => {
        it('should be Shift', () => {
            expect(GRAPH_MULTI_SELECTION_KEY).toBe('Shift')
        })
    })

    describe('getGraphKeyboardShortcuts', () => {
        it('should return array of all shortcuts', () => {
            const shortcuts = getGraphKeyboardShortcuts()
            expect(Array.isArray(shortcuts)).toBe(true)
            expect(shortcuts).toHaveLength(6)
        })

        it('should include all defined shortcut ids', () => {
            const shortcuts = getGraphKeyboardShortcuts()
            const ids = shortcuts.map((s) => s.id)
            expect(ids).toContain(GRAPH_SHORTCUT_IDS.DELETE_SELECTED)
            expect(ids).toContain(GRAPH_SHORTCUT_IDS.SELECT_ALL)
            expect(ids).toContain(GRAPH_SHORTCUT_IDS.ESCAPE)
            expect(ids).toContain(GRAPH_SHORTCUT_IDS.MULTI_SELECT)
        })

        it('each shortcut should have all required fields', () => {
            const shortcuts = getGraphKeyboardShortcuts()
            for (const shortcut of shortcuts) {
                expect(shortcut).toHaveProperty('id')
                expect(shortcut).toHaveProperty('key')
                expect(shortcut).toHaveProperty('ctrlOrMeta')
                expect(shortcut).toHaveProperty('shift')
                expect(shortcut).toHaveProperty('description')
                expect(shortcut).toHaveProperty('category')
            }
        })
    })

    describe('getShortcutsByCategory', () => {
        it('should return selection shortcuts', () => {
            const shortcuts = getShortcutsByCategory('selection')
            expect(shortcuts.length).toBeGreaterThan(0)
            for (const s of shortcuts) {
                expect(s.category).toBe('selection')
            }
        })

        it('should return deletion shortcuts', () => {
            const shortcuts = getShortcutsByCategory('deletion')
            expect(shortcuts.length).toBeGreaterThan(0)
            for (const s of shortcuts) {
                expect(s.category).toBe('deletion')
            }
        })

        it('should return empty array for unused category', () => {
            const shortcuts = getShortcutsByCategory('navigation')
            expect(shortcuts).toHaveLength(0)
        })

        it('select-all and escape and multi-select should be in selection', () => {
            const shortcuts = getShortcutsByCategory('selection')
            const ids = shortcuts.map((s) => s.id)
            expect(ids).toContain(GRAPH_SHORTCUT_IDS.SELECT_ALL)
            expect(ids).toContain(GRAPH_SHORTCUT_IDS.ESCAPE)
            expect(ids).toContain(GRAPH_SHORTCUT_IDS.MULTI_SELECT)
        })

        it('delete should be in deletion category', () => {
            const shortcuts = getShortcutsByCategory('deletion')
            const ids = shortcuts.map((s) => s.id)
            expect(ids).toContain(GRAPH_SHORTCUT_IDS.DELETE_SELECTED)
        })
    })

    describe('matchesShortcut', () => {
        const deleteShortcut = GRAPH_KEYBOARD_SHORTCUTS[GRAPH_SHORTCUT_IDS.DELETE_SELECTED]
        const selectAllShortcut = GRAPH_KEYBOARD_SHORTCUTS[GRAPH_SHORTCUT_IDS.SELECT_ALL]
        const escapeShortcut = GRAPH_KEYBOARD_SHORTCUTS[GRAPH_SHORTCUT_IDS.ESCAPE]

        it('should match Delete key for delete shortcut', () => {
            expect(matchesShortcut('Delete', false, false, deleteShortcut)).toBe(true)
        })

        it('should match Backspace key for delete shortcut', () => {
            expect(matchesShortcut('Backspace', false, false, deleteShortcut)).toBe(true)
        })

        it('should not match Delete with ctrl for delete shortcut', () => {
            expect(matchesShortcut('Delete', true, false, deleteShortcut)).toBe(false)
        })

        it('should not match Delete with shift for delete shortcut', () => {
            expect(matchesShortcut('Delete', false, true, deleteShortcut)).toBe(false)
        })

        it('should match Ctrl+A for select-all shortcut', () => {
            expect(matchesShortcut('a', true, false, selectAllShortcut)).toBe(true)
        })

        it('should match Cmd+A (metaKey) for select-all shortcut', () => {
            // metaKey=true should be passed as ctrlOrMeta parameter
            expect(matchesShortcut('a', true, false, selectAllShortcut)).toBe(true)
        })

        it('should match case-insensitive for select-all', () => {
            expect(matchesShortcut('A', true, false, selectAllShortcut)).toBe(true)
        })

        it('should not match A without ctrl for select-all', () => {
            expect(matchesShortcut('a', false, false, selectAllShortcut)).toBe(false)
        })

        it('should not match Ctrl+Shift+A for select-all', () => {
            expect(matchesShortcut('a', true, true, selectAllShortcut)).toBe(false)
        })

        it('should match Escape for escape shortcut', () => {
            expect(matchesShortcut('Escape', false, false, escapeShortcut)).toBe(true)
        })

        it('should not match Escape with ctrl for escape shortcut', () => {
            expect(matchesShortcut('Escape', true, false, escapeShortcut)).toBe(false)
        })

        it('should not match unrelated key', () => {
            expect(matchesShortcut('x', false, false, deleteShortcut)).toBe(false)
        })

        it('should not match unrelated key for select-all', () => {
            expect(matchesShortcut('b', true, false, selectAllShortcut)).toBe(false)
        })

        it('should be case-insensitive for delete key', () => {
            expect(matchesShortcut('delete', false, false, deleteShortcut)).toBe(true)
        })

        it('should be case-insensitive for backspace key', () => {
            expect(matchesShortcut('backspace', false, false, deleteShortcut)).toBe(true)
        })

        it('should be case-insensitive for escape key', () => {
            expect(matchesShortcut('escape', false, false, escapeShortcut)).toBe(true)
        })
    })
})
