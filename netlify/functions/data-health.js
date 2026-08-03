import { jsonResponse, optionsResponse } from './_shared/data-http.js';
import { getSql, isDatabaseConfigured } from './_shared/neon.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method Not Allowed' });
  }

  if (!isDatabaseConfigured()) {
    return jsonResponse(503, {
      status: 'unconfigured',
      service: 'payroll-cloud-data',
      message: 'DATABASE_URL is not set on Netlify. Create a Neon project and add the connection string.',
      database: false
    });
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT
        (SELECT COUNT(*)::int FROM workspaces) AS workspace_count,
        (SELECT COUNT(*)::int FROM workspace_snapshots) AS snapshot_count
    `;
    return jsonResponse(200, {
      status: 'ok',
      service: 'payroll-cloud-data',
      database: true,
      workspaceCount: rows[0]?.workspace_count ?? 0,
      snapshotCount: rows[0]?.snapshot_count ?? 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return jsonResponse(500, {
      status: 'error',
      service: 'payroll-cloud-data',
      database: true,
      message: err && err.message ? err.message : 'Database query failed'
    });
  }
}
