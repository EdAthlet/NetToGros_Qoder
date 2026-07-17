import { handleRpnRequest, corsHeaders } from '../../services/fake-revenue-server/lib/handlers.js';

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
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed', message: 'Use POST' })
    };
  }

  const body = parseBody(event);
  if (body === null) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Bad Request', message: 'Invalid JSON body' })
    };
  }

  const result = handleRpnRequest(body);
  return {
    statusCode: result.statusCode,
    headers: corsHeaders,
    body: JSON.stringify(result.body)
  };
}
