import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

function loadCore(period) {
    const context = {
        selectedYear: '2026',
        selected2024Period: 'oct-dec',
        selected2025Period: 'oct-dec',
        selected2026Period: period,
        activeTab: 'weekly',
        tabConfig: {
            weekly: { label: 'Weekly', multiplier: 52 },
            fortnightly: { label: 'Fortnightly', multiplier: 26 },
            monthly: { label: 'Monthly', multiplier: 12 }
        },
        document: { getElementById() { return null; } }
    };
    context.getCurrentPeriodConfig = function () {
        return context.tabConfig[context.activeTab];
    };
    vm.createContext(context);
    vm.runInContext(readFileSync(resolve('js/calculator-core.js'), 'utf8'), context);
    vm.runInContext('updateTaxRatesForYear(String(selectedYear));', context);
    return context;
}

function payrollEmployerPrsi(ctx, periodGross, frequency) {
    const weeklyEquivalent = periodGross * (frequency === 'weekly' ? 1 : frequency === 'fortnightly' ? 0.5 : 12 / 52);
    return ctx.calculateEmployerPRSI(periodGross, weeklyEquivalent);
}

describe('payroll 2026 employer PRSI (sandbox pay shapes)', () => {
    it('uses 11.40% for weekly pay above €552 (Noah Walsh 35 × €18.72)', () => {
        const ctx = loadCore('oct-dec');
        const gross = 18.72 * 35;
        expect(gross).toBeCloseTo(655.2, 4);
        const er = payrollEmployerPrsi(ctx, gross, 'weekly');
        expect(er.rate).toBe(0.1140);
        expect(er.amount).toBeCloseTo(74.6928, 4);
    });

    it('uses 9.15% for weekly pay between €441 and €552 (Emma Doyle 30 × €16.85)', () => {
        const ctx = loadCore('oct-dec');
        const gross = 16.85 * 30;
        expect(gross).toBeCloseTo(505.5, 4);
        expect(gross).toBeGreaterThan(441);
        expect(gross).toBeLessThanOrEqual(552);
        const er = payrollEmployerPrsi(ctx, gross, 'weekly');
        expect(er.rate).toBe(0.0915);
        expect(er.amount).toBeCloseTo(46.25325, 4);
        const oldWrongRate = 0.1105;
        expect(er.amount).not.toBeCloseTo(gross * oldWrongRate, 2);
    });

    it('uses 9.00% / 11.25% before 1 Oct 2026', () => {
        const ctx = loadCore('jan-sep');
        expect(payrollEmployerPrsi(ctx, 505.5, 'weekly').rate).toBe(0.090);
        expect(payrollEmployerPrsi(ctx, 655.2, 'weekly').rate).toBe(0.1125);
    });
});
