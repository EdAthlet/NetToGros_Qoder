/**
 * PayrollStateMachine - Core state management for the Calculate → Commit → Submit workflow.
 * Manages period lifecycle, commit counting, rollback stack, and submissions registry.
 * Depends on: storage.js (must be loaded before this file)
 */
var PayrollStateMachine = (function() {
    'use strict';

    var _companyId = null;
    var _state = null; // Current period state

    /**
     * Initialize or load the period state for a company.
     * Performs migration if legacy data is detected.
     */
    function init(companyId) {
        if (!companyId) {
            console.error('PayrollStateMachine.init: companyId required');
            return;
        }
        _companyId = companyId;
        _state = PayrollStorage.loadPeriodState(companyId);

        if (!_state) {
            _migrateIfNeeded(companyId);
        } else {
            // Backward compat: ensure new frequency fields exist on loaded state
            _ensureFrequencyFields();
        }
    }

    /**
     * Ensure the loaded state has all new per-frequency fields.
     * Populates defaults for any missing fields (backward compatibility).
     */
    function _ensureFrequencyFields() {
        if (!_state) return;

        if (typeof _state.weekNumber === 'undefined') {
            _state.weekNumber = 1;
        }
        if (typeof _state.weekly === 'undefined') {
            _state.weekly = { periodNumber: 1 };
        } else if (typeof _state.weekly.periodNumber === 'undefined') {
            _state.weekly.periodNumber = 1;
        }
        if (typeof _state.fortnightly === 'undefined') {
            _state.fortnightly = { periodNumber: 1, lastCommittedWeek: 0 };
        } else {
            if (typeof _state.fortnightly.periodNumber === 'undefined') {
                _state.fortnightly.periodNumber = 1;
            }
            if (typeof _state.fortnightly.lastCommittedWeek === 'undefined') {
                _state.fortnightly.lastCommittedWeek = 0;
            }
        }
        if (typeof _state.monthly === 'undefined') {
            _state.monthly = { periodNumber: 1, lastCommittedWeek: 0 };
        } else {
            if (typeof _state.monthly.periodNumber === 'undefined') {
                _state.monthly.periodNumber = 1;
            }
            if (typeof _state.monthly.lastCommittedWeek === 'undefined') {
                _state.monthly.lastCommittedWeek = 0;
            }
        }
        if (!Array.isArray(_state.committedRunIds)) {
            _state.committedRunIds = [];
        }
        if (typeof _state.commitCounter === 'undefined') {
            _state.commitCounter = _state.committedRunIds.length;
        }
        if (typeof _state.currentPeriodNumber === 'undefined') {
            _state.currentPeriodNumber = 1;
        }
        if (typeof _state.status === 'undefined') {
            _state.status = 'open';
        }
        if (typeof _state.rpnRetrievedForPeriod === 'undefined') {
            _state.rpnRetrievedForPeriod = false;
        }

        // Persist migrated state
        PayrollStorage.savePeriodState(_companyId, _state);
    }

    /**
     * Migrate legacy data: treat all existing runs as "submitted"
     * and create an initial period state.
     */
    function _migrateIfNeeded(companyId) {
        var runs = PayrollStorage.loadPayrollRuns(companyId) || [];
        var migrated = false;

        // Add status/commitSequence to legacy runs
        for (var i = 0; i < runs.length; i++) {
            if (!runs[i].status) {
                runs[i].status = 'submitted';
                runs[i].commitSequence = 0;
                migrated = true;
            }
        }

        if (migrated && runs.length > 0) {
            PayrollStorage.savePayrollRun(companyId, runs[0]); // triggers full save
            // Actually save the whole array properly
            for (var j = 1; j < runs.length; j++) {
                PayrollStorage.savePayrollRun(companyId, runs[j]);
            }
        }

        // Create initial period state
        var submittedCount = runs.filter(function(r) { return r.status === 'submitted'; }).length;
        _state = {
            weekNumber: 1,
            weekly: { periodNumber: 1 },
            fortnightly: { periodNumber: 1, lastCommittedWeek: 0 },
            monthly: { periodNumber: 1, lastCommittedWeek: 0 },
            currentPeriodNumber: submittedCount + 1,
            commitCounter: 0,
            status: 'open',
            committedRunIds: [],
            rpnRetrievedForPeriod: false
        };

        PayrollStorage.savePeriodState(companyId, _state);

        // Create retroactive submission record if legacy runs exist
        if (runs.length > 0) {
            var submissions = PayrollStorage.loadSubmissions(companyId);
            if (submissions.length === 0) {
                var legacySubmission = {
                    id: PayrollStorage.generateId(),
                    periodNumber: 0,
                    submittedAt: runs[runs.length - 1].runDate || new Date().toISOString(),
                    runIds: runs.map(function(r) { return r.id; }),
                    taxYear: runs[runs.length - 1].taxYear || '2026',
                    frequency: runs[runs.length - 1].frequency || 'monthly',
                    note: 'Legacy migration'
                };
                submissions.push(legacySubmission);
                PayrollStorage.saveSubmissions(companyId, submissions);
            }
        }
    }

    /**
     * Get the current period state object.
     */
    function getState() {
        return _state || {
            weekNumber: 1,
            weekly: { periodNumber: 1 },
            fortnightly: { periodNumber: 1, lastCommittedWeek: 0 },
            monthly: { periodNumber: 1, lastCommittedWeek: 0 },
            currentPeriodNumber: 1,
            commitCounter: 0,
            status: 'open',
            committedRunIds: [],
            rpnRetrievedForPeriod: false
        };
    }

    /**
     * Get current period number.
     */
    function getCurrentPeriodNumber() {
        return _state ? _state.currentPeriodNumber : 1;
    }

    /**
     * Get number of commits in current period.
     */
    function getCommitCount() {
        return _state ? _state.commitCounter : 0;
    }

    /**
     * Get IDs of committed (not yet submitted) runs.
     */
    function getCommittedRunIds() {
        return _state ? _state.committedRunIds : [];
    }

    /**
     * Guard: Can calculate (at least one active employee exists - checked externally).
     */
    function canCalculate() {
        return _state && _state.status === 'open';
    }

    /**
     * Guard: Can commit (run data exists - checked externally via currentRunData).
     */
    function canCommit() {
        return _state && _state.status === 'open';
    }

    /**
     * Guard: Can rollback (at least one committed run in this period).
     */
    function canRollback() {
        _ensureFrequencyFields();
        return _state && _state.commitCounter > 0 && _state.committedRunIds.length > 0;
    }

    /**
     * Guard: Can submit (at least one committed run exists in period).
     */
    function canSubmit() {
        _ensureFrequencyFields();
        return _state && _state.commitCounter >= 1 && _state.committedRunIds.length > 0;
    }

    /**
     * Should we suggest retrieving RPN for the new period?
     */
    function shouldSuggestRPN() {
        return _state && !_state.rpnRetrievedForPeriod && _state.commitCounter === 0;
    }

    /**
     * Perform a commit: save the run with status="committed", update state.
     * @param {Object} run - The payroll run object (must have .id)
     * @returns {boolean} success
     */
    function performCommit(run) {
        if (!_companyId || !_state || !run) return false;
        _ensureFrequencyFields();

        // Set run metadata
        run.status = 'committed';
        run.commitSequence = _state.commitCounter + 1;

        // Save the run
        var success = PayrollStorage.savePayrollRun(_companyId, run);
        if (!success) return false;

        // Update period state
        _state.commitCounter += 1;
        _state.committedRunIds.push(run.id);
        PayrollStorage.savePeriodState(_companyId, _state);

        return true;
    }

    /**
     * Rollback the last commit (LIFO). Removes the run and decrements counter.
     * @returns {boolean} success
     */
    function performRollback() {
        if (!_companyId || !_state) return false;
        _ensureFrequencyFields();
        if (_state.committedRunIds.length === 0) return false;

        // Get the last committed run ID
        var lastRunId = _state.committedRunIds[_state.committedRunIds.length - 1];

        // Delete the run from storage
        var success = PayrollStorage.deletePayrollRun(_companyId, lastRunId);
        if (!success) return false;

        // Update state
        _state.committedRunIds.pop();
        _state.commitCounter = Math.max(0, _state.commitCounter - 1);
        PayrollStorage.savePeriodState(_companyId, _state);

        return true;
    }

    /**
     * Submit all committed runs: mark them as "submitted", create submission record, close period.
     * @returns {boolean} success
     */
    function performSubmit() {
        if (!_companyId || !_state) return false;
        _ensureFrequencyFields();
        if (_state.committedRunIds.length === 0) return false;

        // Mark all committed runs as submitted
        for (var i = 0; i < _state.committedRunIds.length; i++) {
            PayrollStorage.updateRunStatus(_companyId, _state.committedRunIds[i], 'submitted');
        }

        // Determine tax year and frequency from the runs
        var runs = PayrollStorage.loadPayrollRuns(_companyId);
        var firstCommitted = null;
        for (var j = 0; j < runs.length; j++) {
            if (runs[j].id === _state.committedRunIds[0]) {
                firstCommitted = runs[j];
                break;
            }
        }

        // Create submission record
        var submission = {
            id: PayrollStorage.generateId(),
            submissionId: 'PSR-' + Date.now(),
            status: 'ACCEPTED',
            employerRegistrationNumber: '1234567T',
            periodNumber: _state.currentPeriodNumber,
            submittedAt: new Date().toISOString(),
            timestamp: new Date().toISOString(),
            runIds: _state.committedRunIds.slice(),
            taxYear: firstCommitted ? firstCommitted.taxYear : '2026',
            payPeriod: firstCommitted && firstCommitted.runDate ? String(firstCommitted.taxYear || '2026') + '-' + String(new Date(firstCommitted.runDate).getMonth() + 1).padStart(2, '0') : '',
            frequency: firstCommitted ? firstCommitted.frequency : 'monthly',
            message: 'Payroll Submission accepted (FAKE)'
        };

        var submissions = PayrollStorage.loadSubmissions(_companyId);
        var runKey = _state.committedRunIds.join('|');
        var existingIndex = -1;
        for (var s = 0; s < submissions.length; s++) {
            if (Array.isArray(submissions[s].runIds) && submissions[s].runIds.join('|') === runKey) {
                existingIndex = s;
                break;
            }
        }
        if (existingIndex >= 0) {
            submission.id = submissions[existingIndex].id || submission.id;
            submission.submissionId = submissions[existingIndex].submissionId || submission.submissionId;
            submission.employerRegistrationNumber = submissions[existingIndex].employerRegistrationNumber || submission.employerRegistrationNumber;
            submission.summary = submissions[existingIndex].summary || submission.summary;
            submissions[existingIndex] = Object.assign({}, submissions[existingIndex], submission);
        } else {
            submissions.push(submission);
        }
        PayrollStorage.saveSubmissions(_companyId, submissions);

        // Mark state as submitted
        _state.status = 'submitted';
        PayrollStorage.savePeriodState(_companyId, _state);

        return true;
    }

    /**
     * Advance to the next payroll period after submission.
     * Resets commit counter and prepares for new period.
     */
    function advancePeriod() {
        if (!_companyId || !_state) return false;
        _ensureFrequencyFields();

        _state = {
            weekNumber: _state.weekNumber || 1,
            weekly: {
                periodNumber: _state.weekly ? _state.weekly.periodNumber : 1
            },
            fortnightly: {
                periodNumber: _state.fortnightly ? _state.fortnightly.periodNumber : 1,
                lastCommittedWeek: _state.fortnightly ? _state.fortnightly.lastCommittedWeek : 0
            },
            monthly: {
                periodNumber: _state.monthly ? _state.monthly.periodNumber : 1,
                lastCommittedWeek: _state.monthly ? _state.monthly.lastCommittedWeek : 0
            },
            currentPeriodNumber: _state.currentPeriodNumber + 1,
            commitCounter: 0,
            status: 'open',
            committedRunIds: [],
            rpnRetrievedForPeriod: false
        };

        PayrollStorage.savePeriodState(_companyId, _state);
        return true;
    }

    /**
     * Restore an earlier period state, used when rolling back a committed run.
     */
    function restorePeriodState(stateSnapshot) {
        if (!_companyId || !stateSnapshot) return false;
        _state = JSON.parse(JSON.stringify(stateSnapshot));
        _ensureFrequencyFields();
        PayrollStorage.savePeriodState(_companyId, _state);
        return true;
    }

    /**
     * Retrieve RPN (temporary solution):
     * Calculate remaining Tax Credits from submitted runs and update employee RPN fields.
     * @param {string} companyId
     * @returns {Object} results - { updated: number, employees: [...] }
     */
    function retrieveRPN(companyId) {
        var cid = companyId || _companyId;
        if (!cid) return { updated: 0, employees: [] };

        var employees = PayrollStorage.loadEmployees(cid);
        var runs = PayrollStorage.loadPayrollRuns(cid);
        var submittedRuns = runs.filter(function(r) { return r.status === 'submitted'; });

        var updated = 0;

        for (var i = 0; i < employees.length; i++) {
            var emp = employees[i];

            // Determine annual TC for this employee. Keep the original annual RPN
            // value separate from the retrieved remaining value so repeated
            // retrievals are idempotent.
            var annualTC = 0;
            if (emp.rpn && typeof emp.rpn.annualTaxCredits === 'number') {
                annualTC = emp.rpn.annualTaxCredits;
            } else if (emp.rpn && emp.rpn.taxCredits) {
                annualTC = parseFloat(emp.rpn.taxCredits) || 0;
            } else if (emp.taxCreditsMode === 'manual') {
                annualTC = parseFloat(emp.manualTaxCredits) || 0;
            } else {
                annualTC = _getDefaultAnnualTC(emp.familyStatus);
            }

            // Sum TC used across all submitted runs
            var totalTCUsed = 0;
            for (var j = 0; j < submittedRuns.length; j++) {
                var entries = submittedRuns[j].entries || [];
                for (var k = 0; k < entries.length; k++) {
                    if (entries[k].employeeId === emp.id) {
                        totalTCUsed += (entries[k].taxCreditsUsed || 0);
                    }
                }
            }

            // Calculate remaining
            var remaining = Math.max(annualTC - totalTCUsed, 0);

            // Update RPN
            if (!emp.rpn) {
                emp.rpn = {};
            }
            emp.rpn.annualTaxCredits = annualTC;
            emp.rpn.taxCredits = remaining;
            updated++;
        }

        // Save updated employees
        if (!PayrollStorage.saveEmployees(cid, employees)) {
            return { updated: 0, employees: employees, error: 'Failed to save employees' };
        }

        // Mark RPN as retrieved for this period
        if (_state) {
            _state.rpnRetrievedForPeriod = true;
            PayrollStorage.savePeriodState(cid, _state);
        }

        return { updated: updated, employees: employees };
    }

    /**
     * Mark RPN as retrieved without actually updating values (user clicked "No").
     */
    function dismissRPNSuggestion() {
        if (_state) {
            _state.rpnRetrievedForPeriod = true;
            PayrollStorage.savePeriodState(_companyId, _state);
        }
    }

    /**
     * Get all submitted runs for the current company.
     */
    function getSubmittedRuns() {
        if (!_companyId) return [];
        var runs = PayrollStorage.loadPayrollRuns(_companyId);
        return runs.filter(function(r) { return r.status === 'submitted'; });
    }

    /**
     * Get all committed (not submitted) runs for the current company.
     */
    function getCommittedRuns() {
        if (!_companyId) return [];
        var runs = PayrollStorage.loadPayrollRuns(_companyId);
        return runs.filter(function(r) { return r.status === 'committed'; });
    }

    /**
     * Helper: get default annual tax credits by family status.
     * Delegates to PayrollUtils (single source of truth) when available.
     */
    function _getDefaultAnnualTC(familyStatus) {
        if (typeof PayrollUtils !== 'undefined' && PayrollUtils.getDefaultAnnualTC) {
            return PayrollUtils.getDefaultAnnualTC(familyStatus);
        }
        var defaults = {
            'single': 4000,
            'married': 8000,
            'marriedOneWorking': 6000,
            'singleParent': 5900
        };
        return defaults[familyStatus] || 4000;
    }

    // --- Per-Frequency Helper Functions ---

    var FIRST_FORTNIGHTLY_DUE_WEEK = 24;

    /**
     * Returns the next fortnightly payroll week on the two-week schedule.
     * If no fortnightly payroll has been committed yet, the schedule starts at week 24.
     * @param {number} weekNumber - Current absolute week (1-53)
     * @param {number} lastCommittedWeek - Week number of last fortnightly commit
     * @returns {number}
     */
    function getNextFortnightlyDueWeek(weekNumber, lastCommittedWeek) {
        var current = parseInt(weekNumber, 10) || 1;
        var last = parseInt(lastCommittedWeek, 10) || 0;
        var nextDue = last > 0 ? last + 2 : FIRST_FORTNIGHTLY_DUE_WEEK;

        while (nextDue < current) {
            nextDue += 2;
        }
        return nextDue;
    }

    /**
     * Returns true when the current week is exactly on the fortnightly cadence.
     * @param {number} weekNumber - Current absolute week (1-53)
     * @param {number} lastCommittedWeek - Week number of last fortnightly commit
     * @returns {boolean}
     */
    function isFortnightlyDue(weekNumber, lastCommittedWeek) {
        var current = parseInt(weekNumber, 10) || 1;
        return current === getNextFortnightlyDueWeek(current, lastCommittedWeek);
    }

    /**
     * Standard ISO 8601 week number calculation.
     * @param {Date} date
     * @returns {number} ISO week number (1-53)
     */
    function getISOWeekNumber(date) {
        var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        var dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    /**
     * Returns array of ISO week numbers that contain the last day of each month.
     * @param {number} year - Full year (e.g. 2026)
     * @returns {number[]}
     */
    function getMonthEndWeeks(year) {
        var weeks = [];
        for (var month = 0; month < 12; month++) {
            var lastDay = new Date(year, month + 1, 0);
            var weekNum = getISOWeekNumber(lastDay);
            weeks.push(weekNum);
        }
        return weeks;
    }

    /**
     * Returns true if weekNumber is one of the month-end weeks for that year.
     * @param {number} weekNumber - Current absolute week (1-53)
     * @param {number|string} year - Tax year
     * @returns {boolean}
     */
    function isMonthlyDue(weekNumber, year) {
        var monthEndWeeks = getMonthEndWeeks(parseInt(year));
        return monthEndWeeks.indexOf(weekNumber) !== -1;
    }

    /**
     * Returns 52 or 53 depending on whether the year has 53 ISO weeks.
     * @param {number} year - Full year (e.g. 2026)
     * @returns {number}
     */
    function getWeeksInYear(year) {
        var dec31 = new Date(year, 11, 31);
        var jan1 = new Date(year, 0, 1);
        return (jan1.getDay() === 4 || dec31.getDay() === 4) ? 53 : 52;
    }

    /**
     * Advance per-frequency period counters after a successful commit.
     * Encapsulates state mutation so callers don't need direct access to _state.
     * @param {string[]} frequenciesIncluded - Array of frequency strings processed (e.g. ['weekly', 'monthly'])
     * @param {number} weekNumber - The calendar week number for this commit
     * @returns {boolean} success
     */
    function advanceFrequencyCounters(frequenciesIncluded, weekNumber) {
        if (!_companyId || !_state) return false;

        if (frequenciesIncluded.indexOf('weekly') !== -1) {
            _state.weekly.periodNumber = (_state.weekly.periodNumber || 1) + 1;
        }
        if (frequenciesIncluded.indexOf('fortnightly') !== -1) {
            _state.fortnightly.periodNumber = (_state.fortnightly.periodNumber || 1) + 1;
            _state.fortnightly.lastCommittedWeek = weekNumber;
        }
        if (frequenciesIncluded.indexOf('monthly') !== -1) {
            _state.monthly.periodNumber = (_state.monthly.periodNumber || 1) + 1;
            _state.monthly.lastCommittedWeek = weekNumber;
        }
        _state.weekNumber = weekNumber;

        PayrollStorage.savePeriodState(_companyId, _state);
        return true;
    }

    // --- Public API ---
    return {
        init: init,
        getState: getState,
        getCurrentPeriodNumber: getCurrentPeriodNumber,
        getCommitCount: getCommitCount,
        getCommittedRunIds: getCommittedRunIds,
        canCalculate: canCalculate,
        canCommit: canCommit,
        canRollback: canRollback,
        canSubmit: canSubmit,
        shouldSuggestRPN: shouldSuggestRPN,
        performCommit: performCommit,
        performRollback: performRollback,
        performSubmit: performSubmit,
        advancePeriod: advancePeriod,
        restorePeriodState: restorePeriodState,
        advanceFrequencyCounters: advanceFrequencyCounters,
        retrieveRPN: retrieveRPN,
        dismissRPNSuggestion: dismissRPNSuggestion,
        getSubmittedRuns: getSubmittedRuns,
        getCommittedRuns: getCommittedRuns,
        // Per-frequency helpers
        isFortnightlyDue: isFortnightlyDue,
        getNextFortnightlyDueWeek: getNextFortnightlyDueWeek,
        isMonthlyDue: isMonthlyDue,
        getMonthEndWeeks: getMonthEndWeeks,
        getISOWeekNumber: getISOWeekNumber,
        getWeeksInYear: getWeeksInYear
    };
})();
