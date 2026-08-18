import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadModule(file, context) {
    vm.runInContext(readFileSync(resolve('payroll', file), 'utf8'), context);
}

function createContext() {
    const context = {
        console,
        PayrollStorage: {
            generateId() { return 'id-1'; },
            loadAdjustments() { return []; },
            saveAdjustments() { return true; },
            loadPayrollRuns() { return []; },
            loadGlPostings() { return []; },
            saveGlPostings() { return true; }
        },
        PayrollUtils: {
            escapeHtml(text) { return String(text || ''); },
            safeFormatCurrency(n) { return String(n); }
        }
    };
    vm.createContext(context);
    loadModule('payroll-pay-codes.js', context);
    loadModule('payroll-gl.js', context);
    loadModule('payroll-adjustments.js', context);
    return context;
}

describe('pay codes and GL', () => {
    it('builds coded pay lines from an entry', () => {
        const ctx = createContext();
        const lines = ctx.PayrollPayCodes.buildPayLines({
            regularGross: 1000,
            overtimeGross: 50,
            paye: 80,
            usc: 20,
            prsi: 40,
            employerPrsi: 110,
            lpt: 45,
            adjustments: [{ id: 'a1', delta: { paye: 10, grossPay: 30 } }]
        });
        const codes = lines.map((line) => line.code);
        expect(codes).toContain('BASIC');
        expect(codes).toContain('LPT');
        expect(codes).toContain('ADJ_GROSS');
        expect(codes).toContain('ADJ_PAYE');
    });

    it('builds a balanced GL batch including employer PRSI', () => {
        const ctx = createContext();
        const entry = {
            employeeName: 'Ada',
            grossPay: 1000,
            paye: 100,
            usc: 20,
            prsi: 40,
            pensionDeduction: 50,
            lpt: 45,
            netPay: 745,
            employerPrsi: 110
        };
        const batch = ctx.PayrollGL.buildBatch({ id: 'run-1', entries: [entry], payDate: '2026-08-14', taxYear: '2026' }, 'co-1');
        expect(batch.balanced).toBe(true);
        expect(ctx.PayrollGL.isBalanced(batch.lines)).toBe(true);
    });
});

describe('prior-period adjustments', () => {
    it('lists an employee adjustment register newest first', () => {
        const ctx = createContext();
        ctx.PayrollStorage.loadAdjustments = function () {
            return [
                { id: 'old', targetEmployeeId: 'emp-1', status: 'applied', createdAt: '2026-01-01T00:00:00.000Z' },
                { id: 'new', targetEmployeeId: 'emp-1', status: 'pending', createdAt: '2026-07-01T00:00:00.000Z' },
                { id: 'other', targetEmployeeId: 'emp-2', status: 'pending', createdAt: '2026-08-01T00:00:00.000Z' }
            ];
        };
        const rows = ctx.PayrollAdjustments.listForEmployee('co-1', 'emp-1');
        expect(rows).toHaveLength(2);
        expect(rows[0].id).toBe('new');
        expect(rows[1].id).toBe('old');
    });

    it('refuses adjustments on runs that are not submitted', () => {
        const ctx = createContext();
        const run = { id: 'run-1', status: 'committed', taxYear: '2026' };
        const entry = { employeeId: 'emp-1', employeeName: 'Ada', payFrequency: 'weekly', payType: 'hourly', regularHours: 35, overtimeHours: 0, hourlyRate: 20, grossPay: 700 };
        const result = ctx.PayrollAdjustments.createFromHistory('co-1', run, entry, { regularHours: 40 }, 'HOURS', '');
        expect(result.error).toMatch(/submitted/i);
    });

    it('increases salaried gross when regular hours change', () => {
        const ctx = createContext();
        const original = {
            grossPay: 800,
            regularGross: 800,
            regularHours: 0,
            overtimeHours: 0,
            hourlyRate: 20,
            payType: 'salaried',
            payFrequency: 'weekly',
            paye: 50,
            usc: 10,
            prsi: 20,
            employerPrsi: 80,
            lpt: 0,
            pensionDeduction: 0,
            taxCreditsUsed: 40,
            netPay: 720,
            totalDeductions: 80
        };
        const corrected = ctx.PayrollAdjustments.recalculateCorrected(original, { regularHours: 40 });
        expect(corrected.grossPay).toBeCloseTo(800, 1);
        const fromZero = ctx.PayrollAdjustments.recalculateCorrected(
            Object.assign({}, original, { regularHours: 35, regularGross: 700, grossPay: 700 }),
            { regularHours: 40 }
        );
        expect(fromZero.grossPay).toBeGreaterThan(700);
    });

    it('creates a positive gross delta when hours increase', () => {
        const ctx = createContext();
        const original = {
            grossPay: 655.2,
            regularHours: 35,
            overtimeHours: 0,
            hourlyRate: 18.72,
            payType: 'hourly',
            payFrequency: 'weekly',
            paye: 54.12,
            usc: 10.93,
            prsi: 27.52,
            employerPrsi: 217.2,
            lpt: 0,
            pensionDeduction: 0,
            taxCreditsUsed: 76.92,
            netPay: 562.63,
            totalDeductions: 92.57
        };
        const corrected = ctx.PayrollAdjustments.recalculateCorrected(original, { regularHours: 40 });
        expect(corrected.grossPay).toBeCloseTo(748.8, 1);
        expect(corrected.grossPay).toBeGreaterThan(original.grossPay);
    });

    it('applies pending deltas onto the current entry', () => {
        const ctx = createContext();
        ctx.PayrollStorage.loadAdjustments = function () {
            return [{
                id: 'adj-1',
                status: 'pending',
                targetEmployeeId: 'emp-1',
                delta: { grossPay: 93.6, paye: 14.32, usc: 1.25, prsi: 3.93, lpt: 0, pensionDeduction: 0, employerPrsi: 0 }
            }];
        };
        const entry = {
            employeeId: 'emp-1',
            grossPay: 800,
            paye: 50,
            usc: 10,
            prsi: 20,
            lpt: 0,
            pensionDeduction: 0,
            employerPrsi: 80,
            totalDeductions: 80,
            netPay: 720
        };
        ctx.PayrollAdjustments.applyPendingToEntry('co-1', entry);
        expect(entry.grossPay).toBeCloseTo(893.6, 1);
        expect(entry.paye).toBeCloseTo(64.32, 2);
        expect(entry.adjustments).toHaveLength(1);
        expect(entry.netPay).toBeCloseTo(entry.grossPay - entry.totalDeductions, 2);
    });

    function hourlyEntry(hours, rate) {
        const gross = hours * rate;
        return {
            employeeId: 'emp-1',
            employeeName: 'Ada',
            payFrequency: 'weekly',
            payType: 'hourly',
            regularHours: hours,
            overtimeHours: 0,
            hourlyRate: rate,
            overtimeMultiplier: 1.5,
            regularGross: gross,
            grossPay: gross,
            paye: 50,
            usc: 10,
            prsi: 20,
            employerPrsi: 80,
            lpt: 0,
            pensionDeduction: 0,
            taxCreditsUsed: 40,
            netPay: gross - 80,
            totalDeductions: 80,
            periodNumber: 20,
            payDate: '2026-05-14'
        };
    }

    it('nets a second adjustment of the same week against earlier deltas', () => {
        const ctx = createContext();
        const store = [];
        let nextId = 1;
        ctx.PayrollStorage.generateId = function () { return 'adj-' + (nextId++); };
        ctx.PayrollStorage.loadAdjustments = function () { return store.slice(); };
        ctx.PayrollStorage.saveAdjustments = function (_id, list) {
            store.length = 0;
            list.forEach(function (item) { store.push(item); });
        };
        const run = { id: 'run-20', status: 'submitted', taxYear: '2026', periodNumber: 20, frequency: 'weekly', payDate: '2026-05-14' };
        const entry = hourlyEntry(35, 20);
        const first = ctx.PayrollAdjustments.createFromHistory('co-1', run, entry, { regularHours: 40 }, 'HOURS', 'first');
        expect(first.error).toBeUndefined();
        expect(first.delta.grossPay).toBeCloseTo(100, 1);
        expect(first.periodRates.hourlyRate).toBe(20);
        expect(first.periodRates.overtimeRate).toBeCloseTo(30, 1);

        const second = ctx.PayrollAdjustments.createFromHistory('co-1', run, entry, { regularHours: 42 }, 'HOURS', 'second');
        expect(second.error).toBeUndefined();
        expect(second.delta.grossPay).toBeCloseTo(40, 1);
        expect(second.fullDelta.grossPay).toBeCloseTo(140, 1);
        expect(second.priorAdjustmentIds).toEqual(['adj-1']);
        expect(second.priorDelta.grossPay).toBeCloseTo(100, 1);

        const current = { employeeId: 'emp-1', grossPay: 800, paye: 50, usc: 10, prsi: 20, lpt: 0, pensionDeduction: 0, employerPrsi: 80, totalDeductions: 80, netPay: 720 };
        ctx.PayrollAdjustments.applyPendingToEntry('co-1', current);
        expect(current.adjustments).toHaveLength(2);
        expect(current.grossPay).toBeCloseTo(940, 1);
    });

    it('refuses a second adjust that restates figures already queued', () => {
        const ctx = createContext();
        const store = [];
        let nextId = 1;
        ctx.PayrollStorage.generateId = function () { return 'adj-' + (nextId++); };
        ctx.PayrollStorage.loadAdjustments = function () { return store.slice(); };
        ctx.PayrollStorage.saveAdjustments = function (_id, list) {
            store.length = 0;
            list.forEach(function (item) { store.push(item); });
        };
        const run = { id: 'run-20', status: 'submitted', taxYear: '2026', periodNumber: 20, frequency: 'weekly' };
        const entry = hourlyEntry(35, 20);
        const first = ctx.PayrollAdjustments.createFromHistory('co-1', run, entry, { regularHours: 40 }, 'HOURS', '');
        expect(first.delta.grossPay).toBeCloseTo(100, 1);
        const again = ctx.PayrollAdjustments.createFromHistory('co-1', run, entry, { regularHours: 40 }, 'HOURS', '');
        expect(again.error).toMatch(/nothing further|already/i);
        expect(store).toHaveLength(1);
    });

    it('renders type, period rates, and this-adjustment on the employee register', () => {
        const ctx = createContext();
        ctx.PayrollStorage.loadAdjustments = function () {
            return [{
                id: 'adj-1',
                status: 'pending',
                targetEmployeeId: 'emp-1',
                targetEmployeeName: 'Ada',
                targetPeriodNumber: 20,
                changeType: 'HOURS',
                reasonCode: 'HOURS',
                createdAt: '2026-08-01T00:00:00.000Z',
                periodRates: { hourlyRate: 18.72, overtimeMultiplier: 1.5, overtimeRate: 28.08 },
                original: { regularHours: 35, overtimeHours: 0, grossPay: 655.2 },
                corrected: { regularHours: 40, overtimeHours: 0, grossPay: 748.8 },
                delta: { grossPay: 93.6 }
            }];
        };
        const html = ctx.PayrollAdjustments.renderEmployeeRegister('co-1', 'emp-1');
        expect(html).toMatch(/Hours \/ gross/);
        expect(html).toMatch(/18\.72/);
        expect(html).toMatch(/OT ×1\.5/);
        expect(html).toMatch(/data-adj-id="adj-1"/);
        expect(html).toMatch(/This adj/);
    });

    it('workspace html lists employee and change type', () => {
        const ctx = createContext();
        ctx.PayrollStorage.loadAdjustments = function () {
            return [{
                id: 'adj-2',
                status: 'applied',
                targetEmployeeId: 'emp-1',
                targetEmployeeName: 'Ada Lovelace',
                targetPeriodNumber: 20,
                changeType: 'OVERTIME',
                createdAt: '2026-08-02T00:00:00.000Z',
                appliedRunId: 'run-33',
                appliedPeriodNumber: 33,
                periodRates: { hourlyRate: 20, overtimeMultiplier: 1.5, overtimeRate: 30 },
                original: { regularHours: 35, overtimeHours: 0, grossPay: 700 },
                corrected: { regularHours: 35, overtimeHours: 2, grossPay: 760 },
                delta: { grossPay: 60 }
            }];
        };
        ctx.PayrollStorage.loadPayrollRuns = function () {
            return [{ id: 'run-33', periodNumber: 33 }];
        };
        const html = ctx.PayrollAdjustments.renderWorkspaceHtml('co-1');
        expect(html).toMatch(/Ada Lovelace/);
        expect(html).toMatch(/Missed overtime/);
        expect(html).toMatch(/Period 33/);
        expect(html).toMatch(/New adjustment/);
    });
});
