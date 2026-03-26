import { FlowActionType } from '../actions/action'
import { FlowTriggerType } from '../triggers/trigger'

/**
 * Canonical handle ID constants for graph nodes.
 * These must match the handle IDs used in graph-converter.ts.
 *
 * Architecture doc 6.3 defines:
 * - input (top-center): data flowing INTO a step
 * - output (bottom-center): maps to nextAction
 * - loop-output (right of loop): maps to firstLoopAction
 * - branch-N (right of router): maps to children[N]
 */
export const HANDLE_IDS = {
    INPUT: 'input',
    OUTPUT: 'output',
    LOOP_OUTPUT: 'loop-output',
} as const

/**
 * Generate a branch handle ID for router nodes.
 * Pattern: 'branch-{index}' matching graph-converter.ts usage.
 *
 * @param index - zero-based branch index
 * @returns handle ID string, e.g. 'branch-0', 'branch-1'
 */
export function branchHandle(index: number): string {
    return `branch-${index}`
}

/**
 * Type representing valid handle identifiers.
 * Union of fixed handle IDs and dynamic branch-N pattern.
 */
export type HandleType = typeof HANDLE_IDS[keyof typeof HANDLE_IDS] | `branch-${number}`

/**
 * Result of connection validation.
 * When valid=false, reason explains why the connection was rejected.
 */
export type ConnectionValidationResult = {
    valid: boolean
    reason?: string
}

/**
 * A connection rule defines what connections are allowed between node types.
 * From Architecture doc section 6.2.
 *
 * sourceType/targetType: FlowActionType, FlowTriggerType, or '*' (wildcard)
 * sourceHandle/targetHandle: handle IDs
 * maxConnections: max edges per handle (default 1 for ALL handles)
 */
export type ConnectionRule = {
    sourceType: FlowActionType | FlowTriggerType | '*'
    sourceHandle: string
    targetType: FlowActionType | FlowTriggerType | '*'
    targetHandle: string
    maxConnections: number
}

/**
 * Default connection rules implementing Architecture doc section 6.2.
 *
 * Core rules encoded:
 * - Trigger: output only (no input handle)
 * - Action (Code/Piece): 1 input + 1 output
 * - Loop: 1 input + 1 output (next) + 1 loop-output (first loop action)
 * - Router: 1 input + N branch-outputs (one per branch)
 * - Max 1 edge per input handle
 * - Max 1 edge per output handle (guarantees linked-list determinism)
 */
export const DEFAULT_CONNECTION_RULES: ConnectionRule[] = [
    // Generic: any output → any input (max 1 connection per handle)
    {
        sourceType: '*',
        sourceHandle: HANDLE_IDS.OUTPUT,
        targetType: '*',
        targetHandle: HANDLE_IDS.INPUT,
        maxConnections: 1,
    },
    // Loop: loop-output → any action input (firstLoopAction)
    {
        sourceType: FlowActionType.LOOP_ON_ITEMS,
        sourceHandle: HANDLE_IDS.LOOP_OUTPUT,
        targetType: '*',
        targetHandle: HANDLE_IDS.INPUT,
        maxConnections: 1,
    },
    // Router: branch-N → any action input (children[N])
    // Note: branch handles are dynamic (branch-0, branch-1, ...).
    // Validation uses pattern matching on 'branch-' prefix, not fixed rules.
    // Each branch handle allows max 1 connection.
]

/**
 * Check if a handle ID is a valid branch handle (matches 'branch-N' pattern).
 */
export function isBranchHandle(handleId: string): boolean {
    return /^branch-\d+$/.test(handleId)
}

/**
 * Determine which node types are NOT allowed to have an input handle.
 * Per Architecture doc 6.2: Trigger must be root (no incoming edges).
 */
export const NO_INPUT_TYPES: ReadonlySet<string> = new Set([
    FlowTriggerType.EMPTY,
    FlowTriggerType.PIECE,
])

/**
 * Node types that have a loop-output handle.
 */
export const LOOP_OUTPUT_TYPES: ReadonlySet<string> = new Set([
    FlowActionType.LOOP_ON_ITEMS,
])

/**
 * Node types that have dynamic branch handles.
 */
export const BRANCH_OUTPUT_TYPES: ReadonlySet<string> = new Set([
    FlowActionType.ROUTER,
])
