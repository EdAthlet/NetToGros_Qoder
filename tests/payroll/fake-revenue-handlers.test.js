import { describe, expect, it } from 'vitest';
import {
  generateFakeRPN,
  getUscBandsForYear,
  handleRpnRequest,
  handlePsrRequest,
  getServiceStatus
} from '../../services/fake-revenue-server/lib/handlers.js';

describe('fake Revenue handlers', () => {
  it('returns standard RPN for ordinary PPSN', () => {
    const rpn = generateFakeRPN('1234567A', 'emp-1', 2026);
    expect(rpn.error).toBeUndefined();
    expect(rpn.rpnNumber).toBeGreaterThan(0);
    expect(rpn.yearlyTaxCredit).toBe(3750);
    expect(rpn.yearlyStandardRateCutOffPoint).toBe(42000);
    expect(rpn.basis).toBe('Cumulative');
  });

  it('returns error profile for PPSN ending in 0', () => {
    const rpn = generateFakeRPN('12345670A', 'emp-1', 2026);
    expect(rpn.errorCode).toBe('ERR_001');
  });

  it('handles bulk RPN request', () => {
    const result = handleRpnRequest({
      employerRegistrationNumber: '1234567T',
      taxYear: 2026,
      employees: [
        { ppsn: '1234567A', employmentId: 'a' },
        { ppsn: '12345675B', employmentId: 'b' }
      ]
    });
    expect(result.statusCode).toBe(200);
    expect(result.body.count).toBe(2);
    expect(result.body.results).toHaveLength(2);
    expect(result.body.results[1].yearlyStandardRateCutOffPoint).toBe(44000);
  });

  it('rejects RPN without employees array', () => {
    const result = handleRpnRequest({});
    expect(result.statusCode).toBe(400);
  });

  it('accepts PSR and sums totals', () => {
    const result = handlePsrRequest({
      employerRegistrationNumber: '1234567T',
      taxYear: 2026,
      payPeriod: '2026-07',
      employees: [
        { grossPay: 100, paye: 10, usc: 2, prsi: 4 },
        { grossPay: 50, paye: 5, usc: 1, prsi: 2 }
      ]
    });
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('ACCEPTED');
    expect(result.body.summary.totalGrossPay).toBe(150);
    expect(result.body.summary.totalPAYE).toBe(15);
  });

  it('aligns 2026 USC bands with the calculator-core year table', () => {
    const bands = getUscBandsForYear(2026);
    expect(bands.map((band) => [band.rate, band.threshold])).toEqual([
      [0.5, 12012],
      [2.0, 27382],
      [3.0, 70044],
      [8.0, null]
    ]);
    expect(generateFakeRPN('1234567A', 'emp-1', 2026).uscBands).toEqual(bands);
  });

  it('keeps 2024 USC bands on the older 4% middle rate', () => {
    const bands = getUscBandsForYear(2024);
    expect(bands[1].threshold).toBe(25760);
    expect(bands[2].rate).toBe(4.0);
  });

  it('returns a period LPT deduction when the PPSN number is divisible by 7', () => {
    const withLpt = generateFakeRPN('1234562A', 'emp-1', 2026);
    const withoutLpt = generateFakeRPN('1234568A', 'emp-1', 2026);
    expect(withLpt.lptDeduction).toBe(45);
    expect(withoutLpt.lptDeduction).toBe(0);
  });

  it('returns service status payload', () => {
    const status = getServiceStatus({ mode: 'test' });
    expect(status.status).toBe('running');
    expect(status.mode).toBe('test');
  });
});
