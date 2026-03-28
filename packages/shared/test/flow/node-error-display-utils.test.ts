import { describe, it, expect } from 'vitest'
import { FlowActionType, FlowRunStatus, StepOutputStatus } from '../../src'
import {
    NODE_ERROR_ICON_ATTR,
    NODE_ERROR_TOOLTIP_ATTR,
    isNodeInErrorState,
    extractStepErrorMessage,
    getNodeErrorMessage,
    formatErrorForTooltip,
    getNodeErrorDisplayData,
} from '../../src/lib/automation/flows/util/node-error-display-utils'
import { NodeExecutionVisualStatus } from '../../src/lib/automation/flows/util/execution-overlay-utils'
import { GenericStepOutput, StepOutput } from '../../src/lib/automation/flow-run/execution/step-output'

// === Вспомогательные функции ===

function createStepOutput(
    status: StepOutputStatus,
    errorMessage?: unknown,
): StepOutput {
    let step = GenericStepOutput.create({
        type: FlowActionType.CODE,
        status,
        input: {},
        output: { result: 'test' },
    })
    if (errorMessage !== undefined) {
        step = step.setErrorMessage(errorMessage)
    }
    return step
}

// === Тесты data-атрибутов ===

describe('Data атрибуты ошибки', () => {
    it('NODE_ERROR_ICON_ATTR = data-error-icon', () => {
        expect(NODE_ERROR_ICON_ATTR).toBe('data-error-icon')
    })

    it('NODE_ERROR_TOOLTIP_ATTR = data-error-tooltip', () => {
        expect(NODE_ERROR_TOOLTIP_ATTR).toBe('data-error-tooltip')
    })
})

// === Тесты isNodeInErrorState ===

describe('isNodeInErrorState', () => {
    it('ERROR → true', () => {
        expect(isNodeInErrorState(NodeExecutionVisualStatus.ERROR)).toBe(true)
    })

    it('IDLE → false', () => {
        expect(isNodeInErrorState(NodeExecutionVisualStatus.IDLE)).toBe(false)
    })

    it('RUNNING → false', () => {
        expect(isNodeInErrorState(NodeExecutionVisualStatus.RUNNING)).toBe(false)
    })

    it('SUCCESS → false', () => {
        expect(isNodeInErrorState(NodeExecutionVisualStatus.SUCCESS)).toBe(false)
    })

    it('SKIPPED → false', () => {
        expect(isNodeInErrorState(NodeExecutionVisualStatus.SKIPPED)).toBe(false)
    })
})

// === Тесты extractStepErrorMessage ===

describe('extractStepErrorMessage', () => {
    it('null stepOutput → null', () => {
        expect(extractStepErrorMessage(null)).toBeNull()
    })

    it('undefined stepOutput → null', () => {
        expect(extractStepErrorMessage(undefined)).toBeNull()
    })

    it('SUCCEEDED step → null (не ошибка)', () => {
        const step = createStepOutput(StepOutputStatus.SUCCEEDED)
        expect(extractStepErrorMessage(step)).toBeNull()
    })

    it('RUNNING step → null (не ошибка)', () => {
        const step = createStepOutput(StepOutputStatus.RUNNING)
        expect(extractStepErrorMessage(step)).toBeNull()
    })

    it('FAILED step с строковым errorMessage → возвращает строку', () => {
        const step = createStepOutput(StepOutputStatus.FAILED, 'Connection timeout')
        expect(extractStepErrorMessage(step)).toBe('Connection timeout')
    })

    it('FAILED step с объектом errorMessage → JSON.stringify', () => {
        const step = createStepOutput(StepOutputStatus.FAILED, { code: 500, details: 'Internal Server Error' })
        const result = extractStepErrorMessage(step)
        expect(result).toContain('500')
        expect(result).toContain('Internal Server Error')
    })

    it('FAILED step с null errorMessage → fallback "Step failed"', () => {
        const step = createStepOutput(StepOutputStatus.FAILED, null)
        expect(extractStepErrorMessage(step)).toBe('Step failed')
    })

    it('FAILED step без errorMessage → fallback "Step failed"', () => {
        const step = createStepOutput(StepOutputStatus.FAILED)
        expect(extractStepErrorMessage(step)).toBe('Step failed')
    })

    it('FAILED step с пустой строкой errorMessage → fallback "Step failed"', () => {
        const step = createStepOutput(StepOutputStatus.FAILED, '')
        expect(extractStepErrorMessage(step)).toBe('Step failed')
    })

    it('FAILED step с числовым errorMessage → String(число)', () => {
        const step = createStepOutput(StepOutputStatus.FAILED, 404)
        expect(extractStepErrorMessage(step)).toBe('404')
    })

    it('FAILED step с boolean errorMessage → String(boolean)', () => {
        const step = createStepOutput(StepOutputStatus.FAILED, false)
        expect(extractStepErrorMessage(step)).toBe('false')
    })

    it('STOPPED step → null (STOPPED = success)', () => {
        const step = createStepOutput(StepOutputStatus.STOPPED, 'some message')
        expect(extractStepErrorMessage(step)).toBeNull()
    })

    it('PAUSED step → null', () => {
        const step = createStepOutput(StepOutputStatus.PAUSED)
        expect(extractStepErrorMessage(step)).toBeNull()
    })
})

// === Тесты getNodeErrorMessage ===

describe('getNodeErrorMessage', () => {
    it('null runSteps → null', () => {
        expect(getNodeErrorMessage('step_1', null)).toBeNull()
    })

    it('undefined runSteps → null', () => {
        expect(getNodeErrorMessage('step_1', undefined)).toBeNull()
    })

    it('нода не найдена в runSteps → null', () => {
        const steps = { other_step: createStepOutput(StepOutputStatus.SUCCEEDED) }
        expect(getNodeErrorMessage('step_1', steps)).toBeNull()
    })

    it('нода SUCCEEDED → null', () => {
        const steps = { step_1: createStepOutput(StepOutputStatus.SUCCEEDED) }
        expect(getNodeErrorMessage('step_1', steps)).toBeNull()
    })

    it('нода FAILED с сообщением → возвращает сообщение', () => {
        const steps = { step_1: createStepOutput(StepOutputStatus.FAILED, 'Database error') }
        expect(getNodeErrorMessage('step_1', steps)).toBe('Database error')
    })

    it('несколько нод: выбирает правильную', () => {
        const steps = {
            step_1: createStepOutput(StepOutputStatus.SUCCEEDED),
            step_2: createStepOutput(StepOutputStatus.FAILED, 'Timeout'),
            step_3: createStepOutput(StepOutputStatus.RUNNING),
        }
        expect(getNodeErrorMessage('step_2', steps)).toBe('Timeout')
        expect(getNodeErrorMessage('step_1', steps)).toBeNull()
        expect(getNodeErrorMessage('step_3', steps)).toBeNull()
    })
})

// === Тесты formatErrorForTooltip ===

describe('formatErrorForTooltip', () => {
    it('null → пустая строка', () => {
        expect(formatErrorForTooltip(null)).toBe('')
    })

    it('undefined → пустая строка', () => {
        expect(formatErrorForTooltip(undefined)).toBe('')
    })

    it('пустая строка → пустая строка', () => {
        expect(formatErrorForTooltip('')).toBe('')
    })

    it('короткая строка → без изменений', () => {
        expect(formatErrorForTooltip('Error occurred', 200)).toBe('Error occurred')
    })

    it('длинная строка → обрезается + "..."', () => {
        const longMsg = 'x'.repeat(300)
        const result = formatErrorForTooltip(longMsg, 100)
        expect(result).toBe('x'.repeat(100) + '...')
        expect(result.length).toBe(103)
    })

    it('строка с переводами строк → заменяет на пробелы', () => {
        const msg = 'Error\non\nline\n3'
        expect(formatErrorForTooltip(msg, 200)).toBe('Error on line 3')
    })

    it('строка с \\r\\n → заменяет на пробелы', () => {
        const msg = 'Error\r\ndetails\r\nhere'
        expect(formatErrorForTooltip(msg, 200)).toBe('Error details here')
    })

    it('множественные переводы строк → один пробел', () => {
        const msg = 'Error\n\n\ndetails'
        expect(formatErrorForTooltip(msg, 200)).toBe('Error details')
    })

    it('строка с пробелами по краям → trim', () => {
        const msg = '  Error message  '
        expect(formatErrorForTooltip(msg, 200)).toBe('Error message')
    })

    it('maxLength по умолчанию = 200', () => {
        const longMsg = 'a'.repeat(300)
        const result = formatErrorForTooltip(longMsg)
        expect(result).toBe('a'.repeat(200) + '...')
    })

    it('строка ровно maxLength → без truncation', () => {
        const msg = 'b'.repeat(100)
        expect(formatErrorForTooltip(msg, 100)).toBe(msg)
    })
})

// === Тесты getNodeErrorDisplayData ===

describe('getNodeErrorDisplayData', () => {
    it('IDLE статус → isError=false, tooltipText пуст', () => {
        const result = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.IDLE, 'step_1', null,
        )
        expect(result.isError).toBe(false)
        expect(result.tooltipText).toBe('')
    })

    it('SUCCESS статус → isError=false', () => {
        const steps = { step_1: createStepOutput(StepOutputStatus.SUCCEEDED) }
        const result = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.SUCCESS, 'step_1', steps,
        )
        expect(result.isError).toBe(false)
        expect(result.tooltipText).toBe('')
    })

    it('RUNNING статус → isError=false', () => {
        const result = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.RUNNING, 'step_1', null,
        )
        expect(result.isError).toBe(false)
        expect(result.tooltipText).toBe('')
    })

    it('SKIPPED статус → isError=false', () => {
        const result = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.SKIPPED, 'step_1', null,
        )
        expect(result.isError).toBe(false)
        expect(result.tooltipText).toBe('')
    })

    it('ERROR статус с сообщением → isError=true, tooltipText содержит сообщение', () => {
        const steps = { step_1: createStepOutput(StepOutputStatus.FAILED, 'Connection refused') }
        const result = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.ERROR, 'step_1', steps,
        )
        expect(result.isError).toBe(true)
        expect(result.tooltipText).toBe('Connection refused')
    })

    it('ERROR статус без сообщения → isError=true, tooltipText = "Step failed"', () => {
        const steps = { step_1: createStepOutput(StepOutputStatus.FAILED) }
        const result = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.ERROR, 'step_1', steps,
        )
        expect(result.isError).toBe(true)
        expect(result.tooltipText).toBe('Step failed')
    })

    it('ERROR статус с длинным сообщением → truncated tooltip', () => {
        const longMsg = 'Error: ' + 'x'.repeat(300)
        const steps = { step_1: createStepOutput(StepOutputStatus.FAILED, longMsg) }
        const result = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.ERROR, 'step_1', steps, 50,
        )
        expect(result.isError).toBe(true)
        expect(result.tooltipText.length).toBe(53) // 50 + "..."
        expect(result.tooltipText.endsWith('...')).toBe(true)
    })

    it('ERROR статус + нода не найдена в runSteps → isError=true, tooltipText пуст', () => {
        const steps = { other_step: createStepOutput(StepOutputStatus.FAILED, 'Error') }
        const result = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.ERROR, 'step_1', steps,
        )
        expect(result.isError).toBe(true)
        expect(result.tooltipText).toBe('')
    })

    it('ERROR статус + null runSteps → isError=true, tooltipText пуст', () => {
        const result = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.ERROR, 'step_1', null,
        )
        expect(result.isError).toBe(true)
        expect(result.tooltipText).toBe('')
    })
})

// === Интеграционный тест: полный сценарий потока с ошибками ===

describe('Integration: отображение ошибок в потоке из нескольких нод', () => {
    it('поток с одной упавшей нодой: только она показывает ошибку', () => {
        const steps: Record<string, StepOutput> = {
            trigger: createStepOutput(StepOutputStatus.SUCCEEDED),
            step_fetch: createStepOutput(StepOutputStatus.SUCCEEDED),
            step_parse: createStepOutput(StepOutputStatus.FAILED, 'Invalid JSON format'),
        }

        // trigger — SUCCESS, нет ошибки
        const triggerDisplay = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.SUCCESS, 'trigger', steps,
        )
        expect(triggerDisplay.isError).toBe(false)

        // step_fetch — SUCCESS, нет ошибки
        const fetchDisplay = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.SUCCESS, 'step_fetch', steps,
        )
        expect(fetchDisplay.isError).toBe(false)

        // step_parse — ERROR, показывает ошибку
        const parseDisplay = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.ERROR, 'step_parse', steps,
        )
        expect(parseDisplay.isError).toBe(true)
        expect(parseDisplay.tooltipText).toBe('Invalid JSON format')

        // step_transform — SKIPPED, нет ошибки
        const transformDisplay = getNodeErrorDisplayData(
            NodeExecutionVisualStatus.SKIPPED, 'step_transform', steps,
        )
        expect(transformDisplay.isError).toBe(false)
    })

    it('извлечение и форматирование сообщения: объект ошибки', () => {
        const errorObj = { status: 503, message: 'Service Unavailable', retries: 3 }
        const steps: Record<string, StepOutput> = {
            step_http: createStepOutput(StepOutputStatus.FAILED, errorObj),
        }

        const errorMsg = getNodeErrorMessage('step_http', steps)
        expect(errorMsg).not.toBeNull()
        expect(errorMsg).toContain('503')
        expect(errorMsg).toContain('Service Unavailable')

        const tooltip = formatErrorForTooltip(errorMsg, 50)
        expect(tooltip.length).toBeLessThanOrEqual(53)
    })

    it('полная цепочка: extractStepErrorMessage → formatErrorForTooltip', () => {
        const step = createStepOutput(StepOutputStatus.FAILED, 'Timeout\nafter\n30 seconds')
        const raw = extractStepErrorMessage(step)
        expect(raw).toBe('Timeout\nafter\n30 seconds')

        const formatted = formatErrorForTooltip(raw, 200)
        expect(formatted).toBe('Timeout after 30 seconds')
        expect(formatted).not.toContain('\n')
    })
})
