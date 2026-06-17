import { describe, expect, it } from 'vitest';
import { loadPayrollScripts } from './test-helpers.js';

function loadPayrollUtilsWithWeek53() {
    const context = loadPayrollScripts(['week53.js', 'utils.js']);
    return context.PayrollUtils;
}

describe('getRevenueWeekNumberForDate', () => {
    const PayrollUtils = loadPayrollUtilsWithWeek53();

    it('returns week 1 for the first week of January', () => {
        expect(PayrollUtils.getRevenueWeekNumberForDate(new Date(2026, 0, 1))).toBe(1);
        expect(PayrollUtils.getRevenueWeekNumberForDate(new Date(2026, 0, 7))).toBe(1);
    });

    it('advances week number every seven days', () => {
        expect(PayrollUtils.getRevenueWeekNumberForDate(new Date(2026, 0, 8))).toBe(2);
        expect(PayrollUtils.getRevenueWeekNumberForDate(new Date(2026, 5, 15))).toBe(24);
    });

    it('handles year boundaries consistently', () => {
        expect(PayrollUtils.getRevenueWeekNumberForDate(new Date(2026, 11, 31))).toBe(53);
    });
});

describe('resolvePayPeriodNumber edge cases', () => {
    const PayrollUtils = loadPayrollUtilsWithWeek53();

    it('returns null when no period metadata exists', () => {
        expect(PayrollUtils.resolvePayPeriodNumber({}, {}, 'fortnightly')).toBeNull();
    });

    it('prefers entry periodNumber over run metadata', () => {
        expect(PayrollUtils.resolvePayPeriodNumber(
            { periodNumber: 3 },
            { periodNumbers: { fortnightly: 9 }, weekNumber: 18 },
            'fortnightly'
        )).toBe(3);
    });

    it('falls back to run.periodNumber for weekly when weekNumber absent', () => {
        expect(PayrollUtils.resolvePayPeriodNumber({}, { periodNumber: 11 }, 'weekly')).toBe(11);
    });
});