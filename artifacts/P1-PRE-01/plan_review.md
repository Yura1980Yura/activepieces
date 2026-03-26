# Plan Review — P1-PRE-01

## Metadata
- Profile: standard
- Date: 2026-03-27
- Reviewer: subprocess (clean context)

## DP Section Verification

| Section | Required (standard) | Present | Status |
|---------|-------------------|---------|--------|
| DP-1 | YES | YES | OK |
| DP-2 | YES | YES | OK |
| DP-5 | YES | YES | OK |
| DP-TEST | YES | YES | OK |
| DP-MIGRATE | YES | YES | OK |

All required sections present.

## DP-5 Deep Validation

| AC | CHECK 1 (executable cmd) | CHECK 2 (concrete expected) | CHECK 3 (deterministic) | CHECK 4 (testable) | Status |
|----|--------------------------|----------------------------|------------------------|-------------------|--------|
| AC-1 | PASS — uses `npx tsc --noEmit` | PASS — exit code 0 | PASS — machine verifiable | PASS — tsc available | OK |
| AC-2 | PASS — uses `grep` | PASS — 1+ matches | PASS — count check | PASS — runnable | OK |
| AC-3 | PASS — uses `grep` | PASS — 2+ matches | PASS — count check | PASS — runnable | OK |
| AC-4 | PASS — uses `grep` | PASS — 2+ matches | PASS — count check | PASS — runnable | OK |
| AC-5 | PASS — uses `grep` with pipe | PASS — 1 match | PASS — count check | PASS — runnable | OK |
| AC-6 | PASS — uses `grep -A5` | PASS — 2 matches | PASS — count check | PASS — runnable | OK |
| AC-7 | PASS — uses `npx tsc --noEmit` | PASS — 0 new errors | PASS — count check | PASS — runnable | OK |

**NOTE:** AC commands use hardcoded `grep` and `npx tsc --noEmit` instead of `{commands.*}` references from project_config. However, the project_config defines `syntax_check: "npx tsc --noEmit"`, so AC-1 and AC-7 should reference `{commands.syntax_check}`. The grep commands have no direct equivalent in project_config. This is a MINOR issue — the commands are still deterministic and runnable.

## Phase 0 Verification

- DFC: **PASS** — Executed for both MODIFY-files, no divergences found (documented)
- RC-1: **PASS** — Executed for both MODIFY-files, no missing resources (documented)

## Pre-Mortem Table

| # | What to cheat | How to detect | What to add to plan |
|---|---------------|---------------|---------------------|
| 1 | **Stub canvasLayout field** — add the field to the zod schema but with wrong type (e.g., `z.any()` instead of the proper CanvasLayout schema) | AC-6 checks for `positions` and `viewport` in the definition. Also CC-02 bans `any`. | Strengthen AC-6: verify the CanvasLayout uses `z.record()` for positions (not z.any). Already partially covered. RECOMMENDED. |
| 2 | **Missing case in switch** — add enum member and request type but forget to add the case in `flowOperations.apply()`, leaving the default break to silently no-op | AC-5 explicitly checks for `case.*UPDATE_CANVAS_LAYOUT` in the switch statement. | Already covered by AC-5. No addition needed. |
| 3 | **canvasLayout not nullable** — define as required field, breaking all existing FlowVersion objects that lack it | AC-7 checks backward compatibility via tsc. However, tsc only checks type-level compat, not runtime zod parse. | ADD: a test that FlowVersion.parse() succeeds with a valid flow that has NO canvasLayout field (runtime backward compat). REQUIRED ADDITION if not covered in DP-TEST. |
| 4 | **Partial schema definition** — CanvasLayout positions uses `z.any()` for position values instead of `z.object({ x: z.number(), y: z.number() })` | AC-6 checks for `positions` and `viewport` keywords but not the nested structure. | RECOMMENDED: Add a test or AC that validates CanvasLayout.parse() with specific position data `{ positions: { 'step_1': { x: 100, y: 200 } } }` returns the correct typed result. |

## RCC Results

### flow-version.ts (RCC: 5/5)

| Check | Result | Details |
|-------|--------|---------|
| Caller Update | PASS | canvasLayout is nullable optional — no caller changes needed |
| Test Update | PASS | DP-TEST lists test file for flow-version.ts |
| Config Update | PASS | No config files reference flow-version.ts structure directly |
| Import Update | PASS | No exports removed or renamed — only additions |
| Backward Compat | PASS | Field is nullable (Nullable) — backward compatible |

### operations/index.ts (RCC: 5/5)

| Check | Result | Details |
|-------|--------|---------|
| Caller Update | PASS | New enum member + union member — additive, no existing callers affected |
| Test Update | PASS | DP-TEST lists test file for operations |
| Config Update | PASS | No config references |
| Import Update | PASS | No exports removed/renamed |
| Backward Compat | PASS | New operation type is purely additive |

## Findings

1. **[MINOR]** AC commands use hardcoded `grep` and `npx tsc` instead of `{commands.*}` from project_config. Recommendation: use `{commands.syntax_check}` for tsc calls. grep has no project_config equivalent, so hardcoded grep is acceptable for this step.

2. **[RECOMMENDED]** Pre-mortem #3: Add a runtime test (not just tsc) that FlowVersion.parse() succeeds when canvasLayout field is absent from input. This validates backward compatibility at the zod level.

3. **[RECOMMENDED]** Pre-mortem #4: Add a test that CanvasLayout.parse() correctly validates nested position objects with x/y number fields, rejecting invalid data.

4. **[NOTE]** The plan correctly identifies that server entity changes (flow-version-entity.ts) are out of scope (P1-F02). No server-side migration is needed for this step since canvasLayout is only added to the shared type, not the DB column.

## Verdict

**APPROVED**

## Verdict Justification

The draft plan is structurally complete with all required DP sections for the standard profile. The acceptance criteria are executable and deterministic. The DFC and RC-1 were properly executed. The RCC checks pass for both MODIFY-files — all changes are additive and backward-compatible. The findings are minor (command references) and recommended improvements (additional test coverage for runtime parsing). No blocking issues found.
