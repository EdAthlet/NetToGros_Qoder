const ALLOWED_ORIGINS = [
  'https://nettogross-eire.com',
  'https://www.nettogross-eire.com',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:8888',
  'http://127.0.0.1:8888'
];

function requestOrigin(event) {
  const headers = (event && event.headers) || {};
  return headers.origin || headers.Origin || '';
}

export function corsHeadersFor(event) {
  const origin = requestOrigin(event);
  const allow = ALLOWED_ORIGINS.indexOf(origin) !== -1 ? origin : 'https://nettogross-eire.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Workspace-Key',
    'Content-Type': 'application/json',
    Vary: 'Origin'
  };
}

export const corsHeaders = corsHeadersFor();

export function jsonResponse(statusCode, body, event, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({}, corsHeadersFor(event), extraHeaders || {}),
    body: JSON.stringify(body)
  };
}

export function optionsResponse(event) {
  return { statusCode: 204, headers: corsHeadersFor(event), body: '' };
}

export function parseJsonBody(event) {
  if (!event.body) return {};
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64').toString('utf8')
      : event.body;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getWorkspaceKey(event) {
  const headers = event.headers || {};
  return (
    headers['x-workspace-key'] ||
    headers['X-Workspace-Key'] ||
    ''
  ).trim();
}
