import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

function loadPayrollUtils() {
    const utilsPath = resolve(process.cwd(), 'payroll/utils.js');
    const code = readFileSync(utilsPath, 'utf8');
    const context = { console, document: { createElement: () => ({ textContent: '', innerHTML: '' }) } };
    vm.createContext(context);
    vm.runInContext(code, context);
    return context.PayrollUtils;
}

describe('computeRemainingTaxCreditSchedule (local mode)', () => {
    const PayrollUtils = loadPayrollUtils();

    it('shows the same flat est for all periods when none submitted', () => {
        const rows = PayrollUtils.computeRemainingTaxCreditSchedule(4000, 52, {});
        const flatEst = 4000 / 52;
        expect(rows[0].annualAtStart).toBe(4000);
        expect(rows[0].estCreditPerPeriod).toBeCloseTo(flatEst, 5);
        expect(rows[25].estCreditPerPeriod).toBeCloseTo(flatEst, 5);
        expect(rows[51].estCreditPerPeriod).toBeCloseTo(flatEst, 5);
        expect(rows[51].annualAtStart).toBe(4000);
    });

    it('deducts only actual TC used and applies one new flat est to all future periods', () => {
        const rows = PayrollUtils.computeRemainingTaxCreditSchedule(4000, 52, { 1: 50 });
        const nextEst = 3950 / 51;
        expect(rows[0].estCreditPerPeriod).toBeCloseTo(4000 / 52, 5);
        expect(rows[0].tcApplied).toBe(50);
        expect(rows[0].creditLeftAfter).toBe(3950);
        expect(rows[1].annualAtStart).toBe(3950);
        expect(rows[1].estCreditPerPeriod).toBeCloseTo(nextEst, 5);
        expect(rows[25].annualAtStart).toBe(3950);
        expect(rows[25].estCreditPerPeriod).toBeCloseTo(nextEst, 5);
        expect(rows[51].estCreditPerPeriod).toBeCloseTo(nextEst, 5);
    });

    it('keeps full annual TC when zero TC applied (emergency / low pay)', () => {
        const rows = PayrollUtils.computeRemainingTaxCreditSchedule(4000, 52, { 1: 0 });
        const nextEst = 4000 / 51;
        expect(rows[0].creditLeftAfter).toBe(4000);
        expect(rows[1].annualAtStart).toBe(4000);
        expect(rows[1].estCreditPerPeriod).toBeCloseTo(nextEst, 5);
        expect(rows[51].estCreditPerPeriod).toBeCloseTo(nextEst, 5);
    });

    it('recalculates flat est only after each submitted payroll', () => {
        const rows = PayrollUtils.computeRemainingTaxCreditSchedule(4000, 12, { 1: 100, 2: 250 });
        const estAfterP2 = 3650 / 10;
        expect(rows[0].creditLeftAfter).toBe(3900);
        expect(rows[1].estCreditPerPeriod).toBeCloseTo(3900 / 11, 5);
        expect(rows[1].creditLeftAfter).toBe(3650);
        expect(rows[2].annualAtStart).toBe(3650);
        expect(rows[2].estCreditPerPeriod).toBeCloseTo(estAfterP2, 5);
        expect(rows[11].estCreditPerPeriod).toBeCloseTo(estAfterP2, 5);
    });
});

describe('getLocalPeriodicTaxCredit', () => {
    const PayrollUtils = loadPayrollUtils();

    it('matches next-period allocation after submitted periods', () => {
        expect(PayrollUtils.getLocalPeriodicTaxCredit(3950, 52, 1)).toBeCloseTo(3950 / 51, 5);
        expect(PayrollUtils.getLocalPeriodicTaxCredit(4000, 52, 0)).toBeCloseTo(4000 / 52, 5);
    });
});

describe('computeRemainingCOPSchedule (local mode)', () => {
    const PayrollUtils = loadPayrollUtils();

    it('shows constant annual COP and flat periodic COP for all rows', () => {
        const rows = PayrollUtils.computeRemainingCOPSchedule(44000, 52, {});
        const flatEst = 44000 / 52;
        expect(rows[0].annualCOP).toBe(44000);
        expect(rows[0].periodicCop).toBeCloseTo(flatEst, 5);
        expect(rows[25].periodicCop).toBeCloseTo(flatEst, 5);
        expect(rows[51].periodicCop).toBeCloseTo(flatEst, 5);
        expect(rows[51].annualCOP).toBe(44000);
    });

    it('marks underused when gross wages are below periodic COP', () => {
        const flatEst = 44000 / 52;
        const rows = PayrollUtils.computeRemainingCOPSchedule(44000, 52, { 1: 500 });
        expect(rows[0].annualCOP).toBe(44000);
        expect(rows[0].periodicCop).toBeCloseTo(flatEst, 5);
        expect(rows[0].grossWages).toBe(500);
        expect(rows[0].usedStatus).toBe('underused');
        expect(rows[1].annualCOP).toBe(44000);
        expect(rows[1].usedStatus).toBeNull();
    });

    it('marks used in full when gross wages meet or exceed periodic COP', () => {
        const flatEst = 44000 / 52;
        const rows = PayrollUtils.computeRemainingCOPSchedule(44000, 52, { 1: flatEst });
        expect(rows[0].usedStatus).toBe('used in full');
        const rows2 = PayrollUtils.computeRemainingCOPSchedule(44000, 52, { 1: flatEst + 100 });
        expect(rows2[0].usedStatus).toBe('used in full');
    });

    it('evaluates each submitted period independently', () => {
        const flatEst = 44000 / 12;
        const rows = PayrollUtils.computeRemainingCOPSchedule(44000, 12, { 1: 1000, 2: 5000 });
        expect(rows[0].grossWages).toBe(1000);
        expect(rows[0].usedStatus).toBe('underused');
        expect(rows[1].grossWages).toBe(5000);
        expect(rows[1].usedStatus).toBe('used in full');
        expect(rows[2].annualCOP).toBe(44000);
        expect(rows[11].periodicCop).toBeCloseTo(flatEst, 5);
    });
});

describe('getLocalPeriodicCOP', () => {
    const PayrollUtils = loadPayrollUtils();

    it('returns fixed annual slice per period (week-1 basis)', () => {
        expect(PayrollUtils.getLocalPeriodicCOP(44000, 52)).toBeCloseTo(44000 / 52, 5);
        expect(PayrollUtils.getLocalPeriodicCOP(44000, 12)).toBeCloseTo(44000 / 12, 5);
    });
});

describe('resolvePayPeriodNumber and getLatestSubmittedPayPeriodNumber', () => {
    const PayrollUtils = loadPayrollUtils();

    it('reads period from entry, run.periodNumbers, or week number', () => {
        expect(PayrollUtils.resolvePayPeriodNumber({ periodNumber: 6 }, {}, 'monthly')).toBe(6);
        expect(PayrollUtils.resolvePayPeriodNumber({}, { periodNumbers: { monthly: 6 } }, 'monthly')).toBe(6);
        expect(PayrollUtils.resolvePayPeriodNumber({}, { weekNumber: 26 }, 'weekly')).toBe(26);
    });

    it('returns latest submitted period by run date, not submission count', () => {
        const runs = [
            {
                status: 'submitted',
                taxYear: 2026,
                runDate: '2026-04-01T10:00:00.000Z',
                frequency: 'monthly',
                periodNumbers: { monthly: 4 },
                entries: [{ employeeId: 'e1', payFrequency: 'monthly', periodNumber: 4 }]
            },
            {
                status: 'submitted',
                taxYear: 2026,
                runDate: '2026-06-01T10:00:00.000Z',
                frequency: 'monthly',
                periodNumbers: { monthly: 6 },
                entries: [{ employeeId: 'e1', payFrequency: 'monthly', periodNumber: 6 }]
            }
        ];
        expect(PayrollUtils.getLatestSubmittedPayPeriodNumber('e1', 'monthly', runs)).toBe(6);
    });
});

describe('getCopUsedStatus', () => {
    const PayrollUtils = loadPayrollUtils();

    it('returns underused when gross is below periodic COP', () => {
        expect(PayrollUtils.getCopUsedStatus(500, 846.15)).toBe('underused');
    });

    it('returns used in full when gross meets or exceeds periodic COP', () => {
        expect(PayrollUtils.getCopUsedStatus(846.15, 846.15)).toBe('used in full');
        expect(PayrollUtils.getCopUsedStatus(900, 846.15)).toBe('used in full');
    });
});