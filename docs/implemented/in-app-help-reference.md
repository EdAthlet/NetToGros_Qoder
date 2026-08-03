# In-App Help — Reference (Implemented)

**Status:** Implemented — source of truth is `payroll/payroll-help.js`  
**UI:** Free Payroll Software → **Help** tab (header) or workspace Help tab  

Update this file when help content changes materially.

---

## Quick start

1. Your Companies — open a slot or load sandbox (cream = Local, blue = Cloud).
2. Employees (up to 10).
3. Local or Cloud mode (page colours match).
4. Cloud: RPN → Retrieve RPN.
5. Run Payroll → preview → commit.
6. Cloud: Submission → Generate → Submit to Revenue (practice).
7. Save: File backup (Local) or Neon Push (multi-device).

---

## Companies

Three slots. Edit details. Load Sandbox Ltd / Load Cloud Sandbox. Colour frames = mode.

---

## Local vs Cloud

- **Local** — manual TC/COP; no RPN/Submission tabs; prefer file backup.
- **Cloud** — practice `/api/rpn` and `/api/psr`; prefer Neon sync. Tester: `/tools/fake-revenue/`.

---

## Employees / Tax Credits & COP / RPN / Run / Week 53 / Submission / History

See live Help tab in the app (payroll-help.js). Week 53: test period mode; mid-year pay-day change blocked except in test mode.

---

## Save & restore

- **File** — export/import all slots; default Local.
- **Neon** — workspace key, push/pull; default Cloud; not RPN.
- Payroll alone does not write Neon — Push required.

**UI:** Footer “Save & restore” is **hidden while Help is open**.

---

## Site links

Take Home Pay · Bulk Calculator · Free Payroll Software · Pensions · Support

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08 | Full rewrite for Neon, hosted fake Revenue, colours, site nav; hide storage on Help |
