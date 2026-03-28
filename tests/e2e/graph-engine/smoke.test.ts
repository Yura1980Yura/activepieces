/**
 * Smoke-тесты E2E инфраструктуры graph engine.
 *
 * Проверяют работоспособность FlowTestClient и helpers:
 * - Создание FlowTestClient
 * - Исполнение линейного flow с CODE нодами
 * - Исполнение flow с LOOP нодой
 * - Исполнение flow с ROUTER нодой
 * - Загрузка fixture
 *
 * Запуск: npx vitest run tests/e2e/graph-engine/smoke.test.ts --config tests/e2e/graph-engine/vitest.config.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { FlowRunStatus, FlowActionType } from '@activepieces/shared'
import { FlowTestClient } from './setup'
import { createMockGraphFlow, loadFixture } from './helpers'

describe('E2E инфраструктура — smoke тесты', () => {
    let client: FlowTestClient

    beforeAll(() => {
        client = FlowTestClient.create()
    })

    afterAll(() => {
        client.cleanup()
    })

    // ─── AC-1/AC-3: FlowTestClient создание ─────────────────────────

    it('FlowTestClient.create() возвращает инстанс', () => {
        expect(client).toBeDefined()
        expect(client).toBeInstanceOf(FlowTestClient)
    })

    // ─── AC-5: Линейный flow с одной CODE нодой ─────────────────────

    it('исполняет линейный flow с одной CODE нодой', async () => {
        const graphData = createMockGraphFlow({
            codeNodes: [
                { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
            ],
        })

        const result = await client.executeFlow(graphData)

        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
        expect(result.getStepStatus('echo_step')).toBe('SUCCEEDED')
        expect(result.getStepOutput('echo_step')).toEqual({ key: 3 })
    })

    // ─── AC-5: Линейный flow с двумя CODE нодами ────────────────────

    it('исполняет линейный flow с двумя CODE нодами последовательно', async () => {
        const graphData = createMockGraphFlow({
            codeNodes: [
                { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
                { name: 'echo_step_1', input: { key: '{{ 3 + 4 }}' } },
            ],
        })

        const result = await client.executeFlow(graphData)

        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
        expect(result.getStepOutput('echo_step')).toEqual({ key: 3 })
        expect(result.getStepOutput('echo_step_1')).toEqual({ key: 7 })
    })

    // ─── AC-4: Flow с LOOP нодой ────────────────────────────────────

    it('исполняет flow с LOOP нодой (пустое тело)', async () => {
        const graphData = createMockGraphFlow({
            loopNode: {
                name: 'loop_step',
                items: '{{ [1, 2, 3] }}',
            },
        })

        const result = await client.executeFlow(graphData)

        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
        expect(result.getStepStatus('loop_step')).toBeDefined()
        expect(result.steps.loop_step.type).toBe(FlowActionType.LOOP_ON_ITEMS)
    })

    // ─── AC-4: Flow с LOOP + тело цикла ─────────────────────────────

    it('исполняет flow с LOOP + CODE нода в теле цикла', async () => {
        const graphData = createMockGraphFlow({
            loopNode: {
                name: 'loop_step',
                items: '{{ [10, 20] }}',
                bodyNodes: [
                    { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
                ],
            },
        })

        const result = await client.executeFlow(graphData)

        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
        expect(result.steps.loop_step).toBeDefined()
        expect(result.steps.loop_step.type).toBe(FlowActionType.LOOP_ON_ITEMS)
    })

    // ─── AC-4: Flow с ROUTER нодой ──────────────────────────────────

    it('исполняет flow с ROUTER нодой (EXECUTE_FIRST_MATCH)', async () => {
        const graphData = createMockGraphFlow({
            routerNode: {
                name: 'router_step',
                executionType: 'EXECUTE_FIRST_MATCH',
                branches: [
                    {
                        branchName: 'Branch 1',
                        condition: {
                            firstValue: 'a',
                            secondValue: 'a',
                            operator: 'TEXT_EXACTLY_MATCHES',
                        },
                    },
                ],
            },
        })

        const result = await client.executeFlow(graphData)

        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
        expect(result.steps.router_step).toBeDefined()
        expect(result.steps.router_step.type).toBe(FlowActionType.ROUTER)
    })

    // ─── AC-4: Flow с ROUTER + ноды в ветках ────────────────────────

    it('исполняет flow с ROUTER + CODE ноды в ветке', async () => {
        const graphData = createMockGraphFlow({
            routerNode: {
                name: 'router_step',
                executionType: 'EXECUTE_FIRST_MATCH',
                branches: [
                    {
                        branchName: 'Match Branch',
                        condition: {
                            firstValue: 'hello',
                            secondValue: 'hello',
                            operator: 'TEXT_EXACTLY_MATCHES',
                        },
                        bodyNodes: [
                            { name: 'echo_step', input: { key: '{{ 1 + 2 }}' } },
                        ],
                    },
                ],
            },
        })

        const result = await client.executeFlow(graphData)

        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
        expect(result.steps.router_step).toBeDefined()
        expect(result.steps.echo_step).toBeDefined()
        expect(result.getStepOutput('echo_step')).toEqual({ key: 3 })
    })

    // ─── Fixture loader ─────────────────────────────────────────────

    it('loadFixture валидирует обязательные поля', () => {
        expect(() => loadFixture({})).toThrow('Invalid fixture')

        const validFixture = {
            name: 'Test Fixture',
            flowDefinition: {
                displayName: 'Test',
                graphData: {
                    nodes: [{ id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, displayName: 'T', valid: true, actionType: 'PIECE', settings: {} }],
                    edges: [],
                },
            },
            triggerInput: {},
            expectedOutputs: {},
        }

        const loaded = loadFixture(validFixture)
        expect(loaded.name).toBe('Test Fixture')
        expect(loaded.flowDefinition.graphData.nodes).toHaveLength(1)
    })

    // ─── FlowTestClient getStepStatus/getStepOutput без executeFlow ──

    it('getStepStatus бросает ошибку если executeFlow не вызывался', () => {
        const freshClient = FlowTestClient.create()
        expect(() => freshClient.getStepStatus('any')).toThrow('Нет результата')
    })
})
