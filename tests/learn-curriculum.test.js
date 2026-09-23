import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel) {
    return readFileSync(resolve(rel), 'utf8');
}

function sentences(html) {
    const article = html.match(/<article[\s\S]*?<\/article>/)[0];
    const text = article
        .replace(/<h1[\s\S]*?<\/h1>/gi, ' ')
        .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/·/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return text.split(/(?<=[.])\s+/).filter(Boolean);
}

function footerHtml(html) {
    const footer = html.match(/<footer\b[^>]*class="site-footer"[\s\S]*?<\/footer>/);
    if (footer) return footer[0];
    return html.match(/<p\b[^>]*class="site-footer"[\s\S]*?<\/p>/)[0];
}

const publicPages = [
    'index.html',
    'batch/index.html',
    'contact.html',
    'contact-success.html',
    'cookies.html',
    'terms.html',
    'privacy.html',
    'Pensions/index.html',
    'payroll/index.html',
    'tax-credits/index.html',
    'tools/annualised-paye/index.html',
    'tools/fake-revenue/index.html',
    'learn/index.html',
    'learn/lesson-1.html',
    'learn/lesson-2.html',
    'learn/lesson-3.html',
];

describe('Learn in the public nav and footer', () => {
    for (const page of publicPages) {
        it(`${page} links Learn and keeps the legal footer`, () => {
            const html = read(page);
            const nav = html.match(/<nav\b[^>]*site-top-nav[\s\S]*?<\/nav>/)[0];
            const foot = footerHtml(html);
            expect(nav).toMatch(/href="\/learn\/"(?:\s[^>]*)?>Learn<\/a>/);
            expect(foot).toMatch(/href="\/learn\/"(?:\s[^>]*)?>Learn<\/a>/);
            expect(nav).toContain('Take Home Pay</a>');
            expect(nav).toContain('Bulk</span> Calculator</a>');
            expect(nav).toContain('Free</span> Payroll Practice</a>');
            expect(nav).toContain('href="/tax-credits/"');
            expect(nav).toContain('Tax Credits</a>');
            expect(nav).toContain('>PAYE Lab</a>');
            expect(foot).toContain('>Privacy</a>');
            expect(foot).toContain('>Terms</a>');
            expect(foot).toContain('>Cookies</a>');
            expect(foot).toContain('© 2025–2026 · Free Payroll Practice · Barbirba N™ · Barbirba Group');
            expect(html).not.toContain('cookie-banner');
            expect(html).not.toContain('cookieconsent');
        });
    }
});

describe('/learn/ curriculum', () => {
    it('lists three lessons and points at payroll, tax credits, and take-home pay', () => {
        const html = read('learn/index.html');
        expect(html).toContain('<title>Learn — Free Payroll Practice</title>');
        expect(html).toContain('<h1>Learn — Free Payroll Practice</h1>');
        expect(html).toContain('training sandbox');
        expect(html).toContain('fake Revenue');
        expect(html).toContain('not live ROS');
        expect(html.match(/<article\b/g)).toHaveLength(3);
        expect(html).toContain('Lesson 1 — Load the RPN sandbox');
        expect(html).toContain('Open Free Payroll Practice, load the RPN practice sandbox.');
        expect(html).toContain('Lesson 2 — Retrieve an RPN and run a preview');
        expect(html).toContain('RPN tab → Retrieve RPN → Calculate Preview → click the employee line.');
        expect(html).toContain('The Coach on that page walks the same steps.');
        expect(html).toContain('Lesson 3 — Tax credits into Take Home Pay');
        expect(html).toContain('Build a total on Tax Credits, Use in Take Home Pay, see Manual Annual Tax Credits filled.');
        expect(html).toContain('href="/payroll/"');
        expect(html).toContain('href="/tax-credits/"');
        expect(html).toContain('href="/"');
        expect(html).not.toContain('quiz');
    });

    it('adds /learn/ to the sitemap with today as lastmod', () => {
        const sitemap = read('sitemap.xml');
        const block = sitemap.slice(sitemap.indexOf('https://nettogross-eire.com/learn/'));
        expect(block.startsWith('https://nettogross-eire.com/learn/')).toBe(true);
        expect(block).toContain('<lastmod>2026-09-23</lastmod>');
    });

    it('keeps lesson 1 to a short page that opens payroll', () => {
        const html = read('learn/lesson-1.html');
        const lines = sentences(html);
        expect(lines.length).toBeGreaterThanOrEqual(4);
        expect(lines.length).toBeLessThanOrEqual(6);
        expect(html).toContain('href="/payroll/">Open Free Payroll Practice</a>');
        expect(lines.at(-1)).toBe('Open The Coach on payroll if you need ticks.');
    });

    it('keeps lesson 2 to the RPN preview steps', () => {
        const html = read('learn/lesson-2.html');
        const lines = sentences(html);
        expect(lines.length).toBeGreaterThanOrEqual(4);
        expect(lines.length).toBeLessThanOrEqual(6);
        expect(html).toContain('Retrieve RPN');
        expect(html).toContain('Calculate Preview');
        expect(html).toContain('href="/payroll/">Open Free Payroll Practice</a>');
        expect(lines).toContain('The Coach on that page walks the same steps.');
        expect(lines.at(-1)).toBe('Open The Coach on payroll if you need ticks.');
    });

    it('keeps lesson 3 to the tax credits handoff', () => {
        const html = read('learn/lesson-3.html');
        const lines = sentences(html);
        expect(lines.length).toBeGreaterThanOrEqual(4);
        expect(lines.length).toBeLessThanOrEqual(6);
        expect(html).toContain('href="/tax-credits/">Open Tax Credits</a>');
        expect(html).toContain('href="/">Open Take Home Pay</a>');
        expect(html).toContain('Annual Tax Credits');
        expect(lines.at(-1)).toBe('Open The Coach on payroll if you need ticks.');
    });
});
