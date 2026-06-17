// payroll/PayrollRun.js — extracted in Phase 2 (Path A)
// Wired from payroll.js via PayrollRun.init()

var PayrollRun = (function() {
    'use strict';

    var deps = {};

    function init(dependencies) {
        deps = dependencies || {};
    }

    function callDep(name) {
        var fn = deps[name];
        return typeof fn === 'function' ? fn.apply(null, Array.prototype.slice.call(arguments, 1)) : undefined;
    }

    function getCompanyPayDay() { return deps.getCompanyPayDay.apply(deps, arguments); }
    function getPayDayLabel() { return deps.getPayDayLabel.apply(deps, arguments); }
    function getCurrentPayPeriodContext() { return deps.getCurrentPayPeriodContext.apply(deps, arguments); }
    function getCurrentPeriodVar() { return deps.getCurrentPeriodVar.apply(deps, arguments); }
    function getPeriodContextFromPayDate() { return deps.getPeriodContextFromPayDate.apply(deps, arguments); }
    function getRevenueWeekNumberForDate() { return deps.getRevenueWeekNumberForDate.apply(deps, arguments); }
    function formatDateInputValue() { return deps.formatDateInputValue.apply(deps, arguments); }
    function escapeHtml() { return deps.escapeHtml.apply(deps, arguments); }
    function safeFormatCurrency() { return deps.safeFormatCurrency.apply(deps, arguments); }
    function formatLocalDateTime() { return deps.formatLocalDateTime.apply(deps, arguments); }
    function formatLocalDateOnly() { return deps.formatLocalDateOnly.apply(deps, arguments); }
    function isCloudMode() { return deps.isCloudMode.apply(deps, arguments); }
    function generatePeriodLabel() { return deps.generatePeriodLabel.apply(deps, arguments); }
    function getPayrollStateSafe() { return deps.getPayrollStateSafe.apply(deps, arguments); }
    function isFrequencyDueForContext() { return deps.isFrequencyDueForContext.apply(deps, arguments); }
    function getPeriodNumberForFrequency() { return deps.getPeriodNumberForFrequency.apply(deps, arguments); }
    function getEmployeePayFrequency() { return deps.getEmployeePayFrequency.apply(deps, arguments); }
    function getPayFrequencyLabel() { return deps.getPayFrequencyLabel.apply(deps, arguments); }
    function initOrSyncLedger() { return deps.initOrSyncLedger.apply(deps, arguments); }
    function getWeek1PeriodicCOPAllocation() { return deps.getWeek1PeriodicCOPAllocation.apply(deps, arguments); }
    function getEmployeeAnnualTaxCredits() { return deps.getEmployeeAnnualTaxCredits.apply(deps, arguments); }
    function getEmployeeCutOffPoint() { return deps.getEmployeeCutOffPoint.apply(deps, arguments); }
    function calculatePAYE() { return deps.calculatePAYE.apply(deps, arguments); }
    function toFiniteNumber() { return deps.toFiniteNumber.apply(deps, arguments); }
    function getPeriodicAnnualGross() { return deps.getPeriodicAnnualGross.apply(deps, arguments); }
    function hasValidRPN() { return deps.hasValidRPN.apply(deps, arguments); }
    function showMessage() { return deps.showMessage.apply(deps, arguments); }
    function showConfirmModal() { return deps.showConfirmModal.apply(deps, arguments); }
    function switchTab() { return deps.switchTab.apply(deps, arguments); }
    function syncAllTables() { return deps.syncAllTables.apply(deps, arguments); }
    function showPayslipFromEntry() {
        if (typeof PayrollPayslip !== 'undefined' && PayrollPayslip.showPayslipFromEntry) {
            return PayrollPayslip.showPayslipFromEntry.apply(PayrollPayslip, arguments);
        }
    }
    function renderTaxCreditsTable() {
        if (typeof PayrollHistory !== 'undefined' && PayrollHistory.renderTaxCreditsTable) {
            PayrollHistory.renderTaxCreditsTable();
        }
    }
    function expandHistoryItem(runId) {
        if (typeof PayrollHistory !== 'undefined' && PayrollHistory.expandHistoryItem) {
            PayrollHistory.expandHistoryItem(runId);
        }
    }

    function showRunPayroll() {
        const periodInfo = document.getElementById('run-period-info');
        const timesheetForm = document.getElementById('timesheet-form');
        const timesheetPreview = document.getElementById('timesheet-preview');
        const timesheetCommit = document.getElementById('timesheet-commit');
        const resultsDiv = document.getElementById('run-payroll-results');
        const previousConfirmation = document.getElementById('commit-confirmation');

        if (timesheetForm) timesheetForm.classList.add('hidden');
        if (timesheetPreview) timesheetPreview.classList.add('hidden');
        if (timesheetCommit) timesheetCommit.classList.add('hidden');
        if (resultsDiv) resultsDiv.classList.add('hidden');
        if (previousConfirmation) previousConfirmation.remove();

        PayrollContext.currentRunData = null;

        const employees = typeof PayrollEmployees !== 'undefined' && PayrollEmployees.getActiveEmployees
            ? PayrollEmployees.getActiveEmployees()
            : [];
        const smState = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.getState() : null;
        const now = new Date();
        const company = PayrollContext.currentCompanyId ? PayrollStorage.getCompany(PayrollContext.currentCompanyId) : null;
        const companyPayDay = getCompanyPayDay(company);
        const periodContext = getCurrentPayPeriodContext();
        const calendarWeekNumber = periodContext.weeklyPeriod;
        const stateWeekNumber = periodContext.weeklyPeriod;
        const hasPendingCommit = !!(smState && (
            smState.commitCounter > 0 ||
            (smState.committedRunIds && smState.committedRunIds.length > 0) ||
            (typeof PayrollStateMachine !== 'undefined' && PayrollStateMachine.canSubmit && PayrollStateMachine.canSubmit())
        ));

        let html = '<div class="run-info-line">';
        html += '<span><strong>Tax Year:</strong> ' + escapeHtml(selectedYear) + '</span>';
        html += '<span><strong>Tax Period:</strong> ' + escapeHtml(getCurrentPeriodVar() === 'jan-sep' ? 'Jan \u2013 Sep' : 'Oct \u2013 Dec') + '</span>';
        html += '<span><strong>Current Week:</strong> ' + escapeHtml(String(calendarWeekNumber)) + '</span>';
        html += '<span><strong>Pay Date:</strong> ' + escapeHtml(periodContext.payDateDisplay + ' (' + getPayDayLabel(companyPayDay) + ')') + '</span>';
        html += '<span><strong>Active Employees:</strong> ' + employees.length + '</span>';
        html += '</div>';

        if (periodInfo) {
            periodInfo.innerHTML = html;
        }

        if (employees.length === 0 && !hasPendingCommit) {
            if (timesheetForm) {
                timesheetForm.innerHTML = '<p class="empty-state">No active employees. Add employees first.</p>';
                timesheetForm.classList.remove('hidden');
            }
            return;
        }

        const timestampStr = now.toLocaleString('en-IE');

        // Render period status banner
        let formHtml = '';
        if (smState) {
            var monthlyBadgePeriod = periodContext.monthlyPayrollPeriod || 'Not due';
            formHtml += '<div class="period-status-banner">';
            formHtml += '<span class="period-badge">Weekly ' + periodContext.weeklyPeriod + ' / Fortnightly ' + periodContext.fortnightlyPeriod + ' / Monthly ' + monthlyBadgePeriod + '</span>';
            formHtml += '<span class="commit-counter">Commits: ' + smState.commitCounter + '</span>';
            formHtml += '<span class="period-status status-' + smState.status + '">' + (smState.status === 'open' ? '&#9679; Open' : '&#9679; Submitted') + '</span>';
            formHtml += '</div>';
        }

        // RPN suggestion banner
        if (smState && PayrollStateMachine.shouldSuggestRPN()) {
            formHtml += '<div class="rpn-suggestion-banner">';
            formHtml += '<span>New period started. Retrieve up-to-date RPN from the RPN tab before committing payroll.</span>';
            formHtml += '<button type="button" class="btn btn-secondary btn-sm" id="rpn-open-tab-btn">Open RPN tab</button>';
            formHtml += '<button type="button" class="btn btn-secondary btn-sm" id="rpn-dismiss-suggestion-btn">Dismiss</button>';
            formHtml += '</div>';
        }

        if (periodContext.isWeek53Year) {
            var week53BannerText = periodContext.week53Eligible
                ? 'Week 53 year detected for ' + escapeHtml(getPayDayLabel(companyPayDay)) + ' paydays. The 53rd payday applies extra 1/52 tax credits and COP on a forced Week 1 basis. Unused Week 53 credits do not roll over.'
                : 'Week 53 payday rules are disabled for this year because the company pay day was changed mid-year (Revenue does not allow manufactured Week 53).';
            formHtml += '<div class="week53-banner">' + week53BannerText + '</div>';
        }

        if (smState && hasPendingCommit) {
            if (timesheetForm) {
                timesheetForm.innerHTML = formHtml;
                timesheetForm.classList.remove('hidden');
            }
            renderCommittedPayrollPreview(smState);
            if (timesheetCommit) {
                timesheetCommit.innerHTML = buildCommittedPeriodPanel(smState);
                timesheetCommit.classList.remove('hidden');
            }
            bindCommittedPeriodActions();
            bindStateMachineActionButtons();
            bindRPNSuggestionActions();
            return;
        }

        // Render timesheet form
        var weeksInYear = periodContext.weeksInYear;
        var fortnightlyPeriodsInYear = periodContext.fortnightlyPeriodsInYear || 26;

        // Check scheduling eligibility (needed for indicators and timesheet groups)
        var smCurrentWeek = stateWeekNumber;
        var fortnightlyDue = isFrequencyDueForContext('fortnightly', periodContext, smState);
        var monthlyDue = isFrequencyDueForContext('monthly', periodContext, smState);

        formHtml += '<div class="run-payroll-header-fields">';
        formHtml += '<div class="run-field-group">';
        formHtml += '<label>Pay Date</label>';
        formHtml += '<input type="date" class="form-input run-period-input" id="payroll-pay-date" value="' + escapeHtml(periodContext.payDateIso) + '" readonly>';
        formHtml += '<input type="hidden" id="payroll-week-number" value="' + stateWeekNumber + '">';
        formHtml += '</div>';
        formHtml += '<div class="run-field-group">';
        formHtml += '<label>Timestamp</label>';
        formHtml += '<span class="run-field-value" id="run-timestamp">' + escapeHtml(timestampStr) + '</span>';
        formHtml += '</div>';
        formHtml += '</div>';

        // Read-only per-frequency period display
        formHtml += '<div class="frequency-periods-display">';
        formHtml += '<span>Weekly Period: <strong>' + periodContext.weeklyPeriod + '</strong> of ' + weeksInYear + '</span>';
        formHtml += '<span>Fortnightly Period: <strong>' + periodContext.fortnightlyPeriod + '</strong> of ' + fortnightlyPeriodsInYear + '</span>';
        formHtml += '<span>Monthly Period: <strong>' + (periodContext.monthlyPayrollPeriod || 'Not due') + '</strong>' + (periodContext.monthlyPayrollPeriod ? ' of 12' : '') + '</span>';
        formHtml += '</div>';

        // Scheduling indicators showing which frequencies are due
        formHtml += '<div class="scheduling-indicators">';
        formHtml += '<span class="indicator-due">Weekly: Period ' + periodContext.weeklyPeriod + '</span>';
        if (fortnightlyDue) {
            formHtml += '<span class="indicator-due">Fortnightly: Period ' + periodContext.fortnightlyPeriod + '</span>';
        } else {
            formHtml += '<span class="indicator-not-due">Fortnightly: Not active until Period ' + (periodContext.fortnightlyPeriod + 1) + '</span>';
        }
        if (monthlyDue) {
            formHtml += '<span class="indicator-due">Monthly: Period ' + periodContext.monthlyPeriod + '</span>';
        } else {
            var nextMonthlyEvent = periodContext.nextMonthlyPayrollEvent;
            var nextMonthlyText = nextMonthlyEvent
                ? 'Monthly: Not active until Period ' + nextMonthlyEvent.monthlyPeriod + ' on ' + formatLocalDateOnly(nextMonthlyEvent.payDate)
                : 'Monthly: Not active until next monthly pay date';
            formHtml += '<span class="indicator-not-due">' + escapeHtml(nextMonthlyText) + '</span>';
        }
        formHtml += '</div>';

        formHtml += '<h3 class="timesheet-title">Time Sheet</h3>';
        formHtml += '<table class="timesheet-table">';
        formHtml += '<thead><tr><th>Employee</th><th>Period</th><th>Pay Type</th><th>Regular Hours</th><th>Overtime Hours</th><th>Hourly Rate (&euro;)</th><th>Est. Gross</th></tr></thead>';
        formHtml += '<tbody>';

        // Group employees by frequency for sub-headers
        var weeklyEmps = employees.filter(function(e) {
            return e.payFrequency === 'weekly';
        });
        var fortnightlyEmps = employees.filter(function(e) {
            return e.payFrequency === 'fortnightly';
        });
        var monthlyEmps = employees.filter(function(e) {
            return e.payFrequency === 'monthly' || (!e.payFrequency);
        });

        // Check scheduling eligibility (computed above with stateWeekNumber)
        // smCurrentWeek, fortnightlyDue, monthlyDue already set

        // Helper to render a group of employees
        function renderTimesheetGroup(emps, groupLabel, isDue) {
            var groupHtml = '';
            if (emps.length === 0) return groupHtml;

            // Sub-header row
            var labelSuffix = isDue ? '' : ' (Not due this week)';
            var labelStyle = isDue ? '' : ' style="color: #888;"';
            groupHtml += '<tr class="timesheet-group-header" data-frequency-header="' + groupLabel.toLowerCase() + '"><td colspan="7"' + labelStyle + '><strong>' + groupLabel + ' Employees' + labelSuffix + '</strong></td></tr>';

            emps.forEach(function(emp) {
                var empId = escapeHtml(emp.id);
                var isHourly = emp.payType === 'hourly';
                var hourlyRate = toFiniteNumber(emp.hourlyRate, 0);
                var hasHourlyRate = hourlyRate > 0;
                var payTypeClass = isHourly ? 'hourly' : 'salaried';
                var payTypeLabel = isHourly ? 'Hourly' : 'Salaried';
                var empPeriodType = (emp.payFrequency || 'monthly').charAt(0).toUpperCase() + (emp.payFrequency || 'monthly').slice(1);
                var rowClass = isDue ? '' : ' timesheet-row-disabled';
                var standardHours = isHourly ? toFiniteNumber(emp.standardHoursPerWeek, 35) : 0;

                groupHtml += '<tr class="' + rowClass.trim() + '" data-pay-frequency="' + escapeHtml(emp.payFrequency || 'monthly') + '">';
                groupHtml += '<td>' + escapeHtml(emp.firstName + ' ' + emp.lastName) + '</td>';
                groupHtml += '<td class="timesheet-period-type">' + escapeHtml(empPeriodType) + '</td>';
                groupHtml += '<td><span class="pay-type-badge ' + payTypeClass + '">' + payTypeLabel + '</span></td>';

                // Regular Hours
                if (isHourly) {
                    var regDisabled = isDue ? '' : ' disabled';
                    groupHtml += '<td><input type="number" class="timesheet-input" data-emp-id="' + empId + '" data-field="regularHours" min="0" step="0.5" value="' + Number(standardHours).toFixed(1) + '"' + regDisabled + '></td>';
                } else {
                    groupHtml += '<td>\u2014</td>';
                }

                // Overtime Hours
                if (isHourly || hasHourlyRate) {
                    var otDisabled = isDue ? '' : ' disabled';
                    groupHtml += '<td><input type="number" class="timesheet-input" data-emp-id="' + empId + '" data-field="overtimeHours" min="0" step="0.5" value="0"' + otDisabled + '></td>';
                } else {
                    groupHtml += '<td>\u2014</td>';
                }

                // Hourly Rate
                if (isHourly || hasHourlyRate) {
                    var rateDisabled = isDue ? '' : ' disabled';
                    var rateValue = hourlyRate.toFixed(2);
                    groupHtml += '<td><input type="number" class="timesheet-input" data-emp-id="' + empId + '" data-field="hourlyRate" min="0" step="0.5" value="' + rateValue + '"' + rateDisabled + '></td>';
                } else {
                    groupHtml += '<td>\u2014</td>';
                }

                // Est. Gross
                var estGross = safeFormatCurrency(calculateEstGross(emp, standardHours, 0, hourlyRate));
                groupHtml += '<td><span class="est-gross" data-emp-id="' + empId + '">' + estGross + '</span></td>';
                groupHtml += '</tr>';
            });

            return groupHtml;
        }

        // Render weekly group (always due)
        formHtml += renderTimesheetGroup(weeklyEmps, 'Weekly', true);
        // Render fortnightly group
        formHtml += renderTimesheetGroup(fortnightlyEmps, 'Fortnightly', fortnightlyDue);
        // Render monthly group
        formHtml += renderTimesheetGroup(monthlyEmps, 'Monthly', monthlyDue);

        formHtml += '</tbody></table>';
        formHtml += '<button type="button" class="btn btn-primary" id="calc-preview-btn">Calculate Preview</button>';

        if (timesheetForm) {
            timesheetForm.innerHTML = formHtml;
            timesheetForm.classList.remove('hidden');
        }

        // Bind state machine action buttons
        bindStateMachineActionButtons();
        bindRPNSuggestionActions();

        // Bind week number change handler for scheduling display update
        var payrollWeekInput = document.getElementById('payroll-week-number');
        if (payrollWeekInput) {
            payrollWeekInput.addEventListener('change', function() {
                updateSchedulingDisplay(parseInt(payrollWeekInput.value) || 1);
            });
        }

        // Bind live input listeners
        if (timesheetForm) {
            timesheetForm.querySelectorAll('.timesheet-input').forEach(function(input) {
                input.addEventListener('input', function() {
                    updateTimesheetRowGross(input.dataset.empId);
                });
            });
        }

    }

    function buildCommittedPeriodPanel(smState) {
        var runs = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];
        var committedIds = smState.committedRunIds || [];
        var latestRunId = committedIds.length ? committedIds[committedIds.length - 1] : '';
        var committedRuns = runs.filter(function(run) {
            return committedIds.indexOf(run.id) !== -1;
        });
        var totalEmployees = committedRuns.reduce(function(total, run) {
            return total + ((run.entries || []).length);
        }, 0);
        var totalNet = committedRuns.reduce(function(total, run) {
            return total + (run.entries || []).reduce(function(sum, entry) {
                return sum + (entry.netPay || 0);
            }, 0);
        }, 0);
        var latestRun = committedRuns.length ? committedRuns[committedRuns.length - 1] : null;
        var periodSummary = latestRun && latestRun.periodNumbers
            ? 'Pay date ' + formatLocalDateOnly(latestRun.payDate || latestRun.runDate) + ' | Weekly ' + latestRun.periodNumbers.weekly + ', Fortnightly ' + latestRun.periodNumbers.fortnightly + ', Monthly ' + latestRun.periodNumbers.monthly + '.'
            : '';

        var html = '<div class="commit-confirmation post-commit-panel">';
        if (isCloudMode()) {
            html += '<div><strong>Payroll committed and awaiting Revenue submission.</strong>';
            html += '<span>Rollback returns this period to its pre-commit calculation state. Proceed to Submission to generate and submit the Revenue payload.</span></div>';
        } else {
            html += '<div><strong>Payroll committed for this period.</strong>';
            html += '<span>Rollback returns this period to its pre-commit calculation state. Use Submit Period when you are ready to close the period locally.</span></div>';
        }
        html += '<span>' + escapeHtml(smState.commitCounter + ' commit(s), ' + totalEmployees + ' employee calculation(s), net pay ' + safeFormatCurrency(totalNet) + '.') + '</span>';
        if (periodSummary) html += '<span>' + escapeHtml(periodSummary) + '</span>';
        html += '<div class="post-commit-actions">';
        html += '<button type="button" class="btn btn-warning btn-sm" id="post-commit-rollback-btn">Rollback Commit</button>';
        if (isCloudMode()) {
            html += '<button type="button" class="btn btn-success btn-sm" id="post-commit-submit-btn">Proceed to Submission</button>';
        } else {
            html += '<button type="button" class="btn btn-success btn-sm" id="submit-period-btn">Submit Period</button>';
        }
        if (latestRunId) {
            html += '<button type="button" class="btn btn-secondary btn-sm" id="post-commit-history-btn" data-run-id="' + escapeHtml(latestRunId) + '">Open in History</button>';
        }
        html += '</div></div>';
        return html;
    }

    function getCommittedRunsForState(smState) {
        var runs = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];
        var committedIds = smState && smState.committedRunIds ? smState.committedRunIds : [];
        return runs.filter(function(run) {
            return committedIds.indexOf(run.id) !== -1 || run.status === 'committed';
        });
    }

    function buildCommittedRunData(smState) {
        var committedRuns = getCommittedRunsForState(smState);
        var latestRun = committedRuns.length ? committedRuns[committedRuns.length - 1] : null;
        var entries = [];
        committedRuns.forEach(function(run) {
            (run.entries || []).forEach(function(entry) {
                entries.push(entry);
            });
        });
        var totals = entries.reduce(function(total, entry) {
            total.gross += entry.grossPay || 0;
            total.paye += entry.paye || 0;
            total.usc += entry.usc || 0;
            total.prsi += entry.prsi || 0;
            total.totalDeductions += entry.totalDeductions || 0;
            total.net += entry.netPay || 0;
            total.employerPrsi += entry.employerPrsi || 0;
            total.employerCost += entry.employerCost || 0;
            return total;
        }, { gross: 0, paye: 0, usc: 0, prsi: 0, totalDeductions: 0, net: 0, employerPrsi: 0, employerCost: 0 });

        Object.keys(totals).forEach(function(key) {
            totals[key] = Math.round((totals[key] || 0) * 100) / 100;
        });

        var previewCompany = PayrollContext.currentCompanyId ? PayrollStorage.getCompany(PayrollContext.currentCompanyId) : null;
        var previewPayDay = getCompanyPayDay(previewCompany);
        var payDateValue = latestRun && latestRun.payDate ? new Date(latestRun.payDate + 'T00:00:00') : getCurrentPayPeriodContext().payDate;
        var periodContext = latestRun && latestRun.periodNumbers
            ? getPeriodContextFromPayDate(payDateValue, previewPayDay, previewCompany)
            : getPeriodContextFromPayDate(payDateValue, previewPayDay, previewCompany);
        if (latestRun && latestRun.periodNumbers) {
            periodContext.weeklyPeriod = latestRun.periodNumbers.weekly || latestRun.weekNumber || periodContext.weeklyPeriod;
            periodContext.fortnightlyPeriod = latestRun.periodNumbers.fortnightly || periodContext.fortnightlyPeriod;
            periodContext.monthlyPeriod = latestRun.periodNumbers.monthly || periodContext.monthlyPeriod;
        }

        return {
            id: latestRun ? latestRun.id : null,
            runDate: latestRun ? latestRun.runDate : new Date().toISOString(),
            taxYear: latestRun ? latestRun.taxYear : selectedYear,
            payPeriodLabel: latestRun ? latestRun.payPeriodLabel : generatePeriodLabel(periodContext),
            payDate: periodContext.payDateIso,
            periodNumbers: latestRun ? latestRun.periodNumbers : {
                weekly: periodContext.weeklyPeriod,
                fortnightly: periodContext.fortnightlyPeriod,
                monthly: periodContext.monthlyPeriod
            },
            periodContext: periodContext,
            weekNumber: periodContext.weeklyPeriod,
            entries: entries,
            weeklyEntries: entries.filter(function(entry) { return entry.payFrequency === 'weekly'; }),
            fortnightlyEntries: entries.filter(function(entry) { return entry.payFrequency === 'fortnightly'; }),
            monthlyEntries: entries.filter(function(entry) { return entry.payFrequency === 'monthly' || !entry.payFrequency; }),
            totals: totals,
            status: 'committed'
        };
    }

    function renderCommittedPayrollPreview(smState) {
        var previewDiv = document.getElementById('timesheet-preview');
        if (!previewDiv) return;
        PayrollContext.currentRunData = buildCommittedRunData(smState);
        previewDiv.innerHTML = buildPayrollPreviewHtml(PayrollContext.currentRunData, {
            timestamp: PayrollContext.currentRunData.runDate ? formatLocalDateTime(PayrollContext.currentRunData.runDate) : '',
            warnings: []
        });
        previewDiv.classList.remove('hidden');
        bindPayrollPreviewPayslipRows(previewDiv);
    }

    function buildPayrollPreviewDataFromRun(run) {
        var entries = run && Array.isArray(run.entries) ? run.entries : [];
        var totals = entries.reduce(function(total, entry) {
            total.gross += entry.grossPay || 0;
            total.paye += entry.paye || 0;
            total.usc += entry.usc || 0;
            total.prsi += entry.prsi || 0;
            total.totalDeductions += entry.totalDeductions || 0;
            total.net += entry.netPay || 0;
            total.employerPrsi += entry.employerPrsi || 0;
            total.employerCost += entry.employerCost || 0;
            return total;
        }, { gross: 0, paye: 0, usc: 0, prsi: 0, totalDeductions: 0, net: 0, employerPrsi: 0, employerCost: 0 });

        Object.keys(totals).forEach(function(key) {
            totals[key] = Math.round((totals[key] || 0) * 100) / 100;
        });

        var previewCompany = PayrollContext.currentCompanyId ? PayrollStorage.getCompany(PayrollContext.currentCompanyId) : null;
        var previewPayDay = getCompanyPayDay(previewCompany);
        var fallbackDate = run && run.runDate ? new Date(run.runDate) : new Date();
        var payDateValue = run && run.payDate ? new Date(run.payDate + 'T00:00:00') : fallbackDate;
        var periodContext = getPeriodContextFromPayDate(payDateValue, previewPayDay, previewCompany);
        if (run && run.periodNumbers) {
            periodContext.weeklyPeriod = run.periodNumbers.weekly || run.weekNumber || periodContext.weeklyPeriod;
            periodContext.fortnightlyPeriod = run.periodNumbers.fortnightly || periodContext.fortnightlyPeriod;
            periodContext.monthlyPeriod = run.periodNumbers.monthly || periodContext.monthlyPeriod;
            periodContext.monthlyPayrollPeriod = run.periodNumbers.monthly || periodContext.monthlyPayrollPeriod;
        }

        return {
            id: run ? run.id : null,
            runDate: run ? run.runDate : new Date().toISOString(),
            taxYear: run ? run.taxYear : selectedYear,
            payPeriodLabel: run ? run.payPeriodLabel : generatePeriodLabel(periodContext),
            payDate: periodContext.payDateIso,
            periodNumbers: run ? run.periodNumbers : {
                weekly: periodContext.weeklyPeriod,
                fortnightly: periodContext.fortnightlyPeriod,
                monthly: periodContext.monthlyPeriod
            },
            periodContext: periodContext,
            weekNumber: periodContext.weeklyPeriod,
            entries: entries,
            weeklyEntries: entries.filter(function(entry) { return entry.payFrequency === 'weekly'; }),
            fortnightlyEntries: entries.filter(function(entry) { return entry.payFrequency === 'fortnightly'; }),
            monthlyEntries: entries.filter(function(entry) { return entry.payFrequency === 'monthly' || !entry.payFrequency; }),
            totals: totals,
            status: run ? run.status : ''
        };
    }

    function bindStateMachineActionButtons() {
        const rollbackBtn = document.getElementById('rollback-btn');
        if (rollbackBtn) {
            rollbackBtn.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                rollbackLastCommit(true);
            });
        }
        const submitPeriodBtn = document.getElementById('submit-period-btn');
        if (submitPeriodBtn) {
            submitPeriodBtn.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                submitPeriod(true);
            });
        }
    }

    function bindRPNSuggestionActions() {
        const rpnOpenTabBtn = document.getElementById('rpn-open-tab-btn');
        if (rpnOpenTabBtn) {
            rpnOpenTabBtn.addEventListener('click', function() {
                switchTab('rpn');
            });
        }
        const rpnDismissBtn = document.getElementById('rpn-dismiss-suggestion-btn');
        if (rpnDismissBtn) {
            rpnDismissBtn.addEventListener('click', function() {
                PayrollStateMachine.dismissRPNSuggestion();
                var banner = document.querySelector('.rpn-suggestion-banner');
                if (banner) banner.remove();
            });
        }
    }

    function bindCommittedPeriodActions() {
        const rollbackBtn = document.getElementById('post-commit-rollback-btn');
        if (rollbackBtn) {
            rollbackBtn.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                rollbackLastCommit(true);
            });
        }
        const submitBtn = document.getElementById('post-commit-submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                switchTab('submission');
            });
        }
        const historyBtn = document.getElementById('post-commit-history-btn');
        if (historyBtn) {
            historyBtn.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                openCommittedRunInHistory(historyBtn.dataset.runId);
            });
        }
    }

    function updateSchedulingDisplay(currentWeek) {
        var smState = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.getState() : null;
        if (!smState) return;

        var company = PayrollContext.currentCompanyId ? PayrollStorage.getCompany(PayrollContext.currentCompanyId) : null;
        var payDay = getCompanyPayDay(company);
        var periodContext = getPeriodContextFromPayDate(
            getPayDateForRevenueWeek(parseInt(selectedYear, 10) || new Date().getFullYear(), currentWeek, payDay),
            payDay,
            company
        );
        var weeksInYear = periodContext.weeksInYear;
        var fortnightlyPeriodsInYear = periodContext.fortnightlyPeriodsInYear || 26;
        var fortnightlyDue = isFrequencyDueForContext('fortnightly', periodContext, smState);
        var monthlyDue = isFrequencyDueForContext('monthly', periodContext, smState);

        // Update period display
        var periodDisplay = document.querySelector('.frequency-periods-display');
        if (periodDisplay) {
            var spans = periodDisplay.querySelectorAll('span');
            if (spans.length === 3) {
                spans[0].innerHTML = 'Weekly Period: <strong>' + periodContext.weeklyPeriod + '</strong> of ' + weeksInYear;
                spans[1].innerHTML = 'Fortnightly Period: <strong>' + periodContext.fortnightlyPeriod + '</strong> of ' + fortnightlyPeriodsInYear;
                spans[2].innerHTML = 'Monthly Period: <strong>' + (periodContext.monthlyPayrollPeriod || 'Not due') + '</strong>' + (periodContext.monthlyPayrollPeriod ? ' of 12' : '');
            }
        }

        // Update scheduling indicators
        var indicatorsDiv = document.querySelector('.scheduling-indicators');
        if (indicatorsDiv) {
            var spans = indicatorsDiv.querySelectorAll('span');
            if (spans.length === 3) {
                spans[0].className = 'indicator-due';
                spans[0].textContent = 'Weekly: Period ' + periodContext.weeklyPeriod;

                if (fortnightlyDue) {
                    spans[1].className = 'indicator-due';
                    spans[1].textContent = 'Fortnightly: Period ' + periodContext.fortnightlyPeriod;
                } else {
                    spans[1].className = 'indicator-not-due';
                    spans[1].textContent = 'Fortnightly: Not active until Period ' + (periodContext.fortnightlyPeriod + 1);
                }

                if (monthlyDue) {
                    spans[2].className = 'indicator-due';
                    spans[2].textContent = 'Monthly: Period ' + periodContext.monthlyPeriod;
                } else {
                    spans[2].className = 'indicator-not-due';
                    var nextMonthlyEvent = periodContext.nextMonthlyPayrollEvent;
                    spans[2].textContent = nextMonthlyEvent
                        ? 'Monthly: Not active until Period ' + nextMonthlyEvent.monthlyPeriod + ' on ' + formatLocalDateOnly(nextMonthlyEvent.payDate)
                        : 'Monthly: Not active until next monthly pay date';
                }
            }
        }

        function setFrequencyRows(frequency, isDue, label) {
            var header = document.querySelector('tr[data-frequency-header="' + frequency + '"] td');
            if (header) {
                header.style.color = isDue ? '' : '#888';
                header.innerHTML = '<strong>' + label + ' Employees' + (isDue ? '' : ' (Not due this week)') + '</strong>';
            }

            document.querySelectorAll('tr[data-pay-frequency="' + frequency + '"]').forEach(function(row) {
                row.classList.toggle('timesheet-row-disabled', !isDue);
                row.querySelectorAll('input').forEach(function(input) {
                    input.disabled = !isDue;
                });
            });
        }

        setFrequencyRows('weekly', true, 'Weekly');
        setFrequencyRows('fortnightly', fortnightlyDue, 'Fortnightly');
        setFrequencyRows('monthly', monthlyDue, 'Monthly');
    }

    function updateTimesheetRowGross(empId) {
        const employees = typeof PayrollEmployees !== 'undefined' && PayrollEmployees.getActiveEmployees
            ? PayrollEmployees.getActiveEmployees()
            : [];
        const emp = employees.find(function(e) { return e.id === empId; });
        if (!emp) return;

        const regularHoursInput = document.querySelector('.timesheet-input[data-emp-id="' + empId + '"][data-field="regularHours"]');
        const overtimeHoursInput = document.querySelector('.timesheet-input[data-emp-id="' + empId + '"][data-field="overtimeHours"]');
        const hourlyRateInput = document.querySelector('.timesheet-input[data-emp-id="' + empId + '"][data-field="hourlyRate"]');

        const regularHours = regularHoursInput ? parseFloat(regularHoursInput.value) || 0 : 0;
        const overtimeHours = overtimeHoursInput ? parseFloat(overtimeHoursInput.value) || 0 : 0;
        const hourlyRate = hourlyRateInput ? parseFloat(hourlyRateInput.value) || 0 : 0;

        const gross = calculateEstGross(emp, regularHours, overtimeHours, hourlyRate);

        const estGrossSpan = document.querySelector('.est-gross[data-emp-id="' + empId + '"]');
        if (estGrossSpan) {
            estGrossSpan.textContent = safeFormatCurrency(gross);
        }
    }

    function calculateEstGross(emp, regularHours, overtimeHours, hourlyRate) {
        const multiplier = emp.overtimeMultiplier || 1.5;
        const overtimePay = overtimeHours * hourlyRate * multiplier;

        if (emp.payType === 'hourly') {
            return (regularHours * hourlyRate) + overtimePay;
        } else {
            return getPeriodicAnnualGross(emp) + overtimePay;
        }
    }

    function calculatePayroll() {
        calculateTimesheetPreview();
    }

    function validatePayrollPreview() {
        if (!PayrollContext.currentRunData || !PayrollContext.currentRunData.entries) return [];

        const warnings = [];
        const employees = PayrollEmployees.getActiveEmployees();
        const priorRuns = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];
        const currentPeriodLabel = generatePeriodLabel();

        PayrollContext.currentRunData.entries.forEach(function(entry) {
            const emp = employees.find(function(e) { return e.id === entry.employeeId; });
            const empWarnings = [];

            // Missing PPS
            if (!emp || !emp.ppsNumber || emp.ppsNumber.trim() === '') {
                empWarnings.push('Missing PPS number');
            }

            // Zero gross
            if (entry.grossPay === 0) {
                empWarnings.push('Zero gross pay');
            }

            // Negative net pay
            if (entry.netPay < 0) {
                empWarnings.push('Negative net pay');
            }

            // TC exceeds remaining
            const annualTC = getEmployeeAnnualTaxCredits(emp);
            let priorUsed = 0;
            priorRuns.forEach(function(run) {
                const ent = run.entries ? run.entries.find(function(x) { return x.employeeId === entry.employeeId; }) : null;
                if (ent) priorUsed += (ent.taxCreditsUsed || 0);
            });
            if (entry.taxCreditsUsed > (annualTC - priorUsed)) {
                empWarnings.push('TC exceeds remaining balance');
            }

            entry._warnings = empWarnings;
            if (empWarnings.length > 0) {
                warnings.push({ employeeName: entry.employeeName, warnings: empWarnings });
            }
        });

        return warnings;
    }

    function renderFrequencyTable(entries, frequencyLabel, periodNumber, maxPeriods, weekNumber, isDue) {
        // If no employees in this group and not due, skip entirely
        if (entries.length === 0 && !isDue) return '';

        var html = '';

        if (!isDue) {
            html += '<h3 style="color: #888;">' + frequencyLabel + ' Payroll - Not due this period</h3>';
            return html;
        }

        if (entries.length === 0) return '';

        var frequencyClass = String(frequencyLabel || '').toLowerCase();
        html += '<h3>' + frequencyLabel + ' Payroll - Period ' + periodNumber + ' of ' + maxPeriods + ' (Week ' + weekNumber + ')</h3>';
        html += '<div class="table-container"><table class="preview-table preview-table-' + escapeHtml(frequencyClass) + '"><thead><tr>';
        html += '<th>Name</th><th>Week</th><th>Hours</th><th class="text-right">Gross</th>';
        html += '<th class="text-right">PAYE@20%</th><th class="text-right">PAYE@40%</th><th class="text-right">Gross PAYE</th>';
        html += '<th class="text-right">TC Used</th><th class="text-right">Net PAYE</th><th class="text-right">USC</th>';
        html += '<th class="text-right">Emp PRSI</th><th class="text-right">Er PRSI</th><th class="text-right">Total Ded</th>';
        html += '<th class="text-right">Net</th><th class="text-right">Er Cost</th><th>Warnings</th>';
        html += '</tr></thead><tbody>';

        entries.forEach(function(entry) {
            var hoursDisplay = '';
            if (entry.payType === 'hourly') {
                hoursDisplay = (entry.regularHours + entry.overtimeHours).toFixed(1) + ' hrs';
            } else {
                var freqLabel = entry.payFrequency
                    ? entry.payFrequency.charAt(0).toUpperCase() + entry.payFrequency.slice(1)
                    : frequencyLabel;
                hoursDisplay = entry.overtimeHours > 0
                    ? freqLabel + ' + ' + entry.overtimeHours.toFixed(2) + ' OT hrs'
                    : freqLabel;
            }

            var warningHtml = entry._warnings && entry._warnings.length > 0
                ? '<span class="warning-badge" title="' + entry._warnings.join(', ') + '">&#9888; ' + entry._warnings.length + '</span>'
                : '';

            html += '<tr data-employee-id="' + escapeHtml(entry.employeeId) + '" style="cursor:pointer">';
            html += '<td>' + escapeHtml(entry.employeeName) + '</td>';
            html += '<td>' + weekNumber + '</td>';
            html += '<td>' + hoursDisplay + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.grossPay) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.payeAt20) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.payeAt40) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.grossPaye) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.taxCreditsUsed) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.paye) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.usc) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.prsi) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.employerPrsi) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.totalDeductions) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.netPay) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.employerCost) + '</td>';
            html += '<td class="warnings-cell">' + warningHtml + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    }

    function buildPayrollPreviewHtml(runData, options) {
        options = options || {};
        var context = runData.periodContext || getCurrentPayPeriodContext();
        var warnings = options.warnings || [];
        var timestamp = options.timestamp || '';
        var weeksInYear = context.weeksInYear || 52;
        var fortnightlyPeriodsInYear = context.fortnightlyPeriodsInYear || 26;
        var title = options.title || 'Payroll Preview';
        var previewHtml = '<h3>' + escapeHtml(title) + '</h3>';
        previewHtml += '<div class="preview-period-info">';
        previewHtml += '<span><strong>Periods:</strong> ' + escapeHtml('W' + context.weeklyPeriod + ' / F' + context.fortnightlyPeriod + ' / M' + context.monthlyPeriod) + '</span>';
        previewHtml += '<span><strong>Week #:</strong> ' + escapeHtml(String(context.weeklyPeriod)) + '</span>';
        previewHtml += '<span><strong>Pay Date:</strong> ' + escapeHtml(context.payDateDisplay || '') + '</span>';
        if (timestamp) previewHtml += '<span><strong>Timestamp:</strong> ' + escapeHtml(timestamp) + '</span>';
        previewHtml += '</div>';

        previewHtml += renderFrequencyTable(runData.weeklyEntries || [], 'Weekly', context.weeklyPeriod, weeksInYear, context.weeklyPeriod, true);
        previewHtml += renderFrequencyTable(runData.fortnightlyEntries || [], 'Fortnightly', context.fortnightlyPeriod, fortnightlyPeriodsInYear, context.weeklyPeriod, true);
        previewHtml += renderFrequencyTable(runData.monthlyEntries || [], 'Monthly', context.monthlyPeriod, 12, context.weeklyPeriod, true);

        previewHtml += '<div class="table-container"><table class="preview-table"><thead><tr>';
        previewHtml += '<th></th><th></th><th></th><th class="text-right">Gross</th>';
        previewHtml += '<th class="text-right"></th><th class="text-right"></th><th class="text-right"></th>';
        previewHtml += '<th class="text-right"></th><th class="text-right">PAYE</th><th class="text-right">USC</th>';
        previewHtml += '<th class="text-right">PRSI</th><th class="text-right">Er PRSI</th><th class="text-right">Total Ded</th>';
        previewHtml += '<th class="text-right">Net</th><th class="text-right">Er Cost</th><th></th>';
        previewHtml += '</tr></thead><tbody><tr class="totals-row">';
        previewHtml += '<td><strong>Grand Totals</strong></td><td></td><td></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(runData.totals.gross) + '</strong></td>';
        previewHtml += '<td class="text-right"></td><td class="text-right"></td><td class="text-right"></td><td class="text-right"></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(runData.totals.paye) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(runData.totals.usc) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(runData.totals.prsi) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(runData.totals.employerPrsi) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(runData.totals.totalDeductions) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(runData.totals.net) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(runData.totals.employerCost) + '</strong></td>';
        previewHtml += '<td></td></tr></tbody></table></div>';

        if (warnings.length > 0) {
            previewHtml += '<div class="payroll-warnings-banner"><strong>Warnings:</strong><ul>';
            warnings.forEach(function(w) {
                previewHtml += '<li>' + escapeHtml(w.employeeName) + ': ' + escapeHtml(w.warnings.join(', ')) + '</li>';
            });
            previewHtml += '</ul></div>';
        }
        return previewHtml;
    }

    function bindPayrollPreviewPayslipRows(previewDiv) {
        if (!previewDiv) return;
        previewDiv.querySelectorAll('tbody tr[data-employee-id]').forEach(function(row) {
            row.addEventListener('click', function() {
                var empId = row.dataset.employeeId;
                var entry = PayrollContext.currentRunData && PayrollContext.currentRunData.entries
                    ? PayrollContext.currentRunData.entries.find(function(e) { return e.employeeId === empId; })
                    : null;
                if (entry) {
                    PayrollContext.payslipReturnTab = 'run';
                    var entries = PayrollContext.currentRunData.entries;
                    var currentIndex = entries.findIndex(function(e) { return e.employeeId === empId; });
                    showPayslipFromEntry(entry, PayrollContext.currentRunData, entries, currentIndex);
                }
            });
        });
    }

    function calculateTimesheetPreview() {
        try {
            if (typeof calculateNetFromGross !== 'function') {
                showMessage('Tax calculator failed to load. Ensure js/calculator-core.js is available (reload the page after starting the server).', 'error');
                return;
            }

            if (!PayrollContext.currentCompanyId) {
                showMessage('No company selected.', 'error');
                return;
            }

            var employees = typeof PayrollEmployees !== 'undefined' && PayrollEmployees.getActiveEmployees
                ? PayrollEmployees.getActiveEmployees()
                : [];
            if (employees.length === 0) {
                showMessage('No active employees to process.', 'error');
                return;
            }

            initOrSyncLedger(PayrollContext.currentCompanyId, selectedYear);

            // Step 1: Get state and pay-date-derived period numbers
            var state = getPayrollStateSafe();
        var calcCompany = PayrollContext.currentCompanyId ? PayrollStorage.getCompany(PayrollContext.currentCompanyId) : null;
        var calcPayDay = getCompanyPayDay(calcCompany);
        var payDateInput = document.getElementById('payroll-pay-date');
        var payDate = payDateInput && payDateInput.value ? new Date(payDateInput.value + 'T00:00:00') : getCurrentPayPeriodContext().payDate;
        var periodContext = getPeriodContextFromPayDate(payDate, calcPayDay, calcCompany);
        var currentWeek = periodContext.weeklyPeriod;

        // Load prior runs for cumulative TC tracking
        var priorRuns = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];

        // Step 2: Group employees by their payFrequency (hourly employees use their own payFrequency, not forced to weekly)
        var weeklyEmps = employees.filter(function(e) {
            return e.payFrequency === 'weekly';
        });
        var fortnightlyEmps = employees.filter(function(e) {
            return e.payFrequency === 'fortnightly';
        });
        var monthlyEmps = employees.filter(function(e) {
            return e.payFrequency === 'monthly' || (!e.payFrequency);
        });

        // Step 3: Check scheduling eligibility
        var fortnightlyDue = isFrequencyDueForContext('fortnightly', periodContext, state);
        var monthlyDue = isFrequencyDueForContext('monthly', periodContext, state);
        var weeksInYear = periodContext.weeksInYear;
        var fortnightlyPeriodsInYear = periodContext.fortnightlyPeriodsInYear || 26;

        // Step 5: Initialize PayrollContext.currentRunData with separate arrays
        PayrollContext.currentRunData = {
            weeklyEntries: [],
            fortnightlyEntries: [],
            monthlyEntries: [],
            weekNumber: currentWeek,
            payDate: periodContext.payDateIso,
            periodContext: periodContext,
            totals: { gross: 0, paye: 0, usc: 0, prsi: 0, totalDeductions: 0, net: 0, employerPrsi: 0, employerCost: 0 }
        };

        // Save original activeTab so we can restore it after group processing
        var originalActiveTab = activeTab;

        // Step 4: Helper to process a group of employees with correct annualization factor
        function processEmployeeGroup(emps, frequency, totalPeriodsInYear) {
            // Temporarily set activeTab so convertToAnnual/convertFromAnnual use correct divisor
            activeTab = frequency;
            var groupPeriodNumber = getPeriodNumberForFrequency(frequency, periodContext);

            var entries = [];
            emps.forEach(function(emp) {
                try {
                    var empId = emp.id;
                    var regularHoursInput = document.querySelector('.timesheet-input[data-emp-id="' + empId + '"][data-field="regularHours"]');
                    var overtimeHoursInput = document.querySelector('.timesheet-input[data-emp-id="' + empId + '"][data-field="overtimeHours"]');
                    var hourlyRateInput = document.querySelector('.timesheet-input[data-emp-id="' + empId + '"][data-field="hourlyRate"]');

                    var regularHours = regularHoursInput ? parseFloat(regularHoursInput.value) || 0 : 0;
                    var overtimeHours = overtimeHoursInput ? parseFloat(overtimeHoursInput.value) || 0 : 0;
                    var hourlyRate = hourlyRateInput ? parseFloat(hourlyRateInput.value) || 0 : 0;

                    var periodGross = calculateEstGross(emp, regularHours, overtimeHours, hourlyRate);

                    // Apply pension deduction (reduces taxable income for PAYE and USC)
                    var pensionPct = (emp.rpn && emp.rpn.pensionPct) ? emp.rpn.pensionPct : 0;
                    var avc = (emp.rpn && emp.rpn.avc) ? emp.rpn.avc : 0;
                    var periodPensionDeduction = (periodGross * pensionPct / 100) + convertFromAnnual(avc);

                    // Add BIK to taxable gross (not to actual pay)
                    var bik = (emp.rpn && emp.rpn.bik) ? emp.rpn.bik : 0;
                    var periodBik = convertFromAnnual(bik);

                    // Taxable gross = gross - pension + BIK (for tax calculation purposes)
                    var taxableGross = Math.max(periodGross - periodPensionDeduction + periodBik, 0);
                    var annualizedTaxable = convertToAnnual(taxableGross);
                    var familyStatus = emp.familyStatus || 'single';

                    // Determine cut-off point (standard rate band) from RPN/ledger/defaults
                    var ledgerEntry = PayrollStorage.getEmployeeLedgerEntry(PayrollContext.currentCompanyId, emp.id, selectedYear);
                    var annualCutOff = ledgerEntry.cutOffPoint || getEmployeeCutOffPoint(emp);
                    var annualTC = ledgerEntry.annualTaxCredits || getEmployeeAnnualTaxCredits(emp);
                    var week53Ctx = typeof PayrollWeek53 !== 'undefined' && PayrollWeek53.buildPayrollWeek53Context
                        ? PayrollWeek53.buildPayrollWeek53Context(payDate, calcPayDay, frequency, calcCompany)
                        : null;
                    var payeResult = calculatePAYE(emp, taxableGross, emp.weeksOnEmergency || 0, totalPeriodsInYear, week53Ctx);
                    var payeAt20Annual = payeResult.taxAt20 * totalPeriodsInYear;
                    var payeAt40Annual = payeResult.taxAt40 * totalPeriodsInYear;
                    var grossPayeAnnual = payeResult.taxBeforeCredit * totalPeriodsInYear;

                    // USC and PRSI still use the shared engine (they don't depend on cut-off)
                    var result = calculateNetFromGross(annualizedTaxable, familyStatus);

                    // Build correct PAYE breakdown using the employee's actual cut-off
                    var standardRateIncome = payeResult.taxableAt20 * totalPeriodsInYear;
                    var higherRateIncome = payeResult.taxableAt40 * totalPeriodsInYear;
                    var payeBreakdownData = {
                        grossIncome: annualizedTaxable,
                        periodGross: taxableGross,
                        period: frequency === 'weekly' ? 'Weekly' : frequency === 'fortnightly' ? 'Fortnightly' : 'Monthly',
                        bands: [],
                        grossTax: grossPayeAnnual,
                        taxCredits: payeResult.taxCreditUsed * totalPeriodsInYear,
                        periodTaxCredits: payeResult.taxCreditUsed,
                        standardBand: payeResult.copUsed * totalPeriodsInYear,
                        periodStandardBand: payeResult.copUsed,
                        netTax: payeResult.paye * totalPeriodsInYear,
                        status: payeResult.mode
                    };
                    if (standardRateIncome > 0) {
                        payeBreakdownData.bands.push({
                            rate: 0.2,
                            rateDisplay: '20',
                            taxableAmount: payeResult.taxableAt20,
                            annualTaxableAmount: standardRateIncome,
                            tax: payeResult.taxAt20,
                            annualTax: payeAt20Annual,
                            description: 'Standard rate'
                        });
                    }
                    if (higherRateIncome > 0) {
                        payeBreakdownData.bands.push({
                            rate: 0.4,
                            rateDisplay: '40',
                            taxableAmount: payeResult.taxableAt40,
                            annualTaxableAmount: higherRateIncome,
                            tax: payeResult.taxAt40,
                            annualTax: payeAt40Annual,
                            description: 'Higher rate'
                        });
                    }

                    // Employer PRSI: 11.05% standard, 8.8% if weekly equivalent <= €441
                    var weeklyEquivalent = periodGross * (frequency === 'weekly' ? 1 : frequency === 'fortnightly' ? 0.5 : 12/52);
                    var employerPrsiRate = weeklyEquivalent <= 441 ? 0.088 : 0.1105;
                    var employerPrsi = periodGross * employerPrsiRate;
                    var employerCost = periodGross + employerPrsi;

                    var grossPay = periodGross;
                    var usc = convertFromAnnual(result.usc);
                    var prsi = convertFromAnnual(result.prsi);
                    var regularGross = emp.payType === 'hourly' ? (regularHours * hourlyRate) : convertFromAnnual(emp.annualGross || 0);
                    var overtimeGross = overtimeHours * hourlyRate * (emp.overtimeMultiplier || 1.5);

                    // Cumulative TC tracking via ledger
                    var remainingTC = ledgerEntry.remaining || 0;

                    // Count committed periods for this employee (lightweight loop)
                    var committedPeriods = 0;
                    priorRuns.forEach(function(run) {
                        if (run.entries && run.entries.find(function(e) { return e.employeeId === emp.id; })) committedPeriods++;
                    });
                    var periodsRemaining = Math.max(totalPeriodsInYear - committedPeriods, 1);
                    var currentPeriodTC = remainingTC / periodsRemaining;

                    // Override PAYE with our TC logic
                    var grossPaye = payeResult.taxBeforeCredit;
                    var actualTCUsed = payeResult.taxCreditUsed;
                    var netPaye = payeResult.paye;

                    var paye = netPaye;
                    var taxCreditsUsed = actualTCUsed;
                    payeBreakdownData.periodTaxCredits = taxCreditsUsed;
                    payeBreakdownData.taxCredits = taxCreditsUsed * totalPeriodsInYear;
                    payeBreakdownData.netTax = paye * totalPeriodsInYear;
                    var totalDeductions = paye + usc + prsi + periodPensionDeduction;
                    var netPay = grossPay - totalDeductions;

                    entries.push({
                        employeeId: emp.id,
                        employeeName: emp.firstName + ' ' + emp.lastName,
                        periodType: (emp.payFrequency || frequency).charAt(0).toUpperCase() + (emp.payFrequency || frequency).slice(1),
                        payFrequency: frequency,
                        periodNumber: groupPeriodNumber,
                        payDate: periodContext.payDateIso,
                        grossPay: grossPay,
                        paye: paye,
                        usc: usc,
                        prsi: prsi,
                        totalDeductions: totalDeductions,
                        netPay: netPay,
                        taxCreditsUsed: taxCreditsUsed,
                        payType: emp.payType || 'salaried',
                        regularHours: regularHours,
                        overtimeHours: overtimeHours,
                        hourlyRate: hourlyRate,
                        overtimeMultiplier: emp.overtimeMultiplier || 1.5,
                        regularGross: regularGross,
                        overtimeGross: overtimeGross,
                        payeAt20: convertFromAnnual(payeAt20Annual),
                        payeAt40: convertFromAnnual(payeAt40Annual),
                        grossPaye: grossPaye,
                        employerPrsi: employerPrsi,
                        employerCost: employerCost,
                        pensionDeduction: periodPensionDeduction,
                        bikAmount: periodBik,
                        payeMode: payeResult.mode,
                        payeSource: payeResult.source,
                        isWeek53Run: !!(week53Ctx && week53Ctx.isWeek53Run),
                        week53ForcedWeek1: !!payeResult.week53ForcedWeek1,
                        week53CreditCapped: !!payeResult.week53CreditCapped,
                        copUsed: payeResult.copUsed,
                        standardRateTaxablePeriod: payeResult.taxableAt20 || 0,
                        _payeBreakdown: payeBreakdownData,
                        _uscBreakdown: result.uscBreakdown,
                        _prsiBreakdown: result.prsiBreakdown
                    });

                    PayrollContext.currentRunData.totals.gross += grossPay;
                    PayrollContext.currentRunData.totals.paye += paye;
                    PayrollContext.currentRunData.totals.usc += usc;
                    PayrollContext.currentRunData.totals.prsi += prsi;
                    PayrollContext.currentRunData.totals.totalDeductions += totalDeductions;
                    PayrollContext.currentRunData.totals.net += netPay;
                    PayrollContext.currentRunData.totals.employerPrsi += employerPrsi;
                    PayrollContext.currentRunData.totals.employerCost += employerCost;
                } catch (err) {
                    console.error('Calculation error for employee', emp.id, err);
                }
            });

            return entries;
        }

        // Calculate weekly group (always due)
        PayrollContext.currentRunData.weeklyEntries = processEmployeeGroup(weeklyEmps, 'weekly', weeksInYear);

        // Calculate fortnightly group (only if due)
        if (fortnightlyDue) {
            PayrollContext.currentRunData.fortnightlyEntries = processEmployeeGroup(fortnightlyEmps, 'fortnightly', fortnightlyPeriodsInYear);
        }

        // Calculate monthly group (only if due)
        if (monthlyDue) {
            PayrollContext.currentRunData.monthlyEntries = processEmployeeGroup(monthlyEmps, 'monthly', 12);
        }

        // Restore original activeTab
        activeTab = originalActiveTab;

        // Step 5: Combined entries for backward compatibility with commit flow
        PayrollContext.currentRunData.entries = PayrollContext.currentRunData.weeklyEntries.concat(PayrollContext.currentRunData.fortnightlyEntries).concat(PayrollContext.currentRunData.monthlyEntries);

        // Round totals
        PayrollContext.currentRunData.totals.gross = Math.round(PayrollContext.currentRunData.totals.gross * 100) / 100;
        PayrollContext.currentRunData.totals.paye = Math.round(PayrollContext.currentRunData.totals.paye * 100) / 100;
        PayrollContext.currentRunData.totals.usc = Math.round(PayrollContext.currentRunData.totals.usc * 100) / 100;
        PayrollContext.currentRunData.totals.prsi = Math.round(PayrollContext.currentRunData.totals.prsi * 100) / 100;
        PayrollContext.currentRunData.totals.totalDeductions = Math.round(PayrollContext.currentRunData.totals.totalDeductions * 100) / 100;
        PayrollContext.currentRunData.totals.net = Math.round(PayrollContext.currentRunData.totals.net * 100) / 100;
        PayrollContext.currentRunData.totals.employerPrsi = Math.round(PayrollContext.currentRunData.totals.employerPrsi * 100) / 100;
        PayrollContext.currentRunData.totals.employerCost = Math.round(PayrollContext.currentRunData.totals.employerCost * 100) / 100;

        // Run validation
        var allWarnings = validatePayrollPreview();

        if (!PayrollContext.currentRunData.entries || PayrollContext.currentRunData.entries.length === 0) {
            showMessage('No payroll calculations were produced. Check the browser console for employee errors.', 'error');
            return;
        }

        // Read period info values from input fields and state
        var runPeriodNumber = 'W' + periodContext.weeklyPeriod + ' / F' + periodContext.fortnightlyPeriod + ' / M' + periodContext.monthlyPeriod;
        var runWeekNumber = String(periodContext.weeklyPeriod);
        var runTimestamp = document.getElementById('run-timestamp') ? document.getElementById('run-timestamp').textContent : '';

        // Render three frequency tables
        var previewDiv = document.getElementById('timesheet-preview');
        var previewHtml = '<h3>Payroll Preview</h3>';
        previewHtml += '<div class="preview-period-info">';
        previewHtml += '<span><strong>Periods:</strong> ' + escapeHtml(runPeriodNumber) + '</span>';
        previewHtml += '<span><strong>Week #:</strong> ' + escapeHtml(runWeekNumber) + '</span>';
        previewHtml += '<span><strong>Pay Date:</strong> ' + escapeHtml(periodContext.payDateDisplay) + '</span>';
        previewHtml += '<span><strong>Timestamp:</strong> ' + escapeHtml(runTimestamp) + '</span>';
        previewHtml += '</div>';

        previewHtml += renderFrequencyTable(PayrollContext.currentRunData.weeklyEntries, 'Weekly', periodContext.weeklyPeriod, weeksInYear, currentWeek, true);
        previewHtml += renderFrequencyTable(PayrollContext.currentRunData.fortnightlyEntries, 'Fortnightly', periodContext.fortnightlyPeriod, fortnightlyPeriodsInYear, currentWeek, fortnightlyDue);
        previewHtml += renderFrequencyTable(PayrollContext.currentRunData.monthlyEntries, 'Monthly', periodContext.monthlyPeriod, 12, currentWeek, monthlyDue);

        // Combined totals row across all frequency tables
        previewHtml += '<div class="table-container"><table class="preview-table"><thead><tr>';
        previewHtml += '<th></th><th></th><th></th><th class="text-right">Gross</th>';
        previewHtml += '<th class="text-right"></th><th class="text-right"></th><th class="text-right"></th>';
        previewHtml += '<th class="text-right"></th><th class="text-right">PAYE</th><th class="text-right">USC</th>';
        previewHtml += '<th class="text-right">PRSI</th><th class="text-right">Er PRSI</th><th class="text-right">Total Ded</th>';
        previewHtml += '<th class="text-right">Net</th><th class="text-right">Er Cost</th><th></th>';
        previewHtml += '</tr></thead><tbody>';
        previewHtml += '<tr class="totals-row">';
        previewHtml += '<td><strong>Grand Totals</strong></td>';
        previewHtml += '<td></td>';
        previewHtml += '<td></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(PayrollContext.currentRunData.totals.gross) + '</strong></td>';
        previewHtml += '<td class="text-right"></td>';
        previewHtml += '<td class="text-right"></td>';
        previewHtml += '<td class="text-right"></td>';
        previewHtml += '<td class="text-right"></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(PayrollContext.currentRunData.totals.paye) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(PayrollContext.currentRunData.totals.usc) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(PayrollContext.currentRunData.totals.prsi) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(PayrollContext.currentRunData.totals.employerPrsi) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(PayrollContext.currentRunData.totals.totalDeductions) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(PayrollContext.currentRunData.totals.net) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(PayrollContext.currentRunData.totals.employerCost) + '</strong></td>';
        previewHtml += '<td></td>';
        previewHtml += '</tr></tbody></table></div>';

        if (allWarnings.length > 0) {
            previewHtml += '<div class="payroll-warnings-banner">';
            previewHtml += '<strong>Warnings:</strong><ul>';
            allWarnings.forEach(function(w) {
                previewHtml += '<li>' + w.employeeName + ': ' + w.warnings.join(', ') + '</li>';
            });
            previewHtml += '</ul></div>';
        }

        if (previewDiv) {
            previewDiv.innerHTML = previewHtml;
            previewDiv.classList.remove('hidden');
        }

        // Bind row clicks for payslip
        if (previewDiv) {
            previewDiv.querySelectorAll('tbody tr[data-employee-id]').forEach(function(row) {
                row.addEventListener('click', function() {
                    var empId = row.dataset.employeeId;
                    var entry = PayrollContext.currentRunData.entries.find(function(e) { return e.employeeId === empId; });
                    if (entry) {
                        PayrollContext.payslipReturnTab = 'run';
                        var entries = PayrollContext.currentRunData.entries;
                        var currentIndex = entries.findIndex(function(e) { return e.employeeId === empId; });
                        showPayslipFromEntry(entry, PayrollContext.currentRunData, entries, currentIndex);
                    }
                });
            });
        }

        // Render commit button
        var commitDiv = document.getElementById('timesheet-commit');
        if (commitDiv) {
            commitDiv.innerHTML = '<button type="button" class="btn btn-primary" id="commit-payroll-btn">Commit to Payroll</button>';
            commitDiv.classList.remove('hidden');
        }

        // Synchronize Tax Credits table on calculate (simultaneous update)
        renderTaxCreditsTable();
        } catch (err) {
            console.error('Calculate preview failed:', err);
            showMessage('Calculate preview failed: ' + (err && err.message ? err.message : 'Unknown error'), 'error');
        }
    }

    function confirmAndSaveRun() {
        if (!PayrollContext.currentRunData || !PayrollContext.currentRunData.entries || PayrollContext.currentRunData.entries.length === 0) {
            showMessage('No payroll data to save.', 'error');
            return;
        }

        if (!PayrollContext.currentCompanyId) {
            showMessage('No company selected.', 'error');
            return;
        }

        const employees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];

        // Calculate TC before/after for each employee
        const priorRuns = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];
        const periodStateBeforeCommit = JSON.parse(JSON.stringify(PayrollStateMachine.getState()));
        const periodContext = PayrollContext.currentRunData.periodContext || getCurrentPayPeriodContext();
        const employeeEmergencySnapshots = {};
        employees.forEach(function(emp) {
            employeeEmergencySnapshots[emp.id] = {
                weeksOnEmergency: emp.weeksOnEmergency || 0,
                emergencyStartDate: emp.emergencyStartDate || ''
            };
        });

        const run = {
            id: PayrollStorage.generateId(),
            runDate: new Date().toISOString(),
            payDate: periodContext.payDateIso,
            payPeriodLabel: generatePeriodLabel(periodContext),
            taxYear: selectedYear,
            taxPeriod: getCurrentPeriodVar(),
            frequency: activeTab,
            periodType: (function() {
                var smState = PayrollStateMachine.getState();
                return smState && smState.weekly ? 'weekly' : 'monthly';
            })(),
            periodNumber: (function() {
                return periodContext.weeklyPeriod;
            })(),
            periodNumbers: {
                weekly: periodContext.weeklyPeriod,
                fortnightly: periodContext.fortnightlyPeriod,
                monthly: periodContext.monthlyPeriod
            },
            periodStateBeforeCommit: periodStateBeforeCommit,
            employeeEmergencySnapshots: employeeEmergencySnapshots,
            weekNumber: periodContext.weeklyPeriod,
            frequenciesIncluded: (function() {
                var freq = [];
                if (PayrollContext.currentRunData.weeklyEntries && PayrollContext.currentRunData.weeklyEntries.length > 0) freq.push('weekly');
                if (PayrollContext.currentRunData.fortnightlyEntries && PayrollContext.currentRunData.fortnightlyEntries.length > 0) freq.push('fortnightly');
                if (PayrollContext.currentRunData.monthlyEntries && PayrollContext.currentRunData.monthlyEntries.length > 0) freq.push('monthly');
                return freq;
            })(),
            entries: PayrollContext.currentRunData.entries.map(function(e) {
                return {
                    employeeId: e.employeeId,
                    employeeName: e.employeeName,
                    periodType: e.periodType || 'monthly',
                    payFrequency: e.payFrequency || '',
                    periodNumber: e.periodNumber || getPeriodNumberForFrequency(e.payFrequency || 'monthly', periodContext),
                    payDate: e.payDate || periodContext.payDateIso,
                    grossPay: e.grossPay,
                    paye: e.paye,
                    usc: e.usc,
                    prsi: e.prsi,
                    totalDeductions: e.totalDeductions,
                    netPay: e.netPay,
                    taxCreditsUsed: e.taxCreditsUsed,
                    payType: e.payType,
                    regularHours: e.regularHours,
                    overtimeHours: e.overtimeHours,
                    hourlyRate: e.hourlyRate,
                    overtimeMultiplier: e.overtimeMultiplier,
                    regularGross: e.regularGross,
                    overtimeGross: e.overtimeGross,
                    payeAt20: e.payeAt20,
                    payeAt40: e.payeAt40,
                    grossPaye: e.grossPaye,
                    employerPrsi: e.employerPrsi,
                    employerCost: e.employerCost,
                    pensionDeduction: e.pensionDeduction || 0,
                    bikAmount: e.bikAmount || 0,
                    payeMode: e.payeMode || '',
                    payeSource: e.payeSource || '',
                    isWeek53Run: !!e.isWeek53Run,
                    week53ForcedWeek1: !!e.week53ForcedWeek1,
                    week53CreditCapped: !!e.week53CreditCapped,
                    copUsed: e.copUsed || 0,
                    tcRemainingBefore: (function() {
                        const emp = employees.find(function(emp) { return emp.id === e.employeeId; });
                        const annualTC = getEmployeeAnnualTaxCredits(emp);
                        let used = 0;
                        priorRuns.forEach(function(run) {
                            const ent = run.entries ? run.entries.find(function(x) { return x.employeeId === e.employeeId; }) : null;
                            if (ent) used += (ent.taxCreditsUsed || 0);
                        });
                        return annualTC - used;
                    })(),
                    tcRemainingAfter: (function() {
                        const emp = employees.find(function(emp) { return emp.id === e.employeeId; });
                        const annualTC = getEmployeeAnnualTaxCredits(emp);
                        let used = 0;
                        priorRuns.forEach(function(run) {
                            const ent = run.entries ? run.entries.find(function(x) { return x.employeeId === e.employeeId; }) : null;
                            if (ent) used += (ent.taxCreditsUsed || 0);
                        });
                        return (annualTC - used) - (e.taxCreditsUsed || 0);
                    })(),
                    rpnSnapshot: (function() {
                        const emp = employees.find(function(emp) { return emp.id === e.employeeId; });
                        const rpn = emp && emp.rpn ? emp.rpn : {};
                        const periods = e.payFrequency === 'weekly' ? 52 : e.payFrequency === 'fortnightly' ? 26 : 12;
                        return {
                            rpnNumber: rpn.rpnNumber || '',
                            taxCredits: (e.taxCreditsUsed || 0) * periods,
                            cutOffPoint: (e.copUsed || 0) * periods,
                            periodicTaxCredit: e.taxCreditsUsed || 0,
                            periodicStandardRateCutOffPoint: e.copUsed || 0,
                            prsiClass: rpn.prsiClass || '',
                            basis: rpn.basis || '',
                            uscStatus: rpn.uscStatus || '',
                            employerPrsiClass: rpn.employerPrsiClass || '',
                            previousPay: rpn.previousPay || 0,
                            previousTax: rpn.previousTax || 0,
                            previousUSC: rpn.previousUSC || 0,
                            bik: rpn.bik || 0,
                            pensionPct: rpn.pensionPct || 0,
                            avc: rpn.avc || 0
                        };
                    })()
                };
            })
        };

        const success = PayrollStateMachine.performCommit(run);
        if (success) {
            // Update tax credits ledger for committed entries
            var commitYear = run.taxYear || selectedYear;
            initOrSyncLedger(PayrollContext.currentCompanyId, commitYear);
            var commitLedger = PayrollStorage.loadTaxCreditsLedger(PayrollContext.currentCompanyId);
            var commitEmployees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];
            var commitEmployeeById = {};
            commitEmployees.forEach(function(emp) { commitEmployeeById[emp.id] = emp; });
            run.entries.forEach(function(entry) {
                if (commitLedger[entry.employeeId] && commitLedger[entry.employeeId][commitYear]) {
                    var le = commitLedger[entry.employeeId][commitYear];
                    var emp = commitEmployeeById[entry.employeeId];
                    var week1CopSlot = emp
                        ? getWeek1PeriodicCOPAllocation(le.cutOffPoint, emp)
                        : ((le.cutOffPoint || 0) / 52);
                    le.taxCreditsUsed = (le.taxCreditsUsed || 0) + (entry.taxCreditsUsed || 0);
                    le.copUsed = (le.copUsed || 0) + week1CopSlot;
                    le.remaining = le.annualTaxCredits - le.taxCreditsUsed;
                    le.copRemaining = le.cutOffPoint - le.copUsed;
                    le.lastUpdated = new Date().toISOString();
                }
            });
            PayrollStorage.saveTaxCreditsLedger(PayrollContext.currentCompanyId, commitLedger);
            updateEmergencyTrackingAfterRun(run);

            // Advance per-frequency period counters via state machine API
            PayrollStateMachine.advanceFrequencyCounters(run.frequenciesIncluded || [], run.weekNumber, run.periodNumbers);

            const smState = PayrollStateMachine.getState();
            PayrollContext.currentRunData = null;
            document.getElementById('run-payroll-results').classList.add('hidden');
            const timesheetForm = document.getElementById('timesheet-form');
            const timesheetPreview = document.getElementById('timesheet-preview');
            const timesheetCommit = document.getElementById('timesheet-commit');
            if (timesheetForm) timesheetForm.classList.add('hidden');
            if (timesheetPreview) timesheetPreview.classList.remove('hidden');
            if (timesheetCommit) {
                timesheetCommit.innerHTML = buildCommittedPeriodPanel(smState);
                timesheetCommit.classList.remove('hidden');
            }
            syncAllTables();
            bindCommittedPeriodActions();
        } else {
            showMessage('Failed to save payroll run.', 'error');
        }
    }

    function closeActionModal() {
        const modal = document.getElementById('payroll-action-modal');
        if (modal) modal.classList.remove('active');
    }

    function openCommittedRunInHistory(runId) {
        switchTab('history');
        renderHistory();
        expandHistoryItem(runId);

        const item = document.querySelector('.history-item[data-run-id="' + runId + '"]');
        if (item && item.scrollIntoView) {
            item.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function getEmergencyPeriodWeeks(payFrequency) {
        if (payFrequency === 'fortnightly') return 2;
        if (payFrequency === 'monthly') return 4;
        return 1;
    }

    function updateEmergencyTrackingAfterRun(run) {
        const employees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];
        let changed = false;
        employees.forEach(function(emp) {
            const entry = (run.entries || []).find(function(e) { return e.employeeId === emp.id; });
            if (!entry) return;
            if (hasValidRPN(emp)) {
                if (emp.weeksOnEmergency || emp.emergencyStartDate) {
                    emp.weeksOnEmergency = 0;
                    emp.emergencyStartDate = '';
                    changed = true;
                }
                return;
            }
            emp.weeksOnEmergency = (parseInt(emp.weeksOnEmergency, 10) || 0) + getEmergencyPeriodWeeks(entry.payFrequency || emp.payFrequency);
            if (!emp.emergencyStartDate) {
                emp.emergencyStartDate = new Date().toISOString().split('T')[0];
            }
            changed = true;
        });
        if (changed) {
            PayrollStorage.saveEmployees(PayrollContext.currentCompanyId, employees);
        }
    }

    // --- Rollback Last Commit ---
    function rollbackLastCommit(skipConfirm) {
        if (!PayrollStateMachine.canRollback()) {
            showMessage('Nothing to rollback.', 'error');
            return;
        }
        function performRollbackAction() {
            // Capture run entries BEFORE rollback deletes the run
            var committedRunIds = PayrollStateMachine.getCommittedRunIds();
            var lastRunId = committedRunIds.length > 0 ? committedRunIds[committedRunIds.length - 1] : null;
            var rolledBackEntries = [];
            var rolledBackYear = selectedYear;
            var rolledBackRun = null;
            if (lastRunId) {
                var allRuns = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];
                var lastRun = allRuns.find(function(r) { return r.id === lastRunId; });
                if (lastRun) {
                    rolledBackRun = lastRun;
                    rolledBackEntries = lastRun.entries || [];
                    rolledBackYear = lastRun.taxYear || selectedYear;
                }
            }

            const success = PayrollStateMachine.performRollback();
            if (success) {
                if (rolledBackRun && rolledBackRun.periodStateBeforeCommit && PayrollStateMachine.restorePeriodState) {
                    PayrollStateMachine.restorePeriodState(rolledBackRun.periodStateBeforeCommit);
                }

                // Reverse ledger entries for rolled-back run
                if (rolledBackEntries.length > 0) {
                    var rbLedger = PayrollStorage.loadTaxCreditsLedger(PayrollContext.currentCompanyId);
                    var rbEmployees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];
                    var rbEmployeeById = {};
                    rbEmployees.forEach(function(emp) { rbEmployeeById[emp.id] = emp; });
                    rolledBackEntries.forEach(function(entry) {
                        if (rbLedger[entry.employeeId] && rbLedger[entry.employeeId][rolledBackYear]) {
                            var le = rbLedger[entry.employeeId][rolledBackYear];
                            var rbEmp = rbEmployeeById[entry.employeeId];
                            var rbWeek1CopSlot = rbEmp
                                ? getWeek1PeriodicCOPAllocation(le.cutOffPoint, rbEmp)
                                : ((le.cutOffPoint || 0) / 52);
                            le.taxCreditsUsed = Math.max(0, (le.taxCreditsUsed || 0) - (entry.taxCreditsUsed || 0));
                            le.copUsed = Math.max(0, (le.copUsed || 0) - rbWeek1CopSlot);
                            le.remaining = le.annualTaxCredits - le.taxCreditsUsed;
                            le.copRemaining = le.cutOffPoint - le.copUsed;
                            le.lastUpdated = new Date().toISOString();
                        }
                    });
                    PayrollStorage.saveTaxCreditsLedger(PayrollContext.currentCompanyId, rbLedger);
                }

                restoreEmergencyTrackingSnapshot(rolledBackRun);

                showMessage('Last commit rolled back successfully.', 'success');
                PayrollContext.currentRunData = null;
                syncAllTables();
                showRunPayroll();
            } else {
                showMessage('Failed to rollback.', 'error');
            }
        }

        if (skipConfirm) {
            performRollbackAction();
        } else {
            showConfirmModal('This will remove the most recent committed payroll run from this period.', performRollbackAction, {
                title: 'Rollback commit',
                variant: 'warning',
                confirmLabel: 'Rollback'
            });
        }
    }

    function restoreEmergencyTrackingSnapshot(run) {
        if (!run || !run.employeeEmergencySnapshots) return;
        const employees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];
        let changed = false;
        employees.forEach(function(emp) {
            const snapshot = run.employeeEmergencySnapshots[emp.id];
            if (!snapshot) return;
            emp.weeksOnEmergency = snapshot.weeksOnEmergency || 0;
            emp.emergencyStartDate = snapshot.emergencyStartDate || '';
            changed = true;
        });
        if (changed) {
            PayrollStorage.saveEmployees(PayrollContext.currentCompanyId, employees);
        }
    }

    // --- Submit Period ---
    function submitPeriod(skipConfirm) {
        if (!PayrollStateMachine.canSubmit()) {
            showMessage('No commits to submit.', 'error');
            return;
        }
        const smState = PayrollStateMachine.getState();
        var message = smState.status === 'submitted'
            ? 'This period is already marked as submitted. Open the next payroll period now?'
            : 'Submit all ' + smState.commitCounter + ' commit(s) for Period ' + smState.currentPeriodNumber + ' to Revenue? This cannot be undone.';

        function performSubmitAction() {
            var success = true;
            if (smState.status !== 'submitted') {
                success = PayrollStateMachine.performSubmit();
            }
            if (!success) {
                showMessage('Failed to submit period.', 'error');
                return;
            }

            PayrollStateMachine.advancePeriod();
            const newState = PayrollStateMachine.getState();
            showMessage('Period ' + (newState.currentPeriodNumber - 1) + ' submitted. Now on Period ' + newState.currentPeriodNumber + '.', 'success');
            PayrollContext.currentRunData = null;
            syncAllTables();
            showRunPayroll();
        }

        if (skipConfirm) {
            performSubmitAction();
        } else {
            showConfirmModal(message, performSubmitAction);
        }
    }

    return {
        init: init,
        showRunPayroll: showRunPayroll,
        calculatePayroll: calculatePayroll,
        calculateTimesheetPreview: calculateTimesheetPreview,
        calculateEstGross: calculateEstGross,
        confirmAndSaveRun: confirmAndSaveRun,
        rollbackLastCommit: rollbackLastCommit,
        submitPeriod: submitPeriod,
        openCommittedRunInHistory: openCommittedRunInHistory,
        closeActionModal: closeActionModal,
        buildPayrollPreviewDataFromRun: buildPayrollPreviewDataFromRun,
        buildPayrollPreviewHtml: buildPayrollPreviewHtml,
        bindPayrollPreviewPayslipRows: bindPayrollPreviewPayslipRows
    };
})();
