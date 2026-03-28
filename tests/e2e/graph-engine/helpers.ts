/**
 * Хелперы для E2E тестов graph engine.
 *
 * Предоставляют фабрики для создания GraphData с разными топологиями:
 * - линейная цепочка CODE нод
 * - LOOP_ON_ITEMS с телом цикла
 * - ROUTER с ветками
 * - комбинированные графы
 *
 * Также: создание FlowVersion и ExecuteFlowOperation для прямого вызова executor.
 */
import {
    BeginExecuteFlowOperation,
    ExecutionType,
    FlowActionType,
    FlowVersionState,
    GraphData,
    GraphNodeDefinition,
    ProgressUpdateType,
    RunEnvironment,
} from '@activepieces/shared'

// ─── Типы ────────────────────────────────────────────────────────────

/** Описание CODE ноды для builder-а */
export type CodeNodeSpec = {
    name: string
    input: Record<string, unknown>
    skip?: boolean
}

/** Описание LOOP ноды для builder-а */
export type LoopNodeSpec = {
    name: string
    items: string
    skip?: boolean
    bodyNodes?: CodeNodeSpec[]
}

/** Описание ветки ROUTER */
export type RouterBranchSpec = {
    branchName: string
    /** null = FALLBACK ветка */
    condition: {
        firstValue: string
        secondValue: string
        operator: string
    } | null
    bodyNodes?: CodeNodeSpec[]
}

/** Описание ROUTER ноды для builder-а */
export type RouterNodeSpec = {
    name: string
    executionType: 'EXECUTE_FIRST_MATCH' | 'EXECUTE_ALL_MATCH'
    skip?: boolean
    branches: RouterBranchSpec[]
}

/** Опции для createMockGraphFlow */
export type MockGraphFlowOptions = {
    /** Линейная цепочка CODE нод после trigger */
    codeNodes?: CodeNodeSpec[]
    /** LOOP нода (вставляется после trigger, перед codeNodes) */
    loopNode?: LoopNodeSpec
    /** ROUTER нода (вставляется после trigger, перед codeNodes) */
    routerNode?: RouterNodeSpec
    /** Дополнительные ноды после loop/router */
    afterNodes?: CodeNodeSpec[]
}

// ─── GraphData builders ──────────────────────────────────────────────

/**
 * Создать trigger ноду для GraphData.
 */
function buildTriggerNode(): GraphNodeDefinition {
    return {
        id: 'trigger',
        type: 'trigger',
        position: { x: 0, y: 0 },
        displayName: 'Test Trigger',
        valid: true,
        actionType: 'PIECE',
        settings: {
            pieceName: 'webhook',
            pieceVersion: '1.0.0',
            triggerName: 'webhook_trigger',
            input: {},
            propertySettings: {},
        },
    }
}

/**
 * Создать CODE action ноду для GraphData.
 */
function buildCodeNode(spec: CodeNodeSpec, yOffset: number): GraphNodeDefinition {
    return {
        id: spec.name,
        type: 'action',
        position: { x: 0, y: yOffset },
        displayName: `Action ${spec.name}`,
        valid: true,
        skip: spec.skip,
        actionType: FlowActionType.CODE,
        settings: {
            input: spec.input,
            sourceCode: { packageJson: '', code: '' },
        },
    }
}

/**
 * Создать LOOP_ON_ITEMS ноду для GraphData.
 */
function buildLoopNode(spec: LoopNodeSpec, yOffset: number): GraphNodeDefinition {
    return {
        id: spec.name,
        type: 'loop',
        position: { x: 0, y: yOffset },
        displayName: `Loop ${spec.name}`,
        valid: true,
        skip: spec.skip,
        actionType: FlowActionType.LOOP_ON_ITEMS,
        settings: {
            items: spec.items,
        },
    }
}

/**
 * Создать ROUTER ноду для GraphData.
 */
function buildRouterNode(spec: RouterNodeSpec, yOffset: number): GraphNodeDefinition {
    return {
        id: spec.name,
        type: 'router',
        position: { x: 0, y: yOffset },
        displayName: `Router ${spec.name}`,
        valid: true,
        skip: spec.skip,
        actionType: FlowActionType.ROUTER,
        settings: {
            branches: spec.branches.map((branch) => {
                if (branch.condition === null) {
                    return {
                        branchType: 'FALLBACK',
                        branchName: branch.branchName,
                    }
                }
                return {
                    conditions: [[branch.condition]],
                    branchType: 'CONDITION',
                    branchName: branch.branchName,
                }
            }),
            executionType: spec.executionType,
        },
    }
}

/**
 * Создать edge для GraphData.
 */
function buildEdge(source: string, target: string, sourceHandle = 'output', targetHandle = 'input'): GraphData['edges'][number] {
    return {
        id: `${source}-${sourceHandle}-${target}`,
        source,
        target,
        sourceHandle,
        targetHandle,
    }
}

/**
 * Главный builder: создать GraphData для E2E тестов.
 *
 * Поддерживает три основные топологии:
 *
 * 1. Линейная: trigger -> code1 -> code2 -> ...
 *    createMockGraphFlow({ codeNodes: [...] })
 *
 * 2. С loop: trigger -> loop -> afterNodes
 *    createMockGraphFlow({ loopNode: { ..., bodyNodes: [...] }, afterNodes: [...] })
 *
 * 3. С router: trigger -> router -> afterNodes
 *    createMockGraphFlow({ routerNode: { ..., branches: [...] }, afterNodes: [...] })
 */
export function createMockGraphFlow(opts: MockGraphFlowOptions): GraphData {
    const nodes: GraphNodeDefinition[] = []
    const edges: GraphData['edges'] = []
    let yOffset = 0

    // 1. Trigger
    nodes.push(buildTriggerNode())
    yOffset += 100

    let lastNodeId = 'trigger'

    // 2. Loop node (если есть)
    if (opts.loopNode) {
        const loopNode = buildLoopNode(opts.loopNode, yOffset)
        nodes.push(loopNode)
        edges.push(buildEdge(lastNodeId, opts.loopNode.name))
        yOffset += 100
        lastNodeId = opts.loopNode.name

        // Loop body nodes
        if (opts.loopNode.bodyNodes && opts.loopNode.bodyNodes.length > 0) {
            let loopBodyPrev = opts.loopNode.name
            for (let i = 0; i < opts.loopNode.bodyNodes.length; i++) {
                const bodySpec = opts.loopNode.bodyNodes[i]
                nodes.push(buildCodeNode(bodySpec, yOffset))
                yOffset += 100

                if (i === 0) {
                    // Первая нода тела цикла — edge с sourceHandle 'loop-output'
                    edges.push(buildEdge(opts.loopNode.name, bodySpec.name, 'loop-output'))
                }
                else {
                    edges.push(buildEdge(loopBodyPrev, bodySpec.name))
                }
                loopBodyPrev = bodySpec.name
            }
        }
    }

    // 3. Router node (если есть)
    if (opts.routerNode) {
        const routerNode = buildRouterNode(opts.routerNode, yOffset)
        nodes.push(routerNode)
        edges.push(buildEdge(lastNodeId, opts.routerNode.name))
        yOffset += 100
        lastNodeId = opts.routerNode.name

        // Router branches
        for (let branchIdx = 0; branchIdx < opts.routerNode.branches.length; branchIdx++) {
            const branch = opts.routerNode.branches[branchIdx]
            if (branch.bodyNodes && branch.bodyNodes.length > 0) {
                let branchPrev = opts.routerNode.name
                for (let i = 0; i < branch.bodyNodes.length; i++) {
                    const bodySpec = branch.bodyNodes[i]
                    nodes.push(buildCodeNode(bodySpec, yOffset))
                    yOffset += 100

                    if (i === 0) {
                        // Первая нода ветки — edge с sourceHandle 'branch-{index}'
                        edges.push(buildEdge(opts.routerNode.name, bodySpec.name, `branch-${branchIdx}`))
                    }
                    else {
                        edges.push(buildEdge(branchPrev, bodySpec.name))
                    }
                    branchPrev = bodySpec.name
                }
            }
        }
    }

    // 4. Линейные CODE ноды (если нет loop/router, идут после trigger)
    if (opts.codeNodes) {
        for (const spec of opts.codeNodes) {
            nodes.push(buildCodeNode(spec, yOffset))
            edges.push(buildEdge(lastNodeId, spec.name))
            yOffset += 100
            lastNodeId = spec.name
        }
    }

    // 5. After nodes (после loop/router)
    if (opts.afterNodes) {
        for (const spec of opts.afterNodes) {
            nodes.push(buildCodeNode(spec, yOffset))
            edges.push(buildEdge(lastNodeId, spec.name))
            yOffset += 100
            lastNodeId = spec.name
        }
    }

    return { nodes, edges }
}

/**
 * Создать FlowVersion из GraphData.
 */
export function createMockFlowVersion(graphData: GraphData) {
    return {
        id: 'flowVersionId',
        flowId: 'flowId',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        displayName: 'Test Flow',
        valid: true,
        state: FlowVersionState.DRAFT,
        updatedBy: null,
        schemaVersion: '20',
        agentIds: [],
        connectionIds: [],
        backupFiles: null,
        notes: [],
        graphData,
        trigger: {
            name: 'trigger',
            type: 'PIECE_TRIGGER' as const,
            displayName: 'Test Trigger',
            valid: true,
            settings: {
                pieceName: 'webhook',
                pieceVersion: '1.0.0',
                triggerName: 'catch',
                input: {},
                inputUiInfo: {},
                propertySettings: {},
            },
        },
    }
}

/**
 * Создать BeginExecuteFlowOperation из FlowVersion.
 */
export function createMockExecuteFlowOperation(
    flowVersion: ReturnType<typeof createMockFlowVersion>,
    triggerPayload: unknown = {},
): BeginExecuteFlowOperation {
    return {
        projectId: 'projectId',
        engineToken: 'engineToken',
        internalApiUrl: 'http://127.0.0.1:3000/',
        publicApiUrl: 'http://127.0.0.1:4200/api/',
        timeoutInSeconds: 10,
        platformId: 'platformId',
        flowRunId: 'flowRunId',
        executionType: ExecutionType.BEGIN,
        runEnvironment: RunEnvironment.TESTING,
        executionState: { steps: {}, tags: [] },
        serverHandlerId: null,
        httpRequestId: null,
        progressUpdateType: ProgressUpdateType.NONE,
        stepNameToTest: null,
        triggerPayload,
        executeTrigger: false,
        flowVersion: flowVersion as any,
    }
}

/**
 * Загрузить fixture из JSON файла.
 * Ожидаемый формат fixture:
 * {
 *   name: string,
 *   flowDefinition: { displayName, graphData },
 *   triggerInput: unknown,
 *   expectedOutputs: Record<string, { status, output }>
 * }
 */
export type FixtureData = {
    name: string
    flowDefinition: {
        displayName: string
        graphData: GraphData
    }
    triggerInput: unknown
    mockHttpResponses?: Record<string, { status: number; body: unknown }>
    expectedOutputs: Record<string, { status: string; output: unknown }>
}

/**
 * Загрузить и валидировать fixture.
 */
export function loadFixture(fixtureData: unknown): FixtureData {
    const data = fixtureData as FixtureData
    if (!data.name || !data.flowDefinition || !data.flowDefinition.graphData) {
        throw new Error(`Invalid fixture: missing required fields (name, flowDefinition.graphData)`)
    }
    return data
}
