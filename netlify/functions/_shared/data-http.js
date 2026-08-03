export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Workspace-Key',
  'Content-Type': 'application/json'
};

export function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body)
  };
}

export function optionsResponse() {
  return { statusCode: 204, headers: corsHeaders, body: '' };
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
