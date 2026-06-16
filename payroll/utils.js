// payroll/utils.js — Shared utilities for the Payroll module
// Load this BEFORE employees.js, state-machine.js, and payroll.js

var PayrollUtils = (function() {
    'use strict';

    var deps = {};

    function init(dependencies) {
        deps = dependencies || {};
    }

    function getSelectedYear() {
        return typeof deps.getSelectedYear === 'function' ? deps.getSelectedYear() : '2026';
    }

    function getActiveTab() {
        return typeof deps.getActiveTab === 'function' ? deps.getActiveTab() : 'monthly';
    }

    /**
     * Escape HTML to prevent XSS in dynamic content.
     */
    function escapeHtml(text) {
        if (text == null) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format a number as Irish Euro currency.
     * Falls back to Intl if the global formatCurrency isn't available.
     */
    function safeFormatCurrency(amount) {
        if (typeof formatCurrency === 'function') {
            return formatCurrency(amount);
        }
        return new Intl.NumberFormat('en-IE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    }

    /**
     * Format a number to 2 decimal places (for CSV/Excel export).
     */
    function formatNumber(amount) {
        return (amount || 0).toFixed(2);
    }

    function csvNumber(amount) {
        return (amount || 0).toFixed(2);
    }

    function formatLocalDateTime(value) {
        if (!value) return '';
        var date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleString('en-IE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatLocalDateOnly(value) {
        if (!value) return '';
        var date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('en-IE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    function getPayFrequencyLabel(frequency) {
        if (frequency === 'weekly') return 'Weekly';
        if (frequency === 'fortnightly') return 'Fortnightly';
        return 'Monthly';
    }

    /**
     * Revenue-style week number for a calendar date (1-based, Jan 1 week = 1).
     */
    function getRevenueWeekNumberForDate(date) {
        var yearStart = new Date(date.getFullYear(), 0, 1);
        var dayIndex = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - yearStart) / 86400000);
        return Math.floor(dayIndex / 7) + 1;
    }

    function runHasTaxCreditsApplied(run) {
        var entries = run && run.entries ? run.entries : [];
        for (var i = 0; i < entries.length; i++) {
            if ((entries[i].taxCreditsUsed || 0) > 0) return true;
        }
        return false;
    }

    function getSubmissionSubmittedAtForRun(runId, submissions) {
        if (!runId || !submissions) return null;
        var latest = null;
        for (var i = 0; i < submissions.length; i++) {
            var submission = submissions[i];
            if (!submission || !Array.isArray(submission.runIds)) continue;
            if (submission.runIds.indexOf(runId) === -1) continue;
            var submittedAt = submission.submittedAt || submission.timestamp;
            if (!submittedAt) continue;
            if (!latest || new Date(submittedAt) > new Date(latest)) {
                latest = submittedAt;
            }
        }
        return latest;
    }

    /**
     * Latest timestamp for Tax Credits table "Last updated" (submission time preferred).
     */
    function getTaxCreditsLastUpdatedTimestamp(runs, submissions, year) {
        var submittedRunsWithTc = (runs || []).filter(function(run) {
            if (!run || run.status !== 'submitted') return false;
            if (year && run.taxYear && String(run.taxYear) !== String(year)) return false;
            return runHasTaxCreditsApplied(run);
        }).sort(function(a, b) {
            return new Date(b.runDate || 0) - new Date(a.runDate || 0);
        });

        if (submittedRunsWithTc.length === 0) return null;

        var latestRun = submittedRunsWithTc[0];
        return getSubmissionSubmittedAtForRun(latestRun.id, submissions) || latestRun.runDate || null;
    }

    /**
     * Default annual tax credits by family status (2025/2026 rates).
     * Single source of truth — do not duplicate elsewhere.
     */
    var DEFAULT_TAX_CREDITS = {
        'single': 4000,
        'married': 8000,
        'marriedOneWorking': 6000,
        'married_one': 6000,
        'married_two': 8000,
        'singleParent': 5900
    };

    /**
     * Default annual cut-off points (standard rate bands) by family status.
     * Single source of truth — do not duplicate elsewhere.
     */
    var DEFAULT_CUT_OFF_POINTS = {
        'single': 44000,
        'married': 88000,
        'marriedOneWorking': 53000,
        'married_one': 53000,
        'married_two': 88000,
        'singleParent': 48000
    };

    function getDefaultAnnualTC(familyStatus) {
        return DEFAULT_TAX_CREDITS[familyStatus] || 4000;
    }

    function getDefaultCutOffPoint(familyStatus) {
        return DEFAULT_CUT_OFF_POINTS[familyStatus] || 44000;
    }

    /**
     * Resolve the pay-period index for a submitted payroll entry (1..52/26/12).
     */
    function resolvePayPeriodNumber(entry, run, payFreq) {
        if (entry && entry.periodNumber !== undefined && entry.periodNumber !== null && entry.periodNumber !== '') {
            var fromEntry = parseInt(entry.periodNumber, 10);
            if (!isNaN(fromEntry)) return fromEntry;
        }
        if (run && run.periodNumbers && payFreq && run.periodNumbers[payFreq] !== undefined && run.periodNumbers[payFreq] !== null) {
            var fromRun = parseInt(run.periodNumbers[payFreq], 10);
            if (!isNaN(fromRun)) return fromRun;
        }
        if (payFreq === 'weekly') {
            if (run && run.weekNumber) {
                var fromWeek = parseInt(run.weekNumber, 10);
                if (!isNaN(fromWeek)) return fromWeek;
            }
            if (run && run.periodNumber) {
                var fromPeriod = parseInt(run.periodNumber, 10);
                if (!isNaN(fromPeriod)) return fromPeriod;
            }
        }
        return null;
    }

    /**
     * Latest submitted pay-period number for an employee (matches payslip/history logic).
     */
    function getLatestSubmittedPayPeriodNumber(employeeId, payFreq, submittedRuns) {
        var items = [];
        (submittedRuns || []).forEach(function(run) {
            var entry = (run.entries || []).find(function(e) { return e.employeeId === employeeId; });
            if (!entry) return;
            var runFreq = entry.payFrequency || run.frequency || 'monthly';
            if (runFreq !== payFreq) return;
            items.push({ entry: entry, run: run });
        });

        items.sort(function(a, b) {
            return new Date(a.run.runDate) - new Date(b.run.runDate);
        });

        var legacySeq = 0;
        var latestPeriod = 0;
        items.forEach(function(item) {
            var period = resolvePayPeriodNumber(item.entry, item.run, payFreq);
            if (period == null) {
                legacySeq += 1;
                period = legacySeq;
            }
            item.resolvedPeriod = period;
        });

        if (items.length > 0) {
            latestPeriod = items[items.length - 1].resolvedPeriod;
        }

        return latestPeriod;
    }

    /**
     * Local mode: estimated periodic tax credit for the next payroll period.
     * Unused allocation from prior submitted periods stays in remaining and is
     * spread over future periods still left in the tax year.
     */
    function getLocalPeriodicTaxCredit(remainingAnnualTC, periodsPerYear, submittedPeriodCount) {
        var remaining = parseFloat(remainingAnnualTC) || 0;
        var periods = parseInt(periodsPerYear, 10) || 52;
        var used = parseInt(submittedPeriodCount, 10) || 0;
        var periodsLeft = Math.max(periods - used, 1);
        return remaining / periodsLeft;
    }

    /**
     * Build rows for Remaining Tax Credits (Submitted Periods) table.
     * appliedByPeriod: 1-based period index -> actual TC used on submitted payroll.
     *
     * Est. Credit/Period is flat across all remaining due periods until the next
     * submitted payroll changes the annual balance (including zero TC used).
     */
    function computeRemainingTaxCreditSchedule(annualTC, periodsPerYear, appliedByPeriod) {
        var rows = [];
        var remainingTC = parseFloat(annualTC) || 0;
        var periods = parseInt(periodsPerYear, 10) || 52;
        var applied = appliedByPeriod || {};
        var submittedCount = 0;
        var currentEst = getLocalPeriodicTaxCredit(remainingTC, periods, submittedCount);

        for (var p = 1; p <= periods; p++) {
            var committed = Object.prototype.hasOwnProperty.call(applied, p);
            var annualAtStart = remainingTC;
            var estCreditPerPeriod = currentEst;
            var tcApplied = committed ? (parseFloat(applied[p]) || 0) : null;
            var creditLeftAfter = null;

            if (committed) {
                creditLeftAfter = annualAtStart - tcApplied;
                remainingTC = creditLeftAfter;
                submittedCount += 1;
                currentEst = getLocalPeriodicTaxCredit(remainingTC, periods, submittedCount);
            }

            rows.push({
                period: p,
                annualAtStart: annualAtStart,
                estCreditPerPeriod: estCreditPerPeriod,
                tcApplied: tcApplied,
                creditLeftAfter: creditLeftAfter,
                committed: committed
            });
        }

        return rows;
    }

    /**
     * Local mode: periodic standard-rate band (COP) on a week-1/month-1 basis.
     * Each period receives a fixed slice of the annual COP; unused remainder does
     * not roll forward to later periods.
     */
    function getLocalPeriodicCOP(annualCOP, periodsPerYear) {
        var annual = parseFloat(annualCOP) || 0;
        var periods = parseInt(periodsPerYear, 10) || 52;
        return annual / periods;
    }

    function getCopUsedStatus(grossWages, periodicCop) {
        var gross = parseFloat(grossWages) || 0;
        var cop = parseFloat(periodicCop) || 0;
        return gross >= cop ? 'used in full' : 'underused';
    }

    /**
     * Build rows for Remaining Cut-Off Point (Submitted Periods) table.
     * grossByPeriod: 1-based period index -> gross wages on submitted payroll.
     *
     * Annual COP is constant for every row. Periodic COP stays fixed (week-1 basis).
     * Used status compares gross wages against the periodic COP slice.
     */
    function computeRemainingCOPSchedule(annualCOP, periodsPerYear, grossByPeriod, periodicCopOverride) {
        var rows = [];
        var fullAnnual = parseFloat(annualCOP) || 0;
        var periods = parseInt(periodsPerYear, 10) || 52;
        var grossMap = grossByPeriod || {};
        var fixedPeriodicCop = periodicCopOverride != null && periodicCopOverride !== ''
            ? (parseFloat(periodicCopOverride) || 0)
            : getLocalPeriodicCOP(fullAnnual, periods);

        for (var p = 1; p <= periods; p++) {
            var committed = Object.prototype.hasOwnProperty.call(grossMap, p);
            var grossWages = committed ? (parseFloat(grossMap[p]) || 0) : null;
            var usedStatus = committed ? getCopUsedStatus(grossWages, fixedPeriodicCop) : null;

            rows.push({
                period: p,
                annualCOP: fullAnnual,
                periodicCop: fixedPeriodicCop,
                grossWages: grossWages,
                usedStatus: usedStatus,
                committed: committed
            });
        }

        return rows;
    }

    function toFiniteNumber(value, fallback) {
        var parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : (fallback || 0);
    }

    function getPeriodsPerYearForFrequency(frequency) {
        if (frequency === 'weekly') return 52;
        if (frequency === 'fortnightly') return 26;
        return 12;
    }

    function getCompanyPayDay(company) {
        return (company && company.payDate) || 'friday';
    }

    function getPayDayLabel(payDay) {
        var labels = {
            monday: 'Monday',
            tuesday: 'Tuesday',
            wednesday: 'Wednesday',
            thursday: 'Thursday',
            friday: 'Friday'
        };
        return labels[payDay] || labels.friday;
    }

    function getPayDayJsIndex(payDay) {
        var indexes = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5 };
        return indexes[payDay] || 5;
    }

    function getNextPayDate(fromDate, payDay) {
        var date = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        var targetDay = getPayDayJsIndex(payDay);
        var diff = (targetDay - date.getDay() + 7) % 7;
        date.setDate(date.getDate() + diff);
        return date;
    }

    function getPayDateForRevenueWeek(year, weekNumber, payDay) {
        var week = Math.max(1, parseInt(weekNumber, 10) || 1);
        var blockStart = new Date(year, 0, 1 + ((week - 1) * 7));
        var targetDay = getPayDayJsIndex(payDay);
        var offset = (targetDay - blockStart.getDay() + 7) % 7;
        var payDate = new Date(blockStart.getFullYear(), blockStart.getMonth(), blockStart.getDate());
        payDate.setDate(blockStart.getDate() + offset);
        return payDate;
    }

    function getMonthlyPayrollPeriodForPayDate(payDate) {
        var monthIndex = payDate.getMonth();
        var previousPayDate = new Date(payDate.getFullYear(), payDate.getMonth(), payDate.getDate());
        previousPayDate.setDate(previousPayDate.getDate() - 7);
        var nextPayDate = new Date(payDate.getFullYear(), payDate.getMonth(), payDate.getDate());
        nextPayDate.setDate(nextPayDate.getDate() + 7);
        var isFirstPayPeriodInMonth = previousPayDate.getMonth() !== monthIndex;
        var isLastPayPeriodInDecember = monthIndex === 11 && nextPayDate.getMonth() !== 11;

        if (isLastPayPeriodInDecember) return 12;
        if (isFirstPayPeriodInMonth && monthIndex >= 1) return monthIndex;
        return null;
    }

    function getNextMonthlyPayrollEvent(payDate) {
        var date = new Date(payDate.getFullYear(), payDate.getMonth(), payDate.getDate());
        for (var i = 0; i < 60; i++) {
            date.setDate(date.getDate() + 7);
            var monthlyPeriod = getMonthlyPayrollPeriodForPayDate(date);
            if (monthlyPeriod) {
                return {
                    payDate: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
                    monthlyPeriod: monthlyPeriod
                };
            }
        }
        return null;
    }

    function formatDateInputValue(date) {
        return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }

    function getPeriodContextFromPayDate(payDate) {
        var weeklyPeriod = getRevenueWeekNumberForDate(payDate);
        var monthlyPayrollPeriod = getMonthlyPayrollPeriodForPayDate(payDate);
        var nextMonthlyEvent = getNextMonthlyPayrollEvent(payDate);
        return {
            payDate: payDate,
            payDateIso: formatDateInputValue(payDate),
            payDateDisplay: payDate.toLocaleDateString('en-IE'),
            weeklyPeriod: weeklyPeriod,
            fortnightlyPeriod: Math.ceil(weeklyPeriod / 2),
            monthlyPeriod: monthlyPayrollPeriod || (payDate.getMonth() + 1),
            monthlyPayrollPeriod: monthlyPayrollPeriod,
            nextMonthlyPayrollEvent: nextMonthlyEvent,
            weeksInYear: weeklyPeriod > 52 ? 53 : 52
        };
    }

    function getCurrentPayPeriodContext() {
        var company = PayrollContext.currentCompanyId ? PayrollStorage.getCompany(PayrollContext.currentCompanyId) : null;
        var payDay = getCompanyPayDay(company);
        var todayContext = getPeriodContextFromPayDate(getNextPayDate(new Date(), payDay));
        var smState = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.getState() : null;
        var stateWeek = smState ? (parseInt(smState.weekNumber, 10) || 0) : 0;
        var year = parseInt(getSelectedYear(), 10) || new Date().getFullYear();
        var payDate = stateWeek > todayContext.weeklyPeriod
            ? getPayDateForRevenueWeek(year, stateWeek, payDay)
            : todayContext.payDate;
        return getPeriodContextFromPayDate(payDate);
    }

    function getPeriodNumberForFrequency(frequency, periodContext) {
        if (frequency === 'weekly') return periodContext.weeklyPeriod;
        if (frequency === 'fortnightly') return periodContext.fortnightlyPeriod;
        return periodContext.monthlyPeriod;
    }

    function isFrequencyDueForContext(frequency, periodContext, smState) {
        if (frequency === 'weekly') return true;
        if (frequency === 'fortnightly') {
            var lastFortnight = smState && smState.fortnightly
                ? (parseInt(smState.fortnightly.lastCommittedPeriod, 10) || Math.ceil((parseInt(smState.fortnightly.lastCommittedWeek, 10) || 0) / 2))
                : 0;
            return periodContext.fortnightlyPeriod > lastFortnight;
        }
        if (frequency === 'monthly') {
            var monthlyPeriod = periodContext.monthlyPayrollPeriod || 0;
            if (!monthlyPeriod) return false;
            var lastMonth = smState && smState.monthly
                ? (parseInt(smState.monthly.lastCommittedMonth, 10) || 0)
                : 0;
            return monthlyPeriod > lastMonth;
        }
        return true;
    }

    function generatePeriodLabel(periodContext) {
        var ctx = periodContext || getCurrentPayPeriodContext();
        var now = ctx.payDate || new Date();
        var config = typeof window.getCurrentPeriodConfig === 'function'
            ? window.getCurrentPeriodConfig()
            : { label: 'Monthly' };
        var tab = getActiveTab();

        if (tab === 'monthly') {
            var months = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
            return months[now.getMonth()] + ' ' + now.getFullYear() + ' (' + config.label + ')';
        } else if (tab === 'weekly') {
            return 'Week ' + ctx.weeklyPeriod + ', ' + now.getFullYear();
        } else if (tab === 'fortnightly') {
            return 'Fortnight ' + ctx.fortnightlyPeriod + ', ' + now.getFullYear();
        } else {
            return now.getFullYear() + ' (' + config.label + ')';
        }
    }

    function getCurrentPeriodVar() {
        var periodVar = 'selected' + getSelectedYear() + 'Period';
        return typeof window[periodVar] !== 'undefined' ? window[periodVar] : 'jan-sep';
    }

    // --- Public API ---
    return {
        init: init,
        escapeHtml: escapeHtml,
        safeFormatCurrency: safeFormatCurrency,
        formatNumber: formatNumber,
        csvNumber: csvNumber,
        formatLocalDateTime: formatLocalDateTime,
        formatLocalDateOnly: formatLocalDateOnly,
        getPayFrequencyLabel: getPayFrequencyLabel,
        getRevenueWeekNumberForDate: getRevenueWeekNumberForDate,
        runHasTaxCreditsApplied: runHasTaxCreditsApplied,
        getSubmissionSubmittedAtForRun: getSubmissionSubmittedAtForRun,
        getTaxCreditsLastUpdatedTimestamp: getTaxCreditsLastUpdatedTimestamp,
        getDefaultAnnualTC: getDefaultAnnualTC,
        getDefaultCutOffPoint: getDefaultCutOffPoint,
        resolvePayPeriodNumber: resolvePayPeriodNumber,
        getLatestSubmittedPayPeriodNumber: getLatestSubmittedPayPeriodNumber,
        getLocalPeriodicTaxCredit: getLocalPeriodicTaxCredit,
        computeRemainingTaxCreditSchedule: computeRemainingTaxCreditSchedule,
        getLocalPeriodicCOP: getLocalPeriodicCOP,
        getCopUsedStatus: getCopUsedStatus,
        computeRemainingCOPSchedule: computeRemainingCOPSchedule,
        toFiniteNumber: toFiniteNumber,
        getPeriodsPerYearForFrequency: getPeriodsPerYearForFrequency,
        getCompanyPayDay: getCompanyPayDay,
        getPayDayLabel: getPayDayLabel,
        getPayDayJsIndex: getPayDayJsIndex,
        getNextPayDate: getNextPayDate,
        getPayDateForRevenueWeek: getPayDateForRevenueWeek,
        getMonthlyPayrollPeriodForPayDate: getMonthlyPayrollPeriodForPayDate,
        getNextMonthlyPayrollEvent: getNextMonthlyPayrollEvent,
        getPeriodContextFromPayDate: getPeriodContextFromPayDate,
        getCurrentPayPeriodContext: getCurrentPayPeriodContext,
        getPeriodNumberForFrequency: getPeriodNumberForFrequency,
        isFrequencyDueForContext: isFrequencyDueForContext,
        formatDateInputValue: formatDateInputValue,
        generatePeriodLabel: generatePeriodLabel,
        getCurrentPeriodVar: getCurrentPeriodVar,
        DEFAULT_TAX_CREDITS: DEFAULT_TAX_CREDITS,
        DEFAULT_CUT_OFF_POINTS: DEFAULT_CUT_OFF_POINTS
    };
})();
