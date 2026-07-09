# In-App Help — Reference (Implemented)

**Status:** Implemented — lives in application code  
**Source file:** `payroll/payroll-help.js` → `PayrollHelp.renderHelp()`  
**UI location:** Payroll app → **Help** tab

This markdown mirror is for developers reviewing documentation in `docs/`. **Edit `payroll-help.js` to change what users see** in the app; update this file when help content changes materially.

---

## Quick start

1. Open or create a company on the Companies screen.
2. Add employees (up to 10 per company).
3. Choose **Local** or **Cloud** mode for that company.
4. Run payroll, review the preview, then commit the run.
5. Submit the period when ready (Cloud mode) and check History.

---

## Companies

Home screen lists up to three company slots. Click a company name to open it. Use **Edit** for company details. Use **Load Sandbox Ltd** or **Load Cloud Sandbox** for preset sample data.

---

## Local vs Cloud mode

- **Local mode** — manual tax credits and cut-off points; RPN and Submission tabs hidden.
- **Cloud mode** — retrieve RPN from practice Revenue server; generate and submit payroll. Requires fake Revenue API on port 3001 for local dev.

---

## Employees

Add/edit staff: name, PPS, pay type, frequency, PRSI class, tax settings. **Show Employee List** for printable summary.

---

## Tax Credits & COP

Overview table of annual TC and COP per employee. **Last updated** reflects last payroll submission with tax credits applied.

---

## RPN (Cloud)

Revenue Payroll Notification fields. Retrieve RPN before running payroll in Cloud mode.

---

## Run Payroll

Enter hours or confirm salaried pay → preview PAYE/USC/PRSI → **commit**. Roll back last commit if needed before submit.

**Test period mode** — jump to any payday without processing every period (see Week 53 below).

---

## How to test Week 53

Week 53 applies when there are **53 weekly paydays** in the calendar year (e.g. Thursday pay in 2026). The 53rd payday uses extra TC/COP on forced Week 1 basis.

1. Company pay day with 53 paydays in test year (Thursday 2026).
2. Run Payroll → enable **Test period mode**.
3. Jump via **First** / **Last** / **Week 53** / dropdown / **Pay Date**.
4. **Calculate Preview** — expect Week 53 banner and PAYE treatment.

**Note:** Mid-year pay day change (e.g. Friday → Thursday) blocks manufactured Week 53 in live mode; test mode bypasses for preview only.

Test mode is session-only (clears when tab closes).

---

## Submission (Cloud)

Generate submission payload from committed runs; send to practice Revenue server after commit.

---

## History

Past runs: expand for details, CSV/Excel export, payslips, delete.

---

## Backup & privacy

Browser `localStorage`. **Export Backup** / **Import Backup** JSON. Keep backups private.

---

## Contact & feedback

Form on Help tab (Netlify on live site). Do not include real PPS or payroll data in messages.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-05 | Markdown reference created from `payroll-help.js` |