import { handlePsrRequest } from '../../services/fake-revenue-server/lib/handlers.js';
import { corsHeadersFor, jsonResponse } from './_shared/data-http.js';
import { rateLimit, rateLimitedResponse } from './_shared/rate-limit.js';

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body);
  } catch {
    return null;
  }
}

export async function handler(event) {
  const headers = corsHeadersFor(event);
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method Not Allowed', message: 'Use POST' }, event);
  }

  const limited = rateLimit(event, 'psr', 30, 5 * 60 * 1000);
  if (!limited.ok) return rateLimitedResponse(jsonResponse, event, limited.retryAfterMs);

  const body = parseBody(event);
  if (body === null) {
    return jsonResponse(400, { error: 'Bad Request', message: 'Invalid JSON body' }, event);
  }

  const result = handlePsrRequest(body);
  return {
    statusCode: result.statusCode,
    headers,
    body: JSON.stringify(result.body)
  };
}
