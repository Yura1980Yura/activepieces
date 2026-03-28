import { isNil } from '../../../core/common'
import { FlowAction, FlowActionType } from '../actions/action'
import { FlowVersion } from '../flow-version'
import { GraphData } from '../graph-data'
import { FlowTrigger, FlowTriggerType } from '../triggers/trigger'
import { flowStructureUtil } from '../util/flow-structure-util'
import { AddNoteRequest, DeleteNoteRequest, FlowOperationRequest, FlowOperationType, ImportFlowRequest, StepLocationRelativeToParent } from './index'
import { GraphAddNodeRequest, GraphAddEdgeRequest } from './graph-operations'

function createDeleteActionOperation(actionName: string): FlowOperationRequest {
    return {
        type: FlowOperationType.DELETE_ACTION,
        request: { names: [actionName] },
    }
}

function createUpdateTriggerOperation(trigger: FlowTrigger): FlowOperationRequest {
    return {
        type: FlowOperationType.UPDATE_TRIGGER,
        request: trigger,
    }
}

function createChangeNameOperation(displayName: string): FlowOperationRequest {
    return {
        type: FlowOperationType.CHANGE_NAME,
        request: { displayName },
    }
}

function _getImportOperationsForSteps(step: FlowAction | FlowTrigger | undefined): FlowOperationRequest[] {
    const steps: FlowOperationRequest[] = []
    while (step) {
        if (step.nextAction) {
            steps.push({
                type: FlowOperationType.ADD_ACTION,
                request: {
                    parentStep: step?.name ?? '',
                    stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER,
                    action: removeAnySubsequentAction(step.nextAction),
                },
            })
        }
        switch (step.type) {
            case FlowActionType.LOOP_ON_ITEMS: {
                if (step.firstLoopAction) {
                    steps.push({
                        type: FlowOperationType.ADD_ACTION,
                        request: {
                            parentStep: step.name,
                            stepLocationRelativeToParent: StepLocationRelativeToParent.INSIDE_LOOP,
                            action: removeAnySubsequentAction(step.firstLoopAction),
                        },
                    })
                    steps.push(..._getImportOperationsForSteps(step.firstLoopAction))
                }
                break
            }
            case FlowActionType.ROUTER: {
                if (step.children) {
                    for (const [index, child] of step.children.entries()) {
                        if (!isNil(child)) {
                            steps.push({
                                type: FlowOperationType.ADD_ACTION,
                                request: {
                                    parentStep: step.name,
                                    stepLocationRelativeToParent: StepLocationRelativeToParent.INSIDE_BRANCH,
                                    branchIndex: index,
                                    action: removeAnySubsequentAction(child),
                                },
                            })
                            steps.push(..._getImportOperationsForSteps(child))
                        }
                    }
                }
                break
            }
            case FlowActionType.CODE:
            case FlowActionType.PIECE:
            case FlowTriggerType.PIECE:
            case FlowTriggerType.EMPTY: {
                break
            }
        }

        step = step.nextAction
    }
    return steps
}

function _getImportOperationsForNotes(flowVersion: FlowVersion, request: ImportFlowRequest): FlowOperationRequest[] { 

    const deleteOperations: DeleteNoteRequest[] = flowVersion.notes.map(note => ({
        id: note.id,
    }))
    const addOperations: AddNoteRequest[] = (request.notes || []).map(note => (note))

    const operations: FlowOperationRequest[] = [
        ...deleteOperations.map(operation => ({
            type: FlowOperationType.DELETE_NOTE as const,
            request: operation,
        })),
        ...addOperations.map(operation => ({
            type: FlowOperationType.ADD_NOTE as const,
            request: operation,
        })),
    ]
    return operations
}
function removeAnySubsequentAction(action: FlowAction): FlowAction {
    const clonedAction: FlowAction = JSON.parse(JSON.stringify(action))
    switch (clonedAction.type) {
        case FlowActionType.ROUTER: {
            clonedAction.children = clonedAction.children.map((child: FlowAction | null) => {
                if (isNil(child)) {
                    return null
                }
                return removeAnySubsequentAction(child)
            })
            break
        }
        case FlowActionType.LOOP_ON_ITEMS: {
            delete clonedAction.firstLoopAction
            break
        }
        case FlowActionType.PIECE:
        case FlowActionType.CODE:
            break
    }
    delete clonedAction.nextAction
    return clonedAction
}

/**
 * Создаёт операции GRAPH_ADD_NODE для каждой ноды в graphData,
 * и GRAPH_ADD_EDGE для каждого ребра.
 * Предполагается что graphData ещё НЕ содержит нод (они будут добавлены после очистки).
 */
function _getGraphDataImportOperations(graphData: GraphData): FlowOperationRequest[] {
    const operations: FlowOperationRequest[] = []

    for (const node of graphData.nodes) {
        operations.push({
            type: FlowOperationType.GRAPH_ADD_NODE as const,
            request: { node } as GraphAddNodeRequest,
        })
    }

    for (const edge of graphData.edges) {
        operations.push({
            type: FlowOperationType.GRAPH_ADD_EDGE as const,
            request: { edge } as GraphAddEdgeRequest,
        })
    }

    return operations
}

/**
 * Создаёт операции для удаления всех существующих graph nodes.
 * Удаление ноды автоматически каскадно удаляет связанные рёбра.
 */
function _getGraphDataCleanupOperations(flowVersion: FlowVersion): FlowOperationRequest[] {
    if (!flowVersion.graphData) {
        return []
    }
    return flowVersion.graphData.nodes.map(node => ({
        type: FlowOperationType.GRAPH_REMOVE_NODE as const,
        request: { nodeId: node.id },
    }))
}

function _importFlow(flowVersion: FlowVersion, request: ImportFlowRequest): FlowOperationRequest[] {
    const existingActions = flowStructureUtil.getAllNextActionsWithoutChildren(flowVersion.trigger)

    const deleteOperations = existingActions.map(action =>
        createDeleteActionOperation(action.name),
    )

    const importOperations = _getImportOperationsForSteps(request.trigger)

    const canvasLayoutOperations: FlowOperationRequest[] = request.canvasLayout !== undefined
        ? [{
            type: FlowOperationType.UPDATE_CANVAS_LAYOUT as const,
            request: { canvasLayout: request.canvasLayout ?? null },
        }]
        : []

    // Если graphData предоставлен — очищаем существующий граф и импортируем новый
    const graphCleanupOperations = request.graphData
        ? _getGraphDataCleanupOperations(flowVersion)
        : []

    const graphImportOperations = request.graphData
        ? _getGraphDataImportOperations(request.graphData)
        : []

    return [
        createChangeNameOperation(request.displayName),
        ...deleteOperations,
        createUpdateTriggerOperation(request.trigger),
        ...importOperations,
        ..._getImportOperationsForNotes(flowVersion, request),
        ...canvasLayoutOperations,
        ...graphCleanupOperations,
        ...graphImportOperations,
    ]
}

export { _importFlow, _getImportOperationsForSteps as _getImportOperations }