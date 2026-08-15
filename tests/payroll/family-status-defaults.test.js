import { describe, expect, it } from 'vitest';
import { loadPayrollUtils } from './test-helpers.js';

describe('payroll family-status defaults', () => {
    it('treats married both-working as one person’s band and credits', () => {
        const utils = loadPayrollUtils();
        expect(utils.getDefaultAnnualTC('married')).toBe(4000);
        expect(utils.getDefaultCutOffPoint('married')).toBe(44000);
        expect(utils.getDefaultAnnualTC('married')).toBe(utils.getDefaultAnnualTC('single'));
        expect(utils.getDefaultCutOffPoint('married')).toBe(utils.getDefaultCutOffPoint('single'));
    });

    it('keeps the higher one-income married defaults', () => {
        const utils = loadPayrollUtils();
        expect(utils.getDefaultAnnualTC('marriedOneWorking')).toBe(6000);
        expect(utils.getDefaultCutOffPoint('marriedOneWorking')).toBe(53000);
    });
});
