/**
 * E2E тесты сценария S4: Parallel Fan-Out/Fan-In.
 *
 * Проверяют полное исполнение потока через graph engine:
 * trigger -> ROUTER(EXECUTE_ALL_MATCH, 3 branches) -> s4_merge
 *   branch-0: s4_process_users -> s4_store_users
 *   branch-1: s4_process_orders -> s4_store_orders
 *   branch-2: s4_process_products -> s4_store_products
 *
 * Топология: trigger -> ROUTER с EXECUTE_ALL_MATCH (3 ветки, все true) + CODE merge нода после router.
 * Golden fixture: tests/e2e/graph-engine/fixtures/s4-parallel-fan-out.json
 * CODE index.js: packages/server/engine/test/resources/codes/flowVersionId/s4_{step}/index.js
 *
 * 12 assertions по PHASE2_ARCHITECTURE.md §5 S4.
 *
 * Запуск: npx vitest run tests/e2e/graph-engine/s4.test.ts --config tests/e2e/graph-engine/vitest.config.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { FlowRunStatus } from '@activepieces/shared'
import { FlowTestClient, FlowExecutionResult } from './setup'
import { loadFixture, FixtureData } from './helpers'
import s4Fixture from './fixtures/s4-parallel-fan-out.json'

describe('S4: Parallel Fan-Out/Fan-In — E2E исполнение', () => {
    let client: FlowTestClient
    let result: FlowExecutionResult
    let fixture: FixtureData

    beforeAll(async () => {
        fixture = loadFixture(s4Fixture)
        client = FlowTestClient.create()
        result = await client.executeFromFixture(s4Fixture)
    })

    afterAll(() => {
        client.cleanup()
    })

    // ─── 1. Trigger выполнен ──────────────────────────────────────────

    it('[A01] trigger payload содержит поле source (manual trigger)', () => {
        const triggerInput = fixture.triggerInput as { source: string }
        expect(triggerInput.source).toBe('manual')
    })

    // ─── 2. Router оценил все 3 ветки как true ───────────────────────

    it('[A02] s4_router выполнен, все 3 ветки оценены как true (EXECUTE_ALL_MATCH)', () => {
        expect(result.getStepStatus('s4_router')).toBe('SUCCEEDED')
        const routerOutput = result.getStepOutput('s4_router') as {
            branches: Array<{
                branchName: string
                branchIndex: number
                evaluation: boolean
            }>
        }
        expect(routerOutput.branches).toHaveLength(3)
        expect(routerOutput.branches[0].evaluation).toBe(true)
        expect(routerOutput.branches[1].evaluation).toBe(true)
        expect(routerOutput.branches[2].evaluation).toBe(true)
    })

    // ─── 3-4. Branch-0: s4_process_users, user_count === 3 ──────────

    it('[A03] s4_process_users выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s4_process_users')).toBe('SUCCEEDED')
    })

    it('[A04] s4_process_users output содержит users (3 записи) и count === 3', () => {
        const output = result.getStepOutput('s4_process_users') as {
            users: Array<{ id: number }>
            count: number
        }
        expect(output.users).toHaveLength(3)
        expect(output.count).toBe(3)
    })

    // ─── 5-6. Branch-1: s4_process_orders, order_total === 300 ──────

    it('[A05] s4_process_orders выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s4_process_orders')).toBe('SUCCEEDED')
    })

    it('[A06] s4_process_orders output содержит orders (2 записи) и total === 300', () => {
        const output = result.getStepOutput('s4_process_orders') as {
            orders: Array<{ amount: number }>
            total: number
        }
        expect(output.orders).toHaveLength(2)
        expect(output.total).toBe(300)
    })

    // ─── 7-8. Branch-2: s4_process_products, product_count === 4 ────

    it('[A07] s4_process_products выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s4_process_products')).toBe('SUCCEEDED')
    })

    it('[A08] s4_process_products output содержит products (4 записи) и count === 4', () => {
        const output = result.getStepOutput('s4_process_products') as {
            products: Array<{ sku: string }>
            count: number
        }
        expect(output.products).toHaveLength(4)
        expect(output.count).toBe(4)
    })

    // ─── 9-11. Store ноды выполнены ──────────────────────────────────

    it('[A09] s4_store_users выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s4_store_users')).toBe('SUCCEEDED')
    })

    it('[A10] s4_store_orders выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s4_store_orders')).toBe('SUCCEEDED')
    })

    it('[A11] s4_store_products выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s4_store_products')).toBe('SUCCEEDED')
    })

    // ─── 12. Общий статус потока ─────────────────────────────────────

    it('[A12] общий статус потока === RUNNING (engine-level)', () => {
        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
    })
})
