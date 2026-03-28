import { StepOutputStatus } from '../../flow-run/execution/step-output'
import { FlowRunStatus, isFailedState, isFlowRunStateTerminal } from '../../flow-run/execution/flow-execution'
import { StepOutput } from '../../flow-run/execution/step-output'

/**
 * Визуальное состояние ноды при исполнении потока.
 *
 * - idle: нода не участвует в текущем запуске (нет данных исполнения)
 * - running: нода в процессе исполнения (жёлтый)
 * - success: нода успешно завершена (зелёный)
 * - error: нода завершена с ошибкой (красный)
 * - skipped: нода пропущена (серый, для skip=true или неактивных веток)
 */
export enum NodeExecutionVisualStatus {
    IDLE = 'idle',
    RUNNING = 'running',
    SUCCESS = 'success',
    ERROR = 'error',
    SKIPPED = 'skipped',
}

/**
 * CSS-классы для каждого визуального состояния ноды.
 *
 * Классы применяются к корневому div узла в GraphStepNode/GraphTriggerNode.
 * Следуют системе дизайна activepieces (tailwind dark-mode aware).
 *
 * Architecture: P2-D01 — подсветка нод (жёлтый=running, зелёный=success, красный=error)
 */
export const NODE_EXECUTION_CSS_CLASSES: Record<NodeExecutionVisualStatus, string> = {
    [NodeExecutionVisualStatus.IDLE]: '',
    [NodeExecutionVisualStatus.RUNNING]: 'border-warning ring-2 ring-warning/30',
    [NodeExecutionVisualStatus.SUCCESS]: 'border-success ring-2 ring-success/30',
    [NodeExecutionVisualStatus.ERROR]: 'border-destructive ring-2 ring-destructive/30',
    [NodeExecutionVisualStatus.SKIPPED]: 'opacity-50 border-muted',
}

/**
 * Data-атрибут для тестирования визуального состояния ноды.
 */
export const NODE_EXECUTION_STATUS_ATTR = 'data-execution-status' as const

/**
 * Маппинг StepOutputStatus → NodeExecutionVisualStatus.
 *
 * Используется для определения визуального состояния ноды по результату исполнения шага.
 *
 * @param stepStatus - статус исполнения шага (из StepOutput.status)
 * @returns визуальное состояние ноды
 */
export function stepOutputStatusToVisual(stepStatus: StepOutputStatus): NodeExecutionVisualStatus {
    switch (stepStatus) {
        case StepOutputStatus.RUNNING:
            return NodeExecutionVisualStatus.RUNNING
        case StepOutputStatus.SUCCEEDED:
        case StepOutputStatus.STOPPED:
            return NodeExecutionVisualStatus.SUCCESS
        case StepOutputStatus.FAILED:
            return NodeExecutionVisualStatus.ERROR
        case StepOutputStatus.PAUSED:
            return NodeExecutionVisualStatus.RUNNING
    }
}

/**
 * Определение визуального состояния конкретной ноды на основе данных run.
 *
 * Логика:
 * 1. Если run отсутствует → IDLE
 * 2. Если run.steps содержит output для данного stepName → маппинг по stepStatus
 * 3. Если run завершён (terminal) и у stepName нет output → SKIPPED
 * 4. Если run RUNNING и у stepName нет output → IDLE (ещё не дошла очередь)
 *
 * @param stepName - имя ноды (step.name)
 * @param runSteps - Record<string, StepOutput> из FlowRun.steps
 * @param runStatus - FlowRunStatus из FlowRun.status
 * @returns визуальное состояние ноды
 */
export function getNodeVisualStatus(
    stepName: string,
    runSteps: Record<string, StepOutput> | null | undefined,
    runStatus: FlowRunStatus | null | undefined,
): NodeExecutionVisualStatus {
    if (!runSteps || !runStatus) {
        return NodeExecutionVisualStatus.IDLE
    }

    const stepOutput = runSteps[stepName] as StepOutput | undefined
    if (stepOutput) {
        return stepOutputStatusToVisual(stepOutput.status)
    }

    // Нода не имеет output — определяем по общему статусу потока
    const isTerminal = runStatus ? isFlowRunStateTerminal({ status: runStatus, ignoreInternalError: false }) : false
    const isFailed = runStatus ? isFailedState(runStatus) : false

    if (isTerminal || isFailed) {
        // Поток завершён, а нода не была выполнена → SKIPPED
        return NodeExecutionVisualStatus.SKIPPED
    }

    // Поток ещё выполняется, нода ещё не дошла
    return NodeExecutionVisualStatus.IDLE
}

/**
 * Вычислить визуальные статусы для всех нод на основе данных run.
 *
 * @param stepNames - массив имён нод (из graphData.nodes[].id)
 * @param runSteps - Record<string, StepOutput> из FlowRun.steps
 * @param runStatus - FlowRunStatus из FlowRun.status
 * @returns маппинг stepName → NodeExecutionVisualStatus
 */
export function computeAllNodeVisualStatuses(
    stepNames: string[],
    runSteps: Record<string, StepOutput> | null | undefined,
    runStatus: FlowRunStatus | null | undefined,
): Record<string, NodeExecutionVisualStatus> {
    const result: Record<string, NodeExecutionVisualStatus> = {}
    for (const stepName of stepNames) {
        result[stepName] = getNodeVisualStatus(stepName, runSteps, runStatus)
    }
    return result
}

/**
 * Получить CSS-класс для визуального состояния ноды.
 *
 * @param status - визуальное состояние ноды
 * @returns CSS-класс (может быть пустой строкой для IDLE)
 */
export function getExecutionOverlayCssClass(status: NodeExecutionVisualStatus): string {
    return NODE_EXECUTION_CSS_CLASSES[status]
}
