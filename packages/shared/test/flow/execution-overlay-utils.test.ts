import { describe, it, expect } from 'vitest'
import { FlowActionType, FlowRunStatus, StepOutputStatus } from '../../src'
import {
    NodeExecutionVisualStatus,
    NODE_EXECUTION_CSS_CLASSES,
    NODE_EXECUTION_STATUS_ATTR,
    stepOutputStatusToVisual,
    getNodeVisualStatus,
    computeAllNodeVisualStatuses,
    getExecutionOverlayCssClass,
} from '../../src/lib/automation/flows/util/execution-overlay-utils'
import { GenericStepOutput, StepOutput } from '../../src/lib/automation/flow-run/execution/step-output'

// === Вспомогательные функции для создания StepOutput ===

function createStepOutput(status: StepOutputStatus): StepOutput {
    return GenericStepOutput.create({
        type: FlowActionType.CODE,
        status,
        input: {},
        output: { result: 'test' },
    })
}

// === Тесты NodeExecutionVisualStatus enum ===

describe('NodeExecutionVisualStatus', () => {
    it('содержит все 5 визуальных состояний', () => {
        expect(NodeExecutionVisualStatus.IDLE).toBe('idle')
        expect(NodeExecutionVisualStatus.RUNNING).toBe('running')
        expect(NodeExecutionVisualStatus.SUCCESS).toBe('success')
        expect(NodeExecutionVisualStatus.ERROR).toBe('error')
        expect(NodeExecutionVisualStatus.SKIPPED).toBe('skipped')
    })
})

// === Тесты NODE_EXECUTION_CSS_CLASSES ===

describe('NODE_EXECUTION_CSS_CLASSES', () => {
    it('IDLE имеет пустой CSS-класс', () => {
        expect(NODE_EXECUTION_CSS_CLASSES[NodeExecutionVisualStatus.IDLE]).toBe('')
    })

    it('RUNNING содержит border-warning', () => {
        expect(NODE_EXECUTION_CSS_CLASSES[NodeExecutionVisualStatus.RUNNING]).toContain('border-warning')
    })

    it('SUCCESS содержит border-success', () => {
        expect(NODE_EXECUTION_CSS_CLASSES[NodeExecutionVisualStatus.SUCCESS]).toContain('border-success')
    })

    it('ERROR содержит border-destructive', () => {
        expect(NODE_EXECUTION_CSS_CLASSES[NodeExecutionVisualStatus.ERROR]).toContain('border-destructive')
    })

    it('SKIPPED содержит opacity-50', () => {
        expect(NODE_EXECUTION_CSS_CLASSES[NodeExecutionVisualStatus.SKIPPED]).toContain('opacity-50')
    })

    it('все 5 статусов имеют CSS-класс (или пустой)', () => {
        const statuses = Object.values(NodeExecutionVisualStatus)
        expect(statuses).toHaveLength(5)
        for (const status of statuses) {
            expect(NODE_EXECUTION_CSS_CLASSES[status]).toBeDefined()
        }
    })
})

// === Тесты NODE_EXECUTION_STATUS_ATTR ===

describe('NODE_EXECUTION_STATUS_ATTR', () => {
    it('возвращает data-execution-status', () => {
        expect(NODE_EXECUTION_STATUS_ATTR).toBe('data-execution-status')
    })
})

// === Тесты stepOutputStatusToVisual ===

describe('stepOutputStatusToVisual', () => {
    it('RUNNING → RUNNING', () => {
        expect(stepOutputStatusToVisual(StepOutputStatus.RUNNING)).toBe(NodeExecutionVisualStatus.RUNNING)
    })

    it('SUCCEEDED → SUCCESS', () => {
        expect(stepOutputStatusToVisual(StepOutputStatus.SUCCEEDED)).toBe(NodeExecutionVisualStatus.SUCCESS)
    })

    it('STOPPED → SUCCESS', () => {
        expect(stepOutputStatusToVisual(StepOutputStatus.STOPPED)).toBe(NodeExecutionVisualStatus.SUCCESS)
    })

    it('FAILED → ERROR', () => {
        expect(stepOutputStatusToVisual(StepOutputStatus.FAILED)).toBe(NodeExecutionVisualStatus.ERROR)
    })

    it('PAUSED → RUNNING (визуально аналогичен)', () => {
        expect(stepOutputStatusToVisual(StepOutputStatus.PAUSED)).toBe(NodeExecutionVisualStatus.RUNNING)
    })
})

// === Тесты getNodeVisualStatus ===

describe('getNodeVisualStatus', () => {
    it('null runSteps → IDLE', () => {
        expect(getNodeVisualStatus('step_1', null, FlowRunStatus.RUNNING)).toBe(NodeExecutionVisualStatus.IDLE)
    })

    it('undefined runSteps → IDLE', () => {
        expect(getNodeVisualStatus('step_1', undefined, FlowRunStatus.RUNNING)).toBe(NodeExecutionVisualStatus.IDLE)
    })

    it('null runStatus → IDLE', () => {
        expect(getNodeVisualStatus('step_1', {}, null)).toBe(NodeExecutionVisualStatus.IDLE)
    })

    it('undefined runStatus → IDLE', () => {
        expect(getNodeVisualStatus('step_1', {}, undefined)).toBe(NodeExecutionVisualStatus.IDLE)
    })

    it('step с RUNNING output → RUNNING', () => {
        const steps = { step_1: createStepOutput(StepOutputStatus.RUNNING) }
        expect(getNodeVisualStatus('step_1', steps, FlowRunStatus.RUNNING)).toBe(NodeExecutionVisualStatus.RUNNING)
    })

    it('step с SUCCEEDED output → SUCCESS', () => {
        const steps = { step_1: createStepOutput(StepOutputStatus.SUCCEEDED) }
        expect(getNodeVisualStatus('step_1', steps, FlowRunStatus.RUNNING)).toBe(NodeExecutionVisualStatus.SUCCESS)
    })

    it('step с FAILED output → ERROR', () => {
        const steps = { step_1: createStepOutput(StepOutputStatus.FAILED) }
        expect(getNodeVisualStatus('step_1', steps, FlowRunStatus.FAILED)).toBe(NodeExecutionVisualStatus.ERROR)
    })

    it('step без output + RUNNING flow → IDLE (ещё не дошла очередь)', () => {
        const steps = { other_step: createStepOutput(StepOutputStatus.SUCCEEDED) }
        expect(getNodeVisualStatus('step_1', steps, FlowRunStatus.RUNNING)).toBe(NodeExecutionVisualStatus.IDLE)
    })

    it('step без output + SUCCEEDED flow → SKIPPED', () => {
        const steps = { other_step: createStepOutput(StepOutputStatus.SUCCEEDED) }
        expect(getNodeVisualStatus('step_1', steps, FlowRunStatus.SUCCEEDED)).toBe(NodeExecutionVisualStatus.SKIPPED)
    })

    it('step без output + FAILED flow → SKIPPED', () => {
        const steps = { other_step: createStepOutput(StepOutputStatus.SUCCEEDED) }
        expect(getNodeVisualStatus('step_1', steps, FlowRunStatus.FAILED)).toBe(NodeExecutionVisualStatus.SKIPPED)
    })

    it('step без output + TIMEOUT flow → SKIPPED', () => {
        const steps = { other_step: createStepOutput(StepOutputStatus.SUCCEEDED) }
        expect(getNodeVisualStatus('step_1', steps, FlowRunStatus.TIMEOUT)).toBe(NodeExecutionVisualStatus.SKIPPED)
    })

    it('step без output + CANCELED flow → SKIPPED', () => {
        const steps = {}
        expect(getNodeVisualStatus('step_1', steps, FlowRunStatus.CANCELED)).toBe(NodeExecutionVisualStatus.SKIPPED)
    })

    it('step без output + PAUSED flow → IDLE (поток не завершён)', () => {
        const steps = {}
        expect(getNodeVisualStatus('step_1', steps, FlowRunStatus.PAUSED)).toBe(NodeExecutionVisualStatus.IDLE)
    })

    it('step без output + QUEUED flow → IDLE', () => {
        const steps = {}
        expect(getNodeVisualStatus('step_1', steps, FlowRunStatus.QUEUED)).toBe(NodeExecutionVisualStatus.IDLE)
    })
})

// === Тесты computeAllNodeVisualStatuses ===

describe('computeAllNodeVisualStatuses', () => {
    it('пустой массив stepNames → пустой результат', () => {
        const result = computeAllNodeVisualStatuses([], {}, FlowRunStatus.RUNNING)
        expect(result).toEqual({})
    })

    it('вычисляет статусы для нескольких нод', () => {
        const steps = {
            trigger: createStepOutput(StepOutputStatus.SUCCEEDED),
            step_1: createStepOutput(StepOutputStatus.SUCCEEDED),
            step_2: createStepOutput(StepOutputStatus.RUNNING),
        }
        const result = computeAllNodeVisualStatuses(
            ['trigger', 'step_1', 'step_2', 'step_3'],
            steps,
            FlowRunStatus.RUNNING,
        )
        expect(result.trigger).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.step_1).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.step_2).toBe(NodeExecutionVisualStatus.RUNNING)
        expect(result.step_3).toBe(NodeExecutionVisualStatus.IDLE)
    })

    it('завершённый flow → нноды без output = SKIPPED', () => {
        const steps = {
            trigger: createStepOutput(StepOutputStatus.SUCCEEDED),
            step_1: createStepOutput(StepOutputStatus.FAILED),
        }
        const result = computeAllNodeVisualStatuses(
            ['trigger', 'step_1', 'step_2'],
            steps,
            FlowRunStatus.FAILED,
        )
        expect(result.trigger).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.step_1).toBe(NodeExecutionVisualStatus.ERROR)
        expect(result.step_2).toBe(NodeExecutionVisualStatus.SKIPPED)
    })

    it('null runSteps → все IDLE', () => {
        const result = computeAllNodeVisualStatuses(
            ['trigger', 'step_1'],
            null,
            null,
        )
        expect(result.trigger).toBe(NodeExecutionVisualStatus.IDLE)
        expect(result.step_1).toBe(NodeExecutionVisualStatus.IDLE)
    })
})

// === Тесты getExecutionOverlayCssClass ===

describe('getExecutionOverlayCssClass', () => {
    it('IDLE → пустая строка', () => {
        expect(getExecutionOverlayCssClass(NodeExecutionVisualStatus.IDLE)).toBe('')
    })

    it('RUNNING → содержит ring-2', () => {
        const cls = getExecutionOverlayCssClass(NodeExecutionVisualStatus.RUNNING)
        expect(cls).toContain('ring-2')
        expect(cls).toContain('border-warning')
    })

    it('SUCCESS → содержит ring-2 и border-success', () => {
        const cls = getExecutionOverlayCssClass(NodeExecutionVisualStatus.SUCCESS)
        expect(cls).toContain('ring-2')
        expect(cls).toContain('border-success')
    })

    it('ERROR → содержит ring-2 и border-destructive', () => {
        const cls = getExecutionOverlayCssClass(NodeExecutionVisualStatus.ERROR)
        expect(cls).toContain('ring-2')
        expect(cls).toContain('border-destructive')
    })

    it('SKIPPED → содержит opacity-50', () => {
        const cls = getExecutionOverlayCssClass(NodeExecutionVisualStatus.SKIPPED)
        expect(cls).toContain('opacity-50')
    })
})

// === Интеграционный тест: полный сценарий потока ===

describe('Integration: полный сценарий потока S1 (trigger → fetch → parse → transform → router → store/log)', () => {
    it('running flow: первые шаги выполнены, текущий шаг running, последующие idle', () => {
        const steps = {
            trigger: createStepOutput(StepOutputStatus.SUCCEEDED),
            s1_fetch_data: createStepOutput(StepOutputStatus.SUCCEEDED),
            s1_parse: createStepOutput(StepOutputStatus.RUNNING),
        }
        const allNodes = ['trigger', 's1_fetch_data', 's1_parse', 's1_transform', 's1_router', 's1_store_result', 's1_log_empty']
        const result = computeAllNodeVisualStatuses(allNodes, steps, FlowRunStatus.RUNNING)

        expect(result.trigger).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.s1_fetch_data).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.s1_parse).toBe(NodeExecutionVisualStatus.RUNNING)
        expect(result.s1_transform).toBe(NodeExecutionVisualStatus.IDLE)
        expect(result.s1_router).toBe(NodeExecutionVisualStatus.IDLE)
        expect(result.s1_store_result).toBe(NodeExecutionVisualStatus.IDLE)
        expect(result.s1_log_empty).toBe(NodeExecutionVisualStatus.IDLE)
    })

    it('failed flow: router ветка не выполнена → SKIPPED', () => {
        const steps = {
            trigger: createStepOutput(StepOutputStatus.SUCCEEDED),
            s1_fetch_data: createStepOutput(StepOutputStatus.SUCCEEDED),
            s1_parse: createStepOutput(StepOutputStatus.SUCCEEDED),
            s1_transform: createStepOutput(StepOutputStatus.FAILED),
        }
        const allNodes = ['trigger', 's1_fetch_data', 's1_parse', 's1_transform', 's1_router', 's1_store_result', 's1_log_empty']
        const result = computeAllNodeVisualStatuses(allNodes, steps, FlowRunStatus.FAILED)

        expect(result.trigger).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.s1_fetch_data).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.s1_parse).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.s1_transform).toBe(NodeExecutionVisualStatus.ERROR)
        expect(result.s1_router).toBe(NodeExecutionVisualStatus.SKIPPED)
        expect(result.s1_store_result).toBe(NodeExecutionVisualStatus.SKIPPED)
        expect(result.s1_log_empty).toBe(NodeExecutionVisualStatus.SKIPPED)
    })

    it('succeeded flow: все шаги success, неактивная ветка skipped', () => {
        const steps = {
            trigger: createStepOutput(StepOutputStatus.SUCCEEDED),
            s1_fetch_data: createStepOutput(StepOutputStatus.SUCCEEDED),
            s1_parse: createStepOutput(StepOutputStatus.SUCCEEDED),
            s1_transform: createStepOutput(StepOutputStatus.SUCCEEDED),
            s1_router: createStepOutput(StepOutputStatus.SUCCEEDED),
            s1_store_result: createStepOutput(StepOutputStatus.SUCCEEDED),
        }
        const allNodes = ['trigger', 's1_fetch_data', 's1_parse', 's1_transform', 's1_router', 's1_store_result', 's1_log_empty']
        const result = computeAllNodeVisualStatuses(allNodes, steps, FlowRunStatus.SUCCEEDED)

        expect(result.trigger).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.s1_fetch_data).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.s1_parse).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.s1_transform).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.s1_router).toBe(NodeExecutionVisualStatus.SUCCESS)
        expect(result.s1_store_result).toBe(NodeExecutionVisualStatus.SUCCESS)
        // s1_log_empty не выполнен (fallback ветка) → SKIPPED
        expect(result.s1_log_empty).toBe(NodeExecutionVisualStatus.SKIPPED)
    })
})
