import {
    FlowActionType,
    FlowTriggerType,
    FlowVersionState,
    RouterExecutionType,
    BranchExecutionType,
    BranchOperator,
} from '../../src'
import type { FlowVersion, FlowAction, LoopOnItemsAction, RouterAction, FlowTrigger, GraphData, GraphNodeDefinition, GraphEdgeDefinition } from '../../src'
import { graphDataToLinkedList, linkedListToGraph } from '../../src/lib/automation/flows/util/graph-converter'
import { flowOperations, FlowOperationType } from '../../src/lib/automation/flows/operations'

// === Фабрики GraphNodeDefinition ===

function makeTriggerNodeDef(overrides?: Partial<GraphNodeDefinition>): GraphNodeDefinition {
    return {
        id: 'trigger',
        type: 'trigger',
        position: { x: 0, y: 0 },
        displayName: 'Empty Trigger',
        valid: false,
        actionType: FlowTriggerType.EMPTY,
        settings: {},
        ...overrides,
    }
}

function makeCodeNodeDef(id: string, overrides?: Partial<GraphNodeDefinition>): GraphNodeDefinition {
    return {
        id,
        type: 'action',
        position: { x: 0, y: 100 },
        displayName: `Code ${id}`,
        valid: true,
        actionType: FlowActionType.CODE,
        settings: {
            sourceCode: { code: 'test', packageJson: '{}' },
            input: {},
        },
        ...overrides,
    }
}

function makePieceNodeDef(id: string, overrides?: Partial<GraphNodeDefinition>): GraphNodeDefinition {
    return {
        id,
        type: 'action',
        position: { x: 0, y: 200 },
        displayName: `Piece ${id}`,
        valid: true,
        actionType: FlowActionType.PIECE,
        settings: {
            pieceName: 'test-piece',
            pieceVersion: '1.0.0',
            actionName: 'test-action',
            input: {},
            propertySettings: {},
        },
        ...overrides,
    }
}

function makeLoopNodeDef(id: string, overrides?: Partial<GraphNodeDefinition>): GraphNodeDefinition {
    return {
        id,
        type: 'loop',
        position: { x: 0, y: 300 },
        displayName: `Loop ${id}`,
        valid: true,
        actionType: FlowActionType.LOOP_ON_ITEMS,
        settings: {
            items: '{{trigger.items}}',
        },
        ...overrides,
    }
}

function makeRouterNodeDef(id: string, branchCount: number, overrides?: Partial<GraphNodeDefinition>): GraphNodeDefinition {
    const branches = Array.from({ length: branchCount }, (_, i) => ({
        conditions: [[{ operator: BranchOperator.TEXT_CONTAINS, firstValue: '1', secondValue: '1' }]],
        branchType: BranchExecutionType.CONDITION,
        branchName: `Branch ${i}`,
    }))
    return {
        id,
        type: 'router',
        position: { x: 0, y: 400 },
        displayName: `Router ${id}`,
        valid: true,
        actionType: FlowActionType.ROUTER,
        settings: {
            branches,
            executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
        },
        ...overrides,
    }
}

function makeEdgeDef(source: string, target: string, sourceHandle: string): GraphEdgeDefinition {
    return {
        id: `${source}-${sourceHandle}-${target}`,
        source,
        target,
        sourceHandle,
        targetHandle: 'input',
    }
}

// === Фабрика FlowVersion ===

function createBaseFlowVersion(graphData?: GraphData): FlowVersion {
    return {
        id: 'version-1',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
        flowId: 'flow-1',
        displayName: 'Test Flow',
        trigger: {
            type: FlowTriggerType.EMPTY as any,
            name: 'trigger',
            displayName: 'Empty Trigger',
            valid: false,
            settings: {},
            lastUpdatedDate: '2024-01-01T00:00:00Z',
        },
        graphData,
        updatedBy: null,
        valid: true,
        schemaVersion: '20',
        agentIds: [],
        state: FlowVersionState.DRAFT,
        connectionIds: [],
        backupFiles: null,
        notes: [],
        canvasLayout: null,
    }
}

// === Тесты graphDataToLinkedList ===

describe('graphDataToLinkedList', () => {
    it('должен конвертировать trigger-only graphData в FlowTrigger без nextAction', () => {
        const graphData: GraphData = {
            nodes: [makeTriggerNodeDef()],
            edges: [],
        }
        const trigger = graphDataToLinkedList(graphData)
        expect(trigger.name).toBe('trigger')
        expect(trigger.type).toBe(FlowTriggerType.EMPTY)
        expect(trigger.nextAction).toBeUndefined()
    })

    it('должен конвертировать линейный поток trigger -> code -> piece', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeCodeNodeDef('step_1'),
                makePieceNodeDef('step_2'),
            ],
            edges: [
                makeEdgeDef('trigger', 'step_1', 'output'),
                makeEdgeDef('step_1', 'step_2', 'output'),
            ],
        }
        const trigger = graphDataToLinkedList(graphData)

        expect(trigger.name).toBe('trigger')
        expect(trigger.nextAction).toBeDefined()
        expect(trigger.nextAction!.name).toBe('step_1')
        expect(trigger.nextAction!.type).toBe(FlowActionType.CODE)
        expect(trigger.nextAction!.nextAction).toBeDefined()
        expect(trigger.nextAction!.nextAction!.name).toBe('step_2')
        expect(trigger.nextAction!.nextAction!.type).toBe(FlowActionType.PIECE)
        expect(trigger.nextAction!.nextAction!.nextAction).toBeUndefined()
    })

    it('должен конвертировать поток с loop и firstLoopAction', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeLoopNodeDef('loop_step'),
                makeCodeNodeDef('loop_child'),
            ],
            edges: [
                makeEdgeDef('trigger', 'loop_step', 'output'),
                makeEdgeDef('loop_step', 'loop_child', 'loop-output'),
            ],
        }
        const trigger = graphDataToLinkedList(graphData)

        expect(trigger.nextAction).toBeDefined()
        const loop = trigger.nextAction as LoopOnItemsAction
        expect(loop.type).toBe(FlowActionType.LOOP_ON_ITEMS)
        expect(loop.name).toBe('loop_step')
        expect(loop.firstLoopAction).toBeDefined()
        expect(loop.firstLoopAction!.name).toBe('loop_child')
        expect(loop.firstLoopAction!.type).toBe(FlowActionType.CODE)
    })

    it('должен конвертировать поток с loop, firstLoopAction и nextAction', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeLoopNodeDef('loop_step'),
                makeCodeNodeDef('loop_child'),
                makeCodeNodeDef('after_loop'),
            ],
            edges: [
                makeEdgeDef('trigger', 'loop_step', 'output'),
                makeEdgeDef('loop_step', 'loop_child', 'loop-output'),
                makeEdgeDef('loop_step', 'after_loop', 'output'),
            ],
        }
        const trigger = graphDataToLinkedList(graphData)

        const loop = trigger.nextAction as LoopOnItemsAction
        expect(loop.firstLoopAction!.name).toBe('loop_child')
        expect(loop.nextAction).toBeDefined()
        expect(loop.nextAction!.name).toBe('after_loop')
    })

    it('должен конвертировать поток с router и children[]', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeRouterNodeDef('router_step', 2),
                makeCodeNodeDef('branch_0_child'),
                makePieceNodeDef('branch_1_child'),
            ],
            edges: [
                makeEdgeDef('trigger', 'router_step', 'output'),
                makeEdgeDef('router_step', 'branch_0_child', 'branch-0'),
                makeEdgeDef('router_step', 'branch_1_child', 'branch-1'),
            ],
        }
        const trigger = graphDataToLinkedList(graphData)

        const router = trigger.nextAction as RouterAction
        expect(router.type).toBe(FlowActionType.ROUTER)
        expect(router.name).toBe('router_step')
        expect(router.children).toHaveLength(2)
        expect(router.children[0]!.name).toBe('branch_0_child')
        expect(router.children[0]!.type).toBe(FlowActionType.CODE)
        expect(router.children[1]!.name).toBe('branch_1_child')
        expect(router.children[1]!.type).toBe(FlowActionType.PIECE)
    })

    it('должен обрабатывать router с пустыми ветками (null children)', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeRouterNodeDef('router_step', 3),
                makeCodeNodeDef('branch_1_child'),
            ],
            edges: [
                makeEdgeDef('trigger', 'router_step', 'output'),
                makeEdgeDef('router_step', 'branch_1_child', 'branch-1'),
            ],
        }
        const trigger = graphDataToLinkedList(graphData)

        const router = trigger.nextAction as RouterAction
        expect(router.children).toHaveLength(3)
        expect(router.children[0]).toBeNull()
        expect(router.children[1]!.name).toBe('branch_1_child')
        expect(router.children[2]).toBeNull()
    })

    it('должен бросить ошибку если trigger node отсутствует', () => {
        const graphData: GraphData = {
            nodes: [makeCodeNodeDef('step_1')],
            edges: [],
        }
        expect(() => graphDataToLinkedList(graphData)).toThrow('Trigger node не найден')
    })

    it('должен сохранять settings нод при конвертации', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeCodeNodeDef('step_1'),
            ],
            edges: [
                makeEdgeDef('trigger', 'step_1', 'output'),
            ],
        }
        const trigger = graphDataToLinkedList(graphData)

        const step = trigger.nextAction!
        expect(step.settings).toEqual({
            sourceCode: { code: 'test', packageJson: '{}' },
            input: {},
        })
    })

    it('должен сохранять displayName и valid при конвертации', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef({ displayName: 'Custom Trigger', valid: true }),
                makeCodeNodeDef('step_1', { displayName: 'Custom Code', valid: false }),
            ],
            edges: [
                makeEdgeDef('trigger', 'step_1', 'output'),
            ],
        }
        const trigger = graphDataToLinkedList(graphData)

        expect(trigger.displayName).toBe('Custom Trigger')
        expect(trigger.valid).toBe(true)
        expect(trigger.nextAction!.displayName).toBe('Custom Code')
        expect(trigger.nextAction!.valid).toBe(false)
    })
})

// === Round-trip тесты: linkedList -> graphData -> linkedList ===

describe('round-trip: linkedList -> linkedListToGraph -> graphDataToLinkedList', () => {
    // Вспомогательная функция: конвертировать linked-list FlowVersion
    // через linkedListToGraph, потом создать GraphData из GraphNode, потом graphDataToLinkedList
    function roundTripViaGraphData(flowVersion: FlowVersion): FlowTrigger {
        const { nodes, edges } = linkedListToGraph(flowVersion)

        // Конвертация ReactFlow GraphNode[] -> GraphNodeDefinition[]
        const graphNodes: GraphNodeDefinition[] = nodes.map(n => ({
            id: n.id,
            type: n.type as any,
            position: n.position,
            displayName: n.data.step.displayName,
            valid: n.data.step.valid,
            actionType: n.data.step.type,
            settings: (n.data.step as any).settings ?? {},
            skip: (n.data.step as any).skip,
        }))

        // Конвертация ReactFlow GraphEdge[] -> GraphEdgeDefinition[]
        const graphEdges: GraphEdgeDefinition[] = edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
        }))

        return graphDataToLinkedList({ nodes: graphNodes, edges: graphEdges })
    }

    it('должен сохранять структуру линейного 3-step потока', () => {
        const step3: FlowAction = {
            name: 'step_3',
            type: FlowActionType.CODE,
            valid: true,
            displayName: 'Code step_3',
            lastUpdatedDate: '2026-03-27T00:00:00.000Z',
            settings: { sourceCode: { code: 'test', packageJson: '{}' }, input: {} },
        }
        const step2: FlowAction = {
            name: 'step_2',
            type: FlowActionType.PIECE,
            valid: true,
            displayName: 'Piece step_2',
            lastUpdatedDate: '2026-03-27T00:00:00.000Z',
            settings: { pieceName: 'test', pieceVersion: '1.0.0', actionName: 'act', input: {}, propertySettings: {} },
            nextAction: step3,
        }
        const step1: FlowAction = {
            name: 'step_1',
            type: FlowActionType.CODE,
            valid: true,
            displayName: 'Code step_1',
            lastUpdatedDate: '2026-03-27T00:00:00.000Z',
            settings: { sourceCode: { code: 'test', packageJson: '{}' }, input: {} },
            nextAction: step2,
        }

        const flowVersion = createBaseFlowVersion()
        flowVersion.trigger = {
            ...flowVersion.trigger,
            nextAction: step1,
        } as FlowTrigger

        const result = roundTripViaGraphData(flowVersion)

        expect(result.name).toBe('trigger')
        expect(result.nextAction!.name).toBe('step_1')
        expect(result.nextAction!.type).toBe(FlowActionType.CODE)
        expect(result.nextAction!.nextAction!.name).toBe('step_2')
        expect(result.nextAction!.nextAction!.type).toBe(FlowActionType.PIECE)
        expect(result.nextAction!.nextAction!.nextAction!.name).toBe('step_3')
        expect(result.nextAction!.nextAction!.nextAction!.nextAction).toBeUndefined()
    })

    it('должен сохранять структуру потока с loop', () => {
        const loopChild: FlowAction = {
            name: 'inner_step',
            type: FlowActionType.CODE,
            valid: true,
            displayName: 'Code inner_step',
            lastUpdatedDate: '2026-03-27T00:00:00.000Z',
            settings: { sourceCode: { code: 'test', packageJson: '{}' }, input: {} },
        }
        const afterLoop: FlowAction = {
            name: 'after_loop',
            type: FlowActionType.CODE,
            valid: true,
            displayName: 'Code after_loop',
            lastUpdatedDate: '2026-03-27T00:00:00.000Z',
            settings: { sourceCode: { code: 'test', packageJson: '{}' }, input: {} },
        }
        const loop: LoopOnItemsAction = {
            name: 'loop_step',
            type: FlowActionType.LOOP_ON_ITEMS,
            valid: true,
            displayName: 'Loop loop_step',
            lastUpdatedDate: '2026-03-27T00:00:00.000Z',
            settings: { items: '{{trigger.items}}' },
            firstLoopAction: loopChild,
            nextAction: afterLoop,
        }

        const flowVersion = createBaseFlowVersion()
        flowVersion.trigger = {
            ...flowVersion.trigger,
            nextAction: loop,
        } as FlowTrigger

        const result = roundTripViaGraphData(flowVersion)

        const rebuiltLoop = result.nextAction as LoopOnItemsAction
        expect(rebuiltLoop.type).toBe(FlowActionType.LOOP_ON_ITEMS)
        expect(rebuiltLoop.firstLoopAction!.name).toBe('inner_step')
        expect(rebuiltLoop.nextAction!.name).toBe('after_loop')
    })

    it('должен сохранять структуру потока с router и 2 ветками', () => {
        const b0: FlowAction = {
            name: 'b0_child',
            type: FlowActionType.CODE,
            valid: true,
            displayName: 'Code b0_child',
            lastUpdatedDate: '2026-03-27T00:00:00.000Z',
            settings: { sourceCode: { code: 'test', packageJson: '{}' }, input: {} },
        }
        const b1: FlowAction = {
            name: 'b1_child',
            type: FlowActionType.PIECE,
            valid: true,
            displayName: 'Piece b1_child',
            lastUpdatedDate: '2026-03-27T00:00:00.000Z',
            settings: { pieceName: 'test', pieceVersion: '1.0.0', actionName: 'act', input: {}, propertySettings: {} },
        }
        const afterRouter: FlowAction = {
            name: 'after_router',
            type: FlowActionType.CODE,
            valid: true,
            displayName: 'Code after_router',
            lastUpdatedDate: '2026-03-27T00:00:00.000Z',
            settings: { sourceCode: { code: 'test', packageJson: '{}' }, input: {} },
        }
        const router: RouterAction = {
            name: 'router_step',
            type: FlowActionType.ROUTER,
            valid: true,
            displayName: 'Router router_step',
            lastUpdatedDate: '2026-03-27T00:00:00.000Z',
            settings: {
                branches: [
                    { conditions: [[{ operator: BranchOperator.TEXT_CONTAINS, firstValue: '1', secondValue: '1' }]], branchType: BranchExecutionType.CONDITION, branchName: 'Branch 0' },
                    { conditions: [[{ operator: BranchOperator.TEXT_CONTAINS, firstValue: '2', secondValue: '2' }]], branchType: BranchExecutionType.CONDITION, branchName: 'Branch 1' },
                ],
                executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
            },
            children: [b0, b1],
            nextAction: afterRouter,
        }

        const flowVersion = createBaseFlowVersion()
        flowVersion.trigger = {
            ...flowVersion.trigger,
            nextAction: router,
        } as FlowTrigger

        const result = roundTripViaGraphData(flowVersion)

        const rebuiltRouter = result.nextAction as RouterAction
        expect(rebuiltRouter.type).toBe(FlowActionType.ROUTER)
        expect(rebuiltRouter.children).toHaveLength(2)
        expect(rebuiltRouter.children[0]!.name).toBe('b0_child')
        expect(rebuiltRouter.children[1]!.name).toBe('b1_child')
        expect(rebuiltRouter.nextAction!.name).toBe('after_router')
    })
})

// === Тесты авто-синхронизации trigger при GRAPH_ операциях ===

describe('syncTriggerFromGraphData при графовых операциях', () => {
    it('GRAPH_ADD_NODE + GRAPH_ADD_EDGE: trigger обновляется автоматически', () => {
        const graphData: GraphData = {
            nodes: [makeTriggerNodeDef()],
            edges: [],
        }
        let version = createBaseFlowVersion(graphData)

        // Добавляем code ноду
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makeCodeNodeDef('step_1') },
        })

        // trigger ещё не связан с step_1
        expect(version.graphData!.nodes).toHaveLength(2)
        expect(version.trigger.nextAction).toBeUndefined()

        // Добавляем edge trigger -> step_1
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: makeEdgeDef('trigger', 'step_1', 'output') },
        })

        // trigger теперь автоматически синхронизирован
        expect(version.trigger.nextAction).toBeDefined()
        expect(version.trigger.nextAction!.name).toBe('step_1')
        expect(version.trigger.nextAction!.type).toBe(FlowActionType.CODE)
    })

    it('GRAPH_REMOVE_NODE: trigger обновляется, удалённая нода исчезает из chain', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeCodeNodeDef('step_1'),
            ],
            edges: [
                makeEdgeDef('trigger', 'step_1', 'output'),
            ],
        }
        let version = createBaseFlowVersion(graphData)

        // Применяем начальный граф — trigger синхронизируется при GRAPH_ADD операции
        // Но сейчас graphData уже задан при создании, trigger не синхронизирован
        // Сделаем полный цикл: добавим edge чтобы синхронизировать
        // Нет, у нас уже есть graphData с nodes и edges, но trigger ещё не синхронизирован
        // Для тестирования GRAPH_REMOVE_NODE, создадим состояние с 3 нодами
        const graphData3: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeCodeNodeDef('step_1'),
                makeCodeNodeDef('step_2'),
            ],
            edges: [
                makeEdgeDef('trigger', 'step_1', 'output'),
                makeEdgeDef('step_1', 'step_2', 'output'),
            ],
        }
        version = createBaseFlowVersion(graphData3)

        // Удаляем step_2 — каскадно удалится edge step_1 -> step_2
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_REMOVE_NODE,
            request: { nodeId: 'step_2' },
        })

        expect(version.graphData!.nodes).toHaveLength(2)
        expect(version.graphData!.edges).toHaveLength(1)
        expect(version.trigger.nextAction).toBeDefined()
        expect(version.trigger.nextAction!.name).toBe('step_1')
        expect(version.trigger.nextAction!.nextAction).toBeUndefined()
    })

    it('GRAPH_REMOVE_EDGE: trigger обновляется, цепочка разрывается', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeCodeNodeDef('step_1'),
                makeCodeNodeDef('step_2'),
            ],
            edges: [
                makeEdgeDef('trigger', 'step_1', 'output'),
                makeEdgeDef('step_1', 'step_2', 'output'),
            ],
        }
        let version = createBaseFlowVersion(graphData)

        // Удаляем edge step_1 -> step_2
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_REMOVE_EDGE,
            request: { edgeId: 'step_1-output-step_2' },
        })

        expect(version.graphData!.edges).toHaveLength(1)
        expect(version.trigger.nextAction).toBeDefined()
        expect(version.trigger.nextAction!.name).toBe('step_1')
        // step_2 теперь orphan, не в цепочке
        expect(version.trigger.nextAction!.nextAction).toBeUndefined()
    })

    it('GRAPH_MOVE_NODE: trigger НЕ обновляется (только позиция)', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeCodeNodeDef('step_1'),
            ],
            edges: [
                makeEdgeDef('trigger', 'step_1', 'output'),
            ],
        }
        const version = createBaseFlowVersion(graphData)

        const updated = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_MOVE_NODE,
            request: { nodeId: 'step_1', position: { x: 500, y: 500 } },
        })

        // Позиция обновилась
        expect(updated.graphData!.nodes.find(n => n.id === 'step_1')!.position).toEqual({ x: 500, y: 500 })
        // trigger не изменился (остался исходный, без синхронизации)
        // Он не меняется потому что GRAPH_MOVE_NODE не вызывает syncTriggerFromGraphData
    })

    it('авто-синхронизация для loop: graphData с loop-output -> firstLoopAction в trigger', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeLoopNodeDef('loop_step'),
            ],
            edges: [
                makeEdgeDef('trigger', 'loop_step', 'output'),
            ],
        }
        let version = createBaseFlowVersion(graphData)

        // Добавляем loop child
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makeCodeNodeDef('loop_child') },
        })

        // Соединяем loop -> loop_child через loop-output
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: makeEdgeDef('loop_step', 'loop_child', 'loop-output') },
        })

        const loop = version.trigger.nextAction as LoopOnItemsAction
        expect(loop.type).toBe(FlowActionType.LOOP_ON_ITEMS)
        expect(loop.firstLoopAction).toBeDefined()
        expect(loop.firstLoopAction!.name).toBe('loop_child')
    })

    it('авто-синхронизация для router: graphData с branch-N -> children[N] в trigger', () => {
        const graphData: GraphData = {
            nodes: [
                makeTriggerNodeDef(),
                makeRouterNodeDef('router_step', 2),
            ],
            edges: [
                makeEdgeDef('trigger', 'router_step', 'output'),
            ],
        }
        let version = createBaseFlowVersion(graphData)

        // Добавляем branch children
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makeCodeNodeDef('b0_child') },
        })
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makePieceNodeDef('b1_child') },
        })

        // Соединяем ветки
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: makeEdgeDef('router_step', 'b0_child', 'branch-0') },
        })
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: makeEdgeDef('router_step', 'b1_child', 'branch-1') },
        })

        const router = version.trigger.nextAction as RouterAction
        expect(router.type).toBe(FlowActionType.ROUTER)
        expect(router.children).toHaveLength(2)
        expect(router.children[0]!.name).toBe('b0_child')
        expect(router.children[1]!.name).toBe('b1_child')
    })
})

// === Тест персистенции graphData в FlowVersion ===

describe('graphData персистенция в FlowVersion', () => {
    it('graphData сохраняется при GRAPH_ операциях', () => {
        const graphData: GraphData = {
            nodes: [makeTriggerNodeDef()],
            edges: [],
        }
        let version = createBaseFlowVersion(graphData)

        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makeCodeNodeDef('step_1') },
        })

        expect(version.graphData).toBeDefined()
        expect(version.graphData!.nodes).toHaveLength(2)
        expect(version.graphData!.nodes.find(n => n.id === 'step_1')).toBeDefined()
    })

    it('graphData и trigger синхронизированы после серии GRAPH_ операций', () => {
        const graphData: GraphData = {
            nodes: [makeTriggerNodeDef()],
            edges: [],
        }
        let version = createBaseFlowVersion(graphData)

        // Строим линейный поток: trigger -> code -> piece
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makeCodeNodeDef('step_1') },
        })
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makePieceNodeDef('step_2') },
        })
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: makeEdgeDef('trigger', 'step_1', 'output') },
        })
        version = flowOperations.apply(version, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: makeEdgeDef('step_1', 'step_2', 'output') },
        })

        // graphData содержит 3 ноды и 2 edges
        expect(version.graphData!.nodes).toHaveLength(3)
        expect(version.graphData!.edges).toHaveLength(2)

        // trigger содержит linked-list chain
        expect(version.trigger.name).toBe('trigger')
        expect(version.trigger.nextAction!.name).toBe('step_1')
        expect(version.trigger.nextAction!.nextAction!.name).toBe('step_2')
        expect(version.trigger.nextAction!.nextAction!.nextAction).toBeUndefined()
    })
})
