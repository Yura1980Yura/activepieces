import { FlowActionType } from '../actions/action'
import { FlowTriggerType } from '../triggers/trigger'
import {
    HANDLE_IDS,
    LOOP_OUTPUT_TYPES,
    BRANCH_OUTPUT_TYPES,
    branchHandle,
} from './connection-rules'

/**
 * Configuration for a single handle on a graph node.
 * Used by React components to render the correct handles
 * at the correct positions with the correct IDs.
 *
 * - id: matches HANDLE_IDS constants or branchHandle(N) output
 * - type: 'source' for outgoing connections, 'target' for incoming
 * - position: where the handle appears on the node
 */
export type HandleConfig = {
    id: string
    type: 'source' | 'target'
    position: 'top' | 'bottom' | 'right' | 'left'
}

/**
 * Set of action types that are trigger types (no input handle).
 * Mirrors NO_INPUT_TYPES from connection-rules.ts but uses
 * the FlowTriggerType enum values directly.
 */
const TRIGGER_TYPES: ReadonlySet<string> = new Set([
    FlowTriggerType.EMPTY,
    FlowTriggerType.PIECE,
])

/**
 * Determine which handles a graph node should render based on its action type.
 *
 * Architecture doc 6.3 defines handle layout:
 * - Trigger: output only (no input handle)
 * - Action (Code/Piece): 1 input + 1 output
 * - Loop: 1 input + 1 output + 1 loop-output (right)
 * - Router: 1 input + 1 output + N branch handles (right)
 *
 * @param actionType - the FlowActionType or FlowTriggerType of the node
 * @param branchCount - number of branches for ROUTER nodes (default 0)
 * @returns array of HandleConfig describing each handle to render
 */
export function getHandlesForNodeType(
    actionType: string,
    branchCount: number = 0,
): HandleConfig[] {
    const handles: HandleConfig[] = []

    // Trigger types: output only, no input
    if (TRIGGER_TYPES.has(actionType)) {
        handles.push({
            id: HANDLE_IDS.OUTPUT,
            type: 'source',
            position: 'bottom',
        })
        return handles
    }

    // All non-trigger nodes get an input handle
    handles.push({
        id: HANDLE_IDS.INPUT,
        type: 'target',
        position: 'top',
    })

    // All nodes get an output handle
    handles.push({
        id: HANDLE_IDS.OUTPUT,
        type: 'source',
        position: 'bottom',
    })

    // Loop nodes get an additional loop-output handle on the right
    if (LOOP_OUTPUT_TYPES.has(actionType)) {
        handles.push({
            id: HANDLE_IDS.LOOP_OUTPUT,
            type: 'source',
            position: 'right',
        })
    }

    // Router nodes get dynamic branch handles on the right
    if (BRANCH_OUTPUT_TYPES.has(actionType)) {
        for (let i = 0; i < branchCount; i++) {
            handles.push({
                id: branchHandle(i),
                type: 'source',
                position: 'right',
            })
        }
    }

    return handles
}
