/**
 * Тесты загрузки и валидации golden fixtures S1-S4.
 *
 * Проверяют:
 * - Загрузка всех 4 fixture JSON файлов
 * - Валидация через loadFixture()
 * - Структура graphData (nodes, edges)
 * - Наличие trigger ноды в каждом fixture
 * - Связность графа (все target-ноды в edges существуют в nodes)
 * - Наличие expectedOutputs для ключевых шагов
 * - Корректность edge ID формата
 *
 * Запуск: npx vitest run tests/e2e/graph-engine/fixtures.test.ts --config tests/e2e/graph-engine/vitest.config.ts
 */
import { describe, it, expect } from 'vitest'
import { loadFixture, FixtureData } from './helpers'
import s1Fixture from './fixtures/s1-multi-source-etl.json'
import s2Fixture from './fixtures/s2-webhook-processor.json'
import s3Fixture from './fixtures/s3-scheduled-sync-loop.json'
import s4Fixture from './fixtures/s4-parallel-fan-out.json'

// ─── Общие хелперы валидации ──────────────────────────────────────────

function validateFixtureStructure(fixture: FixtureData, expectedName: string) {
    expect(fixture.name).toBe(expectedName)
    expect(fixture.flowDefinition).toBeDefined()
    expect(fixture.flowDefinition.displayName).toBeTruthy()
    expect(fixture.flowDefinition.graphData).toBeDefined()
    expect(fixture.flowDefinition.graphData.nodes).toBeInstanceOf(Array)
    expect(fixture.flowDefinition.graphData.edges).toBeInstanceOf(Array)
    expect(fixture.flowDefinition.graphData.nodes.length).toBeGreaterThan(0)
    expect(fixture.triggerInput).toBeDefined()
    expect(fixture.expectedOutputs).toBeDefined()
}

function validateTriggerNode(fixture: FixtureData) {
    const triggerNode = fixture.flowDefinition.graphData.nodes.find(n => n.type === 'trigger')
    expect(triggerNode).toBeDefined()
    expect(triggerNode!.id).toBe('trigger')
    expect(triggerNode!.actionType).toBe('PIECE')
}

function validateGraphConnectivity(fixture: FixtureData) {
    const nodeIds = new Set(fixture.flowDefinition.graphData.nodes.map(n => n.id))
    for (const edge of fixture.flowDefinition.graphData.edges) {
        expect(nodeIds.has(edge.source)).toBe(true)
        expect(nodeIds.has(edge.target)).toBe(true)
        expect(edge.id).toBe(`${edge.source}-${edge.sourceHandle}-${edge.target}`)
        expect(edge.targetHandle).toBe('input')
    }
}

// ─── S1: Multi-Source ETL ────────────────────────────────────────────

describe('Fixture S1: Multi-Source ETL', () => {
    const fixture = loadFixture(s1Fixture)

    it('загружается и имеет корректную структуру', () => {
        validateFixtureStructure(fixture, 'S1: Multi-Source ETL')
    })

    it('содержит trigger ноду', () => {
        validateTriggerNode(fixture)
    })

    it('содержит 7 нод (trigger + 5 CODE + 1 ROUTER)', () => {
        expect(fixture.flowDefinition.graphData.nodes).toHaveLength(7)
    })

    it('содержит 6 рёбер', () => {
        expect(fixture.flowDefinition.graphData.edges).toHaveLength(6)
    })

    it('граф связный — все target-ноды в edges существуют в nodes', () => {
        validateGraphConnectivity(fixture)
    })

    it('ROUTER нода имеет 2 ветки (has records + empty fallback)', () => {
        const routerNode = fixture.flowDefinition.graphData.nodes.find(n => n.id === 's1_router')
        expect(routerNode).toBeDefined()
        expect(routerNode!.actionType).toBe('ROUTER')
        const branches = (routerNode!.settings as any).branches
        expect(branches).toHaveLength(2)
        expect(branches[0].branchType).toBe('CONDITION')
        expect(branches[1].branchType).toBe('FALLBACK')
    })

    it('expectedOutputs содержит ключевые шаги', () => {
        expect(fixture.expectedOutputs['s1_fetch_data']).toBeDefined()
        expect(fixture.expectedOutputs['s1_parse']).toBeDefined()
        expect(fixture.expectedOutputs['s1_transform']).toBeDefined()
        expect(fixture.expectedOutputs['s1_router']).toBeDefined()
        expect(fixture.expectedOutputs['s1_store_result']).toBeDefined()
    })

    it('expectedOutputs s1_parse содержит 3 записи', () => {
        const parseOutput = fixture.expectedOutputs['s1_parse'].output as any
        expect(parseOutput.records).toHaveLength(3)
        expect(parseOutput.count).toBe(3)
    })
})

// ─── S2: Webhook Processor ───────────────────────────────────────────

describe('Fixture S2: Webhook Processor', () => {
    const fixture = loadFixture(s2Fixture)

    it('загружается и имеет корректную структуру', () => {
        validateFixtureStructure(fixture, 'S2: Webhook Processor')
    })

    it('содержит trigger ноду', () => {
        validateTriggerNode(fixture)
    })

    it('содержит 8 нод (trigger + 2 CODE + 1 ROUTER + 4 branch CODE)', () => {
        expect(fixture.flowDefinition.graphData.nodes).toHaveLength(8)
    })

    it('содержит 7 рёбер', () => {
        expect(fixture.flowDefinition.graphData.edges).toHaveLength(7)
    })

    it('граф связный', () => {
        validateGraphConnectivity(fixture)
    })

    it('ROUTER нода имеет 4 ветки (order/payment/refund/fallback)', () => {
        const routerNode = fixture.flowDefinition.graphData.nodes.find(n => n.id === 's2_router')
        expect(routerNode).toBeDefined()
        expect(routerNode!.actionType).toBe('ROUTER')
        const branches = (routerNode!.settings as any).branches
        expect(branches).toHaveLength(4)
        expect(branches[0].branchName).toBe('Orders')
        expect(branches[1].branchName).toBe('Payments')
        expect(branches[2].branchName).toBe('Refunds')
        expect(branches[3].branchType).toBe('FALLBACK')
    })

    it('ROUTER использует EXECUTE_FIRST_MATCH', () => {
        const routerNode = fixture.flowDefinition.graphData.nodes.find(n => n.id === 's2_router')
        expect((routerNode!.settings as any).executionType).toBe('EXECUTE_FIRST_MATCH')
    })

    it('triggerInput содержит type=order', () => {
        expect((fixture.triggerInput as any).type).toBe('order')
    })

    it('expectedOutputs содержит ключевые шаги', () => {
        expect(fixture.expectedOutputs['s2_enrich']).toBeDefined()
        expect(fixture.expectedOutputs['s2_normalize']).toBeDefined()
        expect(fixture.expectedOutputs['s2_router']).toBeDefined()
        expect(fixture.expectedOutputs['s2_store_orders']).toBeDefined()
    })
})

// ─── S3: Scheduled Sync + Loop ───────────────────────────────────────

describe('Fixture S3: Scheduled Sync + Loop', () => {
    const fixture = loadFixture(s3Fixture)

    it('загружается и имеет корректную структуру', () => {
        validateFixtureStructure(fixture, 'S3: Scheduled Sync + Loop')
    })

    it('содержит trigger ноду', () => {
        validateTriggerNode(fixture)
    })

    it('содержит 6 нод (trigger + 3 CODE + 1 LOOP + 1 CODE after loop)', () => {
        expect(fixture.flowDefinition.graphData.nodes).toHaveLength(6)
    })

    it('содержит 5 рёбер', () => {
        expect(fixture.flowDefinition.graphData.edges).toHaveLength(5)
    })

    it('граф связный', () => {
        validateGraphConnectivity(fixture)
    })

    it('LOOP нода присутствует с items expression', () => {
        const loopNode = fixture.flowDefinition.graphData.nodes.find(n => n.id === 's3_loop')
        expect(loopNode).toBeDefined()
        expect(loopNode!.actionType).toBe('LOOP_ON_ITEMS')
        expect((loopNode!.settings as any).items).toBe('{{ s3_get_items.items }}')
    })

    it('loop-output edge соединяет loop с первой нодой тела цикла', () => {
        const loopOutputEdge = fixture.flowDefinition.graphData.edges.find(
            e => e.source === 's3_loop' && e.sourceHandle === 'loop-output',
        )
        expect(loopOutputEdge).toBeDefined()
        expect(loopOutputEdge!.target).toBe('s3_transform_item')
    })

    it('output edge от loop соединяет с s3_write_summary (после цикла)', () => {
        const loopAfterEdge = fixture.flowDefinition.graphData.edges.find(
            e => e.source === 's3_loop' && e.sourceHandle === 'output',
        )
        expect(loopAfterEdge).toBeDefined()
        expect(loopAfterEdge!.target).toBe('s3_write_summary')
    })

    it('expectedOutputs содержит ключевые шаги', () => {
        expect(fixture.expectedOutputs['s3_get_items']).toBeDefined()
        expect(fixture.expectedOutputs['s3_loop']).toBeDefined()
        expect(fixture.expectedOutputs['s3_write_summary']).toBeDefined()
    })
})

// ─── S4: Parallel Fan-Out/Fan-In ────────────────────────────────────

describe('Fixture S4: Parallel Fan-Out/Fan-In', () => {
    const fixture = loadFixture(s4Fixture)

    it('загружается и имеет корректную структуру', () => {
        validateFixtureStructure(fixture, 'S4: Parallel Fan-Out/Fan-In')
    })

    it('содержит trigger ноду', () => {
        validateTriggerNode(fixture)
    })

    it('содержит 9 нод (trigger + 1 ROUTER + 6 branch CODE + 1 merge CODE)', () => {
        expect(fixture.flowDefinition.graphData.nodes).toHaveLength(9)
    })

    it('содержит 8 рёбер', () => {
        expect(fixture.flowDefinition.graphData.edges).toHaveLength(8)
    })

    it('граф связный', () => {
        validateGraphConnectivity(fixture)
    })

    it('ROUTER использует EXECUTE_ALL_MATCH с 3 ветками', () => {
        const routerNode = fixture.flowDefinition.graphData.nodes.find(n => n.id === 's4_router')
        expect(routerNode).toBeDefined()
        expect((routerNode!.settings as any).executionType).toBe('EXECUTE_ALL_MATCH')
        expect((routerNode!.settings as any).branches).toHaveLength(3)
    })

    it('все 3 branch edges существуют', () => {
        const branchEdges = fixture.flowDefinition.graphData.edges.filter(
            e => e.source === 's4_router' && e.sourceHandle.startsWith('branch-'),
        )
        expect(branchEdges).toHaveLength(3)
        expect(branchEdges.map(e => e.sourceHandle).sort()).toEqual(['branch-0', 'branch-1', 'branch-2'])
    })

    it('output edge от router ведёт к s4_merge (fan-in)', () => {
        const mergeEdge = fixture.flowDefinition.graphData.edges.find(
            e => e.source === 's4_router' && e.sourceHandle === 'output',
        )
        expect(mergeEdge).toBeDefined()
        expect(mergeEdge!.target).toBe('s4_merge')
    })

    it('expectedOutputs содержит все ключевые шаги', () => {
        expect(fixture.expectedOutputs['s4_router']).toBeDefined()
        expect(fixture.expectedOutputs['s4_process_users']).toBeDefined()
        expect(fixture.expectedOutputs['s4_store_users']).toBeDefined()
        expect(fixture.expectedOutputs['s4_process_orders']).toBeDefined()
        expect(fixture.expectedOutputs['s4_store_orders']).toBeDefined()
        expect(fixture.expectedOutputs['s4_process_products']).toBeDefined()
        expect(fixture.expectedOutputs['s4_store_products']).toBeDefined()
        expect(fixture.expectedOutputs['s4_merge']).toBeDefined()
    })

    it('expectedOutputs s4_merge содержит агрегированные данные', () => {
        const mergeOutput = fixture.expectedOutputs['s4_merge'].output as any
        expect(mergeOutput.userCount).toBe(3)
        expect(mergeOutput.orderTotal).toBe(300)
        expect(mergeOutput.productCount).toBe(4)
    })
})
