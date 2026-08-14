import { jsonResponse, optionsResponse } from './_shared/data-http.js';
import { getSql, isDatabaseConfigured } from './_shared/neon.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return optionsResponse(event);
  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method Not Allowed' }, event);
  }

  if (!isDatabaseConfigured()) {
    return jsonResponse(503, {
      status: 'unconfigured',
      service: 'payroll-cloud-data',
      message: 'DATABASE_URL is not set on Netlify. Create a Neon project and add the connection string.',
      database: false
    }, event);
  }

  try {
    const sql = getSql();
    await sql`SELECT 1`;
    return jsonResponse(200, {
      status: 'ok',
      service: 'payroll-cloud-data',
      database: true,
      timestamp: new Date().toISOString()
    }, event);
  } catch (err) {
    return jsonResponse(500, {
      status: 'error',
      service: 'payroll-cloud-data',
      database: true,
      message: 'Database query failed'
    }, event);
  }
}
