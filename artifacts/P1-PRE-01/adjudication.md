# Adjudication — P1-PRE-01

**Plan:** P1-PRE-01/draft_plan.md
**Review:** P1-PRE-01/plan_review.md
**Reviewer Verdict:** APPROVED

| # | Reviewer Comment (summary) | Decision | Justification |
|---|---------------------------|----------|---------------|
| 1 | [MINOR] AC commands use hardcoded grep/tsc instead of {commands.*} | ACCEPT | Implementation note: AC-1 and AC-7 will use `{commands.syntax_check}` reference. grep commands have no project_config equivalent; hardcoded grep is acceptable per reviewer's own assessment. |
| 2 | [RECOMMENDED] Pre-mortem #3: Add runtime test for FlowVersion.parse() without canvasLayout field | ACCEPT | Implementation note: Add test `test_canvasLayout_field_omitted` to DP-TEST that verifies FlowVersion.parse() succeeds when canvasLayout is absent from input data. This is critical for backward compatibility. |
| 3 | [RECOMMENDED] Pre-mortem #4: Add test for CanvasLayout.parse() nested position validation | ACCEPT | Implementation note: Add test `test_canvasLayout_validates_position_structure` to DP-TEST that verifies CanvasLayout.parse() accepts correct `{ positions: { 'step_1': { x: 100, y: 200 } } }` and rejects invalid data like `{ positions: { 'step_1': 'bad' } }`. |
| 4 | [NOTE] Server entity changes are correctly out of scope | ACCEPT | Acknowledged. No plan change needed. |

### Implementation Notes

Changes to draft plan based on accepted comments:

1. **[AC-1, AC-7]** — Replace hardcoded `npx tsc --noEmit` with reference to `{commands.syntax_check}` in acceptance criteria descriptions.
2. **[DP-TEST]** — Add `test_canvasLayout_field_omitted` test: FlowVersion.parse() succeeds when input has no canvasLayout field.
3. **[DP-TEST]** — Add `test_canvasLayout_validates_position_structure` test: CanvasLayout.parse() correctly validates nested x/y numbers and rejects invalid structures.

### Unresolved Items

None.
