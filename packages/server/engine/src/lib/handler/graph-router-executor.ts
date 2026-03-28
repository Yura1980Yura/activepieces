import { LATEST_CONTEXT_VERSION } from '@activepieces/pieces-framework'
import {
    AdjacencyMap,
    BranchExecutionType,
    FlowAction,
    FlowRunStatus,
    getNextNodeId,
    isNil,
    RouterActionSettings,
    RouterExecutionType,
    RouterStepOutput,
    StepOutputStatus,
} from '@activepieces/shared'
import { utils } from '../utils'
import { EngineConstants } from './context/engine-constants'
import { FlowExecutorContext } from './context/flow-execution-context'
import { evaluateConditions } from './router-executor'

/**
 * Graph Router Executor -- исполнение ROUTER через edges графа.
 *
 * Навигация по веткам: ищем ребро с sourceHandle === 'branch-{index}'
 * из router-ноды (вместо children[] из linked-list).
 * Под-граф каждой ветки исполняется рекурсивным вызовом graphFlowExecutor.executeGraph().
 *
 * Поддерживает два режима:
 * - EXECUTE_FIRST_MATCH: выполнить первую ветку с evaluation=true и остановиться
 * - EXECUTE_ALL_MATCH: выполнить все ветки с evaluation=true
 *
 * ЗАПРЕЩЕНО: nextAction, firstLoopAction, children[], graphToLinkedList.
 */

/**
 * Параметры для graph router executor.
 * adjacencyMap передаётся из graph-flow-executor при вызове.
 */
export type GraphRouterExecutorParams = {
    action: FlowAction
    executionState: FlowExecutorContext
    constants: EngineConstants
    adjacencyMap: AdjacencyMap
}

export const graphRouterExecutor = {
    /**
     * Исполнить router-ноду в graph executor.
     * Алгоритм:
     * 1. Resolve branches и executionType из settings
     * 2. Evaluate conditions для каждой ветки (с поддержкой FALLBACK)
     * 3. Для каждой ветки с evaluation=true:
     *    a. Найти ребро с sourceHandle === 'branch-{index}' из router-ноды
     *    b. Исполнить под-граф начиная с целевой ноды
     *    c. Если EXECUTE_FIRST_MATCH и ветка выполнена — прервать
     */
    async handle({ action, executionState, constants, adjacencyMap }: GraphRouterExecutorParams): Promise<FlowExecutorContext> {
        const stepStartTime = performance.now()

        // Resolve settings из router (аналогично legacy router-executor)
        const { resolvedInput, censoredInput } = await constants.getPropsResolver(LATEST_CONTEXT_VERSION).resolve<RouterActionSettings>({
            unresolvedInput: {
                ...action.settings,
            },
            executionState,
        })

        // Evaluate conditions для каждой ветки
        const evaluatedConditionsWithoutFallback = resolvedInput.branches.map((branch) => {
            return branch.branchType === BranchExecutionType.FALLBACK ? true : evaluateConditions(branch.conditions)
        })

        const evaluatedConditions = resolvedInput.branches.map((branch, index) => {
            if (branch.branchType === BranchExecutionType.CONDITION) {
                return evaluatedConditionsWithoutFallback[index]
            }
            // FALLBACK: true только если все остальные ветки false
            const fallback = evaluatedConditionsWithoutFallback
                .filter((_, i) => i !== index)
                .every((condition) => !condition)
            return fallback
        })

        const stepEndTime = performance.now()

        // Создать RouterStepOutput с результатами evaluation
        const routerOutput = RouterStepOutput.init({
            input: censoredInput,
        }).setOutput({
            branches: resolvedInput.branches.map((branch, index) => ({
                branchName: branch.branchName,
                branchIndex: index + 1,
                evaluation: evaluatedConditions[index],
            })),
        }).setDuration(stepEndTime - stepStartTime)

        let newExecutionContext = executionState.upsertStep(action.name, routerOutput)

        // Исполнить ветки
        const { data: executionStateResult, error: executionStateError } = await utils.tryCatchAndThrowOnEngineError(async () => {
            const testSingleStepMode = !isNil(constants.stepNameToTest)

            for (let i = 0; i < resolvedInput.branches.length; i++) {
                if (testSingleStepMode) {
                    break
                }

                const condition = evaluatedConditions[i]
                if (!condition) {
                    continue
                }

                // Найти целевую ноду ветки по edge 'branch-{index}'
                const branchStartId = getNextNodeId(adjacencyMap, action.name, `branch-${i}`)

                if (!isNil(branchStartId)) {
                    // Lazy import для избежания circular dependency (аналогично graph-loop-executor)
                    const { graphFlowExecutor } = await import('./graph-flow-executor')
                    newExecutionContext = await graphFlowExecutor.executeGraph({
                        startNodeId: branchStartId,
                        adjacency: adjacencyMap,
                        executionState: newExecutionContext,
                        constants,
                    })
                }

                const shouldBreakExecution = newExecutionContext.verdict.status !== FlowRunStatus.RUNNING
                    || resolvedInput.executionType === RouterExecutionType.EXECUTE_FIRST_MATCH
                if (shouldBreakExecution) {
                    break
                }
            }
            return newExecutionContext
        })

        if (executionStateError) {
            const failedStepOutput = routerOutput.setStatus(StepOutputStatus.FAILED)
            return newExecutionContext.upsertStep(action.name, failedStepOutput).setVerdict({
                status: FlowRunStatus.FAILED,
                failedStep: {
                    name: action.name,
                    displayName: action.displayName,
                    message: utils.formatError(executionStateError),
                },
            })
        }

        return executionStateResult
    },
}
