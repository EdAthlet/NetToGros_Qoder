# NetToGros — Project Documentation

All project markdown documentation lives under `docs/`. Documents are split by **implementation status**.

**In-app user help** (what end users see in the browser) is implemented in code: `payroll/payroll-help.js`. A developer mirror is in `implemented/in-app-help-reference.md`.

---

## Folder layout

```
docs/
├── README.md                          ← this index
├── implemented/                       ← shipped features & architecture
│   ├── architecture.md
│   ├── payroll-refactor-guide.md
│   └── in-app-help-reference.md
└── work-in-progress/                  ← plans only — not built yet
    ├── payroll-adjustments-plan.md
    ├── payroll-gl-postings-plan.md
    └── pay-codes-plan.md
```

**Project root:** `README.md` — main repo readme (calculator + payroll quick start).

---

## Implemented

| Document | Description |
|----------|-------------|
| [architecture.md](implemented/architecture.md) | Module map, commit flow, local/cloud modes, Week 53, testing |
| [payroll-refactor-guide.md](implemented/payroll-refactor-guide.md) | Refactor history (Phases 1–2 done; Vite bundle optional/pending) |
| [in-app-help-reference.md](implemented/in-app-help-reference.md) | Mirror of Help tab content (`payroll-help.js`) |

---

## Work in progress (planning only)

| Document | Description |
|----------|-------------|
| [cloud-mode-and-fake-revenue-plan.md](work-in-progress/cloud-mode-and-fake-revenue-plan.md) | Cloud mode RPN/PSR; Netlify Functions + local Express done |
| [neon-cloud-data.md](work-in-progress/neon-cloud-data.md) | Neon workspace snapshots; push/pull setup (Phase 1) |
| [payroll-adjustments-plan.md](work-in-progress/payroll-adjustments-plan.md) | Prior-period corrections applied in current payroll |
| [payroll-gl-postings-plan.md](work-in-progress/payroll-gl-postings-plan.md) | Staged GL posting / double-entry for accounts integration |
| [pay-codes-plan.md](work-in-progress/pay-codes-plan.md) | Pay line codes (`BASIC`, `ADJ_PAYE`, etc.) — brief design note |

Do **not** treat work-in-progress documents as describing current product behaviour.

Also in `docs/` (not under the two folders): [Payroll-Workflow-Guide.pdf](Payroll-Workflow-Guide.pdf) — local/cloud workflow guide (implemented behaviour).

---

## Suggested review order (later stage)

1. `implemented/architecture.md` — what exists today  
2. `work-in-progress/cloud-mode-and-fake-revenue-plan.md` — make Cloud mode + hosted fake Revenue work  
3. `work-in-progress/payroll-adjustments-plan.md` — prior-period corrections  
4. `work-in-progress/pay-codes-plan.md` + `payroll-gl-postings-plan.md` — accounting integration path  

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-05 | Reorganized docs into `implemented/` and `work-in-progress/`; added GL postings plan |
| 2026-07-17 | Added cloud-mode-and-fake-revenue-plan.md |