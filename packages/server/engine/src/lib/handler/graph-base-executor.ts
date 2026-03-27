import { AdjacencyMap, GraphNodeDefinition } from '@activepieces/shared'
import { EngineConstants } from './context/engine-constants'
import { FlowExecutorContext } from './context/flow-execution-context'

/**
 * Базовый интерфейс для graph executors.
 * В отличие от BaseExecutor (linked-list), работает с GraphNodeDefinition и AdjacencyMap.
 * Каждый graph executor (graph-flow, graph-loop, graph-router) реализует этот интерфейс.
 */
export type GraphBaseExecutor = {
    handle(request: {
        node: GraphNodeDefinition
        executionState: FlowExecutorContext
        constants: EngineConstants
        adjacency: AdjacencyMap
    }): Promise<FlowExecutorContext>
}
