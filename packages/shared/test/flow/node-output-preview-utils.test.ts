import { describe, it, expect } from 'vitest'
import { FlowActionType, StepOutputStatus } from '../../src'
import {
    NodeOutputPreviewData,
    extractNodeOutputPreview,
    hasNodeExecutionData,
    formatOutputPreviewValue,
    getOutputPreviewSummary,
} from '../../src/lib/automation/flows/util/node-output-preview-utils'
import { GenericStepOutput, StepOutput } from '../../src/lib/automation/flow-run/execution/step-output'

// === Вспомогательные функции для создания StepOutput ===

function createStepOutput(
    status: StepOutputStatus,
    overrides: { input?: unknown, output?: unknown, duration?: number, errorMessage?: unknown } = {},
): StepOutput {
    const step = GenericStepOutput.create({
        type: FlowActionType.CODE,
        status,
        input: overrides.input ?? { key: 'value' },
        output: overrides.output ?? { result: 'test' },
    })
    if (overrides.duration !== undefined) {
        return step.setDuration(overrides.duration)
    }
    if (overrides.errorMessage !== undefined) {
        return step.setErrorMessage(overrides.errorMessage).setDuration(overrides.duration ?? 0)
    }
    return step
}

// === Тесты NodeOutputPreviewData (тип) ===

describe('NodeOutputPreviewData', () => {
    it('структура типа содержит все обязательные поля', () => {
        const preview: NodeOutputPreviewData = {
            stepName: 'step_1',
            input: { key: 'value' },
            output: { result: 'test' },
            status: StepOutputStatus.SUCCEEDED,
            duration: 150,
            errorMessage: null,
        }
        expect(preview.stepName).toBe('step_1')
        expect(preview.input).toEqual({ key: 'value' })
        expect(preview.output).toEqual({ result: 'test' })
        expect(preview.status).toBe(StepOutputStatus.SUCCEEDED)
        expect(preview.duration).toBe(150)
        expect(preview.errorMessage).toBeNull()
    })
})

// === Тесты extractNodeOutputPreview ===

describe('extractNodeOutputPreview', () => {
    it('нода существует → возвращает preview со всеми полями', () => {
        const steps: Record<string, StepOutput> = {
            step_1: createStepOutput(StepOutputStatus.SUCCEEDED, {
                input: { a: 1 },
                output: { b: 2 },
                duration: 250,
            }),
        }
        const result = extractNodeOutputPreview('step_1', steps)
        expect(result).not.toBeNull()
        expect(result!.stepName).toBe('step_1')
        expect(result!.input).toEqual({ a: 1 })
        expect(result!.output).toEqual({ b: 2 })
        expect(result!.status).toBe(StepOutputStatus.SUCCEEDED)
        expect(result!.duration).toBe(250)
        expect(result!.errorMessage).toBeNull()
    })

    it('нода не существует → null', () => {
        const steps: Record<string, StepOutput> = {
            other_step: createStepOutput(StepOutputStatus.SUCCEEDED),
        }
        const result = extractNodeOutputPreview('step_1', steps)
        expect(result).toBeNull()
    })

    it('null runSteps → null', () => {
        const result = extractNodeOutputPreview('step_1', null)
        expect(result).toBeNull()
    })

    it('undefined runSteps → null', () => {
        const result = extractNodeOutputPreview('step_1', undefined)
        expect(result).toBeNull()
    })

    it('нода с ошибкой → errorMessage заполнен', () => {
        const failedStep = GenericStepOutput.create({
            type: FlowActionType.CODE,
            status: StepOutputStatus.FAILED,
            input: { x: 1 },
        }).setErrorMessage('Something went wrong').setDuration(100)

        const steps: Record<string, StepOutput> = {
            step_err: failedStep,
        }
        const result = extractNodeOutputPreview('step_err', steps)
        expect(result).not.toBeNull()
        expect(result!.status).toBe(StepOutputStatus.FAILED)
        expect(result!.errorMessage).toBe('Something went wrong')
        expect(result!.duration).toBe(100)
    })

    it('нода RUNNING → status RUNNING, output может быть null', () => {
        const runningStep = GenericStepOutput.create({
            type: FlowActionType.CODE,
            status: StepOutputStatus.RUNNING,
            input: { q: 'test' },
        })
        const steps: Record<string, StepOutput> = {
            step_run: runningStep,
        }
        const result = extractNodeOutputPreview('step_run', steps)
        expect(result).not.toBeNull()
        expect(result!.status).toBe(StepOutputStatus.RUNNING)
        expect(result!.output).toBeNull()
        expect(result!.duration).toBe(0)
    })

    it('нода без input → input = null', () => {
        const step = GenericStepOutput.create({
            type: FlowActionType.CODE,
            status: StepOutputStatus.SUCCEEDED,
            input: undefined,
            output: { data: 1 },
        })
        const steps: Record<string, StepOutput> = { step_no_input: step }
        const result = extractNodeOutputPreview('step_no_input', steps)
        expect(result).not.toBeNull()
        expect(result!.input).toBeNull()
    })

    it('пустой record runSteps → null для любого stepName', () => {
        const result = extractNodeOutputPreview('step_1', {})
        expect(result).toBeNull()
    })
})

// === Тесты hasNodeExecutionData ===

describe('hasNodeExecutionData', () => {
    it('нода с output → true', () => {
        const steps: Record<string, StepOutput> = {
            step_1: createStepOutput(StepOutputStatus.SUCCEEDED),
        }
        expect(hasNodeExecutionData('step_1', steps)).toBe(true)
    })

    it('нода без output → false', () => {
        const steps: Record<string, StepOutput> = {
            other_step: createStepOutput(StepOutputStatus.SUCCEEDED),
        }
        expect(hasNodeExecutionData('step_1', steps)).toBe(false)
    })

    it('null runSteps → false', () => {
        expect(hasNodeExecutionData('step_1', null)).toBe(false)
    })

    it('undefined runSteps → false', () => {
        expect(hasNodeExecutionData('step_1', undefined)).toBe(false)
    })

    it('пустой record → false', () => {
        expect(hasNodeExecutionData('step_1', {})).toBe(false)
    })

    it('нода RUNNING (без output) всё равно имеет execution data → true', () => {
        const steps: Record<string, StepOutput> = {
            step_run: GenericStepOutput.create({
                type: FlowActionType.CODE,
                status: StepOutputStatus.RUNNING,
                input: {},
            }),
        }
        expect(hasNodeExecutionData('step_run', steps)).toBe(true)
    })
})

// === Тесты formatOutputPreviewValue ===

describe('formatOutputPreviewValue', () => {
    it('строка короче maxLength → без изменений', () => {
        expect(formatOutputPreviewValue('hello', 100)).toBe('hello')
    })

    it('строка длиннее maxLength → truncated с "..."', () => {
        const longStr = 'a'.repeat(200)
        const result = formatOutputPreviewValue(longStr, 50)
        expect(result).toBe('a'.repeat(50) + '...')
        expect(result.length).toBe(53)
    })

    it('объект → JSON stringify + truncate', () => {
        const obj = { key: 'value', nested: { a: 1 } }
        const result = formatOutputPreviewValue(obj, 1000)
        expect(result).toContain('"key"')
        expect(result).toContain('"value"')
    })

    it('большой объект → JSON stringify + truncated', () => {
        const obj: Record<string, string> = {}
        for (let i = 0; i < 100; i++) {
            obj[`key_${i}`] = 'x'.repeat(50)
        }
        const result = formatOutputPreviewValue(obj, 100)
        expect(result.length).toBe(103) // 100 + "..."
        expect(result.endsWith('...')).toBe(true)
    })

    it('null → "null"', () => {
        expect(formatOutputPreviewValue(null)).toBe('null')
    })

    it('undefined → "undefined"', () => {
        expect(formatOutputPreviewValue(undefined)).toBe('undefined')
    })

    it('число → String(число)', () => {
        expect(formatOutputPreviewValue(42)).toBe('42')
    })

    it('boolean → String(boolean)', () => {
        expect(formatOutputPreviewValue(true)).toBe('true')
    })

    it('массив → JSON stringify', () => {
        const arr = [1, 2, 3]
        const result = formatOutputPreviewValue(arr, 1000)
        expect(result).toContain('1')
        expect(result).toContain('2')
        expect(result).toContain('3')
    })

    it('maxLength по умолчанию = 500', () => {
        const longStr = 'b'.repeat(600)
        const result = formatOutputPreviewValue(longStr)
        expect(result.length).toBe(503) // 500 + "..."
    })

    it('строка ровно maxLength → без truncation', () => {
        const str = 'c'.repeat(100)
        expect(formatOutputPreviewValue(str, 100)).toBe(str)
    })
})

// === Тесты getOutputPreviewSummary ===

describe('getOutputPreviewSummary', () => {
    it('объект с N ключами → "Object (N keys)"', () => {
        expect(getOutputPreviewSummary({ a: 1, b: 2, c: 3 })).toBe('Object (3 keys)')
    })

    it('пустой объект → "Object (0 keys)"', () => {
        expect(getOutputPreviewSummary({})).toBe('Object (0 keys)')
    })

    it('массив с N элементами → "Array (N items)"', () => {
        expect(getOutputPreviewSummary([1, 2, 3, 4])).toBe('Array (4 items)')
    })

    it('пустой массив → "Array (0 items)"', () => {
        expect(getOutputPreviewSummary([])).toBe('Array (0 items)')
    })

    it('строка → "String (N chars)"', () => {
        expect(getOutputPreviewSummary('hello')).toBe('String (5 chars)')
    })

    it('пустая строка → "String (0 chars)"', () => {
        expect(getOutputPreviewSummary('')).toBe('String (0 chars)')
    })

    it('число → "Number"', () => {
        expect(getOutputPreviewSummary(42)).toBe('Number')
    })

    it('boolean → "Boolean"', () => {
        expect(getOutputPreviewSummary(true)).toBe('Boolean')
    })

    it('null → "null"', () => {
        expect(getOutputPreviewSummary(null)).toBe('null')
    })

    it('undefined → "undefined"', () => {
        expect(getOutputPreviewSummary(undefined)).toBe('undefined')
    })
})

// === Интеграционный тест: полный поток из StepOutput → extractNodeOutputPreview → formatOutputPreviewValue ===

describe('Integration: полный поток StepOutput → extractNodeOutputPreview → format + summary', () => {
    it('извлекает preview, форматирует output и summary', () => {
        const steps: Record<string, StepOutput> = {
            trigger: createStepOutput(StepOutputStatus.SUCCEEDED, {
                input: { triggerData: 'webhook' },
                output: { items: [1, 2, 3], metadata: { source: 'api' } },
                duration: 50,
            }),
            step_process: createStepOutput(StepOutputStatus.SUCCEEDED, {
                input: { raw: 'data' },
                output: { processed: true, count: 42 },
                duration: 300,
            }),
            step_failed: GenericStepOutput.create({
                type: FlowActionType.CODE,
                status: StepOutputStatus.FAILED,
                input: { query: 'SELECT *' },
            }).setErrorMessage('Connection timeout').setDuration(5000),
        }

        // Извлечение trigger
        const triggerPreview = extractNodeOutputPreview('trigger', steps)
        expect(triggerPreview).not.toBeNull()
        expect(triggerPreview!.status).toBe(StepOutputStatus.SUCCEEDED)

        // Форматирование output trigger
        const formattedOutput = formatOutputPreviewValue(triggerPreview!.output, 100)
        expect(formattedOutput).toContain('items')

        // Summary output trigger
        const summary = getOutputPreviewSummary(triggerPreview!.output)
        expect(summary).toBe('Object (2 keys)')

        // Step process
        const processPreview = extractNodeOutputPreview('step_process', steps)
        expect(processPreview).not.toBeNull()
        expect(processPreview!.duration).toBe(300)

        // Step failed
        const failedPreview = extractNodeOutputPreview('step_failed', steps)
        expect(failedPreview).not.toBeNull()
        expect(failedPreview!.status).toBe(StepOutputStatus.FAILED)
        expect(failedPreview!.errorMessage).toBe('Connection timeout')
        expect(failedPreview!.duration).toBe(5000)

        // hasNodeExecutionData
        expect(hasNodeExecutionData('trigger', steps)).toBe(true)
        expect(hasNodeExecutionData('step_process', steps)).toBe(true)
        expect(hasNodeExecutionData('step_failed', steps)).toBe(true)
        expect(hasNodeExecutionData('step_nonexistent', steps)).toBe(false)
    })

    it('нода без output: extractNodeOutputPreview → null, hasNodeExecutionData → false', () => {
        const steps: Record<string, StepOutput> = {
            trigger: createStepOutput(StepOutputStatus.SUCCEEDED),
        }
        expect(extractNodeOutputPreview('missing_step', steps)).toBeNull()
        expect(hasNodeExecutionData('missing_step', steps)).toBe(false)
    })
})
