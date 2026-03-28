# Draft Plan — P2-C01: E2E инфраструктура

## DP-1: GAP-ы шага

1. В архитектуре описан FlowTestClient класс с HTTP-вызовами к серверу, но реально engine-тесты (graph-flow-executor.test.ts и др.) работают НАПРЯМУЮ с executor-ами без HTTP. Нужен двухуровневый подход:
   - **Engine-level**: FlowTestClient оборачивает прямой вызов graphFlowExecutor (без сервера)
   - **Full E2E**: setupE2eEnvironment() для полных тестов (будущее, не в этом шаге)
2. Директория `tests/e2e/graph-engine/` не существует — нужно создать
3. Нет vitest config для E2E тестов graph-engine
4. Нет helpers для создания GraphData с разными топологиями (loop, router, fan-out)
5. Нет загрузчика fixtures

## DP-2: Расхождения spec vs код

- Архитектура описывает FlowTestClient с HTTP API (importFlow, executeFlow, getStoreValue), но engine тесты работают без сервера
- Решение: FlowTestClient будет engine-level wrapper (прямой вызов graphFlowExecutor), а не HTTP-клиент. Интерфейс сохранён (importFlow, executeFlow, getStepOutput) для совместимости с описанием сценариев C02-C07

## DP-3: OSS-референсы

- vitest (MIT) — test runner
- @activepieces/shared (Apache 2.0) — типы GraphData, buildAdjacencyMap
- Существующий test-helper.ts (packages/server/engine/test/handler/) — шаблон для mock-builders

## DP-4: Product-документы

- PHASE2_ARCHITECTURE.md §6 — архитектура E2E тестов
- PHASE2_ARCHITECTURE.md §6.3 — FlowTestClient спецификация
- PHASE2_ARCHITECTURE.md §6.4 — Golden fixtures формат

## DP-5: Acceptance Criteria

| AC | Критерий | Команда |
|----|----------|---------|
| AC-1 | Файл setup.ts существует и экспортирует FlowTestClient | `test -f tests/e2e/graph-engine/setup.ts && grep "export class FlowTestClient" tests/e2e/graph-engine/setup.ts` |
| AC-2 | Файл helpers.ts существует и экспортирует createMockGraphFlow | `test -f tests/e2e/graph-engine/helpers.ts && grep "export function createMockGraphFlow" tests/e2e/graph-engine/helpers.ts` |
| AC-3 | FlowTestClient имеет методы: create, executeFlow, getStepStatus, getStepOutput, cleanup | `grep -c "create\|executeFlow\|getStepStatus\|getStepOutput\|cleanup" tests/e2e/graph-engine/setup.ts` — >= 5 |
| AC-4 | createMockGraphFlow поддерживает типы CODE, LOOP, ROUTER | `grep -c "CODE\|LOOP\|ROUTER" tests/e2e/graph-engine/helpers.ts` — >= 3 |
| AC-5 | Smoke-тест проходит: `npx vitest run tests/e2e/graph-engine/smoke.test.ts` — 0 FAILED |
| AC-6 | TSC PASS: `npx tsc --noEmit` — 0 ошибок |

## DP-6: Тестовые требования

- smoke.test.ts: минимум 5 тестов проверяют работоспособность инфраструктуры
- Тесты должны проходить через engine vitest config (или собственный)
- Запуск: `npx vitest run tests/e2e/graph-engine/smoke.test.ts`

## DP-TEST: Test Extension Plan

| Runtime файл | Тестовый файл | Новые тесты |
|-------------|---------------|-------------|
| tests/e2e/graph-engine/setup.ts | tests/e2e/graph-engine/smoke.test.ts | FlowTestClient.create(), executeFlow(), getStepStatus/Output |
| tests/e2e/graph-engine/helpers.ts | tests/e2e/graph-engine/smoke.test.ts | createMockGraphFlow CODE, LOOP, ROUTER |

## DP-MIGRATE: MODIFY-файлы с consumers

Нет MODIFY-файлов. Все файлы CREATE.

| Действие | Файл | Описание |
|----------|------|----------|
| CREATE | tests/e2e/graph-engine/setup.ts | FlowTestClient класс |
| CREATE | tests/e2e/graph-engine/helpers.ts | createMockGraphFlow и другие helper-ы |
| CREATE | tests/e2e/graph-engine/smoke.test.ts | Smoke-тест инфраструктуры |
| CREATE | tests/e2e/graph-engine/vitest.config.ts | Конфигурация vitest для E2E |
