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
    'learn/lab/index.html',
];

describe('Learn in the public nav and footer', () => {
    for (const page of publicPages) {
        it(`${page} links Learn and keeps the legal footer`, () => {
            const html = read(page);
            const nav = html.match(/<nav\b[^>]*site-top-nav[\s\S]*?<\/nav>/)[0];
            const foot = footerHtml(html);
            const learnLink = /<a\b(?=[^>]*\bhref="\/learn\/lab\/\?lesson=1")(?=[^>]*\btarget="_top")[^>]*>Learn the Project<\/a>/;
            expect(nav).toMatch(learnLink);
            expect(foot).toMatch(learnLink);
            expect(nav).not.toMatch(/>Learn<\/a>/);
            expect(foot).not.toMatch(/>Learn<\/a>/);
            expect(html).not.toMatch(/href="\/learn\/"/);
            expect(read('payroll/index.html')).toContain('>Learn the Project</a>');
            expect(read('payroll/index.html')).not.toMatch(/>Learn<\/a>/);
            expect(read('learn/lab/index.html')).not.toMatch(/>Learn<\/a>/);
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
    it('redirects /learn/ immediately to the last lab lesson', () => {
        const html = read('learn/index.html');
        expect(html.indexOf('location.replace(target)')).toBeLessThan(html.indexOf('<body'));
        expect(html).not.toContain('site-top-nav');
        expect(html).not.toContain('lab-lessons');
        expect(html).not.toContain('lesson-list');
        expect(html).not.toMatch(/>Learn<\/a>/);
        expect(html).not.toMatch(/href="\/learn\/"/);
        expect(html).toContain('<meta http-equiv="Cache-Control" content="no-store">');
        expect(html).toContain('<a href="/learn/lab/?lesson=1" target="_top">Learn the Project</a>');
        expect(html).not.toContain('lab-lessons');
        const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]).find((block) => block.includes('lastLesson'));
        function run(saved) {
            const replaced = [];
            const store = new Map();
            if (saved) store.set('payePractice.learn.lastLesson', saved);
            runInNewContext(script, {
                localStorage: {
                    getItem(key) { return store.has(key) ? store.get(key) : null; },
                },
                location: { replace(url) { replaced.push(url); } },
                window: {},
            });
            return replaced;
        }
        expect(run('6')).toEqual(['/learn/lab/?lesson=6']);
        expect(run(null)).toEqual(['/learn/lab/?lesson=1']);
        expect(run('9')).toEqual(['/learn/lab/?lesson=1']);
    });

    it('uses Aim, Steps, Done when, and Next on the lab only', () => {
        const labHtml = read('learn/lab/index.html');
        const steps = [...labHtml.matchAll(/<ol class="lesson-steps">[\s\S]*?<\/ol>/g)].map((match) => match[0]);
        expect(steps).toHaveLength(6);
        const sentence = (label) => {
            const found = [...labHtml.matchAll(new RegExp(`>${label}</h3>\\s*<p>([\\s\\S]*?)</p>`, 'g'))];
            return found.map((match) => match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
        };
        expect(sentence('Aim')).toHaveLength(6);
        expect(sentence('Done when')).toHaveLength(6);
        for (const label of ['Aim', 'Steps', 'Done when', 'Next']) {
            expect(labHtml).toContain(`>${label}</h3>`);
        }
        for (let n = 1; n <= 6; n++) {
            expect(labHtml).toContain('data-learn-complete="' + n + '">Mark complete</button>');
            expect(labHtml).toContain('data-learn-clear="' + n + '">Clear this lab</button>');
            expect(labHtml).toContain('data-learn-lesson="' + n + '"');
        }
        expect(labHtml).toContain('data-learn-clear-all>Clear all labs</button>');
        for (let n = 2; n <= 6; n++) {
            expect(labHtml).toContain(`href="/learn/lab/?lesson=${n}">Lesson ${n}</a>`);
        }
        expect(labHtml).toContain('href="/learn/lab/" target="_top">All lessons</a>');
        expect(labHtml).not.toMatch(/lesson-\d\.html/);
        expect(labHtml).not.toContain('Open in lab');
        expect(labHtml).toContain('PPSN ending in 0');
        expect(labHtml).toContain('7567890IJ');
        expect(labHtml).toContain('Invalid or unknown PPSN');
        expect(labHtml).toContain('not live ROS');
        expect(labHtml).toContain('Sofia OBrien');
        expect(labHtml).toContain('7234567CD');
        expect(labHtml).toContain('LPT €45.00');
        expect(labHtml.replace(/&amp;/g, '&')).toContain('Click Commit to Payroll.');
        expect(labHtml.replace(/&amp;/g, '&')).not.toContain('Confirm & Save');
        expect(labHtml).toContain('History tab');
        expect(labHtml).not.toContain('>Commit<');
        expect(labHtml).not.toContain('Lesson 7');
    });

    it('keeps /learn/ and /learn/lab/ in the sitemap and drops standalone lesson pages', () => {
        const sitemap = read('sitemap.xml');
        for (const loc of [
            'https://nettogross-eire.com/learn/',
            'https://nettogross-eire.com/learn/lab/',
        ]) {
            const entry = sitemap.slice(sitemap.indexOf(loc));
            expect(entry.startsWith(loc)).toBe(true);
            expect(entry.match(/<lastmod>[^<]+<\/lastmod>/)[0]).toBe('<lastmod>2026-09-28</lastmod>');
        }
        expect(sitemap).not.toMatch(/learn\/lesson-\d\.html/);
    });

    it('points Learn the Project at the saved lesson in one step', () => {
        const links = [{
            textContent: 'Learn the Project',
            attrs: { href: '/learn/lab/?lesson=1', target: '_top' },
            getAttribute(name) { return this.attrs[name]; },
            setAttribute(name, value) { this.attrs[name] = value; },
        }];
        const store = new Map([['payePractice.learn.lastLesson', '2']]);
        runInNewContext(read('js/learn-open.js'), {
            localStorage: { getItem(key) { return store.has(key) ? store.get(key) : null; } },
            document: {
                readyState: 'complete',
                querySelectorAll() { return links; },
                addEventListener() {},
            },
        });
        expect(links[0].getAttribute('href')).toBe('/learn/lab/?lesson=2');
        expect(links[0].getAttribute('target')).toBe('_top');
    });

    it('does not let the site service worker cache /learn/ or /learn/lab/', () => {
        const sandbox = { self: { addEventListener() {} } };
        runInNewContext(read('sw.js') + '\nthis.__cache = CACHE_NAME;\nthis.__allow = isCalculatorRequest;', sandbox);
        expect(sandbox.__cache).toBe('irish-calculator-v2.0.4');
        const allow = (path) => sandbox.__allow(new URL('https://nettogross-eire.com' + path));
        expect(allow('/learn/')).toBe(false);
        expect(allow('/learn/lab/')).toBe(false);
        expect(allow('/learn')).toBe(false);
        expect(allow('/payroll/')).toBe(false);
        expect(allow('/')).toBe(true);
    });

    it('redirects /learn/lesson-2.html to lab lesson 2', () => {
        const toml = read('netlify.toml');
        for (let n = 1; n <= 6; n++) {
            const from = `from = "/learn/lesson-${n}.html"`;
            const entry = toml.slice(toml.indexOf(from));
            expect(entry.startsWith(from)).toBe(true);
            expect(entry).toContain(`to = "/learn/lab/?lesson=${n}"`);
            expect(entry).toContain('status = 301');
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
        'Lesson 6 — Confirm and save the payroll run',
    ];

    function labHtml() {
        return read('learn/lab/index.html');
    }

    function labScript(html) {
        const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
        return blocks.find((block) => block.includes('lessonWorkspace'));
    }

    function labPanels(html) {
        const panels = [];
        let from = 0;
        while (from < html.length) {
            const start = html.indexOf('<div class="lab-step-panel"', from);
            if (start === -1) break;
            let depth = 0;
            let i = start;
            while (i < html.length) {
                const nextOpen = html.indexOf('<div', i);
                const nextClose = html.indexOf('</div>', i);
                if (nextClose === -1) break;
                if (nextOpen !== -1 && nextOpen < nextClose) {
                    depth += 1;
                    i = nextOpen + 4;
                } else {
                    depth -= 1;
                    i = nextClose + '</div>'.length;
                    if (depth === 0) break;
                }
            }
            panels.push(html.slice(start, i));
            from = i;
        }
        return panels;
    }

    function mountLab(search, store) {
        const html = labHtml();
        const buttonTags = [...html.matchAll(/<button\b(?=[^>]*\bdata-lesson=")[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
        const panelTags = labPanels(html);
        expect(buttonTags).toHaveLength(6);
        expect(panelTags).toHaveLength(6);
        panelTags.forEach((panel) => {
            expect(panel.indexOf('class="lesson-complete-actions"')).toBeGreaterThan(panel.indexOf('</div>'));
        });
        const memory = store || new Map();

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
        const docListeners = {};
        const historyLog = [];
        const location = new URL(`http://127.0.0.1/learn/lab/${search || ''}`);
        const sandbox = {
            localStorage: {
                getItem(key) { return memory.has(key) ? memory.get(key) : null; },
                setItem(key, value) { memory.set(key, String(value)); },
                removeItem(key) { memory.delete(key); },
            },
            document: {
                readyState: 'complete',
                getElementById(id) { return id === 'lessonWorkspace' ? frame : null; },
                querySelectorAll(selector) {
                    if (selector === '.lab-lessons button[data-lesson]') return buttons;
                    if (selector === '[data-lesson-panel]') return panels;
                    return [];
                },
                addEventListener(type, fn) { docListeners[type] = fn; },
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
        sandbox.window.history = sandbox.history;
        runInNewContext(read('learn/learn-progress.js'), sandbox);
        runInNewContext(labScript(html), sandbox);
        return { buttons, panels, frame, listeners, docListeners, historyLog, location, memory };
    }

    it('lists lessons 1–6, the disclaimer, and a Lesson workspace frame', () => {
        const html = labHtml();
        expect(html).toContain('<h1>Learn — Free Payroll Practice</h1>');
        expect(html).toContain('practice sandbox');
        expect(html).toContain('fake Revenue');
        expect(html).toContain('not live ROS');
        expect(html).toContain('title="Lesson workspace"');
        expect(html).toContain('Lesson 6 — Confirm and save the payroll run');
        expect(html.replace(/&amp;/g, '&')).toContain('Click Commit to Payroll.');
        expect(html.replace(/&amp;/g, '&')).not.toContain('Confirm & Save');
        expect(html).toContain('History tab');
        expect(html).toContain('data-lesson="6" data-tool="/payroll/"');
        expect(html.match(/<button\b[^>]*\bdata-lesson="/g)).toHaveLength(6);
        expect(html.match(/data-lesson-panel="/g)).toHaveLength(6);
        const tools = [...html.matchAll(/\bdata-tool="([^"]+)"/g)].map((match) => match[1]);
        expect(tools).toEqual(['/payroll/', '/payroll/', '/tax-credits/', '/payroll/', '/payroll/', '/payroll/']);
        expect(html).not.toMatch(/<iframe\b[^>]*\bsrc="\/learn/);
        expect(html).not.toContain('Lesson 7');
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
        expect(html).toContain('data-lesson="6" data-tool="/payroll/"');
        expect(html).toContain('Daniel McCarthy\'s row (PPSN 7567890IJ).');
        expect(html).toContain('LPT €45.00 for Sofia OBrien.');
        expect(html).toContain('Click Common: single employee.');
        expect(html).toContain('Load RPN practice sandbox (Recommended first).');
        expect(html).toContain('src="/learn/learn-progress.js"');
        expect(html).toContain('<meta http-equiv="Cache-Control" content="no-store">');
        expect(html).toContain('if (event.persisted) location.reload()');
        expect(html).toMatch(/<a\b(?=[^>]*\bhref="\/learn\/lab\/\?lesson=1")(?=[^>]*\bclass="is-current")(?=[^>]*\btarget="_top")[^>]*>Learn the Project<\/a>/);
        expect(html).toContain('Clear this lab</button>');
        expect(html).toContain('data-learn-clear-all>Clear all labs</button>');
        expect(html).toContain('class="lab-step-body"');
        expect(html).toContain('href="/learn/lab/" target="_top">All lessons</a>');
        expect(html.indexOf('src="/learn/learn-progress.js"')).toBeLessThan(html.indexOf('function buttonFor'));
        expect(read('cookies.html')).toContain('payePractice.learn.lastLesson');
        expect(read('learn/learn-progress.js')).toContain("var LAST_KEY = 'payePractice.learn.lastLesson';");
        const inline = labScript(html);
        expect(inline).not.toContain('localStorage');
        expect(inline).toContain("next !== '/payroll/' && next !== '/tax-credits/'");
        expect(inline).toContain("type: 'paye-learn-lesson'");
        expect(inline).not.toContain('/learn/lab/');
    });

    it('adds /learn/lab/ to the sitemap', () => {
        const sitemap = read('sitemap.xml');
        const entry = sitemap.slice(sitemap.indexOf('https://nettogross-eire.com/learn/lab/'));
        expect(entry.startsWith('https://nettogross-eire.com/learn/lab/')).toBe(true);
        expect(entry.match(/<lastmod>[^<]+<\/lastmod>/)[0]).toBe('<lastmod>2026-09-28</lastmod>');
    });

    it('stacks under 900px and keeps a 280px column with a 70vh workspace from 900px', () => {
        const css = read('learn/learn.css');
        expect(css).toContain('min-height: 70vh');
        expect(css).toMatch(/@media \(min-width: 900px\)[\s\S]*grid-template-columns:\s*280px/);
        expect(css).toMatch(/\.lab-lessons\s*\{[^}]*min-height:\s*0/);
        expect(css).toMatch(/\.lab-lessons\s*\{[^}]*overflow-y:\s*auto/);
        expect(css).toMatch(/\.lab-step-body\s*\{[^}]*overflow-y:\s*auto/);
        expect(css).toMatch(/\.lab-lessons button\.is-completed\s*\{[^}]*background:\s*#d8eedc/);
        expect(css).toMatch(/button\[aria-current="true"\][\s\S]*?background:\s*#fff4c2/);
        expect(css).toContain('background: #e7f1fb');
        expect(css).toContain('background: #fdecea');
        expect(css).toMatch(/@media \(min-width: 900px\)[\s\S]*\[data-learn-clear-all\]/);
        expect(css).not.toContain('is-menu-collapsed');
        expect(css).not.toContain('Show lessons');
    });

    it('keeps all six lessons visible when a lesson is clicked again', () => {
        const html = labHtml();
        const buttonTags = [...html.matchAll(/<button\b(?=[^>]*\bdata-lesson=")[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
        const panelTags = labPanels(html);
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
                    if (selector === '.lab-step-body') return [steps];
                    return [];
                },
                querySelector(selector) {
                    if (selector === '.lab-side') return side;
                    if (selector === '.lab-lessons') return nav;
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
        expect(buttons).toHaveLength(6);
        buttons[3].listeners.click.call(buttons[3]);
        expect(classes.has('is-menu-collapsed')).toBe(false);
        expect(nav.attrs['aria-expanded']).toBe('true');
        expect(steps.scrollTop).toBe(0);
        expect(buttons[3].getAttribute('aria-current')).toBe('true');
        expect(buttons[5].getAttribute('data-lesson')).toBe('6');
        buttons[3].listeners.click.call(buttons[3]);
        expect(classes.has('is-menu-collapsed')).toBe(false);
        expect(nav.attrs['aria-expanded']).toBe('true');
        expect(buttons[3].getAttribute('aria-current')).toBe('true');
        buttons[5].listeners.click.call(buttons[5]);
        expect(classes.has('is-menu-collapsed')).toBe(false);
        expect(buttons[5].getAttribute('aria-current')).toBe('true');
        expect(buttons[3].getAttribute('aria-current')).toBeNull();
        expect(frame.getAttribute('src')).toBe('/payroll/');
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

        lesson3.buttons[5].listeners.click.call(lesson3.buttons[5]);
        expect(lesson3.frame.getAttribute('src')).toBe('/payroll/');
        expect(lesson3.panels[5].getAttribute('hidden')).toBeNull();
        expect(lesson3.panels[4].getAttribute('hidden')).toBe('');
        expect(lesson3.location.search).toBe('?lesson=6');
    });

    it('marks a lesson complete only from Mark complete, and clears it', () => {
        const store = new Map();
        const cards = [1, 2, 3, 4, 5, 6].map((n) => {
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

        function fire(attr, value) {
            listeners.click({
                target: {
                    closest(selector) {
                        if (selector === '[data-learn-clear-all]') return attr === 'data-learn-clear-all' ? {} : null;
                        if (selector === '[data-learn-complete], [data-learn-clear]') {
                            if (attr === 'data-learn-clear-all') return null;
                            return {
                                getAttribute(name) { return name === attr ? value : null; },
                                hasAttribute(name) { return name === 'data-learn-complete' && attr === 'data-learn-complete'; },
                            };
                        }
                        return null;
                    },
                },
            });
        }
        fire('data-learn-complete', '1');
        fire('data-learn-complete', '2');
        expect(store.get('payePractice.learn.lesson1.done')).toBe('1');
        expect(store.get('payePractice.learn.lesson2.done')).toBe('1');
        expect(cards[0].className.has('is-completed')).toBe(true);
        expect(cards[1].className.has('is-completed')).toBe(true);
        fire('data-learn-clear', '1');
        expect(store.has('payePractice.learn.lesson1.done')).toBe(false);
        expect(store.get('payePractice.learn.lesson2.done')).toBe('1');
        expect(cards[0].className.has('is-completed')).toBe(false);
        expect(cards[1].className.has('is-completed')).toBe(true);
        store.set('payePractice.learn.lastLesson', '4');
        fire('data-learn-clear-all', '');
        expect(store.has('payePractice.learn.lesson1.done')).toBe(false);
        expect(store.has('payePractice.learn.lesson2.done')).toBe(false);
        expect(cards[1].className.has('is-completed')).toBe(false);
        expect(store.get('payePractice.learn.lastLesson')).toBe('4');
    });

    it('ignores a lesson number this pass does not have', () => {
        const lab = mountLab('?lesson=7');
        expect(lab.frame.getAttribute('src')).toBe('/payroll/');
        expect(lab.buttons[0].getAttribute('aria-current')).toBe('true');
        expect(lab.panels[0].getAttribute('hidden')).toBeNull();
        expect(lab.location.search).toBe('?lesson=1');
        expect(lab.historyLog.some((entry) => entry[0] === 'replace' && entry[1].endsWith('?lesson=1'))).toBe(true);
        expect(lab.memory.get('payePractice.learn.lastLesson')).toBe('1');
    });

    it('reopens the saved lesson, and a valid URL lesson wins', () => {
        const saved = mountLab('', new Map([['payePractice.learn.lastLesson', '4']]));
        expect(saved.location.search).toBe('?lesson=4');
        expect(saved.buttons[3].getAttribute('aria-current')).toBe('true');
        expect(saved.panels[3].getAttribute('hidden')).toBeNull();
        expect(saved.panels[0].getAttribute('hidden')).toBe('');
        expect(saved.frame.getAttribute('src')).toBe('/payroll/');
        expect(saved.memory.get('payePractice.learn.lastLesson')).toBe('4');

        const addressed = mountLab('?lesson=2', new Map([['payePractice.learn.lastLesson', '4']]));
        expect(addressed.location.search).toBe('?lesson=2');
        expect(addressed.buttons[1].getAttribute('aria-current')).toBe('true');
        expect(addressed.panels[1].getAttribute('hidden')).toBeNull();
        expect(addressed.memory.get('payePractice.learn.lastLesson')).toBe('2');

        const invalidUrl = mountLab('?lesson=9', new Map([['payePractice.learn.lastLesson', '4']]));
        expect(invalidUrl.location.search).toBe('?lesson=1');
        expect(invalidUrl.buttons[0].getAttribute('aria-current')).toBe('true');
        expect(invalidUrl.memory.get('payePractice.learn.lastLesson')).toBe('1');

        const invalidSaved = mountLab('', new Map([['payePractice.learn.lastLesson', 'nope']]));
        expect(invalidSaved.location.search).toBe('?lesson=1');
        expect(invalidSaved.buttons[0].getAttribute('aria-current')).toBe('true');
        expect(invalidSaved.memory.get('payePractice.learn.lastLesson')).toBe('1');
    });

    it('saves the lesson selected in the lab and sends /learn/ to that lesson', () => {
        const opened = mountLab('?lesson=1', new Map());
        opened.docListeners.click({
            target: {
                closest(selector) {
                    if (selector === '.lab-lessons button[data-lesson]') {
                        return { getAttribute(name) { return name === 'data-lesson' ? '6' : null; } };
                    }
                    return null;
                },
            },
        });
        expect(opened.memory.get('payePractice.learn.lastLesson')).toBe('6');

        function boot(path, search, memory) {
            const replaced = [];
            const location = {
                pathname: path,
                search,
                replace(url) { replaced.push(url); },
            };
            runInNewContext(read('learn/learn-progress.js'), {
                localStorage: {
                    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
                    setItem(key, value) { memory.set(key, String(value)); },
                    removeItem(key) { memory.delete(key); },
                },
                document: {
                    readyState: 'complete',
                    querySelectorAll() { return []; },
                    addEventListener() {},
                },
                window: {
                    location,
                    history: { replaceState() {} },
                    addEventListener() {},
                },
                URLSearchParams,
            });
            return replaced;
        }

        expect(boot('/learn/', '', new Map([['payePractice.learn.lastLesson', '5']]))).toEqual(['/learn/lab/?lesson=5']);
        expect(boot('/learn/index.html', '', new Map())).toEqual(['/learn/lab/?lesson=1']);
        expect(boot('/learn/', '', new Map([['payePractice.learn.lastLesson', '7']]))).toEqual(['/learn/lab/?lesson=1']);
    });
});
