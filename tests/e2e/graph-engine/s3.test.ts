/**
 * E2E тесты сценария S3: Scheduled Sync + Loop.
 *
 * Проверяют полное исполнение потока через graph engine:
 * trigger -> s3_get_items -> LOOP(s3_loop, loop-output -> s3_transform_item -> s3_store_item) -> s3_write_summary
 *
 * Топология: линейная цепочка CODE нод + LOOP_ON_ITEMS с телом из двух CODE нод + CODE нода после цикла.
 * Golden fixture: tests/e2e/graph-engine/fixtures/s3-scheduled-sync-loop.json
 * CODE index.js: packages/server/engine/test/resources/codes/flowVersionId/s3_{step}/index.js
 *
 * 15 assertions по PHASE2_ARCHITECTURE.md §5 S3 (адаптированы для CODE нод).
 *
 * Запуск: npx vitest run tests/e2e/graph-engine/s3.test.ts --config tests/e2e/graph-engine/vitest.config.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { FlowRunStatus } from '@activepieces/shared'
import { FlowTestClient, FlowExecutionResult } from './setup'
import { loadFixture, FixtureData } from './helpers'
import s3Fixture from './fixtures/s3-scheduled-sync-loop.json'

describe('S3: Scheduled Sync + Loop — E2E исполнение', () => {
    let client: FlowTestClient
    let result: FlowExecutionResult
    let fixture: FixtureData

    beforeAll(async () => {
        fixture = loadFixture(s3Fixture)
        client = FlowTestClient.create()
        result = await client.executeFromFixture(s3Fixture)
    })

    afterAll(() => {
        client.cleanup()
    })

    // --- 1. Schedule trigger выполнен (payload содержит schedule) ------

    it('[A01] trigger payload содержит поле schedule (schedule trigger)', () => {
        const triggerInput = fixture.triggerInput as { schedule: string }
        expect(triggerInput.schedule).toBe('0 */6 * * *')
    })

    // --- 2-3. s3_get_items: CODE -> массив из 3 items -------------------

    it('[A02] s3_get_items выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s3_get_items')).toBe('SUCCEEDED')
    })

    it('[A03] s3_get_items output содержит массив items длиной 3', () => {
        const output = result.getStepOutput('s3_get_items') as {
            items: Array<{ id: string; value: number }>
            count: number
        }
        expect(Array.isArray(output.items)).toBe(true)
        expect(output.items).toHaveLength(3)
    })

    // --- 4. Loop выполнил 3 итерации ------------------------------------

    it('[A04] s3_loop выполнен успешно и содержит 3 итерации', () => {
        expect(result.getStepStatus('s3_loop')).toBe('SUCCEEDED')
        const loopOutput = result.getStepOutput('s3_loop') as {
            iterations: unknown[]
            index: number
            item: unknown
        }
        expect(loopOutput.iterations).toHaveLength(3)
    })

    // --- 5-7. Loop итерации обработали item-1, item-2, item-3 ----------

    it('[A05] итерация 0 содержит результат s3_transform_item для item-1', () => {
        const loopOutput = result.getStepOutput('s3_loop') as {
            iterations: Array<Record<string, { output: unknown }>>
        }
        const iter0 = loopOutput.iterations[0]
        expect(iter0.s3_transform_item).toBeDefined()
        const transformOutput = iter0.s3_transform_item.output as { id: string; processed: boolean }
        expect(transformOutput.id).toBe('item-1')
    })

    it('[A06] итерация 1 содержит результат s3_transform_item для item-2', () => {
        const loopOutput = result.getStepOutput('s3_loop') as {
            iterations: Array<Record<string, { output: unknown }>>
        }
        const iter1 = loopOutput.iterations[1]
        expect(iter1.s3_transform_item).toBeDefined()
        const transformOutput = iter1.s3_transform_item.output as { id: string; processed: boolean }
        expect(transformOutput.id).toBe('item-2')
    })

    it('[A07] итерация 2 содержит результат s3_transform_item для item-3', () => {
        const loopOutput = result.getStepOutput('s3_loop') as {
            iterations: Array<Record<string, { output: unknown }>>
        }
        const iter2 = loopOutput.iterations[2]
        expect(iter2.s3_transform_item).toBeDefined()
        const transformOutput = iter2.s3_transform_item.output as { id: string; processed: boolean }
        expect(transformOutput.id).toBe('item-3')
    })

    // --- 8. CODE в loop добавляет processed=true ------------------------

    it('[A08] s3_transform_item в каждой итерации добавляет processed=true', () => {
        const loopOutput = result.getStepOutput('s3_loop') as {
            iterations: Array<Record<string, { output: unknown }>>
        }
        for (let i = 0; i < 3; i++) {
            const transformOutput = loopOutput.iterations[i].s3_transform_item.output as { processed: boolean }
            expect(transformOutput.processed, `итерация ${i}: processed должен быть true`).toBe(true)
        }
    })

    // --- 9-11. Store содержит ключи item-1, item-2, item-3 --------------

    it('[A09] s3_store_item в итерации 0 сохранил item-1', () => {
        const loopOutput = result.getStepOutput('s3_loop') as {
            iterations: Array<Record<string, { output: unknown }>>
        }
        const storeOutput = loopOutput.iterations[0].s3_store_item.output as { stored: boolean; id: string }
        expect(storeOutput.stored).toBe(true)
        expect(storeOutput.id).toBe('item-1')
    })

    it('[A10] s3_store_item в итерации 1 сохранил item-2', () => {
        const loopOutput = result.getStepOutput('s3_loop') as {
            iterations: Array<Record<string, { output: unknown }>>
        }
        const storeOutput = loopOutput.iterations[1].s3_store_item.output as { stored: boolean; id: string }
        expect(storeOutput.stored).toBe(true)
        expect(storeOutput.id).toBe('item-2')
    })

    it('[A11] s3_store_item в итерации 2 сохранил item-3', () => {
        const loopOutput = result.getStepOutput('s3_loop') as {
            iterations: Array<Record<string, { output: unknown }>>
        }
        const storeOutput = loopOutput.iterations[2].s3_store_item.output as { stored: boolean; id: string }
        expect(storeOutput.stored).toBe(true)
        expect(storeOutput.id).toBe('item-3')
    })

    // --- 12. Store value содержит processed=true -------------------------

    it('[A12] s3_store_item output в каждой итерации содержит value из трансформированного item', () => {
        const loopOutput = result.getStepOutput('s3_loop') as {
            iterations: Array<Record<string, { output: unknown }>>
        }
        const values = [10, 20, 30]
        for (let i = 0; i < 3; i++) {
            const storeOutput = loopOutput.iterations[i].s3_store_item.output as { value: number }
            expect(storeOutput.value, `итерация ${i}: value должен быть ${values[i]}`).toBe(values[i])
        }
    })

    // --- 13. s3_write_summary выполнен после loop -----------------------

    it('[A13] s3_write_summary выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s3_write_summary')).toBe('SUCCEEDED')
    })

    // --- 14. s3_write_summary output содержит summary данные -------------

    it('[A14] s3_write_summary output содержит summary с количеством обработанных items', () => {
        const output = result.getStepOutput('s3_write_summary') as {
            summary: string
            totalItems: number
        }
        expect(output.summary).toBe('Processed 3 items')
        expect(output.totalItems).toBe(3)
    })

    // --- 15. Общий статус потока ----------------------------------------

    it('[A15] общий статус потока === RUNNING (engine-level)', () => {
        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
    })
})
