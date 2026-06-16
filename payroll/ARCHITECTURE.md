# NetToGros Payroll — Architecture Reference

**Status:** Implemented (June 2026)  
**Previous state:** `payroll.js` was a single 2,213-line orchestrator; refactored into focused modules with `payroll.js` as a ~364-line facade.  
**Purpose:** Future reference for where logic lives, how local vs cloud modes interact, and how to extend toward real ROS.

---

## 1. Executive summary

The payroll app is a **multi-company, dual-mode** browser application:

| Mode | Purpose | Revenue integration |
|------|---------|---------------------|
| **Local** | Practice with manual tax credits / cut-off points (TC/COP) | None — RPN and Submission tabs hidden |
| **Cloud** | Practice → production path with RPN retrieval and payroll submission | Fake server today (`localhost:3001`); real ROS via `RevenueApi` swap |

Mode is stored **per company** as `company.payrollMode` (`'local'` | `'cloud'`). Slot 0 defaults to local practice, slot 1 to cloud practice, slot 2 requires explicit mode selection.

**Design principle:** Shared modules (run payroll, employees, history) work in both modes. Cloud-only modules (`PayrollRPN`, `PayrollSubmission`, `RevenueApi`) are never required for local workflows. Mode branching is centralized in `PayrollTax` and `PayrollModeUI`.

---

## 2. Module dependency diagram

```
index.html (globals: selectedYear, activeTab, tabConfig, PAYROLL_CONFIG)
    │
    ├── calculator-core.js     (USC/PRSI/generic PAYE — not payroll-RPN PAYE)
    ├── payroll-context.js     (PayrollContext shared state)
    ├── utils.js               (PayrollUtils — formatting, periods, TC schedules)
    ├── payroll-mode.js        (PayrollMode — pure mode helpers, no DOM)
    ├── revenue-api.js         (RevenueApi — HTTP adapter; ROS swap point)
    ├── storage.js             (PayrollStorage — localStorage)
    ├── state-machine.js       (PayrollStateMachine — period/commit lifecycle)
    │
    ├── payroll-run.js         (PayrollRun — run/commit/rollback UI)
    ├── payroll-payslip.js     (PayrollPayslip)
    ├── payroll-exports.js     (PayrollExports)
    ├── payroll-history.js     (PayrollHistory — history + tax credits table)
    ├── employees.js           (PayrollEmployees)
    ├── employee-report.js     (PayrollEmployeeReport)
    │
    ├── payroll-ui.js            (PayrollUI — toasts, confirm modal)
    ├── payroll-tax.js           (PayrollTax — mode-aware TC/COP resolution)
    ├── payroll-paye.js          (PayrollPAYE — RPN/local/emergency PAYE engine)
    ├── payroll-mode-ui.js       (PayrollModeUI — mode toggle, tab visibility)
    ├── payroll-companies.js     (PayrollCompanies — dashboard, sandboxes)
    ├── payroll-workspace.js     (PayrollWorkspace — enter/exit company)
    ├── payroll-submission.js    (PayrollSubmission — cloud only)
    ├── payroll-rpn.js           (PayrollRPN — cloud only)
    ├── payroll-help.js          (PayrollHelp)
    │
    └── payroll.js               (PayrollApp facade — init, routing, wiring)
```

---

## 3. Script load order

From `payroll/index.html` (order matters — each module may depend on earlier scripts):

1. `calculator-core.js`
2. `payroll-context.js`
3. `utils.js`
4. `payroll-mode.js`
5. `revenue-api.js`
6. `storage.js`
7. `state-machine.js`
8. `payroll-run.js`
9. `payroll-payslip.js`
10. `payroll-exports.js`
11. `payroll-history.js`
12. `employee-report.js`
13. `employees.js`
14. `payroll-ui.js`
15. `payroll-tax.js`
16. `payroll-paye.js`
17. `payroll-mode-ui.js`
18. `payroll-companies.js`
19. `payroll-workspace.js`
20. `payroll-submission.js`
21. `payroll-rpn.js`
22. `payroll-help.js`
23. `payroll.js` — calls `wireExtractedModules()` on load, then `PayrollApp.init()` on `DOMContentLoaded`

---

## 4. Shared global state

### `PayrollContext` (`payroll-context.js`)

| Property | Type | Description |
|----------|------|-------------|
| `currentCompanyId` | string \| null | Active company in workspace |
| `currentRunData` | object \| null | In-progress payroll preview data |
| `payslipReturnTab` | string | Tab to restore after closing payslip (default `'history'`) |
| `currentPayslipContext` | object \| null | Payslip navigation context |

### Page globals (`index.html` inline script)

| Name | Description |
|------|-------------|
| `selectedYear` | Active tax year (e.g. `'2026'`) |
| `activeTab` | Calculator period tab (`weekly` / `fortnightly` / `monthly`) |
| `tabConfig` | Period multipliers for calculator-core |
| `window.PAYROLL_CONFIG.revenueApiBase` | Base URL for fake Revenue server (ROS gateway later) |

---

## 5. Mode architecture

### 5.1 Mode decision flow

```
User opens company
    → PayrollWorkspace.enterCompany
        → PayrollMode.needsModeSelection? → PayrollModeUI.promptInitialModeSelection
        → PayrollWorkspace.enterCompanyWorkspace
            → PayrollModeUI.applyModeToUI (hide/show RPN + Submission tabs)
            → PayrollModeUI.bindPayrollModeControls
```

### 5.2 Tax calculation path (`PayrollPAYE.calculatePAYE`)

```
shouldUseRPN(employee)?  [cloud + valid RPN number]
    YES → calculateNormalPAYE with RPN periodic TC/COP
    NO  → isLocalMode()?
        YES → ledger remaining TC/COP → calculateNormalPAYE
        NO  → calculateEmergencyPAYE (cloud without RPN)
```

### 5.3 Module mode classification

| Module | Mode |
|--------|------|
| `PayrollMode`, `PayrollModeUI` | Both (UI gates cloud features) |
| `PayrollTax`, `PayrollPAYE`, `PayrollUtils` | Both (branch internally) |
| `PayrollRun`, `PayrollPayslip`, `PayrollHistory`, `PayrollEmployees` | Both |
| `PayrollRPN`, `PayrollSubmission`, `RevenueApi` | **Cloud only** |
| `PayrollCompanies` (sandbox loaders) | Both (sets mode per sandbox) |

### 5.4 ROS migration (future)

Only these files should need changes for real Revenue Online Service:

1. **`revenue-api.js`** — authentication, endpoints, error codes, retries
2. **`payroll-rpn.js`** — `mapRevenueRPNToEmployee` if ROS response shape differs
3. **`index.html`** — `PAYROLL_CONFIG.revenueApiBase` for environment URLs

UI modules (`PayrollRPN`, `PayrollSubmission`) continue calling `RevenueApi.retrieveRPN` / `submitPSR`.

---

## 6. Function catalog by module

Convention: **Mode** = `Shared` | `Local` | `Cloud` | `Cloud-gated` (only invoked when cloud, but module loads always).

---

### 6.1 `payroll.js` — `PayrollApp` (364 lines) — Facade

| Function | Mode | Description |
|----------|------|-------------|
| `getPayrollStateSafe` | Shared | Returns `PayrollStateMachine.getState()` or safe default object |
| `init` | Shared | DOM bindings: back link, backup import/export, mode controls, help, action router, company list |
| `handleRunPayrollActionClick` | Shared | Delegates button clicks (rollback, commit, submission, RPN-adjacent actions) |
| `switchTab` | Shared | Tab router; blocks `rpn`/`submission` in local mode; calls module renders |
| `syncAllTables` | Shared | Refreshes history, tax credits, RPN, submission panels if visible |
| `showRunPayroll` … `bindPayrollPreviewPayslipRows` | Shared | Thin delegates to `PayrollRun` |
| `showPayslip` … `renderBreakdownSteps` | Shared | Thin delegates to `PayrollPayslip` |
| `exportRunCSV` … `deleteRun` | Shared | Thin delegates to `PayrollExports` / `PayrollHistory` |
| `handleExportBackup` | Local-leaning | Calls `PayrollStorage.exportBackup` |
| `handleImportBackup` | Local-leaning | JSON restore; exits workspace and reloads company list |
| `wireExtractedModules` | Shared | Dependency injection hub — see §8 |

**Public API (`PayrollApp.*`):** Unchanged for HTML `onclick` handlers — see §9.

---

### 6.2 `payroll-ui.js` — `PayrollUI` (87 lines)

| Function | Mode | Description |
|----------|------|-------------|
| `showMessage(text, type)` | Shared | Toast notification (`success` / `error`), auto-dismiss 4s |
| `showConfirmModal(message, onConfirm, options)` | Shared | Reusable confirm dialog with variant (`primary` / `danger` / `warning`) |

---

### 6.3 `utils.js` — `PayrollUtils` (485 lines)

| Function | Mode | Description |
|----------|------|-------------|
| `init({ getSelectedYear, getActiveTab })` | Shared | Injects page globals for period label/context |
| `escapeHtml` | Shared | XSS-safe HTML encoding |
| `safeFormatCurrency` | Shared | Irish EUR formatting |
| `formatNumber` / `csvNumber` | Shared | Two-decimal formatting for export |
| `formatLocalDateTime` / `formatLocalDateOnly` | Shared | en-IE date/time display |
| `getPayFrequencyLabel` | Shared | Weekly / Fortnightly / Monthly label |
| `getRevenueWeekNumberForDate` | Shared | Revenue-style week index (1-based) |
| `runHasTaxCreditsApplied` | Shared | Whether any run entry used TC > 0 |
| `getSubmissionSubmittedAtForRun` | Cloud | Submission timestamp for a run |
| `getTaxCreditsLastUpdatedTimestamp` | Shared | Latest TC table “last updated” time |
| `getDefaultAnnualTC` / `getDefaultCutOffPoint` | Shared | Preset TC/COP by family status (single source of truth) |
| `resolvePayPeriodNumber` | Shared | Resolve 1..52/26/12 period index from entry/run |
| `getLatestSubmittedPayPeriodNumber` | Shared | Latest submitted period for employee+frequency |
| `getLocalPeriodicTaxCredit` | Local | Spread remaining annual TC over periods left |
| `computeRemainingTaxCreditSchedule` | Local | Full TC schedule rows for employee card |
| `getLocalPeriodicCOP` | Local | Annual COP ÷ periods (week-1 basis) |
| `getCopUsedStatus` | Local | Compare gross vs periodic COP slice |
| `computeRemainingCOPSchedule` | Local | Full COP schedule rows for employee card |
| `toFiniteNumber` | Shared | Safe `parseFloat` with fallback |
| `getPeriodsPerYearForFrequency` | Shared | 52 / 26 / 12 |
| `getCompanyPayDay` | Shared | Company pay day (default Friday) |
| `getPayDayLabel` / `getPayDayJsIndex` | Shared | Pay day display and JS day index |
| `getNextPayDate` | Shared | Next occurrence of pay day from date |
| `getPayDateForRevenueWeek` | Shared | Pay date for revenue week number + pay day |
| `getMonthlyPayrollPeriodForPayDate` | Shared | Monthly period index from pay date rules |
| `getNextMonthlyPayrollEvent` | Shared | Scan forward for next monthly payroll event |
| `formatDateInputValue` | Shared | `YYYY-MM-DD` for inputs |
| `getPeriodContextFromPayDate` | Shared | Weekly/fortnightly/monthly period context object |
| `getCurrentPayPeriodContext` | Shared | Current period from state machine + company pay day |
| `getPeriodNumberForFrequency` | Shared | Period number for weekly/fortnightly/monthly |
| `isFrequencyDueForContext` | Shared | Whether frequency is due this period vs SM state |
| `generatePeriodLabel` | Shared | Human label for run period (uses `activeTab`) |
| `getCurrentPeriodVar` | Shared | Window var name for tax period (`selected2026Period`) |

---

### 6.4 `payroll-mode.js` — `PayrollMode` (89 lines) — Pure helpers, no DOM

| Function | Mode | Description |
|----------|------|-------------|
| `getDefaultModeForSlot` | Shared | Slot 0→local, 1→cloud, 2→null |
| `getDefaultNameForSlot` | Shared | Practice – Local / Cloud / Live Payroll |
| `getPracticePresetForSlot` | Shared | `sandbox-local` / `sandbox-cloud` |
| `normalizeMode` | Shared | Validates `'local'` \| `'cloud'` |
| `getMode(company)` | Shared | Resolved mode for company |
| `isCloud` / `isLocal` | Shared | Mode predicates on company object |
| `needsModeSelection` | Shared | Slot 2 without `payrollMode` set |
| `getModeLabel` | Shared | Display label for mode |
| `migrateCompanies` | Shared | Backfill default modes on load |
| `getSlotIndex(companyId)` | Shared | Company index in list |

---

### 6.5 `payroll-mode-ui.js` — `PayrollModeUI` (175 lines)

| Function | Mode | Description |
|----------|------|-------------|
| `init(deps)` | Shared | `switchTab`, `syncAllTables`, `initOrSyncLedger`, `getSelectedYear` |
| `companyHasPayrollData` | Shared | Employees or runs exist for company |
| `getModeBadgeHtml` | Shared | Local/Cloud badge HTML for company list |
| `applyModeToUI` | Shared | Toggle mode buttons; hide RPN/Submission tabs in local |
| `persistPayrollMode` | Shared | Save mode to storage for current company |
| `requestPayrollModeChange` | Shared | Confirm + switch local↔cloud |
| `bindPayrollModeControls` | Shared | Wire Local/Cloud header buttons |
| `promptInitialModeSelection` | Shared | Modal for slot-2 first-time mode choice |
| `stripRpnForLocalMode` | Local | Remove RPN calc fields for local sandbox |
| `stripRpnNumbersForCloudPractice` | Cloud | Clear RPN numbers so user must retrieve |

---

### 6.6 `payroll-tax.js` — `PayrollTax` (196 lines) — **Mode hub**

| Function | Mode | Description |
|----------|------|-------------|
| `init({ getSelectedYear, getCurrentCompany })` | Shared | Injects year and company resolver |
| `isCustomTaxStatus` | Shared | `custom` family status or manual TC mode |
| `getCurrentCompanyMode` | Shared | Delegates to `PayrollMode.getMode` |
| `isCloudMode` / `isLocalMode` | Shared | Current company mode predicates |
| `hasValidRPN` | Cloud | Employee has `rpn.rpnNumber` |
| `shouldUseRPN` | Cloud | Cloud mode + valid RPN → use RPN PAYE path |
| `getEmployeeAnnualTaxCredits` | Both | Local: manual/preset; Cloud: RPN or fallback |
| `getEmployeeCutOffPoint` | Both | Local: manual/preset; Cloud: RPN or fallback |
| `getEmployeeTaxSource` | Both | `'rpn'` \| `'manual'` \| `'automatic'` |
| `getEmployeePayFrequency` | Shared | Default monthly |
| `countSubmittedPayrollPeriodsForEmployee` | Shared | Submitted runs count for employee+year |
| `getEmployeeSubmittedPeriodProgress` | Shared | Latest period / total for tax credits table |
| `getEmployeePeriodCOP` | Shared | Periodic COP from annual |
| `getTaxSourceDescription` | Shared | Tooltip text for TC source column |
| `getWeek1PeriodicCOPAllocation` | Shared | Week-1 COP slice for employee frequency |
| `getPeriodicAnnualGross` | Shared | Annual gross ÷ periods |
| `initOrSyncLedger` | Shared | Create/sync tax credits ledger per employee+year |

**Constant:** `FAMILY_STATUS_LABELS` — display labels for family status values.

---

### 6.7 `payroll-paye.js` — `PayrollPAYE` (122 lines)

| Function | Mode | Description |
|----------|------|-------------|
| `init({ getSelectedYear })` | Shared | Tax year for ledger lookups |
| `calculateNormalPAYE(gross, rpn)` | Both | 20%/40% bands minus periodic tax credit |
| `calculateEmergencyPAYE(...)` | Cloud | Emergency rules (no PPSN, weeks 1–4, week 5+) |
| `calculatePAYE(employee, gross, ...)` | Both | **Main entry:** RPN → local ledger → emergency |

> **Note:** Distinct from `calculator-core.js` `calculatePAYE(gross, status)` which uses simple status presets.

---

### 6.8 `payroll-companies.js` — `PayrollCompanies` (543 lines)

| Function | Mode | Description |
|----------|------|-------------|
| `init({ enterCompany })` | Shared | Callback to open workspace |
| `getCurrentCompany` | Shared | Company object for `PayrollContext.currentCompanyId` |
| `getCompanyTaxNumber` | Shared | Resolve tax number from company field aliases |
| `getEmployerRegistrationNumber` | Shared | Company tax number or practice default `1234567T` |
| `getCompanySlotIndex` | Shared | 0 / 1 / 2 index in company list |
| `buildSandboxEmployees` | Shared | 8 practice employee fixtures (used by both sandboxes) |
| `resetCompanyPracticeData` | Shared | Wipe and reseed company storage |
| `bindCompanyListEvents` | Shared | Dashboard action delegation |
| `renderCompanyList` | Shared | Companies front page HTML |
| `loadLocalSandboxCompany` | Local | Slot 0: Sandbox Ltd, `payrollMode: local`, RPN stripped |
| `loadCloudSandboxCompany` | Cloud | Slot 1: Cloud Sandbox, `payrollMode: cloud`, RPN cleared for retrieve |
| `deleteCompanyData` | Shared | Reset company with confirm |
| `toggleCompanyDetails` | Shared | Expand/collapse company card |
| `showCompanyEditForm` | Shared | Inline edit form |
| `saveCompanyEdit` | Shared | Persist company fields |

---

### 6.9 `payroll-workspace.js` — `PayrollWorkspace` (165 lines)

| Function | Mode | Description |
|----------|------|-------------|
| `init(deps)` | Shared | `setSelectedYear`, `setActiveTab`, `switchTab`, `renderHistory` |
| `enterCompany` | Shared | Mode selection gate → workspace |
| `enterCompanyWorkspace` | Shared | Set context, migrate ledger/period state, show workspace, init employees + SM |
| `exitCompany` | Shared | Hide workspace, show dashboard, refresh company list |

---

### 6.10 `payroll-rpn.js` — `PayrollRPN` (269 lines) — **Cloud only**

| Function | Mode | Description |
|----------|------|-------------|
| `init({ getSelectedYear, switchTab, syncAllTables })` | Cloud | Wiring |
| `mapRevenueRPNToEmployee` | Cloud | Map fake/ROS RPN response → employee.rpn fields |
| `mapRevenueRPNErrorToEmployee` | Cloud | Store retrieval error on employee |
| `formatRPNDate` | Cloud | Display retrieved timestamp |
| `retrieveRPNFromRevenueServer` | Cloud | POST to `RevenueApi.retrieveRPN`, save employees, sync ledger |
| `renderRPNOverview` | Cloud | RPN table UI + Retrieve button |

---

### 6.11 `payroll-submission.js` — `PayrollSubmission` (262 lines) — **Cloud only**

| Function | Mode | Description |
|----------|------|-------------|
| `init({ getSelectedYear, submitPeriod })` | Cloud | Wiring |
| `getSubmissionPayPeriod` | Cloud | `YYYY-MM` from run date |
| `summarizeRunForSubmission` | Cloud | Aggregate gross/PAYE/USC/PRSI |
| `roundSubmissionSummary` | Cloud | Round summary totals |
| `buildSubmissionPayload` | Cloud | PSR-ready JSON structure |
| `upsertSubmissionFromRun` | Cloud | Save/update submission record |
| `getLatestSubmissionRun` | Cloud | Latest committed run for submission |
| `getLatestSubmissionRecord` | Cloud | Latest saved submission |
| `renderSubmission` | Cloud | Submission history table |
| `renderSubmissionPayload` | Cloud | JSON preview textarea |
| `generateSubmissionPayload` | Cloud | Guard: cloud only; build ACCEPTED payload |
| `buildPSRRequest` | Cloud | Request body for `RevenueApi.submitPSR` |
| `refreshCloudTaxValuesAfterSubmit` | Cloud | Update employee RPN fields post-submit |
| `submitSubmissionToRevenue` | Cloud | Full submit flow → fake server → advance period |

---

### 6.12 `payroll-help.js` — `PayrollHelp` (57 lines)

| Function | Mode | Description |
|----------|------|-------------|
| `renderHelp` | Shared | Static help page (documents local vs cloud workflows) |

---

### 6.13 `revenue-api.js` — `RevenueApi` (44 lines) — **ROS adapter**

| Function | Mode | Description |
|----------|------|-------------|
| `getBaseUrl` | Cloud | From `PAYROLL_CONFIG` or localhost default |
| `retrieveRPN(payload)` | Cloud | `POST /rpn` |
| `submitPSR(payload)` | Cloud | `POST /psr` |

---

### 6.14 `payroll-run.js` — `PayrollRun` (1,412 lines) — Shared

Core payroll execution UI. Receives ~30 dependencies via `init(deps)` from `wireExtractedModules`.

| Function | Description |
|----------|-------------|
| `showRunPayroll` | Main run tab: scheduling, timesheets, preview |
| `calculateTimesheetPreview` | Compute PAYE/USC/PRSI for current inputs |
| `calculatePayroll` | Alias for preview |
| `confirmAndSaveRun` | Commit run to storage + state machine |
| `rollbackLastCommit` | Undo last commit |
| `submitPeriod` | Local: close period; Cloud: may pair with submission flow |
| `buildPayrollPreviewHtml` / `buildPayrollPreviewDataFromRun` | Preview rendering |
| `buildCommittedPeriodPanel` | Post-commit UI (different CTA in cloud vs local) |
| `updateSchedulingDisplay` | Week/fortnight/month due rows |
| `calculateEstGross` | Hourly gross estimate |
| `openCommittedRunInHistory` / `closeActionModal` | Navigation helpers |

Uses `deps.isCloudMode()` for post-commit “Proceed to Submission” vs “Submit Period”.

---

### 6.15 `payroll-payslip.js` — `PayrollPayslip` (676 lines) — Shared

| Function | Description |
|----------|-------------|
| `showPayslip` / `showPayslipFromEntry` | Full payslip modal with breakdown |
| `renderEmployeeCardPayslipPanel` | Inline payslip on employee card |
| `buildBreakdownSteps` / `renderBreakdownSteps` | Step-by-step PAYE/USC/PRSI |
| `printPayslip` | Print stylesheet trigger |
| `computeYTD` | Year-to-date totals |

---

### 6.16 `payroll-history.js` — `PayrollHistory` (395 lines) — Shared

| Function | Description |
|----------|-------------|
| `renderTaxCreditsTable` | Annual TC/COP overview (shows RPN source in cloud) |
| `renderHistory` | Committed/submitted runs list |
| `expandHistoryItem` | Run detail + export buttons |
| `deleteRun` | Remove run with confirm |

---

### 6.17 `payroll-exports.js` — `PayrollExports` (137 lines) — Shared

| Function | Description |
|----------|-------------|
| `exportRunCSV` / `exportRunExcel` | Run-level export |
| `exportPayslipCSV` | Single payslip CSV |
| `exportCurrentRunCSV` / `exportCurrentRunExcel` | Current preview export |

---

### 6.18 `employees.js` — `PayrollEmployees` (1,301 lines) — Shared

| Function | Description |
|----------|-------------|
| `init(companyId)` | Load employees for company |
| `renderEmployeeList` | Employee cards grid |
| `showEmployeeForm` | Add/edit employee (RPN read-only section in cloud) |
| `saveEmployee` / `deleteEmployee` | CRUD with validation |
| `isCloudPayrollMode` | Checks current company `payrollMode === 'cloud'` |
| `buildCloudRpnSummaryHtml` | RPN summary on employee card (cloud) |

---

### 6.19 `storage.js` — `PayrollStorage` (766 lines) — Shared

Key operations: `loadCompanies`, `loadEmployees`, `loadPayrollRuns`, `loadSubmissions`, `loadTaxCreditsLedger`, `loadPeriodState`, `exportBackup`, `importBackup`, `resetCompany`, `updateCompany`.

---

### 6.20 `state-machine.js` — `PayrollStateMachine` (570 lines) — Shared

| Function | Description |
|----------|-------------|
| `init(companyId)` | Load period state |
| `getState` | Current week, per-frequency counters, commit status |
| `performCommit` / `performRollback` / `performSubmit` | Lifecycle transitions |
| `shouldSuggestRPN` | Cloud: prompt retrieve RPN |
| `advancePeriod` | Move to next revenue week |
| `retrieveRPN` | Legacy SM hook (UI uses `PayrollRPN` directly) |

---

## 7. Pre-refactor migration map

Functions that **were** in monolithic `payroll.js` and **now** live elsewhere:

| Former `payroll.js` section | Target module |
|----------------------------|---------------|
| Lines 13–489 (tax, periods, PAYE, ledger) | `PayrollTax`, `PayrollPAYE`, `PayrollUtils` |
| Lines 491–661 (mode UI, sandbox strip) | `PayrollModeUI` |
| Lines 754–1281 (company list, sandboxes) | `PayrollCompanies` |
| Lines 1283–1468 (enter/exit) | `PayrollWorkspace` |
| Lines 1470–1535 (help) | `PayrollHelp` |
| Lines 1643–1897 (submission) | `PayrollSubmission` |
| Lines 1907–2179 (RPN) | `PayrollRPN` |
| Lines 2257–2348 (UI utilities) | `PayrollUI` |

---

## 8. `wireExtractedModules` dependency matrix

Called once at `payroll.js` load time:

| Module | Key injected dependencies |
|--------|---------------------------|
| `PayrollUtils` | `getSelectedYear`, `getActiveTab` |
| `PayrollTax` | `getSelectedYear`, `getCurrentCompany` → `PayrollCompanies` |
| `PayrollPAYE` | `getSelectedYear` |
| `PayrollModeUI` | `switchTab`, `syncAllTables`, `initOrSyncLedger` |
| `PayrollCompanies` | `enterCompany` → `PayrollWorkspace` |
| `PayrollWorkspace` | `setSelectedYear`, `setActiveTab`, `switchTab`, `renderHistory` |
| `PayrollSubmission` | `submitPeriod` → `PayrollRun` |
| `PayrollRPN` | `switchTab`, `syncAllTables` |
| `PayrollRun` | `PayrollUtils` (periods), `PayrollTax` (TC/mode), `PayrollPAYE`, `PayrollUI` |
| `PayrollPayslip` | `PayrollTax`, `PayrollCompanies`, `PayrollUtils.generatePeriodLabel` |
| `PayrollHistory` | `PayrollTax`, `PayrollUtils`, `PayrollUI`, preview/payslip callbacks |
| `PayrollExports` | `getCurrentRunData` |

---

## 9. Public `PayrollApp` API

Exposed on `window` via `payroll.js` return object (HTML and tests may call these):

```
init, renderCompanyList, toggleCompanyDetails, showCompanyEditForm, saveCompanyEdit,
enterCompany, exitCompany, switchTab,
showRunPayroll, calculatePayroll, calculatePAYE, calculateNormalPAYE, calculateEmergencyPAYE,
calculateTimesheetPreview, calculateEstGross,
confirmAndSaveRun, rollbackLastCommit, submitPeriod, syncAllTables,
renderRPNOverview, generatePeriodLabel,
showPayslip, renderEmployeeCardPayslipPanel, clearEmployeeCardPayslipPanel, printPayslip,
exportRunCSV, exportRunExcel, exportPayslipCSV,
renderHistory, expandHistoryItem, deleteRun,
handleExportBackup, handleImportBackup,
showMessage, showConfirmModal
```

---

## 10. File size reference (post-refactor)

| File | Lines | Role |
|------|-------|------|
| `payroll-run.js` | 1,412 | Run payroll UI |
| `employees.js` | 1,301 | Employee CRUD |
| `storage.js` | 766 | Persistence |
| `payroll-payslip.js` | 676 | Payslips |
| `payroll-companies.js` | 543 | Company dashboard |
| `utils.js` | 485 | Shared utilities + periods |
| `payroll.js` | **364** | **Facade** |
| `payroll-history.js` | 395 | History + TC table |
| `payroll-rpn.js` | 269 | Cloud RPN |
| `payroll-submission.js` | 262 | Cloud submission |
| `payroll-tax.js` | 196 | Mode-aware tax |
| `payroll-mode-ui.js` | 175 | Mode UX |
| `payroll-workspace.js` | 165 | Workspace lifecycle |
| `payroll-paye.js` | 122 | PAYE engine |
| `payroll-ui.js` | 87 | Toasts/modals |
| `payroll-mode.js` | 89 | Pure mode helpers |
| `revenue-api.js` | 44 | HTTP adapter |

---

## 11. Testing

```bash
npm test   # from NetToGros_Qoder root — 56 tests, vitest
```

Relevant suites: `period-utils.test.js`, `tc-schedule.test.js`, `breakdown.test.js`, `state-machine.test.js`, `storage-state.test.js`, `tax-credits-last-updated.test.js`.

---

## 12. Changelog

| Date | Change |
|------|--------|
| 2026-06-16 | Refactored `payroll.js` (2,213 → 364 lines). Added 9 modules. Extended `PayrollUtils`. All 56 tests pass. |

---

*Maintain this document when adding modules or moving functions. Update §6 function tables and §10 line counts when files change materially.*