// payroll/payroll.js — Core Payroll App Orchestration (Multi-Company)
// Depends on: calculator-core.js, storage.js, employees.js

const PayrollApp = (function() {
    'use strict';

    // --- State ---
    let currentRunData = null;
    let payslipReturnTab = 'history';
    let currentCompanyId = null;

    // --- Constants ---
    const FAMILY_STATUS_LABELS = {
        single: 'Single',
        married: 'Married',
        marriedOneWorking: 'Married One Working',
        singleParent: 'Single Parent',
        manual: 'Manual'
    };

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

        // Render timesheet form
        let formHtml = '<table class="timesheet-table">';
        formHtml += '<thead><tr><th>Employee</th><th>Pay Type</th><th>Regular Hours</th><th>Overtime Hours</th><th>Hourly Rate (&euro;)</th><th>Est. Gross</th></tr></thead>';
        formHtml += '<tbody>';

        employees.forEach(function(emp) {
            const empId = escapeHtml(emp.id);
            const isHourly = emp.payType === 'hourly';
            const hasHourlyRate = (emp.hourlyRate || 0) > 0;
            const payTypeClass = isHourly ? 'hourly' : 'salaried';
            const payTypeLabel = isHourly ? 'Hourly' : 'Salaried';

            formHtml += '<tr>';
            formHtml += '<td>' + escapeHtml(emp.firstName + ' ' + emp.lastName) + '</td>';
            formHtml += '<td><span class="pay-type-badge ' + payTypeClass + '">' + payTypeLabel + '</span></td>';

            // Regular Hours
            if (isHourly) {
                formHtml += '<td><input type="number" class="timesheet-input" data-emp-id="' + empId + '" data-field="regularHours" min="0" step="0.5" value="0"></td>';
            } else {
                formHtml += '<td>\u2014</td>';
            }

            // Overtime Hours
            if (isHourly || hasHourlyRate) {
                formHtml += '<td><input type="number" class="timesheet-input" data-emp-id="' + empId + '" data-field="overtimeHours" min="0" step="0.5" value="0"></td>';
            } else {
                formHtml += '<td>\u2014</td>';
            }

            // Hourly Rate
            if (isHourly || hasHourlyRate) {
                const rateValue = (emp.hourlyRate || 0).toFixed(2);
                formHtml += '<td><input type="number" class="timesheet-input" data-emp-id="' + empId + '" data-field="hourlyRate" min="0" step="0.5" value="' + rateValue + '"></td>';
            } else {
                formHtml += '<td>\u2014</td>';
            }

            // Est. Gross
            const estGross = isHourly ? '\u20ac0.00' : safeFormatCurrency(convertFromAnnual(emp.annualGross || 0));
            formHtml += '<td><span class="est-gross" data-emp-id="' + empId + '">' + estGross + '</span></td>';
            formHtml += '</tr>';
        });

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

    function calculateTimesheetPreview() {
        const employees = typeof PayrollEmployees !== 'undefined' && PayrollEmployees.getActiveEmployees
            ? PayrollEmployees.getActiveEmployees()
            : [];
        if (employees.length === 0) {
            showMessage('No active employees to process.', 'error');
            return;
        }

        currentRunData = {
            entries: [],
            totals: { gross: 0, overtimeGross: 0, paye: 0, usc: 0, prsi: 0, totalDeductions: 0, net: 0 }
        };

        employees.forEach(function(emp) {
            try {
                const empId = emp.id;
                const regularHoursInput = document.querySelector('.timesheet-input[data-emp-id="' + empId + '"][data-field="regularHours"]');
                const overtimeHoursInput = document.querySelector('.timesheet-input[data-emp-id="' + empId + '"][data-field="overtimeHours"]');
                const hourlyRateInput = document.querySelector('.timesheet-input[data-emp-id="' + empId + '"][data-field="hourlyRate"]');

                const regularHours = regularHoursInput ? parseFloat(regularHoursInput.value) || 0 : 0;
                const overtimeHours = overtimeHoursInput ? parseFloat(overtimeHoursInput.value) || 0 : 0;
                const hourlyRate = hourlyRateInput ? parseFloat(hourlyRateInput.value) || 0 : 0;

                const periodGross = calculateEstGross(emp, regularHours, overtimeHours, hourlyRate);
                const annualizedGross = convertToAnnual(periodGross);
                const familyStatus = emp.familyStatus || 'single';

                const result = calculateNetFromGross(annualizedGross, familyStatus);

                const grossPay = periodGross;
                const paye = convertFromAnnual(result.paye);
                const usc = convertFromAnnual(result.usc);
                const prsi = convertFromAnnual(result.prsi);
                const totalDeductions = convertFromAnnual(result.totalDeductions);
                const netPay = convertFromAnnual(result.netIncome);
                const regularGross = emp.payType === 'hourly' ? (regularHours * hourlyRate) : convertFromAnnual(emp.annualGross || 0);
                const overtimeGross = overtimeHours * hourlyRate * (emp.overtimeMultiplier || 1.5);

                currentRunData.entries.push({
                    employeeId: emp.id,
                    employeeName: emp.firstName + ' ' + emp.lastName,
                    grossPay: grossPay,
                    paye: paye,
                    usc: usc,
                    prsi: prsi,
                    totalDeductions: totalDeductions,
                    netPay: netPay,
                    taxCreditsUsed: convertFromAnnual(result.taxCredits),
                    payType: emp.payType || 'salaried',
                    regularHours: regularHours,
                    overtimeHours: overtimeHours,
                    hourlyRate: hourlyRate,
                    overtimeMultiplier: emp.overtimeMultiplier || 1.5,
                    regularGross: regularGross,
                    overtimeGross: overtimeGross
                });

                currentRunData.totals.gross += grossPay;
                currentRunData.totals.overtimeGross += overtimeGross;
                currentRunData.totals.paye += paye;
                currentRunData.totals.usc += usc;
                currentRunData.totals.prsi += prsi;
                currentRunData.totals.totalDeductions += totalDeductions;
                currentRunData.totals.net += netPay;
            } catch (err) {
                console.error('Calculation error for employee', emp.id, err);
            }
        });

        // Round totals
        currentRunData.totals.gross = Math.round(currentRunData.totals.gross * 100) / 100;
        currentRunData.totals.overtimeGross = Math.round(currentRunData.totals.overtimeGross * 100) / 100;
        currentRunData.totals.paye = Math.round(currentRunData.totals.paye * 100) / 100;
        currentRunData.totals.usc = Math.round(currentRunData.totals.usc * 100) / 100;
        currentRunData.totals.prsi = Math.round(currentRunData.totals.prsi * 100) / 100;
        currentRunData.totals.totalDeductions = Math.round(currentRunData.totals.totalDeductions * 100) / 100;
        currentRunData.totals.net = Math.round(currentRunData.totals.net * 100) / 100;

        // Render preview table
        const previewDiv = document.getElementById('timesheet-preview');
        let previewHtml = '<h3>Payroll Preview</h3>';
        previewHtml += '<div class="table-container"><table class="results-table"><thead><tr><th>Name</th><th>Hours</th><th>Gross</th><th>Overtime Pay</th><th>Allowance</th><th>PAYE</th><th>PRSI</th><th>USC</th><th>Other Deductions</th><th>Total Deductions</th><th>Net</th></tr></thead><tbody>';

        currentRunData.entries.forEach(function(entry) {
            let hoursDisplay = '';
            if (entry.payType === 'hourly') {
                hoursDisplay = (entry.regularHours + entry.overtimeHours).toFixed(1) + ' hrs';
            } else {
                const frequencyLabel = activeTab.charAt(0).toUpperCase() + activeTab.slice(1);
                hoursDisplay = entry.overtimeHours > 0 ? frequencyLabel + ' + ' + entry.overtimeHours.toFixed(2) + ' OT hrs' : frequencyLabel;
            }

            previewHtml += '<tr data-employee-id="' + escapeHtml(entry.employeeId) + '" style="cursor:pointer">';
            previewHtml += '<td>' + escapeHtml(entry.employeeName) + '</td>';
            previewHtml += '<td>' + hoursDisplay + '</td>';
            previewHtml += '<td class="text-right">' + safeFormatCurrency(entry.grossPay) + '</td>';
            previewHtml += '<td class="text-right">' + safeFormatCurrency(entry.overtimeGross) + '</td>';
            previewHtml += '<td class="text-right">' + safeFormatCurrency(0) + '</td>';
            previewHtml += '<td class="text-right">' + safeFormatCurrency(entry.paye) + '</td>';
            previewHtml += '<td class="text-right">' + safeFormatCurrency(entry.prsi) + '</td>';
            previewHtml += '<td class="text-right">' + safeFormatCurrency(entry.usc) + '</td>';
            previewHtml += '<td class="text-right">' + safeFormatCurrency(0) + '</td>';
            previewHtml += '<td class="text-right">' + safeFormatCurrency(entry.totalDeductions) + '</td>';
            previewHtml += '<td class="text-right">' + safeFormatCurrency(entry.netPay) + '</td>';
            previewHtml += '</tr>';
        });

        previewHtml += '<tr class="totals-row">';
        previewHtml += '<td><strong>Totals</strong></td>';
        previewHtml += '<td></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.gross) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.overtimeGross) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(0) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.paye) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.prsi) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.usc) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(0) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.totalDeductions) + '</strong></td>';
        previewHtml += '<td class="text-right"><strong>' + safeFormatCurrency(currentRunData.totals.net) + '</strong></td>';
        previewHtml += '</tr></tbody></table></div>';

        if (previewDiv) {
            previewDiv.innerHTML = previewHtml;
            previewDiv.classList.remove('hidden');
        }

        // Bind row clicks for payslip
        if (previewDiv) {
            previewDiv.querySelectorAll('tbody tr[data-employee-id]').forEach(function(row) {
                row.addEventListener('click', function() {
                    const empId = row.dataset.employeeId;
                    const entry = currentRunData.entries.find(function(e) { return e.employeeId === empId; });
                    if (entry) {
                        payslipReturnTab = 'run';
                        showPayslipFromEntry(entry);
                    }
                });
            });
        }

        // Render commit button
        const commitDiv = document.getElementById('timesheet-commit');
        if (commitDiv) {
            commitDiv.innerHTML = '<button class="btn btn-primary" id="commit-payroll-btn">Commit to Payroll</button>';
            commitDiv.classList.remove('hidden');

            const commitBtn = document.getElementById('commit-payroll-btn');
            if (commitBtn) {
                commitBtn.addEventListener('click', confirmAndSaveRun);
            }
        }
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

        const run = {
            id: PayrollStorage.generateId(),
            runDate: new Date().toISOString(),
            payPeriodLabel: generatePeriodLabel(),
            taxYear: selectedYear,
            taxPeriod: getCurrentPeriodVar(),
            frequency: activeTab,
            entries: currentRunData.entries.map(function(e) {
                return {
                    employeeId: e.employeeId,
                    employeeName: e.employeeName,
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
                    overtimeGross: e.overtimeGross
                };
            })
        };

        const success = PayrollStorage.savePayrollRun(currentCompanyId, run);
        if (success) {
            showMessage('Payroll run saved successfully.', 'success');
            currentRunData = null;
            document.getElementById('run-payroll-results').classList.add('hidden');
            const timesheetPreview = document.getElementById('timesheet-preview');
            const timesheetCommit = document.getElementById('timesheet-commit');
            if (timesheetPreview) timesheetPreview.classList.add('hidden');
            if (timesheetCommit) timesheetCommit.classList.add('hidden');
            renderHistory();
            switchTab('history');
        } else {
            showMessage('Failed to save payroll run.', 'error');
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

        showPayslipFromEntry(entry, run);
    }

    function generatePayeBreakdownHtml(calcResult, entryPAYE) {
        if (!calcResult || !calcResult.payeBreakdown) {
            return '<div class="calc-step-equation">Result: ' + safeFormatCurrency(entryPAYE) + '</div>';
        }
        var html = '';
        var pb = calcResult.payeBreakdown;
        pb.bands.forEach(function(band) {
            html += '<div class="calc-step-equation">' + safeFormatCurrency(band.annualTaxableAmount) + ' @ ' + escapeHtml(band.rateDisplay) + '% = ' + safeFormatCurrency(band.annualTax) + ' &nbsp;&nbsp;(' + escapeHtml(band.description) + ')</div>';
        });
        html += '<div class="calc-step-equation">Gross Tax: ' + safeFormatCurrency(pb.grossTax) + '</div>';
        html += '<div class="calc-step-equation">Tax Credits: &minus;' + safeFormatCurrency(pb.taxCredits) + '</div>';
        html += '<div class="calc-step-equation">Net PAYE (Annual): ' + safeFormatCurrency(pb.netTax) + '</div>';
        html += '<div class="calc-step-equation">Net PAYE (Period): ' + safeFormatCurrency(entryPAYE) + '</div>';
        return html;
    }

    function generateUscBreakdownHtml(calcResult, entryUSC) {
        if (!calcResult || !calcResult.uscBreakdown) {
            return '<div class="calc-step-equation">Result: ' + safeFormatCurrency(entryUSC) + '</div>';
        }
        var html = '';
        var ub = calcResult.uscBreakdown;
        if (ub.exempt) {
            html += '<div class="calc-step-equation">Exempt (income below &euro;13,000)</div>';
        } else {
            ub.bands.forEach(function(band) {
                html += '<div class="calc-step-equation">' + safeFormatCurrency(band.taxableAmount) + ' @ ' + (band.rate * 100).toFixed(1) + '% = ' + safeFormatCurrency(band.uscAmount) + '</div>';
            });
            html += '<div class="calc-step-equation">Total USC (Annual): ' + safeFormatCurrency(ub.total) + '</div>';
        }
        html += '<div class="calc-step-equation">USC (Period): ' + safeFormatCurrency(entryUSC) + '</div>';
        return html;
    }

    function generatePrsiBreakdownHtml(calcResult, entryGross, entryPRSI) {
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
        }
        html += '<div class="calc-step-equation">Net PRSI (Period): ' + safeFormatCurrency(entryPRSI) + '</div>';
        return html;
    }

    function showPayslipFromEntry(entry, run) {
        const company = currentCompanyId ? (PayrollStorage.getCompany(currentCompanyId) || {}) : {};
        const employees = currentCompanyId ? PayrollStorage.loadEmployees(currentCompanyId) : [];
        const employee = employees.find(function(e) { return e.id === entry.employeeId; });
        const container = document.getElementById('payslip-content');
        if (!container) return;

        // Get full calculation breakdown
        var calcResult = null;
        try {
            var annualGross = convertToAnnual(entry.grossPay);
            calcResult = calculateNetFromGross(annualGross, employee ? employee.familyStatus : 'single');
        } catch (e) {
            console.error('Breakdown calculation error:', e);
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
        html += '</table>';

        html += '<h3>Deductions</h3>';
        html += '<table class="payslip-table">';
        html += '<tr><td>PAYE</td><td class="text-right">' + safeFormatCurrency(entry.paye) + '</td></tr>';
        html += '<tr><td>USC</td><td class="text-right">' + safeFormatCurrency(entry.usc) + '</td></tr>';
        html += '<tr><td>PRSI</td><td class="text-right">' + safeFormatCurrency(entry.prsi) + '</td></tr>';
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

        const frequency = run ? run.frequency : activeTab;
        const freqDivisor = frequency === 'weekly' ? 52 : frequency === 'fortnightly' ? 26 : 12;
        const freqLabel = frequency === 'weekly' ? 'Weekly' : frequency === 'fortnightly' ? 'Fortnightly' : 'Monthly';

        if (entry.payType === 'hourly') {
            const regularHours = entry.regularHours || 0;
            const overtimeHours = entry.overtimeHours || 0;
            const hourlyRate = entry.hourlyRate || 0;
            const multiplier = entry.overtimeMultiplier || 1.5;
            const regularGross = entry.regularGross || 0;
            const overtimeGross = entry.overtimeGross || 0;

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">1. Regular Pay</div>';
            html += '<div class="calc-step-equation">' + escapeHtml(String(regularHours)) + ' hrs &times; ' + safeFormatCurrency(hourlyRate) + ' = ' + safeFormatCurrency(regularGross) + '</div>';
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">2. Overtime Pay</div>';
            html += '<div class="calc-step-equation">' + escapeHtml(String(overtimeHours)) + ' hrs &times; ' + safeFormatCurrency(hourlyRate) + ' &times; ' + escapeHtml(String(multiplier)) + ' = ' + safeFormatCurrency(overtimeGross) + '</div>';
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">3. Total Gross</div>';
            html += '<div class="calc-step-equation">' + safeFormatCurrency(regularGross) + ' + ' + safeFormatCurrency(overtimeGross) + ' = ' + safeFormatCurrency(entry.grossPay) + '</div>';
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">4. PAYE (Income Tax)</div>';
            html += '<div class="calc-step-equation">Annual equivalent: ' + safeFormatCurrency(entry.grossPay) + ' &times; ' + escapeHtml(String(freqDivisor)) + ' = ' + safeFormatCurrency(entry.grossPay * freqDivisor) + '</div>';
            html += generatePayeBreakdownHtml(calcResult, entry.paye);
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">5. USC (Universal Social Charge)</div>';
            html += generateUscBreakdownHtml(calcResult, entry.usc);
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">6. PRSI (Social Insurance)</div>';
            html += generatePrsiBreakdownHtml(calcResult, entry.grossPay, entry.prsi);
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">7. Total Deductions</div>';
            html += '<div class="calc-step-equation">' + safeFormatCurrency(entry.paye) + ' + ' + safeFormatCurrency(entry.usc) + ' + ' + safeFormatCurrency(entry.prsi) + ' = ' + safeFormatCurrency(entry.totalDeductions) + '</div>';
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">8. Net Pay</div>';
            html += '<div class="calc-step-equation">' + safeFormatCurrency(entry.grossPay) + ' - ' + safeFormatCurrency(entry.totalDeductions) + ' = ' + safeFormatCurrency(entry.netPay) + '</div>';
            html += '</div>';
        } else if (entry.payType === 'salaried') {
            const annualGross = employee ? (employee.annualGross || 0) : 0;
            const regularGross = entry.regularGross || 0;
            const displayAnnual = annualGross > 0 ? annualGross : regularGross * freqDivisor;
            const overtimeHours = entry.overtimeHours || 0;
            const hourlyRate = entry.hourlyRate || 0;
            const multiplier = entry.overtimeMultiplier || 1.5;
            const overtimeGross = entry.overtimeGross || 0;

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">1. Basic Salary</div>';
            html += '<div class="calc-step-equation">Annual: ' + safeFormatCurrency(displayAnnual) + '</div>';
            html += '<div class="calc-step-equation">' + escapeHtml(freqLabel) + ': ' + safeFormatCurrency(displayAnnual) + ' &divide; ' + escapeHtml(String(freqDivisor)) + ' = ' + safeFormatCurrency(regularGross) + '</div>';
            html += '</div>';

            if (overtimeHours > 0) {
                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">2. Overtime Pay</div>';
                html += '<div class="calc-step-equation">' + escapeHtml(String(overtimeHours)) + ' hrs &times; ' + safeFormatCurrency(hourlyRate) + ' &times; ' + escapeHtml(String(multiplier)) + ' = ' + safeFormatCurrency(overtimeGross) + '</div>';
                html += '</div>';

                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">3. Total Gross</div>';
                html += '<div class="calc-step-equation">' + safeFormatCurrency(regularGross) + ' + ' + safeFormatCurrency(overtimeGross) + ' = ' + safeFormatCurrency(entry.grossPay) + '</div>';
                html += '</div>';

                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">4. PAYE (Income Tax)</div>';
                html += generatePayeBreakdownHtml(calcResult, entry.paye);
                html += '</div>';

                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">5. USC (Universal Social Charge)</div>';
                html += generateUscBreakdownHtml(calcResult, entry.usc);
                html += '</div>';

                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">6. PRSI (Social Insurance)</div>';
                html += generatePrsiBreakdownHtml(calcResult, entry.grossPay, entry.prsi);
                html += '</div>';

                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">7. Total Deductions</div>';
                html += '<div class="calc-step-equation">' + safeFormatCurrency(entry.paye) + ' + ' + safeFormatCurrency(entry.usc) + ' + ' + safeFormatCurrency(entry.prsi) + ' = ' + safeFormatCurrency(entry.totalDeductions) + '</div>';
                html += '</div>';

                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">8. Net Pay</div>';
                html += '<div class="calc-step-equation">' + safeFormatCurrency(entry.grossPay) + ' - ' + safeFormatCurrency(entry.totalDeductions) + ' = ' + safeFormatCurrency(entry.netPay) + '</div>';
                html += '</div>';
            } else {
                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">2. Total Gross</div>';
                html += '<div class="calc-step-equation">' + safeFormatCurrency(regularGross) + ' = ' + safeFormatCurrency(entry.grossPay) + '</div>';
                html += '</div>';

                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">3. PAYE (Income Tax)</div>';
                html += generatePayeBreakdownHtml(calcResult, entry.paye);
                html += '</div>';
                
                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">4. USC (Universal Social Charge)</div>';
                html += generateUscBreakdownHtml(calcResult, entry.usc);
                html += '</div>';
                
                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">5. PRSI (Social Insurance)</div>';
                html += generatePrsiBreakdownHtml(calcResult, entry.grossPay, entry.prsi);
                html += '</div>';
                
                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">6. Total Deductions</div>';
                html += '<div class="calc-step-equation">' + safeFormatCurrency(entry.paye) + ' + ' + safeFormatCurrency(entry.usc) + ' + ' + safeFormatCurrency(entry.prsi) + ' = ' + safeFormatCurrency(entry.totalDeductions) + '</div>';
                html += '</div>';

                html += '<div class="calc-step">';
                html += '<div class="calc-step-title">7. Net Pay</div>';
                html += '<div class="calc-step-equation">' + safeFormatCurrency(entry.grossPay) + ' - ' + safeFormatCurrency(entry.totalDeductions) + ' = ' + safeFormatCurrency(entry.netPay) + '</div>';
                html += '</div>';
            }
        } else {
            // Legacy entries without timesheet data
            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">1. Gross Pay</div>';
            html += '<div class="calc-step-equation">' + safeFormatCurrency(entry.grossPay) + '</div>';
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">2. PAYE (Income Tax)</div>';
            html += generatePayeBreakdownHtml(calcResult, entry.paye);
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">3. USC (Universal Social Charge)</div>';
            html += generateUscBreakdownHtml(calcResult, entry.usc);
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">4. PRSI (Social Insurance)</div>';
            html += generatePrsiBreakdownHtml(calcResult, entry.grossPay, entry.prsi);
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">5. Total Deductions</div>';
            html += '<div class="calc-step-equation">' + safeFormatCurrency(entry.paye) + ' + ' + safeFormatCurrency(entry.usc) + ' + ' + safeFormatCurrency(entry.prsi) + ' = ' + safeFormatCurrency(entry.totalDeductions) + '</div>';
            html += '</div>';

            html += '<div class="calc-step">';
            html += '<div class="calc-step-title">6. Net Pay</div>';
            html += '<div class="calc-step-equation">' + safeFormatCurrency(entry.grossPay) + ' - ' + safeFormatCurrency(entry.totalDeductions) + ' = ' + safeFormatCurrency(entry.netPay) + '</div>';
            html += '</div>';
        }

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
        csv += 'PAYE,-' + csvNumber(entry.paye) + '\n';
        csv += 'USC,-' + csvNumber(entry.usc) + '\n';
        csv += 'PRSI,-' + csvNumber(entry.prsi) + '\n';
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

            html += '<div class="history-item" data-run-id="' + escapeHtml(run.id) + '">';
            html += '<div class="history-summary">';
            html += '<div class="history-date">' + escapeHtml(date.toLocaleDateString('en-IE') + ' ' + date.toLocaleTimeString('en-IE', {hour: '2-digit', minute: '2-digit'})) + '</div>';
            html += '<div class="history-period">' + escapeHtml(run.payPeriodLabel || '') + '</div>';
            html += '<div class="history-meta">' + run.entries.length + ' employees | Gross: ' +
                safeFormatCurrency(totalGross) + ' | Net: ' + safeFormatCurrency(totalNet) + '</div>';
            html += '<div class="history-actions">';
            html += '<button type="button" class="btn btn-secondary btn-expand" data-run-id="' + escapeHtml(run.id) + '">View Details</button>';
            html += '<button type="button" class="btn btn-secondary btn-export-csv" data-run-id="' + escapeHtml(run.id) + '">Export CSV</button>';
            html += '<button type="button" class="btn btn-danger btn-delete-run" data-run-id="' + escapeHtml(run.id) + '">Delete</button>';
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
            const success = PayrollStorage.deletePayrollRun(currentCompanyId, runId);
            if (success) {
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
