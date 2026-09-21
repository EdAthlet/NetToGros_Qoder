# In-App Help — Reference (Implemented)

**Status:** Implemented — source of truth is `payroll/payroll-help.js`  
**UI:** Free Payroll Practice → **Help** tab (header) or workspace Help tab  

Update this file when help content changes materially.

Cloud / RPN practice uses hosted fake `/api/rpn` and `/api/psr` (local dev may use `localhost:3001`). It is not live ROS.

---

## Quick start

1. Recommended first: load the RPN practice sandbox (cool blue slot).
2. Open that company (page colours match RPN practice). **The Coach** lists the first steps until dismissed.
3. RPN → Retrieve RPN from the practice API.
4. Run Payroll → preview → commit.
5. Submission → Generate → Submit to Revenue (practice).
6. Optional: Manual credits sandbox (warm cream) to practise without RPN.

---

## Companies

Three slots. Edit details. Load RPN practice sandbox (recommended first) / Load Manual credits sandbox. Colour frames = mode.

---

## Manual credits vs RPN practice

- **Manual credits** (`local`) — manual TC/COP; no RPN/Submission tabs.
- **RPN practice** (`cloud`) — practice `/api/rpn` and `/api/psr` (not live ROS). Tester: `/tools/fake-revenue/`.

---

## Employees / Tax Credits & COP / RPN / Run / Week 53 / Submission / History

See live Help tab in the app (payroll-help.js). Week 53: test period mode; mid-year pay-day change blocked except in test mode.

---

## Save & restore

File backup and Neon sit behind **Show advanced save options**.

- **File** — export/import all slots; useful in Manual credits.
- **Neon** — workspace key, push/pull; multi-device; not RPN.
- Payroll alone does not write Neon — Push required.

**UI:** Footer “Save & restore” is **hidden while Help is open**.

---

## Site links

Take Home Pay · Bulk Calculator · Free Payroll Practice · Pensions · Support

---

## Changelog

| Date | Change |
|------|--------|
| 2026-09 | Week 1 copy/rename: Free Payroll Practice, Manual credits / RPN practice; Cloud is fake `/api/rpn` not live ROS |
| 2026-08 | Full rewrite for Neon, hosted fake Revenue, colours, site nav; hide storage on Help |
