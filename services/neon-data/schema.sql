-- NetToGros payroll cloud data (Neon Postgres)
-- Run once in Neon SQL Editor after creating a project.
-- Practice multi-device sync via workspace access_key (not full user accounts yet).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_key TEXT NOT NULL UNIQUE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspaces_access_key_idx ON workspaces (access_key);

-- Full browser backup payload (version 3.1 JSON) per workspace
CREATE TABLE IF NOT EXISTS workspace_snapshots (
  workspace_id UUID PRIMARY KEY REFERENCES workspaces (id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  schema_version TEXT NOT NULL DEFAULT '3.1',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE workspaces IS 'Practice cloud workspaces; access_key is the shared secret for push/pull';
COMMENT ON TABLE workspace_snapshots IS 'Latest full payroll snapshot (companies, employees, runs, ledger, submissions)';
