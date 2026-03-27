/**
 * Context menu action definitions for the graph canvas.
 *
 * Pure-logic module: no React, no DOM dependencies.
 * React components in packages/web reference these constants
 * and functions to render context menus.
 *
 * Architecture doc section 3: context-menu/*.tsx (P1-E02)
 * Architecture doc section 9, AC-8: "Context menus work for nodes, edges, canvas"
 */

/**
 * Represents a single action in a context menu.
 *
 * Each action has:
 * - id: unique identifier, used in data-testid and callbacks
 * - label: display text for the menu item
 * - icon: lucide-react icon name (string, resolved by React component)
 * - disabled: whether the action is currently disabled
 * - destructive: whether this is a destructive action (styled in red)
 * - separator: whether to render a separator BEFORE this item
 */
export type ContextMenuAction = {
    id: string
    label: string
    icon: string
    disabled?: boolean
    destructive?: boolean
    separator?: boolean
}

/**
 * Node context menu action identifiers.
 *
 * These IDs are used by:
 * - getNodeContextMenuActions() to build the action list
 * - React component to match callbacks
 * - getContextMenuTestId() for data-testid attributes
 */
export const NODE_CONTEXT_MENU_ACTIONS = {
    DELETE: 'node-delete',
    DUPLICATE: 'node-duplicate',
} as const

/**
 * Edge context menu action identifiers.
 */
export const EDGE_CONTEXT_MENU_ACTIONS = {
    DELETE: 'edge-delete',
} as const

/**
 * Canvas context menu action identifiers.
 */
export const CANVAS_CONTEXT_MENU_ACTIONS = {
    SELECT_ALL: 'canvas-select-all',
    PASTE: 'canvas-paste',
} as const

/**
 * Returns context menu actions for a graph node.
 *
 * Trigger nodes cannot be deleted or duplicated (they are the root of the flow).
 * Action nodes (CODE, PIECE, LOOP_ON_ITEMS, ROUTER) get:
 * - Duplicate
 * - [separator]
 * - Delete (destructive)
 *
 * @param isTrigger - whether the node is a trigger node
 * @returns array of ContextMenuAction items
 */
export function getNodeContextMenuActions(isTrigger: boolean): ContextMenuAction[] {
    if (isTrigger) {
        return []
    }

    return [
        {
            id: NODE_CONTEXT_MENU_ACTIONS.DUPLICATE,
            label: 'Duplicate',
            icon: 'CopyPlus',
            destructive: false,
        },
        {
            id: NODE_CONTEXT_MENU_ACTIONS.DELETE,
            label: 'Delete',
            icon: 'Trash',
            destructive: true,
            separator: true,
        },
    ]
}

/**
 * Returns context menu actions for a graph edge.
 *
 * Edges can only be deleted. Returns a single delete action.
 *
 * @returns array of ContextMenuAction items
 */
export function getEdgeContextMenuActions(): ContextMenuAction[] {
    return [
        {
            id: EDGE_CONTEXT_MENU_ACTIONS.DELETE,
            label: 'Delete',
            icon: 'Trash',
            destructive: true,
        },
    ]
}

/**
 * Returns context menu actions for the canvas background.
 *
 * Canvas actions:
 * - Select All: select all nodes on the canvas
 * - Paste: paste previously copied nodes (from clipboard)
 *
 * @returns array of ContextMenuAction items
 */
export function getCanvasContextMenuActions(): ContextMenuAction[] {
    return [
        {
            id: CANVAS_CONTEXT_MENU_ACTIONS.SELECT_ALL,
            label: 'Select All',
            icon: 'MousePointerSquareDashed',
            destructive: false,
        },
        {
            id: CANVAS_CONTEXT_MENU_ACTIONS.PASTE,
            label: 'Paste',
            icon: 'ClipboardPaste',
            destructive: false,
        },
    ]
}

/**
 * Generate a data-testid for a context menu action.
 *
 * Format: 'context-menu-{actionId}'
 *
 * @param actionId - the action identifier (e.g., 'node-delete')
 * @returns data-testid string
 */
export function getContextMenuTestId(actionId: string): string {
    return `context-menu-${actionId}`
}
