import { LATEST_CONTEXT_VERSION } from '@activepieces/pieces-framework'
import {
    AdjacencyMap,
    FlowAction,
    FlowRunStatus,
    getNextNodeId,
    isNil,
    LoopStepOutput,
    StepOutputStatus,
} from '@activepieces/shared'
import { BaseExecutor } from './base-executor'
import { EngineConstants } from './context/engine-constants'
import { FlowExecutorContext } from './context/flow-execution-context'

/**
 * Graph Loop Executor -- исполнение LOOP_ON_ITEMS через edges графа.
 *
 * Навигация по телу цикла: ищем ребро с sourceHandle === 'loop-output'
 * из loop-ноды (вместо firstLoopAction из linked-list).
 * Под-граф тела цикла исполняется рекурсивным вызовом graphFlowExecutor.executeGraph().
 *
 * ЗАПРЕЩЕНО: nextAction, firstLoopAction, children[], graphToLinkedList.
 */

type LoopOnActionResolvedSettings = {
    items: readonly unknown[]
}

/**
 * Параметры для graph loop executor.
 * adjacencyMap передаётся из graph-flow-executor при вызове.
 */
export type GraphLoopExecutorParams = {
    action: FlowAction
    executionState: FlowExecutorContext
    constants: EngineConstants
    adjacencyMap: AdjacencyMap
}

export const graphLoopExecutor = {
    /**
     * Исполнить loop-ноду в graph executor.
     * Алгоритм:
     * 1. Resolve items из settings
     * 2. Найти первую ноду тела цикла по edge с sourceHandle 'loop-output'
     * 3. Для каждого item — вызвать graphFlowExecutor.executeGraph() для подграфа
     * 4. При FlowRunStatus !== RUNNING — прервать цикл
     */
    async handle({ action, executionState, constants, adjacencyMap }: GraphLoopExecutorParams): Promise<FlowExecutorContext> {
        const stepStartTime = performance.now()

        // Resolve items из settings (аналогично legacy loop-executor)
        const { resolvedInput, censoredInput } = await constants.getPropsResolver(LATEST_CONTEXT_VERSION).resolve<LoopOnActionResolvedSettings>({
            unresolvedInput: {
                items: action.settings.items,
            },
            executionState,
        })

        // Инициализировать или восстановить LoopStepOutput
        const previousStepOutput = executionState.getLoopStepOutput({ stepName: action.name })
        let stepOutput = previousStepOutput ?? LoopStepOutput.init({
            input: censoredInput,
        })
        let newExecutionContext = executionState.upsertStep(action.name, stepOutput)

        // Проверка: items должны быть массивом
        if (!Array.isArray(resolvedInput.items)) {
            const errorMessage = JSON.stringify({
                message: 'The items you have selected must be a list.',
            })
            const failedStepOutput = stepOutput
                .setStatus(StepOutputStatus.FAILED)
                .setErrorMessage(errorMessage)
                .setDuration(performance.now() - stepStartTime)
            return newExecutionContext.upsertStep(action.name, failedStepOutput).setVerdict({
                status: FlowRunStatus.FAILED,
                failedStep: {
                    name: action.name,
                    displayName: action.displayName,
                    message: errorMessage,
                },
            })
        }

        // Найти первую ноду тела цикла по edge 'loop-output'
        const loopBodyStartId = getNextNodeId(adjacencyMap, action.name, 'loop-output')

        for (let i = 0; i < resolvedInput.items.length; ++i) {
            const newCurrentPath = newExecutionContext.currentPath.loopIteration({ loopName: action.name, iteration: i })

            const testSingleStepMode = !isNil(constants.stepNameToTest)
            stepOutput = stepOutput.setItemAndIndex({ item: resolvedInput.items[i], index: i + 1 })
            const addEmptyIteration = !stepOutput.hasIteration(i)
            if (addEmptyIteration) {
                stepOutput = stepOutput.addIteration()
            }
            newExecutionContext = newExecutionContext.upsertStep(action.name, stepOutput).setCurrentPath(newCurrentPath)

            // Исполнить подграф тела цикла (lazy import для избежания circular dependency)
            if (!isNil(loopBodyStartId) && !testSingleStepMode) {
                const { graphFlowExecutor } = await import('./graph-flow-executor')
                newExecutionContext = await graphFlowExecutor.executeGraph({
                    startNodeId: loopBodyStartId,
                    adjacency: adjacencyMap,
                    executionState: newExecutionContext,
                    constants,
                })
            }

            newExecutionContext = newExecutionContext.setCurrentPath(newExecutionContext.currentPath.removeLast())

            if (newExecutionContext.verdict.status !== FlowRunStatus.RUNNING) {
                return newExecutionContext.upsertStep(action.name, stepOutput.setDuration(performance.now() - stepStartTime))
            }

            if (testSingleStepMode) {
                break
            }
        }

        return newExecutionContext.upsertStep(action.name, stepOutput.setDuration(performance.now() - stepStartTime))
    },
}
