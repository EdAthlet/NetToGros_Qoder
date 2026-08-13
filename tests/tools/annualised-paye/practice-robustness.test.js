/**
 * Cross-level practice robustness & invariant checks for PAYE Lab.
 */
import { describe, expect, it } from 'vitest';
import { loadPayeLabMath } from './load-math.js';

const {
  buildL1AnswerKey,
  computeIpassCard,
  evaluateCumSrcopE,
  nearlyEqual,
  round2,
  DEFAULT_ANNUAL_TC,
  DEFAULT_ANNUAL_SRCOP
} = loadPayeLabMath();

describe('Practice invariants — L1 vs L2 tax logic', () => {
  it('L1 20% band and L2 standard base both use 0.20 rate', () => {
    const l1 = buildL1AnswerKey({
      annualTc: 4000,
      annualCop: 44000,
      schedule: 52,
      startPeriod: 1,
      taxablePays: [500]
    })[0];
    const l2 = computeIpassCard(
      {
        annualTc: 4000,
        annualSrcop: 44000,
        periodsPerYear: 52,
        openingCumulativeTaxable: 0,
        openingCumulativeTaxDue: 0
      },
      [{ weekNo: 1, gross: 500 }]
    ).rows[0];

    expect(l1.paye20).toBe(round2(500 * 0.2));
    expect(l2.cumTaxStd).toBe(round2(500 * 0.2));
    expect(l1.taxable40).toBe(0);
    expect(l2.cumHigher).toBe(0);
  });

  it('E formula matches card for many week numbers', () => {
    for (const week of [1, 13, 26, 28, 39, 52]) {
      const e = evaluateCumSrcopE(week, DEFAULT_ANNUAL_SRCOP);
      const card = computeIpassCard(
        {
          annualTc: DEFAULT_ANNUAL_TC,
          annualSrcop: DEFAULT_ANNUAL_SRCOP,
          periodsPerYear: 52
        },
        [{ weekNo: week, gross: 0 }]
      );
      expect(card.rows[0].cumSrcop).toBe(e);
    }
  });
});

describe('Practice robustness — bulk / edge generators', () => {
  it('L1 answer key stays finite for high pays', () => {
    const pays = Array.from({ length: 12 }, (_, i) => 5000 + i * 100);
    const rows = buildL1AnswerKey({
      annualTc: 4000,
      annualCop: 44000,
      schedule: 52,
      startPeriod: 1,
      taxablePays: pays
    });
    rows.forEach((r) => {
      expect(Number.isFinite(r.netTax)).toBe(true);
      expect(r.netTax).toBeGreaterThanOrEqual(0);
      expect(r.appliedTc).toBeLessThanOrEqual(r.totalPaye + 0.001);
    });
  });

  it('L2 card with 53 weeks does not throw', () => {
    const periods = Array.from({ length: 53 }, (_, i) => ({
      weekNo: i + 1,
      gross: 800 + (i % 7) * 50
    }));
    const card = computeIpassCard(
      {
        annualTc: 4000,
        annualSrcop: 44000,
        periodsPerYear: 52,
        openingCumulativeTaxable: 0,
        openingCumulativeTaxDue: 0
      },
      periods
    );
    expect(card.rows).toHaveLength(53);
    expect(card.rows[52].weekNo).toBe(53);
    expect(Number.isFinite(card.rows[52].cumTaxDue)).toBe(true);
  });

  it('student check tolerance covers 1 cent drift', () => {
    expect(nearlyEqual(100.01, 100.00)).toBe(true);
    expect(nearlyEqual(100.03, 100.00)).toBe(false);
  });

  it('refund week: L=0 when K falls', () => {
    // First week builds tax due; second week with zero pay can reduce K via more TC
    const card = computeIpassCard(
      {
        annualTc: 10000,
        annualSrcop: 44000,
        periodsPerYear: 52,
        openingCumulativeTaxable: 0,
        openingCumulativeTaxDue: 0
      },
      [
        { weekNo: 1, gross: 5000 },
        { weekNo: 2, gross: 0 }
      ]
    );
    // Not always a refund — assert L/M exclusivity and non-negative
    card.rows.forEach((r) => {
      expect(r.taxDeducted).toBeGreaterThanOrEqual(0);
      expect(r.taxRefunded).toBeGreaterThanOrEqual(0);
      expect(r.taxDeducted > 0 && r.taxRefunded > 0).toBe(false);
    });
  });
});
