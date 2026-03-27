import {
    FlowVersion,
    GraphData,
    GraphEdgeDefinition,
    GraphNodeDefinition,
    linkedListToGraph,
} from '@activepieces/shared'
import { Migration } from '.'

/**
 * Миграция v19 -> v20: генерация graphData из linked-list через linkedListToGraph().
 *
 * Конвертирует существующую linked-list модель (trigger.nextAction chain)
 * в графовое представление (GraphData: nodes[] + edges[]).
 * Linked-list поля (trigger, nextAction, firstLoopAction, children[]) сохраняются
 * для обратной совместимости.
 */
export const migrateV19AddGraphData: Migration = {
    targetSchemaVersion: '19',
    migrate: async (flowVersion: FlowVersion): Promise<FlowVersion> => {
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

        const graphData: GraphData = {
            nodes: graphNodes,
            edges: graphEdges,
        }

        return {
            ...flowVersion,
            graphData,
            schemaVersion: '20',
        }
    },
}

/**
 * Извлекает настройки обработки ошибок из ActionErrorHandlingOptions.
 * Формат в linked-list: { continueOnFailure: { value: boolean }, retryOnFailure: { value: boolean } }
 * Формат в GraphNodeDefinition: { continueOnFailure?: boolean, retryOnFailure?: boolean }
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
