import { describe, it, expect } from 'vitest'
import {
    FlowActionType,
    FlowTriggerType,
    FlowVersion,
    FlowVersionState,
    GraphData,
    GraphEdgeDefinition,
    GraphNodeDefinition,
    LATEST_FLOW_SCHEMA_VERSION,
    linkedListToGraph,
} from '../../src'

/**
 * Тесты миграции v19 -> v20: генерация graphData из linked-list.
 *
 * Эти тесты воспроизводят логику миграции migrate-v19-add-graph-data.ts,
 * используя linkedListToGraph() из shared и маппинг GraphNode -> GraphNodeDefinition.
 * Это гарантирует что миграция корректно конвертирует linked-list в graphData.
 */

function extractErrorHandling(
    options: { continueOnFailure?: { value?: boolean }; retryOnFailure?: { value?: boolean } } | undefined,
): { continueOnFailure?: boolean; retryOnFailure?: boolean } | undefined {
    if (!options) return undefined
    const result: { continueOnFailure?: boolean; retryOnFailure?: boolean } = {}
    let hasValues = false
    if (options.continueOnFailure?.value !== undefined) {
        result.continueOnFailure = options.continueOnFailure.value
        hasValues = true
    }
    if (options.retryOnFailure?.value !== undefined) {
        result.retryOnFailure = options.retryOnFailure.value
        hasValues = true
    }
    return hasValues ? result : undefined
}

/** Воспроизводит логику миграции для тестирования */
function migrateV19ToV20(flowVersion: FlowVersion): FlowVersion & { graphData: GraphData } {
    const { nodes, edges } = linkedListToGraph(flowVersion)

    const graphNodes: GraphNodeDefinition[] = nodes.map((node) => {
        const step = node.data.step
        const settings = step.settings as Record<string, unknown>
        const errorHandlingOptions = settings.errorHandlingOptions as
            | { continueOnFailure?: { value?: boolean }; retryOnFailure?: { value?: boolean } }
            | undefined
        const errorHandling = extractErrorHandling(errorHandlingOptions)
        const sampleData = settings.sampleData as Record<string, unknown> | undefined

        return {
            id: node.id,
            type: node.type as GraphNodeDefinition['type'],
            position: { x: node.position.x, y: node.position.y },
            displayName: step.displayName,
            valid: step.valid,
            ...(step.skip !== undefined ? { skip: step.skip } : {}),
            ...(errorHandling ? { errorHandling } : {}),
            actionType: step.type,
            settings,
            ...(sampleData !== undefined ? { sampleData } : {}),
        }
    })

    const graphEdges: GraphEdgeDefinition[] = edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
    }))

    return {
        ...flowVersion,
        graphData: { nodes: graphNodes, edges: graphEdges },
        schemaVersion: '20',
    }
}

function createBaseFlowVersion(overrides: Partial<FlowVersion> = {}): FlowVersion {
    return {
        id: 'test-fv-id',
        created: '2026-03-28T00:00:00.000Z',
        updated: '2026-03-28T00:00:00.000Z',
        flowId: 'test-flow-id',
        displayName: 'Test Flow',
        trigger: {
            name: 'trigger',
            type: FlowTriggerType.EMPTY,
            valid: false,
            displayName: 'Empty Trigger',
            lastUpdatedDate: '2026-03-28T00:00:00.000Z',
            settings: {},
        },
        updatedBy: null,
        valid: false,
        schemaVersion: '19',
        agentIds: [],
        state: FlowVersionState.DRAFT,
        connectionIds: [],
        backupFiles: null,
        notes: [],
        canvasLayout: null,
        ...overrides,
    } as FlowVersion
}

describe('Миграция v19 -> v20: генерация graphData', () => {

    it('LATEST_FLOW_SCHEMA_VERSION равна 20', () => {
        expect(LATEST_FLOW_SCHEMA_VERSION).toBe('20')
    })

    it('должна установить schemaVersion в 20', () => {
        const input = createBaseFlowVersion()
        const result = migrateV19ToV20(input)
        expect(result.schemaVersion).toBe('20')
    })

    it('должна создать graphData для trigger-only flow', () => {
        const input = createBaseFlowVersion()
        const result = migrateV19ToV20(input)

        expect(result.graphData).toBeDefined()
        expect(result.graphData.nodes).toHaveLength(1)
        expect(result.graphData.edges).toHaveLength(0)

        const triggerNode = result.graphData.nodes[0]
        expect(triggerNode.id).toBe('trigger')
        expect(triggerNode.type).toBe('trigger')
        expect(triggerNode.displayName).toBe('Empty Trigger')
        expect(triggerNode.valid).toBe(false)
        expect(triggerNode.actionType).toBe(FlowTriggerType.EMPTY)
    })

    it('должна создать graphData для линейной цепочки trigger -> code', () => {
        const input = createBaseFlowVersion({
            trigger: {
                name: 'trigger',
                type: FlowTriggerType.EMPTY,
                valid: true,
                displayName: 'Manual Trigger',
                lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                settings: {},
                nextAction: {
                    name: 'step_1',
                    type: FlowActionType.CODE,
                    valid: true,
                    displayName: 'Code Step',
                    lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                    settings: {
                        sourceCode: { packageJson: '{}', code: 'return 1' },
                        input: {},
                    },
                },
            },
        } as Partial<FlowVersion>)

        const result = migrateV19ToV20(input)

        expect(result.graphData.nodes).toHaveLength(2)
        expect(result.graphData.edges).toHaveLength(1)

        const triggerNode = result.graphData.nodes.find(n => n.id === 'trigger')
        expect(triggerNode!.type).toBe('trigger')

        const codeNode = result.graphData.nodes.find(n => n.id === 'step_1')
        expect(codeNode!.type).toBe('action')
        expect(codeNode!.displayName).toBe('Code Step')
        expect(codeNode!.actionType).toBe(FlowActionType.CODE)

        const edge = result.graphData.edges[0]
        expect(edge.source).toBe('trigger')
        expect(edge.target).toBe('step_1')
        expect(edge.sourceHandle).toBe('output')
        expect(edge.targetHandle).toBe('input')
    })

    it('должна создать graphData для flow с Loop', () => {
        const input = createBaseFlowVersion({
            trigger: {
                name: 'trigger',
                type: FlowTriggerType.EMPTY,
                valid: true,
                displayName: 'Trigger',
                lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                settings: {},
                nextAction: {
                    name: 'loop_1',
                    type: FlowActionType.LOOP_ON_ITEMS,
                    valid: true,
                    displayName: 'Loop',
                    lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                    settings: { items: '{{trigger.items}}' },
                    firstLoopAction: {
                        name: 'step_2',
                        type: FlowActionType.CODE,
                        valid: true,
                        displayName: 'Loop Body',
                        lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                        settings: {
                            sourceCode: { packageJson: '{}', code: 'return 1' },
                            input: {},
                        },
                    },
                },
            },
        } as Partial<FlowVersion>)

        const result = migrateV19ToV20(input)

        expect(result.graphData.nodes).toHaveLength(3)
        expect(result.graphData.edges).toHaveLength(2)

        const loopNode = result.graphData.nodes.find(n => n.id === 'loop_1')
        expect(loopNode!.type).toBe('loop')

        const loopEdge = result.graphData.edges.find(e => e.sourceHandle === 'loop-output')
        expect(loopEdge!.source).toBe('loop_1')
        expect(loopEdge!.target).toBe('step_2')
    })

    it('должна создать graphData для flow с Router', () => {
        const input = createBaseFlowVersion({
            trigger: {
                name: 'trigger',
                type: FlowTriggerType.EMPTY,
                valid: true,
                displayName: 'Trigger',
                lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                settings: {},
                nextAction: {
                    name: 'router_1',
                    type: FlowActionType.ROUTER,
                    valid: true,
                    displayName: 'Router',
                    lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                    settings: {
                        branches: [
                            { branchType: 'CONDITION', branchName: 'Branch 1', conditions: [] },
                            { branchType: 'FALLBACK', branchName: 'Fallback' },
                        ],
                        executionType: 'EXECUTE_FIRST_MATCH',
                    },
                    children: [
                        {
                            name: 'step_b0',
                            type: FlowActionType.CODE,
                            valid: true,
                            displayName: 'Branch 0 Code',
                            lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                            settings: {
                                sourceCode: { packageJson: '{}', code: 'return 1' },
                                input: {},
                            },
                        },
                        null,
                    ],
                },
            },
        } as Partial<FlowVersion>)

        const result = migrateV19ToV20(input)

        expect(result.graphData.nodes).toHaveLength(3)

        const routerNode = result.graphData.nodes.find(n => n.id === 'router_1')
        expect(routerNode!.type).toBe('router')

        const branchEdge = result.graphData.edges.find(e => e.sourceHandle === 'branch-0')
        expect(branchEdge!.source).toBe('router_1')
        expect(branchEdge!.target).toBe('step_b0')
    })

    it('должна сохранить linked-list поля (trigger) для обратной совместимости', () => {
        const input = createBaseFlowVersion()
        const result = migrateV19ToV20(input)

        expect(result.trigger).toBeDefined()
        expect(result.trigger.name).toBe('trigger')
        expect(result.trigger.type).toBe(FlowTriggerType.EMPTY)
    })

    it('должна корректно извлечь skip поле', () => {
        const input = createBaseFlowVersion({
            trigger: {
                name: 'trigger',
                type: FlowTriggerType.EMPTY,
                valid: true,
                displayName: 'Trigger',
                lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                settings: {},
                nextAction: {
                    name: 'step_1',
                    type: FlowActionType.CODE,
                    valid: true,
                    displayName: 'Skipped Step',
                    lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                    skip: true,
                    settings: {
                        sourceCode: { packageJson: '{}', code: 'return 1' },
                        input: {},
                    },
                },
            },
        } as Partial<FlowVersion>)

        const result = migrateV19ToV20(input)
        const skippedNode = result.graphData.nodes.find(n => n.id === 'step_1')
        expect(skippedNode!.skip).toBe(true)
    })

    it('должна применить позиции из canvasLayout', () => {
        const input = createBaseFlowVersion({
            canvasLayout: {
                positions: { 'trigger': { x: 100, y: 50 } },
            },
        })

        const result = migrateV19ToV20(input)
        const triggerNode = result.graphData.nodes.find(n => n.id === 'trigger')
        expect(triggerNode!.position).toEqual({ x: 100, y: 50 })
    })

    it('должна использовать {0,0} когда canvasLayout отсутствует', () => {
        const input = createBaseFlowVersion({ canvasLayout: null })
        const result = migrateV19ToV20(input)
        const triggerNode = result.graphData.nodes.find(n => n.id === 'trigger')
        expect(triggerNode!.position).toEqual({ x: 0, y: 0 })
    })

    it('должна создать корректные id рёбер в формате source-handle-target', () => {
        const input = createBaseFlowVersion({
            trigger: {
                name: 'trigger',
                type: FlowTriggerType.EMPTY,
                valid: true,
                displayName: 'Trigger',
                lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                settings: {},
                nextAction: {
                    name: 'step_1',
                    type: FlowActionType.CODE,
                    valid: true,
                    displayName: 'Code',
                    lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                    settings: {
                        sourceCode: { packageJson: '{}', code: '' },
                        input: {},
                    },
                },
            },
        } as Partial<FlowVersion>)

        const result = migrateV19ToV20(input)
        expect(result.graphData.edges[0].id).toBe('trigger-output-step_1')
    })

    it('должна извлечь errorHandling из errorHandlingOptions', () => {
        const input = createBaseFlowVersion({
            trigger: {
                name: 'trigger',
                type: FlowTriggerType.EMPTY,
                valid: true,
                displayName: 'Trigger',
                lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                settings: {},
                nextAction: {
                    name: 'step_1',
                    type: FlowActionType.CODE,
                    valid: true,
                    displayName: 'Code',
                    lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                    settings: {
                        sourceCode: { packageJson: '{}', code: '' },
                        input: {},
                        errorHandlingOptions: {
                            continueOnFailure: { value: true },
                            retryOnFailure: { value: false },
                        },
                    },
                },
            },
        } as Partial<FlowVersion>)

        const result = migrateV19ToV20(input)
        const codeNode = result.graphData.nodes.find(n => n.id === 'step_1')
        expect(codeNode!.errorHandling).toBeDefined()
        expect(codeNode!.errorHandling!.continueOnFailure).toBe(true)
        expect(codeNode!.errorHandling!.retryOnFailure).toBe(false)
    })

    it('не должна включать errorHandling если errorHandlingOptions отсутствует', () => {
        const input = createBaseFlowVersion({
            trigger: {
                name: 'trigger',
                type: FlowTriggerType.EMPTY,
                valid: true,
                displayName: 'Trigger',
                lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                settings: {},
                nextAction: {
                    name: 'step_1',
                    type: FlowActionType.CODE,
                    valid: true,
                    displayName: 'Code',
                    lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                    settings: {
                        sourceCode: { packageJson: '{}', code: '' },
                        input: {},
                    },
                },
            },
        } as Partial<FlowVersion>)

        const result = migrateV19ToV20(input)
        const codeNode = result.graphData.nodes.find(n => n.id === 'step_1')
        expect(codeNode!.errorHandling).toBeUndefined()
    })

    it('GraphData из миграции должна проходить zod-валидацию', () => {
        const input = createBaseFlowVersion({
            trigger: {
                name: 'trigger',
                type: FlowTriggerType.EMPTY,
                valid: true,
                displayName: 'Trigger',
                lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                settings: {},
                nextAction: {
                    name: 'step_1',
                    type: FlowActionType.CODE,
                    valid: true,
                    displayName: 'Code',
                    lastUpdatedDate: '2026-03-28T00:00:00.000Z',
                    settings: {
                        sourceCode: { packageJson: '{}', code: '' },
                        input: {},
                    },
                },
            },
        } as Partial<FlowVersion>)

        const result = migrateV19ToV20(input)
        // GraphData — zod-схема, импортированная из ../../src, можно вызвать safeParse
        const parseResult = GraphData.safeParse(result.graphData)
        expect(parseResult.success).toBe(true)
    })
})
