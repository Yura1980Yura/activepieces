import { GraphData, GraphNodeDefinition } from '../graph-data'

/**
 * Результат извлечения ноды из графа.
 */
export type ExtractNodeResult =
    | { success: true; node: GraphNodeDefinition }
    | { success: false; error: string }

/**
 * Извлечь ноду по ID из graphData.
 *
 * @param graphData -- графовые данные потока
 * @param nodeId -- ID ноды для извлечения
 * @returns ExtractNodeResult
 */
export function extractNodeFromGraphData(
    graphData: GraphData,
    nodeId: string,
): ExtractNodeResult {
    const node = graphData.nodes.find((n) => n.id === nodeId)
    if (!node) {
        return {
            success: false,
            error: `Node "${nodeId}" not found in graphData (available: ${graphData.nodes.map(n => n.id).join(', ')})`,
        }
    }
    return { success: true, node }
}

/**
 * Создать минимальный GraphData для тестирования одного шага.
 *
 * Граф содержит:
 * 1. Trigger-ноду (пустой EMPTY trigger)
 * 2. Тестируемую action-ноду
 * 3. Одно ребро trigger -> action (sourceHandle: 'output')
 *
 * Mock input подставляется в settings ноды если передан.
 *
 * @param node -- определение тестируемой ноды (из extractNodeFromGraphData)
 * @param mockInput -- опциональный mock input для подмены settings.input
 * @returns GraphData с минимальным графом для step test
 */
export function createStepTestGraphData(
    node: GraphNodeDefinition,
    mockInput?: Record<string, unknown>,
): GraphData {
    const triggerId = '__step_test_trigger__'

    const triggerNode: GraphNodeDefinition = {
        id: triggerId,
        type: 'trigger',
        position: { x: 0, y: 0 },
        displayName: 'Step Test Trigger',
        valid: true,
        actionType: 'EMPTY',
        settings: {},
    }

    // Копируем ноду, при необходимости подменяя input в settings
    const testNode: GraphNodeDefinition = {
        ...node,
        // Сбрасываем skip для тестирования
        skip: false,
        // Подменяем settings.input если передан mockInput
        settings: mockInput !== undefined
            ? { ...node.settings, input: mockInput }
            : node.settings,
    }

    return {
        nodes: [triggerNode, testNode],
        edges: [
            {
                id: `${triggerId}-output-${testNode.id}`,
                source: triggerId,
                target: testNode.id,
                sourceHandle: 'output',
                targetHandle: 'input',
            },
        ],
    }
}

/**
 * Параметры для создания запроса тестирования одного шага.
 */
export type StepTestRequestParams = {
    /** ID тестируемой ноды */
    nodeId: string
    /** ID версии потока */
    flowVersionId: string
    /** ID проекта */
    projectId: string
}

/**
 * Результат создания запроса для step test.
 * Содержит payload, совместимый с CreateStepRunRequestBody.
 */
export type StepTestRequest = {
    projectId: string
    flowVersionId: string
    stepName: string
}

/**
 * Создать request payload для тестирования одного шага.
 *
 * Результат совместим с существующим CreateStepRunRequestBody.
 * Используется UI-кнопкой "Test Step" для отправки запроса на сервер.
 *
 * @param params -- параметры запроса
 * @returns StepTestRequest
 */
export function createStepTestRequest(params: StepTestRequestParams): StepTestRequest {
    return {
        projectId: params.projectId,
        flowVersionId: params.flowVersionId,
        stepName: params.nodeId,
    }
}

/**
 * Проверить, является ли нода тестируемой (не trigger, не router, не loop).
 *
 * Trigger-ноды тестируются через отдельный механизм (simulate/poll).
 * Loop и Router -- составные ноды, их тестирование требует подграфа.
 * Для step test доступны только простые action-ноды (CODE, PIECE).
 *
 * @param node -- определение ноды
 * @returns true если ноду можно тестировать через step test
 */
export function isNodeTestable(node: GraphNodeDefinition): boolean {
    if (node.type === 'trigger') {
        return false
    }
    // LOOP_ON_ITEMS и ROUTER -- составные ноды, требуют тело/ветки
    if (node.actionType === 'LOOP_ON_ITEMS' || node.actionType === 'ROUTER') {
        return false
    }
    return true
}

/**
 * Извлечь все тестируемые ноды из graphData.
 *
 * @param graphData -- графовые данные потока
 * @returns массив тестируемых нод
 */
export function getTestableNodes(graphData: GraphData): GraphNodeDefinition[] {
    return graphData.nodes.filter(isNodeTestable)
}
