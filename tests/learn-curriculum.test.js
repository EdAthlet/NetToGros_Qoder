import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

function read(rel) {
    return readFileSync(resolve(rel), 'utf8');
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
    'learn/lesson-4.html',
    'learn/lesson-5.html',
    'learn/lab/index.html',
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
    it('lists five lessons and points at payroll, tax credits, and take-home pay', () => {
        const html = read('learn/index.html');
        expect(html).toContain('<title>Learn — Free Payroll Practice</title>');
        expect(html).toContain('<h1>Learn — Free Payroll Practice</h1>');
        expect(html).toContain('training sandbox');
        expect(html).toContain('fake Revenue');
        expect(html).toContain('not live ROS');
        expect(html.match(/<article\b/g)).toHaveLength(5);
        expect(html).toContain('Lesson 1 — Load the RPN sandbox');
        expect(html).toContain('Lesson 2 — Retrieve an RPN and run a preview');
        expect(html).toContain('Lesson 3 — Tax credits into Take Home Pay');
        expect(html).toContain('href="/learn/lesson-4.html">Lesson 4 — When Retrieve RPN fails</a>');
        expect(html).toContain('href="/learn/lesson-5.html">Lesson 5 — LPT on the payslip</a>');
        expect(html).toContain('Daniel McCarthy (PPSN 7567890IJ)');
        expect(html).toContain('Sofia OBrien');
        expect(html).toContain('€45.00');
        expect(html).toContain('href="/payroll/"');
        expect(html).toContain('href="/tax-credits/"');
        expect(html).toContain('href="/"');
        expect(html).not.toContain('quiz');
    });

    it('uses Aim, Steps, Done when, and Next on the catalogue, lesson pages, and lab', () => {
        const catalogue = [...read('learn/index.html').matchAll(/<ol class="lesson-steps">[\s\S]*?<\/ol>/g)].map((match) => match[0]);
        const lab = [...read('learn/lab/index.html').matchAll(/<ol class="lesson-steps">[\s\S]*?<\/ol>/g)].map((match) => match[0]);
        expect(catalogue).toHaveLength(5);
        expect(lab).toHaveLength(5);
        for (let n = 1; n <= 5; n++) {
            const page = read(`learn/lesson-${n}.html`);
            const steps = page.match(/<ol class="lesson-steps">[\s\S]*?<\/ol>/)[0];
            const items = (ol) => [...ol.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) => match[1].trim());
            expect(items(catalogue[n - 1])).toEqual(items(steps));
            expect(items(lab[n - 1])).toEqual(items(steps));
            const sentence = (html, label) => {
                const found = [...html.matchAll(new RegExp(`>${label}</h[23]>\\s*<p>([\\s\\S]*?)</p>`, 'g'))];
                return found.map((match) => match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
            };
            expect(sentence(read('learn/index.html'), 'Aim')[n - 1]).toBe(sentence(page, 'Aim')[0]);
            expect(sentence(read('learn/lab/index.html'), 'Aim')[n - 1]).toBe(sentence(page, 'Aim')[0]);
            expect(sentence(read('learn/index.html'), 'Done when')[n - 1]).toBe(sentence(page, 'Done when')[0]);
            expect(sentence(read('learn/lab/index.html'), 'Done when')[n - 1]).toBe(sentence(page, 'Done when')[0]);
            for (const label of ['Aim', 'Steps', 'Done when', 'Next']) {
                expect(page).toContain(`>${label}</h2>`);
                expect(read('learn/index.html')).toContain(`>${label}</h3>`);
                expect(read('learn/lab/index.html')).toContain(`>${label}</h3>`);
            }
            expect(page).toContain('data-learn-complete="' + n + '">Mark complete</button>');
            expect(page).toContain('data-learn-clear="' + n + '">Clear completion</button>');
            expect(read('learn/lab/index.html')).toContain('data-learn-complete="' + n + '">Mark complete</button>');
        }
        expect(read('learn/lesson-4.html')).toContain('PPSN ending in 0');
        expect(read('learn/lesson-4.html')).toContain('7567890IJ');
        expect(read('learn/lesson-4.html')).toContain('Invalid or unknown PPSN');
        expect(read('learn/lesson-4.html')).toContain('not live ROS');
        expect(read('learn/lesson-5.html')).toContain('Sofia OBrien');
        expect(read('learn/lesson-5.html')).toContain('7234567CD');
        expect(read('learn/lesson-5.html')).toContain('LPT €45.00');
    });

    it('adds an Open in lab link on each catalogue card and keeps the standalone pages', () => {
        const html = read('learn/index.html');
        const cards = html.match(/<article\b[\s\S]*?<\/article>/g);
        expect(cards).toHaveLength(5);
        cards.forEach((card, index) => {
            expect(card).toContain(`class="open-in-lab" href="/learn/lab/?lesson=${index + 1}">Open in lab</a>`);
            expect(card).toContain(`href="/learn/lesson-${index + 1}.html">`);
        });
    });

    it('adds /learn/ and lessons 4 and 5 to the sitemap with today as lastmod', () => {
        const sitemap = read('sitemap.xml');
        const block = sitemap.slice(sitemap.indexOf('https://nettogross-eire.com/learn/'));
        expect(block.startsWith('https://nettogross-eire.com/learn/')).toBe(true);
        expect(block).toContain('<lastmod>2026-09-23</lastmod>');
        for (const loc of [
            'https://nettogross-eire.com/learn/lesson-4.html',
            'https://nettogross-eire.com/learn/lesson-5.html',
        ]) {
            const entry = sitemap.slice(sitemap.indexOf(loc));
            expect(entry.startsWith(loc)).toBe(true);
            expect(entry).toContain('<lastmod>2026-09-23</lastmod>');
        }
    });

});

describe('/learn/lab/ shell', () => {
    const lessonTitles = [
        'Lesson 1 — Load the RPN sandbox',
        'Lesson 2 — Retrieve an RPN and run a preview',
        'Lesson 3 — Tax credits into Take Home Pay',
        'Lesson 4 — When Retrieve RPN fails',
        'Lesson 5 — LPT on the payslip',
    ];

    function labHtml() {
        return read('learn/lab/index.html');
    }

    function labScript(html) {
        const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
        return blocks.find((block) => block.includes('lessonWorkspace'));
    }

    function mountLab(search) {
        const html = labHtml();
        const buttonTags = [...html.matchAll(/<button\b(?=[^>]*\bdata-lesson=")[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
        const panelTags = html.match(/<div class="lab-step-panel"[\s\S]*?<\/div>\s*(?=<div class="lab-step-panel"|<\/div>)/g);
        expect(buttonTags).toHaveLength(5);
        expect(panelTags).toHaveLength(5);

        function elFromTag(tag, text) {
            const attrs = {};
            for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
            return {
                attrs,
                text,
                listeners: {},
                getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
                setAttribute(name, value) { this.attrs[name] = String(value); },
                removeAttribute(name) { delete this.attrs[name]; },
                addEventListener(type, fn) { this.listeners[type] = fn; },
            };
        }

        const buttons = buttonTags.map((tag) => elFromTag(tag, tag.replace(/<[^>]+>/g, '').trim()));
        const panels = panelTags.map((tag) => elFromTag(tag, ''));
        const frame = elFromTag('<iframe id="lessonWorkspace" title="Lesson workspace">', '');
        const listeners = {};
        const historyLog = [];
        const location = new URL(`http://127.0.0.1/learn/lab/${search || ''}`);
        const sandbox = {
            document: {
                getElementById(id) { return id === 'lessonWorkspace' ? frame : null; },
                querySelectorAll(selector) {
                    if (selector === '.lab-lessons button[data-lesson]') return buttons;
                    if (selector === '[data-lesson-panel]') return panels;
                    return [];
                },
            },
            window: {
                location,
                addEventListener(type, fn) { listeners[type] = fn; },
            },
            history: {
                pushState(_state, _title, next) {
                    historyLog.push(['push', next]);
                    const url = new URL(next, location.origin);
                    location.pathname = url.pathname;
                    location.search = url.search;
                },
                replaceState(_state, _title, next) {
                    historyLog.push(['replace', next]);
                    const url = new URL(next, location.origin);
                    location.pathname = url.pathname;
                    location.search = url.search;
                },
            },
            URL,
            URLSearchParams,
        };
        sandbox.window.location = location;
        runInNewContext(labScript(html), sandbox);
        return { buttons, panels, frame, listeners, historyLog, location };
    }

    it('lists lessons 1–5, the disclaimer, and a Lesson workspace frame', () => {
        const html = labHtml();
        expect(html).toContain('<h1>Learn — Free Payroll Practice</h1>');
        expect(html).toContain('practice sandbox');
        expect(html).toContain('fake Revenue');
        expect(html).toContain('not live ROS');
        expect(html).toContain('title="Lesson workspace"');
        expect(html).not.toContain('Lesson 6');
        expect(html).not.toContain('quiz');
        expect(html).not.toContain('cookie-banner');
        for (const title of lessonTitles) {
            expect(html).toContain(`>${title}</span>`);
        }
        expect(html).toContain('data-lesson="1" data-tool="/payroll/"');
        expect(html).toContain('data-lesson="2" data-tool="/payroll/"');
        expect(html).toContain('data-lesson="3" data-tool="/tax-credits/"');
        expect(html).toContain('data-lesson="4" data-tool="/payroll/"');
        expect(html).toContain('data-lesson="5" data-tool="/payroll/"');
        expect(html).toContain('Daniel McCarthy\'s row (PPSN 7567890IJ).');
        expect(html).toContain('LPT €45.00 for Sofia OBrien.');
        expect(html).toContain('Click Common: single employee.');
        expect(html).toContain('Load RPN practice sandbox (Recommended first).');
        expect(html).toContain('src="/learn/learn-progress.js"');
        const inline = labScript(html);
        expect(inline).not.toContain('localStorage');
    });

    it('adds /learn/lab/ to the sitemap', () => {
        const sitemap = read('sitemap.xml');
        const entry = sitemap.slice(sitemap.indexOf('https://nettogross-eire.com/learn/lab/'));
        expect(entry.startsWith('https://nettogross-eire.com/learn/lab/')).toBe(true);
        expect(entry).toContain('<lastmod>2026-09-23</lastmod>');
    });

    it('stacks under 900px and keeps a 280px column with a 70vh workspace from 900px', () => {
        const css = read('learn/learn.css');
        expect(css).toContain('min-height: 70vh');
        expect(css).toMatch(/@media \(min-width: 900px\)[\s\S]*grid-template-columns:\s*280px/);
        expect(css).toMatch(/\.lab-steps\s*\{[^}]*overflow-y:\s*auto/);
    });

    it('collapses the lesson menu when a lesson is clicked and opens it again from that lesson', () => {
        const html = labHtml();
        const buttonTags = [...html.matchAll(/<button\b(?=[^>]*\bdata-lesson=")[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
        const panelTags = html.match(/<div class="lab-step-panel"[\s\S]*?<\/div>\s*(?=<div class="lab-step-panel"|<\/div>)/g);
        const classes = new Set();
        const side = {
            classList: {
                add(name) { classes.add(name); },
                remove(name) { classes.delete(name); },
                contains(name) { return classes.has(name); },
            },
        };
        const nav = { attrs: { 'aria-expanded': 'true' }, setAttribute(name, value) { this.attrs[name] = value; } };
        const steps = { scrollTop: 40 };
        function elFromTag(tag) {
            const attrs = {};
            for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[match[1]] = match[2];
            return {
                attrs,
                listeners: {},
                getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null; },
                setAttribute(name, value) { this.attrs[name] = String(value); },
                removeAttribute(name) { delete this.attrs[name]; },
                addEventListener(type, fn) { this.listeners[type] = fn; },
            };
        }
        const buttons = buttonTags.map((tag) => elFromTag(tag));
        const panels = panelTags.map((tag) => elFromTag(tag));
        const frame = elFromTag('<iframe id="lessonWorkspace" title="Lesson workspace">');
        const location = new URL('http://127.0.0.1/learn/lab/?lesson=1');
        runInNewContext(labScript(html), {
            document: {
                getElementById(id) { return id === 'lessonWorkspace' ? frame : null; },
                querySelectorAll(selector) {
                    if (selector === '.lab-lessons button[data-lesson]') return buttons;
                    if (selector === '[data-lesson-panel]') return panels;
                    return [];
                },
                querySelector(selector) {
                    if (selector === '.lab-side') return side;
                    if (selector === '.lab-lessons') return nav;
                    if (selector === '.lab-steps') return steps;
                    return null;
                },
            },
            window: {
                location,
                addEventListener() {},
            },
            history: {
                pushState(_state, _title, next) {
                    const url = new URL(next, location.origin);
                    location.pathname = url.pathname;
                    location.search = url.search;
                },
                replaceState() {},
            },
            URL,
            URLSearchParams,
        });
        expect(classes.has('is-menu-collapsed')).toBe(false);
        buttons[3].listeners.click.call(buttons[3]);
        expect(classes.has('is-menu-collapsed')).toBe(true);
        expect(nav.attrs['aria-expanded']).toBe('false');
        expect(steps.scrollTop).toBe(0);
        expect(buttons[3].getAttribute('aria-current')).toBe('true');
        buttons[3].listeners.click.call(buttons[3]);
        expect(classes.has('is-menu-collapsed')).toBe(false);
        expect(nav.attrs['aria-expanded']).toBe('true');
    });

    it('opens lesson 3 on Tax Credits and leaves payroll lessons on /payroll/', () => {
        const lesson3 = mountLab('?lesson=3');
        expect(lesson3.frame.getAttribute('src')).toBe('/tax-credits/');
        expect(lesson3.panels[2].getAttribute('hidden')).toBeNull();
        expect(lesson3.panels[0].getAttribute('hidden')).toBe('');
        expect(lesson3.buttons[2].getAttribute('aria-current')).toBe('true');
        expect(lesson3.buttons[0].getAttribute('aria-current')).toBeNull();

        lesson3.buttons[0].listeners.click.call(lesson3.buttons[0]);
        expect(lesson3.frame.getAttribute('src')).toBe('/payroll/');
        expect(lesson3.panels[0].getAttribute('hidden')).toBeNull();
        expect(lesson3.panels[2].getAttribute('hidden')).toBe('');
        expect(lesson3.location.search).toBe('?lesson=1');

        lesson3.buttons[4].listeners.click.call(lesson3.buttons[4]);
        expect(lesson3.frame.getAttribute('src')).toBe('/payroll/');
        expect(lesson3.panels[4].getAttribute('hidden')).toBeNull();
        expect(lesson3.panels[0].getAttribute('hidden')).toBe('');
        expect(lesson3.location.search).toBe('?lesson=5');
    });

    it('marks a lesson complete only from Mark complete, and clears it', () => {
        const store = new Map();
        const cards = [1, 2, 3, 4, 5].map((n) => {
            const status = { hidden: true, attrs: { hidden: '' } };
            return {
                n: String(n),
                className: new Set(),
                classList: {
                    toggle(name, on) {
                        if (on) cards[n - 1].className.add(name);
                        else cards[n - 1].className.delete(name);
                    },
                },
                status,
                getAttribute(name) { return name === 'data-learn-lesson' ? String(n) : null; },
                querySelectorAll(selector) {
                    return selector === '[data-learn-status]' ? [status] : [];
                },
            };
        });
        cards.forEach((card) => {
            card.classList.toggle = (name, on) => {
                if (on) card.className.add(name);
                else card.className.delete(name);
            };
            card.status.removeAttribute = (name) => { if (name === 'hidden') card.status.hidden = false; };
            card.status.setAttribute = (name) => { if (name === 'hidden') card.status.hidden = true; };
        });
        const listeners = {};
        const sandbox = {
            localStorage: {
                getItem(key) { return store.has(key) ? store.get(key) : null; },
                setItem(key, value) { store.set(key, String(value)); },
                removeItem(key) { store.delete(key); },
            },
            document: {
                readyState: 'complete',
                querySelectorAll(selector) {
                    return selector === '[data-learn-lesson]' ? cards : [];
                },
                addEventListener(type, fn) { listeners[type] = fn; },
            },
            window: { addEventListener() {} },
        };
        runInNewContext(read('learn/learn-progress.js'), sandbox);
        expect(cards[0].className.has('is-completed')).toBe(false);
        expect(cards[0].status.hidden).toBe(true);

        listeners.click({
            target: {
                closest(selector) {
                    if (selector === '[data-learn-complete], [data-learn-clear]') {
                        return {
                            getAttribute(name) { return name === 'data-learn-complete' ? '1' : null; },
                            hasAttribute(name) { return name === 'data-learn-complete'; },
                        };
                    }
                    return null;
                },
            },
        });
        expect(store.get('payePractice.learn.lesson1.done')).toBe('1');
        expect(cards[0].className.has('is-completed')).toBe(true);
        expect(cards[0].status.hidden).toBe(false);
        expect(cards[1].className.has('is-completed')).toBe(false);

        listeners.click({
            target: {
                closest(selector) {
                    if (selector === '[data-learn-complete], [data-learn-clear]') {
                        return {
                            getAttribute(name) { return name === 'data-learn-clear' ? '1' : null; },
                            hasAttribute() { return false; },
                        };
                    }
                    return null;
                },
            },
        });
        expect(store.has('payePractice.learn.lesson1.done')).toBe(false);
        expect(cards[0].className.has('is-completed')).toBe(false);
        expect(cards[0].status.hidden).toBe(true);
    });

    it('ignores a lesson number this pass does not have', () => {
        const lab = mountLab('?lesson=6');
        expect(lab.frame.getAttribute('src')).toBe('/payroll/');
        expect(lab.buttons[0].getAttribute('aria-current')).toBe('true');
        expect(lab.panels[0].getAttribute('hidden')).toBeNull();
        expect(lab.location.search).toBe('?lesson=1');
        expect(lab.historyLog.some((entry) => entry[0] === 'replace' && entry[1].endsWith('?lesson=1'))).toBe(true);
    });
});
