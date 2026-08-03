# Neon cloud payroll data

**Status:** Phase 1 implemented (workspace snapshot push/pull)  
**Created:** July 2026  

Fake Revenue (`/api/rpn`, `/api/psr`) stays separate. Neon stores **your app data** (companies, employees, runs, ledger, submissions).

---

## Architecture (Phase 1)

```
Browser localStorage  ←→  Netlify Functions  ←→  Neon Postgres
   (day-to-day)            /api/data/*           workspaces +
                                                 workspace_snapshots
```

| Action | API |
|--------|-----|
| Health | `GET /api/data/health` |
| Create workspace | `POST /api/data/workspace` → `{ accessKey, workspaceId }` |
| Push snapshot | `PUT /api/data/snapshot` + header `X-Workspace-Key` |
| Pull snapshot | `GET /api/data/snapshot` + header `X-Workspace-Key` |

Snapshot payload = same shape as **Export Backup** (`version: "3.1"`).

**Auth model (practice):** random `ws_…` access key stored in browser `localStorage`. Not full login yet. Treat the key like a password.

---

## Giving Grok (this agent) access to amend schema

**Do not put the password in git or chat if you can avoid it.**

1. In the project root, create a file named **`.env`** (it is gitignored).
2. One line (paste your Neon pooled connection string, same as Netlify `DATABASE_URL`):

```env
DATABASE_URL=postgresql://neondb_owner:...@ep-...-pooler....neon.tech/neondb?sslmode=require
```

3. Tell Grok: *“Neon .env is ready — run neon:ping / apply schema.”*

Grok can then run:

```bash
npm run neon:ping
npm run neon:schema
npm run neon:sql -- services/neon-data/migrations/00x_something.sql
npm run neon:sql -- --query "SELECT COUNT(*) FROM workspaces"
```

Schema changes should live as SQL files under `services/neon-data/` so they stay in the repo; secrets stay only in `.env` + Netlify.

---

## Setup (you do this once)

### 1. Create Neon project

1. Sign in at [https://console.neon.tech](https://console.neon.tech)  
2. Create a project (e.g. `nettogros-payroll`)  
3. Copy the **connection string** (`DATABASE_URL`, use the pooled URL if Neon offers one for serverless)

### 2. Run schema

In Neon **SQL Editor**, paste and run:

`services/neon-data/schema.sql`

### 3. Netlify environment variable

1. Netlify → Site → **Environment variables**  
2. Add **`DATABASE_URL`** = Neon connection string  
3. Scope: **Production** (and Preview if you want)  
4. **Redeploy** the site so Functions pick up the variable  

### 4. Deploy this repo

Commit + push so Functions `data-health`, `data-workspace`, `data-snapshot` and UI ship.

### 5. Use in Payroll

1. Open live `/payroll/`  
2. Footer → **Cloud sync (Neon)**  
3. Status should show **Neon connected**  
4. **Create workspace** → copy key if using a second device  
5. **Push to cloud** / **Pull from cloud**  

On **localhost** with only `python -m http.server`, data APIs are not available unless you use **`netlify dev`** (loads Functions + env). Use the **live site** for Neon testing, or run Netlify Dev.

---

## What is stored

| Table | Content |
|-------|---------|
| `workspaces` | id, access_key, label |
| `workspace_snapshots` | latest full JSON backup per workspace |

Not stored yet as separate rows: individual employees/runs (they live inside the JSON snapshot). Fine for practice multi-device; later normalize if needed.

---

## Security notes

- Access key grants **full read/write** of that workspace snapshot.  
- Do not put real production PPS data in a shared demo key.  
- Phase 2: real accounts (Auth) + per-user workspaces.  

---

## Related code

| Path | Role |
|------|------|
| `services/neon-data/schema.sql` | DDL |
| `netlify/functions/data-*.js` | API |
| `payroll/payroll-cloud-data.js` | Browser client |
| `payroll/storage.js` | `buildBackupPayload` / `applyBackupPayload` |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-17 | Phase 1: schema, API, Payroll UI push/pull |