import { describe, expect, it } from 'vitest';
import { loadPayrollScripts, validRun } from './test-helpers.js';

describe('PayrollStateMachine commit / rollback / submit cycle', () => {
    it('commits a run, rolls it back, and restores period state', () => {
        const context = loadPayrollScripts(['utils.js', 'state-machine.js']);
        const storage = context.PayrollStorage;
        const sm = context.PayrollStateMachine;
        const companyId = storage.loadCompanies()[0].id;

        sm.init(companyId);
        expect(sm.canCommit()).toBe(true);
        expect(sm.canRollback()).toBe(false);

        const run = validRun({ id: 'run-commit-1' });
        expect(sm.performCommit(run)).toBe(true);

        const stateAfterCommit = sm.getState();
        expect(stateAfterCommit.commitCounter).toBe(1);
        expect(stateAfterCommit.committedRunIds).toEqual(['run-commit-1']);
        expect(storage.loadPayrollRuns(companyId).some(r => r.id === 'run-commit-1')).toBe(true);

        expect(sm.canRollback()).toBe(true);
        expect(sm.performRollback()).toBe(true);

        const stateAfterRollback = sm.getState();
        expect(stateAfterRollback.commitCounter).toBe(0);
        expect(stateAfterRollback.committedRunIds).toEqual([]);
        expect(storage.loadPayrollRuns(companyId).some(r => r.id === 'run-commit-1')).toBe(false);
    });

    it('submits committed runs and records a submission with runIds', () => {
        const context = loadPayrollScripts(['utils.js', 'state-machine.js']);
        const storage = context.PayrollStorage;
        const sm = context.PayrollStateMachine;
        const companyId = storage.loadCompanies()[0].id;

        sm.init(companyId);
        const run = validRun({ id: 'run-submit-1', status: 'committed' });
        sm.performCommit(run);

        expect(sm.canSubmit()).toBe(true);
        expect(sm.performSubmit()).toBe(true);

        const submitted = storage.loadPayrollRuns(companyId).find(r => r.id === 'run-submit-1');
        expect(submitted.status).toBe('submitted');

        const submissions = storage.loadSubmissions(companyId);
        expect(submissions.length).toBe(1);
        expect(submissions[0].runIds).toContain('run-submit-1');
        expect(submissions[0].submittedAt).toBeTruthy();
        expect(sm.getState().status).toBe('submitted');
    });

    it('advances period after submit and clears commit counter', () => {
        const context = loadPayrollScripts(['utils.js', 'state-machine.js']);
        const storage = context.PayrollStorage;
        const sm = context.PayrollStateMachine;
        const companyId = storage.loadCompanies()[0].id;

        sm.init(companyId);
        sm.performCommit(validRun({ id: 'run-advance-1' }));
        sm.performSubmit();

        const beforeAdvance = sm.getState().currentPeriodNumber;
        expect(sm.advancePeriod()).toBe(true);

        const afterAdvance = sm.getState();
        expect(afterAdvance.currentPeriodNumber).toBe(beforeAdvance + 1);
        expect(afterAdvance.commitCounter).toBe(0);
        expect(afterAdvance.committedRunIds).toEqual([]);
        expect(afterAdvance.status).toBe('open');
    });

    it('deletePayrollRun removes a run from storage independently of state machine', () => {
        const context = loadPayrollScripts(['utils.js', 'state-machine.js']);
        const storage = context.PayrollStorage;
        const companyId = storage.loadCompanies()[0].id;
        const run = validRun({ id: 'run-delete-1', status: 'submitted' });

        storage.savePayrollRun(companyId, run);
        expect(storage.deletePayrollRun(companyId, 'run-delete-1')).toBe(true);
        expect(storage.loadPayrollRuns(companyId).some(r => r.id === 'run-delete-1')).toBe(false);
        expect(storage.deletePayrollRun(companyId, 'missing-run')).toBe(true);
        expect(storage.deletePayrollRun(companyId, '')).toBe(false);
    });
});