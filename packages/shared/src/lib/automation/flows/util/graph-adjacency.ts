import { GraphData, GraphEdgeDefinition, GraphNodeDefinition } from '../graph-data'

/**
 * Запись adjacency map для одной ноды:
 * outEdges -- исходящие рёбра (из этой ноды),
 * node -- определение ноды.
 */
export type AdjacencyEntry = {
    outEdges: GraphEdgeDefinition[]
    node: GraphNodeDefinition
}

/**
 * AdjacencyMap: Map<nodeId, AdjacencyEntry>.
 * Позволяет за O(1) получить определение ноды и её исходящие рёбра.
 */
export type AdjacencyMap = Map<string, AdjacencyEntry>

/**
 * Построить AdjacencyMap из GraphData.
 * Сложность: O(N + E), где N -- количество нод, E -- количество рёбер.
 *
 * @param graphData -- графовые данные потока (nodes[] + edges[])
 * @returns AdjacencyMap
 */
export function buildAdjacencyMap(graphData: GraphData): AdjacencyMap {
    const map: AdjacencyMap = new Map()

    // Инициализация: добавить все ноды с пустым списком рёбер
    for (const node of graphData.nodes) {
        map.set(node.id, {
            outEdges: [],
            node,
        })
    }

    // Заполнение: добавить рёбра к исходным нодам
    for (const edge of graphData.edges) {
        const entry = map.get(edge.source)
        if (entry) {
            entry.outEdges.push(edge)
        }
    }

    return map
}

/**
 * Получить ID следующей ноды по исходящему ребру с указанным handle.
 * Используется движком для навигации по графу:
 * - handle 'output' -- основной выход (следующий шаг)
 * - handle 'loop-output' -- вход в тело цикла
 * - handle 'branch-N' -- вход в N-ю ветку роутера
 *
 * @param adjacency -- AdjacencyMap, построенный из GraphData
 * @param nodeId -- ID текущей ноды
 * @param handle -- sourceHandle для поиска (e.g. 'output', 'loop-output', 'branch-0')
 * @returns ID целевой ноды или null если ребро не найдено
 */
export function getNextNodeId(
    adjacency: AdjacencyMap,
    nodeId: string,
    handle: string,
): string | null {
    const edges = adjacency.get(nodeId)?.outEdges ?? []
    const edge = edges.find((e) => e.sourceHandle === handle)
    return edge?.target ?? null
}

/**
 * Получить определение ноды по ID из AdjacencyMap.
 *
 * @param adjacency -- AdjacencyMap, построенный из GraphData
 * @param nodeId -- ID ноды
 * @returns GraphNodeDefinition или undefined если нода не найдена
 */
export function getNodeDefinition(
    adjacency: AdjacencyMap,
    nodeId: string,
): GraphNodeDefinition | undefined {
    return adjacency.get(nodeId)?.node
}
