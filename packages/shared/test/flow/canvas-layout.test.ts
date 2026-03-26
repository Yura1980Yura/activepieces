import { CanvasLayout, CanvasViewport, FlowVersion } from '../../src'
import { FlowTriggerType, FlowVersionState } from '../../src'

const baseFlowVersion = {
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

describe('CanvasLayout type', () => {
    it('should parse valid CanvasLayout with positions and viewport', () => {
        const layout = {
            positions: {
                'step_1': { x: 100, y: 200 },
                'step_2': { x: 300, y: 400 },
            },
            viewport: { x: 0, y: 0, zoom: 1 },
        }
        const result = CanvasLayout.parse(layout)
        expect(result.positions['step_1']).toEqual({ x: 100, y: 200 })
        expect(result.positions['step_2']).toEqual({ x: 300, y: 400 })
        expect(result.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
    })

    it('should parse CanvasLayout without viewport (viewport is optional)', () => {
        const layout = {
            positions: {
                'trigger': { x: 50, y: 50 },
            },
        }
        const result = CanvasLayout.parse(layout)
        expect(result.positions['trigger']).toEqual({ x: 50, y: 50 })
        expect(result.viewport).toBeUndefined()
    })

    it('should reject invalid position structure', () => {
        const layout = {
            positions: {
                'step_1': 'bad',
            },
        }
        expect(() => CanvasLayout.parse(layout)).toThrow()
    })

    it('should reject missing positions field', () => {
        const layout = {
            viewport: { x: 0, y: 0, zoom: 1 },
        }
        expect(() => CanvasLayout.parse(layout)).toThrow()
    })

    it('should parse CanvasViewport correctly', () => {
        const viewport = { x: 10, y: 20, zoom: 1.5 }
        const result = CanvasViewport.parse(viewport)
        expect(result).toEqual({ x: 10, y: 20, zoom: 1.5 })
    })

    it('should reject CanvasViewport without zoom', () => {
        const viewport = { x: 10, y: 20 }
        expect(() => CanvasViewport.parse(viewport)).toThrow()
    })
})

describe('FlowVersion canvasLayout field', () => {
    it('should parse FlowVersion with canvasLayout: null', () => {
        const flowVersion = {
            ...baseFlowVersion,
            canvasLayout: null,
        }
        const result = FlowVersion.parse(flowVersion)
        expect(result.canvasLayout).toBeNull()
    })

    it('should parse FlowVersion with valid canvasLayout data', () => {
        const flowVersion = {
            ...baseFlowVersion,
            canvasLayout: {
                positions: {
                    'trigger': { x: 100, y: 50 },
                    'step_1': { x: 100, y: 200 },
                },
                viewport: { x: 0, y: 0, zoom: 1 },
            },
        }
        const result = FlowVersion.parse(flowVersion)
        expect(result.canvasLayout).toBeDefined()
        expect(result.canvasLayout!.positions['trigger']).toEqual({ x: 100, y: 50 })
        expect(result.canvasLayout!.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
    })

    it('should parse FlowVersion without canvasLayout field (backward compat)', () => {
        const flowVersion = { ...baseFlowVersion }
        const result = FlowVersion.parse(flowVersion)
        expect(result.canvasLayout).toBeUndefined()
    })

    it('should parse FlowVersion with canvasLayout with empty positions', () => {
        const flowVersion = {
            ...baseFlowVersion,
            canvasLayout: {
                positions: {},
            },
        }
        const result = FlowVersion.parse(flowVersion)
        expect(result.canvasLayout).toBeDefined()
        expect(Object.keys(result.canvasLayout!.positions)).toHaveLength(0)
    })
})
