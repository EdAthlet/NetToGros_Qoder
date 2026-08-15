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
});
