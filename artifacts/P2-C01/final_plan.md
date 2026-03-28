# Final Plan — P2-C01: E2E инфраструктура

## СТОП-ПРАВИЛО

Если TSC не проходит или smoke-тесты падают — остановить, исправить, повторить.

## Решение

Engine-level FlowTestClient: оборачивает прямой вызов graphFlowExecutor.executeFromTrigger() и graphFlowExecutor.executeGraph(). Не требует HTTP-сервера, Redis, BullMQ. Быстрый, детерминированный.

## Файлы для создания

### 1. tests/e2e/graph-engine/vitest.config.ts

Копировать из packages/server/engine/vitest.config.ts с модификацией include path.

### 2. tests/e2e/graph-engine/helpers.ts

- `createMockGraphFlow(opts)` — создать GraphData с trigger + N действий
  - Поддержка CODE, LOOP_ON_ITEMS, ROUTER типов
  - Автоматическое создание edges (trigger->action1->action2...)
  - Поддержка loop-body (sourceHandle: 'loop-output')
  - Поддержка router branches (sourceHandle: 'branch-N')
- `createMockFlowVersion(graphData)` — обернуть GraphData в FlowVersion
- `createMockExecuteFlowOperation(flowVersion)` — создать полный input для executor
- `loadFixture(fixturePath)` — загрузить JSON fixture из files

### 3. tests/e2e/graph-engine/setup.ts

- `FlowTestClient` класс:
  - `static create()` — инициализация (EngineConstants)
  - `executeFlow(graphData, triggerPayload?)` — запуск graphFlowExecutor
  - `getStepStatus(stepName)` — получить статус шага из результата
  - `getStepOutput(stepName)` — получить output шага из результата
  - `getFlowStatus()` — общий статус flow (RUNNING/SUCCEEDED/FAILED)
  - `cleanup()` — очистка (no-op для engine-level, заготовка для full E2E)

### 4. tests/e2e/graph-engine/smoke.test.ts

Минимум 5 тестов:
1. FlowTestClient.create() возвращает инстанс
2. executeFlow с одной CODE нодой — step output корректен
3. executeFlow с двумя CODE нодами — оба шага исполнены
4. executeFlow с LOOP нодой — loop итерирует
5. executeFlow с ROUTER нодой — router направляет

## Test Extension Plan

| Runtime | Test | Новые тесты |
|---------|------|-------------|
| setup.ts | smoke.test.ts | 5+ тестов |
| helpers.ts | smoke.test.ts | Используется косвенно через FlowTestClient |

## Acceptance Criteria

AC-1..AC-6 из Draft Plan (без изменений).
