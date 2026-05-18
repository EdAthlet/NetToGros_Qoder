// payroll/payroll.js — Core Payroll App Orchestration (Multi-Company)
// Depends on: calculator-core.js, storage.js, employees.js

const PayrollApp = (function() {
    'use strict';

    // --- State ---
    let currentRunData = null;
    let payslipReturnTab = 'history';
    let currentPayslipContext = null;
    let currentCompanyId = null;

    // --- Constants ---
    const FAMILY_STATUS_LABELS = {
        single: 'Single',
        married: 'Married',
        marriedOneWorking: 'Married One Working',
        singleParent: 'Single Parent',
        manual: 'Manual'
    };

    function getDefaultAnnualTC(familyStatus) {
        if (typeof PayrollUtils !== 'undefined') {
            return PayrollUtils.getDefaultAnnualTC(familyStatus);
        }
        return 4000;
    }

    function getDefaultCutOffPoint(familyStatus) {
        if (typeof PayrollUtils !== 'undefined') {
            return PayrollUtils.getDefaultCutOffPoint(familyStatus);
        }
        return 44000;
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
                if (emp.rpn && emp.rpn.taxCredits) {
                    annualTaxCredits = emp.rpn.taxCredits;
                    source = 'rpn';
                } else if (emp.taxCreditsMode === 'manual') {
                    annualTaxCredits = parseFloat(emp.manualTaxCredits) || 0;
                    source = 'manual';
                } else {
                    annualTaxCredits = getDefaultAnnualTC(emp.familyStatus);
                    source = 'automatic';
                }
                // Resolve cutOffPoint
                if (emp.rpn && emp.rpn.cutOffPoint) {
                    cutOffPoint = emp.rpn.cutOffPoint;
                } else if (emp.taxCreditsMode === 'manual' && emp.manualCutOffPoint) {
                    cutOffPoint = parseFloat(emp.manualCutOffPoint) || 0;
                } else {
                    cutOffPoint = getDefaultCutOffPoint(emp.familyStatus);
                }

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
                if (emp.rpn && emp.rpn.taxCredits) {
                    newAnnualTC = emp.rpn.taxCredits;
                    newSource = 'rpn';
                } else if (emp.taxCreditsMode === 'manual') {
                    newAnnualTC = parseFloat(emp.manualTaxCredits) || 0;
                    newSource = 'manual';
                } else {
                    newAnnualTC = getDefaultAnnualTC(emp.familyStatus);
                    newSource = 'automatic';
                }
                if (emp.rpn && emp.rpn.cutOffPoint) {
                    newCOP = emp.rpn.cutOffPoint;
                } else if (emp.taxCreditsMode === 'manual' && emp.manualCutOffPoint) {
                    newCOP = parseFloat(emp.manualCutOffPoint) || 0;
                } else {
                    newCOP = getDefaultCutOffPoint(emp.familyStatus);
                }

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

        // Show front page
        renderCompanyList();
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
        companies.forEach(function(company) {
            const id = escapeHtml(company.id);
            const name = escapeHtml(company.name || 'Unnamed Company');
            const address = company.address || '';
            const eircode = company.eircode || '';
            const payFrequency = company.payFrequency || 'monthly';
            const taxYear = company.taxYear || '2026';
            const taxPeriod = company.taxPeriod === 'oct-dec' ? 'October - December' : 'January - September';

            html += '<div class="company-item" data-company-id="' + id + '">';
            html += '<div class="company-item-header">';
            html += '<a class="company-name-link" onclick="PayrollApp.enterCompany(\'' + id + '\')">' + name + '</a>';
            html += '<div class="company-actions">';
            html += '<button class="btn btn-secondary btn-sm" onclick="PayrollApp.showCompanyEditForm(\'' + id + '\')">&#9998; Edit</button>';
            html += '<button class="company-expand-btn" onclick="PayrollApp.toggleCompanyDetails(\'' + id + '\')">';
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
            html += '<span class="company-detail-label">Pay Frequency</span>';
            html += '<span class="company-detail-value">' + escapeHtml(payFrequency.charAt(0).toUpperCase() + payFrequency.slice(1)) + '</span>';
            html += '</div>';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Tax Year</span>';
            html += '<span class="company-detail-value">' + escapeHtml(taxYear) + ' (' + escapeHtml(taxPeriod) + ')</span>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
        });

        container.innerHTML = html;
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
        const payFrequency = company.payFrequency || 'monthly';
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
        html += '<button class="btn btn-primary" onclick="PayrollApp.saveCompanyEdit(\'' + id + '\')">Save</button>';
        html += '<button class="btn btn-secondary" onclick="PayrollApp.renderCompanyList()">Cancel</button>';
        html += '</div>';
        html += '</div>';

        detailsDiv.innerHTML = html;
    }

    function saveCompanyEdit(companyId) {
        const nameInput = document.getElementById('edit-name-' + companyId);
        const addressInput = document.getElementById('edit-address-' + companyId);
        const eircodeInput = document.getElementById('edit-eircode-' + companyId);
        const frequencyInput = document.getElementById('edit-frequency-' + companyId);
        const taxYearInput = document.getElementById('edit-taxyear-' + companyId);
        const taxPeriodInput = document.getElementById('edit-taxperiod-' + companyId);

        const data = {
            name: nameInput ? nameInput.value.trim() : '',
            address: addressInput ? addressInput.value.trim() : '',
            eircode: eircodeInput ? eircodeInput.value.trim() : '',
            payFrequency: frequencyInput ? frequencyInput.value : 'monthly',
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
        currentCompanyId = companyId;
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
                            annualTaxCredits: (emp && emp.rpn && emp.rpn.taxCredits) ? emp.rpn.taxCredits :
                                (emp && emp.taxCreditsMode === 'manual') ? (parseFloat(emp.manualTaxCredits) || 0) :
                                getDefaultAnnualTC(famStatus),
                            taxCreditsUsed: 0,
                            remaining: 0,
                            cutOffPoint: (emp && emp.rpn && emp.rpn.cutOffPoint) ? emp.rpn.cutOffPoint :
                                (emp && emp.taxCreditsMode === 'manual') ? (parseFloat(emp.manualCutOffPoint) || 0) :
                                getDefaultCutOffPoint(famStatus),
                            copUsed: 0,
                            copRemaining: 0,
                            source: (emp && emp.rpn && emp.rpn.taxCredits) ? 'rpn' :
                                (emp && emp.taxCreditsMode === 'manual') ? 'manual' : 'automatic',
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

        // Default to Employees tab
        switchTab('employees');
        renderHistory();
    }

    function exitCompany() {
        currentCompanyId = null;

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

    // --- Tab Navigation ---
    function switchTab(tabName) {
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
        } else if (tabName === 'history') {
            renderHistory();
        }
    }

    // --- Run Payroll ---
    function showRunPayroll() {
        const periodInfo = document.getElementById('run-period-info');
        const timesheetForm = document.getElementById('timesheet-form');
        const timesheetPreview = document.getElementById('timesheet-preview');
        const timesheetCommit = document.getElementById('timesheet-commit');
        const resultsDiv = document.getElementById('run-payroll-results');

        if (timesheetForm) timesheetForm.classList.add('hidden');
        if (timesheetPreview) timesheetPreview.classList.add('hidden');
        if (timesheetCommit) timesheetCommit.classList.add('hidden');
        if (resultsDiv) resultsDiv.classList.add('hidden');

        currentRunData = null;

        const employees = typeof PayrollEmployees !== 'undefined' && PayrollEmployees.getActiveEmployees
            ? PayrollEmployees.getActiveEmployees()
            : [];
        const periodLabel = generatePeriodLabel();
        const config = getCurrentPeriodConfig();

        let html = '<p><strong>Pay Frequency:</strong> ' + escapeHtml(config.label) + '</p>';
        html += '<p><strong>Tax Year:</strong> ' + escapeHtml(selectedYear) + '</p>';
        html += '<p><strong>Tax Period:</strong> ' + escapeHtml(getCurrentPeriodVar() === 'jan-sep' ? 'Jan \u2013 Sep' : 'Oct \u2013 Dec') + '</p>';
        html += '<p><strong>Period:</strong> ' + escapeHtml(periodLabel) + '</p>';
        html += '<p><strong>Active Employees:</strong> ' + employees.length + '</p>';

        if (periodInfo) {
            periodInfo.innerHTML = html;
        }

        if (employees.length === 0) {
            if (timesheetForm) {
                timesheetForm.innerHTML = '<p class="empty-state">No active employees. Add employees first.</p>';
                timesheetForm.classList.remove('hidden');
            }
            return;
        }

        // Determine period type from company or first employee
        const company = PayrollStorage.loadCompanies().find(function(c) { return c.id === currentCompanyId; });
        const periodType = (employees.length > 0 && employees[0].payFrequency) ? employees[0].payFrequency : (company ? company.payFrequency : 'monthly');
        const maxPeriodNumber = periodType === 'weekly' ? 53 : (periodType === 'fortnightly' ? 26 : 12);

        // Period number from state machine
        const priorRuns = PayrollStorage.loadPayrollRuns(currentCompanyId) || [];
        const smState = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.getState() : null;
        const periodNumber = smState ? smState.currentPeriodNumber : (priorRuns.length + 1);

        // Week number from current date
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const weekNumber = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
        const timestampStr = now.toLocaleString('en-IE');

        // Render period status banner
        let formHtml = '';
        if (smState) {
            formHtml += '<div class="period-status-banner">';
            formHtml += '<span class="period-badge">Period ' + smState.currentPeriodNumber + '</span>';
            formHtml += '<span class="commit-counter">Commits: ' + smState.commitCounter + '</span>';
            formHtml += '<span class="period-status status-' + smState.status + '">' + (smState.status === 'open' ? '&#9679; Open' : '&#9679; Submitted') + '</span>';
            if (PayrollStateMachine.canRollback()) {
                formHtml += '<button type="button" class="btn btn-warning btn-sm" id="rollback-btn">Rollback Last</button>';
            }
            if (PayrollStateMachine.canSubmit()) {
                formHtml += '<button type="button" class="btn btn-success btn-sm" id="submit-period-btn">Submit Period</button>';
            }
            formHtml += '</div>';
        }

        // RPN suggestion banner
        if (smState && PayrollStateMachine.shouldSuggestRPN()) {
            formHtml += '<div class="rpn-suggestion-banner">';
            formHtml += '<span>New period started. Retrieve up-to-date RPN?</span>';
            formHtml += '<button type="button" class="btn btn-primary btn-sm" id="rpn-retrieve-yes">Yes</button>';
            formHtml += '<button type="button" class="btn btn-secondary btn-sm" id="rpn-retrieve-no">No</button>';
            formHtml += '</div>';
        }

        // Render timesheet form
        var weeksInYear = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.getWeeksInYear(parseInt(selectedYear)) : 52;
        var stateWeekNumber = smState ? (smState.weekNumber || weekNumber) : weekNumber;

        // Check scheduling eligibility (needed for indicators and timesheet groups)
        var smCurrentWeek = stateWeekNumber;
        var fortnightlyDue = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.isFortnightlyDue(smCurrentWeek, smState && smState.fortnightly ? smState.fortnightly.lastCommittedWeek : 0) : true;
        var monthlyDue = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.isMonthlyDue(smCurrentWeek, selectedYear) : true;

        formHtml += '<div class="run-payroll-header-fields">';
        formHtml += '<div class="run-field-group">';
        formHtml += '<label>Week Number</label>';
        formHtml += '<input type="number" class="form-input run-period-input" id="payroll-week-number" min="1" max="53" value="' + stateWeekNumber + '">';
        formHtml += '</div>';
        formHtml += '<div class="run-field-group">';
        formHtml += '<label>Timestamp</label>';
        formHtml += '<span class="run-field-value" id="run-timestamp">' + escapeHtml(timestampStr) + '</span>';
        formHtml += '</div>';
        formHtml += '</div>';

        // Read-only per-frequency period display
        formHtml += '<div class="frequency-periods-display">';
        formHtml += '<span>Weekly Period: <strong>' + (smState && smState.weekly ? smState.weekly.periodNumber : 1) + '</strong> of ' + weeksInYear + '</span>';
        formHtml += '<span>Fortnightly Period: <strong>' + (smState && smState.fortnightly ? smState.fortnightly.periodNumber : 1) + '</strong> of 26</span>';
        formHtml += '<span>Monthly Period: <strong>' + (smState && smState.monthly ? smState.monthly.periodNumber : 1) + '</strong> of 12</span>';
        formHtml += '</div>';

        // Scheduling indicators showing which frequencies are due
        var fortnightlyNextDue = smState && smState.fortnightly ? (smState.fortnightly.lastCommittedWeek + 2) : 2;
        var monthEndWeeks = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.getMonthEndWeeks(parseInt(selectedYear)) : [];
        var monthlyNextDue = '';
        for (var mwi = 0; mwi < monthEndWeeks.length; mwi++) {
            if (monthEndWeeks[mwi] > stateWeekNumber) {
                monthlyNextDue = monthEndWeeks[mwi];
                break;
            }
        }
        if (!monthlyNextDue && monthEndWeeks.length > 0) {
            monthlyNextDue = monthEndWeeks[0]; // wrap to next year
        }

        formHtml += '<div class="scheduling-indicators">';
        formHtml += '<span class="indicator-due">Weekly: Due</span>';
        if (fortnightlyDue) {
            formHtml += '<span class="indicator-due">Fortnightly: Due</span>';
        } else {
            formHtml += '<span class="indicator-not-due">Fortnightly: Not due (next: Week ' + fortnightlyNextDue + ')</span>';
        }
        if (monthlyDue) {
            formHtml += '<span class="indicator-due">Monthly: Due</span>';
        } else {
            formHtml += '<span class="indicator-not-due">Monthly: Not due (next: Week ' + monthlyNextDue + ')</span>';
        }
        formHtml += '</div>';

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
            groupHtml += '<tr class="timesheet-group-header"><td colspan="7"' + labelStyle + '><strong>' + groupLabel + ' Employees' + labelSuffix + '</strong></td></tr>';

            emps.forEach(function(emp) {
                var empId = escapeHtml(emp.id);
                var isHourly = emp.payType === 'hourly';
                var hasHourlyRate = (emp.hourlyRate || 0) > 0;
                var payTypeClass = isHourly ? 'hourly' : 'salaried';
                var payTypeLabel = isHourly ? 'Hourly' : 'Salaried';
                var empPeriodType = (emp.payFrequency || 'monthly').charAt(0).toUpperCase() + (emp.payFrequency || 'monthly').slice(1);
                var rowClass = isDue ? '' : ' timesheet-row-disabled';

                groupHtml += '<tr class="' + rowClass.trim() + '">';
                groupHtml += '<td>' + escapeHtml(emp.firstName + ' ' + emp.lastName) + '</td>';
                groupHtml += '<td class="timesheet-period-type">' + escapeHtml(empPeriodType) + '</td>';
                groupHtml += '<td><span class="pay-type-badge ' + payTypeClass + '">' + payTypeLabel + '</span></td>';

                // Regular Hours
                if (isHourly) {
                    var regDisabled = isDue ? '' : ' disabled';
                    groupHtml += '<td><input type="number" class="timesheet-input" data-emp-id="' + empId + '" data-field="regularHours" min="0" step="0.5" value="0"' + regDisabled + '></td>';
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
                    var rateValue = (emp.hourlyRate || 0).toFixed(2);
                    groupHtml += '<td><input type="number" class="timesheet-input" data-emp-id="' + empId + '" data-field="hourlyRate" min="0" step="0.5" value="' + rateValue + '"' + rateDisabled + '></td>';
                } else {
                    groupHtml += '<td>\u2014</td>';
                }

                // Est. Gross
                var estGross = isHourly ? '\u20ac0.00' : safeFormatCurrency(convertFromAnnual(emp.annualGross || 0));
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
        formHtml += '<button class="btn btn-primary" id="calc-preview-btn">Calculate Preview</button>';

        if (timesheetForm) {
            timesheetForm.innerHTML = formHtml;
            timesheetForm.classList.remove('hidden');
        }

        // Bind Calculate Preview button
        const calcPreviewBtn = document.getElementById('calc-preview-btn');
        if (calcPreviewBtn) {
            calcPreviewBtn.addEventListener('click', calculateTimesheetPreview);
        }

        // Bind state machine action buttons
        const rollbackBtn = document.getElementById('rollback-btn');
        if (rollbackBtn) {
            rollbackBtn.addEventListener('click', rollbackLastCommit);
        }
        const submitPeriodBtn = document.getElementById('submit-period-btn');
        if (submitPeriodBtn) {
            submitPeriodBtn.addEventListener('click', submitPeriod);
        }
        const rpnYesBtn = document.getElementById('rpn-retrieve-yes');
        if (rpnYesBtn) {
            rpnYesBtn.addEventListener('click', function() {
                PayrollStateMachine.retrieveRPN(currentCompanyId);
                showMessage('RPN values updated from submitted payroll data.', 'success');
                showRunPayroll();
            });
        }
        const rpnNoBtn = document.getElementById('rpn-retrieve-no');
        if (rpnNoBtn) {
            rpnNoBtn.addEventListener('click', function() {
                PayrollStateMachine.dismissRPNSuggestion();
                var banner = document.querySelector('.rpn-suggestion-banner');
                if (banner) banner.remove();
            });
        }

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

        // Show manual tax credits note
        const manualEmployees = employees.filter(function(e) { return e.taxCreditsMode === 'manual'; });
        if (manualEmployees.length > 0 && periodInfo) {
            const note = document.createElement('p');
            note.className = 'info-note';
            note.textContent = 'Note: ' + manualEmployees.length +
                ' employee(s) have manual tax credits. Automatic calculation is used for this version.';
            periodInfo.appendChild(note);
        }
    }

    function updateSchedulingDisplay(currentWeek) {
        var smState = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.getState() : null;
        if (!smState) return;

        var weeksInYear = PayrollStateMachine.getWeeksInYear(parseInt(selectedYear));
        var fortnightlyDue = PayrollStateMachine.isFortnightlyDue(currentWeek, smState.fortnightly ? smState.fortnightly.lastCommittedWeek : 0);
        var monthlyDue = PayrollStateMachine.isMonthlyDue(currentWeek, selectedYear);

        // Update period display
        var periodDisplay = document.querySelector('.frequency-periods-display');
        if (periodDisplay) {
            var spans = periodDisplay.querySelectorAll('span');
            if (spans.length === 3) {
                spans[0].innerHTML = 'Weekly Period: <strong>' + (smState.weekly ? smState.weekly.periodNumber : 1) + '</strong> of ' + weeksInYear;
                spans[1].innerHTML = 'Fortnightly Period: <strong>' + (smState.fortnightly ? smState.fortnightly.periodNumber : 1) + '</strong> of 26';
                spans[2].innerHTML = 'Monthly Period: <strong>' + (smState.monthly ? smState.monthly.periodNumber : 1) + '</strong> of 12';
            }
        }

        // Update scheduling indicators
        var indicatorsDiv = document.querySelector('.scheduling-indicators');
        if (indicatorsDiv) {
            var fortnightlyNextDue = smState.fortnightly ? (smState.fortnightly.lastCommittedWeek + 2) : 2;
            var monthEndWeeks = PayrollStateMachine.getMonthEndWeeks(parseInt(selectedYear));
            var monthlyNextDue = '';
            for (var mwi = 0; mwi < monthEndWeeks.length; mwi++) {
                if (monthEndWeeks[mwi] > currentWeek) {
                    monthlyNextDue = monthEndWeeks[mwi];
                    break;
                }
            }
            if (!monthlyNextDue && monthEndWeeks.length > 0) {
                monthlyNextDue = monthEndWeeks[0];
            }

            var spans = indicatorsDiv.querySelectorAll('span');
            if (spans.length === 3) {
                spans[0].className = 'indicator-due';
                spans[0].textContent = 'Weekly: Due';

                if (fortnightlyDue) {
                    spans[1].className = 'indicator-due';
                    spans[1].textContent = 'Fortnightly: Due';
                } else {
                    spans[1].className = 'indicator-not-due';
                    spans[1].textContent = 'Fortnightly: Not due (next: Week ' + fortnightlyNextDue + ')';
                }

                if (monthlyDue) {
                    spans[2].className = 'indicator-due';
                    spans[2].textContent = 'Monthly: Due';
                } else {
                    spans[2].className = 'indicator-not-due';
                    spans[2].textContent = 'Monthly: Not due (next: Week ' + monthlyNextDue + ')';
                }
            }
        }
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
            return convertFromAnnual(emp.annualGross || 0) + overtimePay;
        }
    }

    function calculatePayroll() {
        calculateTimesheetPreview();
    }

    function validatePayrollPreview() {
        if (!currentRunData || !currentRunData.entries) return [];

        const warnings = [];
        const employees = PayrollEmployees.getActiveEmployees();
        const priorRuns = PayrollStorage.loadPayrollRuns(currentCompanyId) || [];
        const currentPeriodLabel = generatePeriodLabel();

        currentRunData.entries.forEach(function(entry) {
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
            const annualTC = (emp && emp.rpn && emp.rpn.taxCredits) ? emp.rpn.taxCredits :
                (emp && emp.taxCreditsMode === 'manual' ? (parseFloat(emp.manualTaxCredits) || 0) : getDefaultAnnualTC(emp ? emp.familyStatus : 'single'));
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

        html += '<h3>' + frequencyLabel + ' Payroll - Period ' + periodNumber + ' of ' + maxPeriods + ' (Week ' + weekNumber + ')</h3>';
        html += '<div class="table-container"><table class="preview-table"><thead><tr>';
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

    function calculateTimesheetPreview() {
        var employees = typeof PayrollEmployees !== 'undefined' && PayrollEmployees.getActiveEmployees
            ? PayrollEmployees.getActiveEmployees()
            : [];
        if (employees.length === 0) {
            showMessage('No active employees to process.', 'error');
            return;
        }

        // Step 1: Get state and week number
        var state = PayrollStateMachine.getState();
        var currentWeek = state.weekNumber || 1;

        // Load prior runs for cumulative TC tracking
        var priorRuns = PayrollStorage.loadPayrollRuns(currentCompanyId) || [];

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
        var fortnightlyDue = PayrollStateMachine.isFortnightlyDue(currentWeek, state.fortnightly ? state.fortnightly.lastCommittedWeek : 0);
        var monthlyDue = PayrollStateMachine.isMonthlyDue(currentWeek, selectedYear);
        var weeksInYear = PayrollStateMachine.getWeeksInYear(parseInt(selectedYear));

        // Step 5: Initialize currentRunData with separate arrays
        currentRunData = {
            weeklyEntries: [],
            fortnightlyEntries: [],
            monthlyEntries: [],
            weekNumber: currentWeek,
            totals: { gross: 0, paye: 0, usc: 0, prsi: 0, totalDeductions: 0, net: 0, employerPrsi: 0, employerCost: 0 }
        };

        // Save original activeTab so we can restore it after group processing
        var originalActiveTab = activeTab;

        // Step 4: Helper to process a group of employees with correct annualization factor
        function processEmployeeGroup(emps, frequency, totalPeriodsInYear) {
            // Temporarily set activeTab so convertToAnnual/convertFromAnnual use correct divisor
            activeTab = frequency;

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
                    var ledgerEntry = PayrollStorage.getEmployeeLedgerEntry(currentCompanyId, emp.id, selectedYear);
                    var annualCutOff = ledgerEntry.cutOffPoint || getDefaultCutOffPoint(familyStatus);

                    // Calculate PAYE using the employee's actual cut-off point
                    var payeAt20Annual = Math.min(annualizedTaxable, annualCutOff) * 0.2;
                    var payeAt40Annual = Math.max(annualizedTaxable - annualCutOff, 0) * 0.4;
                    var grossPayeAnnual = payeAt20Annual + payeAt40Annual;

                    // USC and PRSI still use the shared engine (they don't depend on cut-off)
                    var result = calculateNetFromGross(annualizedTaxable, familyStatus);

                    // Build correct PAYE breakdown using the employee's actual cut-off
                    var standardRateIncome = Math.min(annualizedTaxable, annualCutOff);
                    var higherRateIncome = Math.max(annualizedTaxable - annualCutOff, 0);
                    var payeBreakdownData = {
                        grossIncome: annualizedTaxable,
                        periodGross: taxableGross,
                        period: frequency === 'weekly' ? 'Weekly' : frequency === 'fortnightly' ? 'Fortnightly' : 'Monthly',
                        bands: [],
                        grossTax: grossPayeAnnual,
                        taxCredits: annualTC,
                        periodTaxCredits: annualTC / totalPeriodsInYear,
                        standardBand: annualCutOff,
                        periodStandardBand: annualCutOff / totalPeriodsInYear,
                        netTax: Math.max(0, grossPayeAnnual - annualTC),
                        status: familyStatus
                    };
                    if (standardRateIncome > 0) {
                        payeBreakdownData.bands.push({
                            rate: 0.2,
                            rateDisplay: '20',
                            taxableAmount: standardRateIncome / totalPeriodsInYear,
                            annualTaxableAmount: standardRateIncome,
                            tax: payeAt20Annual / totalPeriodsInYear,
                            annualTax: payeAt20Annual,
                            description: 'Standard rate'
                        });
                    }
                    if (higherRateIncome > 0) {
                        payeBreakdownData.bands.push({
                            rate: 0.4,
                            rateDisplay: '40',
                            taxableAmount: higherRateIncome / totalPeriodsInYear,
                            annualTaxableAmount: higherRateIncome,
                            tax: payeAt40Annual / totalPeriodsInYear,
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
                    var annualTC = ledgerEntry.annualTaxCredits || getDefaultAnnualTC(emp.familyStatus);
                    var remainingTC = ledgerEntry.remaining || 0;

                    // Count committed periods for this employee (lightweight loop)
                    var committedPeriods = 0;
                    priorRuns.forEach(function(run) {
                        if (run.entries && run.entries.find(function(e) { return e.employeeId === emp.id; })) committedPeriods++;
                    });
                    var periodsRemaining = Math.max(totalPeriodsInYear - committedPeriods, 1);
                    var currentPeriodTC = remainingTC / periodsRemaining;

                    // Override PAYE with our TC logic
                    var grossPaye = convertFromAnnual(grossPayeAnnual);
                    var actualTCUsed = Math.min(currentPeriodTC, grossPaye); // Can't use more TC than gross PAYE
                    var netPaye = Math.max(grossPaye - currentPeriodTC, 0);

                    var paye = netPaye;
                    var taxCreditsUsed = actualTCUsed;
                    var totalDeductions = paye + usc + prsi + periodPensionDeduction;
                    var netPay = grossPay - totalDeductions;

                    entries.push({
                        employeeId: emp.id,
                        employeeName: emp.firstName + ' ' + emp.lastName,
                        periodType: (emp.payFrequency || frequency).charAt(0).toUpperCase() + (emp.payFrequency || frequency).slice(1),
                        payFrequency: frequency,
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
                        _payeBreakdown: payeBreakdownData,
                        _uscBreakdown: result.uscBreakdown,
                        _prsiBreakdown: result.prsiBreakdown
                    });

                    currentRunData.totals.gross += grossPay;
                    currentRunData.totals.paye += paye;
                    currentRunData.totals.usc += usc;
                    currentRunData.totals.prsi += prsi;
                    currentRunData.totals.totalDeductions += totalDeductions;
                    currentRunData.totals.net += netPay;
                    currentRunData.totals.employerPrsi += employerPrsi;
                    currentRunData.totals.employerCost += employerCost;
                } catch (err) {
                    console.error('Calculation error for employee', emp.id, err);
                }
            });

            return entries;
        }

        // Calculate weekly group (always due)
        currentRunData.weeklyEntries = processEmployeeGroup(weeklyEmps, 'weekly', weeksInYear);

        // Calculate fortnightly group (only if due)
        if (fortnightlyDue) {
            currentRunData.fortnightlyEntries = processEmployeeGroup(fortnightlyEmps, 'fortnightly', 26);
        }

        // Calculate monthly group (only if due)
        if (monthlyDue) {
            currentRunData.monthlyEntries = processEmployeeGroup(monthlyEmps, 'monthly', 12);
        }

        // Restore original activeTab
        activeTab = originalActiveTab;

        // Step 5: Combined entries for backward compatibility with commit flow
        currentRunData.entries = currentRunData.weeklyEntries.concat(currentRunData.fortnightlyEntries).concat(currentRunData.monthlyEntries);

        // Round totals
        currentRunData.totals.gross = Math.round(currentRunData.totals.gross * 100) / 100;
        currentRunData.totals.paye = Math.round(currentRunData.totals.paye * 100) / 100;
        currentRunData.totals.usc = Math.round(currentRunData.totals.usc * 100) / 100;
        currentRunData.totals.prsi = Math.round(currentRunData.totals.prsi * 100) / 100;
        currentRunData.totals.totalDeductions = Math.round(currentRunData.totals.totalDeductions * 100) / 100;
        currentRunData.totals.net = Math.round(currentRunData.totals.net * 100) / 100;
        currentRunData.totals.employerPrsi = Math.round(currentRunData.totals.employerPrsi * 100) / 100;
        currentRunData.totals.employerCost = Math.round(currentRunData.totals.employerCost * 100) / 100;

        // Run validation
        var allWarnings = validatePayrollPreview();

        // Read period info values from input fields and state
        var runPeriodNumber = (function() {
            var smState = PayrollStateMachine.getState();
            return smState ? String(smState.currentPeriodNumber) : '1';
        })();
        var runWeekNumber = document.getElementById('payroll-week-number') ? document.getElementById('payroll-week-number').value : '1';
        var runTimestamp = document.getElementById('run-timestamp') ? document.getElementById('run-timestamp').textContent : '';

        // Render three frequency tables
        var previewDiv = document.getElementById('timesheet-preview');
        var previewHtml = '<h3>Payroll Preview</h3>';
        previewHtml += '<div class="preview-period-info">';
        previewHtml += '<span><strong>Period #:</strong> ' + escapeHtml(runPeriodNumber) + '</span>';
        previewHtml += '<span><strong>Week #:</strong> ' + escapeHtml(runWeekNumber) + '</span>';
        previewHtml += '<span><strong>Timestamp:</strong> ' + escapeHtml(runTimestamp) + '</span>';
        previewHtml += '</div>';

        previewHtml += renderFrequencyTable(currentRunData.weeklyEntries, 'Weekly', state.weekly.periodNumber, weeksInYear, currentWeek, true);
        previewHtml += renderFrequencyTable(currentRunData.fortnightlyEntries, 'Fortnightly', state.fortnightly.periodNumber, 26, currentWeek, fortnightlyDue);
        previewHtml += renderFrequencyTable(currentRunData.monthlyEntries, 'Monthly', state.monthly.periodNumber, 12, currentWeek, monthlyDue);

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
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.gross) + '</strong></td>';
        previewHtml += '<td class="text-right"></td>';
        previewHtml += '<td class="text-right"></td>';
        previewHtml += '<td class="text-right"></td>';
        previewHtml += '<td class="text-right"></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.paye) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.usc) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.prsi) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.employerPrsi) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.totalDeductions) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.net) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.employerCost) + '</strong></td>';
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
                    var entry = currentRunData.entries.find(function(e) { return e.employeeId === empId; });
                    if (entry) {
                        payslipReturnTab = 'run';
                        var entries = currentRunData.entries;
                        var currentIndex = entries.findIndex(function(e) { return e.employeeId === empId; });
                        showPayslipFromEntry(entry, currentRunData, entries, currentIndex);
                    }
                });
            });
        }

        // Render commit button
        var commitDiv = document.getElementById('timesheet-commit');
        if (commitDiv) {
            commitDiv.innerHTML = '<button class="btn btn-primary" id="commit-payroll-btn">Commit to Payroll</button>';
            commitDiv.classList.remove('hidden');

            var commitBtn = document.getElementById('commit-payroll-btn');
            if (commitBtn) {
                commitBtn.addEventListener('click', confirmAndSaveRun);
            }
        }

        // Synchronize Tax Credits table on calculate (simultaneous update)
        renderTaxCreditsTable();
    }

    function confirmAndSaveRun() {
        if (!currentRunData || !currentRunData.entries || currentRunData.entries.length === 0) {
            showMessage('No payroll data to save.', 'error');
            return;
        }

        if (!currentCompanyId) {
            showMessage('No company selected.', 'error');
            return;
        }

        const employees = PayrollStorage.loadEmployees(currentCompanyId) || [];

        // Calculate TC before/after for each employee
        const priorRuns = PayrollStorage.loadPayrollRuns(currentCompanyId) || [];

        const run = {
            id: PayrollStorage.generateId(),
            runDate: new Date().toISOString(),
            payPeriodLabel: generatePeriodLabel(),
            taxYear: selectedYear,
            taxPeriod: getCurrentPeriodVar(),
            frequency: activeTab,
            periodType: (function() {
                var smState = PayrollStateMachine.getState();
                return smState && smState.weekly ? 'weekly' : 'monthly';
            })(),
            periodNumber: (function() {
                var smState = PayrollStateMachine.getState();
                return smState ? smState.currentPeriodNumber : 1;
            })(),
            weekNumber: parseInt(document.getElementById('payroll-week-number') ? document.getElementById('payroll-week-number').value : '1') || 1,
            frequenciesIncluded: (function() {
                var freq = [];
                if (currentRunData.weeklyEntries && currentRunData.weeklyEntries.length > 0) freq.push('weekly');
                if (currentRunData.fortnightlyEntries && currentRunData.fortnightlyEntries.length > 0) freq.push('fortnightly');
                if (currentRunData.monthlyEntries && currentRunData.monthlyEntries.length > 0) freq.push('monthly');
                return freq;
            })(),
            entries: currentRunData.entries.map(function(e) {
                return {
                    employeeId: e.employeeId,
                    employeeName: e.employeeName,
                    periodType: e.periodType || 'monthly',
                    payFrequency: e.payFrequency || '',
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
                    tcRemainingBefore: (function() {
                        const emp = employees.find(function(emp) { return emp.id === e.employeeId; });
                        const annualTC = (emp && emp.rpn && emp.rpn.taxCredits) ? emp.rpn.taxCredits :
                            (emp && emp.taxCreditsMode === 'manual' ? (parseFloat(emp.manualTaxCredits) || 0) : getDefaultAnnualTC(emp ? emp.familyStatus : 'single'));
                        let used = 0;
                        priorRuns.forEach(function(run) {
                            const ent = run.entries ? run.entries.find(function(x) { return x.employeeId === e.employeeId; }) : null;
                            if (ent) used += (ent.taxCreditsUsed || 0);
                        });
                        return annualTC - used;
                    })(),
                    tcRemainingAfter: (function() {
                        const emp = employees.find(function(emp) { return emp.id === e.employeeId; });
                        const annualTC = (emp && emp.rpn && emp.rpn.taxCredits) ? emp.rpn.taxCredits :
                            (emp && emp.taxCreditsMode === 'manual' ? (parseFloat(emp.manualTaxCredits) || 0) : getDefaultAnnualTC(emp ? emp.familyStatus : 'single'));
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
                        return {
                            taxCredits: rpn.taxCredits || 0,
                            cutOffPoint: rpn.cutOffPoint || 0,
                            prsiClass: rpn.prsiClass || '',
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
            initOrSyncLedger(currentCompanyId, commitYear);
            var commitLedger = PayrollStorage.loadTaxCreditsLedger(currentCompanyId);
            run.entries.forEach(function(entry) {
                if (commitLedger[entry.employeeId] && commitLedger[entry.employeeId][commitYear]) {
                    var le = commitLedger[entry.employeeId][commitYear];
                    le.taxCreditsUsed = (le.taxCreditsUsed || 0) + (entry.taxCreditsUsed || 0);
                    le.copUsed = (le.copUsed || 0) + (entry.grossPay || 0);
                    le.remaining = le.annualTaxCredits - le.taxCreditsUsed;
                    le.copRemaining = le.cutOffPoint - le.copUsed;
                    le.lastUpdated = new Date().toISOString();
                }
            });
            PayrollStorage.saveTaxCreditsLedger(currentCompanyId, commitLedger);

            // Advance per-frequency period counters via state machine API
            PayrollStateMachine.advanceFrequencyCounters(run.frequenciesIncluded || [], run.weekNumber);

            const smState = PayrollStateMachine.getState();
            showMessage('Committed (Commit ' + smState.commitCounter + ' for Period ' + smState.currentPeriodNumber + ')', 'success');
            currentRunData = null;
            document.getElementById('run-payroll-results').classList.add('hidden');
            const timesheetPreview = document.getElementById('timesheet-preview');
            const timesheetCommit = document.getElementById('timesheet-commit');
            if (timesheetPreview) timesheetPreview.classList.add('hidden');
            if (timesheetCommit) timesheetCommit.classList.add('hidden');
            syncAllTables();
            // Stay on run tab - refresh to show updated banner
            showRunPayroll();
        } else {
            showMessage('Failed to save payroll run.', 'error');
        }
    }

    // --- Rollback Last Commit ---
    function rollbackLastCommit() {
        if (!PayrollStateMachine.canRollback()) {
            showMessage('Nothing to rollback.', 'error');
            return;
        }
        showConfirmModal('Undo last commit? This will remove the most recent committed payroll run.', function() {
            // Capture run entries BEFORE rollback deletes the run
            var committedRunIds = PayrollStateMachine.getCommittedRunIds();
            var lastRunId = committedRunIds.length > 0 ? committedRunIds[committedRunIds.length - 1] : null;
            var rolledBackEntries = [];
            var rolledBackYear = selectedYear;
            if (lastRunId) {
                var allRuns = PayrollStorage.loadPayrollRuns(currentCompanyId) || [];
                var lastRun = allRuns.find(function(r) { return r.id === lastRunId; });
                if (lastRun) {
                    rolledBackEntries = lastRun.entries || [];
                    rolledBackYear = lastRun.taxYear || selectedYear;
                }
            }

            const success = PayrollStateMachine.performRollback();
            if (success) {
                // Reverse ledger entries for rolled-back run
                if (rolledBackEntries.length > 0) {
                    var rbLedger = PayrollStorage.loadTaxCreditsLedger(currentCompanyId);
                    rolledBackEntries.forEach(function(entry) {
                        if (rbLedger[entry.employeeId] && rbLedger[entry.employeeId][rolledBackYear]) {
                            var le = rbLedger[entry.employeeId][rolledBackYear];
                            le.taxCreditsUsed = Math.max(0, (le.taxCreditsUsed || 0) - (entry.taxCreditsUsed || 0));
                            le.copUsed = Math.max(0, (le.copUsed || 0) - (entry.grossPay || 0));
                            le.remaining = le.annualTaxCredits - le.taxCreditsUsed;
                            le.copRemaining = le.cutOffPoint - le.copUsed;
                            le.lastUpdated = new Date().toISOString();
                        }
                    });
                    PayrollStorage.saveTaxCreditsLedger(currentCompanyId, rbLedger);
                }

                showMessage('Last commit rolled back successfully.', 'success');
                currentRunData = null;
                syncAllTables();
                showRunPayroll();
            } else {
                showMessage('Failed to rollback.', 'error');
            }
        });
    }

    // --- Submit Period ---
    function submitPeriod() {
        if (!PayrollStateMachine.canSubmit()) {
            showMessage('No commits to submit.', 'error');
            return;
        }
        const smState = PayrollStateMachine.getState();
        showConfirmModal('Submit all ' + smState.commitCounter + ' commit(s) for Period ' + smState.currentPeriodNumber + ' to Revenue? This cannot be undone.', function() {
            const success = PayrollStateMachine.performSubmit();
            if (success) {
                PayrollStateMachine.advancePeriod();
                const newState = PayrollStateMachine.getState();
                showMessage('Period ' + (newState.currentPeriodNumber - 1) + ' submitted. Now on Period ' + newState.currentPeriodNumber + '.', 'success');
                currentRunData = null;
                syncAllTables();
                showRunPayroll();
            } else {
                showMessage('Failed to submit period.', 'error');
            }
        });
    }

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
    }

    // --- RPN Overview Tab ---
    function renderRPNOverview() {
        const container = document.getElementById('rpn-content');
        if (!container) return;

        if (!currentCompanyId) {
            container.innerHTML = '<div class="empty-state">Select a company to view RPN data.</div>';
            return;
        }

        const employees = PayrollStorage.loadEmployees(currentCompanyId) || [];
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
        html += '<th class="text-right">Tax Credits</th>';
        html += '<th class="text-right">Cut-Off Point</th>';
        html += '<th>PRSI Class</th>';
        html += '<th>USC Status</th>';
        html += '<th class="text-right">Prev Pay</th>';
        html += '<th class="text-right">Prev Tax</th>';
        html += '<th class="text-right">Prev USC</th>';
        html += '</tr></thead><tbody>';

        employees.forEach(function(emp) {
            const rpn = emp.rpn || {};
            const name = (emp.firstName || '') + ' ' + (emp.lastName || '');
            html += '<tr class="rpn-row-clickable" data-emp-id="' + escapeHtml(emp.id) + '">';
            html += '<td>' + escapeHtml(name) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(rpn.taxCredits || 0) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(rpn.cutOffPoint || 0) + '</td>';
            html += '<td>' + escapeHtml(rpn.prsiClass || 'A') + '</td>';
            html += '<td>' + escapeHtml(rpn.uscStatus || 'Normal') + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(rpn.previousPay || 0) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(rpn.previousTax || 0) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(rpn.previousUSC || 0) + '</td>';
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
                showConfirmModal('Retrieve RPN? This will recalculate remaining Tax Credits from submitted payrolls and update all employee RPN fields.', function() {
                    PayrollStateMachine.retrieveRPN(currentCompanyId);
                    showMessage('RPN values updated from submitted payroll data.', 'success');
                    renderRPNOverview();
                });
            });
        }
    }

    function generatePeriodLabel() {
        const now = new Date();
        const config = getCurrentPeriodConfig();

        if (activeTab === 'monthly') {
            const months = ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];
            return months[now.getMonth()] + ' ' + now.getFullYear() + ' (' + config.label + ')';
        } else if (activeTab === 'weekly') {
            const start = new Date(now.getFullYear(), 0, 1);
            const diff = now - start + ((start.getDay() + 1) * 86400000);
            const oneWeek = 604800000;
            const weekNum = Math.ceil(diff / oneWeek);
            return 'Week ' + weekNum + ', ' + now.getFullYear();
        } else if (activeTab === 'fortnightly') {
            const start = new Date(now.getFullYear(), 0, 1);
            const diff = now - start + ((start.getDay() + 1) * 86400000);
            const oneFortnight = 1209600000;
            const fnNum = Math.ceil(diff / oneFortnight);
            return 'Fortnight ' + fnNum + ', ' + now.getFullYear();
        } else {
            return now.getFullYear() + ' (' + config.label + ')';
        }
    }

    function getCurrentPeriodVar() {
        const periodVar = 'selected' + selectedYear + 'Period';
        return typeof window[periodVar] !== 'undefined' ? window[periodVar] : 'jan-sep';
    }

    // --- Payslips ---
    function showPayslip(runId, employeeId) {
        if (!currentCompanyId) return;
        const runs = PayrollStorage.loadPayrollRuns(currentCompanyId);
        const run = runs.find(function(r) { return r.id === runId; });
        if (!run) return;

        const entry = run.entries.find(function(e) { return e.employeeId === employeeId; });
        if (!entry) return;

        const entries = run.entries;
        const currentIndex = entries.findIndex(function(e) { return e.employeeId === employeeId; });
        showPayslipFromEntry(entry, run, entries, currentIndex);
    }

    function generatePayeBreakdownHtml(calcResult, entryPAYE, freqDivisor) {
        if (!calcResult || !calcResult.payeBreakdown) {
            return '<div class="calc-step-equation">Result: ' + safeFormatCurrency(entryPAYE) + '</div>';
        }
        var html = '';
        var pb = calcResult.payeBreakdown;
        var periodGrossTax = 0;
        pb.bands.forEach(function(band) {
            html += '<div class="calc-step-equation">' + safeFormatCurrency(band.taxableAmount) + ' @ ' + escapeHtml(band.rateDisplay) + '% = ' + safeFormatCurrency(band.tax) + ' &nbsp;&nbsp;(' + escapeHtml(band.description) + ')</div>';
            periodGrossTax += band.tax;
        });
        html += '<div class="calc-step-equation">Gross Tax: ' + safeFormatCurrency(periodGrossTax) + '</div>';
        html += '<div class="calc-step-equation">Tax Credits: &minus;' + safeFormatCurrency(pb.periodTaxCredits || (pb.taxCredits / (freqDivisor || 52))) + '</div>';
        html += '<div class="calc-step-equation">Net PAYE: ' + safeFormatCurrency(entryPAYE) + '</div>';
        html += '<div class="calc-annual-section">';
        html += '<div class="calc-annual-title">Annual Equivalent</div>';
        pb.bands.forEach(function(band) {
            html += '<div class="calc-step-equation">' + safeFormatCurrency(band.annualTaxableAmount) + ' @ ' + escapeHtml(band.rateDisplay) + '% = ' + safeFormatCurrency(band.annualTax) + '</div>';
        });
        html += '<div class="calc-step-equation">Gross Tax: ' + safeFormatCurrency(pb.grossTax) + '</div>';
        html += '<div class="calc-step-equation">Tax Credits: &minus;' + safeFormatCurrency(pb.taxCredits) + '</div>';
        html += '<div class="calc-step-equation">Net PAYE: ' + safeFormatCurrency(pb.netTax) + '</div>';
        html += '</div>';
        return html;
    }

    function generateUscBreakdownHtml(calcResult, entryUSC, freqDivisor) {
        if (!calcResult || !calcResult.uscBreakdown) {
            return '<div class="calc-step-equation">Result: ' + safeFormatCurrency(entryUSC) + '</div>';
        }
        var html = '';
        var ub = calcResult.uscBreakdown;
        var div = freqDivisor || 52;
        if (ub.exempt) {
            html += '<div class="calc-step-equation">Exempt (income below &euro;13,000)</div>';
        } else {
            var periodTotalUSC = 0;
            ub.bands.forEach(function(band) {
                var periodTaxable = band.taxableAmount / div;
                var periodUsc = band.uscAmount / div;
                html += '<div class="calc-step-equation">' + safeFormatCurrency(periodTaxable) + ' @ ' + (band.rate * 100).toFixed(2) + '% = ' + safeFormatCurrency(periodUsc) + '</div>';
                periodTotalUSC += periodUsc;
            });
            html += '<div class="calc-step-equation">Total USC: ' + safeFormatCurrency(entryUSC) + '</div>';
            html += '<div class="calc-annual-section">';
            html += '<div class="calc-annual-title">Annual Equivalent</div>';
            ub.bands.forEach(function(band) {
                html += '<div class="calc-step-equation">' + safeFormatCurrency(band.taxableAmount) + ' @ ' + (band.rate * 100).toFixed(2) + '% = ' + safeFormatCurrency(band.uscAmount) + '</div>';
            });
            html += '<div class="calc-step-equation">Total USC: ' + safeFormatCurrency(ub.total) + '</div>';
            html += '</div>';
        }
        return html;
    }

    function generatePrsiBreakdownHtml(calcResult, entryGross, entryPRSI, freqDivisor) {
        if (!calcResult || !calcResult.prsiBreakdown) {
            return '<div class="calc-step-equation">Result: ' + safeFormatCurrency(entryPRSI) + '</div>';
        }
        var html = '';
        var prb = calcResult.prsiBreakdown;
        var activeBand = prb.bands.find(function(b) { return b.netPRSI > 0; });
        if (!activeBand) {
            activeBand = prb.bands[0];
        }
        if (activeBand) {
            html += '<div class="calc-step-equation">' + safeFormatCurrency(entryGross) + ' @ ' + (activeBand.rate * 100).toFixed(2) + '% = ' + safeFormatCurrency(activeBand.periodPRSI) + '</div>';
            if (activeBand.code === 'AX' && activeBand.credit > 0) {
                html += '<div class="calc-step-equation">Credit: &minus;' + safeFormatCurrency(activeBand.credit) + '</div>';
            }
            html += '<div class="calc-step-equation">Net PRSI: ' + safeFormatCurrency(entryPRSI) + '</div>';
            var div = freqDivisor || 52;
            html += '<div class="calc-annual-section">';
            html += '<div class="calc-annual-title">Annual Equivalent</div>';
            html += '<div class="calc-step-equation">' + safeFormatCurrency(entryGross * div) + ' @ ' + (activeBand.rate * 100).toFixed(2) + '% = ' + safeFormatCurrency(activeBand.periodPRSI * div) + '</div>';
            if (activeBand.code === 'AX' && activeBand.credit > 0) {
                html += '<div class="calc-step-equation">Credit: &minus;' + safeFormatCurrency(activeBand.credit * div) + '</div>';
            }
            html += '<div class="calc-step-equation">Net PRSI: ' + safeFormatCurrency(prb.total) + '</div>';
            html += '</div>';
        } else {
            html += '<div class="calc-step-equation">Net PRSI: ' + safeFormatCurrency(entryPRSI) + '</div>';
        }
        return html;
    }

    /**
     * Build an ordered array of breakdown step objects for the payslip.
     * Each step: { title: String, equations: [String], html: String (optional raw HTML) }
     */
    function buildBreakdownSteps(entry, employee, calcResult, opts) {
        var steps = [];
        var annualTC = opts.annualTC;
        var periodTC = opts.periodTC;
        var appliedTC = opts.appliedTC;
        var freqLabel = opts.freqLabel;
        var freqDivisor = opts.freqDivisor;

        var regularHours = entry.regularHours || 0;
        var overtimeHours = entry.overtimeHours || 0;
        var hourlyRate = entry.hourlyRate || 0;
        var multiplier = entry.overtimeMultiplier || 1.5;
        var regularGross = entry.regularGross || 0;
        var overtimeGross = entry.overtimeGross || 0;
        var pensionDeduction = entry.pensionDeduction || 0;
        var bikAmount = entry.bikAmount || 0;

        // --- Pay-type specific steps ---
        if (entry.payType === 'hourly') {
            steps.push({
                title: 'Regular Pay',
                equations: [escapeHtml(String(regularHours)) + ' hrs &times; ' + safeFormatCurrency(hourlyRate) + ' = ' + safeFormatCurrency(regularGross)]
            });
            steps.push({
                title: 'Overtime Pay',
                equations: [escapeHtml(String(overtimeHours)) + ' hrs &times; ' + safeFormatCurrency(hourlyRate) + ' &times; ' + escapeHtml(String(multiplier)) + ' = ' + safeFormatCurrency(overtimeGross)]
            });
            steps.push({
                title: 'Total Gross',
                equations: [safeFormatCurrency(regularGross) + ' + ' + safeFormatCurrency(overtimeGross) + ' = ' + safeFormatCurrency(entry.grossPay)]
            });

        } else if (entry.payType === 'salaried') {
            var annualGross = employee ? (employee.annualGross || 0) : 0;
            var displayAnnual = annualGross > 0 ? annualGross : regularGross * freqDivisor;

            steps.push({
                title: 'Basic Salary',
                equations: [
                    'Annual: ' + safeFormatCurrency(displayAnnual),
                    escapeHtml(freqLabel) + ': ' + safeFormatCurrency(displayAnnual) + ' &divide; ' + escapeHtml(String(freqDivisor)) + ' = ' + safeFormatCurrency(regularGross)
                ]
            });

            if (overtimeHours > 0) {
                steps.push({
                    title: 'Overtime Pay',
                    equations: [escapeHtml(String(overtimeHours)) + ' hrs &times; ' + safeFormatCurrency(hourlyRate) + ' &times; ' + escapeHtml(String(multiplier)) + ' = ' + safeFormatCurrency(overtimeGross)]
                });
                steps.push({
                    title: 'Total Gross',
                    equations: [safeFormatCurrency(regularGross) + ' + ' + safeFormatCurrency(overtimeGross) + ' = ' + safeFormatCurrency(entry.grossPay)]
                });
            } else {
                steps.push({
                    title: 'Total Gross',
                    equations: [safeFormatCurrency(regularGross) + ' = ' + safeFormatCurrency(entry.grossPay)]
                });
            }

        } else {
            // Legacy entries without timesheet data
            steps.push({
                title: 'Gross Pay',
                equations: [safeFormatCurrency(entry.grossPay)]
            });
        }

        // --- Pension / BIK adjustments (if present) ---
        if (pensionDeduction > 0 || bikAmount > 0) {
            var adjEqs = [];
            if (pensionDeduction > 0) {
                adjEqs.push('Pension (pre-tax): &minus;' + safeFormatCurrency(pensionDeduction));
            }
            if (bikAmount > 0) {
                adjEqs.push('BIK (added): +' + safeFormatCurrency(bikAmount));
            }
            var taxableGross = (entry.grossPay || 0) - pensionDeduction + bikAmount;
            adjEqs.push('Taxable Gross: ' + safeFormatCurrency(taxableGross));
            steps.push({ title: 'Taxable Income Adjustments', equations: adjEqs });
        }

        // --- Common deduction steps ---
        steps.push({
            title: 'Tax Credits',
            equations: [
                'Annual Tax Credit: ' + safeFormatCurrency(annualTC),
                'Period Tax Credit: ' + safeFormatCurrency(periodTC),
                'Applied Tax Credit: ' + safeFormatCurrency(appliedTC)
            ]
        });

        steps.push({
            title: 'PAYE (Income Tax)',
            html: generatePayeBreakdownHtml(calcResult, entry.paye, freqDivisor)
        });

        steps.push({
            title: 'USC (Universal Social Charge)',
            html: generateUscBreakdownHtml(calcResult, entry.usc, freqDivisor)
        });

        steps.push({
            title: 'PRSI (Social Insurance)',
            html: generatePrsiBreakdownHtml(calcResult, entry.grossPay, entry.prsi, freqDivisor)
        });

        // --- Pension in deductions total ---
        var deductionParts = [safeFormatCurrency(entry.paye) + ' + ' + safeFormatCurrency(entry.usc) + ' + ' + safeFormatCurrency(entry.prsi)];
        if (pensionDeduction > 0) {
            deductionParts = [safeFormatCurrency(entry.paye) + ' + ' + safeFormatCurrency(entry.usc) + ' + ' + safeFormatCurrency(entry.prsi) + ' + ' + safeFormatCurrency(pensionDeduction) + ' (pension)'];
        }
        deductionParts.push('= ' + safeFormatCurrency(entry.totalDeductions));

        steps.push({
            title: 'Total Deductions',
            equations: deductionParts
        });

        steps.push({
            title: 'Net Pay',
            equations: [safeFormatCurrency(entry.grossPay) + ' - ' + safeFormatCurrency(entry.totalDeductions) + ' = ' + safeFormatCurrency(entry.netPay)]
        });

        return steps;
    }

    /**
     * Render an array of breakdown steps into numbered HTML blocks.
     */
    function renderBreakdownSteps(steps) {
        var html = '';
        for (var i = 0; i < steps.length; i++) {
            var step = steps[i];
            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">' + (i + 1) + '. ' + escapeHtml(step.title) + '</div>';
            if (step.html) {
                html += step.html;
            }
            if (step.equations) {
                for (var j = 0; j < step.equations.length; j++) {
                    html += '<div class="calc-step-equation">' + step.equations[j] + '</div>';
                }
            }
            html += '</div>';
        }
        return html;
    }

    function showPayslipFromEntry(entry, run, entries, currentIndex) {
        const company = currentCompanyId ? (PayrollStorage.getCompany(currentCompanyId) || {}) : {};
        const employees = currentCompanyId ? PayrollStorage.loadEmployees(currentCompanyId) : [];
        const employee = employees.find(function(e) { return e.id === entry.employeeId; });
        const container = document.getElementById('payslip-content');
        if (!container) return;

        // Store navigation context
        currentPayslipContext = {
            run: run || currentRunData,
            entries: entries || (run ? run.entries : (currentRunData ? currentRunData.entries : [])),
            currentIndex: typeof currentIndex === 'number' ? currentIndex : -1
        };

        // Get full calculation breakdown — prefer stored breakdowns from run
        var calcResult = null;
        if (entry._payeBreakdown || entry._uscBreakdown || entry._prsiBreakdown) {
            // Use stored breakdown data computed at run time (correct frequency & cut-off)
            calcResult = {
                payeBreakdown: entry._payeBreakdown || null,
                uscBreakdown: entry._uscBreakdown || null,
                prsiBreakdown: entry._prsiBreakdown || null
            };
        } else {
            // Legacy entry: recalculate using the entry's actual frequency
            try {
                var entryFreq = entry.payFrequency || (run ? run.frequency : activeTab);
                var freqMult = entryFreq === 'weekly' ? 52 : entryFreq === 'fortnightly' ? 26 : 12;
                var annualGross = (entry.grossPay || 0) * freqMult;
                // Temporarily swap activeTab for correct annualization in shared engine
                var savedTab = activeTab;
                activeTab = entryFreq;
                calcResult = calculateNetFromGross(annualGross, employee ? employee.familyStatus : 'single');
                activeTab = savedTab;
            } catch (e) {
                console.error('Breakdown calculation error:', e);
            }
        }

        const runDate = run ? new Date(run.runDate) : new Date();
        const periodLabel = run ? run.payPeriodLabel : generatePeriodLabel();

        let html = '<div class="payslip-document">';
        html += '<div class="payslip-layout">';
        html += '<div class="payslip-main">';

        html += '<div class="payslip-header">';
        html += '<h2>' + escapeHtml(company.name || 'Company Name') + '</h2>';
        html += '<p>' + escapeHtml(company.address || '') + '</p>';
        html += '<p>' + escapeHtml(company.eircode || '') + '</p>';
        html += '</div>';

        // Employee name header bar
        html += '<div class="payslip-employee-header">';
        html += '<h2 class="payslip-employee-name">' + escapeHtml(entry.employeeName) + '</h2>';
        html += '</div>';

        // Navigation bar
        const ctx = currentPayslipContext;
        const canPrev = ctx && ctx.currentIndex > 0;
        const canNext = ctx && ctx.entries && ctx.currentIndex < ctx.entries.length - 1;
        html += '<div class="payslip-nav">';
        html += '<button type="button" class="btn btn-secondary payslip-nav-btn" id="payslip-prev"' + (canPrev ? '' : ' disabled') + ' title="Previous Employee">← Previous</button>';
        html += '<button type="button" class="btn btn-secondary payslip-nav-btn" id="payslip-back" title="Back">Back</button>';
        html += '<button type="button" class="btn btn-secondary payslip-nav-btn" id="payslip-next"' + (canNext ? '' : ' disabled') + ' title="Next Employee">Next →</button>';
        html += '</div>';

        html += '<div class="payslip-meta">';
        html += '<p><strong>Pay Period:</strong> ' + escapeHtml(periodLabel) + '</p>';
        html += '<p><strong>Date:</strong> ' + runDate.toLocaleDateString('en-IE') + '</p>';
        html += '</div>';

        html += '<div class="payslip-employee">';
        html += '<p><strong>Employee:</strong> ' + escapeHtml(entry.employeeName) + '</p>';
        html += '<p><strong>PPS Number:</strong> ' + escapeHtml(employee ? employee.ppsNumber : '') + '</p>';
        html += '</div>';

        html += '<h3>Earnings</h3>';
        html += '<table class="payslip-table">';
        html += '<tr><td>Basic Pay</td><td class="text-right">' + safeFormatCurrency(entry.grossPay) + '</td></tr>';
        if (entry.bikAmount > 0) {
            html += '<tr><td>Benefit in Kind (BIK)</td><td class="text-right">' + safeFormatCurrency(entry.bikAmount) + '</td></tr>';
        }
        html += '<tr class="total-deductions"><td><strong>Gross Pay</strong></td>';
        html += '<td class="text-right"><strong>' + safeFormatCurrency(entry.grossPay) + '</strong></td></tr>';
        html += '</table>';

        html += '<h3>Deductions</h3>';
        html += '<table class="payslip-table">';
        html += '<tr><td>PAYE</td><td class="text-right">' + safeFormatCurrency(entry.paye) + '</td></tr>';
        html += '<tr><td>USC</td><td class="text-right">' + safeFormatCurrency(entry.usc) + '</td></tr>';
        html += '<tr><td>PRSI</td><td class="text-right">' + safeFormatCurrency(entry.prsi) + '</td></tr>';
        if (entry.pensionDeduction > 0) {
            html += '<tr><td>Pension (Employee)</td><td class="text-right">' + safeFormatCurrency(entry.pensionDeduction) + '</td></tr>';
        }
        html += '<tr class="total-deductions"><td><strong>Total Deductions</strong></td>';
        html += '<td class="text-right"><strong>' + safeFormatCurrency(entry.totalDeductions) + '</strong></td></tr>';
        html += '</table>';

        html += '<div class="payslip-net">';
        html += '<p>Net Pay</p>';
        html += '<p class="net-amount">' + safeFormatCurrency(entry.netPay) + '</p>';
        html += '</div>';

        html += '</div>'; // end payslip-main

        // Calculation Breakdown
        html += '<div class="payslip-calc-breakdown">';
        html += '<h3>Calculation Breakdown</h3>';

        const frequency = entry.payFrequency || (run ? run.frequency : activeTab);
        const freqDivisor = frequency === 'weekly' ? 52 : frequency === 'fortnightly' ? 26 : 12;
        const freqLabel = frequency === 'weekly' ? 'Weekly' : frequency === 'fortnightly' ? 'Fortnightly' : 'Monthly';
        const annualTC = (entry.rpnSnapshot && entry.rpnSnapshot.taxCredits) ? entry.rpnSnapshot.taxCredits :
            (employee && employee.rpn && employee.rpn.taxCredits) ? employee.rpn.taxCredits :
            (employee && employee.taxCreditsMode === 'manual' ? (parseFloat(employee.manualTaxCredits) || 0) : getDefaultAnnualTC(employee ? employee.familyStatus : 'single'));
        const periodTC = annualTC / freqDivisor;
        const appliedTC = entry.taxCreditsUsed || 0;

        // Build calculation steps array based on pay type
        var steps = buildBreakdownSteps(entry, employee, calcResult, {
            annualTC: annualTC,
            periodTC: periodTC,
            appliedTC: appliedTC,
            freqLabel: freqLabel,
            freqDivisor: freqDivisor
        });

        // Render all steps
        html += renderBreakdownSteps(steps);

        html += '</div>'; // end payslip-calc-breakdown
        html += '</div>'; // end payslip-layout

        html += '<div class="payslip-actions">';
        html += '<button type="button" class="btn btn-secondary" id="payslip-back-btn">Back</button>';
        html += '<button type="button" class="btn btn-secondary" id="payslip-print-btn">Print</button>';
        html += '<button type="button" class="btn btn-secondary" id="payslip-export-csv-btn">Export CSV</button>';
        html += '</div>';
        html += '</div>'; // end payslip-document

        container.innerHTML = html;

        document.getElementById('payslip-back-btn').addEventListener('click', function() {
            switchTab(payslipReturnTab);
        });
        document.getElementById('payslip-print-btn').addEventListener('click', printPayslip);
        document.getElementById('payslip-export-csv-btn').addEventListener('click', function() {
            exportPayslipCSV(entry, run || { payPeriodLabel: periodLabel, runDate: runDate.toISOString() });
        });

        const prevBtn = document.getElementById('payslip-prev');
        const nextBtn = document.getElementById('payslip-next');
        const topBackBtn = document.getElementById('payslip-back');

        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                if (currentPayslipContext && currentPayslipContext.currentIndex > 0) {
                    const newIndex = currentPayslipContext.currentIndex - 1;
                    const newEntry = currentPayslipContext.entries[newIndex];
                    showPayslipFromEntry(newEntry, currentPayslipContext.run, currentPayslipContext.entries, newIndex);
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                if (currentPayslipContext && currentPayslipContext.currentIndex < currentPayslipContext.entries.length - 1) {
                    const newIndex = currentPayslipContext.currentIndex + 1;
                    const newEntry = currentPayslipContext.entries[newIndex];
                    showPayslipFromEntry(newEntry, currentPayslipContext.run, currentPayslipContext.entries, newIndex);
                }
            });
        }

        if (topBackBtn) {
            topBackBtn.addEventListener('click', function() {
                switchTab(payslipReturnTab);
            });
        }

        switchTab('payslip');
    }

    function printPayslip() {
        window.print();
    }

    // --- Exports ---
    function exportRunCSV(run) {
        const entries = run.entries || [];
        let csv = 'Employee,Gross,PAYE,USC,PRSI,Total Deductions,Net Pay\n';

        entries.forEach(function(e) {
            csv += '"' + (e.employeeName || '').replace(/"/g, '""') + '",';
            csv += csvNumber(e.grossPay) + ',';
            csv += csvNumber(e.paye) + ',';
            csv += csvNumber(e.usc) + ',';
            csv += csvNumber(e.prsi) + ',';
            csv += csvNumber(e.totalDeductions) + ',';
            csv += csvNumber(e.netPay) + '\n';
        });

        const totals = entries.reduce(function(acc, e) {
            acc.gross += e.grossPay || 0;
            acc.paye += e.paye || 0;
            acc.usc += e.usc || 0;
            acc.prsi += e.prsi || 0;
            acc.deductions += e.totalDeductions || 0;
            acc.net += e.netPay || 0;
            return acc;
        }, { gross: 0, paye: 0, usc: 0, prsi: 0, deductions: 0, net: 0 });

        csv += '"Totals",';
        csv += csvNumber(totals.gross) + ',';
        csv += csvNumber(totals.paye) + ',';
        csv += csvNumber(totals.usc) + ',';
        csv += csvNumber(totals.prsi) + ',';
        csv += csvNumber(totals.deductions) + ',';
        csv += csvNumber(totals.net) + '\n';

        const dateStr = new Date(run.runDate).toISOString().split('T')[0];
        downloadFile(csv, 'payroll-run-' + dateStr + '.csv', 'text/csv');
    }

    function exportCurrentRunCSV() {
        if (!currentRunData) return;
        exportRunCSV({ runDate: new Date().toISOString(), entries: currentRunData.entries });
    }

    function exportRunExcel(run) {
        const entries = run.entries || [];
        let html = '<table border="1">';
        html += '<tr><th>Employee</th><th>Gross</th><th>PAYE</th><th>USC</th><th>PRSI</th><th>Total Deductions</th><th>Net Pay</th></tr>';

        entries.forEach(function(e) {
            html += '<tr>';
            html += '<td>' + escapeHtml(e.employeeName || '') + '</td>';
            html += '<td>' + formatNumber(e.grossPay) + '</td>';
            html += '<td>' + formatNumber(e.paye) + '</td>';
            html += '<td>' + formatNumber(e.usc) + '</td>';
            html += '<td>' + formatNumber(e.prsi) + '</td>';
            html += '<td>' + formatNumber(e.totalDeductions) + '</td>';
            html += '<td>' + formatNumber(e.netPay) + '</td>';
            html += '</tr>';
        });

        const totals = entries.reduce(function(acc, e) {
            acc.gross += e.grossPay || 0;
            acc.paye += e.paye || 0;
            acc.usc += e.usc || 0;
            acc.prsi += e.prsi || 0;
            acc.deductions += e.totalDeductions || 0;
            acc.net += e.netPay || 0;
            return acc;
        }, { gross: 0, paye: 0, usc: 0, prsi: 0, deductions: 0, net: 0 });

        html += '<tr><td><strong>Totals</strong></td>';
        html += '<td><strong>' + formatNumber(totals.gross) + '</strong></td>';
        html += '<td><strong>' + formatNumber(totals.paye) + '</strong></td>';
        html += '<td><strong>' + formatNumber(totals.usc) + '</strong></td>';
        html += '<td><strong>' + formatNumber(totals.prsi) + '</strong></td>';
        html += '<td><strong>' + formatNumber(totals.deductions) + '</strong></td>';
        html += '<td><strong>' + formatNumber(totals.net) + '</strong></td></tr>';
        html += '</table>';

        const dateStr = new Date(run.runDate).toISOString().split('T')[0];
        downloadFile(html, 'payroll-run-' + dateStr + '.xls', 'application/vnd.ms-excel');
    }

    function exportCurrentRunExcel() {
        if (!currentRunData) return;
        exportRunExcel({ runDate: new Date().toISOString(), entries: currentRunData.entries });
    }

    function exportPayslipCSV(entry, run) {
        let csv = 'Item,Amount\n';
        csv += 'Basic Pay,' + csvNumber(entry.grossPay) + '\n';
        if (entry.bikAmount > 0) {
            csv += 'Benefit in Kind (BIK),' + csvNumber(entry.bikAmount) + '\n';
        }
        csv += 'PAYE,-' + csvNumber(entry.paye) + '\n';
        csv += 'USC,-' + csvNumber(entry.usc) + '\n';
        csv += 'PRSI,-' + csvNumber(entry.prsi) + '\n';
        if (entry.pensionDeduction > 0) {
            csv += 'Pension (Employee),-' + csvNumber(entry.pensionDeduction) + '\n';
        }
        csv += 'Total Deductions,-' + csvNumber(entry.totalDeductions) + '\n';
        csv += 'Net Pay,' + csvNumber(entry.netPay) + '\n';

        const filename = 'payslip-' + (entry.employeeName || 'employee').replace(/\s+/g, '-').toLowerCase() + '.csv';
        downloadFile(csv, filename, 'text/csv');
    }

    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }

    function csvNumber(amount) {
        return (amount || 0).toFixed(2);
    }

    // --- History ---
    function renderTaxCreditsTable() {
        const container = document.getElementById('taxcredits-content');
        if (!container) return;

        if (!currentCompanyId) {
            container.innerHTML = '<div class="empty-state">Select a company to view Tax Credits &amp; Cut-Off Points.</div>';
            return;
        }

        const employees = typeof PayrollEmployees !== 'undefined' && PayrollEmployees.getActiveEmployees
            ? PayrollEmployees.getActiveEmployees()
            : [];

        if (employees.length === 0) {
            container.innerHTML = '<div class="empty-state"><span class="icon">&#128196;</span><p>No employees found. Add employees to track tax credits and cut-off points.</p></div>';
            return;
        }

        // Ensure ledger is current for all employees
        initOrSyncLedger(currentCompanyId, selectedYear);
        var ledger = PayrollStorage.loadTaxCreditsLedger(currentCompanyId);

        const runs = PayrollStorage.loadPayrollRuns(currentCompanyId);
        const matchingRuns = runs.filter(function(r) {
            return r.taxYear === selectedYear && r.frequency === activeTab;
        });

        const totalPeriods = getCurrentPeriodConfig().periods;

        let html = '<h2>Tax Credits &amp; Cut-Off Points</h2>';
        html += '<p>Tax Year: ' + escapeHtml(selectedYear) + ' | Frequency: ' + escapeHtml(getCurrentPeriodConfig().label) + ' | Cumulative basis</p>';
        html += '<div class="table-container"><table class="results-table">';
        html += '<thead><tr>';
        html += '<th>Employee</th>';
        html += '<th>Pay Type</th>';
        html += '<th>Source</th>';
        html += '<th class="text-right">Annual TC</th>';
        html += '<th class="text-right">TC Used</th>';
        html += '<th class="text-right">TC Remaining</th>';
        html += '<th class="text-right">Annual COP</th>';
        html += '<th class="text-right">COP Used</th>';
        html += '<th class="text-right">COP Remaining</th>';
        html += '<th>Periods</th>';
        html += '</tr></thead><tbody>';

        employees.forEach(function(emp) {
            var le = (ledger[emp.id] && ledger[emp.id][selectedYear]) ? ledger[emp.id][selectedYear] : null;
            var annualTC = le ? le.annualTaxCredits : getDefaultAnnualTC(emp.familyStatus);
            var tcUsed = le ? (le.taxCreditsUsed || 0) : 0;
            var tcRemaining = le ? (le.remaining || 0) : annualTC;
            var annualCOP = le ? le.cutOffPoint : getDefaultCutOffPoint(emp.familyStatus);
            var copUsed = le ? (le.copUsed || 0) : 0;
            var copRemaining = le ? (le.copRemaining || 0) : annualCOP;
            var source = le ? (le.source || 'automatic') : 'automatic';

            // Source display label
            var sourceLabel = source === 'rpn' ? 'RPN' : source === 'manual' ? 'Manual' : 'Auto';

            // Count periods from matching runs
            var periodCount = 0;
            matchingRuns.forEach(function(run) {
                var entry = run.entries ? run.entries.find(function(e) { return e.employeeId === emp.id; }) : null;
                if (entry) periodCount += 1;
            });

            var tcNegativeClass = tcRemaining < 0 ? ' tc-negative' : '';
            var copNegativeClass = copRemaining < 0 ? ' tc-negative' : '';
            var payTypeLabel = emp.payType === 'hourly' ? 'Hourly' : 'Salaried';

            html += '<tr>';
            html += '<td>' + escapeHtml((emp.firstName || '') + ' ' + (emp.lastName || '')) + '</td>';
            html += '<td>' + escapeHtml(payTypeLabel) + '</td>';
            html += '<td>' + escapeHtml(sourceLabel) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(annualTC) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(tcUsed) + '</td>';
            html += '<td class="text-right' + tcNegativeClass + '">' + safeFormatCurrency(tcRemaining) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(annualCOP) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(copUsed) + '</td>';
            html += '<td class="text-right' + copNegativeClass + '">' + safeFormatCurrency(copRemaining) + '</td>';
            html += '<td>Period ' + periodCount + ' of ' + totalPeriods + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    function renderHistory() {
        const container = document.getElementById('history-list');
        if (!container) return;

        if (!currentCompanyId) {
            container.innerHTML = '<div class="empty-state">Select a company to view payroll history.</div>';
            return;
        }

        const runs = PayrollStorage.loadPayrollRuns(currentCompanyId);
        runs.sort(function(a, b) { return new Date(b.runDate) - new Date(a.runDate); });

        if (runs.length === 0) {
            container.innerHTML = '<div class="empty-state">No payroll runs yet. Run your first payroll to see history here.</div>';
            return;
        }

        let html = '';
        runs.forEach(function(run) {
            const totalGross = run.entries.reduce(function(sum, e) { return sum + (e.grossPay || 0); }, 0);
            const totalNet = run.entries.reduce(function(sum, e) { return sum + (e.netPay || 0); }, 0);
            const date = new Date(run.runDate);
            const runStatus = run.status || 'open';
            let statusBadge = '';
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
                const run = runs.find(function(r) { return r.id === btn.dataset.runId; });
                if (run) exportRunCSV(run);
            });
        });
        container.querySelectorAll('.btn-delete-run').forEach(function(btn) {
            btn.addEventListener('click', function() {
                deleteRun(btn.dataset.runId);
            });
        });
    }

    function expandHistoryItem(runId) {
        const detailDiv = document.getElementById('detail-' + runId);
        if (!detailDiv) return;

        const historyItem = detailDiv.closest('.history-item');
        if (historyItem && historyItem.classList.contains('expanded')) {
            historyItem.classList.remove('expanded');
            return;
        }

        if (!currentCompanyId) return;
        const runs = PayrollStorage.loadPayrollRuns(currentCompanyId);
        const run = runs.find(function(r) { return r.id === runId; });
        if (!run) return;

        const hasTimesheetData = run.entries.some(function(e) {
            return e.regularHours !== undefined || e.overtimeHours !== undefined;
        });

        let html = '<table class="results-table">';
        if (hasTimesheetData) {
            html += '<thead><tr><th>Employee</th><th>Pay Type</th><th class="text-right">Reg. Hours</th>' +
                '<th class="text-right">OT Hours</th><th class="text-right">Hourly Rate</th>' +
                '<th class="text-right">Gross</th><th class="text-right">PAYE</th>' +
                '<th class="text-right">USC</th><th class="text-right">PRSI</th>' +
                '<th class="text-right">Total Ded.</th><th class="text-right">Net Pay</th><th></th></tr></thead><tbody>';
        } else {
            html += '<thead><tr><th>Employee</th><th class="text-right">Gross</th>' +
                '<th class="text-right">PAYE</th><th class="text-right">USC</th>' +
                '<th class="text-right">PRSI</th><th class="text-right">Total Ded.</th>' +
                '<th class="text-right">Net Pay</th><th></th></tr></thead><tbody>';
        }

        run.entries.forEach(function(entry) {
            html += '<tr data-employee-id="' + escapeHtml(entry.employeeId) + '" style="cursor:pointer">';
            html += '<td>' + escapeHtml(entry.employeeName) + '</td>';
            if (hasTimesheetData) {
                const payTypeLabel = entry.payType ? entry.payType.charAt(0).toUpperCase() + entry.payType.slice(1) : 'Salaried';
                html += '<td>' + escapeHtml(payTypeLabel) + '</td>';
                html += '<td class="text-right">' + (entry.regularHours !== undefined ? escapeHtml(String(entry.regularHours)) : '\u2014') + '</td>';
                html += '<td class="text-right">' + (entry.overtimeHours ? escapeHtml(String(entry.overtimeHours)) : '\u2014') + '</td>';
                html += '<td class="text-right">' + (entry.hourlyRate ? safeFormatCurrency(entry.hourlyRate) : '\u2014') + '</td>';
            }
            html += '<td class="text-right">' + safeFormatCurrency(entry.grossPay) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.paye) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.usc) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.prsi) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.totalDeductions) + '</td>';
            html += '<td class="text-right">' + safeFormatCurrency(entry.netPay) + '</td>';
            html += '<td><button type="button" class="btn btn-small btn-view-payslip" data-employee-id="' +
                escapeHtml(entry.employeeId) + '">Payslip</button></td>';
            html += '</tr>';
        });

        const totals = run.entries.reduce(function(acc, e) {
            acc.gross += e.grossPay || 0;
            acc.paye += e.paye || 0;
            acc.usc += e.usc || 0;
            acc.prsi += e.prsi || 0;
            acc.deductions += e.totalDeductions || 0;
            acc.net += e.netPay || 0;
            return acc;
        }, { gross: 0, paye: 0, usc: 0, prsi: 0, deductions: 0, net: 0 });

        html += '<tr class="totals-row">';
        html += '<td><strong>Totals</strong></td>';
        if (hasTimesheetData) {
            html += '<td></td><td></td><td></td><td></td>';
        }
        html += '<td class="text-right"><strong>' + safeFormatCurrency(totals.gross) + '</strong></td>';
        html += '<td class="text-right"><strong>' + safeFormatCurrency(totals.paye) + '</strong></td>';
        html += '<td class="text-right"><strong>' + safeFormatCurrency(totals.usc) + '</strong></td>';
        html += '<td class="text-right"><strong>' + safeFormatCurrency(totals.prsi) + '</strong></td>';
        html += '<td class="text-right"><strong>' + safeFormatCurrency(totals.deductions) + '</strong></td>';
        html += '<td class="text-right"><strong>' + safeFormatCurrency(totals.net) + '</strong></td>';
        html += '<td></td>';
        html += '</tr></tbody></table>';

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
                if (e.target.classList.contains('btn-view-payslip')) return;
                payslipReturnTab = 'history';
                showPayslip(run.id, row.dataset.employeeId);
            });
        });
        detailDiv.querySelectorAll('.btn-view-payslip').forEach(function(btn) {
            btn.addEventListener('click', function() {
                payslipReturnTab = 'history';
                showPayslip(run.id, btn.dataset.employeeId);
            });
        });
        detailDiv.querySelectorAll('.btn-export-excel').forEach(function(btn) {
            btn.addEventListener('click', function() {
                exportRunExcel(run);
            });
        });
    }

    function deleteRun(runId) {
        showConfirmModal('Are you sure you want to delete this payroll run? This cannot be undone.', function() {
            if (!currentCompanyId) {
                showMessage('No company selected.', 'error');
                return;
            }
            // Capture run entries BEFORE deletion to reverse ledger
            var runsBeforeDelete = PayrollStorage.loadPayrollRuns(currentCompanyId);
            var runToDelete = runsBeforeDelete.find(function(r) { return r.id === runId; });
            var deleteEntries = runToDelete ? (runToDelete.entries || []) : [];
            var deleteYear = runToDelete ? (runToDelete.taxYear || selectedYear) : selectedYear;

            const success = PayrollStorage.deletePayrollRun(currentCompanyId, runId);
            if (success) {
                // Reverse ledger entries for deleted run
                if (deleteEntries.length > 0) {
                    var delLedger = PayrollStorage.loadTaxCreditsLedger(currentCompanyId);
                    deleteEntries.forEach(function(entry) {
                        if (delLedger[entry.employeeId] && delLedger[entry.employeeId][deleteYear]) {
                            var le = delLedger[entry.employeeId][deleteYear];
                            le.taxCreditsUsed = Math.max(0, (le.taxCreditsUsed || 0) - (entry.taxCreditsUsed || 0));
                            le.copUsed = Math.max(0, (le.copUsed || 0) - (entry.grossPay || 0));
                            le.remaining = le.annualTaxCredits - le.taxCreditsUsed;
                            le.copRemaining = le.cutOffPoint - le.copUsed;
                            le.lastUpdated = new Date().toISOString();
                        }
                    });
                    PayrollStorage.saveTaxCreditsLedger(currentCompanyId, delLedger);
                }

                showMessage('Payroll run deleted.', 'success');
                renderHistory();
            } else {
                showMessage('Failed to delete payroll run.', 'error');
            }
        });
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

    function showConfirmModal(message, onConfirm) {
        let modal = document.getElementById('payroll-confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'payroll-confirm-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = '<div class="modal-content"><h3>Confirm</h3><p class="modal-message"></p>' +
                '<div class="modal-actions"><button type="button" class="btn btn-danger" id="modal-confirm-btn">Confirm</button>' +
                '<button type="button" class="btn btn-secondary" id="modal-cancel-btn">Cancel</button></div></div>';
            document.body.appendChild(modal);
        }

        modal.querySelector('.modal-message').textContent = message;
        modal.classList.add('active');

        const confirmBtn = modal.querySelector('#modal-confirm-btn');
        const cancelBtn = modal.querySelector('#modal-cancel-btn');

        const newConfirm = confirmBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        newConfirm.addEventListener('click', function() {
            modal.classList.remove('active');
            if (typeof onConfirm === 'function') onConfirm();
        });
        newCancel.addEventListener('click', function() {
            modal.classList.remove('active');
        });
    }

    function escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatNumber(amount) {
        return (amount || 0).toFixed(2);
    }

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
        calculateTimesheetPreview: calculateTimesheetPreview,
        calculateEstGross: calculateEstGross,
        confirmAndSaveRun: confirmAndSaveRun,
        rollbackLastCommit: rollbackLastCommit,
        submitPeriod: submitPeriod,
        syncAllTables: syncAllTables,
        renderRPNOverview: renderRPNOverview,
        generatePeriodLabel: generatePeriodLabel,
        showPayslip: showPayslip,
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
