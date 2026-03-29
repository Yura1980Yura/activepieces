import { z } from 'zod'
import { GraphEdgeDefinition, GraphNodeDefinition, GraphNodePosition } from '../graph-data'
import { FlowVersion } from '../flow-version'

// === Zod-схемы запросов ===

/**
 * Запрос на добавление ноды в graphData.nodes[].
 */
export const GraphAddNodeRequest = z.object({
    node: GraphNodeDefinition,
})
export type GraphAddNodeRequest = z.infer<typeof GraphAddNodeRequest>

/**
 * Запрос на удаление ноды из graphData (нода + все связанные рёбра).
 */
export const GraphRemoveNodeRequest = z.object({
    nodeId: z.string(),
})
export type GraphRemoveNodeRequest = z.infer<typeof GraphRemoveNodeRequest>

/**
 * Запрос на добавление ребра в graphData.edges[].
 */
export const GraphAddEdgeRequest = z.object({
    edge: GraphEdgeDefinition,
})
export type GraphAddEdgeRequest = z.infer<typeof GraphAddEdgeRequest>

/**
 * Запрос на удаление ребра из graphData.edges[] по id.
 */
export const GraphRemoveEdgeRequest = z.object({
    edgeId: z.string(),
})
export type GraphRemoveEdgeRequest = z.infer<typeof GraphRemoveEdgeRequest>

/**
 * Запрос на обновление позиции ноды в graphData.nodes[].
 */
export const GraphMoveNodeRequest = z.object({
    nodeId: z.string(),
    position: GraphNodePosition,
})
export type GraphMoveNodeRequest = z.infer<typeof GraphMoveNodeRequest>

// === Реализации операций ===

/**
 * Добавляет ноду в graphData.nodes[].
 * Если graphData не существует — создаёт пустой GraphData.
 * Если нода с таким id уже есть — бросает ошибку.
 */
export const _graphAddNode = (flowVersion: FlowVersion, request: GraphAddNodeRequest): FlowVersion => {
    const cloned: FlowVersion = JSON.parse(JSON.stringify(flowVersion))
    if (!cloned.graphData) {
        cloned.graphData = { nodes: [], edges: [] }
    }
    const existing = cloned.graphData.nodes.find((n) => n.id === request.node.id)
    if (existing) {
        throw new Error(`[GRAPH_ADD_NODE] Нода с id="${request.node.id}" уже существует`)
    }
    cloned.graphData.nodes.push(JSON.parse(JSON.stringify(request.node)))
    return cloned
}

/**
 * Удаляет ноду из graphData.nodes[] + все рёбра, где source===nodeId или target===nodeId.
 * Если graphData не существует или нода не найдена — бросает ошибку.
 */
export const _graphRemoveNode = (flowVersion: FlowVersion, request: GraphRemoveNodeRequest): FlowVersion => {
    const cloned: FlowVersion = JSON.parse(JSON.stringify(flowVersion))
    if (!cloned.graphData) {
        throw new Error(`[GRAPH_REMOVE_NODE] graphData отсутствует`)
    }
    const nodeIndex = cloned.graphData.nodes.findIndex((n) => n.id === request.nodeId)
    if (nodeIndex === -1) {
        // Нода уже удалена (например, syncGraphDataFromTrigger orphan removal) — идемпотентно
        return cloned
    }
    cloned.graphData.nodes.splice(nodeIndex, 1)
    cloned.graphData.edges = cloned.graphData.edges.filter(
        (e) => e.source !== request.nodeId && e.target !== request.nodeId,
    )
    return cloned
}

/**
 * Добавляет ребро в graphData.edges[].
 * Если graphData не существует — создаёт пустой GraphData.
 * Если ребро с таким id уже есть — бросает ошибку.
 */
export const _graphAddEdge = (flowVersion: FlowVersion, request: GraphAddEdgeRequest): FlowVersion => {
    const cloned: FlowVersion = JSON.parse(JSON.stringify(flowVersion))
    if (!cloned.graphData) {
        cloned.graphData = { nodes: [], edges: [] }
    }
    const existing = cloned.graphData.edges.find((e) => e.id === request.edge.id)
    if (existing) {
        throw new Error(`[GRAPH_ADD_EDGE] Ребро с id="${request.edge.id}" уже существует`)
    }
    cloned.graphData.edges.push(JSON.parse(JSON.stringify(request.edge)))
    return cloned
}

/**
 * Удаляет ребро из graphData.edges[] по id.
 * Если graphData не существует или ребро не найдено — бросает ошибку.
 */
export const _graphRemoveEdge = (flowVersion: FlowVersion, request: GraphRemoveEdgeRequest): FlowVersion => {
    const cloned: FlowVersion = JSON.parse(JSON.stringify(flowVersion))
    if (!cloned.graphData) {
        throw new Error(`[GRAPH_REMOVE_EDGE] graphData отсутствует`)
    }
    const edgeIndex = cloned.graphData.edges.findIndex((e) => e.id === request.edgeId)
    if (edgeIndex === -1) {
        throw new Error(`[GRAPH_REMOVE_EDGE] Ребро с id="${request.edgeId}" не найдено`)
    }
    cloned.graphData.edges.splice(edgeIndex, 1)
    return cloned
}

/**
 * Обновляет позицию ноды в graphData.nodes[] по nodeId.
 * Если graphData не существует или нода не найдена — бросает ошибку.
 */
export const _graphMoveNode = (flowVersion: FlowVersion, request: GraphMoveNodeRequest): FlowVersion => {
    const cloned: FlowVersion = JSON.parse(JSON.stringify(flowVersion))

    // Обновляем позицию в graphData если нода там есть
    if (cloned.graphData) {
        const node = cloned.graphData.nodes.find((n) => n.id === request.nodeId)
        if (node) {
            node.position.x = request.position.x
            node.position.y = request.position.y
        }
    }

    // Всегда обновляем canvasLayout — основной источник позиций для trigger
    // и нод из linked-list, которых может не быть в graphData
    if (!cloned.canvasLayout) {
        cloned.canvasLayout = { positions: {} }
    }
    if (!cloned.canvasLayout.positions) {
        cloned.canvasLayout.positions = {}
    }
    cloned.canvasLayout.positions[request.nodeId] = {
        x: request.position.x,
        y: request.position.y,
    }

    return cloned
}

export const graphOperations = {
    addNode: _graphAddNode,
    removeNode: _graphRemoveNode,
    addEdge: _graphAddEdge,
    removeEdge: _graphRemoveEdge,
    moveNode: _graphMoveNode,
}
