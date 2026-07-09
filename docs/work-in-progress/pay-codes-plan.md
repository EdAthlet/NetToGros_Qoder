# Pay Codes — Planning Reference

**Status:** Plan only — not implemented  
**Created:** July 2026  
**Purpose:** Brief design note on structured pay line codes (companion to GL postings and adjustments plans).

---

## 1. Recommendation

**Yes, beneficial — but as a thin `payLines[]` layer on top of existing totals**, not a replacement for `grossPay` / `paye` / `usc` / `prsi` on day one.

Keep canonical totals for tax engines and YTD. Add coded lines for presentation, adjustments, exports, and GL posting rules.

---

## 2. Initial closed code set

| Code | Category | Maps from today |
|------|----------|-----------------|
| `BASIC` | earning | `regularGross` |
| `OT` | earning | `overtimeGross` |
| `BIK` | earning (taxable) | `bikAmount` |
| `PAYE` | deduction | `paye` |
| `USC` | deduction | `usc` |
| `PRSI_EE` | deduction | `prsi` |
| `PRSI_ER` | employer | `employerPrsi` |
| `PENSION` | deduction | `pensionDeduction` |
| `ADJ_GROSS` | earning | adjustment delta |
| `ADJ_PAYE` | deduction | adjustment delta |
| `ADJ_USC` | deduction | adjustment delta |
| `ADJ_PRSI` | deduction | adjustment delta |

---

## 3. Suggested shape

```javascript
payLines: [{
  code: "BASIC",
  category: "earning",       // earning | deduction | employer | informational
  amount: 655.20,
  source: "timesheet",       // timesheet | statutory | adjustment | allowance
  metadata: { hours: 35, rate: 18.72 }
}]
```

---

## 4. Timing

| Milestone | Need pay codes? |
|-----------|-----------------|
| Current app | Optional |
| Adjustments Phase 1 | **Recommended** — `ADJ_*` lines |
| GL posting export | **Recommended** — maps to account rules |
| Multi-allowance pay | **Required** |

---

## 5. Related documents

- `payroll-adjustments-plan.md`
- `payroll-gl-postings-plan.md`