import {
  getWorkspaceKey,
  jsonResponse,
  optionsResponse,
  parseJsonBody
} from './_shared/data-http.js';
import { getSql, isDatabaseConfigured } from './_shared/neon.js';
import { rateLimit, rateLimitedResponse } from './_shared/rate-limit.js';

const MAX_SNAPSHOT_BYTES = 750000;

async function resolveWorkspace(sql, accessKey) {
  if (!accessKey) return null;
  const rows = await sql`
    SELECT id, access_key, label, updated_at
    FROM workspaces
    WHERE access_key = ${accessKey}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse(event);

  if (!isDatabaseConfigured()) {
    return jsonResponse(503, {
      error: 'Database not configured',
      message: 'Set DATABASE_URL in Netlify environment variables.'
    }, event);
  }

  const accessKey = getWorkspaceKey(event);
  if (!accessKey) {
    return jsonResponse(401, {
      error: 'Unauthorized',
      message: 'Missing X-Workspace-Key header'
    }, event);
  }

  try {
    const sql = getSql();
    const workspace = await resolveWorkspace(sql, accessKey);
    if (!workspace) {
      return jsonResponse(401, {
        error: 'Unauthorized',
        message: 'Invalid workspace key'
      }, event);
    }

    if (event.httpMethod === 'GET') {
      const snaps = await sql`
        SELECT payload, schema_version, updated_at
        FROM workspace_snapshots
        WHERE workspace_id = ${workspace.id}
        LIMIT 1
      `;
      if (!snaps.length) {
        return jsonResponse(404, {
          error: 'Not Found',
          message: 'No snapshot saved for this workspace yet. Push from Payroll first.',
          workspaceId: workspace.id,
          label: workspace.label
        }, event);
      }
      return jsonResponse(200, {
        workspaceId: workspace.id,
        label: workspace.label,
        schemaVersion: snaps[0].schema_version,
        updatedAt: snaps[0].updated_at,
        payload: snaps[0].payload
      }, event);
    }

    if (event.httpMethod === 'PUT') {
      const limited = rateLimit(event, 'snapshot-put', 20, 5 * 60 * 1000);
      if (!limited.ok) return rateLimitedResponse(jsonResponse, event, limited.retryAfterMs);

      const body = parseJsonBody(event);
      if (body === null) {
        return jsonResponse(400, { error: 'Bad Request', message: 'Invalid JSON body' }, event);
      }
      const payload = body.payload;
      if (!payload || typeof payload !== 'object') {
        return jsonResponse(400, {
          error: 'Bad Request',
          message: 'Body must include payload object (payroll backup v3.1 shape)'
        }, event);
      }
      if (typeof payload.version !== 'string') {
        return jsonResponse(400, {
          error: 'Bad Request',
          message: 'payload.version is required'
        }, event);
      }
      const encoded = JSON.stringify(payload);
      if (encoded.length > MAX_SNAPSHOT_BYTES) {
        return jsonResponse(413, {
          error: 'Payload Too Large',
          message: 'Snapshot is too large for practice cloud sync. Export a file backup instead.'
        }, event);
      }

      const schemaVersion = String(payload.version);
      await sql`
        INSERT INTO workspace_snapshots (workspace_id, payload, schema_version, updated_at)
        VALUES (${workspace.id}, ${encoded}::jsonb, ${schemaVersion}, now())
        ON CONFLICT (workspace_id) DO UPDATE SET
          payload = EXCLUDED.payload,
          schema_version = EXCLUDED.schema_version,
          updated_at = now()
      `;
      await sql`
        UPDATE workspaces SET updated_at = now() WHERE id = ${workspace.id}
      `;

      return jsonResponse(200, {
        ok: true,
        workspaceId: workspace.id,
        label: workspace.label,
        schemaVersion,
        updatedAt: new Date().toISOString(),
        message: 'Snapshot saved to Neon'
      }, event);
    }

    return jsonResponse(405, { error: 'Method Not Allowed', message: 'Use GET or PUT' }, event);
  } catch (err) {
    return jsonResponse(500, {
      error: 'Server Error',
      message: 'Snapshot operation failed. Check Netlify DATABASE_URL and the Neon schema.'
    }, event);
  }
}
