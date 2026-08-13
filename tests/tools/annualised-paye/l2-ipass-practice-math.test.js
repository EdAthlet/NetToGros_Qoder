/**
 * PAYE Lab Level 2 (IPASS-like) practice — cumulative card calculations,
 * E formula (fixed 52 weeks), higher-rate boundaries, and robustness.
 */
import { describe, expect, it } from 'vitest';
import { loadPayeLabMath } from './load-math.js';

const {
  DEFAULT_ANNUAL_TC,
  DEFAULT_ANNUAL_SRCOP,
  WEEKS_PER_YEAR,
  PREPOP_TAXABLE_COUNT,
  round2,
  evaluateCumSrcopE,
  computeIpassCard,
  isTaxablePrepopulated,
  nearlyEqual
} = loadPayeLabMath();

const setup2026Single = {
  annualTc: DEFAULT_ANNUAL_TC,
  annualSrcop: DEFAULT_ANNUAL_SRCOP,
  periodsPerYear: WEEKS_PER_YEAR,
  rateStd: 0.2,
  rateHigh: 0.4,
  prsiEeRate: 0.04,
  prsiErRate: 0.1095,
  openingCumulativeTaxable: 0,
  openingCumulativeTaxDue: 0
};

describe('L2 practice — weekly slices & column E (fixed 52 weeks)', () => {
  it('uses 52 weeks as constant for weekly SRCOP', () => {
    expect(WEEKS_PER_YEAR).toBe(52);
    const card = computeIpassCard(setup2026Single, [{ weekNo: 1, gross: 0 }]);
    expect(card.weeklySrcop).toBe(round2(44000 / 52));
    expect(card.weeklyTc).toBe(round2(4000 / 52));
  });

  it('E = Week No. × (Annual SRCOP ÷ 52) with fixed 52', () => {
    const week = 28;
    const e = evaluateCumSrcopE(week, 44000);
    const weekly = round2(44000 / 52);
    expect(e).toBe(round2(week * weekly));
    // Must match card computation for same inputs
    const card = computeIpassCard(setup2026Single, [{ weekNo: week, gross: 100 }]);
    expect(card.rows[0].cumSrcop).toBe(e);
  });

  it('does not accept a student-chosen denominator for E', () => {
    // Contract: only week + annual enter the formula; 52 is hard-coded
    const a = evaluateCumSrcopE(10, 44000);
    const b = evaluateCumSrcopE(10, 44000);
    expect(a).toBe(b);
    expect(a).not.toBe(round2(10 * (44000 / 26))); // fortnightly would differ
  });
});

describe('L2 practice — cumulative columns D–K calculations', () => {
  it('accumulates D from opening + period taxable', () => {
    const setup = {
      ...setup2026Single,
      openingCumulativeTaxable: 10000,
      openingCumulativeTaxDue: 500
    };
    const card = computeIpassCard(setup, [
      { weekNo: 20, gross: 1000, pension: 0 },
      { weekNo: 21, gross: 500, pension: 0 }
    ]);
    expect(card.rows[0].cumTaxable).toBe(11000);
    expect(card.rows[1].cumTaxable).toBe(11500);
    expect(card.rows[0].taxable).toBe(1000);
  });

  it('F higher-rate base is max(0, D − E)', () => {
    // Force D > E: large opening + high week
    const setup = {
      ...setup2026Single,
      openingCumulativeTaxable: 30000,
      openingCumulativeTaxDue: 2000
    };
    const card = computeIpassCard(setup, [{ weekNo: 28, gross: 2000 }]);
    const r = card.rows[0];
    expect(r.cumHigher).toBe(round2(Math.max(0, r.cumTaxable - r.cumSrcop)));
    expect(r.cumHigher).toBeGreaterThan(0);
    expect(r.cumTaxHigh).toBe(round2(r.cumHigher * 0.4));
    expect(r.cumTaxStd).toBe(round2(Math.min(r.cumTaxable, r.cumSrcop) * 0.2));
    expect(r.cumGrossTax).toBe(round2(r.cumTaxStd + r.cumTaxHigh));
  });

  it('stays fully standard rate when D ≤ E', () => {
    const card = computeIpassCard(setup2026Single, [{ weekNo: 1, gross: 500 }]);
    const r = card.rows[0];
    expect(r.cumHigher).toBe(0);
    expect(r.cumTaxHigh).toBe(0);
    expect(r.cumTaxStd).toBe(round2(r.cumTaxable * 0.2));
  });

  it('K = max(0, I − J) and L/M track change in K', () => {
    const setup = {
      ...setup2026Single,
      openingCumulativeTaxable: 5000,
      openingCumulativeTaxDue: 100
    };
    const card = computeIpassCard(setup, [
      { weekNo: 5, gross: 900 },
      { weekNo: 6, gross: 900 }
    ]);
    const r0 = card.rows[0];
    const r1 = card.rows[1];
    expect(r0.cumTaxDue).toBe(round2(Math.max(0, r0.cumGrossTax - r0.cumTc)));
    expect(r0.taxDeducted).toBe(round2(Math.max(0, r0.cumTaxDue - 100)));
    expect(r0.taxRefunded).toBe(round2(Math.max(0, 100 - r0.cumTaxDue)));
    // L/M vs previous week K
    expect(r1.taxDeducted).toBe(round2(Math.max(0, r1.cumTaxDue - r0.cumTaxDue)));
    expect(r1.taxRefunded).toBe(round2(Math.max(0, r0.cumTaxDue - r1.cumTaxDue)));
  });

  it('pension reduces taxable but PRSI still on gross', () => {
    const card = computeIpassCard(setup2026Single, [
      { weekNo: 1, gross: 1000, pension: 100 }
    ]);
    const r = card.rows[0];
    expect(r.taxable).toBe(900);
    expect(r.prsiEe).toBe(round2(1000 * 0.04));
    expect(r.prsiEr).toBe(round2(1000 * 0.1095));
  });
});

describe('L2 practice — mid-year sample boundaries', () => {
  it('week 28 with training openings produces coherent L and M', () => {
    const setup = {
      ...setup2026Single,
      openingCumulativeTaxable: 16645,
      openingCumulativeTaxDue: 1615.31
    };
    const periods = [
      { weekNo: 28, gross: 1800 },
      { weekNo: 29, gross: 1900 },
      { weekNo: 30, gross: 2000 },
      { weekNo: 31, gross: 2200 }
    ];
    const card = computeIpassCard(setup, periods);
    expect(card.rows).toHaveLength(4);
    expect(card.rows[0].cumTaxable).toBe(round2(16645 + 1800));
    expect(card.rows[0].cumSrcop).toBe(evaluateCumSrcopE(28, 44000));
    // L + M cannot both be positive
    card.rows.forEach((r) => {
      expect(r.taxDeducted === 0 || r.taxRefunded === 0).toBe(true);
    });
  });

  it('can cross into higher rate with realistic high mid-year pays', () => {
    const setup = {
      ...setup2026Single,
      openingCumulativeTaxable: 16645,
      openingCumulativeTaxDue: 1615.31
    };
    const periods = [
      { weekNo: 28, gross: 2500 },
      { weekNo: 29, gross: 2500 },
      { weekNo: 30, gross: 2500 },
      { weekNo: 31, gross: 2800 }
    ];
    const card = computeIpassCard(setup, periods);
    const anyHigher = card.rows.some((r) => r.cumHigher > 0);
    expect(anyHigher).toBe(true);
  });
});

describe('L2 practice — prepop rule & robustness', () => {
  it('first 4 taxables prepopulated; from 5th free', () => {
    expect(PREPOP_TAXABLE_COUNT).toBe(4);
    for (let i = 0; i < 4; i++) expect(isTaxablePrepopulated(i)).toBe(true);
    expect(isTaxablePrepopulated(4)).toBe(false);
  });

  it('empty periods array returns empty rows', () => {
    const card = computeIpassCard(setup2026Single, []);
    expect(card.rows).toEqual([]);
    expect(card.weeklyTc).toBe(round2(4000 / 52));
  });

  it('invalid / missing gross treated as zero', () => {
    const card = computeIpassCard(setup2026Single, [
      { weekNo: 1 },
      { weekNo: 2, gross: 'nope' }
    ]);
    expect(card.rows[0].gross).toBe(0);
    expect(card.rows[1].gross).toBe(0);
    expect(card.rows[1].cumTaxable).toBe(0);
  });

  it('week numbers drive E and J independently of row index', () => {
    const card = computeIpassCard(setup2026Single, [
      { weekNo: 40, gross: 100 }
    ]);
    expect(card.rows[0].cumSrcop).toBe(evaluateCumSrcopE(40, 44000));
    expect(card.rows[0].cumTc).toBe(round2(40 * round2(4000 / 52)));
  });

  it('cent rounding stays stable across cascade', () => {
    const card = computeIpassCard(setup2026Single, [
      { weekNo: 1, gross: 333.33 },
      { weekNo: 2, gross: 333.33 },
      { weekNo: 3, gross: 333.34 }
    ]);
    expect(card.rows[2].cumTaxable).toBe(1000);
    expect(nearlyEqual(card.rows[2].cumTaxable, 1000)).toBe(true);
  });
});
