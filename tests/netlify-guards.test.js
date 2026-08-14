import { describe, expect, it } from 'vitest';
import { corsHeadersFor } from '../netlify/functions/_shared/data-http.js';
import { rateLimit } from '../netlify/functions/_shared/rate-limit.js';

describe('API origin lock', () => {
    it('allows the live site origin', () => {
        const headers = corsHeadersFor({
            headers: { origin: 'https://nettogross-eire.com' }
        });
        expect(headers['Access-Control-Allow-Origin']).toBe('https://nettogross-eire.com');
    });

    it('does not reflect an unknown origin', () => {
        const headers = corsHeadersFor({
            headers: { origin: 'https://evil.example' }
        });
        expect(headers['Access-Control-Allow-Origin']).toBe('https://nettogross-eire.com');
    });
});

describe('API rate limit', () => {
    it('blocks a caller after the limit', () => {
        const event = { headers: { 'x-forwarded-for': '203.0.113.9' } };
        let last = { ok: true };
        for (let i = 0; i < 4; i++) {
            last = rateLimit(event, 'test-limit', 3, 60_000);
        }
        expect(last.ok).toBe(false);
    });
});
