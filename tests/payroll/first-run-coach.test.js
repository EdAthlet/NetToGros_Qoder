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
    } catch (e) {}
    return context;
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
});
