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

    it('maps payday index 53 to 31 Dec 2026 for Thursday pay', () => {
        const payDate = Week53.getPayDateForPaydayIndex(2026, 53, 'thursday');
        expect(payDate).not.toBeNull();
        expect(payDate.getFullYear()).toBe(2026);
        expect(payDate.getMonth()).toBe(11);
        expect(payDate.getDate()).toBe(31);
        expect(Week53.isWeek53PayRun(payDate, 'thursday')).toBe(true);
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

    it('allows Week 53 preview when pay day change guard is ignored', () => {
        const company = {
            payDate: 'thursday',
            payDateChangeLog: [{
                year: '2026',
                from: 'friday',
                to: 'thursday',
                changedAt: '2026-06-01T00:00:00.000Z'
            }]
        };
        const payDate = new Date(2026, 11, 31);
        const ctx = Week53.buildPayrollWeek53Context(payDate, 'thursday', 'weekly', company, {
            ignorePayDateChangeGuard: true
        });
        expect(ctx.week53Eligible).toBe(false);
        expect(ctx.week53TestOverride).toBe(true);
        expect(ctx.isWeek53Run).toBe(true);
    });
});

describe('PayrollUtils Week 53 payslip helpers', () => {
    function loadUtilsWithSessionStorage(sessionData = {}) {
        const context = {
            console: { log: console.log, warn: console.warn, error() {} },
            sessionStorage: {
                getItem(key) {
                    return Object.prototype.hasOwnProperty.call(sessionData, key) ? sessionData[key] : null;
                },
                setItem(key, value) {
                    sessionData[key] = String(value);
                }
            }
        };
        vm.createContext(context);
        const week53Source = readFileSync(resolve('payroll/week53.js'), 'utf8');
        const utilsSource = readFileSync(resolve('payroll/utils.js'), 'utf8');
        vm.runInContext(week53Source + '\nglobalThis.PayrollWeek53 = PayrollWeek53;', context);
        vm.runInContext(utilsSource + '\nglobalThis.PayrollUtils = PayrollUtils;', context);
        return context;
    }

    const context = loadPayrollScripts(['week53.js', 'utils.js']);
    const PayrollUtils = context.PayrollUtils;

    it('detects Week 53 entries from pay date when flags are missing', () => {
        const company = { payDate: 'thursday' };
        const entry = {
            payDate: '2026-12-31',
            payFrequency: 'weekly',
            taxCreditsUsed: 153.84
        };
        expect(PayrollUtils.isWeek53PayrollEntry(entry, company)).toBe(true);
        expect(PayrollUtils.getTaxCreditsUsedForCumulativeYtd(entry, company)).toBe(0);
    });

    it('detects Week 53 from run periodContext when entry payDate is missing', () => {
        const company = { payDate: 'thursday' };
        const entry = {
            payFrequency: 'weekly',
            taxCreditsUsed: 153.84
        };
        const run = {
            payDate: '2026-12-31',
            periodContext: {
                payDateIso: '2026-12-31',
                isWeek53WeeklyRun: true
            }
        };
        expect(PayrollUtils.isWeek53PayrollEntry(entry, company, run)).toBe(true);
        expect(PayrollUtils.getTaxCreditsUsedForCumulativeYtd(entry, company, run)).toBe(0);
    });

    it('includes normal period tax credits in cumulative YTD', () => {
        const company = { payDate: 'thursday' };
        const entry = {
            payDate: '2026-01-01',
            payFrequency: 'weekly',
            taxCreditsUsed: 76.92
        };
        expect(PayrollUtils.isWeek53PayrollEntry(entry, company)).toBe(false);
        expect(PayrollUtils.getTaxCreditsUsedForCumulativeYtd(entry, company)).toBeCloseTo(76.92, 2);
    });

    it('detects Week 53 in test period mode despite pay day change log', () => {
        const testContext = loadUtilsWithSessionStorage({ payrollPeriodTestMode: '1' });
        const TestUtils = testContext.PayrollUtils;
        const company = {
            payDate: 'thursday',
            payDateChangeLog: [{
                year: '2026',
                from: 'friday',
                to: 'thursday',
                changedAt: '2026-06-01T00:00:00.000Z'
            }]
        };
        const entry = {
            payDate: '2026-12-31',
            payFrequency: 'weekly',
            taxCreditsUsed: 153.84
        };
        expect(TestUtils.isWeek53PayrollEntry(entry, company)).toBe(true);
        expect(TestUtils.getTaxCreditsUsedForCumulativeYtd(entry, company)).toBe(0);
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