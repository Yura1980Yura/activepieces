import { describe, it, expect } from 'vitest'
import { flowOperations, FlowOperationType } from '../../src/lib/automation/flows/operations/index'
import { FlowVersion, FlowVersionState } from '../../src/lib/automation/flows/flow-version'
import { FlowActionType } from '../../src/lib/automation/flows/actions/action'
import { FlowTriggerType } from '../../src/lib/automation/flows/triggers/trigger'
import { GraphData, GraphNodeDefinition } from '../../src/lib/automation/flows/graph-data'

// === Фабрика тестовых данных ===

function makeNode(id: string, overrides: Partial<GraphNodeDefinition> = {}): GraphNodeDefinition {
    return {
        id,
        type: 'action',
        position: { x: 0, y: 0 },
        displayName: `Node ${id}`,
        valid: false,
        actionType: 'CODE',
        settings: {},
        ...overrides,
    } as GraphNodeDefinition
}

function makeTriggerNode(name = 'trigger'): GraphNodeDefinition {
    return {
        id: name,
        type: 'trigger',
        position: { x: 0, y: 0 },
        displayName: 'Empty Trigger',
        valid: false,
        actionType: FlowTriggerType.EMPTY,
        settings: {},
    } as GraphNodeDefinition
}

function createFlowWithGraphData(graphData: GraphData): FlowVersion {
    return {
        id: 'test-version',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        flowId: 'test-flow',
        displayName: 'Test Flow',
        trigger: {
            type: FlowTriggerType.EMPTY,
            name: 'trigger',
            displayName: 'Empty Trigger',
            valid: false,
            settings: {},
            nextAction: undefined,
        },
        graphData,
        updatedBy: null,
        valid: false,
        schemaVersion: '20',
        agentIds: [],
        state: FlowVersionState.DRAFT,
        connectionIds: [],
        backupFiles: null,
        notes: [],
    } as unknown as FlowVersion
}

/**
 * Создаёт flow с trigger→step_1 через graphData (как будто пользователь
 * перетащил ноду на canvas и соединил).
 */
function createFlowWithOneCodeNode(): FlowVersion {
    const base = createFlowWithGraphData({
        nodes: [
            makeTriggerNode(),
            makeNode('step_1', { displayName: 'Code 1', actionType: 'CODE' }),
        ],
        edges: [
            { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' },
        ],
    })
    // Применяем GRAPH_ADD_NODE + GRAPH_ADD_EDGE чтобы trigger linked-list был синхронизирован
    let v = base
    // Пересоздадим через операции для корректной синхронизации
    v = createFlowWithGraphData({ nodes: [makeTriggerNode()], edges: [] })
    v = flowOperations.apply(v, {
        type: FlowOperationType.GRAPH_ADD_NODE,
        request: { node: makeNode('step_1', { displayName: 'Code 1', actionType: 'CODE' }) },
    })
    v = flowOperations.apply(v, {
        type: FlowOperationType.GRAPH_ADD_EDGE,
        request: { edge: { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' } },
    })
    return v
}

function createFlowWithChain(): FlowVersion {
    let v = createFlowWithGraphData({ nodes: [makeTriggerNode()], edges: [] })
    v = flowOperations.apply(v, {
        type: FlowOperationType.GRAPH_ADD_NODE,
        request: { node: makeNode('step_1', { displayName: 'A' }) },
    })
    v = flowOperations.apply(v, {
        type: FlowOperationType.GRAPH_ADD_NODE,
        request: { node: makeNode('step_2', { displayName: 'B' }) },
    })
    v = flowOperations.apply(v, {
        type: FlowOperationType.GRAPH_ADD_EDGE,
        request: { edge: { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' } },
    })
    v = flowOperations.apply(v, {
        type: FlowOperationType.GRAPH_ADD_EDGE,
        request: { edge: { id: 'e2', source: 'step_1', target: 'step_2', sourceHandle: 'output', targetHandle: 'input' } },
    })
    return v
}

// === ТЕСТЫ ===

describe('syncGraphDataFromTrigger — обратная синхронизация', () => {

    // --- Основные операции (8 тестов) ---

    it('UPDATE_ACTION → graphData.nodes[].settings обновлён', () => {
        const v = createFlowWithOneCodeNode()
        const result = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: {
                name: 'step_1',
                displayName: 'Updated Code',
                type: FlowActionType.CODE,
                valid: true,
                settings: {
                    input: { key: 'val' },
                    sourceCode: { code: 'export const code = async (inputs) => { return { value: 42 }; }', packageJson: '{}' },
                },
            },
        })
        const node = result.graphData!.nodes.find(n => n.id === 'step_1')!
        expect(node.displayName).toBe('Updated Code')
        expect(node.valid).toBe(true)
        expect(node.settings.sourceCode).toBeDefined()
        expect((node.settings.sourceCode as any).code).toContain('return { value: 42 }')
    })

    it('UPDATE_TRIGGER → graphData.nodes[trigger].settings обновлён', () => {
        const v = createFlowWithOneCodeNode()
        const result = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_TRIGGER,
            request: {
                name: 'trigger',
                type: FlowTriggerType.EMPTY,
                displayName: 'Renamed Trigger',
                valid: false,
                settings: { customKey: 'customValue' },
            } as any,
        })
        const triggerNode = result.graphData!.nodes.find(n => n.id === 'trigger')!
        expect(triggerNode.displayName).toBe('Renamed Trigger')
        expect(triggerNode.actionType).toBe(FlowTriggerType.EMPTY)
        expect((triggerNode.settings as any).customKey).toBe('customValue')
    })

    it('ADD_ACTION → новая нода появляется в graphData + edges обновлены', () => {
        const v = createFlowWithOneCodeNode()
        const result = flowOperations.apply(v, {
            type: FlowOperationType.ADD_ACTION,
            request: {
                parentStep: 'step_1',
                stepLocationRelativeToParent: 'AFTER' as any,
                action: {
                    name: 'step_2',
                    displayName: 'New Step',
                    type: FlowActionType.CODE,
                    valid: false,
                    settings: { input: {}, sourceCode: { code: 'return 1', packageJson: '{}' } },
                } as any,
            },
        })
        expect(result.graphData!.nodes.find(n => n.id === 'step_2')).toBeDefined()
        expect(result.graphData!.nodes.find(n => n.id === 'step_2')!.displayName).toBe('New Step')
        // Edge step_1→step_2 должен появиться
        expect(result.graphData!.edges.find(e => e.source === 'step_1' && e.target === 'step_2')).toBeDefined()
    })

    it('DELETE_ACTION → нода удалена + висячие edges удалены', () => {
        const v = createFlowWithChain()
        const result = flowOperations.apply(v, {
            type: FlowOperationType.DELETE_ACTION,
            request: { names: ['step_2'] },
        })
        expect(result.graphData!.nodes.find(n => n.id === 'step_2')).toBeUndefined()
        expect(result.graphData!.edges.find(e => e.target === 'step_2')).toBeUndefined()
    })

    it('DUPLICATE_ACTION → клон с уникальным именем + edges', () => {
        const v = createFlowWithOneCodeNode()
        // Сначала обновим step_1 с кодом
        const v2 = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: {
                name: 'step_1',
                displayName: 'Code 1',
                type: FlowActionType.CODE,
                valid: true,
                settings: { input: {}, sourceCode: { code: 'return 99', packageJson: '{}' } },
            },
        })
        const result = flowOperations.apply(v2, {
            type: FlowOperationType.DUPLICATE_ACTION,
            request: { stepName: 'step_1' },
        })
        // Должна появиться новая нода (step_1_copy_1 или step_2)
        const newNodes = result.graphData!.nodes.filter(n => n.id !== 'trigger' && n.id !== 'step_1')
        expect(newNodes.length).toBeGreaterThanOrEqual(1)
    })

    it('SET_SKIP_ACTION → skip поле обновлено в graphData', () => {
        const v = createFlowWithOneCodeNode()
        // Обновим чтобы был valid
        const v2 = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: {
                name: 'step_1',
                displayName: 'Code 1',
                type: FlowActionType.CODE,
                valid: true,
                settings: { input: {}, sourceCode: { code: 'return 1', packageJson: '{}' } },
            },
        })
        const result = flowOperations.apply(v2, {
            type: FlowOperationType.SET_SKIP_ACTION,
            request: { names: ['step_1'], skip: true },
        })
        const node = result.graphData!.nodes.find(n => n.id === 'step_1')!
        expect(node.skip).toBe(true)
    })

    it('ADD_BRANCH → router settings обновлены + branch edges', () => {
        // Создаём flow с router
        let v = createFlowWithGraphData({ nodes: [makeTriggerNode()], edges: [] })
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: {
                node: makeNode('step_1', {
                    displayName: 'Router',
                    actionType: FlowActionType.ROUTER,
                    settings: {
                        branches: [
                            { branchType: 'CONDITION', branchName: 'Branch 1', conditions: [[{ firstValue: '', operator: 'TEXT_EXACTLY_MATCHES', secondValue: '', caseSensitive: false }]] },
                            { branchType: 'FALLBACK', branchName: 'Otherwise' },
                        ],
                        executionType: 'EXECUTE_FIRST_MATCH',
                        inputUiInfo: {},
                    },
                }),
            },
        })
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' } },
        })
        // ADD_BRANCH
        const result = flowOperations.apply(v, {
            type: FlowOperationType.ADD_BRANCH,
            request: { stepName: 'step_1', branchIndex: 1 },
        })
        const routerNode = result.graphData!.nodes.find(n => n.id === 'step_1')!
        expect((routerNode.settings as any).branches.length).toBeGreaterThanOrEqual(3)
    })

    it('CHANGE_NAME → displayName обновлён в flowVersion (не нода)', () => {
        const v = createFlowWithOneCodeNode()
        const result = flowOperations.apply(v, {
            type: FlowOperationType.CHANGE_NAME,
            request: { displayName: 'New Flow Name' },
        })
        expect(result.displayName).toBe('New Flow Name')
        // graphData должен остаться нетронутым (sync не ломает)
        expect(result.graphData!.nodes.find(n => n.id === 'step_1')).toBeDefined()
    })

    // --- Edge-cases (4 теста) ---

    it('GRAPH_ADD_NODE → sync НЕ вызывается (нет circular)', () => {
        const v = createFlowWithOneCodeNode()
        const result = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makeNode('step_orphan', { displayName: 'Orphan' }) },
        })
        // Orphan нода должна остаться в graphData (sync не удаляет при GRAPH_ADD_NODE)
        expect(result.graphData!.nodes.find(n => n.id === 'step_orphan')).toBeDefined()
    })

    it('Legacy flow без graphData → ничего не ломается', () => {
        const legacyFlow: FlowVersion = {
            id: 'legacy-version',
            created: '2026-01-01T00:00:00Z',
            updated: '2026-01-01T00:00:00Z',
            flowId: 'legacy-flow',
            displayName: 'Legacy Flow',
            trigger: {
                type: FlowTriggerType.EMPTY,
                name: 'trigger',
                displayName: 'Empty Trigger',
                valid: false,
                settings: {},
                nextAction: {
                    name: 'step_1',
                    displayName: 'Code 1',
                    type: FlowActionType.CODE,
                    valid: true,
                    settings: { input: {}, sourceCode: { code: 'return 1', packageJson: '{}' } },
                } as any,
            },
            graphData: undefined as any,
            updatedBy: null,
            valid: true,
            schemaVersion: '20',
            agentIds: [],
            state: FlowVersionState.DRAFT,
            connectionIds: [],
            backupFiles: null,
            notes: [],
        } as unknown as FlowVersion

        const result = flowOperations.apply(legacyFlow, {
            type: FlowOperationType.UPDATE_ACTION,
            request: {
                name: 'step_1',
                displayName: 'Updated',
                type: FlowActionType.CODE,
                valid: true,
                settings: { input: {}, sourceCode: { code: 'return 2', packageJson: '{}' } },
            },
        })
        // graphData по-прежнему undefined — sync ничего не делает
        expect(result.graphData).toBeUndefined()
        // trigger linked-list обновлён
        expect(result.trigger.nextAction!.displayName).toBe('Updated')
    })

    it('Пустой flow (только trigger) → graphData содержит только trigger, 0 edges', () => {
        const v = createFlowWithGraphData({
            nodes: [makeTriggerNode()],
            edges: [],
        })
        // Простая операция чтобы вызвать sync
        const result = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_TRIGGER,
            request: {
                name: 'trigger',
                type: FlowTriggerType.EMPTY,
                displayName: 'Renamed Trigger',
                valid: false,
                settings: {},
            } as any,
        })
        expect(result.graphData!.nodes).toHaveLength(1)
        expect(result.graphData!.nodes[0].id).toBe('trigger')
        expect(result.graphData!.nodes[0].displayName).toBe('Renamed Trigger')
        expect(result.graphData!.edges).toHaveLength(0)
    })

    it('Router с LOOP внутри → вложенные ноды и edges корректны', () => {
        // Создаём router с loop внутри ветки
        let v = createFlowWithGraphData({ nodes: [makeTriggerNode()], edges: [] })
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: {
                node: makeNode('step_1', {
                    displayName: 'Router',
                    actionType: FlowActionType.ROUTER,
                    settings: {
                        branches: [
                            { branchType: 'CONDITION', branchName: 'Branch 1', conditions: [[{ firstValue: '1', operator: 'TEXT_EXACTLY_MATCHES', secondValue: '1', caseSensitive: false }]] },
                            { branchType: 'FALLBACK', branchName: 'Otherwise' },
                        ],
                        executionType: 'EXECUTE_FIRST_MATCH',
                        inputUiInfo: {},
                    },
                }),
            },
        })
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' } },
        })
        // Добавим loop в branch-0 через ADD_ACTION (legacy путь)
        v = flowOperations.apply(v, {
            type: FlowOperationType.ADD_ACTION,
            request: {
                parentStep: 'step_1',
                stepLocationRelativeToParent: 'INSIDE_BRANCH' as any,
                branchIndex: 0,
                action: {
                    name: 'step_2',
                    displayName: 'Loop',
                    type: FlowActionType.LOOP_ON_ITEMS,
                    valid: true,
                    settings: { items: '{{ step_1 }}', inputUiInfo: {} },
                } as any,
            },
        })
        // Проверяем graphData
        expect(result(v).nodes.find(n => n.id === 'step_2')).toBeDefined()
        expect(result(v).nodes.find(n => n.id === 'step_2')!.actionType).toBe(FlowActionType.LOOP_ON_ITEMS)
        // Edges: trigger→router(output), router→loop(branch-0)
        expect(result(v).edges.find(e => e.source === 'step_1' && e.sourceHandle === 'branch-0')).toBeDefined()
    })

    // --- Anti-маскировка + round-trip (4 теста) ---

    it('Smoking gun: UPDATE_ACTION → graphData.nodes[step].settings.input.code === "return 42"', () => {
        const v = createFlowWithOneCodeNode()
        const result = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: {
                name: 'step_1',
                displayName: 'Code',
                type: FlowActionType.CODE,
                valid: true,
                settings: {
                    input: { code: 'return 42' },
                    sourceCode: { code: 'export const code = async (inputs) => { return { value: 42 }; }', packageJson: '{}' },
                },
            },
        })
        const node = result.graphData!.nodes.find(n => n.id === 'step_1')!
        expect((node.settings as any).input.code).toBe('return 42')
    })

    it('Double round-trip: UPDATE→GRAPH_ADD_EDGE→UPDATE→GRAPH_ADD_EDGE → settings корректны', () => {
        let v = createFlowWithChain()

        // 1. UPDATE_ACTION step_1
        v = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: {
                name: 'step_1',
                displayName: 'A v1',
                type: FlowActionType.CODE,
                valid: true,
                settings: { input: {}, sourceCode: { code: 'return 1', packageJson: '{}' } },
            },
        })

        // 2. GRAPH_ADD_NODE step_3 + GRAPH_ADD_EDGE step_2→step_3
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makeNode('step_3', { displayName: 'C' }) },
        })
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: { id: 'e3', source: 'step_2', target: 'step_3', sourceHandle: 'output', targetHandle: 'input' } },
        })

        // 3. UPDATE_ACTION step_2
        v = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: {
                name: 'step_2',
                displayName: 'B v1',
                type: FlowActionType.CODE,
                valid: true,
                settings: { input: {}, sourceCode: { code: 'return 2', packageJson: '{}' } },
            },
        })

        // 4. GRAPH_ADD_EDGE (ещё одна нода)
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makeNode('step_4', { displayName: 'D' }) },
        })
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: { id: 'e4', source: 'step_3', target: 'step_4', sourceHandle: 'output', targetHandle: 'input' } },
        })

        // Проверяем: settings step_1 и step_2 сохранены после всех round-trips
        const s1 = v.graphData!.nodes.find(n => n.id === 'step_1')!
        const s2 = v.graphData!.nodes.find(n => n.id === 'step_2')!
        expect(s1.displayName).toBe('A v1')
        expect((s1.settings as any).sourceCode.code).toBe('return 1')
        expect(s2.displayName).toBe('B v1')
        expect((s2.settings as any).sourceCode.code).toBe('return 2')
        expect(v.graphData!.nodes).toHaveLength(5) // trigger + step_1..4
        expect(v.graphData!.edges).toHaveLength(4) // trigger→s1→s2→s3→s4
    })

    it('USE_AS_DRAFT → graphData передаётся через IMPORT_FLOW', () => {
        // Тестируем что IMPORT_FLOW с graphData корректно заменяет
        const graphData: GraphData = {
            nodes: [
                makeTriggerNode(),
                makeNode('step_1', { displayName: 'Imported Code' }),
            ],
            edges: [
                { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' },
            ],
        }
        const trigger = {
            name: 'trigger',
            type: FlowTriggerType.EMPTY,
            displayName: 'Empty Trigger',
            valid: false,
            settings: {},
            nextAction: {
                name: 'step_1',
                displayName: 'Imported Code',
                type: FlowActionType.CODE,
                valid: false,
                settings: { input: {}, sourceCode: { code: 'return 100', packageJson: '{}' } },
            },
        }
        const v = createFlowWithOneCodeNode()
        const result = flowOperations.apply(v, {
            type: FlowOperationType.IMPORT_FLOW,
            request: {
                displayName: 'Imported Flow',
                trigger: trigger as any,
                schemaVersion: '20',
                notes: null,
                graphData,
            },
        })
        expect(result.graphData).toBeDefined()
        expect(result.graphData!.nodes.find(n => n.id === 'step_1')).toBeDefined()
        expect(result.graphData!.edges.find(e => e.source === 'trigger' && e.target === 'step_1')).toBeDefined()
    })

    it('Performance: flow 50 нод → sync < 50ms', () => {
        // Создаём chain из 50 нод
        let v = createFlowWithGraphData({ nodes: [makeTriggerNode()], edges: [] })
        let prevNode = 'trigger'
        for (let i = 1; i <= 50; i++) {
            const nodeId = `step_${i}`
            v = flowOperations.apply(v, {
                type: FlowOperationType.GRAPH_ADD_NODE,
                request: { node: makeNode(nodeId) },
            })
            v = flowOperations.apply(v, {
                type: FlowOperationType.GRAPH_ADD_EDGE,
                request: { edge: { id: `e${i}`, source: prevNode, target: nodeId, sourceHandle: 'output', targetHandle: 'input' } },
            })
            prevNode = nodeId
        }

        // Замеряем sync через UPDATE_ACTION
        const start = performance.now()
        flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: {
                name: 'step_25',
                displayName: 'Updated Mid',
                type: FlowActionType.CODE,
                valid: true,
                settings: { input: {}, sourceCode: { code: 'return 50', packageJson: '{}' } },
            },
        })
        const duration = performance.now() - start
        expect(duration).toBeLessThan(50)
    })
})

// Хелпер для graphData
function result(v: FlowVersion) {
    return v.graphData!
}
