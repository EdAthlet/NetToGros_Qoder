import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadCalculatorCore(overrides = {}) {
    const context = {
        selectedYear: '2026',
        selected2024Period: 'jan-sep',
        selected2025Period: 'jan-sep',
        selected2026Period: 'jan-sep',
        activeTab: 'annual',
        tabConfig: {
            annual: { label: 'Annual', multiplier: 1 },
            monthly: { label: 'Monthly', multiplier: 12 },
            fortnightly: { label: 'Fortnightly', multiplier: 26 },
            weekly: { label: 'Weekly', multiplier: 52 }
        },
        document: {
            getElementById() {
                return null;
            }
        },
        ...overrides
    };
    context.getCurrentPeriodConfig = function () {
        return context.tabConfig[context.activeTab];
    };
    context.convertToAnnual = function (amount) {
        return amount * context.getCurrentPeriodConfig().multiplier;
    };
    context.convertFromAnnual = function (amount) {
        return amount / context.getCurrentPeriodConfig().multiplier;
    };

    vm.createContext(context);
    vm.runInContext(readFileSync(resolve('js/calculator-core.js'), 'utf8'), context);
    vm.runInContext('updateTaxRatesForYear(String(selectedYear));', context);
    return context;
}

describe('calculator-core 2026 single employee', () => {
    it('applies the 20% standard band at €44,000', () => {
        const ctx = loadCalculatorCore();
        expect(ctx.calculatePAYE(44000, 'single')).toBeCloseTo(8800, 3);
        expect(ctx.calculateTaxCredits('single')).toBe(4000);
        expect(ctx.calculateNetFromGross(44000, 'single').paye).toBeCloseTo(4800, 3);
    });

    it('uses the 3% USC middle band and the €13,000 exemption cliff', () => {
        const ctx = loadCalculatorCore();
        expect(ctx.calculateUSC(12999)).toBe(0);
        expect(ctx.calculateUSC(13000)).toBeGreaterThan(0);
        expect(ctx.calculateUSC(44000)).toBeCloseTo(866, 2);
    });

    it('uses 4.2% PRSI for Jan–Sep 2026 and 4.35% after 1 Oct', () => {
        const jan = loadCalculatorCore({ selected2026Period: 'jan-sep' });
        const oct = loadCalculatorCore({ selected2026Period: 'oct-dec' });
        expect(jan.calculatePRSI(44000)).toBeCloseTo(1848, 2);
        expect(oct.calculatePRSI(44000)).toBeCloseTo(1914, 2);
    });

    it('classifies weekly AX pay with a tapered credit', () => {
        const ctx = loadCalculatorCore({ activeTab: 'weekly' });
        const weeklyGross = 400 * 52;
        const breakdown = ctx.calculatePRSIWithBreakdown(weeklyGross);
        expect(breakdown.bands[0].code).toBe('AX');
        expect(breakdown.bands[0].credit).toBeGreaterThan(0);
        expect(breakdown.total).toBeGreaterThan(0);
    });
});

describe('calculator-core married both-working preset', () => {
    it('applies the combined household band and both spouses’ credits', () => {
        const ctx = loadCalculatorCore();
        expect(ctx.calculatePAYE(44000, 'married')).toBeCloseTo(8800, 3);
        expect(ctx.calculateTaxCredits('married')).toBe(8000);
        expect(ctx.calculateNetFromGross(44000, 'married').paye).toBeCloseTo(800, 3);
    });
});

describe('calculator-core net-to-gross', () => {
    it('converges back to the target net for a 2026 single salary', () => {
        const ctx = loadCalculatorCore();
        const forward = ctx.calculateNetFromGross(50000, 'single');
        const reverse = ctx.calculateGrossFromNet(forward.netIncome, 'single');
        expect(reverse.netIncome).toBeCloseTo(forward.netIncome, 2);
        expect(reverse.grossIncome).toBeCloseTo(50000, 1);
    });
});
