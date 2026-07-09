import { describe, expect, it } from 'vitest';
import {
  PAY_FREQ,
  calculatePensionContribution,
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