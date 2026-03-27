import { describe, it, expect } from 'vitest'
import {
    NODE_CONTEXT_MENU_ACTIONS,
    EDGE_CONTEXT_MENU_ACTIONS,
    CANVAS_CONTEXT_MENU_ACTIONS,
    getNodeContextMenuActions,
    getEdgeContextMenuActions,
    getCanvasContextMenuActions,
    getContextMenuTestId,
    ContextMenuAction,
} from '../../src/lib/automation/flows/util/context-menu-utils'

describe('context-menu-utils', () => {
    describe('NODE_CONTEXT_MENU_ACTIONS', () => {
        it('should have DELETE action id', () => {
            expect(NODE_CONTEXT_MENU_ACTIONS.DELETE).toBe('node-delete')
        })

        it('should have DUPLICATE action id', () => {
            expect(NODE_CONTEXT_MENU_ACTIONS.DUPLICATE).toBe('node-duplicate')
        })
    })

    describe('EDGE_CONTEXT_MENU_ACTIONS', () => {
        it('should have DELETE action id', () => {
            expect(EDGE_CONTEXT_MENU_ACTIONS.DELETE).toBe('edge-delete')
        })
    })

    describe('CANVAS_CONTEXT_MENU_ACTIONS', () => {
        it('should have SELECT_ALL action id', () => {
            expect(CANVAS_CONTEXT_MENU_ACTIONS.SELECT_ALL).toBe('canvas-select-all')
        })

        it('should have PASTE action id', () => {
            expect(CANVAS_CONTEXT_MENU_ACTIONS.PASTE).toBe('canvas-paste')
        })
    })

    describe('getNodeContextMenuActions', () => {
        it('should return empty array for trigger nodes', () => {
            const actions = getNodeContextMenuActions(true)
            expect(actions).toEqual([])
        })

        it('should return duplicate and delete for action nodes', () => {
            const actions = getNodeContextMenuActions(false)
            expect(actions).toHaveLength(2)
        })

        it('should have duplicate as first action for non-trigger', () => {
            const actions = getNodeContextMenuActions(false)
            expect(actions[0].id).toBe(NODE_CONTEXT_MENU_ACTIONS.DUPLICATE)
            expect(actions[0].label).toBe('Duplicate')
            expect(actions[0].icon).toBe('CopyPlus')
        })

        it('should have delete as second action for non-trigger', () => {
            const actions = getNodeContextMenuActions(false)
            expect(actions[1].id).toBe(NODE_CONTEXT_MENU_ACTIONS.DELETE)
            expect(actions[1].label).toBe('Delete')
            expect(actions[1].icon).toBe('Trash')
        })

        it('should mark delete as destructive for action nodes', () => {
            const actions = getNodeContextMenuActions(false)
            const deleteAction = actions.find(
                (a) => a.id === NODE_CONTEXT_MENU_ACTIONS.DELETE,
            )
            expect(deleteAction?.destructive).toBe(true)
        })

        it('should not mark duplicate as destructive', () => {
            const actions = getNodeContextMenuActions(false)
            const dupAction = actions.find(
                (a) => a.id === NODE_CONTEXT_MENU_ACTIONS.DUPLICATE,
            )
            expect(dupAction?.destructive).toBe(false)
        })

        it('should have separator before delete action', () => {
            const actions = getNodeContextMenuActions(false)
            const deleteAction = actions.find(
                (a) => a.id === NODE_CONTEXT_MENU_ACTIONS.DELETE,
            )
            expect(deleteAction?.separator).toBe(true)
        })

        it('should have all required fields on each action', () => {
            const actions = getNodeContextMenuActions(false)
            for (const action of actions) {
                expect(action).toHaveProperty('id')
                expect(action).toHaveProperty('label')
                expect(action).toHaveProperty('icon')
                expect(typeof action.id).toBe('string')
                expect(typeof action.label).toBe('string')
                expect(typeof action.icon).toBe('string')
            }
        })
    })

    describe('getEdgeContextMenuActions', () => {
        it('should return exactly 1 action', () => {
            const actions = getEdgeContextMenuActions()
            expect(actions).toHaveLength(1)
        })

        it('should return delete action with correct id', () => {
            const actions = getEdgeContextMenuActions()
            expect(actions[0].id).toBe(EDGE_CONTEXT_MENU_ACTIONS.DELETE)
        })

        it('should return delete action with label Delete', () => {
            const actions = getEdgeContextMenuActions()
            expect(actions[0].label).toBe('Delete')
        })

        it('should mark delete as destructive', () => {
            const actions = getEdgeContextMenuActions()
            expect(actions[0].destructive).toBe(true)
        })

        it('should have Trash icon for delete', () => {
            const actions = getEdgeContextMenuActions()
            expect(actions[0].icon).toBe('Trash')
        })
    })

    describe('getCanvasContextMenuActions', () => {
        it('should return exactly 2 actions', () => {
            const actions = getCanvasContextMenuActions()
            expect(actions).toHaveLength(2)
        })

        it('should have select-all as first action', () => {
            const actions = getCanvasContextMenuActions()
            expect(actions[0].id).toBe(CANVAS_CONTEXT_MENU_ACTIONS.SELECT_ALL)
            expect(actions[0].label).toBe('Select All')
        })

        it('should have paste as second action', () => {
            const actions = getCanvasContextMenuActions()
            expect(actions[1].id).toBe(CANVAS_CONTEXT_MENU_ACTIONS.PASTE)
            expect(actions[1].label).toBe('Paste')
        })

        it('should not mark any canvas action as destructive', () => {
            const actions = getCanvasContextMenuActions()
            for (const action of actions) {
                expect(action.destructive).toBe(false)
            }
        })

        it('should have correct icons', () => {
            const actions = getCanvasContextMenuActions()
            expect(actions[0].icon).toBe('MousePointerSquareDashed')
            expect(actions[1].icon).toBe('ClipboardPaste')
        })

        it('should have all required fields on each action', () => {
            const actions = getCanvasContextMenuActions()
            for (const action of actions) {
                expect(action).toHaveProperty('id')
                expect(action).toHaveProperty('label')
                expect(action).toHaveProperty('icon')
            }
        })
    })

    describe('getContextMenuTestId', () => {
        it('should return context-menu- prefix with action id', () => {
            expect(getContextMenuTestId('node-delete')).toBe('context-menu-node-delete')
        })

        it('should handle edge action ids', () => {
            expect(getContextMenuTestId('edge-delete')).toBe('context-menu-edge-delete')
        })

        it('should handle canvas action ids', () => {
            expect(getContextMenuTestId('canvas-select-all')).toBe(
                'context-menu-canvas-select-all',
            )
        })

        it('should handle arbitrary strings', () => {
            expect(getContextMenuTestId('custom-action')).toBe(
                'context-menu-custom-action',
            )
        })
    })

    describe('action type validation', () => {
        function validateActions(actions: ContextMenuAction[]): void {
            for (const action of actions) {
                expect(action.id).toBeTruthy()
                expect(action.label).toBeTruthy()
                expect(action.icon).toBeTruthy()
            }
        }

        it('should produce valid node actions', () => {
            validateActions(getNodeContextMenuActions(false))
        })

        it('should produce valid edge actions', () => {
            validateActions(getEdgeContextMenuActions())
        })

        it('should produce valid canvas actions', () => {
            validateActions(getCanvasContextMenuActions())
        })
    })
})
