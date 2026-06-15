# Payroll Project — Refactor & Split Guide

**Project:** NetToGros_Qoder  
**Date:** June 2026  
**Scope:** Analysis of oversized files and recommended improvements for the payroll app and related codebase.

---

## Executive summary

The payroll application works well as vanilla JavaScript with `localStorage`, but several files have grown large enough to slow development and increase regression risk. The primary target is **`payroll/payroll.js`** (~4,440 lines, ~157 functions). Secondary targets are **`payroll/employees.js`**, **`payroll/payroll.css`**, and cross-file duplication of shared helpers.

This guide recommends a **phased split** that preserves the current architecture (IIFE modules + `<script>` tags) before considering a bundler.

---

## Recommended route (read this first)

The guide uses three ideas that work **together**, not three competing plans:

| Concept | What it is | What you do |
|---------|------------|-------------|
| **Proposed modules** (Section 1) | **Where code ends up** — ~10 target files | Blueprint over months; not a week-one checklist |
| **Paths A / B / C** (Section 8) | **How you build** — architecture style | Pick **one** path |
| **Phases 1 / 2 / 3** (Section 9) | **When you work** — order over time | Follow **1 → 2 → 3** |

### Decision: take Path A + Phase 1 now

| Question | Answer |
|----------|--------|
| Which **Path**? | **Path A** — split files, keep IIFE + `<script>` tags, no bundler yet |
| Which **Phase**? | **Phase 1** first, then Phase 2; Phase 3 only if you want polish |
| Must **cloud mode** be fully tested first? | **No** — Phase 1 is safe to start in **local mode** |
| When is cloud testing important? | **Before Phase 2** (run payroll, payslips, RPN) |

Path B (Vite bundle) = Phase 3 step 9 only. Path C (HTML templates) = optional during Phase 2 employee/payslip work.

### Phase checklist (your real to-do list)

| Step | Phase | Action | New file(s) |
|------|-------|--------|-------------|
| **1** | 1 | Extract history + Tax Credits tab | `payroll-history.js` |
| **2** | 1 | Extract CSV/Excel export | `payroll-exports.js` |
| **3** | 1 | Move shared helpers to `utils.js` | (extend existing) |
| **4** | 1 | Remove duplicate TC/COP wrappers | (cleanup) |
| **5** | 2 | Extract Run Payroll tab | `payroll-run.js` |
| **6** | 2 | Extract payslip code | `payroll-payslip.js` |
| **7** | 2 | Split `employees.js` | `employee-form.js`, etc. |
| **8** | 3 | Split CSS | `payroll-base.css`, etc. |
| **9** | 3 | Add Vite bundle | → Path B |
| **10** | 3 | Expand tests | (tests only) |

**Start this week:** Phase 1 steps **1 + 2** (then 3 + 4 in the same pass).

### Smoke test after Phase 1

**Local mode (required):**

- History tab → expand run → export CSV/Excel
- Tax Credits tab → sort columns → click row → employee card opens
- `npm test`

**Cloud mode (optional before Phase 2):**

- Switch to Cloud → Tax Credits (Source = RPN) → History
- Full cloud pass before Phase 2 if fake Revenue server (port 3001) is available

### Flow diagram

```
START
  → Choose Path A
  → Phase 1 (steps 1–4)     ← you are here
  → Phase 2 (steps 5–7)     ← test cloud properly before this
  → Phase 3 (8–10) optional
```

### One-sentence summary

**Use Path A, complete Phase 1, treat the module table as the long-term map, and ignore Path B/C until Phase 3 or until HTML strings become painful.**

---

## Size snapshot

| File | Lines | Size | Severity |
|------|------:|-----:|----------|
| `payroll/payroll.js` | ~4,440 | 239 KB | **Critical** |
| `index.html` (root calculator) | ~2,891 | 139 KB | High (separate app) |
| `payroll/employees.js` | ~1,457 | 78 KB | **High** |
| `payroll/payroll.css` | ~2,364 | 53 KB | Medium |
| `payroll/storage.js` | ~766 | 28 KB | Moderate |
| `payroll/state-machine.js` | ~570 | 24 KB | OK |
| `js/calculator-core.js` + `payroll/js/` copy | ~521 each | 23 KB | Watch duplication |

The payroll app’s main pain point is **`payroll.js`**: it combines UI rendering, business logic, HTML string building, exports, and orchestration in a single IIFE.

---

## 1. Split `payroll/payroll.js` (highest priority)

`payroll.js` already uses section markers (`// --- Run Payroll ---`, etc.). Those sections map cleanly to new modules.

### Proposed modules

| Proposed module | Current section(s) | ~Lines | Responsibility |
|-----------------|-------------------|-------:|----------------|
| `payroll-period.js` | Pay-date helpers, week numbers, frequency | ~200 | Period calendar logic |
| `payroll-paye.js` | PAYE calc + ledger (`initOrSyncLedger`) | ~180 | Tax credit / COP math |
| `payroll-companies.js` | Company list, sandbox, mode toggle | ~530 | Dashboard / company CRUD |
| `payroll-run.js` | Run Payroll tab | ~1,370 | Timesheet, preview, commit |
| `payroll-submission.js` | Submission tab + PSR payload | ~300 | Revenue submission UI |
| `payroll-rpn.js` | RPN retrieval + overview tab | ~200 | Cloud RPN flow |
| `payroll-payslip.js` | Payslip render + employee card panel | ~700 | Payslip HTML + breakdown |
| `payroll-exports.js` | CSV / Excel export | ~120 | File downloads |
| `payroll-history.js` | History + Tax Credits table | ~400 | Read-only reporting tabs |
| `payroll-shell.js` | Init, tabs, modals, messages | ~200 | Thin orchestrator |

**Target end state:** `payroll-shell.js` (or a slimmed `payroll.js`) remains the coordinator; feature modules load via `<script>` tags in dependency order (same pattern as today).

### Highest-value first cuts

1. **`payroll-run.js`** — largest, most complex, changes most often  
2. **`payroll-payslip.js`** — self-contained HTML generation  
3. **`payroll-history.js`** — History + Tax Credits tab are isolated readers  

### Suggested module pattern (no bundler required)

```javascript
// payroll-run.js
const PayrollRun = (function () {
  'use strict';

  function calculateTimesheetPreview() {
    // ...
  }

  function confirmAndSaveRun() {
    // ...
  }

  return {
    calculateTimesheetPreview: calculateTimesheetPreview,
    confirmAndSaveRun: confirmAndSaveRun
  };
})();
```

`PayrollApp` then delegates: `PayrollRun.calculateTimesheetPreview()` instead of local functions.

### Script load order (example)

```html
<script src="utils.js"></script>
<script src="storage.js"></script>
<script src="state-machine.js"></script>
<script src="payroll-period.js"></script>
<script src="payroll-paye.js"></script>
<script src="payroll-companies.js"></script>
<script src="payroll-run.js"></script>
<script src="payroll-submission.js"></script>
<script src="payroll-rpn.js"></script>
<script src="payroll-payslip.js"></script>
<script src="payroll-exports.js"></script>
<script src="payroll-history.js"></script>
<script src="employees.js"></script>
<script src="payroll.js"></script> <!-- shell / orchestrator -->
```

---

## 2. Split `payroll/employees.js` (second priority)

`showEmployeeForm()` alone is ~600 lines of inline HTML strings — the main reason this file feels heavy.

### Proposed modules

| Proposed module | Contents |
|-----------------|----------|
| `employee-list.js` | Card grid, add/edit/delete entry points |
| `employee-form.js` | Form HTML, validation, save |
| `employee-schedules.js` | TC/COP tables, history row sync, payslip panel hooks |
| `employee-report.js` | Sortable report, print |
| `employees.js` | Thin public API: `init`, `showEmployeeForm`, `getActiveEmployees` |

### Extra improvement

Move repeated HTML builders (TC schedule rows, history table) into small `renderXxx()` helpers instead of one giant template string.

---

## 3. Split `payroll/payroll.css`

The stylesheet is already numbered (sections 1–20). Split by those sections:

| File | Sections | Contents |
|------|----------|----------|
| `payroll-base.css` | 1–10 | Reset, layout, tabs, buttons, badges |
| `payroll-employees.css` | 7–8 | Cards, forms, edit layout |
| `payroll-run.css` | 11, 19 | Run payroll, timesheet |
| `payroll-payslip.css` | 12 | Payslip + breakdown |
| `payroll-tables.css` | 13, 20, RPN | History, tax credits, RPN overview |
| `payroll-print.css` | 17–18 | Print + responsive |

**Loading options:**

- Link each file from `payroll/index.html`, or  
- Keep one aggregator file that uses `@import` if you prefer a single `<link>` tag.

---

## 4. Cross-cutting duplication (fix while splitting)

These concerns appear in multiple files and should live in **one** place (mostly `PayrollUtils` in `utils.js`):

| Duplicated concern | Currently in |
|--------------------|--------------|
| `getDefaultAnnualTC` / `getDefaultCutOffPoint` | `payroll.js`, `employees.js`, `utils.js` |
| `getPayFrequencyLabel` | `payroll.js`, `employees.js` |
| `escapeHtml` | `payroll.js`, `employees.js` |
| `isCustomTaxStatus` | `payroll.js`, `employees.js` |
| `formatLocalDateTime` | `payroll.js` only — should be shared |

**Recommendation:** Treat `PayrollUtils` as the single shared layer. Other modules only add thin wrappers when DOM-specific behaviour is needed.

---

## 5. `storage.js` — optional later split

At ~766 lines it is manageable. If it grows further:

| Module | Responsibility |
|--------|----------------|
| `storage-companies.js` | Company CRUD, active company |
| `storage-payroll-runs.js` | Runs, submissions |
| `storage-ledger.js` | Tax credits ledger |

Keep one **`PayrollStorage`** facade so callers do not need to change.

---

## 6. Root `index.html` (~2,891 lines)

This is the **standalone net/gross calculator**, not the payroll app. It mixes HTML, CSS, and JavaScript in one file.

**Priority:** Lower, unless you are actively changing the calculator.

If you refactor it:

- Extract inline JS → `js/calculator-ui.js`
- Extract inline CSS → `css/calculator.css`
- Keep `calculator-core.js` as the pure calculation engine

A `calculator-core.js.map` file references a modular `src/engine/` layout — reviving that build pipeline would be the long-term fix for the calculator side.

---

## 7. Duplicate `calculator-core.js`

Two copies exist:

- `js/calculator-core.js` — canonical (used by root site and batch)
- `payroll/js/calculator-core.js` — fallback when payroll is served alone

**Risk:** The copies can drift apart.

**Options:**

1. Single source of truth at `js/calculator-core.js`; remove the duplicate and rely on the existing fallback loader in `payroll/index.html`, or  
2. Add a sync script in `package.json`:

```json
{
  "scripts": {
    "sync:calc": "node -e \"require('fs').copyFileSync('js/calculator-core.js','payroll/js/calculator-core.js')\""
  }
}
```

---

## 8. Architecture paths

### Path A — Minimal change (recommended short term)

- Split files as described above  
- Keep IIFE + global namespaces (`PayrollApp`, `PayrollEmployees`, `PayrollUtils`)  
- Update `payroll/index.html` script order  

| Effort | Risk |
|--------|------|
| Low–medium | Low |

### Path B — Light build step

- Project already has Vitest and `"type": "module"` in `package.json`  
- Add Vite or esbuild to bundle `payroll/src/*.js` → `payroll/dist/payroll.bundle.js`  
- Enables `import`/`export`, tree-shaking, easier unit tests  

| Effort | Risk |
|--------|------|
| Medium | Medium (script loading, PWA service worker cache) |

### Path C — Template layer

- Replace large HTML strings with small render helpers or `<template>` elements in `index.html`  
- Reduces JS size; UI edits become safer  

| Best for |
|----------|
| `showEmployeeForm`, payslip, run preview |

---

## 9. Phased implementation plan

### Phase 1 — Quick wins (1–2 days)

1. Extract `payroll-history.js` (history + tax credits tab)  
2. Extract `payroll-exports.js`  
3. Consolidate shared helpers into `utils.js`  
4. Remove duplicate `getDefaultAnnualTC` / `getDefaultCutOffPoint` wrappers  

### Phase 2 — Core complexity (3–5 days)

5. Extract `payroll-run.js`  
6. Extract `payroll-payslip.js`  
7. Split `employees.js` into form vs schedules  

### Phase 3 — Polish (optional)

8. Split CSS files  
9. Add Vite bundle  
10. Expand tests for extracted modules  

---

## 10. Testing recommendations

Current tests (40) cover `utils`, breakdown, and storage — a good foundation.

After splitting, prioritize tests for:

| Area | Examples |
|------|----------|
| Period logic | `resolvePayPeriodNumber`, weekly period context |
| Ledger | Commit, rollback, delete run |
| Tax Credits tab | Last-updated from submitted payroll |
| PAYE breakdown | Already covered by `breakdown.test.js` |

UI render functions can remain manually tested unless you add a DOM test harness (e.g. Vitest + jsdom).

---

## 11. What not to do yet

| Avoid | Reason |
|-------|--------|
| Rewrite into React/Vue | App fits vanilla JS + localStorage well |
| Split `state-machine.js` | Already a coherent, bounded module |
| Refactor root `index.html` | Unless calculator work is active |
| Big-bang rewrite | Phased extraction reduces risk |

---

## Implementation status

| Step | Status | Notes |
|------|--------|-------|
| 1 — `payroll-history.js` | **Done** | History tab + Tax Credits table |
| 2 — `payroll-exports.js` | **Done** | CSV/Excel/payslip export |
| 3 — `utils.js` helpers | **Done** | `formatLocalDateTime`, `csvNumber`, `getPayFrequencyLabel` |
| 4 — Duplicate wrappers | **Partial** | `payroll.js` delegates TC/COP/formatting to `PayrollUtils` |
| 5–10 | Pending | Phase 2 and 3 |

New scripts in `payroll/index.html` (before `employees.js`):

```html
<script src="payroll-exports.js"></script>
<script src="payroll-history.js"></script>
```

---

## 12. Safest first PR

**Recommended first change:** extract **`payroll-history.js`** and **`payroll-exports.js`**.

- Few upstream dependencies  
- Does not disturb Run Payroll or employee editing  
- Immediate reduction in `payroll.js` size  
- Easy to verify manually via History and Tax Credits tabs  

---

## File location

This document lives at:

```
docs/payroll-refactor-guide.md
```

Open or download it from your project folder:  
`C:\Users\flyin\Desktop\NetToGros_Qoder\docs\payroll-refactor-guide.md`

---

*Generated from codebase analysis — June 2026.*