# Adjudication — P1-F01

**Plan:** P1-F01/draft_plan.md
**Review:** P1-F01/plan_review.md
**Reviewer Verdict:** APPROVED (with recommendations)

| # | Reviewer Comment (summary) | Decision | Justification |
|---|---------------------------|----------|---------------|
| 1 | R-1: Plan must explicitly state flowCanvasHooks import is preserved | ACCEPT | Implementation note: Add explicit preservation list to final plan — flowCanvasHooks.useShowBuilderIsSavingWarningBeforeLeaving, flowCanvasHooks.useSetSocketListener, flowCanvasHooks.useListenToExistingRun, flowCanvasHooks.useAnimateSidebar are all preserved. Import from './flow-canvas/hooks' remains. |
| 2 | R-2: AC-9 threshold >= 15 is tight, suggest >= 12 | REJECT | Evidence: DP-TEST lists 15 specific test names, each testing a distinct behavior. Reducing to 12 would allow skipping 3 tests which could miss coverage. The 15 count is achievable as each test is simple (most are grep/presence checks on shared utility output). |
| 3 | PM-1: Document that widgets are preserved as siblings and work via useBuilderStateContext | ACCEPT | Implementation note: Add explicit note to final plan that PublishFlowReminderWidget, RunInfoWidget, ViewingOldVersionWidget remain as siblings of GraphCanvas inside the middle panel div, using useBuilderStateContext independently. |
| 4 | PM-3: Add structural verification that onNodeClick is wired to selectStepByName | ACCEPT | Implementation note: Strengthen AC-4 to verify the connection. Add to final plan: the onNodeClick handler in builder/index.tsx must call selectStepByName, which can be verified by grepping the handler function body. |

### Implementation Notes

Changes to draft plan based on accepted comments:

1. **[Preservation List]** — Add explicit section listing all preserved flow-canvas imports: `flowCanvasHooks` (hooks.tsx for save warning, socket, run listener, sidebar animation), `flowCanvasConsts` (consts.ts for SIDEBAR_ANIMATION_DURATION), widgets (PublishFlowReminderWidget, RunInfoWidget, ViewingOldVersionWidget).
2. **[Widget Architecture]** — Document that widgets remain siblings of GraphCanvas in the middle panel, using useBuilderStateContext directly, not FlowCanvas internals.
3. **[AC-4 Strengthened]** — The onNodeClick handler must reference selectStepByName from builder state context.

### Unresolved Items

(none)
