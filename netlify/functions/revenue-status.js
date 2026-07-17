import { getServiceStatus, corsHeaders } from '../../services/fake-revenue-server/lib/handlers.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed', message: 'Use GET' })
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(
      getServiceStatus({
        mode: 'netlify-function',
        path: event.path || '/api/status'
      })
    )
  };
}
