# Payroll GL Postings — Planning Reference

**Status:** Plan only — not implemented  
**Created:** July 2026  
**Purpose:** Staged approach to payroll-to-accounts integration without building a full ERP inside the browser app.

---

## 1. Question

Should NetToGros implement a **double-entry payroll ledger** so payroll accounts can integrate with accounting software (Xero, Sage, QuickBooks, etc.)?

**Short answer:** Beneficial as an **export-oriented posting layer**, not as a full in-app general ledger on day one.

---

## 2. What exists today

| Store | Type | Purpose |
|-------|------|---------|
| `taxCreditsLedger` | Tax state | Annual TC / COP used vs remaining per employee |
| Committed payroll runs | Transactional | Period amounts per employee (`grossPay`, `paye`, `usc`, `prsi`, …) |
| Submissions | External shape | PSR-style payloads (`payroll-submission.js`) |

There is **no** chart of accounts, journal headers, or debit/credit balance validation for accounting.

---

## 3. What double-entry would provide

Each payroll event becomes a **balanced journal batch**. Example — one employee, one weekly period:

### Employee cost and liabilities

| Standard code | Side | Amount (€) | Typical GL role |
|---------------|------|------------|-----------------|
| `WAGES_EXP` | Debit | 655.20 | P&amp;L — wages expense |
| `PAYE_CTRL` | Credit | 54.12 | Balance sheet — PAYE liability |
| `USC_CTRL` | Credit | 10.93 | Balance sheet — USC liability |
| `PRSI_EE_CTRL` | Credit | 27.52 | Balance sheet — employee PRSI liability |
| `NET_WAGES` | Credit | 562.64 | Balance sheet — net wages payable |

### Employer PRSI (often separate batch or lines)

| Standard code | Side | Amount (€) |
|---------------|------|------------|
| `PRSI_ER_EXP` | Debit | 217.20 |
| `PRSI_ER_CTRL` | Credit | 217.20 |

**Integration benefits:**

- Journal CSV/API import into accounts packages
- Adjustments (see `payroll-adjustments-plan.md`) become explicit correction journals
- Audit: every payslip line traces to GL accounts
- Accrual (at commit) vs bank payment (separate journal) can be modelled later

---

## 4. Why not full double-entry immediately

| Challenge | Impact on this project |
|-----------|------------------------|
| Chart of accounts varies per client | Mapping cannot be one-size-fits-all |
| Posting rules multiply | Pension (net vs relief), BIK, court orders, director loan, etc. |
| Timing | Commit accrual ≠ bank payment date |
| Reversals | Rollback, adjustment, resubmission need linked reversal entries |
| Scope | Risk of building a mini-ERP inside a payroll practice tool |

Payroll tax correctness, payslips, adjustments, and ROS should mature **before** a full GL subsystem.

---

## 5. Recommended staged approach

### Stage 1 — Posting lines (recommended first accounting step)

On **commit** (and later on adjustment commit), generate immutable **posting lines**:

```javascript
{
  id: "uuid",
  postingDate: "2026-12-31",        // pay date or commit date — policy TBD
  taxYear: "2026",
  periodNumber: 53,
  sourceType: "payroll_run",        // payroll_run | adjustment | reversal
  sourceId: "run-uuid",
  employeeId: "uuid",
  companyId: "uuid",
  lines: [
    { accountCode: "WAGES_EXP",   side: "debit",  amount: 655.20 },
    { accountCode: "PAYE_CTRL",   side: "credit", amount: 54.12 },
    { accountCode: "USC_CTRL",    side: "credit", amount: 10.93 },
    { accountCode: "PRSI_EE_CTRL", side: "credit", amount: 27.52 },
    { accountCode: "NET_WAGES",   side: "credit", amount: 562.20 }
  ],
  balanced: true                  // Σ debits === Σ credits
}
```

**Properties:**

- Fixed **standard account codes** (app-side vocabulary)
- Client-specific GL numbers applied only at **export** (Stage 2)
- Payroll totals on `payrollEntry` remain source of truth for tax engines
- Validate balance per batch before persist

**Exit criteria:** Weekly run for one employee exports to CSV with balanced Dr/Cr lines.

### Stage 2 — Company account mapping

Per company configuration:

```javascript
accountMapping: {
  WAGES_EXP: "6000",
  PAYE_CTRL: "2201",
  USC_CTRL: "2202",
  PRSI_EE_CTRL: "2203",
  PRSI_ER_EXP: "6010",
  PRSI_ER_CTRL: "2210",
  NET_WAGES: "2100",
  BANK: "1200"
}
```

Export produces package-ready journals (account number, date, description, debit, credit).

### Stage 3 — Full ledger (when product requires live sync)

- Persist journals as first-class records with `reversesPostingId`
- Adjustment journals from adjustments plan
- Optional payment journal: Dr `NET_WAGES`, Cr `BANK`
- In-app trial balance / control account view (optional)

Build when paying customers need **API sync**, not only accountant CSV handoff.

---

## 6. Relationship to pay codes

| Layer | Role |
|-------|------|
| **Pay lines / pay codes** | *What* was paid (`BASIC`, `OT`, `PAYE`, `ADJ_PAYE`) |
| **GL postings** | *Where* it goes in accounts (expense vs liability) |

Posting rules map codes to accounts: `BASIC` → Dr `WAGES_EXP`; `PAYE` → Cr `PAYE_CTRL`.

See `pay-codes-plan.md` for the pay-line layer (also not implemented).

---

## 7. Standard account code catalogue (initial)

Closed set — extend only with documented rules.

| Code | Category | Typical use |
|------|----------|-------------|
| `WAGES_EXP` | Expense | Gross earnings (employee) |
| `OT_EXP` | Expense | Overtime portion (optional split) |
| `PRSI_ER_EXP` | Expense | Employer PRSI |
| `PENSION_EXP` | Expense | Employer pension (if applicable) |
| `PAYE_CTRL` | Liability | PAYE control |
| `USC_CTRL` | Liability | USC control |
| `PRSI_EE_CTRL` | Liability | Employee PRSI |
| `PRSI_ER_CTRL` | Liability | Employer PRSI |
| `PENSION_EE_CTRL` | Liability | Employee pension deduction |
| `NET_WAGES` | Liability | Net pay owed to employee |
| `BIK_CTRL` | Liability / memo | BIK tracking (policy TBD) |
| `BANK` | Asset | Bank payment |
| `ADJ_*` | Various | Adjustment deltas (mirror pay code adj codes) |

---

## 8. Posting rules (weekly employee — Phase 1)

```
Dr WAGES_EXP     = entry.grossPay
Cr PAYE_CTRL     = entry.paye
Cr USC_CTRL      = entry.usc
Cr PRSI_EE_CTRL  = entry.prsi
Cr PENSION_EE    = entry.pensionDeduction (if > 0)
Cr NET_WAGES     = entry.netPay

Dr PRSI_ER_EXP   = entry.employerPrsi
Cr PRSI_ER_CTRL  = entry.employerPrsi
```

**Adjustment posting (future):** same accounts using `delta` amounts; link `sourceType: "adjustment"` and `targetPeriodNumber` in metadata.

---

## 9. Timing policy (decide before implementation)

| Event | Suggested posting date |
|-------|------------------------|
| Payroll commit | Pay date on run (`periodContext.payDateIso`) |
| Period submission | No second posting if commit already posted (unless accrual ≠ submission) |
| Bank payment | Separate manual/API journal — out of scope Phase 1 |
| Adjustment | Current period pay date |

---

## 10. Implementation plan (no code yet)

| Step | Task | Depends on |
|------|------|------------|
| G1 | `payroll/postings.js` — `buildPostingsFromEntry(entry)` | — |
| G2 | Balance validation + unit tests | G1 |
| G3 | Attach `postings[]` to run on commit | G2 |
| G4 | CSV journal export (`PayrollExports`) | G2, account mapping |
| G5 | Company `accountMapping` in storage | G4 |
| G6 | Adjustment posting deltas | Adjustments Phase 1 |
| G7 | Reversal postings on rollback | State machine |

---

## 11. Open decisions

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Gross vs net-only posting | **Gross expense + liability credits** (standard bureau) |
| 2 | Employer PRSI same batch as employee? | **Same batch**, separate lines |
| 3 | One batch per run vs per employee | **Per employee** (easier reconciliation) |
| 4 | Store postings inside run or separate store | **Inside run** Phase 1; index later if needed |
| 5 | BIK | **Informational / taxable gross** — confirm with accountant before liability line |

---

## 12. When this is worth building

| Product goal | Priority |
|--------------|----------|
| Payslips + Irish tax | Not required |
| Adjustments audit trail | Helpful when adjustments ship |
| CSV journal for accountant | **Stage 1** |
| Live accounting API | **Stage 3** |
| Local practice sandbox only | Defer |

**Practical rule:** Add `postings[]` when committing payroll **after** or **with** adjustments Phase 1b — not before unless accountant export is the next milestone.

---

## 13. Related documents

- `../implemented/architecture.md` — commit flow, storage
- `payroll-adjustments-plan.md` — adjustment deltas → adjustment journals
- `pay-codes-plan.md` — pay line identity layer

---

## 14. Changelog

| Date | Change |
|------|--------|
| 2026-07-05 | Initial plan — staged posting model vs full GL |