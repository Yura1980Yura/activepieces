/**
 * FlowTestClient — клиент для E2E тестов graph engine.
 *
 * Оборачивает прямой вызов graphFlowExecutor (engine-level),
 * без необходимости HTTP-сервера, Redis, BullMQ.
 *
 * Для сценариев C02-C07 предоставляет единый интерфейс:
 * - executeFlow(graphData, triggerPayload?) — запуск потока
 * - getStepStatus(stepName) — статус шага
 * - getStepOutput(stepName) — output шага
 * - getFlowStatus() — общий статус потока
 */
import {
    buildAdjacencyMap,
    FlowRunStatus,
    FlowVersionState,
    getNextNodeId,
    GraphData,
    ProgressUpdateType,
    RunEnvironment,
    StepOutput,
} from '@activepieces/shared'
import { EngineConstants } from '../../../packages/server/engine/src/lib/handler/context/engine-constants'
import { FlowExecutorContext } from '../../../packages/server/engine/src/lib/handler/context/flow-execution-context'
import { graphFlowExecutor } from '../../../packages/server/engine/src/lib/handler/graph-flow-executor'
import {
    createMockExecuteFlowOperation,
    createMockFlowVersion,
    FixtureData,
    loadFixture,
    MockGraphFlowOptions,
    createMockGraphFlow,
} from './helpers'

// ─── Типы результата ─────────────────────────────────────────────────

/** Результат исполнения потока — обёртка над FlowExecutorContext */
export type FlowExecutionResult = {
    /** Все шаги: stepName -> StepOutput */
    steps: Record<string, StepOutput>
    /** Вердикт исполнения */
    verdict: FlowExecutorContext['verdict']
    /** Длительность в ms */
    duration: number
    /** Получить статус конкретного шага */
    getStepStatus: (stepName: string) => string | undefined
    /** Получить output конкретного шага */
    getStepOutput: (stepName: string) => unknown
    /** Получить общий статус потока */
    getFlowStatus: () => FlowRunStatus
}

// ─── FlowTestClient ──────────────────────────────────────────────────

export class FlowTestClient {
    private constants: EngineConstants
    private lastResult: FlowExecutionResult | null = null

    private constructor(constants: EngineConstants) {
        this.constants = constants
    }

    /**
     * Создать инстанс FlowTestClient с EngineConstants по умолчанию.
     */
    static create(): FlowTestClient {
        const constants = new EngineConstants({
            platformId: 'test-platform',
            timeoutInSeconds: 30,
            flowId: 'test-flow',
            flowVersionId: 'flowVersionId',
            flowVersionState: FlowVersionState.DRAFT,
            flowRunId: 'test-flow-run',
            publicApiUrl: 'http://127.0.0.1:4200/api/',
            internalApiUrl: 'http://127.0.0.1:3000/',
            retryConstants: {
                maxAttempts: 2,
                retryExponential: 1,
                retryInterval: 1,
            },
            engineToken: 'test-engine-token',
            projectId: 'test-project',
            triggerPieceName: 'webhook',
            progressUpdateType: ProgressUpdateType.NONE,
            serverHandlerId: null,
            httpRequestId: null,
            resumePayload: undefined,
            runEnvironment: RunEnvironment.TESTING,
            stepNameToTest: undefined,
            stepNames: [],
        })

        return new FlowTestClient(constants)
    }

    /**
     * Исполнить поток с заданным GraphData.
     * Запускает graphFlowExecutor.executeGraph() напрямую (без HTTP сервера).
     */
    async executeFlow(graphData: GraphData, triggerPayload?: unknown): Promise<FlowExecutionResult> {
        const adjacency = buildAdjacencyMap(graphData)

        // Найти trigger ноду и первый action
        const triggerNode = graphData.nodes.find(n => n.type === 'trigger')
        if (!triggerNode) {
            throw new Error('GraphData не содержит trigger ноду')
        }
        const firstActionId = getNextNodeId(adjacency, triggerNode.id, 'output')

        // Запустить engine executor
        const executionState = FlowExecutorContext.empty()
        const result = await graphFlowExecutor.executeGraph({
            startNodeId: firstActionId,
            adjacency,
            executionState,
            constants: this.constants,
        })

        // Обернуть результат
        this.lastResult = this.wrapResult(result)
        return this.lastResult
    }

    /**
     * Исполнить поток из fixture данных.
     */
    async executeFromFixture(fixtureData: unknown): Promise<FlowExecutionResult> {
        const fixture = loadFixture(fixtureData)
        return this.executeFlow(fixture.flowDefinition.graphData, fixture.triggerInput)
    }

    /**
     * Получить статус конкретного шага из последнего результата.
     */
    getStepStatus(stepName: string): string | undefined {
        if (!this.lastResult) {
            throw new Error('Нет результата исполнения. Вызовите executeFlow() сначала.')
        }
        return this.lastResult.getStepStatus(stepName)
    }

    /**
     * Получить output конкретного шага из последнего результата.
     */
    getStepOutput(stepName: string): unknown {
        if (!this.lastResult) {
            throw new Error('Нет результата исполнения. Вызовите executeFlow() сначала.')
        }
        return this.lastResult.getStepOutput(stepName)
    }

    /**
     * Получить общий статус потока из последнего результата.
     */
    getFlowStatus(): FlowRunStatus {
        if (!this.lastResult) {
            throw new Error('Нет результата исполнения. Вызовите executeFlow() сначала.')
        }
        return this.lastResult.getFlowStatus()
    }

    /**
     * Очистка ресурсов (no-op для engine-level, заготовка для full E2E).
     */
    cleanup(): void {
        this.lastResult = null
    }

    /**
     * Обернуть FlowExecutorContext в удобный FlowExecutionResult.
     */
    private wrapResult(ctx: FlowExecutorContext): FlowExecutionResult {
        return {
            steps: ctx.steps as Record<string, StepOutput>,
            verdict: ctx.verdict,
            duration: ctx.duration,

            getStepStatus(stepName: string): string | undefined {
                const step = ctx.steps[stepName]
                return step?.status
            },

            getStepOutput(stepName: string): unknown {
                const step = ctx.steps[stepName]
                return step?.output
            },

            getFlowStatus(): FlowRunStatus {
                return ctx.verdict.status
            },
        }
    }
}
