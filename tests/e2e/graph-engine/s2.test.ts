/**
 * E2E тесты сценария S2: Webhook Processor.
 *
 * Проверяют полное исполнение потока через graph engine:
 * trigger -> s2_enrich -> s2_normalize -> ROUTER(EXECUTE_FIRST_MATCH by type)
 *   -> s2_store_orders / s2_store_payments / s2_store_refunds / s2_log_unknown
 *
 * Топология: линейная цепочка CODE нод + ROUTER с 4 ветками (3 CONDITION + 1 FALLBACK).
 * Golden fixture: tests/e2e/graph-engine/fixtures/s2-webhook-processor.json
 * CODE index.js: packages/server/engine/test/resources/codes/flowVersionId/s2_{step}/index.js
 *
 * 20 assertions по PHASE2_ARCHITECTURE.md §5 S2 (адаптированы для CODE нод).
 *
 * Запуск: npx vitest run tests/e2e/graph-engine/s2.test.ts --config tests/e2e/graph-engine/vitest.config.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { FlowRunStatus } from '@activepieces/shared'
import { FlowTestClient, FlowExecutionResult } from './setup'
import { loadFixture, FixtureData } from './helpers'
import s2Fixture from './fixtures/s2-webhook-processor.json'

describe('S2: Webhook Processor — E2E исполнение', () => {
    let client: FlowTestClient
    let result: FlowExecutionResult
    let fixture: FixtureData

    beforeAll(async () => {
        fixture = loadFixture(s2Fixture)
        client = FlowTestClient.create()
        result = await client.executeFromFixture(s2Fixture)
    })

    afterAll(() => {
        client.cleanup()
    })

    // ─── 1. Trigger получил payload ────────────────────────────────────

    it('[A01] trigger payload содержит поле type', () => {
        const triggerInput = fixture.triggerInput as { type: string }
        expect(triggerInput.type).toBe('order')
    })

    // ─── 2-3. s2_enrich: обогащение данными (customerId) ──────────────

    it('[A02] s2_enrich выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s2_enrich')).toBe('SUCCEEDED')
    })

    it('[A03] s2_enrich output содержит customerId из внешнего API', () => {
        const output = result.getStepOutput('s2_enrich') as {
            type: string
            orderId: string
            amount: number
            customerId: string
            customerName: string
        }
        expect(output.customerId).toBe('CUST-456')
        expect(output.customerName).toBe('Test User')
    })

    // ─── 4-5. s2_normalize: нормализация формата ───────────────────────

    it('[A04] s2_normalize выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s2_normalize')).toBe('SUCCEEDED')
    })

    it('[A05] s2_normalize output — нормализованный объект с полями original + enriched + normalizedAt', () => {
        const output = result.getStepOutput('s2_normalize') as {
            type: string
            orderId: string
            amount: number
            customerId: string
            customerName: string
            normalizedAt: string
        }
        expect(output.type).toBe('order')
        expect(output.orderId).toBe('ORD-123')
        expect(output.customerId).toBe('CUST-456')
        expect(output.normalizedAt).toBe('2026-03-28T00:00:00Z')
    })

    // ─── 6. Router: оценка 4 веток ────────────────────────────────────

    it('[A06] s2_router оценил 4 ветки', () => {
        const routerStep = result.steps.s2_router
        const routerOutput = routerStep.output as {
            branches: Array<{
                branchName: string
                branchIndex: number
                evaluation: boolean
            }>
        }
        expect(routerOutput.branches).toHaveLength(4)
    })

    // ─── 7-10. Оценки веток: type=order → true, остальные false ───────

    it('[A07] branch-0 (Orders, type=order) evaluated as true', () => {
        const routerStep = result.steps.s2_router
        const routerOutput = routerStep.output as {
            branches: Array<{
                branchName: string
                branchIndex: number
                evaluation: boolean
            }>
        }
        expect(routerOutput.branches[0].branchName).toBe('Orders')
        expect(routerOutput.branches[0].evaluation).toBe(true)
    })

    it('[A08] branch-1 (Payments, type=payment) evaluated as false', () => {
        const routerStep = result.steps.s2_router
        const routerOutput = routerStep.output as {
            branches: Array<{
                branchName: string
                branchIndex: number
                evaluation: boolean
            }>
        }
        expect(routerOutput.branches[1].branchName).toBe('Payments')
        expect(routerOutput.branches[1].evaluation).toBe(false)
    })

    it('[A09] branch-2 (Refunds, type=refund) evaluated as false', () => {
        const routerStep = result.steps.s2_router
        const routerOutput = routerStep.output as {
            branches: Array<{
                branchName: string
                branchIndex: number
                evaluation: boolean
            }>
        }
        expect(routerOutput.branches[2].branchName).toBe('Refunds')
        expect(routerOutput.branches[2].evaluation).toBe(false)
    })

    it('[A10] branch-3 (Unknown/fallback) evaluated as false', () => {
        const routerStep = result.steps.s2_router
        const routerOutput = routerStep.output as {
            branches: Array<{
                branchName: string
                branchIndex: number
                evaluation: boolean
            }>
        }
        expect(routerOutput.branches[3].branchName).toBe('Unknown')
        expect(routerOutput.branches[3].evaluation).toBe(false)
    })

    // ─── 11-12. s2_store_orders: Store Put для key=orders ─────────────

    it('[A11] s2_store_orders выполнен успешно (status = SUCCEEDED)', () => {
        expect(result.getStepStatus('s2_store_orders')).toBe('SUCCEEDED')
    })

    it('[A12] s2_store_orders output содержит key=orders', () => {
        const output = result.getStepOutput('s2_store_orders') as {
            key: string
            orderId: string
            customerId: string
            amount: number
        }
        expect(output.key).toBe('orders')
    })

    // ─── 13-15. Проверка значений Store (orderId, customerId, amount)──

    it('[A13] s2_store_orders output содержит orderId = ORD-123', () => {
        const output = result.getStepOutput('s2_store_orders') as {
            key: string
            orderId: string
            customerId: string
            amount: number
        }
        expect(output.orderId).toBe('ORD-123')
    })

    it('[A14] s2_store_orders output содержит customerId = CUST-456', () => {
        const output = result.getStepOutput('s2_store_orders') as {
            key: string
            orderId: string
            customerId: string
            amount: number
        }
        expect(output.customerId).toBe('CUST-456')
    })

    it('[A15] s2_store_orders output содержит amount = 99.99', () => {
        const output = result.getStepOutput('s2_store_orders') as {
            key: string
            orderId: string
            customerId: string
            amount: number
        }
        expect(output.amount).toBe(99.99)
    })

    // ─── 16. s2_log_unknown НЕ выполнен ───────────────────────────────

    it('[A16] s2_log_unknown НЕ выполнен (fallback ветка не активна)', () => {
        const status = result.getStepStatus('s2_log_unknown')
        expect(status).toBeUndefined()
    })

    // ─── 17. s2_store_payments НЕ выполнен ────────────────────────────

    it('[A17] s2_store_payments НЕ выполнен (type != payment)', () => {
        const status = result.getStepStatus('s2_store_payments')
        expect(status).toBeUndefined()
    })

    // ─── 18. s2_store_refunds НЕ выполнен ─────────────────────────────

    it('[A18] s2_store_refunds НЕ выполнен (type != refund)', () => {
        const status = result.getStepStatus('s2_store_refunds')
        expect(status).toBeUndefined()
    })

    // ─── 19. Общий статус потока ──────────────────────────────────────

    it('[A19] общий статус потока === RUNNING (engine-level)', () => {
        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
    })

    // ─── 20. Только корректные branch-ноды выполнены ──────────────────

    it('[A20] выполнены только ноды правильной ветки (s2_enrich, s2_normalize, s2_router, s2_store_orders)', () => {
        const expectedExecuted = [
            's2_enrich',
            's2_normalize',
            's2_router',
            's2_store_orders',
        ]
        const expectedNotExecuted = [
            's2_store_payments',
            's2_store_refunds',
            's2_log_unknown',
        ]

        for (const step of expectedExecuted) {
            expect(result.steps[step], `шаг ${step} должен присутствовать`).toBeDefined()
            expect(result.getStepStatus(step), `шаг ${step} должен быть SUCCEEDED`).toBe('SUCCEEDED')
        }

        for (const step of expectedNotExecuted) {
            expect(result.steps[step], `шаг ${step} НЕ должен присутствовать`).toBeUndefined()
        }
    })
})
