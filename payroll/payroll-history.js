// payroll/payroll-history.js — History tab and Tax Credits & COP table
// Depends on: utils.js, storage.js, payroll-exports.js
// Wired from payroll.js via PayrollHistory.init()

var PayrollHistory = (function() {
    'use strict';

    var deps = {};
    var taxCreditsTableSort = { field: 'employee', direction: 'asc' };

    var TAX_CREDITS_TABLE_COLUMNS = [
        { key: 'employee', label: 'Employee' },
        { key: 'frequency', label: 'Frequency of Pay' },
        { key: 'source', label: 'Source' },
        { key: 'annualTC', label: 'Annual TC', className: 'text-right' },
        { key: 'tcUsed', label: 'TC Used', className: 'text-right' },
        { key: 'tcRemaining', label: 'TC Remaining', className: 'text-right' },
        { key: 'annualCOP', label: 'Annual COP', className: 'text-right' },
        { key: 'periodCOP', label: 'Period COP', className: 'text-right' },
        { key: 'periods', label: 'Periods' }
    ];

    function init(dependencies) {
        deps = dependencies || {};
    }

    function utils() {
        return typeof PayrollUtils !== 'undefined' ? PayrollUtils : null;
    }

    function escapeHtml(text) {
        var u = utils();
        if (u && u.escapeHtml) return u.escapeHtml(text);
        if (text == null) return '';
        return String(text);
    }

    function safeFormatCurrency(amount) {
        var u = utils();
        if (u && u.safeFormatCurrency) return u.safeFormatCurrency(amount);
        return String(amount || 0);
    }

    function formatLocalDateTime(value) {
        var u = utils();
        if (u && u.formatLocalDateTime) return u.formatLocalDateTime(value);
        return String(value || '');
    }

    function getDefaultAnnualTC(familyStatus) {
        var u = utils();
        if (u && u.getDefaultAnnualTC) return u.getDefaultAnnualTC(familyStatus);
        return 4000;
    }

    function getDefaultCutOffPoint(familyStatus) {
        var u = utils();
        if (u && u.getDefaultCutOffPoint) return u.getDefaultCutOffPoint(familyStatus);
        return 44000;
    }

    function getPayFrequencyLabel(frequency) {
        var u = utils();
        if (u && u.getPayFrequencyLabel) return u.getPayFrequencyLabel(frequency);
        return frequency || 'Monthly';
    }

    function callDep(name) {
        return deps[name] ? deps[name]() : undefined;
    }

    function buildTaxCreditsTableRow(emp, ledger, selectedYear) {
        var le = (ledger[emp.id] && ledger[emp.id][selectedYear]) ? ledger[emp.id][selectedYear] : null;
        var annualTC = le ? le.annualTaxCredits : getDefaultAnnualTC(emp.familyStatus);
        var tcUsed = le ? (le.taxCreditsUsed || 0) : 0;
        var tcRemaining = le ? (le.remaining || 0) : annualTC;
        var annualCOP = le ? le.cutOffPoint : getDefaultCutOffPoint(emp.familyStatus);
        var periodCOP = deps.getEmployeePeriodCOP ? deps.getEmployeePeriodCOP(annualCOP, emp) : 0;
        var source = le ? (le.source || 'automatic') : 'automatic';
        var sourceLabel = source === 'rpn' ? 'RPN' : source === 'manual' ? 'Manual' : 'Auto';
        var periodProgress = deps.getEmployeeSubmittedPeriodProgress
            ? deps.getEmployeeSubmittedPeriodProgress(emp, selectedYear)
            : { latestPeriod: 0, total: 12, frequency: 'monthly' };

        return {
            employeeId: emp.id,
            employeeName: ((emp.firstName || '') + ' ' + (emp.lastName || '')).trim(),
            frequency: deps.getEmployeePayFrequency ? deps.getEmployeePayFrequency(emp) : 'monthly',
            frequencyLabel: getPayFrequencyLabel(deps.getEmployeePayFrequency ? deps.getEmployeePayFrequency(emp) : 'monthly'),
            source: source,
            sourceLabel: sourceLabel,
            annualTC: annualTC,
            tcUsed: tcUsed,
            tcRemaining: tcRemaining,
            annualCOP: annualCOP,
            periodCOP: periodCOP,
            periodProgress: periodProgress
        };
    }

    function getTaxCreditsSortValue(row, field) {
        if (field === 'employee') return row.employeeName;
        if (field === 'frequency') return row.frequency;
        if (field === 'source') return row.source;
        if (field === 'annualTC') return row.annualTC;
        if (field === 'tcUsed') return row.tcUsed;
        if (field === 'tcRemaining') return row.tcRemaining;
        if (field === 'annualCOP') return row.annualCOP;
        if (field === 'periodCOP') return row.periodCOP;
        if (field === 'periods') return row.periodProgress.latestPeriod;
        return '';
    }

    function getSortedTaxCreditsRows(rows) {
        var field = taxCreditsTableSort.field || 'employee';
        var dir = taxCreditsTableSort.direction === 'desc' ? -1 : 1;
        return rows.slice().sort(function(a, b) {
            var av = getTaxCreditsSortValue(a, field);
            var bv = getTaxCreditsSortValue(b, field);
            if (typeof av === 'number' || typeof bv === 'number') {
                return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
            }
            return String(av).localeCompare(String(bv)) * dir;
        });
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

    function getTaxCreditsTableLastUpdatedTimestamp() {
        var companyId = callDep('getCompanyId');
        if (!companyId) return null;
        var year = callDep('getSelectedYear');
        var runs = PayrollStorage.loadPayrollRuns(companyId) || [];
        var submissions = PayrollStorage.loadSubmissions(companyId) || [];
        var submittedRunsWithTc = runs.filter(function(run) {
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

    function getTaxCreditsTableLastUpdatedLabel() {
        var timestamp = getTaxCreditsTableLastUpdatedTimestamp();
        if (!timestamp) {
            return 'No submitted payroll with tax credits applied yet';
        }
        return formatLocalDateTime(timestamp);
    }

    function renderTaxCreditsTableRowHtml(row) {
        var tcNegativeClass = row.tcRemaining < 0 ? ' tc-negative' : '';
        var sourceDescription = deps.getTaxSourceDescription ? deps.getTaxSourceDescription(row.source) : '';
        var html = '<tr class="taxcredits-row-clickable" data-emp-id="' + escapeHtml(row.employeeId || '') + '" title="Open employee card">';
        html += '<td>' + escapeHtml(row.employeeName) + '</td>';
        html += '<td>' + escapeHtml(row.frequencyLabel) + '</td>';
        html += '<td title="' + escapeHtml(sourceDescription) + '">' + escapeHtml(row.sourceLabel) + '</td>';
        html += '<td class="text-right">' + safeFormatCurrency(row.annualTC) + '</td>';
        html += '<td class="text-right">' + safeFormatCurrency(row.tcUsed) + '</td>';
        html += '<td class="text-right' + tcNegativeClass + '">' + safeFormatCurrency(row.tcRemaining) + '</td>';
        html += '<td class="text-right">' + safeFormatCurrency(row.annualCOP) + '</td>';
        html += '<td class="text-right">' + safeFormatCurrency(row.periodCOP) + '</td>';
        html += '<td title="' + escapeHtml(getPayFrequencyLabel(row.periodProgress.frequency) + ' — latest submitted pay period') + '">Period ' + row.periodProgress.latestPeriod + ' of ' + row.periodProgress.total + '</td>';
        html += '</tr>';
        return html;
    }

    function bindTaxCreditsTableSortEvents(container) {
        container.querySelectorAll('.taxcredits-table-sort').forEach(function(button) {
            button.addEventListener('click', function(event) {
                event.stopPropagation();
                var field = button.dataset.sortField;
                if (taxCreditsTableSort.field === field) {
                    taxCreditsTableSort.direction = taxCreditsTableSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    taxCreditsTableSort.field = field;
                    taxCreditsTableSort.direction = 'asc';
                }
                renderTaxCreditsTable();
            });
        });
    }

    function bindTaxCreditsTableRowEvents(container) {
        container.querySelectorAll('.taxcredits-row-clickable').forEach(function(row) {
            row.addEventListener('click', function() {
                var empId = row.dataset.empId;
                if (!empId) return;
                if (deps.switchTab) deps.switchTab('employees');
                if (typeof PayrollEmployees !== 'undefined' && PayrollEmployees.showEmployeeForm) {
                    PayrollEmployees.showEmployeeForm(empId);
                }
            });
        });
    }

    function renderTaxCreditsTable() {
        var container = document.getElementById('taxcredits-content');
        if (!container) return;

        var companyId = callDep('getCompanyId');
        var selectedYear = callDep('getSelectedYear');

        if (!companyId) {
            container.innerHTML = '<div class="empty-state">Select a company to view Tax Credits &amp; Cut-Off Points.</div>';
            return;
        }

        var employees = typeof PayrollEmployees !== 'undefined' && PayrollEmployees.getActiveEmployees
            ? PayrollEmployees.getActiveEmployees()
            : [];

        if (employees.length === 0) {
            container.innerHTML = '<div class="empty-state"><span class="icon">&#128196;</span><p>No employees found. Add employees to track tax credits and cut-off points.</p></div>';
            return;
        }

        if (deps.initOrSyncLedger) {
            deps.initOrSyncLedger(companyId, selectedYear);
        }
        var ledger = PayrollStorage.loadTaxCreditsLedger(companyId);
        var rows = getSortedTaxCreditsRows(employees.map(function(emp) {
            return buildTaxCreditsTableRow(emp, ledger, selectedYear);
        }));

        var periodContext = deps.getCurrentPayPeriodContext ? deps.getCurrentPayPeriodContext() : { weeklyPeriod: 1, weeksInYear: 52 };
        var lastUpdated = getTaxCreditsTableLastUpdatedLabel();

        var html = '<h2>Tax Credits &amp; Cut-Off Points</h2>';
        html += '<div class="taxcredits-subheader">';
        html += '<div class="taxcredits-subheader-week">';
        html += '<span class="taxcredits-subheader-week-label">Current weekly period</span>';
        html += '<span class="taxcredits-subheader-week-value">Week ' + escapeHtml(String(periodContext.weeklyPeriod)) + ' of ' + escapeHtml(String(periodContext.weeksInYear)) + '</span>';
        html += '</div>';
        html += '<div class="taxcredits-subheader-updated">Last updated: ' + escapeHtml(lastUpdated) + '</div>';
        html += '</div>';
        html += '<p class="taxcredits-summary">Tax Year: ' + escapeHtml(selectedYear) + ' | Tax credits on a cumulative basis | COP on a week-1/month-1 basis</p>';
        html += '<ul class="taxcredits-field-notes">';
        html += '<li><strong>Source</strong> &mdash; Where annual TC and COP come from: <em>Auto</em> (preset from family status), <em>Manual</em> (custom values on the employee card), or <em>RPN</em> (Revenue Payroll Notification in cloud mode).</li>';
        html += '<li><strong>Periods</strong> &mdash; Latest submitted pay-period number for this employee in the tax year (same as payslip/history), out of the total for their pay frequency (52 weekly, 26 fortnightly, or 12 monthly).</li>';
        html += '<li><strong>Period COP</strong> &mdash; Fixed standard-rate band for one pay period: Annual COP divided by pay periods per year (week-1 basis; unused amount does not roll forward).</li>';
        html += '</ul>';
        html += '<div class="table-container"><table class="results-table">';
        html += '<thead><tr>';
        TAX_CREDITS_TABLE_COLUMNS.forEach(function(column) {
            var sortMarker = taxCreditsTableSort.field === column.key
                ? (taxCreditsTableSort.direction === 'asc' ? ' (asc)' : ' (desc)')
                : '';
            html += '<th' + (column.className ? ' class="' + column.className + '"' : '') + '>';
            html += '<button type="button" class="taxcredits-table-sort" data-sort-field="' + column.key + '">';
            html += escapeHtml(column.label + sortMarker);
            html += '</button></th>';
        });
        html += '</tr></thead><tbody>';

        rows.forEach(function(row) {
            html += renderTaxCreditsTableRowHtml(row);
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
        bindTaxCreditsTableSortEvents(container);
        bindTaxCreditsTableRowEvents(container);
    }

    function renderHistory() {
        var container = document.getElementById('history-list');
        if (!container) return;

        var companyId = callDep('getCompanyId');
        if (!companyId) {
            container.innerHTML = '<div class="empty-state">Select a company to view payroll history.</div>';
            return;
        }

        var runs = PayrollStorage.loadPayrollRuns(companyId);
        runs.sort(function(a, b) { return new Date(b.runDate) - new Date(a.runDate); });

        if (runs.length === 0) {
            container.innerHTML = '<div class="empty-state">No payroll runs yet. Run your first payroll to see history here.</div>';
            return;
        }

        var html = '';
        runs.forEach(function(run) {
            var totalGross = run.entries.reduce(function(sum, e) { return sum + (e.grossPay || 0); }, 0);
            var totalNet = run.entries.reduce(function(sum, e) { return sum + (e.netPay || 0); }, 0);
            var date = new Date(run.runDate);
            var runStatus = run.status || 'open';
            var statusBadge = '';
            if (runStatus === 'committed') {
                statusBadge = '<span class="badge-committed">Committed</span>';
            } else if (runStatus === 'submitted') {
                statusBadge = '<span class="badge-submitted">Submitted</span>';
            }

            html += '<div class="history-item" data-run-id="' + escapeHtml(run.id) + '">';
            html += '<div class="history-summary">';
            html += '<div class="history-date">' + escapeHtml(date.toLocaleDateString('en-IE') + ' ' + date.toLocaleTimeString('en-IE', {hour: '2-digit', minute: '2-digit'})) + ' ' + statusBadge + '</div>';
            html += '<div class="history-period">' + escapeHtml(run.payPeriodLabel || '') + '</div>';
            html += '<div class="history-meta">' + run.entries.length + ' employees | Gross: ' +
                safeFormatCurrency(totalGross) + ' | Net: ' + safeFormatCurrency(totalNet) + '</div>';
            html += '<div class="history-actions">';
            html += '<button type="button" class="btn btn-secondary btn-expand" data-run-id="' + escapeHtml(run.id) + '">View Details</button>';
            html += '<button type="button" class="btn btn-secondary btn-export-csv" data-run-id="' + escapeHtml(run.id) + '">Export CSV</button>';
            if (runStatus === 'submitted') {
                html += '<button type="button" class="btn btn-danger btn-delete-run" data-run-id="' + escapeHtml(run.id) + '">Delete</button>';
            }
            html += '</div>';
            html += '</div>';
            html += '<div class="history-detail" id="detail-' + escapeHtml(run.id) + '"></div>';
            html += '</div>';
        });

        container.innerHTML = html;

        container.querySelectorAll('.btn-expand').forEach(function(btn) {
            btn.addEventListener('click', function() {
                expandHistoryItem(btn.dataset.runId);
            });
        });
        container.querySelectorAll('.btn-export-csv').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var run = runs.find(function(r) { return r.id === btn.dataset.runId; });
                if (run && typeof PayrollExports !== 'undefined') {
                    PayrollExports.exportRunCSV(run);
                }
            });
        });
        container.querySelectorAll('.btn-delete-run').forEach(function(btn) {
            btn.addEventListener('click', function() {
                deleteRun(btn.dataset.runId);
            });
        });
    }

    function expandHistoryItem(runId) {
        var detailDiv = document.getElementById('detail-' + runId);
        if (!detailDiv) return;

        var historyItem = detailDiv.closest('.history-item');
        if (historyItem && historyItem.classList.contains('expanded')) {
            historyItem.classList.remove('expanded');
            return;
        }

        var companyId = callDep('getCompanyId');
        if (!companyId) return;
        var runs = PayrollStorage.loadPayrollRuns(companyId);
        var run = runs.find(function(r) { return r.id === runId; });
        if (!run) return;

        var historyRunData = deps.buildPayrollPreviewDataFromRun ? deps.buildPayrollPreviewDataFromRun(run) : null;
        var html = deps.buildPayrollPreviewHtml && historyRunData
            ? deps.buildPayrollPreviewHtml(historyRunData, {
                title: 'Payroll Details',
                timestamp: run.runDate ? formatLocalDateTime(run.runDate) : '',
                warnings: []
            })
            : '<p>Preview unavailable.</p>';
        html = html.replace('<h3>Payroll Details</h3>', '<h3>Payroll Details</h3><div class="history-payslip-tip">Click on each employee line to view the payslip.</div>');

        html += '<div class="detail-actions">';
        html += '<button type="button" class="btn btn-secondary btn-export-excel" data-run-id="' + escapeHtml(runId) + '">Export Excel</button>';
        html += '</div>';

        detailDiv.classList.remove('hidden');
        detailDiv.innerHTML = html;
        if (historyItem) {
            historyItem.classList.add('expanded');
        }

        detailDiv.querySelectorAll('tr[data-employee-id]').forEach(function(row) {
            row.addEventListener('click', function(e) {
                if (e.target.closest && e.target.closest('.btn-view-payslip')) return;
                if (deps.setPayslipReturnTab) deps.setPayslipReturnTab('history');
                if (deps.showPayslip) deps.showPayslip(run.id, row.dataset.employeeId);
            });
        });
        detailDiv.querySelectorAll('.btn-view-payslip').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (deps.setPayslipReturnTab) deps.setPayslipReturnTab('history');
                if (deps.showPayslip) deps.showPayslip(run.id, btn.dataset.employeeId);
            });
        });
        detailDiv.querySelectorAll('.btn-export-excel').forEach(function(btn) {
            btn.addEventListener('click', function() {
                if (typeof PayrollExports !== 'undefined') {
                    PayrollExports.exportRunExcel(run);
                }
            });
        });
    }

    function deleteRun(runId) {
        if (!deps.showConfirmModal) return;
        deps.showConfirmModal('Are you sure you want to delete this payroll run? This cannot be undone.', function() {
            var companyId = callDep('getCompanyId');
            var selectedYear = callDep('getSelectedYear');
            if (!companyId) {
                if (deps.showMessage) deps.showMessage('No company selected.', 'error');
                return;
            }

            var runsBeforeDelete = PayrollStorage.loadPayrollRuns(companyId);
            var runToDelete = runsBeforeDelete.find(function(r) { return r.id === runId; });
            var deleteEntries = runToDelete ? (runToDelete.entries || []) : [];
            var deleteYear = runToDelete ? (runToDelete.taxYear || selectedYear) : selectedYear;

            var success = PayrollStorage.deletePayrollRun(companyId, runId);
            if (success) {
                if (deleteEntries.length > 0) {
                    var delLedger = PayrollStorage.loadTaxCreditsLedger(companyId);
                    var delEmployees = PayrollStorage.loadEmployees(companyId) || [];
                    var delEmployeeById = {};
                    delEmployees.forEach(function(emp) { delEmployeeById[emp.id] = emp; });
                    deleteEntries.forEach(function(entry) {
                        if (delLedger[entry.employeeId] && delLedger[entry.employeeId][deleteYear]) {
                            var le = delLedger[entry.employeeId][deleteYear];
                            var delEmp = delEmployeeById[entry.employeeId];
                            var delWeek1CopSlot = delEmp && deps.getWeek1PeriodicCOPAllocation
                                ? deps.getWeek1PeriodicCOPAllocation(le.cutOffPoint, delEmp)
                                : ((le.cutOffPoint || 0) / 52);
                            le.taxCreditsUsed = Math.max(0, (le.taxCreditsUsed || 0) - (entry.taxCreditsUsed || 0));
                            le.copUsed = Math.max(0, (le.copUsed || 0) - delWeek1CopSlot);
                            le.remaining = le.annualTaxCredits - le.taxCreditsUsed;
                            le.copRemaining = le.cutOffPoint - le.copUsed;
                            le.lastUpdated = new Date().toISOString();
                        }
                    });
                    PayrollStorage.saveTaxCreditsLedger(companyId, delLedger);
                }

                if (deps.showMessage) deps.showMessage('Payroll run deleted.', 'success');
                renderHistory();
                if (deps.syncAllTables) deps.syncAllTables();
            } else if (deps.showMessage) {
                deps.showMessage('Failed to delete payroll run.', 'error');
            }
        });
    }

    return {
        init: init,
        renderTaxCreditsTable: renderTaxCreditsTable,
        renderHistory: renderHistory,
        expandHistoryItem: expandHistoryItem,
        deleteRun: deleteRun
    };
})();