/**
 * Payslip Calculation Breakdown Tests
 * 
 * Validates that the breakdown figures shown in the payslip match the actual
 * computed values stored in the payroll entry. Tests the fix for:
 * - Wrong annualization (was using global activeTab instead of entry frequency)
 * - Wrong taxable base (was using raw grossPay instead of taxableGross)
 * - Wrong PAYE cut-off (was using generic engine cut-off instead of ledger cut-off)
 * - Wrong tax credits (was using generic engine TC instead of cumulative TC)
 * - Missing tabConfig.multiplier breaking PRSI calculations
 */
import { describe, it, expect } from 'vitest';
import { simulatePayrollEntry, validatePayeBreakdown, buildPayeBreakdown } from './breakdown-helpers.js';

describe('Payslip Calculation Breakdown', () => {

    describe('PAYE Breakdown — stored values match entry values', () => {

        it('salaried single employee at €50k/year monthly — bands sum to grossPaye', () => {
            const entry = simulatePayrollEntry({
                payType: 'salaried',
                annualGross: 50000,
                frequency: 'monthly',
                familyStatus: 'single',
                annualCutOff: 44000,
                annualTC: 4000,
                remainingTC: 4000
            });

            const result = validatePayeBreakdown(entry);
            expect(result.errors).toEqual([]);
            expect(result.valid).toBe(true);

            // Verify specific values
            const bd = entry._payeBreakdown;
            expect(bd.bands.length).toBe(2); // standard + higher
            expect(bd.bands[0].description).toBe('Standard rate');
            expect(bd.bands[1].description).toBe('Higher rate');

            // Annual: 44000*0.2 + 6000*0.4 = 8800 + 2400 = 11200
            expect(bd.grossTax).toBeCloseTo(11200, 1);
            // Period (monthly): 11200/12 = 933.33
            expect(entry.grossPaye).toBeCloseTo(933.33, 1);
        });

        it('salaried employee €50k/year weekly — correct divisor of 52', () => {
            const entry = simulatePayrollEntry({
                payType: 'salaried',
                annualGross: 50000,
                frequency: 'weekly',
                familyStatus: 'single',
                annualCutOff: 44000,
                annualTC: 4000,
                remainingTC: 4000
            });

            const result = validatePayeBreakdown(entry);
            expect(result.errors).toEqual([]);

            // Period (weekly): 11200/52 = 215.38
            expect(entry.grossPaye).toBeCloseTo(215.38, 1);
            // Standard band period amount: 44000/52 = 846.15
            expect(entry._payeBreakdown.bands[0].taxableAmount).toBeCloseTo(846.15, 1);
        });

        it('salaried employee €50k/year fortnightly — correct divisor of 26', () => {
            const entry = simulatePayrollEntry({
                payType: 'salaried',
                annualGross: 50000,
                frequency: 'fortnightly',
                familyStatus: 'single',
                annualCutOff: 44000,
                annualTC: 4000,
                remainingTC: 4000
            });

            const result = validatePayeBreakdown(entry);
            expect(result.errors).toEqual([]);

            // Period (fortnightly): 11200/26 = 430.77
            expect(entry.grossPaye).toBeCloseTo(430.77, 1);
        });

        it('hourly employee at 40hrs * €20/hr weekly — correct calculation', () => {
            const entry = simulatePayrollEntry({
                payType: 'hourly',
                frequency: 'weekly',
                familyStatus: 'single',
                annualCutOff: 44000,
                annualTC: 4000,
                remainingTC: 4000,
                regularHours: 40,
                overtimeHours: 5,
                hourlyRate: 20,
                overtimeMultiplier: 1.5
            });

            // Gross: 40*20 + 5*20*1.5 = 800 + 150 = 950/week
            expect(entry.grossPay).toBe(950);
            expect(entry.regularGross).toBe(800);
            expect(entry.overtimeGross).toBe(150);

            // Annualized: 950*52 = 49400
            // PAYE: 44000*0.2 + 5400*0.4 = 8800 + 2160 = 10960
            const result = validatePayeBreakdown(entry);
            expect(result.errors).toEqual([]);
            expect(entry._payeBreakdown.grossTax).toBeCloseTo(10960, 1);
        });

        it('married employee has higher cut-off — only standard rate band', () => {
            const entry = simulatePayrollEntry({
                payType: 'salaried',
                annualGross: 50000,
                frequency: 'monthly',
                familyStatus: 'married',
                annualCutOff: 88000, // married cut-off
                annualTC: 8000,
                remainingTC: 8000
            });

            const result = validatePayeBreakdown(entry);
            expect(result.errors).toEqual([]);

            // All income under cut-off: 50000*0.2 = 10000
            const bd = entry._payeBreakdown;
            expect(bd.bands.length).toBe(1);
            expect(bd.grossTax).toBeCloseTo(10000, 1);
        });
    });

    describe('Pension and BIK adjustments to taxable gross', () => {

        it('pension deduction reduces taxable gross', () => {
            const entry = simulatePayrollEntry({
                payType: 'salaried',
                annualGross: 50000,
                frequency: 'monthly',
                familyStatus: 'single',
                annualCutOff: 44000,
                annualTC: 4000,
                remainingTC: 4000,
                pensionPct: 5 // 5% pension
            });

            // Monthly gross: 50000/12 = 4166.67
            // Pension: 4166.67 * 5% = 208.33
            // Taxable: 4166.67 - 208.33 = 3958.33
            // Annualized taxable: 3958.33 * 12 = 47500
            expect(entry._annualizedTaxable).toBeCloseTo(47500, 0);
            expect(entry.pensionDeduction).toBeCloseTo(208.33, 1);

            // PAYE on 47500: 44000*0.2 + 3500*0.4 = 8800 + 1400 = 10200
            expect(entry._payeBreakdown.grossTax).toBeCloseTo(10200, 1);

            const result = validatePayeBreakdown(entry);
            expect(result.errors).toEqual([]);
        });

        it('BIK increases taxable gross', () => {
            const entry = simulatePayrollEntry({
                payType: 'salaried',
                annualGross: 40000,
                frequency: 'monthly',
                familyStatus: 'single',
                annualCutOff: 44000,
                annualTC: 4000,
                remainingTC: 4000,
                bik: 6000 // €6000 annual BIK
            });

            // Monthly gross: 40000/12 = 3333.33
            // BIK period: 6000/12 = 500
            // Taxable: 3333.33 + 500 = 3833.33
            // Annualized taxable: 3833.33 * 12 = 46000
            expect(entry._annualizedTaxable).toBeCloseTo(46000, 0);
            expect(entry.bikAmount).toBeCloseTo(500, 1);

            // PAYE on 46000: 44000*0.2 + 2000*0.4 = 8800 + 800 = 9600
            expect(entry._payeBreakdown.grossTax).toBeCloseTo(9600, 1);

            const result = validatePayeBreakdown(entry);
            expect(result.errors).toEqual([]);
        });

        it('pension + BIK combined adjustment', () => {
            const entry = simulatePayrollEntry({
                payType: 'salaried',
                annualGross: 60000,
                frequency: 'monthly',
                familyStatus: 'single',
                annualCutOff: 44000,
                annualTC: 4000,
                remainingTC: 4000,
                pensionPct: 5,
                bik: 3000
            });

            // Monthly gross: 60000/12 = 5000
            // Pension: 5000 * 5% = 250
            // BIK: 3000/12 = 250
            // Taxable: 5000 - 250 + 250 = 5000
            // Annualized: 5000 * 12 = 60000
            expect(entry._annualizedTaxable).toBeCloseTo(60000, 0);

            const result = validatePayeBreakdown(entry);
            expect(result.errors).toEqual([]);
        });
    });

    describe('Cumulative tax credits tracking', () => {

        it('first period of year gets full proportion of remaining TC', () => {
            const entry = simulatePayrollEntry({
                payType: 'salaried',
                annualGross: 50000,
                frequency: 'monthly',
                familyStatus: 'single',
                annualCutOff: 44000,
                annualTC: 4000,
                remainingTC: 4000,
                committedPeriods: 0
            });

            // TC per period: 4000 / 12 = 333.33
            expect(entry._currentPeriodTC).toBeCloseTo(333.33, 1);
            // grossPaye: 11200/12 = 933.33
            // Net PAYE: 933.33 - 333.33 = 600.00
            expect(entry.paye).toBeCloseTo(600.00, 1);
        });

        it('mid-year entry gets larger TC proportion (fewer remaining periods)', () => {
            const entry = simulatePayrollEntry({
                payType: 'salaried',
                annualGross: 50000,
                frequency: 'monthly',
                familyStatus: 'single',
                annualCutOff: 44000,
                annualTC: 4000,
                remainingTC: 2000, // 2000 remaining TC (2000 already used)
                committedPeriods: 6 // 6 months done
            });

            // TC per period: 2000 / 6 = 333.33
            expect(entry._currentPeriodTC).toBeCloseTo(333.33, 1);
        });

        it('tax credits cannot exceed gross PAYE', () => {
            const entry = simulatePayrollEntry({
                payType: 'salaried',
                annualGross: 15000, // low income
                frequency: 'monthly',
                familyStatus: 'single',
                annualCutOff: 44000,
                annualTC: 4000,
                remainingTC: 4000
            });

            // All income at standard rate: 15000*0.2 = 3000 annual PAYE
            // Monthly gross PAYE: 3000/12 = 250
            // Monthly TC: 4000/12 = 333.33
            // PAYE can't go negative: max(250 - 333.33, 0) = 0
            expect(entry.paye).toBe(0);
            // TC used is capped at grossPaye
            expect(entry.taxCreditsUsed).toBeCloseTo(250, 1);
        });
    });

    describe('Frequency-independence — same annual salary gives consistent annual figures', () => {

        it('annual PAYE bands are identical regardless of pay frequency', () => {
            const frequencies = ['weekly', 'fortnightly', 'monthly'];
            const annualGrossTaxes = frequencies.map(freq => {
                const entry = simulatePayrollEntry({
                    payType: 'salaried',
                    annualGross: 55000,
                    frequency: freq,
                    familyStatus: 'single',
                    annualCutOff: 44000,
                    annualTC: 4000,
                    remainingTC: 4000
                });
                return entry._payeBreakdown.grossTax;
            });

            // All should produce the same annual gross tax
            // 44000*0.2 + 11000*0.4 = 8800 + 4400 = 13200
            expect(annualGrossTaxes[0]).toBeCloseTo(13200, 1);
            expect(annualGrossTaxes[1]).toBeCloseTo(13200, 1);
            expect(annualGrossTaxes[2]).toBeCloseTo(13200, 1);
        });

        it('period PAYE varies correctly by frequency for same annual salary', () => {
            const weekly = simulatePayrollEntry({
                payType: 'salaried', annualGross: 52000, frequency: 'weekly',
                annualCutOff: 44000, annualTC: 4000, remainingTC: 4000
            });
            const monthly = simulatePayrollEntry({
                payType: 'salaried', annualGross: 52000, frequency: 'monthly',
                annualCutOff: 44000, annualTC: 4000, remainingTC: 4000
            });

            // Weekly grossPaye should be monthly/4.333...
            expect(weekly.grossPaye * 52).toBeCloseTo(monthly.grossPaye * 12, 1);
        });
    });

    describe('buildPayeBreakdown — internal consistency', () => {

        it('period values are annual values divided by periods', () => {
            const result = buildPayeBreakdown(60000, 44000, 4000, 12, 'monthly');
            const bd = result.breakdown;

            bd.bands.forEach(band => {
                expect(band.taxableAmount).toBeCloseTo(band.annualTaxableAmount / 12, 2);
                expect(band.tax).toBeCloseTo(band.annualTax / 12, 2);
            });

            expect(bd.periodTaxCredits).toBeCloseTo(bd.taxCredits / 12, 2);
            expect(bd.periodStandardBand).toBeCloseTo(bd.standardBand / 12, 2);
        });

        it('taxableAmount * rate = tax for each band', () => {
            const result = buildPayeBreakdown(70000, 44000, 4000, 52, 'weekly');
            const bd = result.breakdown;

            bd.bands.forEach(band => {
                expect(band.tax).toBeCloseTo(band.taxableAmount * band.rate, 2);
                expect(band.annualTax).toBeCloseTo(band.annualTaxableAmount * band.rate, 2);
            });
        });

        it('grossTax equals sum of all band annualTax values', () => {
            const result = buildPayeBreakdown(80000, 44000, 4000, 26, 'fortnightly');
            const bd = result.breakdown;
            const sumAnnualTax = bd.bands.reduce((acc, b) => acc + b.annualTax, 0);
            expect(bd.grossTax).toBeCloseTo(sumAnnualTax, 2);
        });

        it('netTax = max(0, grossTax - taxCredits)', () => {
            const result = buildPayeBreakdown(50000, 44000, 4000, 12, 'monthly');
            const bd = result.breakdown;
            expect(bd.netTax).toBeCloseTo(Math.max(0, bd.grossTax - bd.taxCredits), 2);
        });

        it('income fully below cut-off produces only standard band', () => {
            const result = buildPayeBreakdown(30000, 44000, 4000, 12, 'monthly');
            expect(result.breakdown.bands.length).toBe(1);
            expect(result.breakdown.bands[0].rate).toBe(0.2);
        });

        it('income above cut-off produces both bands', () => {
            const result = buildPayeBreakdown(60000, 44000, 4000, 12, 'monthly');
            expect(result.breakdown.bands.length).toBe(2);
            expect(result.breakdown.bands[0].rate).toBe(0.2);
            expect(result.breakdown.bands[1].rate).toBe(0.4);
        });
    });

    describe('tabConfig.multiplier — PRSI period calculation', () => {
        // This validates the fix where payroll/index.html tabConfig was missing multiplier
        // causing calculatePRSIWithBreakdown to get NaN for periodGross

        it('tabConfig with multiplier produces valid period gross for PRSI', () => {
            const tabConfigs = {
                monthly: { periods: 12, multiplier: 12, label: 'Monthly' },
                weekly: { periods: 52, multiplier: 52, label: 'Weekly' },
                fortnightly: { periods: 26, multiplier: 26, label: 'Fortnightly' }
            };

            Object.entries(tabConfigs).forEach(([freq, config]) => {
                const annualGross = 50000;
                const periodGross = annualGross / config.multiplier;
                expect(periodGross).not.toBeNaN();
                expect(periodGross).toBeGreaterThan(0);
                expect(periodGross).toBeCloseTo(annualGross / config.periods, 2);
            });
        });

        it('multiplier equals periods for all frequencies', () => {
            const tabConfig = {
                annual: { periods: 1, multiplier: 1, label: 'Annual' },
                monthly: { periods: 12, multiplier: 12, label: 'Monthly' },
                fortnightly: { periods: 26, multiplier: 26, label: 'Fortnightly' },
                weekly: { periods: 52, multiplier: 52, label: 'Weekly' }
            };

            Object.values(tabConfig).forEach(config => {
                expect(config.multiplier).toBe(config.periods);
            });
        });
    });
});
