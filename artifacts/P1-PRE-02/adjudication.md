## Adjudication — P1-PRE-02

**Plan:** P1-PRE-02/draft_plan.md
**Review:** P1-PRE-02/plan_review.md
**Reviewer Verdict:** APPROVED

| # | Reviewer Comment (summary) | Decision | Justification |
|---|---------------------------|----------|---------------|
| 1 | (pre-mortem REQUIRED) Round-trip tests must use non-trivial flows (loops, routers) | ACCEPT | Implementation note: AC-3 test suite will include at minimum 3 flow patterns: linear chain, flow with loop, flow with router+branches |
| 2 | (pre-mortem REQUIRED) AC-4 must verify firstLoopAction and children[] in graphToLinkedList | ACCEPT | Implementation note: graphToLinkedList tests must assert firstLoopAction is set for Loop, children[] has correct length for Router |
| 3 | (pre-mortem RECOMMENDED) AC-5 should verify spatial Y ordering | ACCEPT | Implementation note: auto-layout test will verify Y positions are in ascending order for linear chain nodes |
| 4 | (pre-mortem RECOMMENDED) Add edge count verification | ACCEPT | Implementation note: converter tests will verify edge count matches expected for each pattern |
| 5 | (observation) File placement diverges from architecture doc | ACCEPT | The shared package placement is architecturally correct — these are pure data transformations with no web dependencies. The architecture doc will be updated in Phase 2 commit (T-9) to reflect actual placement. Evidence: `flow-canvas-util.ts` already lives in shared/util/ with the same pattern. |

### Implementation Notes

Changes to draft plan based on accepted comments:

1. **AC-3 (round-trip)** — test suite expanded to require minimum 3 flow patterns: (a) 3-step linear chain, (b) flow with LoopOnItems + child action, (c) flow with Router + 2 branches with children
2. **AC-4 (action types)** — graphToLinkedList tests must assert: Loop.firstLoopAction is populated, Router.children[] has correct length and correct child actions
3. **AC-5 (auto-layout)** — test must verify Y position ordering: for a 3-node linear chain, node[0].y < node[1].y < node[2].y with spacing >= 80px
4. **All converter tests** — include edge count assertion per flow pattern
5. **Architecture doc update** — T-9 will update File Structure to reflect shared/util/ placement

### Unresolved Items

(none)
