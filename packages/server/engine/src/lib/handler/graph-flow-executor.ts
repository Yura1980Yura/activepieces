import { performance } from 'node:perf_hooks'
import {
    AdjacencyMap,
    buildAdjacencyMap,
    EngineGenericError,
    ExecuteFlowOperation,
    ExecutionType,
    FlowAction,
    FlowActionType,
    FlowRunStatus,
    GenericStepOutput,
    getNextNodeId,
    getNodeDefinition,
    GraphData,
    GraphNodeDefinition,
    isNil,
    StepOutputStatus,
} from '@activepieces/shared'
import dayjs from 'dayjs'
import { loggingUtils } from '../helper/logging-utils'
import { triggerHelper } from '../helper/trigger-helper'
import { progressService } from '../services/progress.service'
import { BaseExecutor } from './base-executor'
import { codeExecutor } from './code-executor'
import { EngineConstants } from './context/engine-constants'
import { FlowExecutorContext } from './context/flow-execution-context'
import { graphLoopExecutor } from './graph-loop-executor'
import { pieceExecutor } from './piece-executor'

/**
 * Graph Flow Executor — обход графа по edges из graphData.
 * Навигация ТОЛЬКО через AdjacencyMap (buildAdjacencyMap, getNextNodeId).
 * ЗАПРЕЩЕНО: nextAction, firstLoopAction, children[], graphToLinkedList.
 */

/**
 * Получить executor для данного типа действия.
 * LOOP_ON_ITEMS обрабатывается отдельно в executeGraph (нужен adjacencyMap).
 * ROUTER — throw NotImplementedYet (будет в P2-A06).
 */
function getGraphExecutorForAction(actionType: string): BaseExecutor<FlowAction> {
    switch (actionType) {
        case FlowActionType.CODE:
            return codeExecutor
        case FlowActionType.PIECE:
            return pieceExecutor
        case FlowActionType.LOOP_ON_ITEMS:
            // Обрабатывается в executeGraph через graphLoopExecutor.handle()
            // Этот путь не должен вызываться, но на случай ошибки — throw
            throw new EngineGenericError(
                'GraphLoopDirectCallError',
                'LOOP_ON_ITEMS must be handled via graphLoopExecutor with adjacencyMap, not via getGraphExecutorForAction',
            )
        case FlowActionType.ROUTER:
            throw new EngineGenericError(
                'GraphRouterNotImplementedError',
                'Router executor not implemented in graph executor yet (planned for P2-A06)',
            )
        default:
            throw new EngineGenericError(
                'GraphUnknownActionTypeError',
                `Unknown action type in graph executor: ${actionType}`,
            )
    }
}

/**
 * Конвертировать GraphNodeDefinition в FlowAction-совместимый объект.
 * Существующие executors (code-executor, piece-executor) ожидают FlowAction.
 * Мы создаём минимальный FlowAction без nextAction (навигация через edges).
 */
function nodeToFlowAction(node: GraphNodeDefinition): FlowAction {
    return {
        name: node.id,
        displayName: node.displayName,
        type: node.actionType as FlowActionType,
        settings: node.settings as FlowAction['settings'],
        valid: node.valid,
        skip: node.skip,
    } as FlowAction
}

/**
 * Применить ограничение размера логов (аналог applyLogSizeLimitIfExceeded из flow-executor.ts).
 */
function applyLogSizeLimitIfExceeded(
    flowExecutionContext: FlowExecutorContext,
    node: GraphNodeDefinition,
): FlowExecutorContext {
    if (loggingUtils.isWithinSizeLimit(flowExecutionContext.steps)) {
        return flowExecutionContext
    }
    return flowExecutionContext
        .upsertStep(node.id, GenericStepOutput.create({
            input: flowExecutionContext.getStepOutput(node.id)?.input,
            type: node.actionType as FlowActionType,
            status: StepOutputStatus.FAILED,
            output: undefined,
        })
            .setErrorMessage(`Flow run data size exceeded the maximum allowed size of ${loggingUtils.maxLogSizeMb} MB`))
        .setVerdict({
            status: FlowRunStatus.LOG_SIZE_EXCEEDED,
            failedStep: {
                name: node.id,
                displayName: node.displayName,
                message: 'Flow run logs size exceeded',
            },
        })
}

export const graphFlowExecutor = {
    /**
     * Точка входа: исполнение графового потока из trigger.
     * Аналог flowExecutor.executeFromTrigger, но навигация по edges.
     */
    async executeFromTrigger({ executionState, constants, input }: {
        executionState: FlowExecutorContext
        constants: EngineConstants
        input: ExecuteFlowOperation
    }): Promise<FlowExecutorContext> {
        const graphData = input.flowVersion.graphData
        if (isNil(graphData)) {
            throw new EngineGenericError(
                'GraphDataMissingError',
                'graphData is required for graph flow executor',
            )
        }

        const adjacency = buildAdjacencyMap(graphData)
        const trigger = input.flowVersion.trigger

        // Исполнить trigger onStart (аналог legacy flow)
        if (input.executionType === ExecutionType.BEGIN) {
            await triggerHelper.executeOnStart(trigger, constants, input.triggerPayload)
            await progressService.sendUpdate({
                engineConstants: constants,
                flowExecutorContext: executionState,
                stepNameToUpdate: trigger.name,
                startTime: dayjs().toISOString(),
            })

            // Проверить лимит размера логов для trigger
            const triggerNode = graphData.nodes.find(n => n.type === 'trigger')
            if (triggerNode) {
                executionState = applyLogSizeLimitIfExceeded(executionState, triggerNode)
            }

            if (executionState.verdict.status !== FlowRunStatus.RUNNING) {
                return executionState
            }
        }

        // Найти trigger ноду в графе и получить следующий узел по edge 'output'
        const triggerNodeId = findTriggerNodeId(graphData)
        const firstActionId = getNextNodeId(adjacency, triggerNodeId, 'output')

        return graphFlowExecutor.executeGraph({
            startNodeId: firstActionId,
            adjacency,
            executionState,
            constants,
        })
    },

    /**
     * Обход графа: начиная с startNodeId, следовать по edges 'output'.
     */
    async executeGraph({ startNodeId, adjacency, executionState, constants }: {
        startNodeId: string | null
        adjacency: AdjacencyMap
        executionState: FlowExecutorContext
        constants: EngineConstants
    }): Promise<FlowExecutorContext> {
        const flowStartTime = performance.now()
        let flowExecutionContext = executionState
        let currentNodeId = startNodeId
        let previousNodeId: string | null = null
        const testSingleStepMode = !isNil(constants.stepNameToTest)

        while (!isNil(currentNodeId)) {
            const node = getNodeDefinition(adjacency, currentNodeId)
            if (isNil(node)) {
                throw new EngineGenericError(
                    'GraphNodeNotFoundError',
                    `Node not found in adjacency map: ${currentNodeId}`,
                )
            }

            // Пропуск ноды (skip)
            if (node.skip && !testSingleStepMode) {
                previousNodeId = currentNodeId
                currentNodeId = getNextNodeId(adjacency, currentNodeId, 'output')
                continue
            }

            // Отправить progress update для предыдущей ноды
            if (!isNil(previousNodeId)) {
                const prevNode = getNodeDefinition(adjacency, previousNodeId)
                if (prevNode) {
                    await progressService.sendUpdate({
                        engineConstants: constants,
                        flowExecutorContext: flowExecutionContext,
                        stepNameToUpdate: prevNode.id,
                    }).catch(error => {
                        console.error('Error sending update:', error)
                    })
                }
            }

            // Получить executor и исполнить ноду
            const action = nodeToFlowAction(node)

            if (node.actionType === FlowActionType.LOOP_ON_ITEMS) {
                // LOOP_ON_ITEMS требует adjacencyMap для навигации по телу цикла
                flowExecutionContext = await graphLoopExecutor.handle({
                    action,
                    executionState: flowExecutionContext,
                    constants,
                    adjacencyMap: adjacency,
                })
            }
            else {
                const handler = getGraphExecutorForAction(node.actionType)
                flowExecutionContext = await handler.handle({
                    action,
                    executionState: flowExecutionContext,
                    constants,
                })
            }

            // Проверить лимит размера логов
            flowExecutionContext = applyLogSizeLimitIfExceeded(flowExecutionContext, node)

            const shouldBreakExecution = flowExecutionContext.verdict.status !== FlowRunStatus.RUNNING || testSingleStepMode
            previousNodeId = currentNodeId
            currentNodeId = getNextNodeId(adjacency, currentNodeId, 'output')

            if (shouldBreakExecution) {
                break
            }
        }

        // Финальный progress update
        if (!isNil(previousNodeId)) {
            const prevNode = getNodeDefinition(adjacency, previousNodeId)
            if (prevNode) {
                await progressService.sendUpdate({
                    engineConstants: constants,
                    flowExecutorContext: flowExecutionContext,
                    stepNameToUpdate: prevNode.id,
                }).catch(error => {
                    console.error('Error sending update:', error)
                })
            }
        }

        const flowEndTime = performance.now()
        return flowExecutionContext.setDuration(flowEndTime - flowStartTime)
    },
}

/**
 * Найти ID trigger-ноды в graphData.
 */
function findTriggerNodeId(graphData: GraphData): string {
    const triggerNode = graphData.nodes.find(n => n.type === 'trigger')
    if (isNil(triggerNode)) {
        throw new EngineGenericError(
            'GraphTriggerNotFoundError',
            'No trigger node found in graphData',
        )
    }
    return triggerNode.id
}
