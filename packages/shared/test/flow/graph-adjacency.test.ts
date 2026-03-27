import { GraphData } from '../../src/lib/automation/flows/graph-data'
import {
    buildAdjacencyMap,
    getNextNodeId,
    getNodeDefinition,
} from '../../src/lib/automation/flows/util/graph-adjacency'

// === Вспомогательные фабрики ===

function makeNode(overrides: Partial<GraphData['nodes'][number]> & { id: string }): GraphData['nodes'][number] {
    return {
        type: 'action',
        position: { x: 0, y: 0 },
        displayName: overrides.id,
        valid: true,
        actionType: 'CODE',
        settings: {},
        ...overrides,
    }
}

function makeEdge(
    source: string,
    target: string,
    sourceHandle = 'output',
    targetHandle = 'input',
): GraphData['edges'][number] {
    return {
        id: `${source}-${sourceHandle}-${target}`,
        source,
        target,
        sourceHandle,
        targetHandle,
    }
}

describe('graph-adjacency', () => {
    // === buildAdjacencyMap ===

    describe('buildAdjacencyMap', () => {
        it('строит map из пустого графа (нет нод, нет рёбер)', () => {
            const graphData: GraphData = { nodes: [], edges: [] }
            const map = buildAdjacencyMap(graphData)
            expect(map.size).toBe(0)
        })

        it('строит map из графа с одной нодой (trigger-only)', () => {
            const trigger = makeNode({ id: 'trigger', type: 'trigger', actionType: 'PIECE_TRIGGER' })
            const graphData: GraphData = { nodes: [trigger], edges: [] }
            const map = buildAdjacencyMap(graphData)

            expect(map.size).toBe(1)
            expect(map.get('trigger')).toBeDefined()
            expect(map.get('trigger')!.outEdges).toEqual([])
            expect(map.get('trigger')!.node).toEqual(trigger)
        })

        it('строит map из линейной цепочки trigger -> step_1 -> step_2', () => {
            const trigger = makeNode({ id: 'trigger', type: 'trigger', actionType: 'PIECE_TRIGGER' })
            const step1 = makeNode({ id: 'step_1' })
            const step2 = makeNode({ id: 'step_2' })
            const edge1 = makeEdge('trigger', 'step_1')
            const edge2 = makeEdge('step_1', 'step_2')
            const graphData: GraphData = {
                nodes: [trigger, step1, step2],
                edges: [edge1, edge2],
            }

            const map = buildAdjacencyMap(graphData)

            expect(map.size).toBe(3)
            expect(map.get('trigger')!.outEdges).toEqual([edge1])
            expect(map.get('step_1')!.outEdges).toEqual([edge2])
            expect(map.get('step_2')!.outEdges).toEqual([])
        })

        it('строит map для loop-ноды с loop-output ребром', () => {
            const loop = makeNode({ id: 'loop_1', type: 'loop', actionType: 'LOOP_ON_ITEMS' })
            const body = makeNode({ id: 'step_1' })
            const after = makeNode({ id: 'step_2' })
            const loopEdge = makeEdge('loop_1', 'step_1', 'loop-output')
            const outputEdge = makeEdge('loop_1', 'step_2', 'output')

            const graphData: GraphData = {
                nodes: [loop, body, after],
                edges: [loopEdge, outputEdge],
            }

            const map = buildAdjacencyMap(graphData)

            expect(map.get('loop_1')!.outEdges).toHaveLength(2)
            expect(map.get('loop_1')!.outEdges).toContainEqual(loopEdge)
            expect(map.get('loop_1')!.outEdges).toContainEqual(outputEdge)
        })

        it('строит map для router-ноды с branch-N рёбрами', () => {
            const router = makeNode({ id: 'router_1', type: 'router', actionType: 'ROUTER' })
            const b0 = makeNode({ id: 'branch_0_step' })
            const b1 = makeNode({ id: 'branch_1_step' })
            const b2 = makeNode({ id: 'branch_2_step' })
            const edge0 = makeEdge('router_1', 'branch_0_step', 'branch-0')
            const edge1 = makeEdge('router_1', 'branch_1_step', 'branch-1')
            const edge2 = makeEdge('router_1', 'branch_2_step', 'branch-2')

            const graphData: GraphData = {
                nodes: [router, b0, b1, b2],
                edges: [edge0, edge1, edge2],
            }

            const map = buildAdjacencyMap(graphData)

            expect(map.get('router_1')!.outEdges).toHaveLength(3)
            expect(map.get('router_1')!.outEdges).toContainEqual(edge0)
            expect(map.get('router_1')!.outEdges).toContainEqual(edge1)
            expect(map.get('router_1')!.outEdges).toContainEqual(edge2)
        })

        it('игнорирует рёбра с несуществующей source-нодой', () => {
            const step1 = makeNode({ id: 'step_1' })
            const orphanEdge = makeEdge('nonexistent', 'step_1')

            const graphData: GraphData = {
                nodes: [step1],
                edges: [orphanEdge],
            }

            const map = buildAdjacencyMap(graphData)

            expect(map.size).toBe(1)
            expect(map.get('step_1')!.outEdges).toEqual([])
        })

        it('корректно обрабатывает orphan-ноду (без входящих рёбер)', () => {
            const trigger = makeNode({ id: 'trigger', type: 'trigger', actionType: 'PIECE_TRIGGER' })
            const step1 = makeNode({ id: 'step_1' })
            const orphan = makeNode({ id: 'orphan_1' })
            const edge1 = makeEdge('trigger', 'step_1')

            const graphData: GraphData = {
                nodes: [trigger, step1, orphan],
                edges: [edge1],
            }

            const map = buildAdjacencyMap(graphData)

            expect(map.size).toBe(3)
            expect(map.get('orphan_1')!.outEdges).toEqual([])
            expect(map.get('orphan_1')!.node).toEqual(orphan)
        })

        it('сохраняет все поля GraphNodeDefinition в AdjacencyEntry', () => {
            const node = makeNode({
                id: 'step_full',
                type: 'action',
                position: { x: 100, y: 200 },
                displayName: 'Full Node',
                valid: true,
                skip: true,
                errorHandling: { continueOnFailure: true, retryOnFailure: false },
                actionType: 'PIECE',
                settings: { pieceName: 'http' },
                sampleData: { result: 42 },
            })

            const graphData: GraphData = { nodes: [node], edges: [] }
            const map = buildAdjacencyMap(graphData)
            const entry = map.get('step_full')!

            expect(entry.node.id).toBe('step_full')
            expect(entry.node.type).toBe('action')
            expect(entry.node.position).toEqual({ x: 100, y: 200 })
            expect(entry.node.displayName).toBe('Full Node')
            expect(entry.node.valid).toBe(true)
            expect(entry.node.skip).toBe(true)
            expect(entry.node.errorHandling).toEqual({ continueOnFailure: true, retryOnFailure: false })
            expect(entry.node.actionType).toBe('PIECE')
            expect(entry.node.settings).toEqual({ pieceName: 'http' })
            expect(entry.node.sampleData).toEqual({ result: 42 })
        })
    })

    // === getNextNodeId ===

    describe('getNextNodeId', () => {
        const trigger = makeNode({ id: 'trigger', type: 'trigger', actionType: 'PIECE_TRIGGER' })
        const step1 = makeNode({ id: 'step_1' })
        const step2 = makeNode({ id: 'step_2' })
        const loopBody = makeNode({ id: 'loop_body' })
        const branch0 = makeNode({ id: 'branch_0' })
        const branch1 = makeNode({ id: 'branch_1' })

        const graphData: GraphData = {
            nodes: [trigger, step1, step2, loopBody, branch0, branch1],
            edges: [
                makeEdge('trigger', 'step_1', 'output'),
                makeEdge('step_1', 'step_2', 'output'),
                makeEdge('step_1', 'loop_body', 'loop-output'),
                makeEdge('step_2', 'branch_0', 'branch-0'),
                makeEdge('step_2', 'branch_1', 'branch-1'),
            ],
        }

        const adjacency = buildAdjacencyMap(graphData)

        it('возвращает target по handle output', () => {
            expect(getNextNodeId(adjacency, 'trigger', 'output')).toBe('step_1')
        })

        it('возвращает target по handle output для промежуточной ноды', () => {
            expect(getNextNodeId(adjacency, 'step_1', 'output')).toBe('step_2')
        })

        it('возвращает target по handle loop-output', () => {
            expect(getNextNodeId(adjacency, 'step_1', 'loop-output')).toBe('loop_body')
        })

        it('возвращает target по handle branch-0', () => {
            expect(getNextNodeId(adjacency, 'step_2', 'branch-0')).toBe('branch_0')
        })

        it('возвращает target по handle branch-1', () => {
            expect(getNextNodeId(adjacency, 'step_2', 'branch-1')).toBe('branch_1')
        })

        it('возвращает null для несуществующего handle', () => {
            expect(getNextNodeId(adjacency, 'trigger', 'loop-output')).toBeNull()
        })

        it('возвращает null для несуществующей ноды', () => {
            expect(getNextNodeId(adjacency, 'nonexistent', 'output')).toBeNull()
        })

        it('возвращает null для ноды без исходящих рёбер', () => {
            expect(getNextNodeId(adjacency, 'loop_body', 'output')).toBeNull()
        })

        it('возвращает null для branch-2 если есть только branch-0 и branch-1', () => {
            expect(getNextNodeId(adjacency, 'step_2', 'branch-2')).toBeNull()
        })
    })

    // === getNodeDefinition ===

    describe('getNodeDefinition', () => {
        const trigger = makeNode({ id: 'trigger', type: 'trigger', actionType: 'PIECE_TRIGGER', displayName: 'Manual Trigger' })
        const step1 = makeNode({ id: 'step_1', displayName: 'Code Node' })

        const graphData: GraphData = {
            nodes: [trigger, step1],
            edges: [makeEdge('trigger', 'step_1')],
        }

        const adjacency = buildAdjacencyMap(graphData)

        it('возвращает определение trigger-ноды по id', () => {
            const def = getNodeDefinition(adjacency, 'trigger')
            expect(def).toBeDefined()
            expect(def!.id).toBe('trigger')
            expect(def!.type).toBe('trigger')
            expect(def!.displayName).toBe('Manual Trigger')
        })

        it('возвращает определение action-ноды по id', () => {
            const def = getNodeDefinition(adjacency, 'step_1')
            expect(def).toBeDefined()
            expect(def!.id).toBe('step_1')
            expect(def!.displayName).toBe('Code Node')
        })

        it('возвращает undefined для несуществующего id', () => {
            expect(getNodeDefinition(adjacency, 'nonexistent')).toBeUndefined()
        })

        it('возвращает undefined для пустого графа', () => {
            const emptyMap = buildAdjacencyMap({ nodes: [], edges: [] })
            expect(getNodeDefinition(emptyMap, 'trigger')).toBeUndefined()
        })
    })

    // === Комплексные сценарии ===

    describe('комплексные сценарии', () => {
        it('S3-подобный граф: trigger -> http -> loop (loop-output -> code -> store) -> file', () => {
            const nodes = [
                makeNode({ id: 'trigger', type: 'trigger', actionType: 'SCHEDULE' }),
                makeNode({ id: 'http_get', actionType: 'PIECE' }),
                makeNode({ id: 'loop_1', type: 'loop', actionType: 'LOOP_ON_ITEMS' }),
                makeNode({ id: 'code_1', actionType: 'CODE' }),
                makeNode({ id: 'store_1', actionType: 'PIECE' }),
                makeNode({ id: 'file_helper', actionType: 'PIECE' }),
            ]
            const edges = [
                makeEdge('trigger', 'http_get', 'output'),
                makeEdge('http_get', 'loop_1', 'output'),
                makeEdge('loop_1', 'code_1', 'loop-output'),
                makeEdge('code_1', 'store_1', 'output'),
                makeEdge('loop_1', 'file_helper', 'output'),
            ]
            const graphData: GraphData = { nodes, edges }
            const adjacency = buildAdjacencyMap(graphData)

            // Навигация по основной цепочке
            expect(getNextNodeId(adjacency, 'trigger', 'output')).toBe('http_get')
            expect(getNextNodeId(adjacency, 'http_get', 'output')).toBe('loop_1')

            // Loop: loop-output ведёт в тело, output -- дальше после loop
            expect(getNextNodeId(adjacency, 'loop_1', 'loop-output')).toBe('code_1')
            expect(getNextNodeId(adjacency, 'loop_1', 'output')).toBe('file_helper')

            // Внутри loop body
            expect(getNextNodeId(adjacency, 'code_1', 'output')).toBe('store_1')
            expect(getNextNodeId(adjacency, 'store_1', 'output')).toBeNull()

            // После loop
            expect(getNextNodeId(adjacency, 'file_helper', 'output')).toBeNull()
        })

        it('S4-подобный граф: trigger -> router (3 ветки) -> file_helper', () => {
            const nodes = [
                makeNode({ id: 'trigger', type: 'trigger', actionType: 'EMPTY_TRIGGER' }),
                makeNode({ id: 'router_1', type: 'router', actionType: 'ROUTER' }),
                makeNode({ id: 'http_users', actionType: 'PIECE' }),
                makeNode({ id: 'http_orders', actionType: 'PIECE' }),
                makeNode({ id: 'http_products', actionType: 'PIECE' }),
                makeNode({ id: 'file_helper', actionType: 'PIECE' }),
            ]
            const edges = [
                makeEdge('trigger', 'router_1', 'output'),
                makeEdge('router_1', 'http_users', 'branch-0'),
                makeEdge('router_1', 'http_orders', 'branch-1'),
                makeEdge('router_1', 'http_products', 'branch-2'),
                makeEdge('router_1', 'file_helper', 'output'),
            ]
            const graphData: GraphData = { nodes, edges }
            const adjacency = buildAdjacencyMap(graphData)

            // Навигация
            expect(getNextNodeId(adjacency, 'trigger', 'output')).toBe('router_1')
            expect(getNextNodeId(adjacency, 'router_1', 'branch-0')).toBe('http_users')
            expect(getNextNodeId(adjacency, 'router_1', 'branch-1')).toBe('http_orders')
            expect(getNextNodeId(adjacency, 'router_1', 'branch-2')).toBe('http_products')
            expect(getNextNodeId(adjacency, 'router_1', 'output')).toBe('file_helper')

            // Определения нод
            expect(getNodeDefinition(adjacency, 'router_1')!.type).toBe('router')
            expect(getNodeDefinition(adjacency, 'http_users')!.actionType).toBe('PIECE')
        })

        it('граф с orphan-нодами не влияет на навигацию', () => {
            const nodes = [
                makeNode({ id: 'trigger', type: 'trigger', actionType: 'PIECE_TRIGGER' }),
                makeNode({ id: 'step_1' }),
                makeNode({ id: 'orphan_a' }),
                makeNode({ id: 'orphan_b' }),
            ]
            const edges = [
                makeEdge('trigger', 'step_1', 'output'),
            ]
            const graphData: GraphData = { nodes, edges }
            const adjacency = buildAdjacencyMap(graphData)

            // Основная навигация работает
            expect(getNextNodeId(adjacency, 'trigger', 'output')).toBe('step_1')
            expect(getNextNodeId(adjacency, 'step_1', 'output')).toBeNull()

            // Orphan-ноды существуют в map но не имеют рёбер
            expect(getNodeDefinition(adjacency, 'orphan_a')).toBeDefined()
            expect(getNodeDefinition(adjacency, 'orphan_b')).toBeDefined()
            expect(getNextNodeId(adjacency, 'orphan_a', 'output')).toBeNull()
            expect(getNextNodeId(adjacency, 'orphan_b', 'output')).toBeNull()
        })
    })
})
