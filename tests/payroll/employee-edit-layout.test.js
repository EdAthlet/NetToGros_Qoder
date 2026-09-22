import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { loadPayrollScripts, validEmployee } from './test-helpers.js';

function loadEmployees() {
    const context = loadPayrollScripts(['utils.js', 'payroll-context.js', 'payroll-mode.js']);
    const source = readFileSync(resolve('payroll/employees.js'), 'utf8');
    vm.runInContext(source + '\nglobalThis.PayrollEmployees = PayrollEmployees;', context);
    return context;
}

function stubContainer() {
    return {
        innerHTML: '',
        querySelector(sel) {
            if (sel === '#employee-form' || sel === '#btn-cancel') {
                return { addEventListener() {} };
            }
            return null;
        },
        querySelectorAll() {
            return [];
        }
    };
}

function fieldIds(html) {
    return [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
}

function renderEditForm(ctx, companyId, employee) {
    const container = stubContainer();
    ctx.document.getElementById = (id) => (id === 'employees-content' ? container : null);
    ctx.PayrollStorage.saveEmployees(companyId, [employee]);
    ctx.PayrollEmployees.init(companyId);
    ctx.PayrollEmployees.showEmployeeForm(employee.id);
    return container.innerHTML;
}

describe('Edit Employee form columns', () => {
    let ctx;

    beforeEach(() => {
        ctx = loadEmployees();
    });

    it('puts identity fields in column 1 and pay fields in column 2', () => {
        const companies = ctx.PayrollStorage.loadCompanies();
        const cloudId = companies[1].id;
        const html = renderEditForm(ctx, cloudId, validEmployee({
            id: 'emp-salaried',
            payType: 'salaried',
            annualGross: 42000,
            iban: 'IE29AIBK93115212345678',
            payFrequency: 'monthly'
        }));

        const identity = html.slice(
            html.indexOf('employee-form-col--identity'),
            html.indexOf('employee-form-col--pay')
        );
        const pay = html.slice(
            html.indexOf('employee-form-col--pay'),
            html.indexOf('form-actions')
        );

        expect(fieldIds(identity)).toEqual([
            'emp-first-name',
            'emp-last-name',
            'emp-pps',
            'emp-start-date',
            'emp-prsi-class'
        ]);
        expect(identity).toContain('name="payType"');
        expect(fieldIds(pay)).toEqual([
            'emp-iban',
            'emp-pay-frequency',
            'emp-annual-gross',
            'emp-hourly-rate',
            'emp-standard-hours',
            'emp-overtime-multiplier',
            'emp-active'
        ]);
        expect(pay).toContain('Annual Gross Salary');
        expect(pay).toContain('standard-hours-field" style="display:none"');

        const sidebarAt = html.indexOf('employee-edit-sidebar');
        expect(sidebarAt).toBeGreaterThan(html.indexOf('employee-form-columns'));
        expect(html.slice(sidebarAt, html.indexOf('employee-lower-row'))).toContain('Tax Credits');
        expect(html).toContain('id="rpn-number"');
        expect(html).toContain('read-only here');
        expect(identity).not.toContain('emp-family-status');
        expect(pay).not.toContain('emp-family-status');
    });

    it('shows hourly rate then hours for an hourly employee', () => {
        const companies = ctx.PayrollStorage.loadCompanies();
        const cloudId = companies[1].id;
        const html = renderEditForm(ctx, cloudId, validEmployee({
            id: 'emp-hourly',
            payType: 'hourly',
            hourlyRate: 18,
            standardHoursPerWeek: 39,
            annualGross: 0
        }));
        const pay = html.slice(
            html.indexOf('employee-form-col--pay'),
            html.indexOf('form-actions')
        );
        expect(fieldIds(pay)).toEqual([
            'emp-iban',
            'emp-pay-frequency',
            'emp-hourly-rate',
            'emp-standard-hours',
            'emp-annual-gross',
            'emp-overtime-multiplier',
            'emp-active'
        ]);
        expect(pay).toContain('Hourly Rate');
        expect(pay).toContain('gross-field" style="display:none"');
        expect(pay).not.toContain('standard-hours-field" style="display:none"');
    });

    it('keeps manual tax fields on the local form outside the two columns', () => {
        const companies = ctx.PayrollStorage.loadCompanies();
        const localId = companies[0].id;
        const html = renderEditForm(ctx, localId, validEmployee({ id: 'emp-local' }));
        const columns = html.slice(
            html.indexOf('employee-form-columns'),
            html.indexOf('employee-form-row--tax')
        );
        expect(columns).not.toContain('emp-family-status');
        expect(html).toContain('id="emp-family-status"');
        expect(html).toContain('id="emp-manual-tax-credits"');
        expect(html).toContain('id="emp-manual-cutoff"');
        expect(html).not.toContain('employee-edit-sidebar');
    });

    it('uses two form columns from 900px and one column below that', () => {
        const css = readFileSync(resolve('payroll/payroll-employees.css'), 'utf8');
        const desktopStart = css.indexOf('@media (min-width: 900px)');
        const mobileStart = css.indexOf('@media (max-width: 899px)');
        const desktop = css.slice(desktopStart, mobileStart);
        const mobile = css.slice(mobileStart);
        expect(desktop).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);');
        expect(desktop).toContain('grid-template-columns: minmax(0, 1fr) 260px;');
        expect(mobile).toContain('.employee-form-columns');
        expect(mobile).toContain('grid-template-columns: minmax(0, 1fr);');
        expect(css.slice(0, desktopStart)).toContain('grid-template-columns: minmax(0, 1fr);');
    });
});
