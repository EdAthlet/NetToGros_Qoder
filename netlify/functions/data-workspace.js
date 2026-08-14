import {
  jsonResponse,
  optionsResponse,
  parseJsonBody
} from './_shared/data-http.js';
import { generateAccessKey, getSql, isDatabaseConfigured } from './_shared/neon.js';
import { rateLimit, rateLimitedResponse } from './_shared/rate-limit.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse(event);
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed', message: 'Use POST to create a workspace' }, event);
  }

  const limited = rateLimit(event, 'workspace-create', 5, 15 * 60 * 1000);
  if (!limited.ok) return rateLimitedResponse(jsonResponse, event, limited.retryAfterMs);

  if (!isDatabaseConfigured()) {
    return jsonResponse(503, {
      error: 'Database not configured',
      message: 'Set DATABASE_URL in Netlify environment variables.'
    }, event);
  }

  const body = parseJsonBody(event);
  if (body === null) {
    return jsonResponse(400, { error: 'Bad Request', message: 'Invalid JSON body' }, event);
  }

  const label =
    body.label && String(body.label).trim()
      ? String(body.label).trim().slice(0, 120)
      : 'Practice workspace';

  try {
    const sql = getSql();
    const accessKey = generateAccessKey();
    const rows = await sql`
      INSERT INTO workspaces (access_key, label)
      VALUES (${accessKey}, ${label})
      RETURNING id, access_key, label, created_at
    `;
    const row = rows[0];
    return jsonResponse(201, {
      workspaceId: row.id,
      accessKey: row.access_key,
      label: row.label,
      createdAt: row.created_at,
      message: 'Save this access key — it is required to push and pull your payroll snapshot.'
    }, event);
  } catch (err) {
    return jsonResponse(500, {
      error: 'Server Error',
      message: 'Failed to create workspace. Check Netlify DATABASE_URL and the Neon schema.'
    }, event);
  }
}
