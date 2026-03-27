import {
    CanvasLayout,
    flowOperations,
    FlowOperationType,
    FlowTriggerType,
    FlowVersion,
    FlowVersionState,
    ImportFlowRequest,
    LATEST_FLOW_SCHEMA_VERSION,
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

const sampleCanvasLayout: CanvasLayout = {
    positions: {
        'trigger': { x: 100, y: 50 },
        'step_1': { x: 100, y: 200 },
        'step_2': { x: 300, y: 200 },
    },
    viewport: { x: 0, y: 0, zoom: 1.5 },
}

describe('LATEST_FLOW_SCHEMA_VERSION', () => {
    it('should equal 19', () => {
        expect(LATEST_FLOW_SCHEMA_VERSION).toBe('19')
    })
})

describe('CanvasLayout schema validation', () => {
    it('should validate valid positions with viewport', () => {
        const result = CanvasLayout.safeParse(sampleCanvasLayout)
        expect(result.success).toBe(true)
    })

    it('should validate positions without viewport', () => {
        const result = CanvasLayout.safeParse({
            positions: { 'trigger': { x: 0, y: 0 } },
        })
        expect(result.success).toBe(true)
    })

    it('should reject non-object positions', () => {
        const result = CanvasLayout.safeParse({
            positions: 'not-an-object',
        })
        expect(result.success).toBe(false)
    })
})

describe('ImportFlowRequest canvasLayout field', () => {
    const baseTrigger = {
        name: 'trigger',
        type: FlowTriggerType.EMPTY,
        valid: false,
        displayName: 'Trigger',
        lastUpdatedDate: '2026-03-27T00:00:00.000Z',
        settings: {},
    }

    it('should accept ImportFlowRequest with canvasLayout', () => {
        const request = {
            displayName: 'Test',
            trigger: baseTrigger,
            schemaVersion: null,
            notes: null,
            canvasLayout: sampleCanvasLayout,
        }
        const result = ImportFlowRequest.safeParse(request)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.canvasLayout).toEqual(sampleCanvasLayout)
        }
    })

    it('should accept ImportFlowRequest with canvasLayout: null', () => {
        const request = {
            displayName: 'Test',
            trigger: baseTrigger,
            schemaVersion: null,
            notes: null,
            canvasLayout: null,
        }
        const result = ImportFlowRequest.safeParse(request)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.canvasLayout).toBeNull()
        }
    })

    it('should accept ImportFlowRequest without canvasLayout (backward compat)', () => {
        const request = {
            displayName: 'Test',
            trigger: baseTrigger,
            schemaVersion: null,
            notes: null,
        }
        const result = ImportFlowRequest.safeParse(request)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.canvasLayout).toBeUndefined()
        }
    })
})

describe('IMPORT_FLOW operation with canvasLayout', () => {
    it('should preserve canvasLayout when importing flow with layout', () => {
        const result = flowOperations.apply(baseFlowVersion, {
            type: FlowOperationType.IMPORT_FLOW,
            request: {
                displayName: 'Imported Flow',
                trigger: baseFlowVersion.trigger,
                schemaVersion: null,
                notes: null,
                canvasLayout: sampleCanvasLayout,
            },
        })

        expect(result.canvasLayout).toEqual(sampleCanvasLayout)
        expect(result.displayName).toBe('Imported Flow')
    })

    it('should not modify canvasLayout when importing without canvasLayout', () => {
        const flowWithLayout: FlowVersion = {
            ...baseFlowVersion,
            canvasLayout: sampleCanvasLayout,
        }
        const result = flowOperations.apply(flowWithLayout, {
            type: FlowOperationType.IMPORT_FLOW,
            request: {
                displayName: 'Imported No Layout',
                trigger: baseFlowVersion.trigger,
                schemaVersion: null,
                notes: null,
            },
        })

        // canvasLayout should remain unchanged since the import did not include it
        expect(result.canvasLayout).toEqual(sampleCanvasLayout)
        expect(result.displayName).toBe('Imported No Layout')
    })

    it('should set canvasLayout to null when importing with null canvasLayout', () => {
        const flowWithLayout: FlowVersion = {
            ...baseFlowVersion,
            canvasLayout: sampleCanvasLayout,
        }
        const result = flowOperations.apply(flowWithLayout, {
            type: FlowOperationType.IMPORT_FLOW,
            request: {
                displayName: 'Imported Null Layout',
                trigger: baseFlowVersion.trigger,
                schemaVersion: null,
                notes: null,
                canvasLayout: null,
            },
        })

        expect(result.canvasLayout).toBeNull()
    })
})

describe('UPDATE_CANVAS_LAYOUT round-trip', () => {
    it('should set and preserve canvasLayout positions', () => {
        const result = flowOperations.apply(baseFlowVersion, {
            type: FlowOperationType.UPDATE_CANVAS_LAYOUT,
            request: { canvasLayout: sampleCanvasLayout },
        })

        expect(result.canvasLayout).toEqual(sampleCanvasLayout)
        expect(result.canvasLayout!.positions['trigger']).toEqual({ x: 100, y: 50 })
        expect(result.canvasLayout!.positions['step_1']).toEqual({ x: 100, y: 200 })
        expect(result.canvasLayout!.positions['step_2']).toEqual({ x: 300, y: 200 })
        expect(result.canvasLayout!.viewport).toEqual({ x: 0, y: 0, zoom: 1.5 })
    })

    it('should allow updating canvasLayout multiple times', () => {
        const firstUpdate = flowOperations.apply(baseFlowVersion, {
            type: FlowOperationType.UPDATE_CANVAS_LAYOUT,
            request: { canvasLayout: sampleCanvasLayout },
        })

        const newLayout: CanvasLayout = {
            positions: {
                'trigger': { x: 500, y: 500 },
            },
        }

        const secondUpdate = flowOperations.apply(firstUpdate, {
            type: FlowOperationType.UPDATE_CANVAS_LAYOUT,
            request: { canvasLayout: newLayout },
        })

        expect(secondUpdate.canvasLayout).toEqual(newLayout)
        expect(secondUpdate.canvasLayout!.positions['trigger']).toEqual({ x: 500, y: 500 })
        // step_1 and step_2 should be gone since new layout replaced old
        expect(secondUpdate.canvasLayout!.positions['step_1']).toBeUndefined()
    })
})

describe('FlowVersion schema with canvasLayout', () => {
    it('should validate FlowVersion with canvasLayout null', () => {
        const result = FlowVersion.safeParse({
            ...baseFlowVersion,
            canvasLayout: null,
        })
        expect(result.success).toBe(true)
    })

    it('should validate FlowVersion with valid canvasLayout', () => {
        const result = FlowVersion.safeParse({
            ...baseFlowVersion,
            canvasLayout: sampleCanvasLayout,
        })
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.data.canvasLayout!.positions['trigger']).toEqual({ x: 100, y: 50 })
        }
    })
})
