# Payroll Adjustments — Planning Reference

**Status:** Plan only — not implemented  
**Created:** July 2026  
**Purpose:** Step-by-step blueprint for *previous-period corrections applied in the current payroll*. Use this document before writing code.

---

## 1. Problem statement

Professional payroll specialists often need to **correct a committed prior period** without re-opening or editing that period’s submission. The correction must:

1. Land on the **current** payroll run (employee net pay this period).
2. Show a **clear audit trail**: what was submitted, what should have been, and the delta.
3. Keep **YTD, tax credits, and cumulative basis** consistent after the fix.

Today the app has **no adjustment layer**:

| Capability today | Location | Gap |
|------------------|----------|-----|
| Immutable committed runs | `state-machine.js` → `performCommit` | No correction path except LIFO rollback of *last* commit |
| YTD = sum of prior entries | `payroll-payslip.js` → `computeYTD` | No adjustment deltas |
| Payslip breakdown = this period only | `payroll-payslip.js` → `buildBreakdownSteps` | No “Period 12 correction” section |
| TC ledger on commit | `payroll-run.js` → `confirmAndSaveRun` | No retroactive TC/COP correction |
| Frozen RPN at commit | `confirmAndSaveRun` → `rpnSnapshot` on entry | **Ready to reuse** for recalculation |

---

## 2. Core rule (previous → current)

```
┌─────────────────────┐     read-only      ┌──────────────────────┐
│ Prior period run    │ ─────────────────► │ Recalculate correct  │
│ (e.g. period 12)    │                    │ values for that period│
└─────────────────────┘                    └──────────┬───────────┘
                                                      │
                                                      ▼ delta
                                           ┌──────────────────────┐
                                           │ Current period run   │
                                           │ (e.g. period 15)     │
                                           │ + adjustment records │
                                           └──────────────────────┘
```

- **Never** mutate a committed/submitted run.
- **Always** attach adjustments to the payroll being processed *now*.
- **Default method:** recalculate the target period, store `delta = corrected − original`.

---

## 3. Use case map

Each row maps a real bureau scenario → inputs → stored fields → payslip lines → side effects.

### 3.1 Hours / gross correction (most common)

**Scenario:** Week 12 paid 35 hours; should have been 40. Fix in week 15.

| Step | Detail |
|------|--------|
| **Trigger** | History → expand run 202612 → “Add adjustment” on employee |
| **User edits** | `regularHours`: 35 → 40 (or direct `grossPay` override with reason) |
| **Recalc inputs** | Target entry `rpnSnapshot`, YTD **as at end of period 11**, same `payFrequency` / basis |
| **Delta fields** | `delta.grossPay`, `delta.paye`, `delta.usc`, `delta.prsi`, `delta.employerPrsi`, `delta.netPay` |

**Example (weekly €18.72/hr, cumulative):**

| | Original (P12) | Correct (P12) | Δ on P15 payslip |
|---|----------------|---------------|------------------|
| Gross | €655.20 | €748.80 | +€93.60 |
| PAYE | €54.12 | €68.44 | +€14.32 |
| USC | €10.93 | €12.18 | +€1.25 |
| PRSI | €27.52 | €31.45 | +€3.93 |
| Net (P12) | €562.64 | €636.73 | *(informational only)* |

**Payslip lines (current period section):**

```
Prior period adjustments
  Adjustment — Period 202612 (Pay date 18-Dec-26)
  Reason: Hours correction (35h → 40h)
    Gross insurable earnings correction    +€93.60
    PAYE correction                        +€14.32
    USC correction                         +€1.25
    PRSI correction                        +€3.93
```

**Net pay impact this period:** Normal net − €14.32 − €1.25 − €3.93 (deductions increase; gross correction is insurable, not paid again as cash).

---

### 3.2 Missed overtime in prior period

**Scenario:** Overtime omitted from week 8; discovered in week 15.

| Step | Detail |
|------|--------|
| **User edits** | `overtimeHours`: 0 → 5, `hourlyRate`, `overtimeMultiplier` |
| **Delta fields** | Same as 3.1; breakdown steps show overtime equation |
| **Payslip reason** | `MISSED_OVERTIME` — “Overtime correction (0h → 5h)” |

**Breakdown (collapsible):** Reuse `buildBreakdownSteps` for corrected side with “Overtime Pay” step.

---

### 3.3 Pension / BIK omission

**Scenario:** Pension deduction missed in month 3; fix in month 6.

| Step | Detail |
|------|--------|
| **User edits** | `pensionDeduction`, `bikAmount` on target period |
| **Recalc** | Taxable gross = gross − pension + BIK → PAYE/USC/PRSI |
| **Delta fields** | `delta.pensionDeduction`, `delta.bikAmount`, plus tax deltas |
| **Payslip lines** | Separate lines for taxable gross correction and each tax |

**Note:** Pension may reduce employee net in the *prior* period logic but the **cash effect** still nets through current period tax deltas.

---

### 3.4 RPN / tax credits wrong in prior period (cumulative)

**Scenario:** RPN updated after week 10 was submitted with old annual TC; fix cumulative position in week 15.

| Step | Detail |
|------|--------|
| **User action** | Select target period → choose “Recalculate with corrected RPN” (pick RPN version or manual TC/COP) |
| **Recalc** | Full cumulative PAYE for target period using corrected credits and YTD before target |
| **Extra fields** | `cumulativeImpact.taxCreditsUsed`, `cumulativeImpact.copUsed` |
| **Ledger on commit** | Adjust `taxCreditsLedger` — add/subtract TC used vs what was recorded |

**Payslip — cumulative reconciliation block:**

```
Cumulative reconciliation (specialist view)
  Tax credits reported YTD (before adj):     €769.20
  Adjustment — Period 202610 TC correction:  +€76.92
  Revised cumulative tax credits:            €846.12
```

**Payslip — employee-facing line:**

```
  PAYE correction (Period 202610, RPN update)   −€12.50
```

---

### 3.5 Week 53 prior period correction

**Scenario:** Week 53 run treated as cumulative by mistake; should be Week 53 forced Week 1.

| Step | Detail |
|------|--------|
| **Detection** | `isWeek53PayrollEntry` / `payeMode` on target entry |
| **Recalc** | `WEEK_53_FORCED_W1` path via `PayrollWeek53` + `calculatePAYE` |
| **TC rule** | Week 53 credit does **not** add to cumulative TC YTD (`getTaxCreditsUsedForCumulativeYtd` = 0) |
| **Payslip basis label** | “Week 53” on adjustment breakdown |

---

### 3.6 Emergency tax prior period

**Scenario:** Employee left emergency in week 4 but week 4 was still emergency-taxed; RPN applied from week 5.

| Step | Detail |
|------|--------|
| **Recalc** | Normal cumulative PAYE for week 4 using RPN snapshot that should have applied |
| **Delta** | Often large PAYE **refund** (negative PAYE delta) |
| **Payslip reason** | `EMERGENCY_TO_NORMAL` |

---

### 3.7 Employer PRSI only

**Scenario:** Employee amounts correct; employer PRSI class wrong for week 7.

| Step | Detail |
|------|--------|
| **Delta fields** | `delta.employerPrsi` only (employee lines zero) |
| **Payslip** | Employer cost section / specialist export — not always on employee payslip |
| **PSR** | Employer PRSI correction in current submission |

---

### 3.8 Multiple prior periods in one current run

**Scenario:** Fix weeks 10 and 12 together in week 15.

| Step | Detail |
|------|--------|
| **Storage** | `entry.adjustments[]` — one object per target period |
| **Payslip** | Stacked sub-blocks, one per adjustment |
| **Totals** | `entry.adjustmentPaye = sum(adj.delta.paye)` etc. |

---

### 3.9 Cross-year correction (out of scope for Phase 1)

**Scenario:** 2025 error corrected in 2026 pay.

| Step | Detail |
|------|--------|
| **Phase 1** | Document as unsupported; show warning |
| **Later** | Separate tax year on adjustment; PSR year boundary rules |

---

## 4. What is NOT an adjustment

| Action | Correct flow today / planned |
|--------|------------------------------|
| Fix before commit | Edit preview or don’t commit |
| Undo last commit | `performRollback` (LIFO only) |
| Replace submitted period in-place | **Not supported** — use delta on later period |
| One-off payment with no prior link | Future “Other payment” type (different model) |
| Same-period correction after commit | Rollback if last run, else adjustment to *current* period pointing at same period number (edge case — defer Phase 2) |

---

## 5. Data model (planned)

### 5.1 Adjustment record

Attached to **current run entry** as `adjustments[]`:

```javascript
{
  id: "uuid",
  status: "draft" | "committed",

  // Target (read-only reference)
  targetRunId: "uuid",
  targetPeriodNumber: 12,
  targetPayDate: "2026-12-18",
  targetPayFrequency: "weekly",

  // Classification
  reasonCode: "HOURS" | "OVERTIME" | "PENSION_BIK" | "RPN_TC" | "WEEK_53" | "EMERGENCY" | "EMPLOYER_PRSI" | "OTHER",
  reasonNotes: "Free text for payslip / audit",

  // Snapshots (all monetary values per period)
  original: {
    grossPay, regularHours, overtimeHours, hourlyRate,
    pensionDeduction, bikAmount,
    paye, usc, prsi, employerPrsi,
    taxCreditsUsed, copUsed,
    payeMode, isWeek53Run,
    netPay, totalDeductions
  },

  corrected: { /* same shape — full recalc result */ },

  delta: {
    grossPay, pensionDeduction, bikAmount,
    paye, usc, prsi, employerPrsi,
    taxCreditsUsed, copUsed,
    netPay, totalDeductions
  },

  cumulativeImpact: {
    taxCreditsUsedYtd: 0,   // change to reported cumulative TC
    copUsedYtd: 0
  },

  breakdown: {
    originalSteps: [],        // from buildBreakdownSteps
    correctedSteps: []
  },

  method: "recalculate" | "manual_override",
  createdAt: "ISO-8601"
}
```

### 5.2 Extended current-period entry (planned)

Keep **this period** and **adjustments** separate:

```javascript
{
  // Existing fields — THIS PERIOD ONLY (unchanged semantics)
  grossPay: 655.20,
  paye: 54.12,
  usc: 10.93,
  prsi: 27.52,
  netPay: 562.64,

  // New rollup fields (computed at preview / commit)
  adjustmentGross: 93.60,
  adjustmentPaye: 14.32,
  adjustmentUsc: 1.25,
  adjustmentPrsi: 3.93,
  adjustmentNet: -19.50,

  // Reported totals (for YTD, PSR, payslip summary)
  grossPayReported: 748.80,      // grossPay + adjustmentGross
  payeReported: 68.44,           // paye + adjustmentPaye
  netPayReported: 543.14,        // netPay + adjustmentNet

  adjustments: [ /* Adjustment record(s) */ ]
}
```

**Rule:** Do not hide adjustments inside `grossPay` / `paye` alone — always keep `adjustments[]` for breakdown.

### 5.3 Run-level metadata (planned)

```javascript
{
  hasAdjustments: true,
  adjustmentCount: 2,
  adjustmentSummary: {
    totalPayeDelta: 14.32,
    totalNetDelta: -19.50
  }
}
```

---

## 6. UI flow (planned)

### 6.1 Entry points

| Location | Action |
|----------|--------|
| `payroll-history.js` — expanded run | “Add adjustment” per employee row |
| `payroll-run.js` — current preview | “Adjustments” panel listing pending adjustments for this run |

### 6.2 Adjustment modal (wizard)

1. **Select target** — employee (pre-filled if from history), period, run (dropdown of committed/submitted runs).
2. **Show original** — read-only table from committed entry.
3. **Edit corrections** — hours, gross components, pension, BIK; or “Apply corrected RPN”.
4. **Preview delta** — three-column table (Original | Correct | Δ this period).
5. **Preview breakdown** — tabs: Original steps | Corrected steps.
6. **Confirm** — adds to `PayrollContext.currentRunData` adjustment draft; requires current payroll preview recalc.

### 6.3 Validation rules

| Rule | Message |
|------|---------|
| Target run must be `committed` or `submitted` | Cannot adjust draft |
| Target period < current period | “Adjustments apply to prior periods only” (Phase 1) |
| Duplicate adjustment same target | Warn; allow replace or stack with reason |
| `manual_override` on PAYE | “Not recommended for submission” badge |
| Cross-year target | Block in Phase 1 |

---

## 7. Calculation pipeline (planned)

New module: `payroll/adjustments.js` (pure functions, fully tested).

```
buildAdjustmentPreview(targetEntry, targetRun, corrections, context)
  │
  ├─ loadYtdBeforeTarget(employeeId, targetPeriodNumber)
  ├─ recalculateTargetPeriod(targetEntry, corrections, ytdBefore, rpnSnapshot)
  ├─ computeDelta(original, corrected)
  ├─ computeCumulativeImpact(original, corrected, ledger)
  └─ buildBreakdownPair(original, corrected)
```

### 7.1 YTD before target

- Sum all **submitted** runs with `periodNumber < targetPeriodNumber`.
- Include **prior committed adjustments** from earlier current-period runs (adjustment deltas already applied).
- Exclude target period and later periods.
- Week 53: use `getTaxCreditsUsedForCumulativeYtd` (exclude Week 53 TC from cumulative).

### 7.2 Recalculate target period

- Use frozen `rpnSnapshot` from target entry unless user selects “corrected RPN”.
- Call existing engines: `calculatePAYE`, `calculateNetFromGross` with period-appropriate basis.
- Do **not** use current employee RPN blindly — snapshot preserves audit defensibility.

### 7.3 Apply to current run

```
applyAdjustmentsToEntry(currentEntry, adjustments[])
  → rollup adjustment* fields
  → netPayReported = netPay + adjustmentNet
```

### 7.4 Commit side effects

On `confirmAndSaveRun`:

1. Persist `adjustments[]` on entries.
2. `PayrollTax.applyAdjustmentLedgerCorrections(ledger, adjustments)` — TC/COP fixes.
3. YTD on payslip uses **reported** totals including prior adjustment deltas.

---

## 8. Payslip layout (planned)

### 8.1 Section order

1. Employee / company header (existing)
2. **This period** — gross, deductions, net (existing)
3. **Prior period adjustments** — new section (if `adjustments.length > 0`)
4. **Summary** — net pay this period including adjustments
5. **YTD** — reported figures including all committed adjustment deltas
6. **Calculation breakdown** — this period steps, then per-adjustment collapsible blocks
7. **Cumulative reconciliation** — specialist collapsible (RPN/TC adjustments only)

### 8.2 Full payslip example (week 15 with week 12 hours fix)

```
Gross Earnings (this period)
  Basic Pay    35 hrs × €18.72    €655.20
  Total Pay                         €655.20

Prior period adjustments
  Period 202612 (18-Dec-26) — Hours correction (35h → 40h)
    PAYE correction                 +€14.32
    USC correction                  +€1.25
    PRSI correction                 +€3.93

Deductions (this period + adjustments)
  PAYE          €54.12 + €14.32 = €68.44
  USC           €10.93 + €1.25  = €12.18
  PRSI          €27.52 + €3.93  = €31.45

Net Pay                           €543.14
```

### 8.3 Employee card preview

Mirror the same structure in `buildEmployeeCardPayslipHtml` — abbreviated adjustment lines.

---

## 9. Ledger, YTD, and submission impact

| System | Phase 1 | Phase 2 |
|--------|---------|---------|
| `taxCreditsLedger` | Read-only display of impact | Write TC/COP corrections on commit |
| `computeYTD` | Add sum of `adjustment*` from prior runs | Same |
| PSR payload (`payroll-submission.js`) | Optional `adjustments` metadata array | Revenue-aligned adjustment codes |
| Exports (CSV/Excel) | Extra columns: adjustment PAYE/USC/PRSI | Adjustment reason codes |

---

## 10. Implementation plan (step by step)

**Do not skip ordering** — each step is mergeable and testable alone.

### Phase 0 — Design sign-off (current step)

- [x] Document use cases and data model (this file)
- [ ] Review with stakeholder: payslip wording, Phase 1 scope, manual override policy
- [ ] Confirm Phase 1 excludes cross-year and same-period edge cases

### Phase 1a — Core engine (no UI)

| Step | Task | Tests |
|------|------|-------|
| 1.1 | Create `payroll/adjustments.js` with `computeDelta`, `rollupAdjustments` | Unit |
| 1.2 | `loadYtdBeforeTarget(employeeId, targetPeriod, runs)` | Unit — fixture runs |
| 1.3 | `recalculateTargetPeriod` for **hours/gross** only (cumulative weekly) | Unit — match manual calc |
| 1.4 | `buildAdjustmentPreview` end-to-end for use case 3.1 | Integration |

**Exit criteria:** Given fixture committed run + correction hours, preview delta matches spreadsheet.

### Phase 1b — Storage shape (no UI)

| Step | Task |
|------|------|
| 2.1 | Extend committed entry type with optional `adjustments[]` (backward compatible) |
| 2.2 | Extend preview `PayrollContext.currentRunData` with `pendingAdjustments` |
| 2.3 | `confirmAndSaveRun` persists adjustments; does not alter target runs |

### Phase 1c — Minimal UI

| Step | Task |
|------|------|
| 3.1 | History: “Add adjustment” button → modal (hours correction only) |
| 3.2 | Run preview: list pending adjustments + three-column delta table |
| 3.3 | Recalculate preview totals with `*Reported` fields |

### Phase 1d — Payslip

| Step | Task |
|------|------|
| 4.1 | New payslip section “Prior period adjustments” |
| 4.2 | Collapsible breakdown per adjustment (corrected side) |
| 4.3 | Summary net includes adjustment net delta |
| 4.4 | YTD includes prior committed adjustment deltas |

**Exit criteria:** Noah Walsh week 12 hours fix in week 15 — payslip shows labelled lines and correct net.

### Phase 2 — Tax credit / RPN corrections

| Step | Task |
|------|------|
| 5.1 | `cumulativeImpact` on adjustment record |
| 5.2 | Ledger write-back on commit |
| 5.3 | Payslip “Cumulative reconciliation” block |
| 5.4 | Use cases 3.4, 3.5, 3.6 |

### Phase 3 — Submission and exports

| Step | Task |
|------|------|
| 6.1 | PSR payload adjustment extension |
| 6.2 | CSV/Excel adjustment columns |
| 6.3 | Adjustment report per company (audit export) |

### Phase 4 — Edge cases and safety

| Step | Task |
|------|------|
| 7.1 | Multi-adjustment stacking (3.8) |
| 7.2 | Adjustment reversal (negative adjustment record) |
| 7.3 | Cross-year (3.9) with warnings |
| 7.4 | Employer PRSI only (3.7) |

---

## 11. Files to touch (when implementing)

| File | Role |
|------|------|
| `payroll/adjustments.js` | **New** — preview, delta, rollup |
| `payroll/payroll-history.js` | Add adjustment entry point |
| `payroll/payroll-run.js` | Preview panel, commit persistence, totals |
| `payroll/payroll-payslip.js` | Sections, YTD, breakdown |
| `payroll/payroll-tax.js` | Ledger corrections (Phase 2) |
| `payroll/payroll-submission.js` | PSR metadata (Phase 3) |
| `payroll/payroll-exports.js` | Export columns (Phase 3) |
| `payroll/storage.js` | Validation helpers if needed |
| `tests/payroll/adjustments.test.js` | **New** — primary test suite |
| `docs/implemented/architecture.md` | Link to this plan when implemented |

---

## 12. Open decisions (resolve before Phase 1a code)

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Can one adjustment target a **submitted** period after period advanced? | Yes / No | **Yes** — primary use case |
| 2 | Manual PAYE override allowed in Phase 1? | No / Yes with flag | **No** — recalculate only in Phase 1 |
| 3 | Show insurable gross correction on employee payslip? | Yes / specialist only | **Yes** — as non-cash informational line |
| 4 | Negative net adjustment (refund) display | Separate “Refund” line vs negative deduction | **Negative deduction** with reason |
| 5 | Stack two adjustments for same target period? | Replace / Stack | **Stack** with warning on commit |

---

## 13. Test scenarios (acceptance checklist)

Use **Sandbox Ltd / weekly Thursday / 2026** as default fixture where possible.

| ID | Scenario | Input | Expected delta |
|----|----------|-------|----------------|
| T1 | Hours 35→40 week 12, apply week 15 | +5h × €18.72 | Gross +€93.60; PAYE/USC/PRSI increase |
| T2 | Missed 3h overtime week 8 | overtimeHours 0→3 | Overtime gross at 1.5× rate |
| T3 | Two adjustments one run | T1 + week 10 fix | Two payslip sub-blocks; summed rollups |
| T4 | Week 53 misclassified | Force WEEK_53 recalc | TC cumulative unchanged; Week 53 line |
| T5 | RPN TC correction | Higher annual TC for week 10 | PAYE delta + cumulative TC block |
| T6 | Employer PRSI only | employer class fix | employee delta zero; employer delta non-zero |
| T7 | Committed adjustment in YTD | Commit T1 in week 15; view week 16 payslip | Week 15 adjustment in YTD totals |

---

## 14. Related reading

- `docs/implemented/architecture.md` — module map, commit flow, Week 53
- `payroll/payroll-run.js` — `confirmAndSaveRun`, entry shape, ledger update
- `payroll/payroll-payslip.js` — `computeYTD`, `buildBreakdownSteps`
- `payroll/week53.js` — Week 53 adjustment recalc
- `payroll/payroll-submission.js` — PSR employee line shape

---

## 15. Changelog

| Date | Change |
|------|--------|
| 2026-07-05 | Initial plan — use case map, data model, phased steps (no implementation) |