import { describe, expect, it } from 'vitest';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPayrollScripts } from './test-helpers.js';

function loadWeek53() {
    const context = { globalThis: {} };
    vm.createContext(context);
    const source = readFileSync(resolve('payroll/week53.js'), 'utf8');
    vm.runInContext(source + '\nglobalThis.PayrollWeek53 = PayrollWeek53;', context);
    return context.PayrollWeek53;
}

describe('PayrollWeek53 payday detection', () => {
    const Week53 = loadWeek53();

    it('counts 53 Thursday paydays in 2026', () => {
        expect(Week53.countPaydaysInYear(2026, 'thursday')).toBe(53);
        expect(Week53.isWeek53Year(2026, 'thursday')).toBe(true);
    });

    it('counts 53 Wednesday paydays in 2025', () => {
        expect(Week53.countPaydaysInYear(2025, 'wednesday')).toBe(53);
        expect(Week53.isWeek53Year(2025, 'wednesday')).toBe(true);
    });

    it('counts 52 Friday paydays in 2026', () => {
        expect(Week53.countPaydaysInYear(2026, 'friday')).toBe(52);
        expect(Week53.isWeek53Year(2026, 'friday')).toBe(false);
    });

    it('identifies the 53rd Thursday pay run on 31 Dec 2026', () => {
        const payDate = new Date(2026, 11, 31);
        expect(Week53.getPaydayIndexInYear(payDate, 'thursday')).toBe(53);
        expect(Week53.isWeek53PayRun(payDate, 'thursday')).toBe(true);
    });

    it('does not treat non-paydays as Week 53 runs', () => {
        const payDate = new Date(2026, 11, 30);
        expect(Week53.isWeek53PayRun(payDate, 'thursday')).toBe(false);
    });

    it('supports 27 fortnightly periods in a Week 53 year', () => {
        expect(Week53.getFortnightlyPeriodsInYear(2026, 'thursday')).toBe(27);
        const lastFortnight = new Date(2026, 11, 31);
        expect(Week53.isWeek53FortnightlyPayRun(lastFortnight, 'thursday')).toBe(true);
    });

    it('never applies Week 53 to monthly frequency', () => {
        const payDate = new Date(2026, 11, 31);
        expect(Week53.isWeek53FrequencyPayRun(payDate, 'thursday', 'monthly')).toBe(false);
    });
});

describe('PayrollWeek53 allocation and guards', () => {
    const Week53 = loadWeek53();

    it('allocates extra 1/52 TC and COP on top of Week 1 amounts', () => {
        const amounts = Week53.buildWeek53PeriodicAmounts(4000, 44000, 'weekly');
        expect(amounts.periodicTaxCredit).toBeCloseTo(153.846, 2);
        expect(amounts.periodicStandardRateCutOffPoint).toBeCloseTo(1692.307, 2);
    });

    it('caps Week 53 credits at gross pay', () => {
        const payeResult = {
            taxBeforeCredit: 100,
            taxCreditUsed: 153.84,
            paye: 0,
            taxableAt20: 100,
            taxableAt40: 0,
            taxAt20: 20,
            taxAt40: 0
        };
        const capped = Week53.applyWeek53PayCap(
            Object.assign({}, payeResult, { periodicTaxCredit: 153.84 }),
            50
        );
        expect(capped.taxCreditUsed).toBe(50);
        expect(capped.paye).toBe(50);
        expect(capped.week53CreditCapped).toBe(true);
    });

    it('blocks manufactured Week 53 after mid-year pay day change', () => {
        const company = {
            payDate: 'thursday',
            payDateChangeLog: [{
                year: '2026',
                from: 'friday',
                to: 'thursday',
                changedAt: '2026-06-01T00:00:00.000Z'
            }]
        };
        expect(Week53.isWeek53Eligible(company, 2026, 'thursday')).toBe(false);
    });
});

describe('PayrollUtils period context with Week 53', () => {
    const context = loadPayrollScripts(['week53.js', 'utils.js']);
    const PayrollUtils = context.PayrollUtils;

    it('sets weeksInYear from payday count, not revenue week blocks alone', () => {
        const ctx = PayrollUtils.getPeriodContextFromPayDate(new Date(2026, 0, 8), 'thursday', null);
        expect(ctx.weeksInYear).toBe(53);
        expect(ctx.fortnightlyPeriodsInYear).toBe(27);
        expect(ctx.isWeek53Year).toBe(true);
    });

    it('returns 52 weeks for Friday pay in 2026', () => {
        const ctx = PayrollUtils.getPeriodContextFromPayDate(new Date(2026, 0, 2), 'friday', null);
        expect(ctx.weeksInYear).toBe(52);
        expect(ctx.isWeek53Year).toBe(false);
    });
});