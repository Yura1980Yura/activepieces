/**
 * E2E тесты сценария S1: Multi-Source ETL.
 *
 * Проверяют полное исполнение потока через graph engine:
 * trigger -> s1_fetch_data -> s1_parse -> s1_transform -> ROUTER(if records>0) -> s1_store_result / s1_log_empty
 *
 * Топология: линейная цепочка CODE нод + ROUTER с двумя ветками.
 * Golden fixture: tests/e2e/graph-engine/fixtures/s1-multi-source-etl.json
 * CODE index.js: packages/server/engine/test/resources/codes/flowVersionId/s1_{step}/index.js
 *
 * 18 assertions по PHASE2_ARCHITECTURE.md §5 S1 (адаптированы для CODE нод).
 *
 * Запуск: npx vitest run tests/e2e/graph-engine/s1.test.ts --config tests/e2e/graph-engine/vitest.config.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { FlowRunStatus } from '@activepieces/shared'
import { FlowTestClient, FlowExecutionResult } from './setup'
import { loadFixture, FixtureData } from './helpers'
import s1Fixture from './fixtures/s1-multi-source-etl.json'

describe('S1: Multi-Source ETL — E2E исполнение', () => {
    let client: FlowTestClient
    let result: FlowExecutionResult
    let fixture: FixtureData

    beforeAll(async () => {
        fixture = loadFixture(s1Fixture)
        client = FlowTestClient.create()
        result = await client.executeFromFixture(s1Fixture)
    })

    afterAll(() => {
        client.cleanup()
    })

    // ─── 1. Общий статус потока ──────────────────────────────────────

    it('[A01] общий статус потока === RUNNING (engine-level)', () => {
        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
    })

    // ─── 2-3. s1_fetch_data: HTTP GET → CSV данные ───────────────────

    it('[A02] s1_fetch_data выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s1_fetch_data')).toBe('SUCCEEDED')
    })

    it('[A03] s1_fetch_data output содержит CSV текст и statusCode 200', () => {
        const output = result.getStepOutput('s1_fetch_data') as {
            body: string
            statusCode: number
        }
        expect(output.body).toContain('name,email,age')
        expect(output.statusCode).toBe(200)
    })

    // ─── 4-7. s1_parse: CSV парсинг → массив объектов ────────────────

    it('[A04] s1_parse выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s1_parse')).toBe('SUCCEEDED')
    })

    it('[A05] s1_parse output содержит массив records', () => {
        const output = result.getStepOutput('s1_parse') as {
            records: unknown[]
            count: number
        }
        expect(Array.isArray(output.records)).toBe(true)
    })

    it('[A06] s1_parse output.records имеет длину 3', () => {
        const output = result.getStepOutput('s1_parse') as {
            records: unknown[]
            count: number
        }
        expect(output.records).toHaveLength(3)
        expect(output.count).toBe(3)
    })

    it('[A07] s1_parse output.records[0] содержит корректные поля (name, email, age)', () => {
        const output = result.getStepOutput('s1_parse') as {
            records: Array<{ name: string; email: string; age: string }>
        }
        expect(output.records[0].name).toBe('Alice')
        expect(output.records[0].email).toBe('alice@test.com')
        expect(output.records[0].age).toBe('30')
    })

    // ─── 8-10. s1_transform: добавление processed=true ──────────────

    it('[A08] s1_transform выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s1_transform')).toBe('SUCCEEDED')
    })

    it('[A09] s1_transform output содержит массив с processed=true', () => {
        const output = result.getStepOutput('s1_transform') as {
            records: Array<{ processed: boolean }>
            count: number
        }
        expect(Array.isArray(output.records)).toBe(true)
        expect(output.records[0]).toHaveProperty('processed', true)
    })

    it('[A10] s1_transform output.records имеет длину 3', () => {
        const output = result.getStepOutput('s1_transform') as {
            records: unknown[]
            count: number
        }
        expect(output.records).toHaveLength(3)
        expect(output.count).toBe(3)
    })

    // ─── 11-12. Router: оценка условий ──────────────────────────────

    it('[A11] s1_router выполнен успешно', () => {
        expect(result.getStepStatus('s1_router')).toBe('SUCCEEDED')
    })

    it('[A12] s1_router branch-0 (Has Records) = true, branch-1 (Empty) = false', () => {
        const routerStep = result.steps.s1_router
        const routerOutput = routerStep.output as {
            branches: Array<{
                branchName: string
                branchIndex: number
                evaluation: boolean
            }>
        }
        expect(routerOutput.branches).toHaveLength(2)
        expect(routerOutput.branches[0].branchName).toBe('Has Records')
        expect(routerOutput.branches[0].evaluation).toBe(true)
        expect(routerOutput.branches[1].branchName).toBe('Empty')
        expect(routerOutput.branches[1].evaluation).toBe(false)
    })

    // ─── 13-15. s1_store_result: Store Put ───────────────────────────

    it('[A13] s1_store_result выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s1_store_result')).toBe('SUCCEEDED')
    })

    it('[A14] s1_store_result output содержит key=etl_result', () => {
        const output = result.getStepOutput('s1_store_result') as {
            key: string
            count: number
        }
        expect(output.key).toBe('etl_result')
    })

    it('[A15] s1_store_result output.count === 3', () => {
        const output = result.getStepOutput('s1_store_result') as {
            key: string
            count: number
        }
        expect(output.count).toBe(3)
    })

    // ─── 16. s1_log_empty: НЕ выполнен (fallback не сработал) ───────

    it('[A16] s1_log_empty НЕ выполнен (fallback ветка не активна)', () => {
        const status = result.getStepStatus('s1_log_empty')
        expect(status).toBeUndefined()
    })

    // ─── 17-18. Целостность потока ───────────────────────────────────

    it('[A17] все 5 основных шагов присутствуют в результате', () => {
        const expectedSteps = [
            's1_fetch_data',
            's1_parse',
            's1_transform',
            's1_router',
            's1_store_result',
        ]
        for (const step of expectedSteps) {
            expect(result.steps[step]).toBeDefined()
        }
    })

    it('[A18] все 5 основных шагов завершились со статусом SUCCEEDED', () => {
        const expectedSteps = [
            's1_fetch_data',
            's1_parse',
            's1_transform',
            's1_router',
            's1_store_result',
        ]
        for (const step of expectedSteps) {
            expect(result.getStepStatus(step)).toBe('SUCCEEDED')
        }
    })
})
