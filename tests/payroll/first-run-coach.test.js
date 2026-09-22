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
        firstRun.refresh();

        el.click('toggle');

        expect(ctx.localStorage.getItem(firstRun.COLLAPSED_KEY)).toBe('1');
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
});
