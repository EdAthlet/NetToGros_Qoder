import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { loadPayrollScripts, validEmployee } from './test-helpers.js';

function loadFirstRun() {
    const context = loadPayrollScripts(['payroll-context.js', 'payroll-mode.js']);
    const source = readFileSync(resolve('payroll/payroll-first-run.js'), 'utf8');
    vm.runInContext(source + '\nglobalThis.PayrollFirstRun = PayrollFirstRun;', context);
    context.PayrollFirstRun.resetSessionState();
    try {
        context.localStorage.removeItem(context.PayrollFirstRun.HIDE_KEY);
        context.localStorage.removeItem(context.PayrollFirstRun.LEGACY_HIDE_KEY);
        context.localStorage.removeItem(context.PayrollFirstRun.COLLAPSED_KEY);
    } catch (e) {}
    return context;
}

function mountCoach(ctx) {
    const classes = new Set(['first-run-coach', 'hidden']);
    const listeners = {};
    const el = {
        dataset: {},
        hidden: true,
        innerHTML: '',
        classList: {
            add(name) { classes.add(name); },
            remove(name) { classes.delete(name); },
            contains(name) { return classes.has(name); }
        },
        setAttribute(name) {
            if (name === 'hidden') el.hidden = true;
        },
        removeAttribute(name) {
            if (name === 'hidden') el.hidden = false;
        },
        addEventListener(type, fn) {
            listeners[type] = fn;
        },
        listeners,
        click(action) {
            listeners.click({
                preventDefault() {},
                target: {
                    closest(sel) {
                        if (sel === '[data-first-run]') {
                            return {
                                getAttribute(attr) {
                                    return attr === 'data-first-run' ? action : null;
                                }
                            };
                        }
                        return null;
                    }
                }
            });
        }
    };
    ctx.document.getElementById = (id) => (id === 'first-run-coach' ? el : null);
    return el;
}

function useRpnSandbox(ctx) {
    const companies = ctx.PayrollStorage.loadCompanies();
    const company = ctx.PayrollStorage.getCompany(companies[1].id);
    ctx.PayrollContext.currentCompanyId = company.id;
    return company;
}

function sandboxCompany(overrides = {}) {
    return {
        id: 'co-cloud',
        name: 'Cloud Sandbox Ltd',
        payrollMode: 'cloud',
        practicePreset: 'sandbox-cloud',
        ...overrides
    };
}

describe('The Coach (RPN practice)', () => {
    let ctx;

    beforeEach(() => {
        ctx = loadFirstRun();
        ctx.document.getElementById = () => null;
    });

    it('recognises only the RPN practice sandbox company', () => {
        const firstRun = ctx.PayrollFirstRun;
        expect(firstRun.isRpnSandboxCompany(sandboxCompany())).toBe(true);
        expect(firstRun.isRpnSandboxCompany({
            id: 'co-local',
            payrollMode: 'local',
            practicePreset: 'sandbox-local'
        })).toBe(false);
        expect(firstRun.isRpnSandboxCompany({
            id: 'co-own',
            payrollMode: 'cloud',
            practicePreset: null
        })).toBe(false);
    });

    it('marks steps from sandbox employees, rpnNumber, and saved runs', () => {
        const storage = ctx.PayrollStorage;
        const companies = storage.loadCompanies();
        const cloudId = companies[1].id;
        storage.saveEmployees(cloudId, [
            validEmployee({ id: 'sandbox_emp_001', firstName: 'Noah', lastName: 'Walsh', rpn: {} }),
            validEmployee({ id: 'sandbox_emp_004', firstName: 'Sofia', lastName: 'OBrien', rpn: { rpnNumber: 'RPN-1' } })
        ]);

        let progress = ctx.PayrollFirstRun.getProgress(cloudId);
        expect(progress.sandboxLoaded).toBe(true);
        expect(progress.rpnRetrieved).toBe(true);
        expect(progress.hasPreview).toBe(false);

        storage.savePayrollRun(cloudId, { id: 'run-1', status: 'committed', entries: [{ employeeId: 'sandbox_emp_001' }] });
        progress = ctx.PayrollFirstRun.getProgress(cloudId);
        expect(progress.hasPreview).toBe(true);
        expect(progress.hasSavedRun).toBe(true);
    });

    it('stays visible after preview and payslip; hidden only after dismiss or HIDE_KEY', () => {
        const storage = ctx.PayrollStorage;
        const firstRun = ctx.PayrollFirstRun;
        const companies = storage.loadCompanies();
        const cloudId = companies[1].id;
        const company = sandboxCompany({ id: cloudId });

        storage.saveEmployees(cloudId, [validEmployee({ id: 'e1', rpn: { rpnNumber: 'RPN-1' } })]);
        expect(firstRun.shouldShow(company)).toBe(true);

        storage.savePayrollRun(cloudId, { id: 'run-1', status: 'committed', entries: [] });
        expect(firstRun.shouldShow(company)).toBe(true);

        firstRun.markPreviewDone();
        expect(firstRun.shouldShow(company)).toBe(true);
        expect(firstRun.getProgress(cloudId).hasPreview).toBe(true);
        expect(firstRun.getProgress(cloudId).payslipOpened).toBe(false);

        firstRun.markPayslipOpened();
        expect(firstRun.shouldShow(company)).toBe(true);
        expect(firstRun.getProgress(cloudId).payslipOpened).toBe(true);

        firstRun.dismiss();
        expect(firstRun.shouldShow(company)).toBe(false);
    });

    it('honours dismiss and don\'t show again in localStorage', () => {
        const firstRun = ctx.PayrollFirstRun;
        const company = sandboxCompany();
        ctx.PayrollContext.currentCompanyId = company.id;

        expect(firstRun.shouldShow(company)).toBe(true);

        firstRun.dismiss();
        expect(firstRun.shouldShow(company)).toBe(false);

        firstRun.resetSessionState();
        expect(firstRun.shouldShow(company)).toBe(true);

        ctx.localStorage.setItem(firstRun.HIDE_KEY, '1');
        expect(firstRun.shouldShow(company)).toBe(false);
    });

    it('migrates the legacy hide key to The Coach key', () => {
        const firstRun = ctx.PayrollFirstRun;
        const company = sandboxCompany();
        ctx.localStorage.setItem(firstRun.LEGACY_HIDE_KEY, '1');
        expect(firstRun.shouldShow(company)).toBe(false);
        expect(ctx.localStorage.getItem(firstRun.HIDE_KEY)).toBe('1');
        expect(ctx.localStorage.getItem(firstRun.LEGACY_HIDE_KEY)).toBe(null);
    });

    it('does not treat Manual credits sandbox as the first-run company', () => {
        const companies = ctx.PayrollStorage.loadCompanies();
        const localCompany = ctx.PayrollStorage.getCompany(companies[0].id);
        expect(ctx.PayrollFirstRun.shouldShow(localCompany)).toBe(false);
    });

    it('labels step 4 with the preview-table payslip instruction and starts expanded', () => {
        const el = mountCoach(ctx);
        useRpnSandbox(ctx);
        ctx.PayrollFirstRun.refresh();
        expect(el.innerHTML).toContain('Open the payslip / breakdown (click on the Employee\'s line in the calculated Preview table)');
        expect(el.innerHTML).toContain('>Collapse<');
        expect(el.innerHTML).toContain('first-run-coach-steps');
        expect(el.classList.contains('is-collapsed')).toBe(false);
        expect(el.classList.contains('hidden')).toBe(false);
    });

    it('collapses to a short bar and remembers that without the hide key', () => {
        const el = mountCoach(ctx);
        const company = useRpnSandbox(ctx);
        const firstRun = ctx.PayrollFirstRun;
        el.style = {};
        ctx.localStorage.setItem(firstRun.POS_H_KEY, '420');
        firstRun.refresh();
        expect(el.style.height).toBe('420px');

        el.click('toggle');

        expect(ctx.localStorage.getItem(firstRun.COLLAPSED_KEY)).toBe('1');
        expect(el.style.height).toBe('auto');
        expect(el.innerHTML).not.toContain('first-run-coach-body');
        expect(ctx.localStorage.getItem(firstRun.HIDE_KEY)).toBe(null);
        expect(firstRun.shouldShow(company)).toBe(true);
        expect(el.classList.contains('hidden')).toBe(false);
        expect(el.hidden).toBe(false);
        expect(el.classList.contains('is-collapsed')).toBe(true);
        expect(el.innerHTML).toContain('Show The Coach');
        expect(el.innerHTML).toContain('The Coach');
        expect(el.innerHTML).not.toContain('first-run-coach-steps');
        expect(el.innerHTML).not.toContain('data-first-run="dismiss"');
        expect(el.innerHTML).not.toContain('Don\'t show again');

        el.click('toggle');

        expect(ctx.localStorage.getItem(firstRun.COLLAPSED_KEY)).toBe(null);
        expect(el.classList.contains('is-collapsed')).toBe(false);
        expect(el.style.height).toBe('420px');
        expect(el.innerHTML).toContain('>Collapse<');
        expect(el.innerHTML).toContain('first-run-coach-steps');
    });

    it('keeps collapse separate from dismiss and don\'t show again', () => {
        const el = mountCoach(ctx);
        const company = useRpnSandbox(ctx);
        const firstRun = ctx.PayrollFirstRun;
        ctx.localStorage.setItem(firstRun.COLLAPSED_KEY, '1');
        firstRun.refresh();
        expect(el.classList.contains('is-collapsed')).toBe(true);
        expect(firstRun.shouldShow(company)).toBe(true);

        el.click('dismiss');
        expect(firstRun.shouldShow(company)).toBe(false);
        expect(el.classList.contains('hidden')).toBe(true);
        expect(el.innerHTML).toBe('');
        expect(ctx.localStorage.getItem(firstRun.COLLAPSED_KEY)).toBe('1');
        expect(ctx.localStorage.getItem(firstRun.HIDE_KEY)).toBe(null);

        firstRun.resetSessionState();
        firstRun.refresh();
        expect(firstRun.shouldShow(company)).toBe(true);
        expect(el.classList.contains('is-collapsed')).toBe(true);
        expect(el.innerHTML).toContain('Show The Coach');

        el.click('never');
        expect(ctx.localStorage.getItem(firstRun.HIDE_KEY)).toBe('1');
        expect(ctx.localStorage.getItem(firstRun.COLLAPSED_KEY)).toBe('1');
        expect(firstRun.shouldShow(company)).toBe(false);
        expect(el.classList.contains('hidden')).toBe(true);
        expect(el.innerHTML).toBe('');
    });

    it('restarts the first run without the hide key, and reloads the sandbox to clear step 1', () => {
        const el = mountCoach(ctx);
        const storage = ctx.PayrollStorage;
        const company = useRpnSandbox(ctx);
        storage.saveEmployees(company.id, [
            validEmployee({ id: 'sandbox_emp_001', firstName: 'Noah', lastName: 'Walsh', rpn: { rpnNumber: 'RPN-1' } })
        ]);
        storage.savePayrollRun(company.id, { id: 'run-1', status: 'committed', entries: [{ employeeId: 'sandbox_emp_001' }] });
        ctx.PayrollContext.currentRunData = { entries: [{ employeeId: 'sandbox_emp_001' }] };
        ctx.PayrollFirstRun.markPreviewDone();
        ctx.PayrollFirstRun.markPayslipOpened();
        ctx.localStorage.setItem(ctx.PayrollFirstRun.COLLAPSED_KEY, '1');

        let reloaded = false;
        ctx.PayrollCompanies = {
            reloadRpnPracticeSandbox(companyId) {
                reloaded = true;
                storage.loadPayrollRuns(companyId).forEach((run) => storage.deletePayrollRun(companyId, run.id));
                storage.updateCompany(companyId, {
                    name: 'Cloud Sandbox Ltd',
                    payrollMode: 'cloud',
                    practicePreset: 'sandbox-cloud'
                });
                storage.saveEmployees(companyId, [
                    validEmployee({
                        id: 'sandbox_emp_007',
                        firstName: 'Daniel',
                        lastName: 'McCarthy',
                        ppsNumber: '7567890IJ',
                        rpn: {}
                    })
                ]);
                return true;
            }
        };

        ctx.PayrollFirstRun.refresh();
        el.click('restart');

        const progress = ctx.PayrollFirstRun.getProgress(company.id);
        expect(reloaded).toBe(true);
        expect(progress.sandboxLoaded).toBe(false);
        expect(progress.rpnRetrieved).toBe(false);
        expect(progress.hasPreview).toBe(false);
        expect(progress.hasSavedRun).toBe(false);
        expect(progress.payslipOpened).toBe(false);
        expect(storage.loadEmployees(company.id)).toHaveLength(1);
        expect(storage.getCompany(company.id).id).toBe(company.id);
        expect(ctx.localStorage.getItem(ctx.PayrollFirstRun.HIDE_KEY)).toBe(null);
        expect(ctx.localStorage.getItem(ctx.PayrollFirstRun.COLLAPSED_KEY)).toBe(null);
        expect(ctx.PayrollFirstRun.shouldShow(storage.getCompany(company.id))).toBe(true);
        expect(el.classList.contains('is-collapsed')).toBe(false);
        expect(el.hidden).toBe(false);
        expect(el.innerHTML).toContain('Restart first run');
        expect(el.innerHTML).toContain('This loads the sandbox again.');
        expect(el.innerHTML).not.toContain('is-done');

        ctx.PayrollFirstRun.noteSandboxLoaded();
        expect(ctx.PayrollFirstRun.getProgress(company.id).sandboxLoaded).toBe(true);
        expect(el.innerHTML).not.toContain('This loads the sandbox again.');
    });

    it('does not reload or set the hide key when the sandbox steps are already clear', () => {
        const el = mountCoach(ctx);
        const company = useRpnSandbox(ctx);
        let reloaded = false;
        ctx.PayrollCompanies = {
            reloadRpnPracticeSandbox() {
                reloaded = true;
                return true;
            }
        };
        ctx.PayrollFirstRun.refresh();
        el.click('restart');
        expect(reloaded).toBe(false);
        expect(ctx.localStorage.getItem(ctx.PayrollFirstRun.HIDE_KEY)).toBe(null);
        expect(el.innerHTML).toContain('data-first-run="restart">Restart first run</button>');
        expect(el.innerHTML).not.toContain('This loads the sandbox again.');
        expect(ctx.PayrollFirstRun.shouldShow(company)).toBe(true);
    });

    it('does not clear Don\'t show again when restart runs', () => {
        const company = useRpnSandbox(ctx);
        ctx.localStorage.setItem(ctx.PayrollFirstRun.HIDE_KEY, '1');
        ctx.PayrollFirstRun.restartFirstRun();
        expect(ctx.localStorage.getItem(ctx.PayrollFirstRun.HIDE_KEY)).toBe('1');
        expect(ctx.PayrollFirstRun.shouldShow(company)).toBe(false);
    });

    it('floats as a 320px card and drags only from the header', () => {
        const css = readFileSync(resolve('payroll/payroll-base.css'), 'utf8');
        expect(css).toMatch(/\.first-run-coach\s*\{[^}]*position:\s*fixed/);
        expect(css).toMatch(/\.first-run-coach\s*\{[^}]*width:\s*320px/);
        expect(css).toMatch(/\.first-run-coach\s*\{[^}]*z-index:\s*80/);
        expect(css).toMatch(/\.first-run-coach-header\s*\{[^}]*cursor:\s*grab/);

        const el = mountCoach(ctx);
        el.style = {};
        el.getBoundingClientRect = () => ({ left: 16, top: 16, width: 320, height: 180 });
        ctx.window = {
            top: {},
            parent: { location: { pathname: '/learn/lab/' } },
            location: { origin: 'http://127.0.0.1' },
            innerWidth: 1000,
            innerHeight: 800,
            addEventListener() {}
        };
        ctx.localStorage.setItem(ctx.PayrollFirstRun.HIDE_KEY, '1');
        ctx.PayrollFirstRun.showLabLesson('2');
        expect(ctx.PayrollFirstRun.shouldShow(sandboxCompany())).toBe(true);
        expect(el.innerHTML).toContain('Lesson 2 — Retrieve an RPN and run a preview');
        expect(el.innerHTML).toContain('Click Retrieve RPN.');
        expect(el.hidden).toBe(false);

        el.listeners.pointerdown({
            clientX: 40,
            clientY: 30,
            pointerId: 1,
            target: {
                closest(sel) {
                    if (sel === 'button') return null;
                    if (sel === '.first-run-coach-header') return {};
                    return null;
                }
            }
        });
        el.listeners.pointermove({ clientX: 140, clientY: 90 });
        el.listeners.pointerup({});
        expect(ctx.localStorage.getItem(ctx.PayrollFirstRun.POS_X_KEY)).toBe('116');
        expect(ctx.localStorage.getItem(ctx.PayrollFirstRun.POS_Y_KEY)).toBe('76');
        expect(ctx.localStorage.getItem(ctx.PayrollFirstRun.POS_W_KEY)).toBe(null);
        expect(ctx.localStorage.getItem(ctx.PayrollFirstRun.POS_H_KEY)).toBe(null);
    });

    it('uses a 30% transparent background and resizes from sides and corners', () => {
        const css = readFileSync(resolve('payroll/payroll-base.css'), 'utf8');
        expect(css).toMatch(/\.first-run-coach\s*\{[^}]*background:\s*rgba\(238,\s*245,\s*251,\s*0\.7\)/);
        expect(css).toMatch(/\.first-run-coach-header\s*\{[^}]*background:\s*#d9e8f5/);
        expect(css).toMatch(/\.first-run-coach\.is-collapsed\s*\{[^}]*height:\s*auto\s*!important/);
        expect(css).toMatch(/\[data-edge="e"\][^{]*\{[^}]*cursor:\s*ew-resize/);
        expect(css).toMatch(/\[data-edge="n"\][^{]*\{[^}]*cursor:\s*ns-resize/);
        expect(css).toMatch(/\[data-edge="se"\][^{]*\{[^}]*cursor:\s*nwse-resize/);
        expect(css).toMatch(/\[data-edge="nw"\][^{]*\{[^}]*cursor:\s*nwse-resize/);
        expect(css).toMatch(/\[data-edge="ne"\][^{]*\{[^}]*cursor:\s*nesw-resize/);

        const el = mountCoach(ctx);
        el.style = {};
        el.getBoundingClientRect = () => ({
            left: Number.isFinite(parseFloat(el.style.left)) ? parseFloat(el.style.left) : 16,
            top: Number.isFinite(parseFloat(el.style.top)) ? parseFloat(el.style.top) : 16,
            width: Number.isFinite(parseFloat(el.style.width)) ? parseFloat(el.style.width) : 320,
            height: Number.isFinite(parseFloat(el.style.height)) ? parseFloat(el.style.height) : 180
        });
        ctx.window = {
            top: {},
            parent: { location: { pathname: '/learn/lab/' } },
            location: { origin: 'http://127.0.0.1' },
            innerWidth: 1000,
            innerHeight: 800,
            addEventListener() {}
        };
        ctx.PayrollFirstRun.showLabLesson('1');
        ['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw'].forEach((edge) => {
            expect(el.innerHTML).toContain('data-edge="' + edge + '"');
        });

        function gesture(edge, from, to) {
            el.listeners.pointerdown({
                clientX: from.x,
                clientY: from.y,
                pointerId: 1,
                target: {
                    closest(sel) {
                        if (sel === 'button') return null;
                        if (sel === '[data-edge]') return { getAttribute: () => edge };
                        return null;
                    }
                }
            });
            el.listeners.pointermove({ clientX: to.x, clientY: to.y });
            el.listeners.pointerup({});
        }

        gesture('e', { x: 336, y: 80 }, { x: 400, y: 80 });
        expect(el.style.width).toBe('384px');
        expect(el.style.height).toBe('180px');
        expect(el.style.left).toBe('16px');
        expect(el.style.top).toBe('16px');

        gesture('se', { x: 400, y: 196 }, { x: 450, y: 236 });
        expect(el.style.width).toBe('434px');
        expect(el.style.height).toBe('220px');

        gesture('w', { x: 16, y: 80 }, { x: 316, y: 80 });
        expect(el.style.width).toBe('220px');
        expect(el.style.left).toBe('230px');

        gesture('n', { x: 100, y: 16 }, { x: 100, y: -200 });
        expect(el.style.top).toBe('0px');
        expect(el.style.height).toBe('236px');

        el.listeners.pointerdown({
            clientX: 300,
            clientY: 40,
            pointerId: 2,
            target: { closest() { return null; } }
        });
        el.listeners.pointermove({ clientX: 10, clientY: 10 });
        el.listeners.pointerup({});
        expect(el.style.left).toBe('230px');
        expect(el.style.top).toBe('0px');

        ctx.PayrollFirstRun.refresh();
        expect(el.style.width).toBe(ctx.localStorage.getItem(ctx.PayrollFirstRun.POS_W_KEY) + 'px');
        expect(el.style.height).toBe(ctx.localStorage.getItem(ctx.PayrollFirstRun.POS_H_KEY) + 'px');
        expect(el.style.left).toBe('230px');
        expect(el.style.top).toBe('0px');
    });

    it('keeps the header above the scrolling steps and stays on a smaller screen', () => {
        const css = readFileSync(resolve('payroll/payroll-base.css'), 'utf8');
        expect(css).toMatch(/\.first-run-coach-header\s*\{[^}]*flex:\s*0\s*0\s*auto/);
        expect(css).toMatch(/\.first-run-coach-body\s*\{[^}]*overflow:\s*auto/);
        expect(css).not.toMatch(/\.first-run-coach-inner/);

        const el = mountCoach(ctx);
        el.style = {};
        el.getBoundingClientRect = () => ({
            left: Number.isFinite(parseFloat(el.style.left)) ? parseFloat(el.style.left) : 16,
            top: Number.isFinite(parseFloat(el.style.top)) ? parseFloat(el.style.top) : 16,
            width: Number.isFinite(parseFloat(el.style.width)) ? parseFloat(el.style.width) : 320,
            height: Number.isFinite(parseFloat(el.style.height)) ? parseFloat(el.style.height) : 400
        });
        const viewListeners = {};
        ctx.window = {
            top: {},
            parent: { location: { pathname: '/learn/lab/' } },
            location: { origin: 'http://127.0.0.1' },
            innerWidth: 1400,
            innerHeight: 900,
            addEventListener(type, fn) { viewListeners[type] = fn; }
        };
        ctx.localStorage.setItem(ctx.PayrollFirstRun.POS_X_KEY, '1100');
        ctx.localStorage.setItem(ctx.PayrollFirstRun.POS_Y_KEY, '700');
        ctx.localStorage.setItem(ctx.PayrollFirstRun.POS_W_KEY, '320');
        ctx.localStorage.setItem(ctx.PayrollFirstRun.POS_H_KEY, '420');
        ctx.PayrollFirstRun.showLabLesson('6');

        const headerAt = el.innerHTML.indexOf('first-run-coach-header');
        const bodyAt = el.innerHTML.indexOf('first-run-coach-body');
        expect(headerAt).toBeGreaterThan(-1);
        expect(bodyAt).toBeGreaterThan(headerAt);
        expect(el.innerHTML.indexOf('first-run-coach-header', bodyAt)).toBe(-1);
        expect(el.innerHTML).toContain('Lesson 6 — Confirm and save the payroll run');
        expect(el.innerHTML).toContain('Click Commit to Payroll.');
        expect(el.innerHTML).not.toContain('Confirm &amp; Save');
        expect(el.style.left).toBe('1080px');
        expect(el.style.top).toBe('480px');
        expect(el.style.width).toBe('320px');
        expect(el.style.height).toBe('420px');

        ctx.window.innerWidth = 300;
        ctx.window.innerHeight = 200;
        viewListeners.resize();
        const left = parseFloat(el.style.left);
        const top = parseFloat(el.style.top);
        const width = parseFloat(el.style.width);
        const height = parseFloat(el.style.height);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(top).toBeGreaterThanOrEqual(0);
        expect(left + width).toBeLessThanOrEqual(300);
        expect(top + height).toBeLessThanOrEqual(200);
        expect(ctx.localStorage.getItem(ctx.PayrollFirstRun.POS_X_KEY)).toBe('1100');
        expect(ctx.localStorage.getItem(ctx.PayrollFirstRun.POS_W_KEY)).toBe('320');
        expect(ctx.localStorage.getItem(ctx.PayrollFirstRun.POS_H_KEY)).toBe('420');

        ctx.window.innerWidth = 1400;
        ctx.window.innerHeight = 900;
        viewListeners.resize();
        expect(el.style.left).toBe('1080px');
        expect(el.style.top).toBe('480px');
        expect(el.style.width).toBe('320px');
        expect(el.style.height).toBe('420px');
    });

    it('opens on a lab lesson even after dismiss, and strikes steps from the existing hooks', () => {
        const el = mountCoach(ctx);
        const company = useRpnSandbox(ctx);
        ctx.window = {
            top: {},
            parent: { location: { pathname: '/learn/lab/' } },
            location: { origin: 'http://127.0.0.1' },
            innerWidth: 1000,
            innerHeight: 800,
            addEventListener() {}
        };
        ctx.localStorage.setItem(ctx.PayrollFirstRun.HIDE_KEY, '1');
        ctx.PayrollFirstRun.showLabLesson('1');
        expect(el.innerHTML).toContain('Load RPN practice sandbox (Recommended first).');
        expect(el.innerHTML).toContain('data-first-run="dismiss"');

        ctx.PayrollFirstRun.dismiss();
        expect(ctx.PayrollFirstRun.shouldShow(company)).toBe(false);

        ctx.PayrollStorage.saveEmployees(company.id, [
            validEmployee({ id: 'sandbox_emp_001', firstName: 'Noah', lastName: 'Walsh', rpn: { rpnNumber: 'RPN-1' } })
        ]);
        ctx.PayrollStorage.savePayrollRun(company.id, { id: 'run-1', status: 'committed', entries: [{ employeeId: 'sandbox_emp_001' }] });
        ctx.PayrollContext.currentRunData = { entries: [{ employeeId: 'sandbox_emp_001' }] };
        ctx.PayrollFirstRun.showLabLesson('6');
        ctx.PayrollFirstRun.markPreviewDone();
        ctx.PayrollFirstRun.noteTab('history');
        expect(el.innerHTML).toContain('Lesson 6 — Confirm and save the payroll run');
        expect(el.innerHTML).toContain('<li class="is-done"><span class="first-run-step-btn">Click Commit to Payroll.</span></li>');
        expect(el.innerHTML).toContain('<li class="is-done"><span class="first-run-step-btn">Click the History tab.</span></li>');
        expect(el.innerHTML).toContain('<li class="is-done"><span class="first-run-step-btn">Click Calculate Preview.</span></li>');

        ctx.PayrollFirstRun.showLabLesson('3');
        expect(el.hidden).toBe(true);
        expect(el.innerHTML).toBe('');
        expect(ctx.PayrollFirstRun.shouldShow(company)).toBe(false);
    });
});
