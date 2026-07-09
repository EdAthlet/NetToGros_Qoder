import { describe, expect, it } from 'vitest';
import {
  PAY_FREQ,
  calculatePensionContribution,
  getContributionBreakdowns,
  getIntermediateBreakdowns,
  isSpspsEntrant,
  parseEntranceDate,
} from '../../Pensions/pension-calculator.js';

describe('pension calculator — scheme membership', () => {
  it('treats entrants from 1 Jan 2013 as SPSPS members', () => {
    expect(isSpspsEntrant(parseEntranceDate('2013-01-01'))).toBe(true);
    expect(isSpspsEntrant(parseEntranceDate('2020-04-15'))).toBe(true);
  });

  it('treats pre-2013 entrants as non-SPSPS', () => {
    expect(isSpspsEntrant(parseEntranceDate('2012-12-31'))).toBe(false);
  });
});

describe('pension calculator — SPSPS contribution example', () => {
  it('matches NSSO fortnightly example (€48,000, full-time)', () => {
    const result = calculatePensionContribution({
      entranceDate: '2015-01-01',
      scheme: 'SPSPS',
      payFrequency: 'fortnight',
      grossEarnings: 48000,
      overtime: 0,
    });

    expect(result.eligible).toBe(true);
    expect(result.d).toBeCloseTo(1839.79, 1);
    expect(result.e).toBeCloseTo(642.59, 1);
    expect(result.b).toBeCloseTo(55.19, 1);
    expect(result.c).toBeCloseTo(22.49, 1);
    expect(result.a).toBeCloseTo(77.68, 1);
  });

  it('includes overtime in annual pensionable remuneration', () => {
    const result = calculatePensionContribution({
      entranceDate: '2016-01-01',
      scheme: 'SPSPS',
      payFrequency: 'monthly',
      grossEarnings: 48000,
      overtime: 6000,
    });

    expect(result.d2).toBe(54000);
    expect(result.d).toBeCloseTo(4500, 2);
  });

  it('uses manual d2 override when provided', () => {
    const result = calculatePensionContribution({
      entranceDate: '2016-01-01',
      scheme: 'SPSPS',
      payFrequency: 'fortnight',
      grossEarnings: 48000,
      overtime: 0,
      annualPensionableRemuneration: 50000,
    });

    expect(result.d2).toBe(50000);
    expect(result.d2Overridden).toBe(true);
    expect(result.d).toBeCloseTo(1916.44, 1);
  });
});

describe('pension calculator — intermediate breakdowns', () => {
  it('returns formula steps for each intermediate value', () => {
    const result = calculatePensionContribution({
      entranceDate: '2015-01-01',
      scheme: 'SPSPS',
      payFrequency: 'fortnight',
      grossEarnings: 48000,
      overtime: 0,
    });

    const breakdowns = getIntermediateBreakdowns(result);
    expect(breakdowns.map((item) => item.code)).toEqual(['d2', 'd', 'd1', 'e', 'e1', 'cd1']);
    expect(breakdowns.find((item) => item.code === 'd').formula).toBe('d = d2 ÷ cd1');
    expect(breakdowns.find((item) => item.code === 'e').steps.length).toBeGreaterThan(3);
  });
});

describe('pension calculator — contribution breakdowns', () => {
  it('returns arithmetic steps for b, c, and a', () => {
    const result = calculatePensionContribution({
      entranceDate: '2015-01-01',
      scheme: 'SPSPS',
      payFrequency: 'fortnight',
      grossEarnings: 48000,
      overtime: 0,
    });

    const breakdowns = getContributionBreakdowns(result);
    expect(breakdowns.map((item) => item.code)).toEqual(['b', 'c', 'a']);
    expect(breakdowns.find((item) => item.code === 'b').formula).toBe('b = d × (d1 ÷ 100)');
    expect(breakdowns.find((item) => item.code === 'a').steps.at(-1).label).toBe('a = b + c');
  });

  it('explains unavailable contributions when ineligible', () => {
    const result = calculatePensionContribution({
      entranceDate: '2010-01-01',
      scheme: 'SPSPS',
      payFrequency: 'fortnight',
      grossEarnings: 48000,
      overtime: 0,
    });

    const breakdowns = getContributionBreakdowns(result);
    expect(breakdowns.every((item) => item.value === '—')).toBe(true);
    expect(breakdowns[0].steps[0].label).toBe('Not calculated');
  });
});

describe('pension calculator — unsupported cases', () => {
  it('returns ineligible for pre-2013 entrants', () => {
    const result = calculatePensionContribution({
      entranceDate: '2010-01-01',
      scheme: 'SPSPS',
      payFrequency: 'fortnight',
      grossEarnings: 48000,
      overtime: 0,
    });

    expect(result.eligible).toBe(false);
    expect(result.cdFinalSalary).toBe(true);
    expect(result.ceServiceRelated).toBe(true);
    expect(result.a).toBeNull();
    expect(result.message).toMatch(/1 January 2013/);
  });

  it('exposes pay frequency divisors from CSV', () => {
    expect(PAY_FREQ.weekly).toBe(52);
    expect(PAY_FREQ.fortnight).toBe(26.09);
    expect(PAY_FREQ.twoWeekly).toBe(26);
    expect(PAY_FREQ.monthly).toBe(12);
  });
});