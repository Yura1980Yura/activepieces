import { StepOutput, StepOutputStatus } from '../../flow-run/execution/step-output'

/**
 * Данные предпросмотра output ноды.
 *
 * Содержит всю информацию, необходимую для отображения результатов
 * исполнения ноды в боковой панели (input/output/status/duration/error).
 *
 * Architecture: P2-D02 — предпросмотр output ноды
 */
export type NodeOutputPreviewData = {
    /** Имя шага (node id) */
    stepName: string
    /** Входные данные шага */
    input: unknown
    /** Выходные данные шага */
    output: unknown
    /** Статус исполнения шага */
    status: StepOutputStatus
    /** Длительность исполнения в миллисекундах */
    duration: number
    /** Сообщение об ошибке (если есть) */
    errorMessage: unknown
}

/**
 * Извлечь данные предпросмотра ноды из результатов исполнения потока.
 *
 * Логика:
 * 1. Если runSteps отсутствует или не содержит stepName → null
 * 2. Если step output найден → формирует NodeOutputPreviewData
 *
 * @param stepName - имя ноды (step.name)
 * @param runSteps - Record<string, StepOutput> из FlowRun.steps
 * @returns данные предпросмотра или null если нода не исполнялась
 */
export function extractNodeOutputPreview(
    stepName: string,
    runSteps: Record<string, StepOutput> | null | undefined,
): NodeOutputPreviewData | null {
    if (!runSteps) {
        return null
    }

    const stepOutput = runSteps[stepName] as StepOutput | undefined
    if (!stepOutput) {
        return null
    }

    return {
        stepName,
        input: stepOutput.input ?? null,
        output: stepOutput.output ?? null,
        status: stepOutput.status,
        duration: stepOutput.duration ?? 0,
        errorMessage: stepOutput.errorMessage ?? null,
    }
}

/**
 * Проверить наличие данных исполнения для ноды.
 *
 * @param stepName - имя ноды (step.name)
 * @param runSteps - Record<string, StepOutput> из FlowRun.steps
 * @returns true если нода была исполнена (имеет StepOutput)
 */
export function hasNodeExecutionData(
    stepName: string,
    runSteps: Record<string, StepOutput> | null | undefined,
): boolean {
    if (!runSteps) {
        return false
    }
    return stepName in runSteps
}

const DEFAULT_MAX_LENGTH = 500

/**
 * Форматировать значение для отображения в preview.
 *
 * Правила:
 * - null → "null"
 * - undefined → "undefined"
 * - string короче maxLength → без изменений
 * - string длиннее maxLength → обрезается + "..."
 * - object/array → JSON.stringify + truncate
 * - number/boolean → String()
 *
 * @param value - значение для форматирования
 * @param maxLength - максимальная длина строки (по умолчанию 500)
 * @returns отформатированная строка
 */
export function formatOutputPreviewValue(
    value: unknown,
    maxLength: number = DEFAULT_MAX_LENGTH,
): string {
    if (value === null) {
        return 'null'
    }
    if (value === undefined) {
        return 'undefined'
    }

    let str: string
    if (typeof value === 'string') {
        str = value
    } else if (typeof value === 'object') {
        try {
            str = JSON.stringify(value, null, 2)
        } catch {
            str = String(value)
        }
    } else {
        str = String(value)
    }

    if (str.length > maxLength) {
        return str.slice(0, maxLength) + '...'
    }
    return str
}

/**
 * Получить краткую сводку о значении output.
 *
 * Правила:
 * - object (не массив) → "Object (N keys)"
 * - array → "Array (N items)"
 * - string → "String (N chars)"
 * - number → "Number"
 * - boolean → "Boolean"
 * - null → "null"
 * - undefined → "undefined"
 *
 * @param value - значение для анализа
 * @returns строка-сводка
 */
export function getOutputPreviewSummary(value: unknown): string {
    if (value === null) {
        return 'null'
    }
    if (value === undefined) {
        return 'undefined'
    }
    if (Array.isArray(value)) {
        return `Array (${value.length} items)`
    }
    if (typeof value === 'object') {
        const keys = Object.keys(value as Record<string, unknown>)
        return `Object (${keys.length} keys)`
    }
    if (typeof value === 'string') {
        return `String (${value.length} chars)`
    }
    if (typeof value === 'number') {
        return 'Number'
    }
    if (typeof value === 'boolean') {
        return 'Boolean'
    }
    return typeof value
}
