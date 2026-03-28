import { GraphData, GraphNodeDefinition, GraphEdgeDefinition } from '../graph-data'
import { FlowVersion } from '../flow-version'

/**
 * Результат экспорта flow в JSON: graphData + метаданные.
 */
export type FlowExportData = {
    displayName: string
    schemaVersion: string | null
    graphData: {
        nodes: Array<{
            id: string
            type: string
            position: { x: number; y: number }
            displayName: string
            valid: boolean
            skip?: boolean
            errorHandling?: {
                continueOnFailure?: boolean
                retryOnFailure?: boolean
            }
            actionType: string
            settings: Record<string, unknown>
            sampleData?: Record<string, unknown>
        }>
        edges: Array<{
            id: string
            source: string
            target: string
            sourceHandle: string
            targetHandle: string
        }>
    }
    exportVersion: string
    exportedAt: string
}

/**
 * Результат валидации импорта: успех с GraphData или ошибка.
 */
export type FlowImportValidationResult =
    | { success: true; graphData: GraphData; displayName: string; schemaVersion: string | null }
    | { success: false; error: string }

const EXPORT_VERSION = '1.0'

/**
 * Экспортирует FlowVersion в JSON строку с graphData + метаданными.
 *
 * Если graphData отсутствует, возвращает null.
 */
export function exportFlowToJson(flowVersion: FlowVersion): string | null {
    if (!flowVersion.graphData) {
        return null
    }

    const exportData: FlowExportData = {
        displayName: flowVersion.displayName,
        schemaVersion: flowVersion.schemaVersion,
        graphData: {
            nodes: flowVersion.graphData.nodes.map((node) => ({
                id: node.id,
                type: node.type,
                position: { x: node.position.x, y: node.position.y },
                displayName: node.displayName,
                valid: node.valid,
                ...(node.skip !== undefined ? { skip: node.skip } : {}),
                ...(node.errorHandling !== undefined ? { errorHandling: node.errorHandling } : {}),
                actionType: node.actionType,
                settings: node.settings,
                ...(node.sampleData !== undefined ? { sampleData: node.sampleData } : {}),
            })),
            edges: flowVersion.graphData.edges.map((edge) => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle,
            })),
        },
        exportVersion: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
    }

    return JSON.stringify(exportData, null, 2)
}

/**
 * Валидирует JSON строку импорта flow.
 *
 * Проверяет:
 * 1. JSON parseable
 * 2. graphData содержит nodes[] и edges[]
 * 3. Каждый node валиден по GraphNodeDefinition schema
 * 4. Каждый edge валиден по GraphEdgeDefinition schema
 * 5. Нет дубликатов node id
 * 6. Нет дубликатов edge id
 * 7. Все edge source/target ссылаются на существующие nodes
 */
export function validateFlowImport(json: string): FlowImportValidationResult {
    let parsed: unknown
    try {
        parsed = JSON.parse(json)
    }
    catch {
        return { success: false, error: 'Invalid JSON format' }
    }

    if (typeof parsed !== 'object' || parsed === null) {
        return { success: false, error: 'JSON must be an object' }
    }

    const data = parsed as Record<string, unknown>

    // Извлечение displayName
    const displayName = typeof data['displayName'] === 'string' ? data['displayName'] : 'Imported Flow'

    // Извлечение schemaVersion
    const schemaVersion = typeof data['schemaVersion'] === 'string' ? data['schemaVersion'] : null

    // Извлечение graphData
    const rawGraphData = data['graphData']
    if (typeof rawGraphData !== 'object' || rawGraphData === null) {
        return { success: false, error: 'Missing or invalid graphData field' }
    }

    const graphDataObj = rawGraphData as Record<string, unknown>

    if (!Array.isArray(graphDataObj['nodes'])) {
        return { success: false, error: 'graphData.nodes must be an array' }
    }

    if (!Array.isArray(graphDataObj['edges'])) {
        return { success: false, error: 'graphData.edges must be an array' }
    }

    // Валидация nodes через Zod
    const nodes: Array<typeof GraphNodeDefinition._type> = []
    for (let i = 0; i < graphDataObj['nodes'].length; i++) {
        const nodeResult = GraphNodeDefinition.safeParse(graphDataObj['nodes'][i])
        if (!nodeResult.success) {
            return { success: false, error: `Invalid node at index ${i}: ${nodeResult.error.message}` }
        }
        nodes.push(nodeResult.data)
    }

    // Валидация edges через Zod
    const edges: Array<typeof GraphEdgeDefinition._type> = []
    for (let i = 0; i < graphDataObj['edges'].length; i++) {
        const edgeResult = GraphEdgeDefinition.safeParse(graphDataObj['edges'][i])
        if (!edgeResult.success) {
            return { success: false, error: `Invalid edge at index ${i}: ${edgeResult.error.message}` }
        }
        edges.push(edgeResult.data)
    }

    // Проверка дубликатов node id
    const nodeIds = new Set<string>()
    for (const node of nodes) {
        if (nodeIds.has(node.id)) {
            return { success: false, error: `Duplicate node id: "${node.id}"` }
        }
        nodeIds.add(node.id)
    }

    // Проверка дубликатов edge id
    const edgeIds = new Set<string>()
    for (const edge of edges) {
        if (edgeIds.has(edge.id)) {
            return { success: false, error: `Duplicate edge id: "${edge.id}"` }
        }
        edgeIds.add(edge.id)
    }

    // Проверка что все edge source/target ссылаются на существующие nodes
    for (const edge of edges) {
        if (!nodeIds.has(edge.source)) {
            return { success: false, error: `Edge "${edge.id}" references non-existent source node "${edge.source}"` }
        }
        if (!nodeIds.has(edge.target)) {
            return { success: false, error: `Edge "${edge.id}" references non-existent target node "${edge.target}"` }
        }
    }

    return {
        success: true,
        graphData: { nodes, edges },
        displayName,
        schemaVersion,
    }
}

/**
 * Создаёт IMPORT_FLOW request с graphData для использования с flowOperations.apply().
 */
export function createImportFlowOperation(importResult: {
    graphData: GraphData
    displayName: string
    schemaVersion: string | null
}): {
    type: 'IMPORT_FLOW'
    request: {
        displayName: string
        trigger: { name: string; type: string; valid: boolean; displayName: string; settings: Record<string, unknown>; lastUpdatedDate: string }
        schemaVersion: string | null
        notes: null
        graphData: GraphData
    }
} {
    // Находим trigger node в graphData (если есть)
    const triggerNode = importResult.graphData.nodes.find(n => n.type === 'trigger')

    // Создаём минимальный trigger для backward compatibility
    const trigger = triggerNode
        ? {
            name: triggerNode.id,
            type: triggerNode.actionType,
            valid: triggerNode.valid,
            displayName: triggerNode.displayName,
            settings: triggerNode.settings,
            lastUpdatedDate: new Date().toISOString(),
        }
        : {
            name: 'trigger',
            type: 'EMPTY',
            valid: false,
            displayName: 'Empty Trigger',
            settings: {},
            lastUpdatedDate: new Date().toISOString(),
        }

    return {
        type: 'IMPORT_FLOW',
        request: {
            displayName: importResult.displayName,
            trigger: trigger,
            schemaVersion: importResult.schemaVersion,
            notes: null,
            graphData: importResult.graphData,
        },
    }
}
