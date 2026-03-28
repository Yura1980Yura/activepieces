# P2-D02 Final Plan: Предпросмотр output ноды

## DP-1: GAP-ы шага

1. Нет shared-утилит для определения наличия execution data у ноды
2. Нет типа NodeOutputPreviewData для структурирования данных предпросмотра
3. Нет shared-утилит для извлечения и форматирования данных ноды из FlowRun.steps
4. Нет shared-утилиты для truncation больших значений в output

## DP-2: Расхождения spec vs код

- `FlowStepInputOutput` в `web/src/app/builder/run-details/` уже реализует UI отображение input/output
- `flowRunUtils.extractStepOutput()` в `web/src/features/flow-runs/` реализует извлечение из run.steps
- `JsonViewer` в `web/src/components/custom/` использует `react-json-view` для collapsible JSON
- Утилиты исполнения overlay (`execution-overlay-utils.ts`) в shared — результат P2-D01
- **GAP**: нет shared-level утилит подготовки данных для предпросмотра ноды

## DP-5: Acceptance Criteria

- AC-1: Тип `NodeOutputPreviewData` экспортируется из `@activepieces/shared` и содержит поля: input, output, status, duration, errorMessage, stepName
- AC-2: Функция `extractNodeOutputPreview()` извлекает данные одной ноды из `Record<string, StepOutput>` и возвращает `NodeOutputPreviewData | null`
- AC-3: Функция `hasNodeExecutionData()` проверяет наличие данных исполнения для ноды
- AC-4: Функция `formatOutputPreviewValue()` truncates значения больше maxLength символов
- AC-5: Функция `getOutputPreviewSummary()` возвращает краткую сводку (кол-во ключей, размер массива, тип)
- AC-6: Все тесты проходят: `npx vitest run packages/shared/test/flow/node-output-preview-utils.test.ts`
- AC-7: `npx tsc --noEmit` PASS
- AC-8: Все существующие тесты не ломаются: `npx vitest run packages/shared/test`

## DP-TEST: Test Extension Plan

- Файл: `packages/shared/test/flow/node-output-preview-utils.test.ts`
- Тесты:
  1. NodeOutputPreviewData — структура типа
  2. extractNodeOutputPreview — нода существует → возвращает preview
  3. extractNodeOutputPreview — нода не существует → null
  4. extractNodeOutputPreview — нода с ошибкой → errorMessage
  5. extractNodeOutputPreview — нода RUNNING → status RUNNING
  6. hasNodeExecutionData — нода с output → true
  7. hasNodeExecutionData — нода без output → false
  8. hasNodeExecutionData — null/undefined runSteps → false
  9. formatOutputPreviewValue — строка короче maxLength → без изменений
  10. formatOutputPreviewValue — строка длиннее maxLength → truncated
  11. formatOutputPreviewValue — объект → JSON stringify + truncate
  12. formatOutputPreviewValue — null/undefined → строка 'null'/'undefined'
  13. getOutputPreviewSummary — объект с N ключами → "Object (N keys)"
  14. getOutputPreviewSummary — массив с N элементами → "Array (N items)"
  15. getOutputPreviewSummary — примитив → тип значения
  16. Интеграция: полный поток из StepOutput → extractNodeOutputPreview → formatOutputPreviewValue

## DP-MIGRATE: MODIFY-файлы с consumers

- CREATE: `packages/shared/src/lib/automation/flows/util/node-output-preview-utils.ts`
- CREATE: `packages/shared/test/flow/node-output-preview-utils.test.ts`
- MODIFY: `packages/shared/src/index.ts` (добавить export)

## СТОП-ПРАВИЛО

Если любой из следующих тестов не проходит — STOP и исправить:
- `npx vitest run packages/shared/test/flow/node-output-preview-utils.test.ts`
- `npx tsc --noEmit`
- `npx vitest run packages/shared/test`
