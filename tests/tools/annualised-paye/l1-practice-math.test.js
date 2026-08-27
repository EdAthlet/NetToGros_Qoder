/**
 * PAYE Lab Level 1 practice — calculation, boundary & robustness tests
 * (payroll-style period basis: week-1 COP + remaining TC spread)
 */
import { describe, expect, it } from 'vitest';
import { loadPayeLabMath } from './load-math.js';

const {
  RATE_20,
  RATE_40,
  DEFAULT_ANNUAL_TC,
  DEFAULT_ANNUAL_SRCOP,
  PREPOP_TAXABLE_COUNT,
  round2,
  flatPeriodTc,
  remainingTcAfterEvenPrior,
  computeRowTax,
  buildL1AnswerKey,
  nearlyEqual,
  isTaxablePrepopulated
} = loadPayeLabMath();

describe('L1 practice — period tax math (2026 single defaults)', () => {
  it('uses 2026 single defaults for TC and SRCOP', () => {
    expect(DEFAULT_ANNUAL_TC).toBe(4000);
    expect(DEFAULT_ANNUAL_SRCOP).toBe(44000);
  });

  it('computes flat weekly TC and COP slices', () => {
    expect(flatPeriodTc(4000, 52)).toBe(76.92);
    expect(round2(44000 / 52)).toBe(846.15);
  });

  it('taxable entirely at 20% when pay ≤ period COP', () => {
    const periodCop = 846.15;
    const tax = computeRowTax(600, periodCop, 76.92);
    expect(tax.taxable20).toBe(600);
    expect(tax.taxable40).toBe(0);
    expect(tax.paye20).toBe(120);
    expect(tax.paye40).toBe(0);
    expect(tax.totalPaye).toBe(120);
    // credit capped at tax due
    expect(tax.appliedTc).toBe(76.92);
    expect(tax.netTax).toBe(round2(120 - 76.92));
  });

  it('splits 20%/40% when pay exceeds period COP', () => {
    const periodCop = 846.15;
    const pay = 1200;
    const tax = computeRowTax(pay, periodCop, 76.92);
    expect(tax.taxable20).toBe(periodCop);
    expect(tax.taxable40).toBe(round2(pay - periodCop));
    expect(tax.paye20).toBe(round2(periodCop * RATE_20));
    expect(tax.paye40).toBe(round2((pay - periodCop) * RATE_40));
    expect(tax.totalPaye).toBe(round2(tax.paye20 + tax.paye40));
  });

  it('applies full credit when tax due is below period TC', () => {
    const tax = computeRowTax(100, 846.15, 76.92);
    expect(tax.totalPaye).toBe(20);
    expect(tax.appliedTc).toBe(20);
    expect(tax.netTax).toBe(0);
  });
});

describe('L1 practice — mid-year remaining TC boundaries', () => {
  it('period 1 has full annual TC remaining', () => {
    expect(remainingTcAfterEvenPrior(4000, 52, 0)).toBe(4000);
  });

  it('start week 10 subtracts 9 × flat period TC', () => {
    const flat = flatPeriodTc(4000, 52);
    const expected = round2(4000 - flat * 9);
    expect(remainingTcAfterEvenPrior(4000, 52, 9)).toBe(expected);
  });

  it('never returns negative remaining TC when priors exhaust annual', () => {
    // Enough even priors that used ≥ annual → floor at 0
    expect(remainingTcAfterEvenPrior(50, 12, 12)).toBe(0);
    expect(remainingTcAfterEvenPrior(1, 52, 100)).toBe(0);
  });

  it('buildL1AnswerKey mid-year cascades TC after applied credit', () => {
    const rows = buildL1AnswerKey({
      annualTc: 4000,
      annualCop: 44000,
      schedule: 52,
      startPeriod: 10,
      taxablePays: [800, 800]
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]._meta.evenPriorOpening).toBe(true);
    expect(rows[0]._meta.priorPeriodsEven).toBe(9);
    expect(rows[0].annualisedTc).toBe(remainingTcAfterEvenPrior(4000, 52, 9));
    // second period TC remained = first remaining − applied
    expect(rows[1].annualisedTc).toBe(rows[0].tcLeftAfter);
    expect(rows[1].period).toBe(11);
  });
});

describe('L1 practice — prepopulated taxable rule & robustness', () => {
  it('prepopulates first 4 taxable cells only', () => {
    expect(PREPOP_TAXABLE_COUNT).toBe(4);
    expect(isTaxablePrepopulated(0)).toBe(true);
    expect(isTaxablePrepopulated(3)).toBe(true);
    expect(isTaxablePrepopulated(4)).toBe(false);
    expect(isTaxablePrepopulated(7)).toBe(false);
  });

  it('handles zero taxable pay without throwing', () => {
    const tax = computeRowTax(0, 846.15, 76.92);
    expect(tax.totalPaye).toBe(0);
    expect(tax.netTax).toBe(0);
    expect(tax.appliedTc).toBe(0);
  });

  it('handles negative inputs as zero floors', () => {
    const tax = computeRowTax(-50, -10, -5);
    expect(tax.taxable20).toBe(0);
    expect(tax.taxable40).toBe(0);
    expect(tax.netTax).toBe(0);
  });

  it('buildL1AnswerKey with empty pays returns empty key', () => {
    expect(buildL1AnswerKey({ annualTc: 4000, annualCop: 44000, schedule: 52, taxablePays: [] })).toEqual([]);
  });

  it('nearlyEqual tolerates cent rounding noise', () => {
    expect(nearlyEqual(10.001, 10.02)).toBe(true);
    expect(nearlyEqual(10, 10.05)).toBe(false);
  });

  it('monthly schedule (12) spreads TC across months', () => {
    const rows = buildL1AnswerKey({
      annualTc: 4000,
      annualCop: 44000,
      schedule: 12,
      startPeriod: 1,
      taxablePays: [3000]
    });
    expect(rows[0].periodCop).toBe(round2(44000 / 12));
    expect(rows[0].periodTc).toBe(round2(4000 / 12));
  });
});

describe('L1 pay frequency defaults, labels and limits', () => {
  const {
    frequencySpec,
    clampStartPeriod,
    clampPeriodCount,
    remainingPeriods,
    frequencyFieldLabel,
    autoPeriodCop,
    autoPeriodTc
  } = loadPayeLabMath();

  it('weekly defaults: 52 periods and €1000 taxable', () => {
    const spec = frequencySpec('weekly');
    expect(spec.periods).toBe(52);
    expect(spec.defaultTaxable).toBe(1000);
    expect(spec.defaultCount).toBe(8);
    expect(autoPeriodCop(44000, 52)).toBe(846.15);
    expect(autoPeriodTc(4000, 52, 0)).toBe(76.92);
    expect(frequencyFieldLabel('Period COP', 'weekly')).toBe('Period COP (weekly)');
  });

  it('fortnightly defaults: 26 periods, €2000 taxable, COP/TC slices', () => {
    const spec = frequencySpec('fortnightly');
    expect(spec.periods).toBe(26);
    expect(spec.defaultTaxable).toBe(2000);
    expect(spec.defaultCount).toBe(6);
    expect(autoPeriodCop(44000, 26)).toBe(round2(44000 / 26));
    expect(autoPeriodTc(4000, 26, 0)).toBe(round2(4000 / 26));
    expect(frequencyFieldLabel('Period COP', 'fortnightly')).toBe('Period COP (fortnightly)');
    expect(frequencyFieldLabel('Period TC', 'fortnightly')).toBe('Period TC (fortnightly)');
    expect(frequencyFieldLabel('Taxable pay', 'fortnightly')).toBe('Taxable pay (fortnightly)');

    const rows = buildL1AnswerKey({
      annualTc: 4000,
      annualCop: 44000,
      schedule: 26,
      frequencyLabel: 'fortnightly',
      startPeriod: 1,
      taxablePays: [2000, 2100]
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].period).toBe(1);
    expect(rows[0].periodCop).toBe(round2(44000 / 26));
    expect(rows[0].periodTc).toBe(round2(4000 / 26));
    expect(rows[0].taxablePay).toBe(2000);
    expect(rows[0].taxable20).toBe(rows[0].periodCop);
    expect(rows[0].taxable40).toBe(round2(2000 - rows[0].periodCop));
    expect(rows[0]._meta.schedule).toBe(26);
    expect(rows[0]._meta.frequencyLabel).toBe('fortnightly');
    expect(rows[1].period).toBe(2);
    expect(rows[1].annualisedTc).toBe(rows[0].tcLeftAfter);
  });

  it('monthly defaults: 12 periods, €4000 taxable, COP/TC slices', () => {
    const spec = frequencySpec('monthly');
    expect(spec.periods).toBe(12);
    expect(spec.defaultTaxable).toBe(4000);
    expect(spec.defaultCount).toBe(4);
    expect(autoPeriodCop(44000, 12)).toBe(3666.67);
    expect(autoPeriodTc(4000, 12, 0)).toBe(333.33);
    expect(frequencyFieldLabel('Period COP', 'monthly')).toBe('Period COP (monthly)');

    const rows = buildL1AnswerKey({
      annualTc: 4000,
      annualCop: 44000,
      schedule: 12,
      frequencyLabel: 'monthly',
      startPeriod: 1,
      taxablePays: [4000, 3800]
    });
    expect(rows[0].periodCop).toBe(3666.67);
    expect(rows[0].periodTc).toBe(333.33);
    expect(rows[0].taxablePay).toBe(4000);
    expect(rows[0].taxable20).toBe(3666.67);
    expect(rows[0].taxable40).toBe(round2(4000 - 3666.67));
    expect(rows[0]._meta.schedule).toBe(12);
    expect(rows[1].period).toBe(2);
  });

  it('clamps start period and periods-to-build to the frequency maximum', () => {
    expect(clampStartPeriod(53, 'weekly')).toBe(52);
    expect(clampStartPeriod(40, 'fortnightly')).toBe(26);
    expect(clampStartPeriod(20, 'monthly')).toBe(12);
    expect(clampStartPeriod(0, 'monthly')).toBe(1);

    expect(remainingPeriods(1, 'fortnightly')).toBe(26);
    expect(remainingPeriods(24, 'fortnightly')).toBe(3);
    expect(remainingPeriods(10, 'monthly')).toBe(3);

    expect(clampPeriodCount(8, 1, 'weekly')).toBe(8);
    expect(clampPeriodCount(20, 1, 'monthly')).toBe(12);
    expect(clampPeriodCount(8, 1, 'monthly')).toBe(8);
    expect(clampPeriodCount(6, 24, 'fortnightly')).toBe(3);
    expect(clampPeriodCount(10, 11, 'monthly')).toBe(2);
  });
});
