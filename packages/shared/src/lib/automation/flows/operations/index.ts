import { z } from 'zod'
import { Nullable } from '../../../core/common'
import { Metadata } from '../../../core/common/metadata'
import { FlowActionType, BranchCondition, CodeActionSchema, CodeActionSettings, LoopOnItemsAction, LoopOnItemsActionSchema, LoopOnItemsActionSettings, PieceActionSchema, PieceActionSettings, RouterAction, RouterActionSchema, RouterActionSettings } from '../actions/action'
import { FlowStatus } from '../flow'
import { CanvasLayout, FlowVersion, FlowVersionState } from '../flow-version'
import { GraphData, type GraphEdgeDefinition, type GraphNodeDefinition } from '../graph-data'
import { Note } from '../note'
import { SampleDataSetting, SaveSampleDataRequest } from '../sample-data'
import { EmptyTrigger, FlowTrigger, FlowTriggerType, PieceTrigger, PieceTriggerSettings } from '../triggers/trigger'
import { flowPieceUtil } from '../util/flow-piece-util'
import { flowStructureUtil, type Step } from '../util/flow-structure-util'
import { _addAction } from './add-action'
import { _addBranch } from './add-branch'
import { _getActionsForCopy } from './copy-action-operations'
import { _deleteAction } from './delete-action'
import { _deleteBranch } from './delete-branch'
import { _duplicateBranch, _duplicateStep } from './duplicate-step'
import { _importFlow } from './import-flow'
import { _moveAction } from './move-action'
import { _moveBranch } from './move-branch'
import { graphOperations, GraphAddNodeRequest, GraphRemoveNodeRequest, GraphAddEdgeRequest, GraphRemoveEdgeRequest, GraphMoveNodeRequest } from './graph-operations'
import { graphDataToLinkedList } from '../util/graph-converter'
import { notesOperations } from './notes-operations'
import { _getOperationsForPaste } from './paste-operations'
import { _skipAction } from './skip-action'
import { _updateAction } from './update-action'
import { _updateSampleDataInfo } from './update-sample-data-info'
import { _updateTrigger } from './update-trigger'

export enum FlowOperationType {
    LOCK_AND_PUBLISH = 'LOCK_AND_PUBLISH',
    CHANGE_STATUS = 'CHANGE_STATUS',
    LOCK_FLOW = 'LOCK_FLOW',
    CHANGE_FOLDER = 'CHANGE_FOLDER',
    CHANGE_NAME = 'CHANGE_NAME',
    MOVE_ACTION = 'MOVE_ACTION',
    IMPORT_FLOW = 'IMPORT_FLOW',
    UPDATE_TRIGGER = 'UPDATE_TRIGGER',
    ADD_ACTION = 'ADD_ACTION',
    UPDATE_ACTION = 'UPDATE_ACTION',
    DELETE_ACTION = 'DELETE_ACTION',
    DUPLICATE_ACTION = 'DUPLICATE_ACTION',
    USE_AS_DRAFT = 'USE_AS_DRAFT',
    DELETE_BRANCH = 'DELETE_BRANCH',
    ADD_BRANCH = 'ADD_BRANCH',
    DUPLICATE_BRANCH = 'DUPLICATE_BRANCH',
    SET_SKIP_ACTION = 'SET_SKIP_ACTION',
    UPDATE_METADATA = 'UPDATE_METADATA',
    MOVE_BRANCH = 'MOVE_BRANCH',
    SAVE_SAMPLE_DATA = 'SAVE_SAMPLE_DATA',
    UPDATE_MINUTES_SAVED = 'UPDATE_MINUTES_SAVED',
    UPDATE_OWNER = 'UPDATE_OWNER',
    UPDATE_NOTE = 'UPDATE_NOTE',
    DELETE_NOTE = 'DELETE_NOTE',
    ADD_NOTE = 'ADD_NOTE',
    UPDATE_SAMPLE_DATA_INFO = 'UPDATE_SAMPLE_DATA_INFO',
    UPDATE_CANVAS_LAYOUT = 'UPDATE_CANVAS_LAYOUT',
    GRAPH_ADD_NODE = 'GRAPH_ADD_NODE',
    GRAPH_REMOVE_NODE = 'GRAPH_REMOVE_NODE',
    GRAPH_ADD_EDGE = 'GRAPH_ADD_EDGE',
    GRAPH_REMOVE_EDGE = 'GRAPH_REMOVE_EDGE',
    GRAPH_MOVE_NODE = 'GRAPH_MOVE_NODE',
}

export const DeleteBranchRequest = z.object({
    branchIndex: z.number(),
    stepName: z.string(),
})

export const UpdateNoteRequest = Note.omit({ createdAt: true, updatedAt: true })
export const DeleteNoteRequest = z.object({
    id: z.string(),
})
export const AddNoteRequest = Note.omit({ createdAt: true, updatedAt: true, ownerId: true })

export const AddBranchRequest = z.object({
    branchIndex: z.number(),
    stepName: z.string(),
    conditions: z.array(z.array(BranchCondition)).optional(),
    branchName: z.string(),
})
export const MoveBranchRequest = z.object({
    sourceBranchIndex: z.number(),
    targetBranchIndex: z.number(),
    stepName: z.string(),
})
export type MoveBranchRequest = z.infer<typeof MoveBranchRequest>

export const SkipActionRequest = z.object({
    names: z.array(z.string()),
    skip: z.boolean(),
})

export type SkipActionRequest = z.infer<typeof SkipActionRequest>

export const UpdateSampleDataInfoRequest = z.object({
    stepName: z.string(),
    sampleDataSettings: SampleDataSetting.omit({ lastTestDate: true }),
})
export type UpdateSampleDataInfoRequest = z.infer<typeof UpdateSampleDataInfoRequest>

export const UpdateCanvasLayoutRequest = z.object({
    canvasLayout: Nullable(CanvasLayout),
})
export type UpdateCanvasLayoutRequest = z.infer<typeof UpdateCanvasLayoutRequest>

export const DuplicateBranchRequest = z.object({
    branchIndex: z.number(),
    stepName: z.string(),
})
export type DeleteBranchRequest = z.infer<typeof DeleteBranchRequest>
export type AddBranchRequest = z.infer<typeof AddBranchRequest>
export type DuplicateBranchRequest = z.infer<typeof DuplicateBranchRequest>
export type UpdateNoteRequest = z.infer<typeof UpdateNoteRequest>
export type DeleteNoteRequest = z.infer<typeof DeleteNoteRequest>
export type AddNoteRequest = z.infer<typeof AddNoteRequest>

export enum StepLocationRelativeToParent {
    AFTER = 'AFTER',
    INSIDE_LOOP = 'INSIDE_LOOP',
    INSIDE_BRANCH = 'INSIDE_BRANCH',
}

export const UseAsDraftRequest = z.object({
    versionId: z.string(),
})
export type UseAsDraftRequest = z.infer<typeof UseAsDraftRequest>

export const LockFlowRequest = z.object({})

export type LockFlowRequest = z.infer<typeof LockFlowRequest>

export const ImportFlowRequest = z.object({
    displayName: z.string(),
    trigger: FlowTrigger,
    schemaVersion: Nullable(z.string()),
    notes: Nullable(z.array(Note)),
    canvasLayout: Nullable(CanvasLayout).optional(),
    graphData: GraphData.optional(),
})

export type ImportFlowRequest = z.infer<typeof ImportFlowRequest>

export const ChangeFolderRequest = z.object({
    folderId: Nullable(z.string()),
})

export type ChangeFolderRequest = z.infer<typeof ChangeFolderRequest>

export const ChangeNameRequest = z.object({
    displayName: z.string(),
})

export type ChangeNameRequest = z.infer<typeof ChangeNameRequest>


export const DeleteActionRequest = z.object({
    names: z.array(z.string()),
})

export type DeleteActionRequest = z.infer<typeof DeleteActionRequest>

export const UpdateActionRequest = z.union([
    CodeActionSchema.omit({ lastUpdatedDate: true, settings: true }).and(z.object({ settings: CodeActionSettings.omit({ sampleData: true }) })),
    LoopOnItemsActionSchema.omit({ lastUpdatedDate: true, settings: true }).and(z.object({ settings: LoopOnItemsActionSettings.omit({ sampleData: true }) })),
    PieceActionSchema.omit({ lastUpdatedDate: true, settings: true }).and(z.object({ settings: PieceActionSettings.omit({ sampleData: true }) })),
    RouterActionSchema.omit({ lastUpdatedDate: true, settings: true }).and(z.object({ settings: RouterActionSettings.omit({ sampleData: true }) })),
])



export type UpdateActionRequest = z.infer<typeof UpdateActionRequest>

export const DuplicateStepRequest = z.object({
    stepName: z.string(),
})

export type DuplicateStepRequest = z.infer<typeof DuplicateStepRequest>

export const MoveActionRequest = z.object({
    name: z.string(),
    newParentStep: z.string(),
    stepLocationRelativeToNewParent: z.nativeEnum(StepLocationRelativeToParent).optional(),
    branchIndex: z.number().optional(),
})
export type MoveActionRequest = z.infer<typeof MoveActionRequest>

export const AddActionRequest = z.object({
    parentStep: z.string(),
    stepLocationRelativeToParent: z.nativeEnum(StepLocationRelativeToParent).optional(),
    branchIndex: z.number().optional(),
    action: UpdateActionRequest,
})
export type AddActionRequest = z.infer<typeof AddActionRequest>

export const UpdateTriggerRequest = z.union([
    EmptyTrigger.omit({ lastUpdatedDate: true }),
    PieceTrigger.omit({ lastUpdatedDate: true, settings: true }).and(z.object({ settings: PieceTriggerSettings.omit({ sampleData: true }) })),
])
export type UpdateTriggerRequest = z.infer<typeof UpdateTriggerRequest>

export const UpdateFlowStatusRequest = z.object({
    status: z.nativeEnum(FlowStatus),
})
export type UpdateFlowStatusRequest = z.infer<typeof UpdateFlowStatusRequest>

export const ChangePublishedVersionIdRequest = z.object({
    status: z.nativeEnum(FlowStatus).optional(),
})
export type ChangePublishedVersionIdRequest = z.infer<
    typeof ChangePublishedVersionIdRequest
>

export const UpdateMetadataRequest = z.object({
    metadata: Nullable(Metadata),
})
export type UpdateMetadataRequest = z.infer<typeof UpdateMetadataRequest>

export const UpdateMinutesSavedRequest = z.object({
    timeSavedPerRun: Nullable(z.number()),
})
export type UpdateMinutesSavedRequest = z.infer<typeof UpdateMinutesSavedRequest>

export const UpdateOwnerRequest = z.object({
    ownerId: z.string(),
})
export type UpdateOwnerRequest = z.infer<typeof UpdateOwnerRequest>
export const FlowOperationRequest = z.union([
    z.object({
        type: z.literal(FlowOperationType.MOVE_ACTION),
        request: MoveActionRequest,
    }).describe('Move Action'),
    z.object({
        type: z.literal(FlowOperationType.CHANGE_STATUS),
        request: UpdateFlowStatusRequest,
    }).describe('Change Status'),
    z.object({
        type: z.literal(FlowOperationType.LOCK_AND_PUBLISH),
        request: ChangePublishedVersionIdRequest,
    }).describe('Lock and Publish'),
    z.object({
        type: z.literal(FlowOperationType.USE_AS_DRAFT),
        request: UseAsDraftRequest,
    }).describe('Copy as Draft'),
    z.object({
        type: z.literal(FlowOperationType.LOCK_FLOW),
        request: LockFlowRequest,
    }).describe('Lock Flow'),
    z.object({
        type: z.literal(FlowOperationType.IMPORT_FLOW),
        request: ImportFlowRequest,
    }).describe('Import Flow'),
    z.object({
        type: z.literal(FlowOperationType.CHANGE_NAME),
        request: ChangeNameRequest,
    }).describe('Change Name'),
    z.object({
        type: z.literal(FlowOperationType.DELETE_ACTION),
        request: DeleteActionRequest,
    }).describe('Delete Action'),
    z.object({
        type: z.literal(FlowOperationType.UPDATE_ACTION),
        request: UpdateActionRequest,
    }).describe('Update Action'),
    z.object({
        type: z.literal(FlowOperationType.ADD_ACTION),
        request: AddActionRequest,
    }).describe('Add Action'),
    z.object({
        type: z.literal(FlowOperationType.UPDATE_TRIGGER),
        request: UpdateTriggerRequest,
    }).describe('Update Trigger'),
    z.object({
        type: z.literal(FlowOperationType.CHANGE_FOLDER),
        request: ChangeFolderRequest,
    }).describe('Change Folder'),
    z.object({
        type: z.literal(FlowOperationType.DUPLICATE_ACTION),
        request: DuplicateStepRequest,
    }).describe('Duplicate Action'),
    z.object({
        type: z.literal(FlowOperationType.DELETE_BRANCH),
        request: DeleteBranchRequest,
    }).describe('Delete Branch'),
    z.object({
        type: z.literal(FlowOperationType.ADD_BRANCH),
        request: AddBranchRequest,
    }).describe('Add Branch'),
    z.object({
        type: z.literal(FlowOperationType.DUPLICATE_BRANCH),
        request: DuplicateBranchRequest,
    }).describe('Duplicate Branch'),
    z.object({
        type: z.literal(FlowOperationType.SET_SKIP_ACTION),
        request: SkipActionRequest,
    }).describe('Skip Action'),
    z.object({
        type: z.literal(FlowOperationType.UPDATE_METADATA),
        request: UpdateMetadataRequest,
    }).describe('Update Metadata'),
    z.object({
        type: z.literal(FlowOperationType.MOVE_BRANCH),
        request: MoveBranchRequest,
    }),
    z.object({
        type: z.literal(FlowOperationType.SAVE_SAMPLE_DATA),
        request: SaveSampleDataRequest,
    }),
    z.object({
        type: z.literal(FlowOperationType.UPDATE_MINUTES_SAVED),
        request: UpdateMinutesSavedRequest,
    }).describe('Update Minutes Saved'),
    z.object({
        type: z.literal(FlowOperationType.UPDATE_OWNER),
        request: UpdateOwnerRequest,
    }).describe('Update Owner'),
    z.object({
        type: z.literal(FlowOperationType.UPDATE_NOTE),
        request: UpdateNoteRequest,
    }).describe('Update Note'),
    z.object({
        type: z.literal(FlowOperationType.DELETE_NOTE),
        request: DeleteNoteRequest,
    }).describe('Delete Note'),
    z.object({
        type: z.literal(FlowOperationType.ADD_NOTE),
        request: AddNoteRequest,
    }).describe('Add Note'),
    z.object({
        type: z.literal(FlowOperationType.UPDATE_SAMPLE_DATA_INFO),
        request: UpdateSampleDataInfoRequest,
    }).describe('Update Sample Data Info'),
    z.object({
        type: z.literal(FlowOperationType.UPDATE_CANVAS_LAYOUT),
        request: UpdateCanvasLayoutRequest,
    }).describe('Update Canvas Layout'),
    z.object({
        type: z.literal(FlowOperationType.GRAPH_ADD_NODE),
        request: GraphAddNodeRequest,
    }).describe('Graph Add Node'),
    z.object({
        type: z.literal(FlowOperationType.GRAPH_REMOVE_NODE),
        request: GraphRemoveNodeRequest,
    }).describe('Graph Remove Node'),
    z.object({
        type: z.literal(FlowOperationType.GRAPH_ADD_EDGE),
        request: GraphAddEdgeRequest,
    }).describe('Graph Add Edge'),
    z.object({
        type: z.literal(FlowOperationType.GRAPH_REMOVE_EDGE),
        request: GraphRemoveEdgeRequest,
    }).describe('Graph Remove Edge'),
    z.object({
        type: z.literal(FlowOperationType.GRAPH_MOVE_NODE),
        request: GraphMoveNodeRequest,
    }).describe('Graph Move Node'),
])



export type FlowOperationRequest = z.infer<typeof FlowOperationRequest>

export const flowOperations = {
    getActionsForCopy: _getActionsForCopy,
    getOperationsForPaste: _getOperationsForPaste,
    apply(flowVersion: FlowVersion, operation: FlowOperationRequest): FlowVersion {
        let clonedVersion: FlowVersion = JSON.parse(JSON.stringify(flowVersion))
        switch (operation.type) {
            case FlowOperationType.MOVE_ACTION: {
                const operations: FlowOperationRequest[] = _moveAction(clonedVersion, operation.request)
                operations.forEach((operation) => {
                    clonedVersion = flowOperations.apply(clonedVersion, operation)
                })
                clonedVersion = flowPieceUtil.makeFlowAutoUpgradable(clonedVersion)
                break
            }
            case FlowOperationType.CHANGE_NAME:
                clonedVersion.displayName = operation.request.displayName
                break
            case FlowOperationType.DUPLICATE_BRANCH: {
                const operations = _duplicateBranch(operation.request.stepName, operation.request.branchIndex, clonedVersion)
                operations.forEach((operation) => {
                    clonedVersion = flowOperations.apply(clonedVersion, operation)
                })
                break
            }
            case FlowOperationType.DUPLICATE_ACTION: {
                const operations = _duplicateStep(operation.request.stepName, clonedVersion)
                operations.forEach((operation) => {
                    clonedVersion = flowOperations.apply(clonedVersion, operation)
                })
                break
            }
            case FlowOperationType.LOCK_FLOW:
                clonedVersion.state = FlowVersionState.LOCKED
                break
            case FlowOperationType.ADD_ACTION: {
                clonedVersion = _addAction(clonedVersion, operation.request)
                clonedVersion = flowPieceUtil.makeFlowAutoUpgradable(clonedVersion)
                break
            }
            case FlowOperationType.DELETE_ACTION: {
                clonedVersion = _deleteAction(clonedVersion, operation.request)
                clonedVersion = flowPieceUtil.makeFlowAutoUpgradable(clonedVersion)
                break
            }
            case FlowOperationType.UPDATE_TRIGGER: {
                clonedVersion = _updateTrigger(clonedVersion, operation.request)
                clonedVersion = flowPieceUtil.makeFlowAutoUpgradable(clonedVersion)
                break
            }
            case FlowOperationType.ADD_BRANCH: {
                clonedVersion = _addBranch(clonedVersion, operation.request)
                clonedVersion = flowPieceUtil.makeFlowAutoUpgradable(clonedVersion)
                break
            }
            case FlowOperationType.DELETE_BRANCH: {
                clonedVersion = _deleteBranch(clonedVersion, operation.request)
                clonedVersion = flowPieceUtil.makeFlowAutoUpgradable(clonedVersion)
                break
            }
            case FlowOperationType.UPDATE_ACTION: {
                clonedVersion = _updateAction(clonedVersion, operation.request)
                clonedVersion = flowPieceUtil.makeFlowAutoUpgradable(clonedVersion)
                break
            }
            case FlowOperationType.IMPORT_FLOW: {
                const operations = _importFlow(clonedVersion, operation.request)
                operations.forEach((operation) => {
                    clonedVersion = flowOperations.apply(clonedVersion, operation)
                })
                break
            }
            case FlowOperationType.SET_SKIP_ACTION: {
                clonedVersion = _skipAction(clonedVersion, operation.request)
                break
            }
            case FlowOperationType.MOVE_BRANCH: {
                clonedVersion = _moveBranch(clonedVersion, operation.request)
                clonedVersion = flowPieceUtil.makeFlowAutoUpgradable(clonedVersion)
                break
            }
            case FlowOperationType.UPDATE_NOTE: {
                clonedVersion = notesOperations.updateNote(clonedVersion, operation.request)
                break
            }
            case FlowOperationType.DELETE_NOTE: {
                clonedVersion = notesOperations.deleteNote(clonedVersion, operation.request)
                break
            }
            case FlowOperationType.ADD_NOTE: {
                clonedVersion = notesOperations.addNote(clonedVersion, operation.request)
                break
            }
            case FlowOperationType.UPDATE_SAMPLE_DATA_INFO: {
                clonedVersion = _updateSampleDataInfo(clonedVersion, operation.request)
                break
            }
            case FlowOperationType.UPDATE_CANVAS_LAYOUT: {
                clonedVersion.canvasLayout = operation.request.canvasLayout
                break
            }
            case FlowOperationType.GRAPH_ADD_NODE: {
                clonedVersion = graphOperations.addNode(clonedVersion, operation.request)
                clonedVersion = syncTriggerFromGraphData(clonedVersion)
                break
            }
            case FlowOperationType.GRAPH_REMOVE_NODE: {
                clonedVersion = graphOperations.removeNode(clonedVersion, operation.request)
                clonedVersion = syncTriggerFromGraphData(clonedVersion)
                break
            }
            case FlowOperationType.GRAPH_ADD_EDGE: {
                clonedVersion = graphOperations.addEdge(clonedVersion, operation.request)
                clonedVersion = syncTriggerFromGraphData(clonedVersion)
                break
            }
            case FlowOperationType.GRAPH_REMOVE_EDGE: {
                clonedVersion = graphOperations.removeEdge(clonedVersion, operation.request)
                clonedVersion = syncTriggerFromGraphData(clonedVersion)
                break
            }
            case FlowOperationType.GRAPH_MOVE_NODE: {
                clonedVersion = graphOperations.moveNode(clonedVersion, operation.request)
                break
            }

            default:
                break
        }
        // Phase 2.5: Обратная синхронизация trigger → graphData
        // После ЛЮБОЙ операции кроме GRAPH_* обновляем graphData из trigger.
        // GRAPH_* операции исключены — они сами являются источником для graphData,
        // и для них работает syncTriggerFromGraphData (прямая синхронизация).
        if (clonedVersion.graphData && !GRAPH_OPERATIONS.has(operation.type)) {
            clonedVersion = syncGraphDataFromTrigger(clonedVersion)
        }
        clonedVersion.valid = flowStructureUtil.getAllSteps(clonedVersion.trigger).every((step) => {
            const isSkipped = step.type != FlowTriggerType.EMPTY && step.type != FlowTriggerType.PIECE && step.skip
            return step.valid || isSkipped
        })
        return clonedVersion
    },
}

/**
 * Set операций которые модифицируют graphData напрямую.
 * Для них обратная синхронизация trigger→graphData НЕ нужна —
 * они сами обновляют graphData и вызывают syncTriggerFromGraphData.
 */
const GRAPH_OPERATIONS = new Set<FlowOperationType>([
    FlowOperationType.GRAPH_ADD_NODE,
    FlowOperationType.GRAPH_REMOVE_NODE,
    FlowOperationType.GRAPH_ADD_EDGE,
    FlowOperationType.GRAPH_REMOVE_EDGE,
    FlowOperationType.GRAPH_MOVE_NODE,
])

/**
 * Авто-синхронизация trigger linked-list из graphData.
 *
 * При GRAPH_* операциях (кроме GRAPH_MOVE_NODE) graphData является источником
 * истины. Если graphData содержит trigger node, автоматически регенерируем
 * trigger linked-list chain для backward compatibility с API consumers.
 *
 * Если trigger node не найден в graphData — trigger не трогаем.
 */
function syncTriggerFromGraphData(flowVersion: FlowVersion): FlowVersion {
    if (!flowVersion.graphData) {
        return flowVersion
    }
    const hasTriggerNode = flowVersion.graphData.nodes.some(n => n.type === 'trigger')
    if (!hasTriggerNode) {
        return flowVersion
    }
    try {
        const trigger = graphDataToLinkedList(flowVersion.graphData)
        return {
            ...flowVersion,
            trigger,
        }
    }
    catch {
        // Если конвертация невозможна (например, граф невалиден) — не трогаем trigger
        return flowVersion
    }
}

/**
 * Phase 2.5: Обратная синхронизация trigger (linked-list) → graphData.
 *
 * Вызывается после КАЖДОЙ операции кроме GRAPH_*.
 * Обновляет graphData.nodes[].settings/displayName/valid/actionType/skip
 * из trigger linked-list, добавляет новые ноды, удаляет orphan ноды,
 * полностью регенерирует edges из trigger structure.
 *
 * Гарантирует что graphData всегда актуален после UPDATE_ACTION,
 * ADD_ACTION, DELETE_ACTION и всех остальных операций.
 */
function syncGraphDataFromTrigger(flowVersion: FlowVersion): FlowVersion {
    if (!flowVersion.graphData) {
        return flowVersion
    }

    const clonedGraphData: GraphData = JSON.parse(JSON.stringify(flowVersion.graphData))
    const allSteps = flowStructureUtil.getAllSteps(flowVersion.trigger)
    const stepNames = new Set(allSteps.map(s => s.name))

    // 1. NODES SYNC: обновить settings существующих нод + добавить новые
    for (const step of allSteps) {
        const node = clonedGraphData.nodes.find(n => n.id === step.name)
        if (node) {
            node.settings = step.settings as Record<string, unknown>
            node.displayName = step.displayName
            node.valid = step.valid
            node.actionType = step.type
            if ('skip' in step && step.skip !== undefined) {
                node.skip = step.skip
            }
        }
        else {
            // Новая нода (создана через legacy ADD_ACTION, не через GRAPH_ADD_NODE)
            const newNode: GraphNodeDefinition = {
                id: step.name,
                type: step.name === flowVersion.trigger.name ? 'trigger' : 'action',
                position: { x: 0, y: 0 },
                settings: step.settings as Record<string, unknown>,
                displayName: step.displayName,
                valid: step.valid,
                actionType: step.type,
            }
            if ('skip' in step && step.skip !== undefined) {
                newNode.skip = step.skip
            }
            clonedGraphData.nodes.push(newNode)
        }
    }

    // 2. ORPHAN REMOVAL: удалить ноды которых нет в trigger
    clonedGraphData.nodes = clonedGraphData.nodes.filter(n => stepNames.has(n.id))

    // 3. EDGES SYNC: полная регенерация из trigger structure
    clonedGraphData.edges = traverseTriggerToEdges(flowVersion.trigger)

    return { ...flowVersion, graphData: clonedGraphData }
}

/**
 * Рекурсивный обход trigger linked-list для генерации edges.
 * Использует тот же алгоритм что traverseStep в graph-converter.ts:
 *   step.nextAction → edge(step, nextAction, 'output', 'input')
 *   loop.firstLoopAction → edge(loop, firstLoopAction, 'loop-output', 'input')
 *   router.children[i] → edge(router, children[i], 'branch-{i}', 'input')
 */
function traverseTriggerToEdges(trigger: FlowTrigger): GraphEdgeDefinition[] {
    const edges: GraphEdgeDefinition[] = []
    collectEdgesFromStep(trigger, edges)
    return edges
}

function collectEdgesFromStep(step: Step | null | undefined, edges: GraphEdgeDefinition[]): void {
    if (!step) return

    // Loop: firstLoopAction edge
    if (step.type === FlowActionType.LOOP_ON_ITEMS) {
        const loopStep = step as LoopOnItemsAction
        if (loopStep.firstLoopAction) {
            edges.push({
                id: `${step.name}-loop-output-${loopStep.firstLoopAction.name}`,
                source: step.name,
                target: loopStep.firstLoopAction.name,
                sourceHandle: 'loop-output',
                targetHandle: 'input',
            })
            collectEdgesFromStep(loopStep.firstLoopAction, edges)
        }
    }

    // Router: branch edges
    if (step.type === FlowActionType.ROUTER) {
        const routerStep = step as RouterAction
        if (routerStep.children) {
            routerStep.children.forEach((child, index) => {
                if (child) {
                    edges.push({
                        id: `${step.name}-branch-${index}-${child.name}`,
                        source: step.name,
                        target: child.name,
                        sourceHandle: `branch-${index}`,
                        targetHandle: 'input',
                    })
                    collectEdgesFromStep(child, edges)
                }
            })
        }
    }

    // nextAction: output edge
    if ('nextAction' in step && step.nextAction) {
        edges.push({
            id: `${step.name}-output-${step.nextAction.name}`,
            source: step.name,
            target: step.nextAction.name,
            sourceHandle: 'output',
            targetHandle: 'input',
        })
        collectEdgesFromStep(step.nextAction, edges)
    }
}
