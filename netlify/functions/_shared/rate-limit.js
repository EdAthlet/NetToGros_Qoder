const buckets = new Map();

export function rateLimit(event, prefix, limit, windowMs) {
  const headers = (event && event.headers) || {};
  const forwarded = headers['x-forwarded-for'] || headers['X-Forwarded-For'] || '';
  const ip =
    headers['x-nf-client-connection-ip'] ||
    String(forwarded).split(',')[0].trim() ||
    'unknown';
  const key = prefix + ':' + ip;
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || now > current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1 };
  }

  current.count += 1;
  if (current.count > limit) {
    return { ok: false, remaining: 0, retryAfterMs: current.resetAt - now };
  }
  return { ok: true, remaining: limit - current.count };
}

export function rateLimitedResponse(jsonResponse, event, retryAfterMs) {
  const seconds = Math.max(1, Math.ceil((retryAfterMs || 60000) / 1000));
  return jsonResponse(429, {
    error: 'Too Many Requests',
    message: 'Practice API rate limit reached. Wait a moment and try again.'
  }, event, { 'Retry-After': String(seconds) });
}
