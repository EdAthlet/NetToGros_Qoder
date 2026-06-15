import { describe, expect, it } from 'vitest';
import { loadPayrollUtils } from './test-helpers.js';

describe('Tax Credits table last updated', () => {
    const PayrollUtils = loadPayrollUtils();

    it('returns null when no submitted runs have tax credits applied', () => {
        const runs = [
            {
                id: 'r1',
                status: 'submitted',
                taxYear: '2026',
                runDate: '2026-02-01',
                entries: [{ taxCreditsUsed: 0 }]
            }
        ];
        expect(PayrollUtils.getTaxCreditsLastUpdatedTimestamp(runs, [], '2026')).toBeNull();
    });

    it('ignores committed runs that are not yet submitted', () => {
        const runs = [
            {
                id: 'r1',
                status: 'committed',
                taxYear: '2026',
                runDate: '2026-02-01',
                entries: [{ taxCreditsUsed: 200 }]
            }
        ];
        expect(PayrollUtils.getTaxCreditsLastUpdatedTimestamp(runs, [], '2026')).toBeNull();
    });

    it('prefers submission submittedAt over runDate for the latest TC run', () => {
        const runs = [
            {
                id: 'older-run',
                status: 'submitted',
                taxYear: '2026',
                runDate: '2026-01-10T09:00:00.000Z',
                entries: [{ taxCreditsUsed: 100 }]
            },
            {
                id: 'latest-run',
                status: 'submitted',
                taxYear: '2026',
                runDate: '2026-03-01T09:00:00.000Z',
                entries: [{ taxCreditsUsed: 150 }]
            }
        ];
        const submissions = [
            {
                runIds: ['latest-run'],
                submittedAt: '2026-03-05T14:30:00.000Z'
            }
        ];

        expect(PayrollUtils.getTaxCreditsLastUpdatedTimestamp(runs, submissions, '2026'))
            .toBe('2026-03-05T14:30:00.000Z');
    });

    it('falls back to runDate when submission timestamp is missing', () => {
        const runs = [
            {
                id: 'run-only',
                status: 'submitted',
                taxYear: '2026',
                runDate: '2026-04-12T11:00:00.000Z',
                entries: [{ taxCreditsUsed: 50 }]
            }
        ];
        expect(PayrollUtils.getTaxCreditsLastUpdatedTimestamp(runs, [], '2026'))
            .toBe('2026-04-12T11:00:00.000Z');
    });

    it('filters by tax year when year is provided', () => {
        const runs = [
            {
                id: '2025-run',
                status: 'submitted',
                taxYear: '2025',
                runDate: '2025-12-20',
                entries: [{ taxCreditsUsed: 80 }]
            },
            {
                id: '2026-run',
                status: 'submitted',
                taxYear: '2026',
                runDate: '2026-01-05',
                entries: [{ taxCreditsUsed: 90 }]
            }
        ];
        expect(PayrollUtils.getTaxCreditsLastUpdatedTimestamp(runs, [], '2026'))
            .toBe('2026-01-05');
    });

    it('runHasTaxCreditsApplied detects any positive TC usage on entries', () => {
        expect(PayrollUtils.runHasTaxCreditsApplied({ entries: [{ taxCreditsUsed: 0 }] })).toBe(false);
        expect(PayrollUtils.runHasTaxCreditsApplied({ entries: [{ taxCreditsUsed: 0.01 }] })).toBe(true);
        expect(PayrollUtils.runHasTaxCreditsApplied({ entries: [] })).toBe(false);
    });
});