import { describe, it, expect } from 'vitest'
import {
    FlowVersion,
    FlowVersionState,
    FlowTriggerType,
    FlowOperationType,
    flowOperations,
    GraphData,
} from '../../src'
import {
    exportFlowToJson,
    validateFlowImport,
    createImportFlowOperation,
    FlowExportData,
} from '../../src/lib/automation/flows/util/flow-import-export-utils'

// === Тестовые фикстуры ===

const baseTrigger = {
    name: 'trigger',
    type: FlowTriggerType.EMPTY as const,
    valid: false,
    displayName: 'Empty Trigger',
    lastUpdatedDate: '2026-03-27T00:00:00.000Z',
    settings: {},
}

const baseFlowVersion: FlowVersion = {
    id: 'test-flow-version-id',
    created: '2026-03-27T00:00:00.000Z',
    updated: '2026-03-27T00:00:00.000Z',
    flowId: 'test-flow-id',
    updatedBy: null,
    displayName: 'Test Flow',
    agentIds: [],
    notes: [],
    trigger: baseTrigger,
    valid: false,
    schemaVersion: '20',
    state: FlowVersionState.DRAFT,
    connectionIds: [],
    backupFiles: null,
}

const sampleGraphData: GraphData = {
    nodes: [
        {
            id: 'trigger',
            type: 'trigger',
            position: { x: 100, y: 50 },
            displayName: 'Manual Trigger',
            valid: true,
            actionType: 'PIECE_TRIGGER',
            settings: { pieceName: '@activepieces/piece-schedule' },
        },
        {
            id: 'step_1',
            type: 'action',
            position: { x: 100, y: 200 },
            displayName: 'HTTP Request',
            valid: true,
            actionType: 'PIECE',
            settings: { pieceName: '@activepieces/piece-http' },
        },
        {
            id: 'step_2',
            type: 'action',
            position: { x: 100, y: 350 },
            displayName: 'Code Step',
            valid: true,
            actionType: 'CODE',
            settings: { sourceCode: { code: 'return 42;' } },
        },
    ],
    edges: [
        {
            id: 'trigger-output-step_1',
            source: 'trigger',
            target: 'step_1',
            sourceHandle: 'output',
            targetHandle: 'input',
        },
        {
            id: 'step_1-output-step_2',
            source: 'step_1',
            target: 'step_2',
            sourceHandle: 'output',
            targetHandle: 'input',
        },
    ],
}

// === Тесты exportFlowToJson ===

describe('exportFlowToJson', () => {
    it('возвращает null для flowVersion без graphData', () => {
        const result = exportFlowToJson(baseFlowVersion)
        expect(result).toBeNull()
    })

    it('экспортирует flowVersion с graphData в JSON строку', () => {
        const flowWithGraph: FlowVersion = {
            ...baseFlowVersion,
            graphData: sampleGraphData,
        }

        const jsonString = exportFlowToJson(flowWithGraph)
        expect(jsonString).not.toBeNull()

        const parsed = JSON.parse(jsonString!) as FlowExportData
        expect(parsed.displayName).toBe('Test Flow')
        expect(parsed.schemaVersion).toBe('20')
        expect(parsed.exportVersion).toBe('1.0')
        expect(parsed.exportedAt).toBeDefined()
        expect(parsed.graphData.nodes).toHaveLength(3)
        expect(parsed.graphData.edges).toHaveLength(2)
    })

    it('сохраняет все поля нод при экспорте', () => {
        const flowWithGraph: FlowVersion = {
            ...baseFlowVersion,
            graphData: {
                nodes: [
                    {
                        id: 'trigger',
                        type: 'trigger',
                        position: { x: 10, y: 20 },
                        displayName: 'Trigger Node',
                        valid: true,
                        skip: true,
                        errorHandling: { continueOnFailure: true },
                        actionType: 'PIECE_TRIGGER',
                        settings: { key: 'value' },
                        sampleData: { output: 'test' },
                    },
                ],
                edges: [],
            },
        }

        const parsed = JSON.parse(exportFlowToJson(flowWithGraph)!) as FlowExportData
        const node = parsed.graphData.nodes[0]
        expect(node.id).toBe('trigger')
        expect(node.position).toEqual({ x: 10, y: 20 })
        expect(node.skip).toBe(true)
        expect(node.errorHandling).toEqual({ continueOnFailure: true })
        expect(node.sampleData).toEqual({ output: 'test' })
    })

    it('не включает опциональные поля если они undefined', () => {
        const flowWithGraph: FlowVersion = {
            ...baseFlowVersion,
            graphData: {
                nodes: [
                    {
                        id: 'step_1',
                        type: 'action',
                        position: { x: 0, y: 0 },
                        displayName: 'Step',
                        valid: true,
                        actionType: 'CODE',
                        settings: {},
                    },
                ],
                edges: [],
            },
        }

        const parsed = JSON.parse(exportFlowToJson(flowWithGraph)!) as FlowExportData
        const node = parsed.graphData.nodes[0]
        expect(node.skip).toBeUndefined()
        expect(node.errorHandling).toBeUndefined()
        expect(node.sampleData).toBeUndefined()
    })
})

// === Тесты validateFlowImport ===

describe('validateFlowImport', () => {
    it('возвращает ошибку при невалидном JSON', () => {
        const result = validateFlowImport('not a json')
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBe('Invalid JSON format')
        }
    })

    it('возвращает ошибку при non-object JSON', () => {
        const result = validateFlowImport('"string"')
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBe('JSON must be an object')
        }
    })

    it('возвращает ошибку при отсутствии graphData', () => {
        const result = validateFlowImport('{"displayName": "test"}')
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBe('Missing or invalid graphData field')
        }
    })

    it('возвращает ошибку если graphData.nodes не массив', () => {
        const json = JSON.stringify({
            displayName: 'test',
            graphData: { nodes: 'not-array', edges: [] },
        })
        const result = validateFlowImport(json)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBe('graphData.nodes must be an array')
        }
    })

    it('возвращает ошибку если graphData.edges не массив', () => {
        const json = JSON.stringify({
            displayName: 'test',
            graphData: { nodes: [], edges: 'not-array' },
        })
        const result = validateFlowImport(json)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBe('graphData.edges must be an array')
        }
    })

    it('возвращает ошибку при невалидном node (отсутствует id)', () => {
        const json = JSON.stringify({
            displayName: 'test',
            graphData: {
                nodes: [{ type: 'action', position: { x: 0, y: 0 }, displayName: 'A', valid: true, actionType: 'CODE', settings: {} }],
                edges: [],
            },
        })
        const result = validateFlowImport(json)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toContain('Invalid node at index 0')
        }
    })

    it('возвращает ошибку при дубликатных node id', () => {
        const json = JSON.stringify({
            displayName: 'test',
            graphData: {
                nodes: [
                    { id: 'dup', type: 'action', position: { x: 0, y: 0 }, displayName: 'A', valid: true, actionType: 'CODE', settings: {} },
                    { id: 'dup', type: 'action', position: { x: 0, y: 0 }, displayName: 'B', valid: true, actionType: 'CODE', settings: {} },
                ],
                edges: [],
            },
        })
        const result = validateFlowImport(json)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBe('Duplicate node id: "dup"')
        }
    })

    it('возвращает ошибку при дубликатных edge id', () => {
        const json = JSON.stringify({
            displayName: 'test',
            graphData: {
                nodes: [
                    { id: 'a', type: 'action', position: { x: 0, y: 0 }, displayName: 'A', valid: true, actionType: 'CODE', settings: {} },
                    { id: 'b', type: 'action', position: { x: 0, y: 0 }, displayName: 'B', valid: true, actionType: 'CODE', settings: {} },
                ],
                edges: [
                    { id: 'dup-edge', source: 'a', target: 'b', sourceHandle: 'output', targetHandle: 'input' },
                    { id: 'dup-edge', source: 'b', target: 'a', sourceHandle: 'output', targetHandle: 'input' },
                ],
            },
        })
        const result = validateFlowImport(json)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toBe('Duplicate edge id: "dup-edge"')
        }
    })

    it('возвращает ошибку при edge ссылающемся на несуществующий source', () => {
        const json = JSON.stringify({
            displayName: 'test',
            graphData: {
                nodes: [
                    { id: 'a', type: 'action', position: { x: 0, y: 0 }, displayName: 'A', valid: true, actionType: 'CODE', settings: {} },
                ],
                edges: [
                    { id: 'e1', source: 'nonexistent', target: 'a', sourceHandle: 'output', targetHandle: 'input' },
                ],
            },
        })
        const result = validateFlowImport(json)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toContain('non-existent source node "nonexistent"')
        }
    })

    it('возвращает ошибку при edge ссылающемся на несуществующий target', () => {
        const json = JSON.stringify({
            displayName: 'test',
            graphData: {
                nodes: [
                    { id: 'a', type: 'action', position: { x: 0, y: 0 }, displayName: 'A', valid: true, actionType: 'CODE', settings: {} },
                ],
                edges: [
                    { id: 'e1', source: 'a', target: 'missing', sourceHandle: 'output', targetHandle: 'input' },
                ],
            },
        })
        const result = validateFlowImport(json)
        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.error).toContain('non-existent target node "missing"')
        }
    })

    it('валидирует корректный JSON и возвращает GraphData', () => {
        const exportData: FlowExportData = {
            displayName: 'Test Export',
            schemaVersion: '20',
            graphData: sampleGraphData,
            exportVersion: '1.0',
            exportedAt: '2026-03-28T00:00:00.000Z',
        }
        const json = JSON.stringify(exportData)

        const result = validateFlowImport(json)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.displayName).toBe('Test Export')
            expect(result.schemaVersion).toBe('20')
            expect(result.graphData.nodes).toHaveLength(3)
            expect(result.graphData.edges).toHaveLength(2)
        }
    })

    it('использует default displayName если отсутствует', () => {
        const json = JSON.stringify({
            graphData: {
                nodes: [
                    { id: 'a', type: 'action', position: { x: 0, y: 0 }, displayName: 'A', valid: true, actionType: 'CODE', settings: {} },
                ],
                edges: [],
            },
        })
        const result = validateFlowImport(json)
        expect(result.success).toBe(true)
        if (result.success) {
            expect(result.displayName).toBe('Imported Flow')
        }
    })
})

// === Тесты createImportFlowOperation ===

describe('createImportFlowOperation', () => {
    it('создаёт IMPORT_FLOW operation с graphData и trigger node', () => {
        const op = createImportFlowOperation({
            graphData: sampleGraphData,
            displayName: 'Imported',
            schemaVersion: '20',
        })

        expect(op.type).toBe('IMPORT_FLOW')
        expect(op.request.displayName).toBe('Imported')
        expect(op.request.schemaVersion).toBe('20')
        expect(op.request.notes).toBeNull()
        expect(op.request.graphData).toEqual(sampleGraphData)
        // trigger берётся из trigger node в graphData
        expect(op.request.trigger.name).toBe('trigger')
        expect(op.request.trigger.type).toBe('PIECE_TRIGGER')
    })

    it('создаёт IMPORT_FLOW operation с empty trigger если trigger node отсутствует', () => {
        const graphWithoutTrigger: GraphData = {
            nodes: [
                { id: 'step_1', type: 'action', position: { x: 0, y: 0 }, displayName: 'Step', valid: true, actionType: 'CODE', settings: {} },
            ],
            edges: [],
        }

        const op = createImportFlowOperation({
            graphData: graphWithoutTrigger,
            displayName: 'No Trigger',
            schemaVersion: null,
        })

        expect(op.request.trigger.name).toBe('trigger')
        expect(op.request.trigger.type).toBe('EMPTY')
        expect(op.request.trigger.valid).toBe(false)
    })
})

// === Тест round-trip: export -> validate -> import ===

describe('round-trip: export -> validate -> import', () => {
    it('round-trip: экспорт, валидация и импорт сохраняют graphData', () => {
        // Шаг 1: flowVersion с graphData
        const flowWithGraph: FlowVersion = {
            ...baseFlowVersion,
            graphData: sampleGraphData,
        }

        // Шаг 2: экспорт
        const jsonString = exportFlowToJson(flowWithGraph)
        expect(jsonString).not.toBeNull()

        // Шаг 3: валидация
        const validateResult = validateFlowImport(jsonString!)
        expect(validateResult.success).toBe(true)
        if (!validateResult.success) return

        // Шаг 4: создание операции
        const op = createImportFlowOperation(validateResult)
        expect(op.type).toBe('IMPORT_FLOW')
        expect(op.request.graphData!.nodes).toHaveLength(3)
        expect(op.request.graphData!.edges).toHaveLength(2)

        // Шаг 5: применение IMPORT_FLOW через flowOperations.apply
        const importedVersion = flowOperations.apply(baseFlowVersion, {
            type: FlowOperationType.IMPORT_FLOW,
            request: {
                displayName: op.request.displayName,
                trigger: baseTrigger,
                schemaVersion: op.request.schemaVersion,
                notes: null,
                graphData: op.request.graphData,
            },
        })

        expect(importedVersion.displayName).toBe('Test Flow')
        expect(importedVersion.graphData).toBeDefined()
        expect(importedVersion.graphData!.nodes).toHaveLength(3)
        expect(importedVersion.graphData!.edges).toHaveLength(2)
        expect(importedVersion.graphData!.nodes.map(n => n.id).sort()).toEqual(['step_1', 'step_2', 'trigger'])
    })
})

// === Тест IMPORT_FLOW с graphData через flowOperations ===

describe('IMPORT_FLOW с graphData через flowOperations.apply', () => {
    it('IMPORT_FLOW с graphData заполняет flowVersion.graphData', () => {
        const result = flowOperations.apply(baseFlowVersion, {
            type: FlowOperationType.IMPORT_FLOW,
            request: {
                displayName: 'Graph Import',
                trigger: baseTrigger,
                schemaVersion: '20',
                notes: null,
                graphData: sampleGraphData,
            },
        })

        expect(result.displayName).toBe('Graph Import')
        expect(result.graphData).toBeDefined()
        expect(result.graphData!.nodes).toHaveLength(3)
        expect(result.graphData!.edges).toHaveLength(2)
    })

    it('IMPORT_FLOW без graphData не создаёт graphData', () => {
        const result = flowOperations.apply(baseFlowVersion, {
            type: FlowOperationType.IMPORT_FLOW,
            request: {
                displayName: 'Legacy Import',
                trigger: baseTrigger,
                schemaVersion: '20',
                notes: null,
            },
        })

        expect(result.displayName).toBe('Legacy Import')
        // graphData остаётся undefined потому что graphData не передан
        expect(result.graphData).toBeUndefined()
    })

    it('IMPORT_FLOW с graphData заменяет существующий graphData', () => {
        const existingFlow: FlowVersion = {
            ...baseFlowVersion,
            graphData: {
                nodes: [
                    { id: 'old_node', type: 'action', position: { x: 0, y: 0 }, displayName: 'Old', valid: true, actionType: 'CODE', settings: {} },
                ],
                edges: [],
            },
        }

        const newGraphData: GraphData = {
            nodes: [
                { id: 'new_node', type: 'action', position: { x: 50, y: 50 }, displayName: 'New', valid: true, actionType: 'PIECE', settings: {} },
            ],
            edges: [],
        }

        const result = flowOperations.apply(existingFlow, {
            type: FlowOperationType.IMPORT_FLOW,
            request: {
                displayName: 'Replaced',
                trigger: baseTrigger,
                schemaVersion: '20',
                notes: null,
                graphData: newGraphData,
            },
        })

        expect(result.graphData).toBeDefined()
        expect(result.graphData!.nodes).toHaveLength(1)
        expect(result.graphData!.nodes[0].id).toBe('new_node')
    })
})
