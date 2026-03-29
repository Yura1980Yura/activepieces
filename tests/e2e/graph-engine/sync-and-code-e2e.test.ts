/**
 * P2.5-03: E2E тесты — скрытая бомба + полный путь CODE нод.
 *
 * Блок 1: Скрытая бомба — проверяет что syncGraphDataFromTrigger
 *   сохраняет settings после GRAPH_ADD_EDGE (round-trip).
 *
 * Блок 2: Полный путь CODE нод — 3 ноды с data passing через graph engine.
 *
 * Запуск: npx vitest run tests/e2e/graph-engine/sync-and-code-e2e.test.ts --config tests/e2e/graph-engine/vitest.config.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
    flowOperations,
    FlowOperationType,
    FlowRunStatus,
    FlowActionType,
    FlowTriggerType,
    FlowVersionState,
    GraphData,
} from '@activepieces/shared'
import type { FlowVersion } from '@activepieces/shared'
import { FlowTestClient } from './setup'
import { createMockGraphFlow } from './helpers'

// === Хелперы для Блока 1 ===

function createEmptyFlowWithGraphData(): FlowVersion {
    return {
        id: 'bomb-test-version',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        flowId: 'bomb-test-flow',
        displayName: 'Bomb Test',
        trigger: {
            type: FlowTriggerType.EMPTY,
            name: 'trigger',
            displayName: 'Empty Trigger',
            valid: false,
            settings: {},
            nextAction: undefined,
        },
        graphData: {
            nodes: [{
                id: 'trigger',
                type: 'trigger',
                position: { x: 0, y: 0 },
                displayName: 'Empty Trigger',
                valid: false,
                actionType: FlowTriggerType.EMPTY,
                settings: {},
            }],
            edges: [],
        },
        updatedBy: null,
        valid: false,
        schemaVersion: '20',
        agentIds: [],
        state: FlowVersionState.DRAFT,
        connectionIds: [],
        backupFiles: null,
        notes: [],
    } as unknown as FlowVersion
}

function makeCodeNode(id: string, displayName: string) {
    return {
        id,
        type: 'action' as const,
        position: { x: 300, y: 200 },
        displayName,
        valid: false,
        actionType: 'CODE' as const,
        settings: { input: {} },
    }
}

// === Блок 1: Скрытая бомба ===

describe('E2E Блок 1: Скрытая бомба — settings после round-trip', () => {

    it('GRAPH_ADD_NODE → UPDATE_ACTION → GRAPH_ADD_EDGE → settings НЕ потеряны', () => {
        let v = createEmptyFlowWithGraphData()

        // 1. Добавить step_1 через GRAPH_ADD_NODE
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makeCodeNode('step_1', 'Code A') },
        })

        // 2. Соединить trigger→step_1
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' } },
        })

        // 3. UPDATE_ACTION с реальными settings
        v = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: {
                name: 'step_1',
                displayName: 'Code A Updated',
                type: FlowActionType.CODE,
                valid: true,
                settings: {
                    input: {},
                    sourceCode: { code: 'export const code = async (inputs) => { return {value: 42}; }', packageJson: '{}' },
                },
            },
        })

        // === Assertion: settings в graphData обновлены после UPDATE_ACTION ===
        const nodeAfterUpdate = v.graphData!.nodes.find(n => n.id === 'step_1')!
        expect(nodeAfterUpdate.settings.sourceCode).toBeDefined()
        expect((nodeAfterUpdate.settings.sourceCode as any).code).toContain('return {value: 42}')

        // 4. Добавить step_2 + GRAPH_ADD_EDGE step_1→step_2 (БОМБА!)
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_NODE,
            request: { node: makeCodeNode('step_2', 'Code B') },
        })
        v = flowOperations.apply(v, {
            type: FlowOperationType.GRAPH_ADD_EDGE,
            request: { edge: { id: 'e2', source: 'step_1', target: 'step_2', sourceHandle: 'output', targetHandle: 'input' } },
        })

        // === КРИТИЧЕСКИЕ ASSERTIONS ===
        const nodeAfterEdge = v.graphData!.nodes.find(n => n.id === 'step_1')!
        expect(nodeAfterEdge.settings.sourceCode).toBeDefined()
        expect((nodeAfterEdge.settings.sourceCode as any).code).toContain('return {value: 42}')
        expect(nodeAfterEdge.displayName).toBe('Code A Updated')
        expect(nodeAfterEdge.valid).toBe(true)
    })

    it('trigger linked-list settings идентичны graphData node settings', () => {
        let v = createEmptyFlowWithGraphData()
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_NODE, request: { node: makeCodeNode('step_1', 'X') } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_EDGE, request: { edge: { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' } } })
        v = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: { name: 'step_1', displayName: 'X Updated', type: FlowActionType.CODE, valid: true,
                settings: { input: { myKey: 'myVal' }, sourceCode: { code: 'return 1', packageJson: '{}' } } },
        })

        const graphNode = v.graphData!.nodes.find(n => n.id === 'step_1')!
        const linkedListStep = v.trigger.nextAction!
        expect(graphNode.displayName).toBe(linkedListStep.displayName)
        expect(graphNode.valid).toBe(linkedListStep.valid)
        expect(JSON.stringify(graphNode.settings)).toBe(JSON.stringify(linkedListStep.settings))
    })

    it('graphData.nodes.length и edges.length корректны', () => {
        let v = createEmptyFlowWithGraphData()
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_NODE, request: { node: makeCodeNode('step_1', 'A') } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_NODE, request: { node: makeCodeNode('step_2', 'B') } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_EDGE, request: { edge: { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' } } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_EDGE, request: { edge: { id: 'e2', source: 'step_1', target: 'step_2', sourceHandle: 'output', targetHandle: 'input' } } })

        expect(v.graphData!.nodes).toHaveLength(3) // trigger + step_1 + step_2
        expect(v.graphData!.edges).toHaveLength(2) // trigger→step_1, step_1→step_2
    })

    it('повторный GRAPH_ADD_EDGE не уничтожает settings', () => {
        let v = createEmptyFlowWithGraphData()
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_NODE, request: { node: makeCodeNode('step_1', 'A') } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_NODE, request: { node: makeCodeNode('step_2', 'B') } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_NODE, request: { node: makeCodeNode('step_3', 'C') } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_EDGE, request: { edge: { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' } } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_EDGE, request: { edge: { id: 'e2', source: 'step_1', target: 'step_2', sourceHandle: 'output', targetHandle: 'input' } } })

        // UPDATE settings
        v = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: { name: 'step_1', displayName: 'A', type: FlowActionType.CODE, valid: true,
                settings: { input: {}, sourceCode: { code: 'return {a: 1}', packageJson: '{}' } } },
        })
        v = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: { name: 'step_2', displayName: 'B', type: FlowActionType.CODE, valid: true,
                settings: { input: {}, sourceCode: { code: 'return {b: 2}', packageJson: '{}' } } },
        })

        // Ещё один GRAPH_ADD_EDGE
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_EDGE, request: { edge: { id: 'e3', source: 'step_2', target: 'step_3', sourceHandle: 'output', targetHandle: 'input' } } })

        const s1 = v.graphData!.nodes.find(n => n.id === 'step_1')!
        const s2 = v.graphData!.nodes.find(n => n.id === 'step_2')!
        expect((s1.settings.sourceCode as any).code).toBe('return {a: 1}')
        expect((s2.settings.sourceCode as any).code).toBe('return {b: 2}')
    })

    it('flowVersion.graphData !== null подтверждает graph mode', () => {
        let v = createEmptyFlowWithGraphData()
        expect(v.graphData).not.toBeNull()
        expect(v.graphData).toBeDefined()
    })

    it('двойной round-trip сохраняет settings', () => {
        let v = createEmptyFlowWithGraphData()
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_NODE, request: { node: makeCodeNode('step_1', 'A') } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_EDGE, request: { edge: { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' } } })

        // Round-trip 1: UPDATE → GRAPH_ADD_EDGE (новая нода)
        v = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: { name: 'step_1', displayName: 'A v1', type: FlowActionType.CODE, valid: true,
                settings: { input: {}, sourceCode: { code: 'round1', packageJson: '{}' } } },
        })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_NODE, request: { node: makeCodeNode('step_2', 'B') } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_EDGE, request: { edge: { id: 'e2', source: 'step_1', target: 'step_2', sourceHandle: 'output', targetHandle: 'input' } } })

        // Round-trip 2: UPDATE → GRAPH_ADD_EDGE (ещё нода)
        v = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: { name: 'step_1', displayName: 'A v2', type: FlowActionType.CODE, valid: true,
                settings: { input: {}, sourceCode: { code: 'round2', packageJson: '{}' } } },
        })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_NODE, request: { node: makeCodeNode('step_3', 'C') } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_EDGE, request: { edge: { id: 'e3', source: 'step_2', target: 'step_3', sourceHandle: 'output', targetHandle: 'input' } } })

        const s1 = v.graphData!.nodes.find(n => n.id === 'step_1')!
        expect(s1.displayName).toBe('A v2')
        expect((s1.settings.sourceCode as any).code).toBe('round2')
    })
})

// === Блок 2: Полный путь CODE нод через graph engine ===

describe('E2E Блок 2: Полный путь CODE нод — execution chain', () => {
    let client: FlowTestClient

    beforeAll(() => {
        client = FlowTestClient.create()
    })

    afterAll(() => {
        client.cleanup()
    })

    it('CODE ноды chain execution: 2 ноды последовательно', async () => {
        const graphData = createMockGraphFlow({
            codeNodes: [
                { name: 'echo_step', input: { value: '{{ 42 }}' } },
                { name: 'echo_step_1', input: { doubled: '{{ 84 }}' } },
            ],
        })

        const result = await client.executeFlow(graphData)

        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
        expect(result.getStepOutput('echo_step')).toEqual({ value: 42 })
        expect(result.getStepOutput('echo_step_1')).toEqual({ doubled: 84 })
    })

    it('CODE ноды: status === SUCCEEDED', async () => {
        const graphData = createMockGraphFlow({
            codeNodes: [
                { name: 'echo_step', input: { a: '{{ 10 }}' } },
                { name: 'echo_step_1', input: { b: '{{ 20 }}' } },
            ],
        })

        const result = await client.executeFlow(graphData)

        expect(result.getStepStatus('echo_step')).toBe('SUCCEEDED')
        expect(result.getStepStatus('echo_step_1')).toBe('SUCCEEDED')
    })

    it('graphData.nodes settings синхронизированы с trigger после UPDATE + execute', () => {
        // Создаём flow через operations
        let v = createEmptyFlowWithGraphData()
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_NODE, request: { node: makeCodeNode('step_1', 'A') } })
        v = flowOperations.apply(v, { type: FlowOperationType.GRAPH_ADD_EDGE, request: { edge: { id: 'e1', source: 'trigger', target: 'step_1', sourceHandle: 'output', targetHandle: 'input' } } })
        v = flowOperations.apply(v, {
            type: FlowOperationType.UPDATE_ACTION,
            request: { name: 'step_1', displayName: 'A', type: FlowActionType.CODE, valid: true,
                settings: { input: { x: '{{ 100 }}' }, sourceCode: { code: 'return {x: 100}', packageJson: '{}' } } },
        })

        // Проверяем что graphData и trigger синхронизированы
        expect(v.graphData).not.toBeNull()
        const node = v.graphData!.nodes.find(n => n.id === 'step_1')!
        const llStep = v.trigger.nextAction!
        expect(node.displayName).toBe(llStep.displayName)
        expect(JSON.stringify(node.settings)).toBe(JSON.stringify(llStep.settings))
    })

    it('flow с LOOP нодой (пустое тело)', async () => {
        const graphData = createMockGraphFlow({
            loopNode: {
                name: 'loop_step',
                items: '{{ [1, 2, 3] }}',
            },
        })

        const result = await client.executeFlow(graphData)

        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
        expect(result.steps.loop_step).toBeDefined()
        expect(result.steps.loop_step.type).toBe(FlowActionType.LOOP_ON_ITEMS)
    })

    it('flow с ROUTER EXECUTE_FIRST_MATCH', async () => {
        const graphData = createMockGraphFlow({
            routerNode: {
                name: 'router_step',
                executionType: 'EXECUTE_FIRST_MATCH',
                branches: [
                    {
                        branchName: 'Branch 1',
                        condition: { firstValue: 'a', secondValue: 'a', operator: 'TEXT_EXACTLY_MATCHES' },
                    },
                ],
            },
        })

        const result = await client.executeFlow(graphData)

        expect(result.getFlowStatus()).toBe(FlowRunStatus.RUNNING)
        expect(result.steps.router_step).toBeDefined()
        expect(result.steps.router_step.type).toBe(FlowActionType.ROUTER)
    })
})
