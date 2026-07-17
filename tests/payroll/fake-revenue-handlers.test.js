import { describe, expect, it } from 'vitest';
import {
  generateFakeRPN,
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

  it('returns service status payload', () => {
    const status = getServiceStatus({ mode: 'test' });
    expect(status.status).toBe('running');
    expect(status.mode).toBe('test');
  });
});
