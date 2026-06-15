// payroll/payroll.js — Core Payroll App Orchestration (Multi-Company)
// Depends on: calculator-core.js, storage.js, employees.js

const PayrollApp = (function() {
    'use strict';

    // --- State (shared via PayrollContext) ---
    function getCurrentRunData() { return PayrollContext.currentRunData; }
    function setCurrentRunData(value) { PayrollContext.currentRunData = value; }
    function getPayslipReturnTab() { return PayrollContext.payslipReturnTab; }
    function setPayslipReturnTab(value) { PayrollContext.payslipReturnTab = value; }

    // --- Constants ---
    const FAMILY_STATUS_LABELS = {
        single: 'Single',
        married: 'Married',
        marriedOneWorking: 'Married One Working',
        singleParent: 'Single Parent',
        custom: 'Custom Tax Credit',
        manual: 'Manual'
    };

    function isCustomTaxStatus(emp) {
        return !!emp && (emp.familyStatus === 'custom' || emp.taxCreditsMode === 'manual');
    }

    function getCurrentCompanyMode() {
        const company = getCurrentCompany();
        if (typeof PayrollMode !== 'undefined') {
            return PayrollMode.getMode(company);
        }
        return company && company.payrollMode === 'cloud' ? 'cloud' : 'local';
    }

    function isCloudMode() {
        return getCurrentCompanyMode() === 'cloud';
    }

    function isLocalMode() {
        return !isCloudMode();
    }

    function shouldUseRPN(employee) {
        return isCloudMode() && hasValidRPN(employee);
    }

    function getEmployeeAnnualTaxCredits(emp) {
        if (!emp) return getDefaultAnnualTC('single');

        if (isLocalMode()) {
            if (isCustomTaxStatus(emp)) return parseFloat(emp.manualTaxCredits) || 0;
            return getDefaultAnnualTC(emp.familyStatus || 'single');
        }

        if (hasValidRPN(emp)) {
            if (emp.rpn.annualTaxCredits !== undefined) return parseFloat(emp.rpn.annualTaxCredits) || 0;
            if (emp.rpn.taxCredits !== undefined) return parseFloat(emp.rpn.taxCredits) || 0;
        }
        if (isCustomTaxStatus(emp)) return parseFloat(emp.manualTaxCredits) || 0;
        return getDefaultAnnualTC(emp.familyStatus || 'single');
    }

    function getEmployeeCutOffPoint(emp) {
        if (!emp) return getDefaultCutOffPoint('single');

        if (isLocalMode()) {
            if (isCustomTaxStatus(emp) && emp.manualCutOffPoint) return parseFloat(emp.manualCutOffPoint) || 0;
            return getDefaultCutOffPoint(emp.familyStatus || 'single');
        }

        if (hasValidRPN(emp) && emp.rpn.cutOffPoint !== undefined) return parseFloat(emp.rpn.cutOffPoint) || 0;
        if (isCustomTaxStatus(emp) && emp.manualCutOffPoint) return parseFloat(emp.manualCutOffPoint) || 0;
        return getDefaultCutOffPoint(emp.familyStatus || 'single');
    }

    function getEmployeeTaxSource(emp) {
        if (isLocalMode()) {
            return isCustomTaxStatus(emp) ? 'manual' : 'automatic';
        }
        if (hasValidRPN(emp)) return 'rpn';
        return isCustomTaxStatus(emp) ? 'manual' : 'automatic';
    }

    function hasValidRPN(employee) {
        return !!(employee && employee.rpn && employee.rpn.rpnNumber);
    }

    function getPayrollStateSafe() {
        if (typeof PayrollStateMachine !== 'undefined' && PayrollStateMachine.getState) {
            return PayrollStateMachine.getState();
        }
        return {
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

    function toFiniteNumber(value, fallback) {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : (fallback || 0);
    }

    function getEmployeePayFrequency(emp) {
        return (emp && emp.payFrequency) || 'monthly';
    }

    function countSubmittedPayrollPeriodsForEmployee(employeeId, taxYear) {
        if (!PayrollContext.currentCompanyId || !employeeId) return 0;
        const runs = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];
        const year = taxYear || selectedYear;
        return runs.filter(function(run) {
            if (run.status !== 'submitted') return false;
            if (year && run.taxYear && String(run.taxYear) !== String(year)) return false;
            return (run.entries || []).some(function(entry) { return entry.employeeId === employeeId; });
        }).length;
    }

    function getEmployeeSubmittedPeriodProgress(emp, taxYear) {
        var empFreq = getEmployeePayFrequency(emp);
        var total = getPeriodsPerYearForFrequency(empFreq);
        var latestPeriod = 0;
        if (PayrollContext.currentCompanyId && typeof PayrollUtils !== 'undefined' && PayrollUtils.getLatestSubmittedPayPeriodNumber) {
            var submittedRuns = (PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || []).filter(function(run) {
                if (run.status !== 'submitted') return false;
                if (taxYear && run.taxYear && String(run.taxYear) !== String(taxYear)) return false;
                return true;
            });
            latestPeriod = PayrollUtils.getLatestSubmittedPayPeriodNumber(emp.id, empFreq, submittedRuns);
        }
        return { latestPeriod: latestPeriod, total: total, frequency: empFreq };
    }

    function getEmployeePeriodCOP(annualCOP, emp) {
        var periods = getPeriodsPerYearForFrequency(getEmployeePayFrequency(emp));
        if (typeof PayrollUtils !== 'undefined' && PayrollUtils.getLocalPeriodicCOP) {
            return PayrollUtils.getLocalPeriodicCOP(annualCOP, periods);
        }
        return (parseFloat(annualCOP) || 0) / periods;
    }

    function getTaxSourceDescription(source) {
        if (source === 'rpn') {
            return 'Annual TC and COP were loaded from the employee\'s Revenue Payroll Notification (cloud mode).';
        }
        if (source === 'manual') {
            return 'Annual TC and COP were entered manually on the employee card (custom tax status).';
        }
        return 'Annual TC and COP use the preset values for the employee\'s family status.';
    }

    function getPeriodsPerYearForFrequency(frequency) {
        if (frequency === 'weekly') return 52;
        if (frequency === 'fortnightly') return 26;
        return 12;
    }

    function getWeek1PeriodicCOPAllocation(cutOffPoint, employee) {
        var annualCOP = parseFloat(cutOffPoint) || 0;
        var periods = getPeriodsPerYearForFrequency(getEmployeePayFrequency(employee));
        if (typeof PayrollUtils !== 'undefined' && PayrollUtils.getLocalPeriodicCOP) {
            return PayrollUtils.getLocalPeriodicCOP(annualCOP, periods);
        }
        return annualCOP / periods;
    }

    function getPeriodicAnnualGross(emp) {
        var annualGross = toFiniteNumber(emp && emp.annualGross, 0);
        return annualGross / getPeriodsPerYearForFrequency(getEmployeePayFrequency(emp));
    }

    function getPayFrequencyLabel(frequency) {
        if (typeof PayrollUtils !== 'undefined' && PayrollUtils.getPayFrequencyLabel) {
            return PayrollUtils.getPayFrequencyLabel(frequency);
        }
        if (frequency === 'weekly') return 'Weekly';
        if (frequency === 'fortnightly') return 'Fortnightly';
        return 'Monthly';
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

    function getRevenueWeekNumberForDate(date) {
        if (typeof PayrollUtils !== 'undefined' && PayrollUtils.getRevenueWeekNumberForDate) {
            return PayrollUtils.getRevenueWeekNumberForDate(date);
        }
        var yearStart = new Date(date.getFullYear(), 0, 1);
        var dayIndex = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - yearStart) / 86400000);
        return Math.floor(dayIndex / 7) + 1;
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
        var year = parseInt(selectedYear, 10) || new Date().getFullYear();
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

    function formatDateInputValue(date) {
        return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }

    function calculateNormalPAYE(grossPay, rpn) {
        const taxCredit = parseFloat(rpn.periodicTaxCredit) || 0;
        const cop = parseFloat(rpn.periodicStandardRateCutOffPoint) || 0;
        const taxableAt20 = Math.min(grossPay, cop);
        const taxableAt40 = Math.max(0, grossPay - cop);
        const taxAt20 = taxableAt20 * 0.2;
        const taxAt40 = taxableAt40 * 0.4;
        const taxBeforeCredit = taxAt20 + taxAt40;
        const paye = Math.max(0, taxBeforeCredit - taxCredit);

        return {
            mode: 'NORMAL',
            paye: parseFloat(paye.toFixed(2)),
            taxCreditUsed: Math.min(taxCredit, taxBeforeCredit),
            copUsed: cop,
            source: 'RPN',
            taxableAt20: taxableAt20,
            taxableAt40: taxableAt40,
            taxAt20: taxAt20,
            taxAt40: taxAt40,
            taxBeforeCredit: taxBeforeCredit
        };
    }

    function calculateEmergencyPAYE(grossPay, weeksOnEmergency, hasPPSN, totalPeriodsInYear) {
        if (!hasPPSN) {
            return {
                mode: 'EMERGENCY_NO_PPSN',
                paye: parseFloat((grossPay * 0.4).toFixed(2)),
                taxCreditUsed: 0,
                copUsed: 0,
                source: 'Emergency Rules (No PPSN)',
                taxableAt20: 0,
                taxableAt40: grossPay,
                taxAt20: 0,
                taxAt40: grossPay * 0.4,
                taxBeforeCredit: grossPay * 0.4
            };
        }

        const periodWeeks = totalPeriodsInYear ? 52 / totalPeriodsInYear : 1;
        const singlePersonPeriodCOP = (getDefaultCutOffPoint('single') / 52) * periodWeeks;

        if ((weeksOnEmergency || 0) <= 4) {
            const taxableAt20 = Math.min(grossPay, singlePersonPeriodCOP);
            const taxableAt40 = Math.max(0, grossPay - singlePersonPeriodCOP);
            const taxAt20 = taxableAt20 * 0.2;
            const taxAt40 = taxableAt40 * 0.4;
            return {
                mode: 'EMERGENCY_WEEKS_1_4',
                paye: parseFloat((taxAt20 + taxAt40).toFixed(2)),
                taxCreditUsed: 0,
                copUsed: singlePersonPeriodCOP,
                source: 'Emergency Rules (Weeks 1-4)',
                taxableAt20: taxableAt20,
                taxableAt40: taxableAt40,
                taxAt20: taxAt20,
                taxAt40: taxAt40,
                taxBeforeCredit: taxAt20 + taxAt40
            };
        }

        return {
            mode: 'EMERGENCY_WEEK_5_PLUS',
            paye: parseFloat((grossPay * 0.4).toFixed(2)),
            taxCreditUsed: 0,
            copUsed: 0,
            source: 'Emergency Rules (Week 5+)',
            taxableAt20: 0,
            taxableAt40: grossPay,
            taxAt20: 0,
            taxAt40: grossPay * 0.4,
            taxBeforeCredit: grossPay * 0.4
        };
    }

    function calculatePAYE(employee, grossPay, weeksOnEmergency = 0, totalPeriodsInYear) {
        const periods = totalPeriodsInYear || 52;

        if (shouldUseRPN(employee)) {
            const rpn = employee.rpn || {};
            return calculateNormalPAYE(grossPay, {
                periodicTaxCredit: rpn.periodicTaxCredit || (getEmployeeAnnualTaxCredits(employee) / periods),
                periodicStandardRateCutOffPoint: rpn.periodicStandardRateCutOffPoint || (getEmployeeCutOffPoint(employee) / periods)
            });
        }

        if (isLocalMode()) {
            const ledgerEntry = PayrollContext.currentCompanyId
                ? PayrollStorage.getEmployeeLedgerEntry(PayrollContext.currentCompanyId, employee.id, selectedYear)
                : null;
            const annualTC = ledgerEntry && ledgerEntry.remaining > 0
                ? ledgerEntry.remaining
                : getEmployeeAnnualTaxCredits(employee);
            const annualCOP = ledgerEntry && ledgerEntry.cutOffPoint > 0
                ? ledgerEntry.cutOffPoint
                : getEmployeeCutOffPoint(employee);
            const submittedPeriods = countSubmittedPayrollPeriodsForEmployee(employee.id, selectedYear);
            const periodicTaxCredit = typeof PayrollUtils !== 'undefined' && PayrollUtils.getLocalPeriodicTaxCredit
                ? PayrollUtils.getLocalPeriodicTaxCredit(annualTC, periods, submittedPeriods)
                : annualTC / Math.max(periods - submittedPeriods, 1);
            const periodicCOP = typeof PayrollUtils !== 'undefined' && PayrollUtils.getLocalPeriodicCOP
                ? PayrollUtils.getLocalPeriodicCOP(annualCOP, periods)
                : annualCOP / periods;

            return calculateNormalPAYE(grossPay, {
                periodicTaxCredit: periodicTaxCredit,
                periodicStandardRateCutOffPoint: periodicCOP
            });
        }

        return calculateEmergencyPAYE(grossPay, weeksOnEmergency, !!(employee && employee.ppsNumber), periods);
    }

    function getDefaultAnnualTC(familyStatus) {
        return PayrollUtils.getDefaultAnnualTC(familyStatus);
    }

    function getDefaultCutOffPoint(familyStatus) {
        return PayrollUtils.getDefaultCutOffPoint(familyStatus);
    }

    function initOrSyncLedger(companyId, year) {
        var ledger = PayrollStorage.loadTaxCreditsLedger(companyId);
        var employees = PayrollStorage.loadEmployees(companyId) || [];

        for (var i = 0; i < employees.length; i++) {
            var emp = employees[i];
            if (!ledger[emp.id]) {
                ledger[emp.id] = {};
            }
            if (!ledger[emp.id][year]) {
                // Resolve annualTaxCredits
                var annualTaxCredits, cutOffPoint, source;
                annualTaxCredits = getEmployeeAnnualTaxCredits(emp);
                source = getEmployeeTaxSource(emp);
                cutOffPoint = getEmployeeCutOffPoint(emp);

                ledger[emp.id][year] = {
                    annualTaxCredits: annualTaxCredits,
                    taxCreditsUsed: 0,
                    remaining: annualTaxCredits,
                    cutOffPoint: cutOffPoint,
                    copUsed: 0,
                    copRemaining: cutOffPoint,
                    source: source,
                    lastUpdated: new Date().toISOString()
                };
            } else {
                // Entry exists — re-resolve annual values but preserve used counters
                var entry = ledger[emp.id][year];
                var newAnnualTC, newCOP, newSource;
                newAnnualTC = getEmployeeAnnualTaxCredits(emp);
                newSource = getEmployeeTaxSource(emp);
                newCOP = getEmployeeCutOffPoint(emp);

                entry.annualTaxCredits = newAnnualTC;
                entry.cutOffPoint = newCOP;
                entry.source = newSource;
                entry.remaining = newAnnualTC - (entry.taxCreditsUsed || 0);
                entry.copRemaining = newCOP - (entry.copUsed || 0);
                entry.lastUpdated = new Date().toISOString();
            }
        }

        PayrollStorage.saveTaxCreditsLedger(companyId, ledger);
        return ledger;
    }

    function companyHasPayrollData(companyId) {
        const employees = PayrollStorage.loadEmployees(companyId) || [];
        const runs = PayrollStorage.loadPayrollRuns(companyId) || [];
        return employees.length > 0 || runs.length > 0;
    }

    function getModeBadgeHtml(company, slotIndex) {
        const mode = company && company.payrollMode;
        if (!mode && slotIndex === 2) {
            return '<span class="company-mode-badge mode-unset">Choose mode</span>';
        }
        const label = mode === 'cloud' ? 'Cloud' : 'Local';
        const css = mode === 'cloud' ? 'mode-cloud' : 'mode-local';
        return '<span class="company-mode-badge ' + css + '">' + label + '</span>';
    }

    function applyModeToUI() {
        const mode = getCurrentCompanyMode();
        const localBtn = document.getElementById('btn-mode-local');
        const cloudBtn = document.getElementById('btn-mode-cloud');
        const description = document.getElementById('payroll-mode-description');
        const hint = document.getElementById('payroll-mode-hint');

        if (localBtn) localBtn.classList.toggle('active', mode === 'local');
        if (cloudBtn) cloudBtn.classList.toggle('active', mode === 'cloud');

        if (description) {
            description.textContent = mode === 'cloud'
                ? 'RPN retrieval and Revenue submission via simulated server'
                : 'Manual annual tax credits/COP with local backup';
        }

        if (hint) {
            hint.textContent = mode === 'cloud'
                ? 'Start fake Revenue server on port 3001, retrieve RPN, then commit and submit payroll.'
                : 'Enter custom tax credits/COP where needed. RPN and Revenue submission are hidden in local mode.';
        }

        const workspaceNav = document.getElementById('workspace-nav');
        if (workspaceNav) {
            workspaceNav.querySelectorAll('.tab-btn').forEach(function(btn) {
                const tab = btn.dataset.tab;
                const hideInLocal = tab === 'rpn' || tab === 'submission';
                btn.classList.toggle('nav-tab-hidden', mode === 'local' && hideInLocal);
            });
        }

        const submissionActions = document.querySelector('.submission-actions');
        if (submissionActions) {
            submissionActions.style.display = mode === 'cloud' ? '' : 'none';
        }
    }

    function persistPayrollMode(mode) {
        if (!PayrollContext.currentCompanyId) return false;
        return PayrollStorage.updateCompany(PayrollContext.currentCompanyId, { payrollMode: mode });
    }

    function requestPayrollModeChange(mode) {
        if (!PayrollContext.currentCompanyId || mode === getCurrentCompanyMode()) return;

        const hasData = companyHasPayrollData(PayrollContext.currentCompanyId);
        const smState = typeof PayrollStateMachine !== 'undefined' ? PayrollStateMachine.getState() : null;
        const hasOpenCommits = smState && smState.commitCounter > 0;

        function applyMode() {
            if (!persistPayrollMode(mode)) {
                showMessage('Failed to update payroll mode.', 'error');
                return;
            }
            applyModeToUI();
            initOrSyncLedger(PayrollContext.currentCompanyId, selectedYear);
            syncAllTables();
            if (mode === 'local' && document.getElementById('panel-rpn')?.classList.contains('active')) {
                switchTab('employees');
            }
            if (mode === 'local' && document.getElementById('panel-submission')?.classList.contains('active')) {
                switchTab('run');
            }
            showMessage('Switched to ' + (mode === 'cloud' ? 'Cloud' : 'Local') + ' mode.', 'success');
        }

        if (!hasData && !hasOpenCommits) {
            applyMode();
            return;
        }

        const warning = mode === 'cloud'
            ? 'Existing payroll data stays in this browser. You will use RPN retrieval and Revenue submission instead of manual-only tax credits.'
            : 'RPN data will be ignored for calculations. Manual tax credits/COP and backup/import remain available.';

        showConfirmModal(warning, applyMode, {
            title: mode === 'cloud' ? 'Switch to Cloud mode' : 'Switch to Local mode',
            variant: 'primary'
        });
    }

    function bindPayrollModeControls() {
        const localBtn = document.getElementById('btn-mode-local');
        const cloudBtn = document.getElementById('btn-mode-cloud');

        if (localBtn) {
            localBtn.onclick = function() {
                requestPayrollModeChange('local');
            };
        }
        if (cloudBtn) {
            cloudBtn.onclick = function() {
                requestPayrollModeChange('cloud');
            };
        }
    }

    function promptInitialModeSelection(companyId, onComplete) {
        const modal = document.createElement('div');
        modal.className = 'payroll-action-modal active';
        modal.innerHTML =
            '<div class="payroll-action-modal-content">' +
            '<h3>Choose Payroll Mode</h3>' +
            '<p>Select how this company should handle tax credits and Revenue integration.</p>' +
            '<div class="payroll-mode-prompt-actions">' +
            '<button type="button" class="btn btn-secondary" id="choose-mode-local">Local – Manual TC/COP</button>' +
            '<button type="button" class="btn btn-primary" id="choose-mode-cloud">Cloud – RPN &amp; Submission</button>' +
            '</div>' +
            '</div>';

        document.body.appendChild(modal);

        function choose(mode) {
            PayrollStorage.updateCompany(companyId, { payrollMode: mode });
            document.body.removeChild(modal);
            if (typeof onComplete === 'function') onComplete();
        }

        modal.querySelector('#choose-mode-local').onclick = function() { choose('local'); };
        modal.querySelector('#choose-mode-cloud').onclick = function() { choose('cloud'); };
    }

    function stripRpnForLocalMode(employees) {
        return employees.map(function(emp) {
            const clone = Object.assign({}, emp);
            if (clone.rpn) {
                const rpn = Object.assign({}, clone.rpn);
                delete rpn.rpnNumber;
                delete rpn.annualTaxCredits;
                delete rpn.taxCredits;
                delete rpn.cutOffPoint;
                delete rpn.periodicTaxCredit;
                delete rpn.periodicStandardRateCutOffPoint;
                clone.rpn = rpn;
            }
            return clone;
        });
    }

    function stripRpnNumbersForCloudPractice(employees) {
        return employees.map(function(emp) {
            const clone = Object.assign({}, emp);
            clone.rpn = Object.assign({}, clone.rpn || {});
            delete clone.rpn.rpnNumber;
            delete clone.rpn.annualTaxCredits;
            delete clone.rpn.taxCredits;
            delete clone.rpn.cutOffPoint;
            delete clone.rpn.periodicTaxCredit;
            delete clone.rpn.periodicStandardRateCutOffPoint;
            delete clone.rpn.retrievedAt;
            delete clone.rpn.requestId;
            delete clone.rpn.retrievalError;
            return clone;
        });
    }

    // --- Init ---
    function init() {
        // Patch tabConfig for calculator-core compatibility (it expects .multiplier)
        if (typeof tabConfig !== 'undefined') {
            Object.keys(tabConfig).forEach(function(key) {
                if (!tabConfig[key].multiplier && tabConfig[key].periods) {
                    tabConfig[key].multiplier = tabConfig[key].periods;
                }
            });
        }

        // Back to companies link
        const backToCompanies = document.getElementById('back-to-companies');
        if (backToCompanies) {
            backToCompanies.addEventListener('click', function(e) {
                e.preventDefault();
                exitCompany();
            });
        }

        // Backup buttons
        const exportBackupBtn = document.getElementById('export-backup-btn');
        if (exportBackupBtn) {
            exportBackupBtn.addEventListener('click', handleExportBackup);
        }

        const importBackupBtn = document.getElementById('import-backup-btn');
        if (importBackupBtn) {
            importBackupBtn.addEventListener('click', function() {
                const fileInput = document.getElementById('import-file-input');
                if (fileInput) fileInput.click();
            });
        }

        const importFileInput = document.getElementById('import-file-input');
        if (importFileInput) {
            importFileInput.addEventListener('change', handleImportBackup);
        }

        bindPayrollModeControls();

        const headerHelpLink = document.getElementById('header-help-link');
        if (headerHelpLink) {
            headerHelpLink.addEventListener('click', function(e) {
                e.preventDefault();
                switchTab('help');
            });
        }

        document.addEventListener('click', handleRunPayrollActionClick);

        // Show front page
        renderCompanyList();
    }

    function handleRunPayrollActionClick(event) {
        const target = event.target && event.target.closest ? event.target.closest('button') : null;
        if (!target) return;

        if (target.id === 'rollback-btn' || target.id === 'post-commit-rollback-btn' || target.id === 'modal-rollback-commit-btn') {
            event.preventDefault();
            closeActionModal();
            rollbackLastCommit(true);
        } else if (target.id === 'submit-period-btn' || target.id === 'modal-submit-revenue-btn') {
            event.preventDefault();
            closeActionModal();
            submitPeriod(true);
        } else if (target.id === 'post-commit-submit-btn') {
            event.preventDefault();
            switchTab('submission');
        } else if (target.id === 'post-commit-history-btn' && target.dataset.runId) {
            event.preventDefault();
            openCommittedRunInHistory(target.dataset.runId);
        } else if (target.id === 'modal-stay-run-btn') {
            event.preventDefault();
            closeActionModal();
        } else if (target.id === 'generate-submission-btn') {
            event.preventDefault();
            generateSubmissionPayload();
        } else if (target.id === 'submit-revenue-btn') {
            event.preventDefault();
            submitSubmissionToRevenue();
        } else if (target.id === 'calc-preview-btn') {
            event.preventDefault();
            calculateTimesheetPreview();
        } else if (target.id === 'commit-payroll-btn') {
            event.preventDefault();
            confirmAndSaveRun();
        }
    }

    // --- Company List (Front Page) ---
    function renderCompanyList() {
        const container = document.getElementById('company-list');
        if (!container) return;

        const companies = PayrollStorage.loadCompanies();
        if (companies.length === 0) {
            container.innerHTML = '<div class="empty-state">No companies found.</div>';
            return;
        }

        let html = '';
        companies.forEach(function(company, index) {
            const id = escapeHtml(company.id);
            const name = escapeHtml(company.name || 'Unnamed Company');
            const address = company.address || '';
            const eircode = company.eircode || '';
            const taxNumber = getCompanyTaxNumber(company);
            const payFrequency = company.payFrequency || 'monthly';
            const payDate = getCompanyPayDay(company);
            const taxYear = company.taxYear || '2026';
            const taxPeriod = company.taxPeriod === 'oct-dec' ? 'October - December' : 'January - September';
            const modeBadge = getModeBadgeHtml(company, index);

            html += '<div class="company-item" data-company-id="' + id + '">';
            html += '<div class="company-item-header">';
            html += '<a href="#" class="company-name-link" data-action="enter-company" data-company-id="' + id + '">' + name + modeBadge + '</a>';
            html += '<div class="company-actions">';
            if (index === 0) {
                html += '<button type="button" class="btn btn-primary btn-sm" data-action="load-sandbox-local" data-company-id="' + id + '">Load Sandbox Ltd</button>';
            }
            if (index === 1) {
                html += '<button type="button" class="btn btn-primary btn-sm" data-action="load-sandbox-cloud" data-company-id="' + id + '">Load Cloud Sandbox</button>';
            }
            html += '<button type="button" class="btn btn-secondary btn-sm" data-action="edit-company" data-company-id="' + id + '">&#9998; Edit</button>';
            html += '<button type="button" class="company-expand-btn" data-action="toggle-company" data-company-id="' + id + '">';
            html += '<span class="arrow">&#9660;</span>';
            html += '</button>';
            html += '</div>';
            html += '</div>';
            html += '<div class="company-details">';
            html += '<div class="company-details-grid">';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Address</span>';
            html += '<span class="company-detail-value">' + escapeHtml(address) + '</span>';
            html += '</div>';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Eircode</span>';
            html += '<span class="company-detail-value">' + escapeHtml(eircode) + '</span>';
            html += '</div>';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Company Tax Number</span>';
            html += '<span class="company-detail-value">' + escapeHtml(taxNumber || 'Not set') + '</span>';
            html += '</div>';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Pay Frequency</span>';
            html += '<span class="company-detail-value">' + escapeHtml(payFrequency.charAt(0).toUpperCase() + payFrequency.slice(1)) + '</span>';
            html += '</div>';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Pay Date</span>';
            html += '<span class="company-detail-value">' + escapeHtml(getPayDayLabel(payDate)) + '</span>';
            html += '</div>';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Tax Year</span>';
            html += '<span class="company-detail-value">' + escapeHtml(taxYear) + ' (' + escapeHtml(taxPeriod) + ')</span>';
            html += '</div>';
            html += '</div>';
            html += '<div class="company-detail-actions">';
            html += '<button type="button" class="btn btn-danger btn-sm" data-action="delete-company" data-company-id="' + id + '">Delete the Company</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
        });

        container.innerHTML = html;
        bindCompanyListEvents(container);
    }

    function bindCompanyListEvents(container) {
        container.querySelectorAll('[data-action]').forEach(function(el) {
            el.addEventListener('click', function(e) {
                e.preventDefault();
                const action = el.dataset.action;
                const companyId = el.dataset.companyId;
                if (!companyId) return;

                if (action === 'enter-company') {
                    enterCompany(companyId);
                } else if (action === 'load-sandbox-local') {
                    loadLocalSandboxCompany(companyId);
                } else if (action === 'load-sandbox-cloud') {
                    loadCloudSandboxCompany(companyId);
                } else if (action === 'edit-company') {
                    showCompanyEditForm(companyId);
                } else if (action === 'toggle-company') {
                    toggleCompanyDetails(companyId);
                } else if (action === 'save-company') {
                    saveCompanyEdit(companyId);
                } else if (action === 'cancel-company-edit') {
                    renderCompanyList();
                } else if (action === 'delete-company') {
                    deleteCompanyData(companyId);
                }
            });
        });
    }

    function getCompanySlotIndex(companyId) {
        const companies = PayrollStorage.loadCompanies();
        for (let i = 0; i < companies.length; i++) {
            if (companies[i].id === companyId) return i;
        }
        return -1;
    }

    function buildSandboxEmployees() {
        const now = new Date().toISOString();
        return [
            {
                id: 'sandbox_emp_001',
                employeeNumber: 'SAN-0001',
                firstName: 'Noah',
                lastName: 'Walsh',
                ppsNumber: '6900882FJ',
                familyStatus: 'single',
                taxCreditsMode: 'automatic',
                manualTaxCredits: 4000,
                manualCutOffPoint: 44000,
                annualGross: 0,
                payType: 'hourly',
                payFrequency: 'weekly',
                hourlyRate: 18.72,
                standardHoursPerWeek: 35,
                overtimeMultiplier: 1.5,
                prsiClass: 'A1',
                startDate: '2026-01-05',
                isActive: true,
                iban: 'IE29AIBK93115212345678',
                rpn: { rpnNumber: 'RPN-SBX-001', prsiClass: 'A1', uscStatus: 'Normal', employerPrsiClass: 'A1', previousPay: 1488.24, previousTax: 149.76, previousUSC: 8.12, bik: 0, pensionPct: 0, avc: 0 },
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'sandbox_emp_002',
                employeeNumber: 'SAN-0002',
                firstName: 'Aoife',
                lastName: 'Byrne',
                ppsNumber: '8123456TA',
                familyStatus: 'singleParent',
                taxCreditsMode: 'automatic',
                manualTaxCredits: 5900,
                manualCutOffPoint: 48000,
                annualGross: 52000,
                payType: 'salaried',
                payFrequency: 'monthly',
                hourlyRate: 28,
                standardHoursPerWeek: 0,
                overtimeMultiplier: 1.5,
                prsiClass: 'A1',
                startDate: '2025-09-01',
                isActive: true,
                iban: 'IE64BOFI90583812345678',
                rpn: { rpnNumber: 'RPN-SBX-002', prsiClass: 'A1', uscStatus: 'Normal', employerPrsiClass: 'A1', previousPay: 8666.66, previousTax: 920.15, previousUSC: 251.22, bik: 0, pensionPct: 5, avc: 0 },
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'sandbox_emp_003',
                employeeNumber: 'SAN-0003',
                firstName: 'Liam',
                lastName: 'Murphy',
                ppsNumber: '7123456AB',
                familyStatus: 'marriedOneWorking',
                taxCreditsMode: 'automatic',
                manualTaxCredits: 6000,
                manualCutOffPoint: 53000,
                annualGross: 63000,
                payType: 'salaried',
                payFrequency: 'monthly',
                hourlyRate: 34,
                standardHoursPerWeek: 0,
                overtimeMultiplier: 1.5,
                prsiClass: 'A1',
                startDate: '2024-03-18',
                isActive: true,
                iban: 'IE42ULSB98539012345678',
                rpn: { rpnNumber: 'RPN-SBX-003', prsiClass: 'A1', uscStatus: 'Normal', employerPrsiClass: 'A1', previousPay: 10500, previousTax: 1375.5, previousUSC: 342.6, bik: 0, pensionPct: 4, avc: 0 },
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'sandbox_emp_004',
                employeeNumber: 'SAN-0004',
                firstName: 'Sofia',
                lastName: 'OBrien',
                ppsNumber: '7234567CD',
                familyStatus: 'single',
                taxCreditsMode: 'automatic',
                manualTaxCredits: 4000,
                manualCutOffPoint: 44000,
                annualGross: 0,
                payType: 'hourly',
                payFrequency: 'weekly',
                hourlyRate: 22.5,
                standardHoursPerWeek: 35,
                overtimeMultiplier: 1.5,
                prsiClass: 'A1',
                startDate: '2026-02-02',
                isActive: true,
                iban: '',
                rpn: { prsiClass: 'A1', uscStatus: 'Normal', employerPrsiClass: 'A1', previousPay: 1800, previousTax: 185.2, previousUSC: 22.4, bik: 0, pensionPct: 0, avc: 0 },
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'sandbox_emp_005',
                employeeNumber: 'SAN-0005',
                firstName: 'Jack',
                lastName: 'Kelly',
                ppsNumber: '7345678EF',
                familyStatus: 'custom',
                taxCreditsMode: 'manual',
                manualTaxCredits: 5200,
                manualCutOffPoint: 50000,
                annualGross: 48000,
                payType: 'salaried',
                payFrequency: 'fortnightly',
                hourlyRate: 25.4,
                standardHoursPerWeek: 0,
                overtimeMultiplier: 1.5,
                prsiClass: 'A1',
                startDate: '2025-11-10',
                isActive: true,
                iban: 'IE78PTSB99065012345678',
                rpn: { rpnNumber: 'RPN-SBX-005', prsiClass: 'A1', uscStatus: 'Normal', employerPrsiClass: 'A1', previousPay: 3692.3, previousTax: 341.75, previousUSC: 83.1, bik: 0, pensionPct: 3, avc: 0 },
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'sandbox_emp_006',
                employeeNumber: 'SAN-0006',
                firstName: 'Mia',
                lastName: 'Ryan',
                ppsNumber: '7456789GH',
                familyStatus: 'married',
                taxCreditsMode: 'automatic',
                manualTaxCredits: 8000,
                manualCutOffPoint: 88000,
                annualGross: 78000,
                payType: 'salaried',
                payFrequency: 'monthly',
                hourlyRate: 42,
                standardHoursPerWeek: 0,
                overtimeMultiplier: 1.5,
                prsiClass: 'A1',
                startDate: '2023-06-12',
                isActive: true,
                iban: 'IE35AIBK93115287654321',
                rpn: { rpnNumber: 'RPN-SBX-006', prsiClass: 'A1', uscStatus: 'Normal', employerPrsiClass: 'A1', previousPay: 13000, previousTax: 1525, previousUSC: 509.5, bik: 1200, pensionPct: 5, avc: 2 },
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'sandbox_emp_007',
                employeeNumber: 'SAN-0007',
                firstName: 'Daniel',
                lastName: 'McCarthy',
                ppsNumber: '7567890IJ',
                familyStatus: 'single',
                taxCreditsMode: 'automatic',
                manualTaxCredits: 4000,
                manualCutOffPoint: 44000,
                annualGross: 36500,
                payType: 'salaried',
                payFrequency: 'fortnightly',
                hourlyRate: 19.5,
                standardHoursPerWeek: 0,
                overtimeMultiplier: 1.5,
                prsiClass: 'A1',
                startDate: '2025-04-07',
                isActive: true,
                iban: 'IE91BOFI90123498765432',
                rpn: { prsiClass: 'A1', uscStatus: 'Normal', employerPrsiClass: 'A1', previousPay: 2807.7, previousTax: 140.9, previousUSC: 40.2, bik: 0, pensionPct: 0, avc: 0 },
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'sandbox_emp_008',
                employeeNumber: 'SAN-0008',
                firstName: 'Emma',
                lastName: 'Doyle',
                ppsNumber: '7678901KL',
                familyStatus: 'singleParent',
                taxCreditsMode: 'automatic',
                manualTaxCredits: 5900,
                manualCutOffPoint: 48000,
                annualGross: 0,
                payType: 'hourly',
                payFrequency: 'weekly',
                hourlyRate: 16.85,
                standardHoursPerWeek: 30,
                overtimeMultiplier: 1.5,
                prsiClass: 'A1',
                startDate: '2026-01-22',
                isActive: true,
                iban: '',
                rpn: { prsiClass: 'A1', uscStatus: 'Normal', employerPrsiClass: 'A1', previousPay: 1011, previousTax: 36.2, previousUSC: 6.3, bik: 0, pensionPct: 0, avc: 0 },
                createdAt: now,
                updatedAt: now
            }
        ];
    }

    function resetCompanyPracticeData(companyId, companyPatch, employees) {
        const resetDone = PayrollStorage.resetCompany(companyId);
        const companyUpdated = PayrollStorage.updateCompany(companyId, companyPatch);
        const employeesSaved = PayrollStorage.saveEmployees(companyId, employees);
        PayrollStorage.saveSubmissions(companyId, []);
        PayrollStorage.saveTaxCreditsLedger(companyId, {});
        PayrollStorage.savePeriodState(companyId, {
            currentPeriodNumber: 1,
            commitCounter: 0,
            committedRunIds: [],
            status: 'open',
            weekNumber: 1,
            weekly: { periodNumber: 1 },
            fortnightly: { periodNumber: 1, lastCommittedWeek: 0 },
            monthly: { periodNumber: 1, lastCommittedWeek: 0 },
            rpnRetrievedForPeriod: false
        });
        return resetDone && companyUpdated && employeesSaved;
    }

    function loadLocalSandboxCompany(companyId) {
        if (getCompanySlotIndex(companyId) !== 0) {
            showMessage('Local sandbox can only be loaded into Practice – Local.', 'error');
            return;
        }

        showConfirmModal('Load Sandbox Ltd for local practice? This clears Company 1 data and removes RPN fields so manual tax credits/COP are used.', function() {
            const success = resetCompanyPracticeData(companyId, {
                name: 'Sandbox Ltd',
                address: '123 Main Street, Dublin',
                eircode: 'D01 A1B2',
                taxNumber: '1234567T',
                payFrequency: 'weekly',
                payDate: 'friday',
                taxYear: '2026',
                taxPeriod: 'jan-sep',
                payrollMode: 'local',
                practicePreset: 'sandbox-local'
            }, stripRpnForLocalMode(buildSandboxEmployees()));

            if (success) {
                showMessage('Sandbox Ltd loaded for local mode with 8 practice employees.', 'success');
                renderCompanyList();
            } else {
                showMessage('Failed to load Sandbox Ltd.', 'error');
            }
        });
    }

    function loadCloudSandboxCompany(companyId) {
        if (getCompanySlotIndex(companyId) !== 1) {
            showMessage('Cloud sandbox can only be loaded into Practice – Cloud.', 'error');
            return;
        }

        showConfirmModal('Load Cloud Sandbox for RPN practice? This clears Company 2 data. Retrieve RPN from the fake Revenue server before running payroll.', function() {
            const success = resetCompanyPracticeData(companyId, {
                name: 'Cloud Sandbox Ltd',
                address: '456 High Street, Cork',
                eircode: 'T12 X3Y4',
                taxNumber: '1234567T',
                payFrequency: 'weekly',
                payDate: 'friday',
                taxYear: '2026',
                taxPeriod: 'jan-sep',
                payrollMode: 'cloud',
                practicePreset: 'sandbox-cloud'
            }, stripRpnNumbersForCloudPractice(buildSandboxEmployees()));

            if (success) {
                showMessage('Cloud sandbox loaded with 8 employees. Open the company and click Retrieve RPN.', 'success');
                renderCompanyList();
            } else {
                showMessage('Failed to load cloud sandbox.', 'error');
            }
        });
    }

    function deleteCompanyData(companyId) {
        const company = PayrollStorage.getCompany(companyId);
        if (!company) return;
        showConfirmModal('This clears employees, payroll history, submissions, and company details for ' + (company.name || 'this company') + '. This cannot be undone.', function() {
            if (PayrollStorage.resetCompany(companyId)) {
                if (PayrollContext.currentCompanyId === companyId) {
                    PayrollContext.currentCompanyId = null;
                }
                showMessage('Company data deleted.', 'success');
                renderCompanyList();
            } else {
                showMessage('Failed to delete company data.', 'error');
            }
        }, { title: 'Delete company data', variant: 'danger', confirmLabel: 'Delete' });
    }

    function toggleCompanyDetails(companyId) {
        const item = document.querySelector('.company-item[data-company-id="' + companyId + '"]');
        if (item) {
            item.classList.toggle('expanded');
        }
    }

    function showCompanyEditForm(companyId) {
        const company = PayrollStorage.getCompany(companyId);
        if (!company) return;

        const item = document.querySelector('.company-item[data-company-id="' + companyId + '"]');
        if (!item) return;

        item.classList.add('expanded');

        const detailsDiv = item.querySelector('.company-details');
        if (!detailsDiv) return;

        const id = escapeHtml(companyId);
        const name = escapeHtml(company.name || '');
        const address = escapeHtml(company.address || '');
        const eircode = escapeHtml(company.eircode || '');
        const taxNumber = escapeHtml(getCompanyTaxNumber(company));
        const payFrequency = company.payFrequency || 'monthly';
        const payDate = getCompanyPayDay(company);
        const taxYear = company.taxYear || '2026';
        const taxPeriod = company.taxPeriod || 'jan-sep';

        let html = '<div class="company-edit-form">';
        html += '<div class="form-group">';
        html += '<label>Company Name</label>';
        html += '<input class="form-input" id="edit-name-' + id + '" value="' + name + '">';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group">';
        html += '<label>Address</label>';
        html += '<input class="form-input" id="edit-address-' + id + '" value="' + address + '">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label>Eircode</label>';
        html += '<input class="form-input" id="edit-eircode-' + id + '" value="' + eircode + '" maxlength="8">';
        html += '</div>';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label>Company Tax Number</label>';
        html += '<input class="form-input" id="edit-taxnumber-' + id + '" value="' + taxNumber + '" autocomplete="off">';
        html += '</div>';
        html += '<div class="form-row">';
        html += '<div class="form-group">';
        html += '<label>Pay Frequency</label>';
        html += '<select class="form-select" id="edit-frequency-' + id + '">';
        html += '<option value="weekly"' + (payFrequency === 'weekly' ? ' selected' : '') + '>Weekly</option>';
        html += '<option value="fortnightly"' + (payFrequency === 'fortnightly' ? ' selected' : '') + '>Fortnightly</option>';
        html += '<option value="monthly"' + (payFrequency === 'monthly' ? ' selected' : '') + '>Monthly</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label>Pay Date</label>';
        html += '<select class="form-select" id="edit-paydate-' + id + '">';
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].forEach(function(day) {
            html += '<option value="' + day + '"' + (payDate === day ? ' selected' : '') + '>' + getPayDayLabel(day) + '</option>';
        });
        html += '</select>';
        html += '</div>';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label>Tax Year</label>';
        html += '<select class="form-select" id="edit-taxyear-' + id + '">';
        html += '<option value="2024"' + (taxYear === '2024' ? ' selected' : '') + '>2024</option>';
        html += '<option value="2025"' + (taxYear === '2025' ? ' selected' : '') + '>2025</option>';
        html += '<option value="2026"' + (taxYear === '2026' ? ' selected' : '') + '>2026</option>';
        html += '</select>';
        html += '</div>';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label>Tax Period</label>';
        html += '<select class="form-select" id="edit-taxperiod-' + id + '">';
        html += '<option value="jan-sep"' + (taxPeriod === 'jan-sep' ? ' selected' : '') + '>January - September</option>';
        html += '<option value="oct-dec"' + (taxPeriod === 'oct-dec' ? ' selected' : '') + '>October - December</option>';
        html += '</select>';
        html += '</div>';
        html += '<div class="form-actions">';
        html += '<button type="button" class="btn btn-primary" data-action="save-company" data-company-id="' + id + '">Save</button>';
        html += '<button type="button" class="btn btn-secondary" data-action="cancel-company-edit" data-company-id="' + id + '">Cancel</button>';
        html += '</div>';
        html += '</div>';

        detailsDiv.innerHTML = html;
        bindCompanyListEvents(detailsDiv);
    }

    function saveCompanyEdit(companyId) {
        const nameInput = document.getElementById('edit-name-' + companyId);
        const addressInput = document.getElementById('edit-address-' + companyId);
        const eircodeInput = document.getElementById('edit-eircode-' + companyId);
        const taxNumberInput = document.getElementById('edit-taxnumber-' + companyId);
        const frequencyInput = document.getElementById('edit-frequency-' + companyId);
        const payDateInput = document.getElementById('edit-paydate-' + companyId);
        const taxYearInput = document.getElementById('edit-taxyear-' + companyId);
        const taxPeriodInput = document.getElementById('edit-taxperiod-' + companyId);

        const data = {
            name: nameInput ? nameInput.value.trim() : '',
            address: addressInput ? addressInput.value.trim() : '',
            eircode: eircodeInput ? eircodeInput.value.trim() : '',
            taxNumber: taxNumberInput ? taxNumberInput.value.trim() : '',
            payFrequency: frequencyInput ? frequencyInput.value : 'monthly',
            payDate: payDateInput ? payDateInput.value : 'friday',
            taxYear: taxYearInput ? taxYearInput.value : '2026',
            taxPeriod: taxPeriodInput ? taxPeriodInput.value : 'jan-sep'
        };

        const success = PayrollStorage.updateCompany(companyId, data);
        if (success) {
            showMessage('Company details saved.', 'success');
            renderCompanyList();
        } else {
            showMessage('Failed to save company details.', 'error');
        }
    }

    // --- Enter/Exit Company ---
    function enterCompany(companyId) {
        const company = PayrollStorage.getCompany(companyId);
        const slotIndex = getCompanySlotIndex(companyId);

        if (typeof PayrollMode !== 'undefined' && PayrollMode.needsModeSelection(company, slotIndex)) {
            promptInitialModeSelection(companyId, function() {
                enterCompanyWorkspace(companyId);
            });
            return;
        }

        enterCompanyWorkspace(companyId);
    }

    function enterCompanyWorkspace(companyId) {
        PayrollContext.currentCompanyId = companyId;
        PayrollStorage.setActiveCompanyId(companyId);

        const company = PayrollStorage.getCompany(companyId);
        if (company) {
            selectedYear = company.taxYear || '2026';
            activeTab = company.payFrequency || 'monthly';
            const periodVar = 'selected' + selectedYear + 'Period';
            if (typeof window[periodVar] !== 'undefined') {
                window[periodVar] = company.taxPeriod || 'jan-sep';
            }
            if (typeof updateTaxRatesForYear === 'function') {
                updateTaxRatesForYear(selectedYear);
            }
        }

        // One-time migration: build ledger from existing payroll runs
        var existingLedger = PayrollStorage.loadTaxCreditsLedger(companyId);
        var existingRuns = PayrollStorage.loadPayrollRuns(companyId);
        if (Object.keys(existingLedger).length === 0 && existingRuns && existingRuns.length > 0) {
            var migrationLedger = {};
            var employees = PayrollStorage.loadEmployees(companyId) || [];
            existingRuns.forEach(function(run) {
                if (!run.entries) return;
                var runYear = run.taxYear || '2026';
                run.entries.forEach(function(entry) {
                    if (!migrationLedger[entry.employeeId]) migrationLedger[entry.employeeId] = {};
                    if (!migrationLedger[entry.employeeId][runYear]) {
                        var emp = employees.find(function(e) { return e.id === entry.employeeId; });
                        var famStatus = emp ? emp.familyStatus : 'single';
                        migrationLedger[entry.employeeId][runYear] = {
                            annualTaxCredits: getEmployeeAnnualTaxCredits(emp || { familyStatus: famStatus }),
                            taxCreditsUsed: 0,
                            remaining: 0,
                            cutOffPoint: getEmployeeCutOffPoint(emp || { familyStatus: famStatus }),
                            copUsed: 0,
                            copRemaining: 0,
                            source: getEmployeeTaxSource(emp || { familyStatus: famStatus }),
                            lastUpdated: new Date().toISOString()
                        };
                    }
                    migrationLedger[entry.employeeId][runYear].taxCreditsUsed += (entry.taxCreditsUsed || 0);
                    migrationLedger[entry.employeeId][runYear].copUsed += (entry.grossPay || 0);
                });
            });
            // Calculate remaining values
            Object.keys(migrationLedger).forEach(function(empId) {
                Object.keys(migrationLedger[empId]).forEach(function(yr) {
                    var e = migrationLedger[empId][yr];
                    e.remaining = e.annualTaxCredits - e.taxCreditsUsed;
                    e.copRemaining = e.cutOffPoint - e.copUsed;
                });
            });
            PayrollStorage.saveTaxCreditsLedger(companyId, migrationLedger);
        }

        // Period state migration: old format → per-frequency format
        var periodState = PayrollStorage.loadPeriodState(companyId);
        if (periodState && periodState.currentPeriodNumber && !periodState.weekNumber) {
            // Migrate: use currentPeriodNumber as weekNumber (best guess)
            periodState.weekNumber = periodState.currentPeriodNumber;

            // Count historical runs per frequency to set period numbers
            var migrationRuns = PayrollStorage.loadPayrollRuns(companyId) || [];
            var weeklyCount = 0;
            var fortnightlyCount = 0;
            var monthlyCount = 0;
            var lastFortnightlyWeek = 0;
            var lastMonthlyWeek = 0;

            migrationRuns.forEach(function(run) {
                if (!run.entries) return;
                var hasWeekly = false;
                var hasFortnightly = false;
                var hasMonthly = false;
                run.entries.forEach(function(entry) {
                    var pt = (entry.periodType || '').toLowerCase();
                    if (pt === 'weekly') hasWeekly = true;
                    else if (pt === 'fortnightly') hasFortnightly = true;
                    else if (pt === 'monthly') hasMonthly = true;
                });
                if (hasWeekly) weeklyCount++;
                if (hasFortnightly) {
                    fortnightlyCount++;
                    lastFortnightlyWeek = run.weekNumber || periodState.currentPeriodNumber;
                }
                if (hasMonthly) {
                    monthlyCount++;
                    lastMonthlyWeek = run.weekNumber || periodState.currentPeriodNumber;
                }
            });

            // Initialize per-frequency state
            if (!periodState.weekly) periodState.weekly = {};
            periodState.weekly.periodNumber = weeklyCount + 1;

            if (!periodState.fortnightly) periodState.fortnightly = {};
            periodState.fortnightly.periodNumber = fortnightlyCount + 1;
            periodState.fortnightly.lastCommittedWeek = lastFortnightlyWeek;

            if (!periodState.monthly) periodState.monthly = {};
            periodState.monthly.periodNumber = monthlyCount + 1;
            periodState.monthly.lastCommittedWeek = lastMonthlyWeek;

            // Save migrated state
            PayrollStorage.savePeriodState(companyId, periodState);
        }

        // Hide dashboard, show workspace
        const dashboardPanel = document.getElementById('panel-dashboard');
        if (dashboardPanel) dashboardPanel.classList.remove('active');

        const workspaceHeader = document.getElementById('company-workspace-header');
        if (workspaceHeader) workspaceHeader.classList.remove('hidden');

        const companyNameEl = document.getElementById('workspace-company-name');
        if (companyNameEl) companyNameEl.textContent = company ? company.name : '';

        const companyNumberEl = document.getElementById('workspace-company-number');
        if (companyNumberEl) {
            const companyNumber = getCompanyTaxNumber(company) || getEmployerRegistrationNumber();
            companyNumberEl.textContent = companyNumber ? 'Company number: ' + companyNumber : '';
        }

        const workspaceNav = document.getElementById('workspace-nav');
        if (workspaceNav) workspaceNav.classList.remove('hidden');

        // Bind tab navigation (use onclick to avoid duplicates on re-enter)
        workspaceNav.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.onclick = function() {
                switchTab(btn.dataset.tab);
            };
        });

        // Init employees module
        if (typeof PayrollEmployees !== 'undefined' && PayrollEmployees.init) {
            PayrollEmployees.init(companyId);
        }

        // Init state machine
        if (typeof PayrollStateMachine !== 'undefined' && PayrollStateMachine.init) {
            PayrollStateMachine.init(companyId);
        }

        applyModeToUI();
        bindPayrollModeControls();

        // Default to Employees tab
        switchTab('employees');
        renderHistory();
    }

    function exitCompany() {
        PayrollContext.currentCompanyId = null;

        const workspaceHeader = document.getElementById('company-workspace-header');
        if (workspaceHeader) workspaceHeader.classList.add('hidden');

        const workspaceNav = document.getElementById('workspace-nav');
        if (workspaceNav) workspaceNav.classList.add('hidden');

        document.querySelectorAll('.tab-panel').forEach(function(panel) {
            panel.classList.remove('active');
        });

        const dashboardPanel = document.getElementById('panel-dashboard');
        if (dashboardPanel) dashboardPanel.classList.add('active');

        renderCompanyList();
    }

    // --- Help ---
    function renderHelp() {
        const el = document.getElementById('help-content');
        if (!el) return;

        const showDashboardBack = !PayrollContext.currentCompanyId;
        let html = '<div class="help-page">';
        html += '<h2>Help</h2>';
        html += '<p class="help-intro">A quick guide to the main areas of the app. This is introductory help only — not tax advice. Check Revenue guidance for official rules.</p>';

        if (showDashboardBack) {
            html += '<p class="help-back-row"><a href="#" id="help-back-dashboard" class="help-back-link">&#8592; Back to Companies</a></p>';
        }

        html += '<section class="help-section"><h3>Quick start</h3>';
        html += '<ol class="help-steps">';
        html += '<li>Open or create a company on the Companies screen.</li>';
        html += '<li>Add employees (up to 10 per company).</li>';
        html += '<li>Choose <strong>Local</strong> or <strong>Cloud</strong> mode for that company.</li>';
        html += '<li>Run payroll, review the preview, then commit the run.</li>';
        html += '<li>Submit the period when ready (Cloud mode) and check History.</li>';
        html += '</ol></section>';

        html += '<section class="help-section"><h3>Companies</h3>';
        html += '<p>Your home screen lists up to three company slots. Click a company name to open it. Use <strong>Edit</strong> to change company details. Use <strong>Load Sandbox Ltd</strong> or <strong>Load Cloud Sandbox</strong> to practice with preset sample data.</p></section>';

        html += '<section class="help-section"><h3>Local vs Cloud mode</h3>';
        html += '<p><strong>Local mode</strong> — enter tax credits and cut-off points manually. Good for learning and offline practice. RPN and Revenue submission tabs are hidden.</p>';
        html += '<p><strong>Cloud mode</strong> — retrieve RPN data from the practice Revenue server, then generate and submit payroll. Requires the fake Revenue API on port 3001 for local development.</p></section>';

        html += '<section class="help-section"><h3>Employees</h3>';
        html += '<p>Add and edit staff records: name, PPS, pay type, frequency, PRSI class, and tax settings. Use <strong>Show Employee List</strong> for a printable summary. Click an employee card to edit or delete.</p></section>';

        html += '<section class="help-section"><h3>Tax Credits &amp; COP</h3>';
        html += '<p>Overview table of annual tax credits and cut-off points per employee. Sort columns and click a row to open that employee. <strong>Last updated</strong> shows when payroll with tax credits was last submitted.</p></section>';

        html += '<section class="help-section"><h3>RPN <span class="help-badge">Cloud</span></h3>';
        html += '<p>View Revenue Payroll Notification (RPN) fields for all employees. Retrieve RPN from the practice server before running payroll in Cloud mode.</p></section>';

        html += '<section class="help-section"><h3>Run Payroll</h3>';
        html += '<p>Enter hours or confirm salaried pay for the period. Preview PAYE, USC, and PRSI, then <strong>commit</strong> the run. You can roll back the last commit if you need to fix something before submitting.</p></section>';

        html += '<section class="help-section"><h3>Submission <span class="help-badge">Cloud</span></h3>';
        html += '<p>Generate a submission payload from committed runs and send it to the practice Revenue server. Use this after payroll is committed for the period.</p></section>';

        html += '<section class="help-section"><h3>History</h3>';
        html += '<p>Past payroll runs for the company. Expand a run to see details, export CSV/Excel, open payslips, or delete a run.</p></section>';

        html += '<section class="help-section"><h3>Backup &amp; privacy</h3>';
        html += '<p>Data is stored in this browser. Use <strong>Export Backup</strong> to save a JSON file and <strong>Import Backup</strong> to restore. Keep backup files private — they contain employee and payroll data.</p></section>';

        html += '<p class="help-disclaimer">This software is for practice and learning. Always verify figures with Revenue and professional advice before using results for real payroll.</p>';
        html += '</div>';

        el.innerHTML = html;

        const backLink = document.getElementById('help-back-dashboard');
        if (backLink) {
            backLink.addEventListener('click', function(e) {
                e.preventDefault();
                document.querySelectorAll('.tab-panel').forEach(function(panel) {
                    panel.classList.toggle('active', panel.id === 'panel-dashboard');
                });
            });
        }
    }

    // --- Tab Navigation ---
    function switchTab(tabName) {
        if (tabName === 'help') {
            const workspaceNav = document.getElementById('workspace-nav');
            if (workspaceNav && !workspaceNav.classList.contains('hidden')) {
                workspaceNav.querySelectorAll('.tab-btn').forEach(function(btn) {
                    btn.classList.toggle('active', btn.dataset.tab === 'help');
                });
            }

            document.querySelectorAll('.tab-panel').forEach(function(panel) {
                panel.classList.toggle('active', panel.id === 'panel-help');
            });
            renderHelp();
            return;
        }

        if (isLocalMode() && (tabName === 'rpn' || tabName === 'submission')) {
            tabName = 'employees';
        }

        const workspaceNav = document.getElementById('workspace-nav');
        if (workspaceNav) {
            workspaceNav.querySelectorAll('.tab-btn').forEach(function(btn) {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });
        }

        document.querySelectorAll('.tab-panel').forEach(function(panel) {
            panel.classList.toggle('active', panel.id === 'panel-' + tabName);
        });

        if (tabName === 'run') {
            showRunPayroll();
        } else if (tabName === 'taxcredits') {
            renderTaxCreditsTable();
        } else if (tabName === 'rpn') {
            renderRPNOverview();
        } else if (tabName === 'submission') {
            renderSubmission();
        } else if (tabName === 'history') {
            renderHistory();
        }
    }

    // --- Run Payroll (delegated to PayrollRun) ---
    function showRunPayroll() { return PayrollRun.showRunPayroll(); }
    function calculatePayroll() { return PayrollRun.calculatePayroll(); }
    function calculateTimesheetPreview() { return PayrollRun.calculateTimesheetPreview(); }
    function calculateEstGross(emp, regularHours, overtimeHours, hourlyRate) { return PayrollRun.calculateEstGross(emp, regularHours, overtimeHours, hourlyRate); }
    function confirmAndSaveRun() { return PayrollRun.confirmAndSaveRun(); }
    function rollbackLastCommit(skipConfirm) { return PayrollRun.rollbackLastCommit(skipConfirm); }
    function submitPeriod(skipConfirm) { return PayrollRun.submitPeriod(skipConfirm); }
    function openCommittedRunInHistory(runId) { return PayrollRun.openCommittedRunInHistory(runId); }
    function closeActionModal() { return PayrollRun.closeActionModal(); }
    function buildPayrollPreviewDataFromRun(run) { return PayrollRun.buildPayrollPreviewDataFromRun(run); }
    function buildPayrollPreviewHtml(runData, options) { return PayrollRun.buildPayrollPreviewHtml(runData, options); }
    function bindPayrollPreviewPayslipRows(previewDiv) { return PayrollRun.bindPayrollPreviewPayslipRows(previewDiv); }

    // --- Payslips (delegated to PayrollPayslip) ---
    function showPayslip(runId, employeeId) { return PayrollPayslip.showPayslip(runId, employeeId); }
    function showPayslipFromEntry(entry, run, entries, currentIndex) { return PayrollPayslip.showPayslipFromEntry(entry, run, entries, currentIndex); }
    function renderEmployeeCardPayslipPanel(entry, run, employeeId, periodNumber) { return PayrollPayslip.renderEmployeeCardPayslipPanel(entry, run, employeeId, periodNumber); }
    function clearEmployeeCardPayslipPanel() { return PayrollPayslip.clearEmployeeCardPayslipPanel(); }
    function printPayslip() { return PayrollPayslip.printPayslip(); }
    function buildBreakdownSteps(entry, employee, calcResult, opts) { return PayrollPayslip.buildBreakdownSteps(entry, employee, calcResult, opts); }
    function renderBreakdownSteps(steps) { return PayrollPayslip.renderBreakdownSteps(steps); }

    // --- Sync All Tables ---
    function syncAllTables() {
        // Refresh history if visible
        const historyPanel = document.getElementById('panel-history');
        if (historyPanel && historyPanel.classList.contains('active')) {
            renderHistory();
        }
        // Refresh tax credits table if visible
        const tcPanel = document.getElementById('panel-taxcredits');
        if (tcPanel && tcPanel.classList.contains('active')) {
            renderTaxCreditsTable();
        }
        // Refresh RPN tab if visible
        const rpnPanel = document.getElementById('panel-rpn');
        if (rpnPanel && rpnPanel.classList.contains('active')) {
            renderRPNOverview();
        }
        const submissionPanel = document.getElementById('panel-submission');
        if (submissionPanel && submissionPanel.classList.contains('active')) {
            renderSubmission();
        }
    }

    function getCurrentCompany() {
        const companies = PayrollStorage.loadCompanies() || [];
        return companies.find(function(company) { return company.id === PayrollContext.currentCompanyId; }) || null;
    }

    function getCompanyTaxNumber(company) {
        if (!company) return '';
        return company.taxNumber || company.companyTaxNumber || company.employerRegistrationNumber || company.registrationNumber || company.regNo || company.taxRegistrationNumber || '';
    }

    function getEmployerRegistrationNumber() {
        const company = getCurrentCompany();
        return getCompanyTaxNumber(company) || '1234567T';
    }

    function getSubmissionPayPeriod(run) {
        const date = run && run.runDate ? new Date(run.runDate) : new Date();
        const year = run && run.taxYear ? String(run.taxYear) : String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return year + '-' + month;
    }

    function summarizeRunForSubmission(run) {
        return (run.entries || []).reduce(function(summary, entry) {
            summary.totalGrossPay += entry.grossPay || 0;
            summary.totalPAYE += entry.paye || 0;
            summary.totalUSC += entry.usc || 0;
            summary.totalPRSI += entry.prsi || 0;
            return summary;
        }, { totalGrossPay: 0, totalPAYE: 0, totalUSC: 0, totalPRSI: 0 });
    }

    function roundSubmissionSummary(summary) {
        Object.keys(summary).forEach(function(key) {
            summary[key] = Math.round((summary[key] || 0) * 100) / 100;
        });
        return summary;
    }

    function buildSubmissionPayload(run, status) {
        const payloadStatus = status || 'READY';
        const summary = roundSubmissionSummary(summarizeRunForSubmission(run || { entries: [] }));
        return {
            id: 'submission-' + (run ? run.id : PayrollStorage.generateId()),
            submissionId: 'PSR-' + Date.now(),
            status: payloadStatus,
            employerRegistrationNumber: getEmployerRegistrationNumber(),
            taxYear: parseInt((run && run.taxYear) || selectedYear, 10),
            payPeriod: getSubmissionPayPeriod(run || {}),
            timestamp: new Date().toISOString(),
            message: payloadStatus === 'ACCEPTED' ? 'Payroll Submission accepted (FAKE)' : 'Payroll Submission ready (FAKE)',
            runId: run ? run.id : '',
            runIds: run ? [run.id] : [],
            summary: summary
        };
    }

    function upsertSubmissionFromRun(run, status) {
        if (!PayrollContext.currentCompanyId || !run) return null;
        const submissions = PayrollStorage.loadSubmissions(PayrollContext.currentCompanyId) || [];
        const existingIndex = submissions.findIndex(function(item) {
            return item.runId === run.id || (Array.isArray(item.runIds) && item.runIds.indexOf(run.id) !== -1);
        });
        const existing = existingIndex >= 0 ? submissions[existingIndex] : null;
        const payload = buildSubmissionPayload(run, status || (existing && existing.status) || 'READY');
        if (existing) {
            payload.id = existing.id || payload.id;
            payload.submissionId = existing.submissionId || payload.submissionId;
            submissions[existingIndex] = payload;
        } else {
            submissions.push(payload);
        }
        PayrollStorage.saveSubmissions(PayrollContext.currentCompanyId, submissions);
        return existingIndex >= 0 ? submissions[existingIndex] : payload;
    }

    function getLatestSubmissionRun() {
        const runs = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];
        const pending = runs.filter(function(run) { return run.status === 'committed'; });
        const source = pending.length > 0 ? pending : runs;
        source.sort(function(a, b) { return new Date(b.runDate) - new Date(a.runDate); });
        return source[0] || null;
    }

    function getLatestSubmissionRecord() {
        const submissions = PayrollStorage.loadSubmissions(PayrollContext.currentCompanyId) || [];
        submissions.sort(function(a, b) { return new Date(b.timestamp || b.submittedAt || 0) - new Date(a.timestamp || a.submittedAt || 0); });
        return submissions[0] || null;
    }

    function renderSubmission() {
        const list = document.getElementById('submission-list');
        const output = document.getElementById('submission-form-output');
        if (!list) return;
        if (!PayrollContext.currentCompanyId) {
            list.innerHTML = '<div class="empty-state">Select a company to view submissions.</div>';
            if (output) output.classList.add('hidden');
            return;
        }
        const submissions = PayrollStorage.loadSubmissions(PayrollContext.currentCompanyId) || [];
        submissions.sort(function(a, b) { return new Date(b.timestamp || b.submittedAt || 0) - new Date(a.timestamp || a.submittedAt || 0); });
        if (submissions.length === 0) {
            list.innerHTML = '<div class="empty-state">No submissions generated yet. Commit payroll, then click Generate Submission to create the submission file.</div>';
        } else {
            let html = '<div class="table-container"><table class="results-table submission-table"><thead><tr>';
            html += '<th>Submission ID</th><th>Status</th><th>Employer Reg.</th><th>Tax Year</th><th>Pay Period</th><th>Timestamp</th>';
            html += '<th class="text-right">Gross</th><th class="text-right">PAYE</th><th class="text-right">USC</th><th class="text-right">PRSI</th><th>Message</th>';
            html += '</tr></thead><tbody>';
            submissions.forEach(function(item) {
                const summary = item.summary || {};
                html += '<tr>';
                html += '<td>' + escapeHtml(item.submissionId || item.id || '') + '</td>';
                html += '<td>' + escapeHtml(item.status || 'READY') + '</td>';
                html += '<td>' + escapeHtml(item.employerRegistrationNumber || getEmployerRegistrationNumber()) + '</td>';
                html += '<td>' + escapeHtml(String(item.taxYear || selectedYear)) + '</td>';
                html += '<td>' + escapeHtml(item.payPeriod || '') + '</td>';
                html += '<td>' + escapeHtml(formatLocalDateTime(item.timestamp || item.submittedAt || '')) + '</td>';
                html += '<td class="text-right">' + safeFormatCurrency(summary.totalGrossPay || 0) + '</td>';
                html += '<td class="text-right">' + safeFormatCurrency(summary.totalPAYE || 0) + '</td>';
                html += '<td class="text-right">' + safeFormatCurrency(summary.totalUSC || 0) + '</td>';
                html += '<td class="text-right">' + safeFormatCurrency(summary.totalPRSI || 0) + '</td>';
                html += '<td>' + escapeHtml(item.message || '') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            list.innerHTML = html;
        }
    }

    function renderSubmissionPayload(payload) {
        const output = document.getElementById('submission-form-output');
        if (!output) return;
        output.classList.remove('hidden');
        output.innerHTML = '<h3>Generated Submission</h3><textarea class="submission-json" readonly>' +
            escapeHtml(JSON.stringify(payload, null, 2)) +
            '</textarea>';
    }

    function generateSubmissionPayload() {
        if (!isCloudMode()) {
            showMessage('Submission is only available in Cloud mode.', 'error');
            return null;
        }

        const run = getLatestSubmissionRun();
        if (!run) {
            showMessage('No payroll run available to generate a submission.', 'error');
            return null;
        }
        const payload = upsertSubmissionFromRun(run, 'ACCEPTED');
        renderSubmission();
        renderSubmissionPayload(payload);
        showMessage('Submission generated.', 'success');
        return payload;
    }

    function buildPSRRequest(run) {
        const employees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];
        const employeeMap = {};
        employees.forEach(function(emp) {
            employeeMap[emp.id] = emp;
        });

        return {
            employerRegistrationNumber: getEmployerRegistrationNumber(),
            taxYear: parseInt((run && run.taxYear) || selectedYear, 10),
            payPeriod: getSubmissionPayPeriod(run || {}),
            employees: (run && run.entries ? run.entries : []).map(function(entry) {
                const emp = employeeMap[entry.employeeId] || {};
                return {
                    employmentId: entry.employeeId,
                    ppsn: emp.ppsNumber || '',
                    grossPay: entry.grossPay || 0,
                    paye: entry.paye || 0,
                    usc: entry.usc || 0,
                    prsi: entry.prsi || 0
                };
            })
        };
    }

    function refreshCloudTaxValuesAfterSubmit(run) {
        if (!PayrollContext.currentCompanyId || !run) return;

        const year = run.taxYear || selectedYear;
        initOrSyncLedger(PayrollContext.currentCompanyId, year);
        const ledger = PayrollStorage.loadTaxCreditsLedger(PayrollContext.currentCompanyId);
        const employees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];

        employees.forEach(function(emp) {
            const entry = ledger[emp.id] && ledger[emp.id][year];
            if (!entry) return;

            const payFrequency = getEmployeePayFrequency(emp);
            const periods = getPeriodsPerYearForFrequency(payFrequency);
            const remainingTC = Math.max((entry.annualTaxCredits || 0) - (entry.taxCreditsUsed || 0), 0);
            const annualCOP = entry.cutOffPoint || 0;
            const periodicCOP = typeof PayrollUtils !== 'undefined' && PayrollUtils.getLocalPeriodicCOP
                ? PayrollUtils.getLocalPeriodicCOP(annualCOP, periods)
                : annualCOP / periods;

            emp.rpn = Object.assign({}, emp.rpn || {}, {
                annualTaxCredits: entry.annualTaxCredits || 0,
                taxCredits: remainingTC,
                cutOffPoint: annualCOP,
                periodicTaxCredit: remainingTC / periods,
                periodicStandardRateCutOffPoint: periodicCOP,
                period: getPayFrequencyLabel(payFrequency),
                payFrequency: payFrequency,
                periodsPerYear: periods,
                source: 'submission-refresh'
            });
        });

        PayrollStorage.saveEmployees(PayrollContext.currentCompanyId, employees);
    }

    async function submitSubmissionToRevenue() {
        if (!isCloudMode()) {
            showMessage('Submission to Revenue is only available in Cloud mode.', 'error');
            return;
        }

        let payload = getLatestSubmissionRecord();
        const run = getLatestSubmissionRun();
        if (!payload || !run) {
            showMessage('Generate a submission before submitting to Revenue.', 'error');
            return;
        }

        const submitBtn = document.getElementById('submit-revenue-btn');
        const originalText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        try {
            const psrRequest = buildPSRRequest(run);
            const response = typeof RevenueApi !== 'undefined'
                ? await RevenueApi.submitPSR(psrRequest)
                : null;

            if (!response) {
                throw new Error('Revenue API is unavailable');
            }

            payload = upsertSubmissionFromRun(run, response.status || 'ACCEPTED');
            payload.submissionId = response.submissionId || payload.submissionId;
            payload.message = response.message || payload.message;
            payload.summary = response.summary || payload.summary;
            payload.timestamp = response.timestamp || new Date().toISOString();
            PayrollStorage.saveSubmissions(PayrollContext.currentCompanyId, (PayrollStorage.loadSubmissions(PayrollContext.currentCompanyId) || []).map(function(item) {
                return item.id === payload.id ? payload : item;
            }));

            submitPeriod(true);
            refreshCloudTaxValuesAfterSubmit(run);
            renderSubmission();
            renderSubmissionPayload(payload);
            showMessage('Payroll submitted to fake Revenue server and period advanced.', 'success');
        } catch (err) {
            showMessage('Revenue submission failed: ' + err.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText || 'Submit to Revenue';
            }
        }
    }

    function formatLocalDateTime(value) {
        return PayrollUtils.formatLocalDateTime(value);
    }

    function formatLocalDateOnly(value) {
        return PayrollUtils.formatLocalDateOnly(value);
    }

    function mapRevenueRPNToEmployee(employee, result, payload) {
        const existing = employee.rpn || {};
        const annualTaxCredits = toFiniteNumber(result.yearlyTaxCredit, toFiniteNumber(result.taxCredits, existing.taxCredits || existing.annualTaxCredits));
        const annualCutOffPoint = toFiniteNumber(result.yearlyStandardRateCutOffPoint, toFiniteNumber(result.cutOffPoint, existing.cutOffPoint));
        const payFrequency = getEmployeePayFrequency(employee);
        const periodsPerYear = getPeriodsPerYearForFrequency(payFrequency);

        return Object.assign({}, existing, {
            rpnNumber: String(result.rpnNumber || existing.rpnNumber || ''),
            taxYear: result.taxYear || selectedYear,
            taxCredits: annualTaxCredits,
            annualTaxCredits: annualTaxCredits,
            cutOffPoint: annualCutOffPoint,
            periodicTaxCredit: annualTaxCredits / periodsPerYear,
            periodicStandardRateCutOffPoint: annualCutOffPoint / periodsPerYear,
            period: getPayFrequencyLabel(payFrequency),
            payFrequency: payFrequency,
            periodsPerYear: periodsPerYear,
            prsiClass: result.prsiClass || existing.prsiClass || employee.prsiClass || 'A1',
            uscStatus: result.uscStatus || existing.uscStatus || 'Normal',
            employerPrsiClass: result.employerPrsiClass || existing.employerPrsiClass || result.prsiClass || 'A1',
            previousPay: toFiniteNumber(result.previousPayYTD, toFiniteNumber(result.previousPay, existing.previousPay)),
            previousTax: toFiniteNumber(result.previousTaxYTD, toFiniteNumber(result.previousTax, existing.previousTax)),
            previousUSC: toFiniteNumber(result.previousUSCYTD, toFiniteNumber(result.previousUSC, existing.previousUSC)),
            lptDeduction: toFiniteNumber(result.lptDeduction, existing.lptDeduction),
            basis: result.basis || existing.basis || '',
            ppsn: result.ppsn || employee.ppsNumber || '',
            employmentId: result.employmentId || employee.id,
            message: result.message || '',
            requestId: payload && payload.requestId ? payload.requestId : existing.requestId || '',
            serverTimestamp: payload && payload.timestamp ? payload.timestamp : '',
            uscBands: Array.isArray(result.uscBands) ? result.uscBands : existing.uscBands || [],
            retrievalError: null,
            retrievedAt: new Date().toISOString(),
            source: 'fakeRevenueServer'
        });
    }

    function mapRevenueRPNErrorToEmployee(employee, result, payload) {
        const existing = employee.rpn || {};
        const payFrequency = getEmployeePayFrequency(employee);
        return Object.assign({}, existing, {
            ppsn: result && result.ppsn ? result.ppsn : employee.ppsNumber || '',
            employmentId: result && result.employmentId ? result.employmentId : employee.id,
            period: getPayFrequencyLabel(payFrequency),
            payFrequency: payFrequency,
            periodsPerYear: getPeriodsPerYearForFrequency(payFrequency),
            requestId: payload && payload.requestId ? payload.requestId : existing.requestId || '',
            serverTimestamp: payload && payload.timestamp ? payload.timestamp : '',
            retrievalError: {
                code: result && result.errorCode ? result.errorCode : 'NO_RPN',
                message: result && result.error ? result.error : 'No RPN returned'
            },
            retrievedAt: new Date().toISOString(),
            source: 'fakeRevenueServer'
        });
    }

    function formatRPNDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleString('en-IE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async function retrieveRPNFromRevenueServer(button) {
        if (!PayrollContext.currentCompanyId) {
            showMessage('Select a company before retrieving RPN.', 'error');
            return;
        }

        if (!isCloudMode()) {
            showMessage('RPN retrieval is only available in Cloud mode.', 'error');
            return;
        }

        const employees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];
        if (employees.length === 0) {
            showMessage('No employees found. Add employees before retrieving RPN.', 'error');
            return;
        }

        const company = PayrollStorage.getCompany(PayrollContext.currentCompanyId) || {};
        const originalText = button ? button.textContent : '';
        if (button) {
            button.disabled = true;
            button.textContent = 'Retrieving...';
        }

        try {
            const requestPayload = {
                employerRegistrationNumber: getCompanyTaxNumber(company) || '1234567T',
                taxYear: parseInt(company.taxYear || selectedYear, 10) || 2026,
                employees: employees.map(function(emp) {
                    return {
                        ppsn: emp.ppsNumber || '',
                        employmentId: emp.id,
                        employmentCommencementDate: emp.startDate || emp.employmentCommencementDate || ''
                    };
                })
            };

            const payload = typeof RevenueApi !== 'undefined'
                ? await RevenueApi.retrieveRPN(requestPayload)
                : null;

            if (!payload) {
                throw new Error('Revenue API is unavailable');
            }
            const results = Array.isArray(payload.results) ? payload.results : [];
            const resultsByEmploymentId = {};
            results.forEach(function(result) {
                if (result && result.employmentId) {
                    resultsByEmploymentId[String(result.employmentId)] = result;
                }
            });

            let updated = 0;
            const errors = [];
            employees.forEach(function(emp, index) {
                const result = resultsByEmploymentId[String(emp.id)] || results[index];
                if (!result) {
                    errors.push((emp.firstName || 'Employee') + ' ' + (emp.lastName || '') + ': no RPN returned');
                    emp.rpn = mapRevenueRPNErrorToEmployee(emp, null, payload);
                    return;
                }
                if (result.error || result.errorCode) {
                    errors.push((emp.firstName || 'Employee') + ' ' + (emp.lastName || '') + ': ' + (result.error || result.errorCode));
                    emp.rpn = mapRevenueRPNErrorToEmployee(emp, result, payload);
                    return;
                }

                emp.rpn = mapRevenueRPNToEmployee(emp, result, payload);
                updated++;
            });

            if (!PayrollStorage.saveEmployees(PayrollContext.currentCompanyId, employees)) {
                throw new Error('Failed to save retrieved RPN data');
            }

            initOrSyncLedger(PayrollContext.currentCompanyId, company.taxYear || selectedYear);

            if (typeof PayrollStateMachine !== 'undefined' && PayrollStateMachine.dismissRPNSuggestion) {
                PayrollStateMachine.dismissRPNSuggestion();
            }

            renderRPNOverview();
            syncAllTables();

            if (errors.length > 0) {
                showMessage('Retrieved RPN for ' + updated + ' employee(s). ' + errors.length + ' employee(s) returned errors.', updated > 0 ? 'success' : 'error');
                console.warn('RPN retrieval errors:', errors);
            } else {
                showMessage('Retrieved RPN for ' + updated + ' employee(s) from fake Revenue server.', 'success');
            }
        } catch (err) {
            showMessage('RPN retrieval failed: ' + err.message, 'error');
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = originalText || 'Retrieve RPN';
            }
        }
    }

    // --- RPN Overview Tab ---
    function renderRPNOverview() {
        const container = document.getElementById('rpn-content');
        if (!container) return;

        if (!PayrollContext.currentCompanyId) {
            container.innerHTML = '<div class="empty-state">Select a company to view RPN data.</div>';
            return;
        }

        const employees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];
        if (employees.length === 0) {
            container.innerHTML = '<div class="empty-state"><span class="icon">&#128203;</span><p>No employees found. Add employees to view RPN data.</p></div>';
            return;
        }

        let html = '<h2>Revenue Payroll Notifications (RPN)</h2>';
        html += '<p class="text-secondary">Click an employee row to view their full details.</p>';
        html += '<div class="rpn-actions"><button type="button" class="btn btn-primary" id="rpn-retrieve-btn">Retrieve RPN</button></div>';

        html += '<div class="table-container"><table class="results-table rpn-overview-table">';
        html += '<thead><tr>';
        html += '<th>Employee</th>';
        html += '<th>PPSN</th>';
        html += '<th>Status</th>';
        html += '<th>PAYE Mode</th>';
        html += '<th>RPN Number</th>';
        html += '<th>Period</th>';
        html += '<th>Tax Year</th>';
        html += '<th>Basis</th>';
        html += '<th class="text-right">Annual Tax Credits</th>';
        html += '<th class="text-right">Period Tax Credit</th>';
        html += '<th class="text-right">Annual COP</th>';
        html += '<th class="text-right">Period COP</th>';
        html += '<th>PRSI Class</th>';
        html += '<th>USC Status</th>';
        html += '<th class="text-right">Prev Pay</th>';
        html += '<th class="text-right">Prev Tax</th>';
        html += '<th class="text-right">Prev USC</th>';
        html += '<th class="text-right">LPT</th>';
        html += '<th>Request ID</th>';
        html += '<th>Retrieved</th>';
        html += '<th>Message / Error</th>';
        html += '</tr></thead><tbody>';

        employees.forEach(function(emp) {
            const rpn = emp.rpn || {};
            const name = (emp.firstName || '') + ' ' + (emp.lastName || '');
            const validRpn = hasValidRPN(emp);
            const error = rpn.retrievalError;
            const status = error ? 'Error' : validRpn ? 'Retrieved' : 'Not retrieved';
            const payeMode = validRpn ? 'RPN ' + rpn.rpnNumber : 'Emergency';
            html += '<tr class="rpn-row-clickable' + (error ? ' rpn-error-row' : '') + '" data-emp-id="' + escapeHtml(emp.id) + '">';
            html += '<td>' + escapeHtml(name) + '</td>';
            html += '<td>' + escapeHtml(emp.ppsNumber || rpn.ppsn || '') + '</td>';
            html += '<td>' + escapeHtml(status) + '</td>';
            html += '<td>' + escapeHtml(payeMode) + '</td>';
            html += '<td>' + escapeHtml(rpn.rpnNumber || '') + '</td>';
            html += '<td>' + escapeHtml(rpn.period || getPayFrequencyLabel(getEmployeePayFrequency(emp))) + '</td>';
            html += '<td>' + escapeHtml(rpn.taxYear || '') + '</td>';
            html += '<td>' + escapeHtml(rpn.basis || '') + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(validRpn ? getEmployeeAnnualTaxCredits(emp) : 0) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(rpn.periodicTaxCredit || 0) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(validRpn ? getEmployeeCutOffPoint(emp) : 0) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(rpn.periodicStandardRateCutOffPoint || 0) + '</td>';
            html += '<td>' + escapeHtml(rpn.prsiClass || 'A') + '</td>';
            html += '<td>' + escapeHtml(rpn.uscStatus || 'Normal') + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(rpn.previousPay || 0) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(rpn.previousTax || 0) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(rpn.previousUSC || 0) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(rpn.lptDeduction || 0) + '</td>';
            html += '<td>' + escapeHtml(rpn.requestId || '') + '</td>';
            html += '<td>' + escapeHtml(formatRPNDate(rpn.retrievedAt || rpn.serverTimestamp)) + '</td>';
            html += '<td class="' + (error ? 'rpn-error-text' : '') + '">' + escapeHtml(error ? ((error.code || 'ERROR') + ': ' + (error.message || '')) : (rpn.message || '')) + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        // Bind row clicks -> navigate to employee cart
        container.querySelectorAll('.rpn-row-clickable').forEach(function(row) {
            row.addEventListener('click', function() {
                const empId = row.dataset.empId;
                switchTab('employees');
                if (typeof PayrollEmployees !== 'undefined' && PayrollEmployees.showEmployeeForm) {
                    PayrollEmployees.showEmployeeForm(empId);
                }
            });
        });

        // Bind Retrieve RPN button
        const retrieveBtn = document.getElementById('rpn-retrieve-btn');
        if (retrieveBtn) {
            retrieveBtn.addEventListener('click', function() {
                const apiBase = typeof RevenueApi !== 'undefined' ? RevenueApi.getBaseUrl() : 'http://localhost:3001';
                showConfirmModal('Retrieve RPN from the fake Revenue server? This will update all employee RPN fields using ' + apiBase + '/rpn.', function() {
                    retrieveRPNFromRevenueServer(retrieveBtn);
                });
            });
        }
    }

    function generatePeriodLabel(periodContext) {
        const ctx = periodContext || getCurrentPayPeriodContext();
        const now = ctx.payDate || new Date();
        const config = getCurrentPeriodConfig();

        if (activeTab === 'monthly') {
            const months = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
            return months[now.getMonth()] + ' ' + now.getFullYear() + ' (' + config.label + ')';
        } else if (activeTab === 'weekly') {
            return 'Week ' + ctx.weeklyPeriod + ', ' + now.getFullYear();
        } else if (activeTab === 'fortnightly') {
            return 'Fortnight ' + ctx.fortnightlyPeriod + ', ' + now.getFullYear();
        } else {
            return now.getFullYear() + ' (' + config.label + ')';
        }
    }

    function getCurrentPeriodVar() {
        const periodVar = 'selected' + selectedYear + 'Period';
        return typeof window[periodVar] !== 'undefined' ? window[periodVar] : 'jan-sep';
    }

    // --- Exports & History (delegated to extracted modules) ---
    function exportRunCSV(run) {
        if (typeof PayrollExports !== 'undefined') PayrollExports.exportRunCSV(run);
    }

    function exportRunExcel(run) {
        if (typeof PayrollExports !== 'undefined') PayrollExports.exportRunExcel(run);
    }

    function exportPayslipCSV(entry, run) {
        if (typeof PayrollExports !== 'undefined') PayrollExports.exportPayslipCSV(entry, run);
    }

    function renderTaxCreditsTable() {
        if (typeof PayrollHistory !== 'undefined') PayrollHistory.renderTaxCreditsTable();
    }

    function renderHistory() {
        if (typeof PayrollHistory !== 'undefined') PayrollHistory.renderHistory();
    }

    function expandHistoryItem(runId) {
        if (typeof PayrollHistory !== 'undefined') PayrollHistory.expandHistoryItem(runId);
    }

    function deleteRun(runId) {
        if (typeof PayrollHistory !== 'undefined') PayrollHistory.deleteRun(runId);
    }

    // --- Backup ---
    function handleExportBackup() {
        PayrollStorage.exportBackup();
        showMessage('Backup exported.', 'success');
    }

    function handleImportBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        PayrollStorage.importBackup(file)
            .then(function() {
                showMessage('Backup imported successfully. Please select a company to continue.', 'success');
                exitCompany();
                renderCompanyList();
                event.target.value = '';
            })
            .catch(function(err) {
                showMessage('Import failed: ' + err, 'error');
                event.target.value = '';
            });
    }

    // --- Utilities ---
    function showMessage(text, type) {
        const existing = document.querySelector('.payroll-message');
        if (existing) existing.remove();

        const msg = document.createElement('div');
        msg.className = 'payroll-message ' + (type === 'error' ? 'error-message' : 'success-message');
        msg.textContent = text;

        const main = document.querySelector('.payroll-main');
        if (main) {
            main.insertBefore(msg, main.firstChild);
        } else {
            document.body.appendChild(msg);
        }

        setTimeout(function() {
            if (msg.parentNode) msg.parentNode.removeChild(msg);
        }, 4000);
    }

    function showConfirmModal(message, onConfirm, options) {
        options = options || {};
        var title = options.title || 'Confirm';
        var confirmLabel = options.confirmLabel || 'Confirm';
        var cancelLabel = options.cancelLabel || 'Cancel';
        var variant = options.variant || 'primary';

        var modal = document.getElementById('payroll-confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'payroll-confirm-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML =
                '<div class="modal-content modal-dialog" role="dialog" aria-modal="true" aria-labelledby="payroll-modal-title">' +
                    '<div class="modal-accent"></div>' +
                    '<div class="modal-header">' +
                        '<div class="modal-header-main">' +
                            '<span class="modal-icon" aria-hidden="true"></span>' +
                            '<h3 id="payroll-modal-title" class="modal-title">Confirm</h3>' +
                        '</div>' +
                        '<button type="button" class="modal-close-btn" id="modal-close-btn" aria-label="Close">&times;</button>' +
                    '</div>' +
                    '<div class="modal-body"><p class="modal-message"></p></div>' +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-modal-cancel" id="modal-cancel-btn">Cancel</button>' +
                        '<button type="button" class="btn btn-modal-confirm" id="modal-confirm-btn">Confirm</button>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(modal);

            modal.addEventListener('click', function(event) {
                if (event.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }

        var confirmVariantClass = variant === 'danger' ? 'btn-danger' : (variant === 'warning' ? 'btn-warning' : 'btn-primary');
        modal.querySelector('.modal-title').textContent = title;
        modal.querySelector('.modal-message').textContent = message;
        modal.querySelector('.modal-icon').textContent = variant === 'danger' ? '!' : (variant === 'warning' ? '!' : '?');
        modal.classList.remove('modal-variant-primary', 'modal-variant-danger', 'modal-variant-warning');
        modal.classList.add('modal-variant-' + variant);

        var confirmBtn = modal.querySelector('#modal-confirm-btn');
        var cancelBtn = modal.querySelector('#modal-cancel-btn');
        var closeBtn = modal.querySelector('#modal-close-btn');

        confirmBtn.textContent = confirmLabel;
        confirmBtn.className = 'btn btn-modal-confirm ' + confirmVariantClass;
        cancelBtn.textContent = cancelLabel;

        var newConfirm = confirmBtn.cloneNode(true);
        var newCancel = cancelBtn.cloneNode(true);
        var newClose = closeBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);

        function closeModal() {
            modal.classList.remove('active');
        }

        newConfirm.addEventListener('click', function() {
            closeModal();
            if (typeof onConfirm === 'function') onConfirm();
        });
        newCancel.addEventListener('click', closeModal);
        newClose.addEventListener('click', closeModal);

        modal.classList.add('active');
    }

    function escapeHtml(text) {
        return PayrollUtils.escapeHtml(text);
    }

    function formatNumber(amount) {
        return PayrollUtils.formatNumber(amount);
    }

    function safeFormatCurrency(amount) {
        return PayrollUtils.safeFormatCurrency(amount);
    }

    function wireExtractedModules() {
        if (typeof PayrollExports !== 'undefined') {
            PayrollExports.init({
                getCurrentRunData: function() { return PayrollContext.currentRunData; }
            });
        }
        if (typeof PayrollPayslip !== 'undefined') {
            PayrollPayslip.init({
                getEmployeeAnnualTaxCredits: getEmployeeAnnualTaxCredits,
                getEmployeeCutOffPoint: getEmployeeCutOffPoint,
                initOrSyncLedger: initOrSyncLedger,
                getCompanyTaxNumber: getCompanyTaxNumber,
                getEmployerRegistrationNumber: getEmployerRegistrationNumber,
                generatePeriodLabel: generatePeriodLabel,
                switchTab: switchTab
            });
        }
        if (typeof PayrollRun !== 'undefined') {
            PayrollRun.init({
                getCompanyPayDay: getCompanyPayDay,
                getPayDayLabel: getPayDayLabel,
                getCurrentPayPeriodContext: getCurrentPayPeriodContext,
                getCurrentPeriodVar: getCurrentPeriodVar,
                getPeriodContextFromPayDate: getPeriodContextFromPayDate,
                getRevenueWeekNumberForDate: getRevenueWeekNumberForDate,
                formatDateInputValue: formatDateInputValue,
                escapeHtml: escapeHtml,
                safeFormatCurrency: safeFormatCurrency,
                formatLocalDateTime: formatLocalDateTime,
                formatLocalDateOnly: formatLocalDateOnly,
                isCloudMode: isCloudMode,
                generatePeriodLabel: generatePeriodLabel,
                getPayrollStateSafe: getPayrollStateSafe,
                isFrequencyDueForContext: isFrequencyDueForContext,
                getPeriodNumberForFrequency: getPeriodNumberForFrequency,
                getEmployeePayFrequency: getEmployeePayFrequency,
                getPayFrequencyLabel: getPayFrequencyLabel,
                initOrSyncLedger: initOrSyncLedger,
                getWeek1PeriodicCOPAllocation: getWeek1PeriodicCOPAllocation,
                getEmployeeAnnualTaxCredits: getEmployeeAnnualTaxCredits,
                getEmployeeCutOffPoint: getEmployeeCutOffPoint,
                calculatePAYE: calculatePAYE,
                toFiniteNumber: toFiniteNumber,
                getPeriodicAnnualGross: getPeriodicAnnualGross,
                hasValidRPN: hasValidRPN,
                showMessage: showMessage,
                showConfirmModal: showConfirmModal,
                switchTab: switchTab,
                syncAllTables: syncAllTables
            });
        }
        if (typeof PayrollHistory !== 'undefined') {
            PayrollHistory.init({
                getCompanyId: function() { return PayrollContext.currentCompanyId; },
                getSelectedYear: function() { return selectedYear; },
                initOrSyncLedger: initOrSyncLedger,
                getEmployeePeriodCOP: getEmployeePeriodCOP,
                getEmployeeSubmittedPeriodProgress: getEmployeeSubmittedPeriodProgress,
                getEmployeePayFrequency: getEmployeePayFrequency,
                getTaxSourceDescription: getTaxSourceDescription,
                getCurrentPayPeriodContext: getCurrentPayPeriodContext,
                getWeek1PeriodicCOPAllocation: getWeek1PeriodicCOPAllocation,
                switchTab: switchTab,
                syncAllTables: syncAllTables,
                showConfirmModal: showConfirmModal,
                showMessage: showMessage,
                buildPayrollPreviewDataFromRun: buildPayrollPreviewDataFromRun,
                buildPayrollPreviewHtml: buildPayrollPreviewHtml,
                showPayslip: showPayslip,
                setPayslipReturnTab: function(tab) { PayrollContext.payslipReturnTab = tab; }
            });
        }
    }

    wireExtractedModules();

    // --- Public API ---
    return {
        init: init,
        renderCompanyList: renderCompanyList,
        toggleCompanyDetails: toggleCompanyDetails,
        showCompanyEditForm: showCompanyEditForm,
        saveCompanyEdit: saveCompanyEdit,
        enterCompany: enterCompany,
        exitCompany: exitCompany,
        switchTab: switchTab,
        showRunPayroll: showRunPayroll,
        calculatePayroll: calculatePayroll,
        calculatePAYE: calculatePAYE,
        calculateNormalPAYE: calculateNormalPAYE,
        calculateEmergencyPAYE: calculateEmergencyPAYE,
        calculateTimesheetPreview: calculateTimesheetPreview,
        calculateEstGross: calculateEstGross,
        confirmAndSaveRun: confirmAndSaveRun,
        rollbackLastCommit: rollbackLastCommit,
        submitPeriod: submitPeriod,
        syncAllTables: syncAllTables,
        renderRPNOverview: renderRPNOverview,
        generatePeriodLabel: generatePeriodLabel,
        showPayslip: showPayslip,
        renderEmployeeCardPayslipPanel: renderEmployeeCardPayslipPanel,
        clearEmployeeCardPayslipPanel: clearEmployeeCardPayslipPanel,
        printPayslip: printPayslip,
        exportRunCSV: exportRunCSV,
        exportRunExcel: exportRunExcel,
        exportPayslipCSV: exportPayslipCSV,
        renderHistory: renderHistory,
        expandHistoryItem: expandHistoryItem,
        deleteRun: deleteRun,
        handleExportBackup: handleExportBackup,
        handleImportBackup: handleImportBackup,
        showMessage: showMessage,
        showConfirmModal: showConfirmModal
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    PayrollApp.init();
});
