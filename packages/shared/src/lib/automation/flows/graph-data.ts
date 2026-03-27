import { z } from 'zod'

/**
 * Позиция ноды на canvas (пиксели).
 */
export const GraphNodePosition = z.object({
    x: z.number(),
    y: z.number(),
})

export type GraphNodePosition = z.infer<typeof GraphNodePosition>

/**
 * Настройки обработки ошибок ноды.
 */
export const GraphNodeErrorHandling = z.object({
    continueOnFailure: z.boolean().optional(),
    retryOnFailure: z.boolean().optional(),
})

export type GraphNodeErrorHandling = z.infer<typeof GraphNodeErrorHandling>

/**
 * Тип ноды для ReactFlow рендеринга.
 */
export const GraphNodeType = z.enum(['trigger', 'action', 'loop', 'router'])

export type GraphNodeType = z.infer<typeof GraphNodeType>

/**
 * Определение ноды графа -- хранится в FlowVersion.graphData.nodes[].
 * Каждая нода содержит полное определение шага (trigger/action) + позицию на canvas.
 */
export const GraphNodeDefinition = z.object({
    /** Уникальный идентификатор ноды (= step.name, e.g. "trigger", "step_1") */
    id: z.string(),

    /** Тип ноды для ReactFlow рендеринга */
    type: GraphNodeType,

    /** Позиция на canvas (пиксели) */
    position: GraphNodePosition,

    /** Отображаемое имя ноды */
    displayName: z.string(),

    /** Валидность конфигурации ноды */
    valid: z.boolean(),

    /** Пропустить при исполнении */
    skip: z.boolean().optional(),

    /** Настройки обработки ошибок */
    errorHandling: GraphNodeErrorHandling.optional(),

    /** Тип действия из FlowActionType или FlowTriggerType */
    actionType: z.string(),

    /** Настройки шага (CodeActionSettings | PieceActionSettings | LoopOnItemsActionSettings | RouterActionSettings | PieceTriggerSettings) */
    settings: z.record(z.string(), z.unknown()),

    /** Sample data для предпросмотра */
    sampleData: z.record(z.string(), z.unknown()).optional(),
})

export type GraphNodeDefinition = z.infer<typeof GraphNodeDefinition>

/**
 * Определение ребра графа -- хранится в FlowVersion.graphData.edges[].
 * Каждое ребро связывает выход одной ноды с входом другой.
 */
export const GraphEdgeDefinition = z.object({
    /** Уникальный ID ребра: "{source}-{sourceHandle}-{target}" */
    id: z.string(),

    /** ID исходной ноды */
    source: z.string(),

    /** ID целевой ноды */
    target: z.string(),

    /**
     * Handle исходной ноды:
     * - "output"      -- основной выход (nextAction в linked-list)
     * - "loop-output"  -- выход цикла (firstLoopAction)
     * - "branch-N"     -- выход ветки роутера (children[N])
     */
    sourceHandle: z.string(),

    /**
     * Handle целевой ноды:
     * - "input" -- единственный вход (все ноды кроме trigger)
     */
    targetHandle: z.string(),
})

export type GraphEdgeDefinition = z.infer<typeof GraphEdgeDefinition>

/**
 * Графовые данные потока -- источник истины для Phase 2.
 */
export const GraphData = z.object({
    nodes: z.array(GraphNodeDefinition),
    edges: z.array(GraphEdgeDefinition),
})

export type GraphData = z.infer<typeof GraphData>
