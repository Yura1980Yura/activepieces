import { StepOutput, StepOutputStatus } from '../../flow-run/execution/step-output'
import { NodeExecutionVisualStatus } from './execution-overlay-utils'

/**
 * Максимальная длина сообщения об ошибке для tooltip (по умолчанию).
 */
const DEFAULT_ERROR_MAX_LENGTH = 200

/**
 * Data-атрибут для тестирования наличия иконки ошибки на ноде.
 */
export const NODE_ERROR_ICON_ATTR = 'data-error-icon' as const

/**
 * Data-атрибут для содержимого tooltip ошибки.
 */
export const NODE_ERROR_TOOLTIP_ATTR = 'data-error-tooltip' as const

/**
 * Проверить, находится ли нода в состоянии ошибки.
 *
 * Нода в состоянии ошибки, если её визуальный статус === ERROR.
 *
 * @param visualStatus - визуальное состояние ноды (NodeExecutionVisualStatus)
 * @returns true если нода в состоянии ошибки
 */
export function isNodeInErrorState(visualStatus: NodeExecutionVisualStatus): boolean {
    return visualStatus === NodeExecutionVisualStatus.ERROR
}

/**
 * Извлечь сообщение об ошибке из StepOutput.
 *
 * Логика:
 * 1. Если stepOutput отсутствует → null
 * 2. Если статус не FAILED → null
 * 3. Если errorMessage — строка → возвращает её
 * 4. Если errorMessage — объект → JSON.stringify
 * 5. Если errorMessage пуст → fallback-сообщение
 *
 * @param stepOutput - результат исполнения шага
 * @returns сообщение об ошибке или null
 */
export function extractStepErrorMessage(
    stepOutput: StepOutput | null | undefined,
): string | null {
    if (!stepOutput) {
        return null
    }

    if (stepOutput.status !== StepOutputStatus.FAILED) {
        return null
    }

    const raw = stepOutput.errorMessage
    if (raw === null || raw === undefined) {
        return 'Step failed'
    }

    if (typeof raw === 'string') {
        return raw || 'Step failed'
    }

    if (typeof raw === 'object') {
        try {
            return JSON.stringify(raw)
        }
        catch {
            return String(raw)
        }
    }

    return String(raw)
}

/**
 * Извлечь сообщение об ошибке ноды по имени из данных run.
 *
 * Комбинирует поиск stepOutput в runSteps + extractStepErrorMessage.
 *
 * @param stepName - имя ноды (step.name)
 * @param runSteps - Record<string, StepOutput> из FlowRun.steps
 * @returns сообщение об ошибке или null
 */
export function getNodeErrorMessage(
    stepName: string,
    runSteps: Record<string, StepOutput> | null | undefined,
): string | null {
    if (!runSteps) {
        return null
    }

    const stepOutput = runSteps[stepName] as StepOutput | undefined
    return extractStepErrorMessage(stepOutput)
}

/**
 * Форматировать сообщение об ошибке для отображения в tooltip.
 *
 * Правила:
 * - null/undefined → пустая строка
 * - строка короче maxLength → без изменений
 * - строка длиннее maxLength → обрезается + "..."
 * - Убирает лишние переводы строк (заменяет на пробелы)
 *
 * @param errorMessage - исходное сообщение об ошибке
 * @param maxLength - максимальная длина (по умолчанию 200)
 * @returns отформатированная строка для tooltip
 */
export function formatErrorForTooltip(
    errorMessage: string | null | undefined,
    maxLength: number = DEFAULT_ERROR_MAX_LENGTH,
): string {
    if (!errorMessage) {
        return ''
    }

    // Заменяем переводы строк на пробелы для компактного отображения в tooltip
    const sanitized = errorMessage.replace(/[\r\n]+/g, ' ').trim()

    if (sanitized.length <= maxLength) {
        return sanitized
    }

    return sanitized.slice(0, maxLength) + '...'
}

/**
 * Получить полные данные для отображения ошибки на ноде.
 *
 * Возвращает объект с isError и tooltipText, готовый для использования
 * в компонентах GraphStepNode / GraphTriggerNode.
 *
 * @param visualStatus - визуальное состояние ноды
 * @param stepName - имя ноды
 * @param runSteps - данные исполнения
 * @param maxLength - максимальная длина tooltip
 * @returns объект { isError, tooltipText }
 */
export function getNodeErrorDisplayData(
    visualStatus: NodeExecutionVisualStatus,
    stepName: string,
    runSteps: Record<string, StepOutput> | null | undefined,
    maxLength: number = DEFAULT_ERROR_MAX_LENGTH,
): { isError: boolean; tooltipText: string } {
    const isError = isNodeInErrorState(visualStatus)

    if (!isError) {
        return { isError: false, tooltipText: '' }
    }

    const errorMessage = getNodeErrorMessage(stepName, runSteps)
    const tooltipText = formatErrorForTooltip(errorMessage, maxLength)

    return { isError, tooltipText }
}
