# Cloud Mode, Fake Revenue Server & Cloud Persistence — Implementation Plan

**Status:** In progress — Netlify Functions + monorepo fake server implemented (July 2026); Neon / cloud data store still deferred  
**Created:** July 2026  
**Purpose:** Make Cloud mode fully usable end-to-end: retrieve fake RPNs, submit PSR to a practice Revenue API, and (optionally) persist submissions so they can be retrieved outside the browser. Host the fake server so production (`nettogross-eire.com`) does not depend on a desktop process.

---

## 1. Two different “cloud” problems

| Concept | What users mean | What exists today |
|---------|-----------------|-------------------|
| **A. Cloud payroll mode** | Company uses RPN + Revenue submission (practice path toward ROS) | UI + client wired; needs **running** fake Revenue API |
| **B. Cloud data storage** | Submissions (and maybe runs) saved remotely and retrieved later / other device | **Not built** — everything is `localStorage` only |

Do **not** merge these in one sprint. Ship **A** first (fake Revenue reachable). Plan **B** as a second product layer.

---

## 2. Research already in the repo / desktop

### 2.1 In NetToGros_Qoder (this project)

| Source | What it documents |
|--------|-------------------|
| `docs/implemented/architecture.md` §5 | Local vs Cloud modes; `RevenueApi` as ROS swap point; `PAYROLL_CONFIG.revenueApiBase` |
| `docs/Payroll-Workflow-Guide.pdf` + `docs/generate_payroll_workflow_pdf.py` | Cloud needs fake server on **port 3001**; flow Preview → Commit → Generate Submission → Submit to Revenue → period advance |
| `docs/implemented/in-app-help-reference.md` | Cloud = RPN retrieve + submit; local dev needs port 3001 |
| `payroll/revenue-api.js` | `POST {base}/rpn`, `POST {base}/psr`; base always `http://localhost:3001` today |
| `payroll/payroll-rpn.js` | Builds bulk RPN request; maps response → `employee.rpn` |
| `payroll/payroll-submission.js` | Builds PSR; calls `RevenueApi.submitPSR`; saves result in **local** submissions |
| `payroll/index.html` | `PAYROLL_CONFIG.revenueApiBase` is localhost **even on production host** (placeholder) |
| `netlify.toml` | Static site only — no API functions yet |

### 2.2 On Desktop (separate repo, not in NetToGros yet)

**Path:** `C:\Users\flyin\Desktop\fakeRevenueServer`

| Item | Detail |
|------|--------|
| Stack | Node + Express + multer |
| Start | `npm start` → `http://localhost:3001` |
| Dashboard | Browser UI + `GET /api/status`, `GET /api/events` |
| Docs | `README.md`, `skills/fake-revenue-server-guide.md` (v2.0, May 2026) |

**Endpoints already implemented:**

| Method | Path | Role |
|--------|------|------|
| `POST` | `/rpn` | Fake RPN bulk (1–1000 employees) |
| `POST` | `/psr` | Fake payroll submission accept |
| `POST` | `/err` | Enhanced reporting placeholder |
| `POST` | `/upload` | Multipart file simulation |
| `GET` | `/api/status` | Health |
| `GET` | `/api/events` | Request log |

**PPSN test profiles (RPN):**

| PPSN digit rule | Profile |
|-----------------|---------|
| Ends with `0` | Error `ERR_001` |
| Ends with `5` | High earner (higher COP) |
| Ends with `3` | Low earner (lower COP) |
| Other | Standard |

**CORS:** `Access-Control-Allow-Origin: *` — browser calls from `:8000` or Netlify origin work for local/hosted API.

### 2.3 Client ↔ server contract (already aligned)

**RPN request** (from `payroll-rpn.js`):

```json
{
  "employerRegistrationNumber": "1234567T",
  "taxYear": 2026,
  "employees": [
    { "ppsn": "…", "employmentId": "…", "employmentCommencementDate": "…" }
  ]
}
```

**RPN response** (mapped in `mapRevenueRPNToEmployee`):

- Success fields: `rpnNumber`, `yearlyTaxCredit`, `yearlyStandardRateCutOffPoint`, `prsiClass`, `basis`, YTD fields, `lptDeduction`, `uscBands`
- Error: `error` / `errorCode` per employee

**PSR request** (from `buildPSRRequest`): employer reg, tax year, pay period, employees with gross/PAYE/USC/PRSI (+ Week 53 flags).

**PSR response:** `submissionId`, `status: ACCEPTED`, `summary`, `message`, `timestamp`.

**Gap:** contract is fine. Runtime gaps are **hosting**, **config**, and **optional remote persistence**.

---

## 3. Current end-to-end Cloud flow (when server is up)

```
Cloud company
  → Retrieve RPN  →  POST /rpn  →  employee.rpn + ledger sync
  → Run Payroll / Commit
  → Generate Submission  →  localStorage submissions
  → Submit to Revenue  →  POST /psr  →  update local submission
  → submitPeriod() + refreshCloudTaxValuesAfterSubmit()
```

**What works if `localhost:3001` is running:** full practice loop on desktop.

**What fails today:**

| Scenario | Why |
|----------|-----|
| Production site Cloud mode | `revenueApiBase` still points at localhost; user’s browser cannot reach your PC |
| Phone / other machine | Same — no public API URL |
| Fake server not started | RPN/PSR fetch errors |
| “Retrieve my submissions from the cloud” | Submissions never leave `localStorage` |
| Multi-browser / cleared storage | Data gone |

---

## 4. Hosting recommendation: where to run the fake Revenue server

### 4.1 Options

| Option | Fit | Pros | Cons |
|--------|-----|------|------|
| **A. Desktop only** | Dev only | Already works | Not usable on live site or phones |
| **B. GitHub Pages / Actions** | Poor | — | No long-lived Node process; Actions are ephemeral |
| **C. Netlify Functions** (same site as app) | **Best for this repo** | Same origin as `nettogross-eire.com`; no CORS pain; already use Netlify; free tier enough for practice | Slight rewrite (Express → functions or `@netlify/functions` + shared handlers); cold starts |
| **D. Render / Railway / Fly.io** | Strong | Deploy `server.js` almost unchanged; persistent process; dashboard URL | Separate service; free tier sleep; extra URL in config |
| **E. Real ROS** | Future | Production Revenue | Auth, certificates, legal — **out of scope** for practice fake |

### 4.2 Recommended path

**Primary recommendation: Netlify Functions (Option C)** for production practice API.

```
https://nettogross-eire.com/api/rpn
https://nettogross-eire.com/api/psr
```

- Ship handlers derived from `fakeRevenueServer/server.js` (shared `generateFakeRPN` module).
- Local: keep `npm start` on port 3001 **or** `netlify dev` for parity.

**Alternative if you want zero rewrite of Express:** deploy `fakeRevenueServer` to **Render free web service** (Option D), set production `revenueApiBase` to that HTTPS URL. CORS already allows all origins.

**GitHub alone is not sufficient** for a always-on API. GitHub can host the **source** of the fake server (monorepo or submodule); hosting runtime must be Netlify/Render/etc.

### 4.3 Local vs production config matrix

| Environment | Static app | Fake Revenue base URL |
|-------------|------------|------------------------|
| Local dev | `http://localhost:8000/payroll/` | `http://localhost:3001` |
| Netlify prod | `https://nettogross-eire.com/payroll/` | `https://nettogross-eire.com/api` **or** Render URL |
| Optional | Netlify branch deploy | Same functions or staging Render |

`payroll/index.html` today:

```js
// Both branches are localhost — production is broken for Cloud mode
revenueApiBase: isLocal ? 'http://localhost:3001' : 'http://localhost:3001'
```

**Must change** to something like:

```js
revenueApiBase: isLocal
  ? 'http://localhost:3001'
  : (window.PAYROLL_CONFIG_OVERRIDE || 'https://nettogross-eire.com/api')
```

Prefer path-style API under the same host when using Netlify Functions so no hard-coded domain is required:

```js
revenueApiBase: isLocal ? 'http://localhost:3001' : `${window.location.origin}/api`
```

Update `RevenueApi` paths if functions use `/api/rpn` vs server’s `/rpn` (see Phase 2).

---

## 5. Cloud data persistence (submissions saved & retrieved) — separate track

Architecture doc already says Cloud storage is **localStorage (DB later)**.

### 5.1 Minimum viable “cloud submissions”

| Need | Approach |
|------|----------|
| Save after successful `POST /psr` | Write to remote store with company + tax year + period key |
| Retrieve list | `GET` by company id / employer reg |
| Auth | Practice: shared practice key or anonymous company UUID in localStorage; later real accounts |

### 5.2 Storage options (later phase)

| Store | Fit |
|-------|-----|
| **Netlify Blobs** | Simple key/value; same platform as site |
| **Supabase / Firebase** | Auth + query; heavier setup |
| **Fake Revenue server memory** | Already has request log — **not durable** across restarts; not multi-tenant storage |
| **Extend fake server with disk/SQLite** | Possible on Render; not ideal on serverless |

**Important:** Fake Revenue’s job is to **simulate ROS**, not to be the payroll app’s database. Prefer:

1. App keeps canonical payroll runs in storage (local now; cloud DB later).
2. Fake server only **acknowledges** PSR and generates RPNs.
3. Optional: copy submission acknowledgement + payload into a **practice cloud store** for teaching multi-device demos.

### 5.3 Do not use fake Revenue as the app’s system of record

PSR `ACCEPTED` responses are acknowledgements. Payroll history, payslips, and rollback still belong in app storage (`PayrollStorage`).

---

## 6. Implementation plan (step by step)

### Phase 0 — Document & inventory (this document)

- [x] Map client modules and Desktop `fakeRevenueServer`
- [x] Separate mode-A vs persistence-B
- [x] Hosting recommendation

### Phase 1 — Monorepo the fake server (source of truth) — DONE

| Step | Task | Outcome |
|------|------|---------|
| 1.1 | Vendored into `services/fake-revenue-server/` | Done |
| 1.2 | Root scripts `revenue:start` / `revenue:install` | Done |
| 1.3 | `services/fake-revenue-server/README.md` | Done |
| 1.4 | Unit tests `tests/payroll/fake-revenue-handlers.test.js` | Done |

**Exit criteria:** `npm run revenue:start` from NetToGros; payroll Cloud RPN works with existing client.

### Phase 2 — Environment-aware client config — DONE (status UI still optional)

| Step | Task |
|------|------|
| 2.1 | Fix `PAYROLL_CONFIG.revenueApiBase` for local vs production | Done |
| 2.2 | Netlify `/api/rpn` + `/api/psr`; client uses base + `/rpn` | Done |
| 2.3 | UI: show connection status on RPN / Submission tabs | Pending |
| 2.4 | Clearer offline errors | Pending |
| 2.5 | Help text + SW bump | Done |

**Exit criteria:** On production hostname, Cloud mode does not call `localhost:3001`.

### Phase 3 — Deploy fake Revenue API (Netlify Functions) — CODE DONE, deploy on next push

#### Path C1 — Netlify Functions (chosen; site is Pro)

| Step | Task |
|------|------|
| 3.1 | Shared `lib/handlers.js` | Done |
| 3.2 | `netlify/functions/revenue-rpn.js`, `revenue-psr.js`, `revenue-status.js` | Done |
| 3.3 | `netlify.toml` redirects `/api/*` → functions | Done |
| 3.4 | Deploy site; verify production Cloud sandbox | Done (user verified) |
| 3.5 | Local Express via `npm run revenue:start` | Done |
| 3.6 | Static dashboard at `/tools/fake-revenue/` (live tester + session log) | Done |

#### Path C2 — Render/Railway (fastest code reuse)

| Step | Task |
|------|------|
| 3.1 | Connect `services/fake-revenue-server` to Render Web Service |
| 3.2 | Set `PORT` from env (already supported) |
| 3.3 | Production `revenueApiBase` = `https://your-service.onrender.com` |
| 3.4 | Note free-tier spin-down: first request may be slow; status ping helps UX |

**Exit criteria:** Phone browser on live site can Retrieve RPN and Submit PSR successfully.

### Phase 4 — Cloud mode product polish (still localStorage app data)

| Step | Task |
|------|------|
| 4.1 | Cloud Sandbox smoke checklist (below) automated or manual |
| 4.2 | Ensure Cloud sandbox PPSNs avoid trailing `0` (error profile) unless testing errors |
| 4.3 | After PSR, History + Submission tab show accepted id consistently |
| 4.4 | Optional: persist YTD from successive fake RPNs (today server often returns `previous*YTD: 0`) — enhance server if cumulative demos need it |

**Server enhancement (optional):**

- After `POST /psr`, update in-memory employer/employee YTD so next `POST /rpn` returns non-zero previous pay/tax/USC (more realistic cumulative practice).

### Phase 5 — Cloud persistence of submissions (optional product)

| Step | Task |
|------|------|
| 5.1 | Define API: `POST /practice/submissions`, `GET /practice/submissions?companyId=` |
| 5.2 | Choose store (Netlify Blobs or Supabase) |
| 5.3 | After successful `submitPSR`, also `POST` copy of payload + acknowledgement |
| 5.4 | Submission tab: “Load from practice cloud” list |
| 5.5 | Privacy: no real PPSN on shared demos; label **practice only** |

**Exit criteria:** Clear browser data → still list practice submissions from remote for same practice company key.

### Phase 6 — Real ROS (future, out of scope)

Per architecture §5.4: only touch `revenue-api.js`, RPN mapper, config. Keep fake server for CI and demos forever.

---

## 7. Cloud sandbox manual acceptance checklist

With fake server reachable:

1. Load **Practice – Cloud** / Cloud Sandbox  
2. Mode = Cloud; RPN + Submission tabs visible  
3. **Retrieve RPN** → employees get `rpnNumber`, annual TC/COP, status Retrieved  
4. Run Payroll → Calculate Preview → uses RPN PAYE (not emergency)  
5. Commit → Generate Submission → local record  
6. **Submit to Revenue** → status ACCEPTED, period advances, ledger/RPN remaining updated  
7. History shows submitted run  

Error path: employee PPSN ending in `0` → RPN error row, emergency until fixed.

---

## 8. Suggested repo layout after Phase 1–3

```
NetToGros_Qoder/
├── payroll/                 # static app (existing)
├── services/
│   └── fake-revenue-server/ # vendored from Desktop fakeRevenueServer
│       ├── server.js        # local Express
│       ├── lib/
│       │   └── rpn.js       # shared generators
│       └── package.json
├── netlify/
│   └── functions/           # if Path C1
│       ├── rpn.js
│       └── psr.js
├── docs/
│   ├── implemented/
│   └── work-in-progress/
│       └── cloud-mode-and-fake-revenue-plan.md  ← this file
└── netlify.toml
```

---

## 9. Open decisions (resolve before coding Phase 3)

| # | Decision | Recommendation |
|---|----------|----------------|
| 1 | Host API on Netlify Functions vs Render | **Netlify Functions** if staying on Netlify; **Render** if zero Express rewrite |
| 2 | Vendor server into monorepo vs submodule | **Copy into monorepo** for simpler deploys |
| 3 | Cloud submission persistence in v1? | **No** — ship hosted RPN/PSR first |
| 4 | Fake server YTD memory after PSR? | **Phase 4 optional** for better cumulative demos |
| 5 | Auth on practice API | **None** for public practice (rate-limit later); never store real employee data |

---

## 10. Effort sketch

| Phase | Effort (rough) | Risk |
|-------|----------------|------|
| 1 Monorepo + scripts | 0.5 day | Low |
| 2 Client config + status UI | 0.5–1 day | Low |
| 3 Deploy API | 1–2 days (Functions) or 0.5 day (Render) | Medium (cold start / paths) |
| 4 Polish + optional YTD | 1 day | Low |
| 5 Cloud persistence | 2–4 days | Medium (auth, privacy) |

---

## 11. Related documents

| Doc | Relation |
|-----|----------|
| `docs/implemented/architecture.md` | Mode design, ROS swap points |
| `docs/Payroll-Workflow-Guide.pdf` | User-level commit/submit flow |
| `docs/work-in-progress/payroll-adjustments-plan.md` | Independent; later PSR adjustment metadata |
| Desktop `fakeRevenueServer/skills/fake-revenue-server-guide.md` | Full API examples & PPSN matrix |

---

## 12. Changelog

| Date | Change |
|------|--------|
| 2026-07-17 | Initial plan from architecture, workflow PDF, client modules, and Desktop `fakeRevenueServer` review |