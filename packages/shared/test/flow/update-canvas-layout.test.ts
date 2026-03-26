import {
    flowOperations,
    FlowOperationType,
    FlowTriggerType,
    FlowVersion,
    FlowVersionState,
} from '../../src'

const baseFlowVersion: FlowVersion = {
    id: 'test-flow-version-id',
    created: '2026-03-27T00:00:00.000Z',
    updated: '2026-03-27T00:00:00.000Z',
    flowId: 'test-flow-id',
    updatedBy: null,
    displayName: 'Test Flow',
    agentIds: [],
    notes: [],
    trigger: {
        name: 'trigger',
        type: FlowTriggerType.EMPTY,
        valid: false,
        displayName: 'Empty Trigger',
        lastUpdatedDate: '2026-03-27T00:00:00.000Z',
        settings: {},
    },
    valid: false,
    schemaVersion: null,
    state: FlowVersionState.DRAFT,
    connectionIds: [],
    backupFiles: null,
}

describe('UPDATE_CANVAS_LAYOUT operation', () => {
    it('should set canvasLayout on FlowVersion', () => {
        const canvasLayout = {
            positions: {
                'trigger': { x: 100, y: 50 },
                'step_1': { x: 100, y: 200 },
            },
            viewport: { x: 0, y: 0, zoom: 1 },
        }

        const result = flowOperations.apply(baseFlowVersion, {
            type: FlowOperationType.UPDATE_CANVAS_LAYOUT,
            request: { canvasLayout },
        })

        expect(result.canvasLayout).toEqual(canvasLayout)
    })

    it('should replace existing canvasLayout', () => {
        const initialLayout = {
            positions: { 'trigger': { x: 0, y: 0 } },
        }
        const flowWithLayout: FlowVersion = {
            ...baseFlowVersion,
            canvasLayout: initialLayout,
        }

        const newLayout = {
            positions: {
                'trigger': { x: 500, y: 300 },
                'step_1': { x: 500, y: 500 },
            },
            viewport: { x: 10, y: 20, zoom: 2 },
        }

        const result = flowOperations.apply(flowWithLayout, {
            type: FlowOperationType.UPDATE_CANVAS_LAYOUT,
            request: { canvasLayout: newLayout },
        })

        expect(result.canvasLayout).toEqual(newLayout)
        expect(result.canvasLayout!.positions['trigger']).toEqual({ x: 500, y: 300 })
    })

    it('should not modify trigger chain', () => {
        const canvasLayout = {
            positions: { 'trigger': { x: 100, y: 50 } },
        }

        const result = flowOperations.apply(baseFlowVersion, {
            type: FlowOperationType.UPDATE_CANVAS_LAYOUT,
            request: { canvasLayout },
        })

        expect(result.trigger.name).toBe('trigger')
        expect(result.trigger.type).toBe(FlowTriggerType.EMPTY)
        expect(result.trigger.settings).toEqual({})
    })

    it('should set canvasLayout to null', () => {
        const flowWithLayout: FlowVersion = {
            ...baseFlowVersion,
            canvasLayout: {
                positions: { 'trigger': { x: 100, y: 50 } },
            },
        }

        const result = flowOperations.apply(flowWithLayout, {
            type: FlowOperationType.UPDATE_CANVAS_LAYOUT,
            request: { canvasLayout: null },
        })

        expect(result.canvasLayout).toBeNull()
    })

    it('should not mutate the original flow version', () => {
        const original: FlowVersion = { ...baseFlowVersion }
        const canvasLayout = {
            positions: { 'trigger': { x: 100, y: 50 } },
        }

        flowOperations.apply(original, {
            type: FlowOperationType.UPDATE_CANVAS_LAYOUT,
            request: { canvasLayout },
        })

        expect(original.canvasLayout).toBeUndefined()
    })
})
