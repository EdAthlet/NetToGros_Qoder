import { getServiceStatus } from '../../services/fake-revenue-server/lib/handlers.js';
import { corsHeadersFor, jsonResponse } from './_shared/data-http.js';

export async function handler(event) {
  const headers = corsHeadersFor(event);
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return jsonResponse(405, { error: 'Method Not Allowed', message: 'Use GET' }, event);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(
      getServiceStatus({
        mode: 'netlify-function',
        path: event.path || '/api/status'
      })
    )
  };
}
