// payroll/employees.js — Employee CRUD Module
// Depends on: PayrollStorage (global), formatCurrency (global from calculator-core.js)

const PayrollEmployees = (function() {
    'use strict';

    const MAX_EMPLOYEES = 10;
    const PPS_REGEX = /^\d{7}[A-Za-z]{1,2}$/;
    const FAMILY_STATUS_OPTIONS = [
        { value: 'single', label: 'Single' },
        { value: 'married', label: 'Married' },
        { value: 'marriedOneWorking', label: 'Married One Working' },
        { value: 'singleParent', label: 'Single Parent' },
        { value: 'custom', label: 'Custom Tax Credit' }
    ];
    const PRSI_CLASS_OPTIONS = ['A', 'A0', 'AX', 'AL', 'A1'];

    let container = null;
    let currentEmployeeId = null;
    let deleteTargetId = null;
    let currentCompanyId = null;
    let employeeReportVisible = false;
    let employeeReportSort = { field: 'name', direction: 'asc' };
    const EMPLOYEE_REPORT_FIELDS = [
        { key: 'name', label: 'Name' },
        { key: 'employeeNumber', label: 'Employee No.' },
        { key: 'status', label: 'Status' },
        { key: 'familyStatus', label: 'Family Status' },
        { key: 'payType', label: 'Pay Type' },
        { key: 'payFrequency', label: 'Pay Frequency' },
        { key: 'pay', label: 'Pay Amount' },
        { key: 'pps', label: 'PPS' },
        { key: 'bank', label: 'Bank Account' },
        { key: 'prsi', label: 'PRSI' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'taxCredits', label: 'Tax Credit' },
        { key: 'cutOffPoint', label: 'COP' }
    ];
    let employeeReportFields = {
        name: true,
        employeeNumber: true,
        status: true,
        familyStatus: true,
        payType: true,
        payFrequency: true,
        pay: false,
        pps: false,
        bank: false,
        prsi: true,
        startDate: true,
        taxCredits: false,
        cutOffPoint: false
    };

    // --- Private Helpers ---

    function getContainer() {
        if (!container) {
            container = document.getElementById('employees-content');
        }
        return container;
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
        }).format(amount);
    }

    function getDefaultAnnualTC(familyStatus) {
        if (typeof PayrollUtils !== 'undefined' && PayrollUtils.getDefaultAnnualTC) {
            return PayrollUtils.getDefaultAnnualTC(familyStatus);
        }
        return familyStatus === 'married' ? 8000 :
            familyStatus === 'marriedOneWorking' ? 6000 :
            familyStatus === 'singleParent' ? 5900 : 4000;
    }

    function getDefaultCutOffPoint(familyStatus) {
        if (typeof PayrollUtils !== 'undefined' && PayrollUtils.getDefaultCutOffPoint) {
            return PayrollUtils.getDefaultCutOffPoint(familyStatus);
        }
        return familyStatus === 'married' ? 88000 :
            familyStatus === 'marriedOneWorking' ? 53000 :
            familyStatus === 'singleParent' ? 48000 : 44000;
    }

    function getFamilyStatusLabel(familyStatus) {
        const option = FAMILY_STATUS_OPTIONS.find(o => o.value === familyStatus);
        return option ? option.label : 'Single';
    }

    function isCustomTaxStatus(familyStatus) {
        return familyStatus === 'custom';
    }

    function isCloudPayrollMode() {
        if (!currentCompanyId || typeof PayrollStorage === 'undefined') return false;
        const company = PayrollStorage.getCompany(currentCompanyId);
        if (typeof PayrollMode !== 'undefined') {
            return PayrollMode.isCloud(company);
        }
        return !!(company && company.payrollMode === 'cloud');
    }

    function getCloudRpnAnnualTaxCredits(emp, rpn) {
        if (rpn.annualTaxCredits !== undefined && rpn.annualTaxCredits !== null) {
            return parseFloat(rpn.annualTaxCredits) || 0;
        }
        if (rpn.taxCredits !== undefined && rpn.taxCredits !== null) {
            return parseFloat(rpn.taxCredits) || 0;
        }
        return 0;
    }

    function getCloudRpnAnnualCutOff(emp, rpn) {
        if (rpn.cutOffPoint !== undefined && rpn.cutOffPoint !== null) {
            return parseFloat(rpn.cutOffPoint) || 0;
        }
        return 0;
    }

    function buildCloudRpnSummaryHtml(emp, rpn) {
        const hasRpn = !!(rpn && rpn.rpnNumber);
        const annualTC = getCloudRpnAnnualTaxCredits(emp, rpn || {});
        const annualCOP = getCloudRpnAnnualCutOff(emp, rpn || {});
        const periodTC = rpn && rpn.periodicTaxCredit ? parseFloat(rpn.periodicTaxCredit) : 0;
        const periodCOP = rpn && rpn.periodicStandardRateCutOffPoint ? parseFloat(rpn.periodicStandardRateCutOffPoint) : 0;

        let html = '<div class="cloud-rpn-summary">';
        html += '<h3>Tax Credits &amp; COP (from RPN)</h3>';
        if (!hasRpn) {
            html += '<p class="cloud-rpn-summary-note">No RPN retrieved yet. Use the <strong>RPN</strong> tab and click <strong>Retrieve RPN</strong> to load values from the simulated Revenue server.</p>';
        } else {
            html += '<p class="cloud-rpn-summary-note">These values are supplied by Revenue RPN and cannot be edited on the employee card.</p>';
            html += '<div class="cloud-rpn-summary-grid">';
            html += '<div><span class="cloud-rpn-label">RPN Number</span><strong>' + escapeHtml(rpn.rpnNumber) + '</strong></div>';
            html += '<div><span class="cloud-rpn-label">Annual Tax Credit</span><strong>' + safeFormatCurrency(annualTC) + '</strong></div>';
            html += '<div><span class="cloud-rpn-label">Annual COP</span><strong>' + safeFormatCurrency(annualCOP) + '</strong></div>';
            html += '<div><span class="cloud-rpn-label">Period Tax Credit</span><strong>' + safeFormatCurrency(periodTC) + '</strong></div>';
            html += '<div><span class="cloud-rpn-label">Period COP</span><strong>' + safeFormatCurrency(periodCOP) + '</strong></div>';
            html += '<div><span class="cloud-rpn-label">Source</span><strong>' + escapeHtml(rpn.source || 'fakeRevenueServer') + '</strong></div>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    function applyCloudRpnReadOnlyState(el) {
        if (!el || !isCloudPayrollMode()) return;
        const rpnSection = el.querySelector('.employee-rpn-section');
        if (!rpnSection) return;

        const lockedIds = [
            'rpn-number',
            'rpn-prsi-class',
            'rpn-usc-status',
            'rpn-employer-prsi',
            'rpn-prev-pay',
            'rpn-prev-tax',
            'rpn-prev-usc'
        ];

        rpnSection.querySelectorAll('input, select').forEach(function(input) {
            input.disabled = lockedIds.indexOf(input.id) !== -1;
        });
        rpnSection.classList.add('rpn-readonly');

        const noteEl = rpnSection.querySelector('.rpn-note');
        if (noteEl) {
            noteEl.textContent = 'Core RPN values are retrieved from the simulated Revenue server. BIK, pension and AVC can still be updated here.';
            noteEl.style.color = '#1565c0';
        }
    }

    function maskPPS(pps) {
        if (!pps || pps.length < 4) return pps;
        return '****' + pps.slice(-4);
    }

    function getPayFrequencyLabel(frequency) {
        if (frequency === 'weekly') return 'Weekly';
        if (frequency === 'fortnightly') return 'Fortnightly';
        return 'Monthly';
    }

    function getPeriodicCopColumnLabel(payFreq, cloudMode) {
        const prefix = cloudMode ? 'RPN' : 'Local';
        if (payFreq === 'weekly') return prefix + ' Weekly COP';
        if (payFreq === 'fortnightly') return prefix + ' Fortnightly COP';
        return prefix + ' Monthly COP';
    }

    function resolveEmployeePayPeriodNumber(entry, run, payFreq) {
        if (entry && entry.periodNumber !== undefined && entry.periodNumber !== null && entry.periodNumber !== '') {
            const parsed = parseInt(entry.periodNumber, 10);
            if (!isNaN(parsed)) return parsed;
        }
        if (run && run.periodNumbers && payFreq && run.periodNumbers[payFreq] !== undefined && run.periodNumbers[payFreq] !== null) {
            const parsed = parseInt(run.periodNumbers[payFreq], 10);
            if (!isNaN(parsed)) return parsed;
        }
        if (payFreq === 'weekly') {
            if (run && run.weekNumber) {
                const parsed = parseInt(run.weekNumber, 10);
                if (!isNaN(parsed)) return parsed;
            }
            if (run && run.periodNumber) {
                const parsed = parseInt(run.periodNumber, 10);
                if (!isNaN(parsed)) return parsed;
            }
        }
        return null;
    }

    function buildEmployeeHistoryRows(submittedRuns, employeeId, payFreq) {
        const rows = [];
        submittedRuns.forEach(function(run) {
            const entry = run.entries.find(function(e) { return e.employeeId === employeeId; });
            if (!entry) return;
            rows.push({
                run: run,
                entry: entry,
                periodNumber: resolveEmployeePayPeriodNumber(entry, run, payFreq)
            });
        });

        const ascRows = rows.slice().sort(function(a, b) {
            return new Date(a.run.runDate) - new Date(b.run.runDate);
        });
        let legacySeq = 0;
        ascRows.forEach(function(row) {
            if (row.periodNumber == null) {
                legacySeq += 1;
                row.periodNumber = legacySeq;
            }
        });

        rows.sort(function(a, b) {
            const dateDiff = new Date(b.run.runDate) - new Date(a.run.runDate);
            if (dateDiff !== 0) return dateDiff;
            return (b.periodNumber || 0) - (a.periodNumber || 0);
        });

        return rows;
    }

    function buildSubmittedValuesByPayPeriod(submittedRuns, employeeId, payFreq, getValue) {
        const values = {};
        const sorted = (submittedRuns || []).slice().sort(function(a, b) {
            return new Date(a.runDate) - new Date(b.runDate);
        });
        let legacySeq = 0;
        sorted.forEach(function(run) {
            const entry = run.entries.find(function(e) { return e.employeeId === employeeId; });
            if (!entry) return;
            let period = resolveEmployeePayPeriodNumber(entry, run, payFreq);
            if (period == null) {
                legacySeq += 1;
                period = legacySeq;
            }
            values[period] = getValue(entry, run);
        });
        return values;
    }

    function scrollRowNearTopOfContainer(row, scrollContainer, topGap) {
        if (!row || !scrollContainer) return;
        const gap = typeof topGap === 'number' ? topGap : 6;
        const thead = scrollContainer.querySelector('thead');
        const headerHeight = thead ? thead.getBoundingClientRect().height : 0;
        const containerRect = scrollContainer.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const delta = rowRect.top - containerRect.top - headerHeight - gap;
        if (Math.abs(delta) < 2) return;
        scrollContainer.scrollTo({
            top: Math.max(0, scrollContainer.scrollTop + delta),
            behavior: 'smooth'
        });
    }

    function syncLedgerScheduleSelection(periodNum, historyRow) {
        const period = String(periodNum || '').trim();
        document.querySelectorAll('.tc-schedule-row, .cop-schedule-row').forEach(function(row) {
            row.classList.remove('selected');
        });
        if (!period) return;

        if (historyRow) {
            const histScroll = historyRow.closest('.emp-history-scroll');
            scrollRowNearTopOfContainer(historyRow, histScroll, 4);
        }

        ['tc-schedule-row', 'cop-schedule-row'].forEach(function(rowClass) {
            const match = document.querySelector('.' + rowClass + '[data-period="' + period + '"]');
            if (!match) return;
            match.classList.add('selected');
            const scroll = match.closest('.tc-remaining-scroll');
            scrollRowNearTopOfContainer(match, scroll, 6);
        });
    }

    function getEmployeeIban(emp) {
        return emp ? (emp.iban || emp.bankAccountIban || emp.bankAccount || '') : '';
    }

    function maskIban(iban) {
        const cleaned = String(iban || '').replace(/\s+/g, '');
        if (!cleaned) return 'Not provided';
        return 'IBAN ending ' + cleaned.slice(-4);
    }

    function getEmployeeName(emp) {
        return ((emp && emp.firstName) || '') + ' ' + ((emp && emp.lastName) || '');
    }

    function getEmployeeNumber(emp) {
        return emp ? (emp.employeeNumber || emp.employeeNo || emp.personnelNumber || '') : '';
    }

    function getEmployeeNumberPrefix() {
        let companyName = '';
        if (typeof PayrollStorage !== 'undefined' && PayrollStorage.getCompany && currentCompanyId) {
            const company = PayrollStorage.getCompany(currentCompanyId);
            companyName = company ? (company.name || '') : '';
        }
        const cleaned = String(companyName || 'EMP').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        return (cleaned + 'XXX').slice(0, 3);
    }

    function generateEmployeeNumber(employees) {
        const used = {};
        let maxNumber = 0;
        const prefix = getEmployeeNumberPrefix();
        (employees || []).forEach(function(emp) {
            const value = getEmployeeNumber(emp);
            if (value) {
                used[value] = true;
                const match = String(value).match(/(\d+)$/);
                if (match) {
                    maxNumber = Math.max(maxNumber, parseInt(match[1], 10) || 0);
                }
            }
        });
        let nextNumber = maxNumber + 1;
        let candidate = prefix + '-' + String(nextNumber).padStart(4, '0');
        while (used[candidate]) {
            nextNumber++;
            candidate = prefix + '-' + String(nextNumber).padStart(4, '0');
        }
        return candidate;
    }

    function getEmployeePayTypeLabel(emp) {
        return emp && emp.payType === 'hourly' ? 'Hourly' : 'Salaried';
    }

    function getEmployeePayAmount(emp) {
        if (!emp) return 0;
        return emp.payType === 'hourly' ? (emp.hourlyRate || 0) : (emp.annualGross || 0);
    }

    function getEmployeePayAmountLabel(emp) {
        return safeFormatCurrency(getEmployeePayAmount(emp));
    }

    function getEmployeeSortValue(emp, field) {
        if (!emp) return '';
        if (field === 'name') return getEmployeeName(emp).toLowerCase();
        if (field === 'employeeNumber') return getEmployeeNumber(emp).toLowerCase();
        if (field === 'status') return emp.isActive !== false ? 'active' : 'inactive';
        if (field === 'familyStatus') return getFamilyStatusLabel(emp.familyStatus).toLowerCase();
        if (field === 'payType') return getEmployeePayTypeLabel(emp).toLowerCase();
        if (field === 'payFrequency') return getPayFrequencyLabel(emp.payFrequency || 'monthly').toLowerCase();
        if (field === 'pay') return getEmployeePayAmount(emp);
        if (field === 'pps') return (emp.ppsNumber || '').toLowerCase();
        if (field === 'bank') return getEmployeeIban(emp).toLowerCase();
        if (field === 'prsi') return (emp.prsiClass || 'A1').toLowerCase();
        if (field === 'startDate') return emp.startDate || '';
        if (field === 'taxCredits') return emp.manualTaxCredits || 0;
        if (field === 'cutOffPoint') return emp.manualCutOffPoint || 0;
        return '';
    }

    function getSortedEmployeesForReport() {
        const employees = getEmployees().slice();
        const field = employeeReportSort.field || 'name';
        const dir = employeeReportSort.direction === 'desc' ? -1 : 1;
        employees.sort(function(a, b) {
            const av = getEmployeeSortValue(a, field);
            const bv = getEmployeeSortValue(b, field);
            if (typeof av === 'number' || typeof bv === 'number') {
                return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
            }
            return String(av).localeCompare(String(bv)) * dir;
        });
        return employees;
    }

    function getEmployeeReportColumns() {
        const columnsByKey = {
            name: { key: 'name', label: 'Name', render: function(emp) { return escapeHtml(getEmployeeName(emp)); } },
            employeeNumber: { key: 'employeeNumber', label: 'Employee No.', render: function(emp) { return escapeHtml(getEmployeeNumber(emp) || 'Not assigned'); } },
            status: { key: 'status', label: 'Status', render: function(emp) { return emp.isActive !== false ? 'Active' : 'Inactive'; } },
            familyStatus: { key: 'familyStatus', label: 'Family Status', render: function(emp) { return escapeHtml(getFamilyStatusLabel(emp.familyStatus)); } },
            payType: { key: 'payType', label: 'Pay Type', render: function(emp) { return getEmployeePayTypeLabel(emp); } },
            payFrequency: { key: 'payFrequency', label: 'Pay Frequency', render: function(emp) { return getPayFrequencyLabel(emp.payFrequency || 'monthly'); } },
            pay: { key: 'pay', label: 'Pay Amount', className: 'text-right', render: function(emp) { return getEmployeePayAmountLabel(emp); } },
            pps: { key: 'pps', label: 'PPS', render: function(emp) { return escapeHtml(emp.ppsNumber || ''); } },
            bank: { key: 'bank', label: 'Bank Account', render: function(emp) { return escapeHtml(getEmployeeIban(emp) || 'Not provided'); } },
            prsi: { key: 'prsi', label: 'PRSI', render: function(emp) { return escapeHtml(emp.prsiClass || 'A1'); } },
            startDate: { key: 'startDate', label: 'Start Date', render: function(emp) { return escapeHtml(emp.startDate || ''); } },
            taxCredits: { key: 'taxCredits', label: 'Tax Credit', className: 'text-right', render: function(emp) { return safeFormatCurrency(emp.manualTaxCredits || 0); } },
            cutOffPoint: { key: 'cutOffPoint', label: 'COP', className: 'text-right', render: function(emp) { return safeFormatCurrency(emp.manualCutOffPoint || 0); } }
        };
        return EMPLOYEE_REPORT_FIELDS
            .filter(function(field) { return employeeReportFields[field.key] !== false; })
            .map(function(field) { return columnsByKey[field.key]; })
            .filter(Boolean);
    }

    function renderEmployeeReportControls() {
        let html = '<div class="employee-report-panel">';
        html += '<div class="employee-report-actions">';
        html += '<button type="button" class="btn-secondary" id="btn-toggle-employee-report">' + (employeeReportVisible ? 'Hide Employee List' : 'Show Employee List') + '</button>';
        html += '<button type="button" class="btn-primary" id="btn-print-employee-report">Print Employee List</button>';
        html += '</div>';
        html += '<div class="employee-report-options" aria-label="Employee report fields">';
        html += '<span class="employee-report-options-label">Employee list fields:</span>';
        EMPLOYEE_REPORT_FIELDS.forEach(function(field) {
            html += '<label><input type="checkbox" class="employee-report-field-toggle" data-field="' + field.key + '"' + (employeeReportFields[field.key] ? ' checked' : '') + '> ' + field.label + '</label>';
        });
        html += '</div>';
        if (employeeReportVisible) {
            html += renderEmployeeReportTable();
        }
        html += '</div>';
        return html;
    }

    function renderEmployeeReportTable() {
        const employees = getSortedEmployeesForReport();
        const columns = getEmployeeReportColumns();
        if (columns.length === 0) {
            return '<div class="employee-report-empty">Select at least one field to render the employee list.</div>';
        }
        let html = '<div class="employee-report-table-wrap">';
        html += '<table class="employee-report-table">';
        html += '<thead><tr>';
        columns.forEach(function(column) {
            const sortMarker = employeeReportSort.field === column.key ? (employeeReportSort.direction === 'asc' ? ' (asc)' : ' (desc)') : '';
            html += '<th' + (column.className ? ' class="' + column.className + '"' : '') + '><button type="button" class="employee-report-sort" data-sort-field="' + column.key + '">' + escapeHtml(column.label + sortMarker) + '</button></th>';
        });
        html += '</tr></thead><tbody>';
        employees.forEach(function(emp) {
            html += '<tr>';
            columns.forEach(function(column) {
                html += '<td' + (column.className ? ' class="' + column.className + '"' : '') + '>' + column.render(emp) + '</td>';
            });
            html += '</tr>';
        });
        html += '</tbody></table>';
        html += '</div>';
        return html;
    }

    function bindEmployeeReportEvents(el) {
        const toggleBtn = el.querySelector('#btn-toggle-employee-report');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function() {
                employeeReportVisible = !employeeReportVisible;
                renderEmployeeList();
            });
        }
        const printBtn = el.querySelector('#btn-print-employee-report');
        if (printBtn) {
            printBtn.addEventListener('click', printEmployeeReport);
        }
        el.querySelectorAll('.employee-report-field-toggle').forEach(function(input) {
            input.addEventListener('change', function() {
                employeeReportFields[input.dataset.field] = input.checked;
                if (employeeReportVisible) {
                    renderEmployeeList();
                }
            });
        });
        el.querySelectorAll('.employee-report-sort').forEach(function(button) {
            button.addEventListener('click', function() {
                const field = button.dataset.sortField;
                if (employeeReportSort.field === field) {
                    employeeReportSort.direction = employeeReportSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    employeeReportSort.field = field;
                    employeeReportSort.direction = 'asc';
                }
                employeeReportVisible = true;
                renderEmployeeList();
            });
        });
    }

    function printEmployeeReport() {
        const employees = getSortedEmployeesForReport();
        const columns = getEmployeeReportColumns();
        const companyNameEl = document.getElementById('workspace-company-name');
        const companyNumberEl = document.getElementById('workspace-company-number');
        const companyName = companyNameEl ? companyNameEl.textContent : 'Company';
        const companyNumber = companyNumberEl ? companyNumberEl.textContent : '';
        const generatedAt = new Date().toLocaleString('en-IE');

        let reportHtml = '<!doctype html><html><head><title>Employee List</title>';
        reportHtml += '<style>';
        reportHtml += 'body{font-family:Arial,sans-serif;color:#111;margin:24px;}';
        reportHtml += 'h1{font-size:20px;margin:0 0 4px;}';
        reportHtml += '.meta{color:#555;font-size:12px;margin-bottom:18px;}';
        reportHtml += 'table{width:100%;border-collapse:collapse;font-size:12px;}';
        reportHtml += 'th,td{border:1px solid #bbb;padding:7px;text-align:left;vertical-align:top;}';
        reportHtml += 'th{background:#f1f1f1;}';
        reportHtml += '.text-right{text-align:right;}';
        reportHtml += '@media print{body{margin:12mm;}button{display:none;}}';
        reportHtml += '</style></head><body>';
        reportHtml += '<h1>Employee List</h1>';
        reportHtml += '<div class="meta">' + escapeHtml(companyName) + (companyNumber ? ' | ' + escapeHtml(companyNumber) : '') + ' | Generated ' + escapeHtml(generatedAt) + '</div>';
        reportHtml += '<table><thead><tr>';
        columns.forEach(function(column) {
            reportHtml += '<th class="' + (column.className || '') + '">' + escapeHtml(column.label) + '</th>';
        });
        reportHtml += '</tr></thead><tbody>';
        employees.forEach(function(emp) {
            reportHtml += '<tr>';
            columns.forEach(function(column) {
                reportHtml += '<td class="' + (column.className || '') + '">' + column.render(emp) + '</td>';
            });
            reportHtml += '</tr>';
        });
        reportHtml += '</tbody></table>';
        reportHtml += '<script>window.onload=function(){window.print();};<\/script>';
        reportHtml += '</body></html>';

        const reportWindow = window.open('', '_blank');
        if (!reportWindow) {
            showValidationErrors([{ field: null, message: 'Pop-up blocked. Please allow pop-ups to print the employee list.' }]);
            return;
        }
        reportWindow.document.open();
        reportWindow.document.write(reportHtml);
        reportWindow.document.close();
    }

    function getEmployees() {
        if (typeof PayrollStorage !== 'undefined' && PayrollStorage.loadEmployees) {
            return PayrollStorage.loadEmployees(currentCompanyId) || [];
        }
        return [];
    }

    function saveEmployees(employees) {
        if (typeof PayrollStorage !== 'undefined' && PayrollStorage.saveEmployees) {
            return PayrollStorage.saveEmployees(currentCompanyId, employees);
        }
        return false;
    }

    function generateId() {
        if (typeof PayrollStorage !== 'undefined' && PayrollStorage.generateId) {
            return PayrollStorage.generateId();
        }
        return 'emp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    function showSuccess(message) {
        const container = getContainer();
        const banner = document.createElement('div');
        banner.className = 'success-message';
        banner.textContent = message;
        container.insertBefore(banner, container.firstChild);
        setTimeout(() => {
            if (banner.parentNode) banner.parentNode.removeChild(banner);
        }, 3000);
    }

    function clearMessages() {
        const container = getContainer();
        container.querySelectorAll('.success-message, .error-message').forEach(el => el.remove());
    }

    // --- Public Methods ---

    function init(companyId) {
        currentCompanyId = companyId;
        renderEmployeeList();
    }

    function renderEmployeeList() {
        const el = getContainer();
        if (!el) return;
        clearMessages();

        const employees = getEmployees();
        const count = employees.length;
        const atMax = count >= MAX_EMPLOYEES;

        let html = '<div class="employee-list-header">';
        html += '<div class="employee-count">' + count + ' of ' + MAX_EMPLOYEES + ' employees</div>';
        html += '<button type="button" class="btn-primary" id="btn-add-employee"' + (atMax ? ' disabled title="Maximum ' + MAX_EMPLOYEES + ' employees reached"' : '') + '>Add Employee</button>';
        html += '</div>';

        if (count === 0) {
            html += '<div class="empty-state">No employees added yet. Click "Add Employee" to get started.</div>';
        } else {
            html += '<div class="employee-grid">';
            employees.forEach(emp => {
                const statusClass = emp.isActive !== false ? 'badge-active' : 'badge-inactive';
                const statusText = emp.isActive !== false ? 'Active' : 'Inactive';
                const familyLabel = FAMILY_STATUS_OPTIONS.find(o => o.value === emp.familyStatus)?.label || emp.familyStatus || 'Single';
                const isHourly = emp.payType === 'hourly';
                const payLabel = isHourly ? 'Hourly:' : 'Annual:';
                const payValue = isHourly ? safeFormatCurrency(emp.hourlyRate || 0) : safeFormatCurrency(emp.annualGross || 0);
                const payFrequencyLabel = getPayFrequencyLabel(emp.payFrequency || 'monthly');
                const bankAccountValue = maskIban(getEmployeeIban(emp));
                const employeeNumber = getEmployeeNumber(emp) || 'Not assigned';
                const frequencyClass = 'employee-card-' + (emp.payFrequency || 'monthly');

                html += '<div class="employee-card ' + frequencyClass + '" data-id="' + (emp.id || '') + '">';
                html += '<div class="employee-card-header">';
                html += '<h3 class="employee-name">' + escapeHtml(emp.firstName || '') + ' ' + escapeHtml(emp.lastName || '') + '</h3>';
                html += '<span class="' + statusClass + '">' + statusText + '</span>';
                html += '</div>';
                html += '<div class="employee-card-body">';
                html += '<div class="employee-detail"><span class="label">Employee No:</span> <span class="value">' + escapeHtml(employeeNumber) + '</span></div>';
                html += '<div class="employee-detail"><span class="label">PPS:</span> <span class="value">' + maskPPS(emp.ppsNumber || '') + '</span></div>';
                html += '<div class="employee-detail"><span class="label">Status:</span> <span class="value">' + familyLabel + '</span></div>';
                html += '<div class="employee-detail"><span class="label">' + payLabel + '</span> <span class="value">' + payValue + '</span></div>';
                html += '<div class="employee-detail"><span class="label">Pay Frequency:</span> <span class="value">' + payFrequencyLabel + '</span></div>';
                html += '<div class="employee-detail"><span class="label">Bank Account:</span> <span class="value">' + escapeHtml(bankAccountValue) + '</span></div>';
                html += '<div class="employee-detail"><span class="label">PRSI:</span> <span class="value">' + escapeHtml(emp.prsiClass || 'A1') + '</span></div>';
                html += '</div>';
                html += '<div class="employee-card-actions">';
                html += '<button type="button" class="btn-secondary btn-edit" data-id="' + (emp.id || '') + '">Edit</button>';
                html += '<button type="button" class="btn-danger btn-delete" data-id="' + (emp.id || '') + '">Delete</button>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
            html += renderEmployeeReportControls();
        }

        el.innerHTML = html;

        // Bind events
        const addBtn = el.querySelector('#btn-add-employee');
        if (addBtn && !addBtn.disabled) {
            addBtn.addEventListener('click', () => showEmployeeForm());
        }
        el.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => showEmployeeForm(e.target.dataset.id));
        });
        el.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => deleteEmployee(e.target.dataset.id));
        });
        bindEmployeeReportEvents(el);
    }

    function showEmployeeForm(employeeId = null) {
        const el = getContainer();
        if (!el) return;
        clearMessages();

        currentEmployeeId = employeeId;
        const employees = getEmployees();
        const emp = employeeId ? employees.find(e => e.id === employeeId) : null;
        const rpn = emp ? (emp.rpn || {}) : {};
        const isEdit = !!emp;
        const selectedFamilyStatus = emp && emp.taxCreditsMode === 'manual' ? 'custom' : (emp && emp.familyStatus ? emp.familyStatus : 'single');
        const customTaxSelected = isCustomTaxStatus(selectedFamilyStatus);
        const cloudMode = isCloudPayrollMode();

        const currentIndex = isEdit ? employees.findIndex(e => e.id === employeeId) : -1;

        let html = '<div class="employee-edit-layout">';
        html += '<div class="employee-edit-main">';

        // Navigation bar (edit mode only)
        if (isEdit) {
            const isFirst = currentIndex <= 0;
            const isLast = currentIndex >= employees.length - 1;
            html += '<div class="employee-nav">';
            html += '<button type="button" class="btn btn-secondary emp-nav-btn" id="emp-nav-prev"' + (isFirst ? ' disabled' : '') + '>← Previous</button>';
            html += '<button type="button" class="btn btn-secondary emp-nav-btn" id="emp-nav-back">Back to Employees</button>';
            html += '<button type="button" class="btn btn-secondary emp-nav-btn" id="emp-nav-next"' + (isLast ? ' disabled' : '') + '>Next →</button>';
            html += '</div>';
        }

        html += '<form class="employee-form" id="employee-form">';
        html += '<h2>' + (isEdit ? 'Edit Employee' : 'Add Employee') + '</h2>';
        if (isEdit && emp) {
            html += '<div class="edit-employee-name"><strong>' + escapeHtml(emp.firstName || '') + ' ' + escapeHtml(emp.lastName || '') + '</strong></div>';
        }

        html += '<div class="form-group">';
        html += '<label for="emp-first-name">First Name <span class="required">*</span></label>';
        html += '<input type="text" id="emp-first-name" name="firstName" class="form-input" value="' + escapeHtml(emp ? emp.firstName : '') + '" required>';
        html += '</div>';

        html += '<div class="form-group">';
        html += '<label for="emp-last-name">Last Name <span class="required">*</span></label>';
        html += '<input type="text" id="emp-last-name" name="lastName" class="form-input" value="' + escapeHtml(emp ? emp.lastName : '') + '" required>';
        html += '</div>';

        html += '<div class="form-group">';
        html += '<label for="emp-pps">PPS Number <span class="required">*</span></label>';
        html += '<input type="text" id="emp-pps" name="ppsNumber" class="form-input" value="' + escapeHtml(emp ? emp.ppsNumber : '') + '" required placeholder="1234567A" maxlength="9">';
        html += '<small>7 digits followed by 1-2 letters</small>';
        html += '</div>';

        html += '<div class="form-group">';
        html += '<label for="emp-iban">Bank Account IBAN</label>';
        html += '<input type="text" id="emp-iban" name="iban" class="form-input" value="' + escapeHtml(getEmployeeIban(emp)) + '" placeholder="IE29 AIBK 9311 5212 3456 78" maxlength="34" autocomplete="off">';
        html += '<small>Optional. Employee cards show only the last 4 digits.</small>';
        html += '</div>';

        if (cloudMode) {
            html += buildCloudRpnSummaryHtml(emp, rpn);
        } else {
            html += '<div class="form-group">';
            html += '<label for="emp-family-status">Family Status</label>';
            html += '<select id="emp-family-status" name="familyStatus" class="form-select">';
            FAMILY_STATUS_OPTIONS.forEach(opt => {
                html += '<option value="' + opt.value + '"' + (selectedFamilyStatus === opt.value ? ' selected' : '') + '>' + opt.label + '</option>';
            });
            html += '</select>';
            html += '</div>';

            const taxCreditsValue = customTaxSelected && emp && emp.manualTaxCredits !== '' && emp.manualTaxCredits !== undefined
                ? Number(emp.manualTaxCredits).toFixed(2)
                : Number(getDefaultAnnualTC(selectedFamilyStatus)).toFixed(2);
            const cutOffValue = customTaxSelected && emp && emp.manualCutOffPoint !== '' && emp.manualCutOffPoint !== undefined
                ? Number(emp.manualCutOffPoint).toFixed(2)
                : Number(getDefaultCutOffPoint(selectedFamilyStatus)).toFixed(2);
            const taxFieldsReadonly = customTaxSelected ? '' : ' readonly';
            html += '<div class="form-group">';
            html += '<label for="emp-manual-tax-credits">Tax Credit</label>';
            html += '<input type="number" id="emp-manual-tax-credits" name="manualTaxCredits" class="form-input tax-credit-field" value="' + taxCreditsValue + '" min="0" step="0.01"' + taxFieldsReadonly + '>';
            html += '<small id="tax-credit-help">' + (customTaxSelected ? 'Custom value used for payroll calculations.' : 'Preset from selected family status.') + '</small>';
            html += '</div>';

            html += '<div class="form-group">';
            html += '<label for="emp-manual-cutoff">COP</label>';
            html += '<input type="number" id="emp-manual-cutoff" name="manualCutOffPoint" class="form-input tax-credit-field" value="' + cutOffValue + '" min="0" step="0.01"' + taxFieldsReadonly + '>';
            html += '<small id="tax-cop-help">' + (customTaxSelected ? 'Custom cut-off point used for payroll calculations.' : 'Preset from selected family status.') + '</small>';
            html += '</div>';
        }

        const payType = emp && emp.payType === 'hourly' ? 'hourly' : 'salaried';
        const isHourly = payType === 'hourly';

        html += '<div class="form-group">';
        html += '<label>Pay Type</label>';
        html += '<div class="toggle-group">';
        html += '<label><input type="radio" name="payType" value="salaried"' + (isHourly ? '' : ' checked') + '> Salaried</label>';
        html += '<label><input type="radio" name="payType" value="hourly"' + (isHourly ? ' checked' : '') + '> Hourly</label>';
        html += '</div>';
        html += '</div>';

        html += '<div class="form-group">';
        html += '<label class="form-label">Pay Frequency</label>';
        html += '<select class="form-select" id="emp-pay-frequency" name="payFrequency">';
        html += '<option value="weekly"' + (emp && emp.payFrequency === 'weekly' ? ' selected' : '') + '>Weekly</option>';
        html += '<option value="fortnightly"' + (emp && emp.payFrequency === 'fortnightly' ? ' selected' : '') + '>Fortnightly</option>';
        html += '<option value="monthly"' + ((emp && emp.payFrequency === 'monthly') || !emp ? ' selected' : '') + '>Monthly</option>';
        html += '</select>';
        html += '</div>';

        html += '<div class="form-group">';
        html += '<label for="emp-hourly-rate">' + (isHourly ? 'Hourly Rate <span class="required">*</span>' : 'Overtime Hourly Rate') + '</label>';
        html += '<input type="number" id="emp-hourly-rate" name="hourlyRate" class="form-input" value="' + (emp && emp.hourlyRate ? Number(emp.hourlyRate).toFixed(2) : '') + '"' + (isHourly ? ' required' : '') + ' min="0" step="0.01">';
        html += '</div>';

        const standardHoursVisible = isHourly ? '' : ' style="display:none"';
        const standardHoursValue = emp && emp.standardHoursPerWeek ? Number(emp.standardHoursPerWeek).toFixed(1) : '35.0';
        html += '<div class="form-group standard-hours-field"' + standardHoursVisible + '>';
        html += '<label for="emp-standard-hours">Standard Hours per Week' + (isHourly ? ' <span class="required">*</span>' : '') + '</label>';
        html += '<input type="number" id="emp-standard-hours" name="standardHoursPerWeek" class="form-input" value="' + standardHoursValue + '"' + (isHourly ? ' required' : '') + ' min="0" max="168" step="0.5">';
        html += '</div>';

        html += '<div class="form-group">';
        html += '<label for="emp-overtime-multiplier">Overtime Multiplier</label>';
        html += '<input type="number" id="emp-overtime-multiplier" name="overtimeMultiplier" class="form-input" value="' + (emp ? (emp.overtimeMultiplier || 1.5) : 1.5) + '" min="1" step="0.1">';
        html += '</div>';

        const grossVisible = isHourly ? ' style="display:none"' : '';
        html += '<div class="form-group gross-field"' + grossVisible + '>';
        html += '<label for="emp-annual-gross">Annual Gross Salary' + (isHourly ? '' : ' <span class="required">*</span>') + '</label>';
        html += '<input type="number" id="emp-annual-gross" name="annualGross" class="form-input" value="' + (emp && emp.annualGross ? Number(emp.annualGross).toFixed(2) : '') + '"' + (isHourly ? '' : ' required') + ' min="0" step="0.01">';
        html += '</div>';

        html += '<div class="form-group">';
        html += '<label for="emp-prsi-class">PRSI Class</label>';
        html += '<select id="emp-prsi-class" name="prsiClass" class="form-select">';
        PRSI_CLASS_OPTIONS.forEach(opt => {
            html += '<option value="' + opt + '"' + ((emp && emp.prsiClass === opt) || (!emp && opt === 'A1') ? ' selected' : '') + '>' + opt + '</option>';
        });
        html += '</select>';
        html += '</div>';

        html += '<div class="form-group">';
        html += '<label for="emp-start-date">Start Date</label>';
        html += '<input type="date" id="emp-start-date" name="startDate" class="form-input" value="' + escapeHtml(emp ? (emp.startDate || '') : '') + '">';
        html += '</div>';

        html += '<div class="form-group">';
        html += '<label><input type="checkbox" id="emp-active" name="isActive"' + ((emp && emp.isActive === false) ? '' : ' checked') + '> Active</label>';
        html += '</div>';

        html += '<div class="form-actions">';
        html += '<button type="submit" class="btn-primary">Save</button>';
        html += '<button type="button" class="btn-secondary" id="btn-cancel">Discard</button>';
        html += '</div>';

        html += '</form>';
        html += '</div>';
        html += '<div class="employee-lower-row">';
        if (cloudMode) {
            html += '<div class="employee-rpn-section cloud-managed-rpn">';
            html += '<h3>Revenue Payroll Notification (RPN)</h3>';
            html += '<p class="rpn-note">RPN values are retrieved from the simulated Revenue server and are read-only here.</p>';
            html += '<div class="rpn-form">';
            html += '<div class="form-group">';
            html += '<label for="rpn-number">RPN Number</label>';
            html += '<input type="text" id="rpn-number" class="form-input" value="' + escapeHtml(rpn.rpnNumber || '') + '" placeholder="Required for normal PAYE mode">';
            html += '<small>If blank, payroll applies emergency PAYE rules.</small>';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label for="rpn-prsi-class">PRSI Class</label>';
            html += '<select id="rpn-prsi-class" class="form-select">';
            ['A','A0','AX','AL','A1','B','C','D','J','K','M','S'].forEach(opt => {
                html += '<option value="' + opt + '"' + (rpn.prsiClass === opt ? ' selected' : '') + '>' + opt + '</option>';
            });
            html += '</select>';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label for="rpn-usc-status">USC Status</label>';
            html += '<select id="rpn-usc-status" class="form-select">';
            ['Normal','Exempt','Reduced Rate'].forEach(opt => {
                html += '<option value="' + opt + '"' + (rpn.uscStatus === opt ? ' selected' : '') + '>' + opt + '</option>';
            });
            html += '</select>';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label for="rpn-employer-prsi">Employer PRSI Class</label>';
            html += '<select id="rpn-employer-prsi" class="form-select">';
            ['A','B','C','D','J','K','M','S'].forEach(opt => {
                html += '<option value="' + opt + '"' + (rpn.employerPrsiClass === opt ? ' selected' : '') + '>' + opt + '</option>';
            });
            html += '</select>';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label for="rpn-prev-pay">Previous Employment Pay</label>';
            html += '<input type="number" id="rpn-prev-pay" class="form-input" step="0.01" min="0" value="' + (rpn.previousPay ? Number(rpn.previousPay).toFixed(2) : '') + '">';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label for="rpn-prev-tax">Previous Employment Tax</label>';
            html += '<input type="number" id="rpn-prev-tax" class="form-input" step="0.01" min="0" value="' + (rpn.previousTax ? Number(rpn.previousTax).toFixed(2) : '') + '">';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label for="rpn-prev-usc">Previous Employment USC</label>';
            html += '<input type="number" id="rpn-prev-usc" class="form-input" step="0.01" min="0" value="' + (rpn.previousUSC ? Number(rpn.previousUSC).toFixed(2) : '') + '">';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label for="rpn-bik">BIK (Benefit in Kind)</label>';
            html += '<input type="number" id="rpn-bik" class="form-input" step="0.01" min="0" value="' + (rpn.bik ? Number(rpn.bik).toFixed(2) : '') + '">';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label for="rpn-pension-pct">Pension Contribution (%)</label>';
            html += '<input type="number" id="rpn-pension-pct" class="form-input" step="0.1" min="0" max="100" value="' + (rpn.pensionPct ? Number(rpn.pensionPct) : '') + '">';
            html += '</div>';
            html += '<div class="form-group">';
            html += '<label for="rpn-avc">AVC (Additional Voluntary Contribution)</label>';
            html += '<input type="number" id="rpn-avc" class="form-input" step="0.01" min="0" value="' + (rpn.avc ? Number(rpn.avc).toFixed(2) : '') + '">';
            html += '</div>';
            html += '</div>';
            html += '</div>';
        } else {
            html += '<div class="employee-payslip-section" id="employee-payslip-section">';
            html += '<h3>Payslip Calculation</h3>';
            html += '<p class="employee-payslip-note" id="employee-payslip-note">Select a payroll history row to view the calculation breakdown.</p>';
            html += '<div id="employee-payslip-panel" class="employee-payslip-panel"></div>';
            html += '</div>';
        }
        html += '<div class="employee-history-section">';
        html += '<h3>Submitted Payroll History</h3>';
        html += '<div class="emp-history-scroll">';
        html += '<table class="employee-history-table">';
        html += '<thead>';
        html += '<tr>';
        html += '<th>Period</th>';
        html += '<th>Date</th>';
        html += '<th class="text-right">Gross</th>';
        html += '<th class="text-right">PAYE</th>';
        html += '<th class="text-right">USC</th>';
        html += '<th class="text-right">PRSI</th>';
        html += '<th class="text-right">Net</th>';
        html += '<th class="text-right">TC Used</th>';
        html += '</tr>';
        html += '</thead>';
        html += '<tbody id="emp-history-body"></tbody>';
        html += '</table>';
        html += '</div>';
        html += '<button type="button" class="btn btn-secondary btn-current-period hidden" id="btn-current-period">' + (cloudMode ? 'Current Period' : 'Clear Selection') + '</button>';
        html += '<div class="tc-remaining-section">';
        html += '<h4>Remaining Tax Credits (Submitted Periods)</h4>';
        html += '<div class="tc-remaining-scroll">';
        html += '<table class="tc-remaining-table">';
        html += '<thead>';
        html += '<tr>';
        html += '<th>Type</th>';
        html += '<th>Period</th>';
        html += '<th class="text-right">Annual TC</th>';
        html += '<th class="text-right">Est. Credit/Period</th>';
        html += '<th class="text-right" id="tc-applied-col-header">' + (isCloudPayrollMode() ? 'RPN TC Applied' : 'Local TC Applied') + '</th>';
        html += '<th class="text-right">Credit Left</th>';
        html += '</tr>';
        html += '</thead>';
        html += '<tbody id="tc-remaining-body"></tbody>';
        html += '</table>';
        html += '</div>';
        html += '</div>';
        html += '<div class="tc-remaining-section">';
        html += '<h4>Remaining Cut-Off Point (Submitted Periods)</h4>';
        html += '<div class="tc-remaining-scroll">';
        html += '<table class="tc-remaining-table">';
        html += '<thead>';
        html += '<tr>';
        html += '<th>Type</th>';
        html += '<th>Period</th>';
        html += '<th class="text-right">Annual COP</th>';
        html += '<th class="text-right" id="cop-periodic-col-header">' + getPeriodicCopColumnLabel((emp && emp.payFrequency) || 'monthly', cloudMode) + '</th>';
        html += '<th class="text-right">Gross Wages</th>';
        html += '<th>Used</th>';
        html += '</tr>';
        html += '</thead>';
        html += '<tbody id="cop-remaining-body"></tbody>';
        html += '</table>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        el.innerHTML = html;

        // Populate employee payroll history
        let runs = [];
        const histBody = document.getElementById('emp-history-body');
        if (histBody) {
            if (employeeId && typeof PayrollStorage !== 'undefined' && currentCompanyId) {
                runs = PayrollStorage.loadPayrollRuns(currentCompanyId);
                // Filter to only submitted runs for employee cart view
                const submittedRuns = runs.filter(function(r) { return r.status === 'submitted'; });
                if (submittedRuns.length > 0) {
                    const payFreq = (emp && emp.payFrequency) || 'monthly';
                    const historyRows = buildEmployeeHistoryRows(submittedRuns, employeeId, payFreq);
                    let histHtml = '';
                    historyRows.forEach(function(row) {
                        const run = row.run;
                        const entry = row.entry;
                        const date = new Date(run.runDate);
                        const dateStr = date.toLocaleDateString('en-IE') + ' ' + date.toLocaleTimeString('en-IE', {hour:'2-digit', minute:'2-digit'});
                        histHtml += '<tr class="emp-hist-row" data-run-id="' + run.id + '" data-emp-id="' + employeeId + '" data-period="' + row.periodNumber + '">';
                        histHtml += '<td>' + row.periodNumber + '</td>';
                        histHtml += '<td>' + dateStr + '</td>';
                        histHtml += '<td class="text-right">' + safeFormatCurrency(entry.grossPay) + '</td>';
                        histHtml += '<td class="text-right">' + safeFormatCurrency(entry.paye) + '</td>';
                        histHtml += '<td class="text-right">' + safeFormatCurrency(entry.usc) + '</td>';
                        histHtml += '<td class="text-right">' + safeFormatCurrency(entry.prsi) + '</td>';
                        histHtml += '<td class="text-right">' + safeFormatCurrency(entry.netPay) + '</td>';
                        histHtml += '<td class="text-right">' + safeFormatCurrency(entry.taxCreditsUsed || 0) + '</td>';
                        histHtml += '</tr>';
                    });
                    histBody.innerHTML = histHtml || '<tr><td colspan="8" class="text-center">No submitted payroll runs yet</td></tr>';

                    // Bind row clicks
                    histBody.querySelectorAll('.emp-hist-row').forEach(function(row) {
                        row.addEventListener('click', function() {
                            handleHistoryRowClick(row, historyRows.map(function(r) { return r.run; }), employeeId);
                        });
                    });
                } else {
                    histBody.innerHTML = '<tr><td colspan="8" class="text-center">No submitted payroll runs yet</td></tr>';
                }
            } else {
                histBody.innerHTML = '<tr><td colspan="8" class="text-center">No submitted payroll runs yet</td></tr>';
            }
        }

        // Populate Remaining Tax Credits table (submitted runs only)
        const tcBody = document.getElementById('tc-remaining-body');
        if (tcBody && emp && isEdit) {
            const payFreq = emp.payFrequency || 'monthly';
            const periodsPerYear = payFreq === 'weekly' ? 52 : (payFreq === 'fortnightly' ? 26 : 12);
            const payFreqLabel = payFreq;
            const cloudMode = isCloudPayrollMode();
            const rpn = emp.rpn || {};

            let annualTC = cloudMode
                ? getCloudRpnAnnualTaxCredits(emp, rpn)
                : (isCustomTaxStatus(emp.familyStatus)
                    ? (parseFloat(emp.manualTaxCredits) || 0)
                    : getDefaultAnnualTC(emp.familyStatus || 'single'));

            if (!cloudMode && currentCompanyId && typeof PayrollStorage !== 'undefined' && typeof selectedYear !== 'undefined') {
                const ledgerEntry = PayrollStorage.getEmployeeLedgerEntry(currentCompanyId, employeeId, selectedYear);
                if (ledgerEntry && ledgerEntry.annualTaxCredits > 0) {
                    annualTC = ledgerEntry.annualTaxCredits;
                }
            }

            const submittedOnly = (runs || []).filter(function(r) { return r.status === 'submitted'; });
            const appliedByPeriod = buildSubmittedValuesByPayPeriod(
                submittedOnly,
                employeeId,
                payFreq,
                function(entry) { return entry.taxCreditsUsed || 0; }
            );

            let scheduleRows;
            if (cloudMode) {
                const defaultEst = rpn.periodicTaxCredit
                    ? parseFloat(rpn.periodicTaxCredit) || 0
                    : (annualTC / periodsPerYear);
                scheduleRows = [];
                let remainingTC = annualTC;
                for (let p = 1; p <= periodsPerYear; p++) {
                    const committed = Object.prototype.hasOwnProperty.call(appliedByPeriod, p);
                    const annualAtStart = remainingTC;
                    const estCreditPerPeriod = defaultEst;
                    const tcApplied = committed ? (parseFloat(appliedByPeriod[p]) || 0) : null;
                    let creditLeftAfter = null;
                    if (committed) {
                        creditLeftAfter = annualAtStart - tcApplied;
                        remainingTC = creditLeftAfter;
                    }
                    scheduleRows.push({
                        period: p,
                        annualAtStart: annualAtStart,
                        estCreditPerPeriod: estCreditPerPeriod,
                        tcApplied: tcApplied,
                        creditLeftAfter: creditLeftAfter,
                        committed: committed
                    });
                }
            } else if (typeof PayrollUtils !== 'undefined' && PayrollUtils.computeRemainingTaxCreditSchedule) {
                scheduleRows = PayrollUtils.computeRemainingTaxCreditSchedule(annualTC, periodsPerYear, appliedByPeriod);
            } else {
                scheduleRows = [];
            }

            let tcHtml = '';
            scheduleRows.forEach(function(row) {
                tcHtml += '<tr class="tc-schedule-row' + (row.committed ? ' tc-committed' : '') + '" data-period="' + row.period + '">';
                tcHtml += '<td>' + payFreqLabel + '</td>';
                tcHtml += '<td>' + row.period + '</td>';
                tcHtml += '<td class="text-right">' + row.annualAtStart.toFixed(2) + '</td>';
                tcHtml += '<td class="text-right">' + row.estCreditPerPeriod.toFixed(2) + '</td>';
                tcHtml += '<td class="text-right">' + (row.tcApplied !== null ? row.tcApplied.toFixed(2) : '') + '</td>';
                tcHtml += '<td class="text-right">' + (row.creditLeftAfter !== null ? row.creditLeftAfter.toFixed(2) : '') + '</td>';
                tcHtml += '</tr>';
            });
            tcBody.innerHTML = tcHtml;
        }

        const copBody = document.getElementById('cop-remaining-body');
        if (copBody && emp && isEdit) {
            const payFreq = emp.payFrequency || 'monthly';
            const periodsPerYear = payFreq === 'weekly' ? 52 : (payFreq === 'fortnightly' ? 26 : 12);
            const payFreqLabel = payFreq;
            const cloudMode = isCloudPayrollMode();
            const rpn = emp.rpn || {};

            let annualCOP = cloudMode
                ? getCloudRpnAnnualCutOff(emp, rpn)
                : (isCustomTaxStatus(emp.familyStatus)
                    ? (parseFloat(emp.manualCutOffPoint) || 0)
                    : getDefaultCutOffPoint(emp.familyStatus || 'single'));

            if (!cloudMode && currentCompanyId && typeof PayrollStorage !== 'undefined' && typeof selectedYear !== 'undefined') {
                const ledgerEntry = PayrollStorage.getEmployeeLedgerEntry(currentCompanyId, employeeId, selectedYear);
                if (ledgerEntry && ledgerEntry.cutOffPoint > 0) {
                    annualCOP = ledgerEntry.cutOffPoint;
                }
            }

            const submittedOnlyCop = (runs || []).filter(function(r) { return r.status === 'submitted'; });
            const grossByPeriod = buildSubmittedValuesByPayPeriod(
                submittedOnlyCop,
                employeeId,
                payFreq,
                function(entry) { return entry.grossPay || 0; }
            );

            const periodicCopOverride = cloudMode && rpn.periodicStandardRateCutOffPoint
                ? parseFloat(rpn.periodicStandardRateCutOffPoint) || null
                : null;

            let copScheduleRows = [];
            if (typeof PayrollUtils !== 'undefined' && PayrollUtils.computeRemainingCOPSchedule) {
                copScheduleRows = PayrollUtils.computeRemainingCOPSchedule(
                    annualCOP,
                    periodsPerYear,
                    grossByPeriod,
                    periodicCopOverride
                );
            }

            const periodicCopHeader = document.getElementById('cop-periodic-col-header');
            if (periodicCopHeader) {
                periodicCopHeader.textContent = getPeriodicCopColumnLabel(payFreq, cloudMode);
            }

            let copHtml = '';
            copScheduleRows.forEach(function(row) {
                copHtml += '<tr class="cop-schedule-row' + (row.committed ? ' tc-committed' : '') + '" data-period="' + row.period + '">';
                copHtml += '<td>' + payFreqLabel + '</td>';
                copHtml += '<td>' + row.period + '</td>';
                copHtml += '<td class="text-right">' + row.annualCOP.toFixed(2) + '</td>';
                copHtml += '<td class="text-right">' + row.periodicCop.toFixed(2) + '</td>';
                copHtml += '<td class="text-right">' + (row.grossWages !== null ? row.grossWages.toFixed(2) : '') + '</td>';
                copHtml += '<td>' + (row.usedStatus || '') + '</td>';
                copHtml += '</tr>';
            });
            copBody.innerHTML = copHtml;
        }

        function updateTaxFieldsForStatus(familyStatus) {
            const tcInput = el.querySelector('#emp-manual-tax-credits');
            const copInput = el.querySelector('#emp-manual-cutoff');
            const custom = isCustomTaxStatus(familyStatus);
            if (tcInput) {
                tcInput.readOnly = !custom;
                tcInput.classList.toggle('readonly', !custom);
            }
            if (copInput) {
                copInput.readOnly = !custom;
                copInput.classList.toggle('readonly', !custom);
            }
            if (!custom && tcInput) {
                tcInput.value = Number(getDefaultAnnualTC(familyStatus)).toFixed(2);
            }
            if (!custom && copInput) {
                copInput.value = Number(getDefaultCutOffPoint(familyStatus)).toFixed(2);
            }
            const tcHelp = el.querySelector('#tax-credit-help');
            const copHelp = el.querySelector('#tax-cop-help');
            if (tcHelp) tcHelp.textContent = custom ? 'Custom value used for payroll calculations.' : 'Preset from selected family status.';
            if (copHelp) copHelp.textContent = custom ? 'Custom cut-off point used for payroll calculations.' : 'Preset from selected family status.';
        }

        const familyStatusSelect = el.querySelector('#emp-family-status');
        if (familyStatusSelect) {
            familyStatusSelect.addEventListener('change', function() {
                updateTaxFieldsForStatus(familyStatusSelect.value);
            });
            updateTaxFieldsForStatus(familyStatusSelect.value);
        }

        applyCloudRpnReadOnlyState(el);

        // Bind toggle for pay type
        const payTypeRadios = el.querySelectorAll('input[name="payType"]');
        payTypeRadios.forEach(r => {
            r.addEventListener('change', (e) => {
                const isHourly = e.target.value === 'hourly';
                const grossField = el.querySelector('.gross-field');
                if (grossField) {
                    grossField.style.display = isHourly ? 'none' : '';
                }
                const standardHoursField = el.querySelector('.standard-hours-field');
                if (standardHoursField) {
                    standardHoursField.style.display = isHourly ? '' : 'none';
                }
                const standardHoursInput = el.querySelector('#emp-standard-hours');
                if (standardHoursInput) {
                    standardHoursInput.required = isHourly;
                    if (isHourly && !standardHoursInput.value) {
                        standardHoursInput.value = '35.0';
                    }
                }
                const grossInput = el.querySelector('#emp-annual-gross');
                if (grossInput) {
                    grossInput.required = !isHourly;
                }
                const hourlyLabel = el.querySelector('label[for="emp-hourly-rate"]');
                if (hourlyLabel) {
                    hourlyLabel.innerHTML = isHourly ? 'Hourly Rate <span class="required">*</span>' : 'Overtime Hourly Rate';
                }
                const hourlyInput = el.querySelector('#emp-hourly-rate');
                if (hourlyInput) {
                    hourlyInput.required = isHourly;
                }
            });
        });

        // Bind form submit
        const form = el.querySelector('#employee-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const data = gatherFormData(form);
            saveEmployee(data);
        });

        // Bind cancel (Discard)
        el.querySelector('#btn-cancel').addEventListener('click', () => {
            if (currentEmployeeId) {
                // Edit mode: reload form to revert unsaved changes
                showEmployeeForm(currentEmployeeId);
            } else {
                // Add mode: go back to list
                currentEmployeeId = null;
                renderEmployeeList();
            }
        });

        // Bind navigation buttons
        const navBack = el.querySelector('#emp-nav-back');
        if (navBack) {
            navBack.addEventListener('click', () => {
                currentEmployeeId = null;
                renderEmployeeList();
            });
        }
        const navPrev = el.querySelector('#emp-nav-prev');
        if (navPrev && !navPrev.disabled) {
            navPrev.addEventListener('click', () => {
                const emps = getEmployees();
                const idx = emps.findIndex(e => e.id === currentEmployeeId);
                if (idx > 0) {
                    showEmployeeForm(emps[idx - 1].id);
                }
            });
        }
        const navNext = el.querySelector('#emp-nav-next');
        if (navNext && !navNext.disabled) {
            navNext.addEventListener('click', () => {
                const emps = getEmployees();
                const idx = emps.findIndex(e => e.id === currentEmployeeId);
                if (idx >= 0 && idx < emps.length - 1) {
                    showEmployeeForm(emps[idx + 1].id);
                }
            });
        }
    }

    function gatherFormData(form) {
        const formData = new FormData(form);
        const data = {};
        const existingEmployees = getEmployees();
        const existingEmployee = currentEmployeeId
            ? existingEmployees.find(function(emp) { return emp.id === currentEmployeeId; })
            : null;
        const existingRpn = existingEmployee && existingEmployee.rpn ? existingEmployee.rpn : {};

        formData.forEach((value, key) => {
            if (key === 'isActive') {
                data[key] = true;
            } else {
                data[key] = value;
            }
        });
        // Checkbox special handling
        data.isActive = form.querySelector('#emp-active').checked;

        if (isCloudPayrollMode()) {
            data.familyStatus = existingEmployee ? (existingEmployee.familyStatus || 'single') : 'single';
            data.taxCreditsMode = 'automatic';
            data.manualTaxCredits = existingEmployee ? (existingEmployee.manualTaxCredits || '') : '';
            data.manualCutOffPoint = existingEmployee ? (existingEmployee.manualCutOffPoint || '') : '';
        } else {
            data.taxCreditsMode = data.familyStatus === 'custom' ? 'manual' : 'automatic';
        }

        // Numeric parsing
        data.annualGross = parseFloat(data.annualGross) || 0;
        data.hourlyRate = parseFloat(data.hourlyRate) || 0;
        data.standardHoursPerWeek = parseFloat(data.standardHoursPerWeek) || 35;
        data.overtimeMultiplier = parseFloat(data.overtimeMultiplier) || 1.5;
        if (data.payType === 'hourly') {
            data.annualGross = 0;
        } else {
            data.standardHoursPerWeek = 0;
        }
        data.iban = data.iban ? data.iban.replace(/\s+/g, '').toUpperCase() : '';
        data.payFrequency = document.getElementById('emp-pay-frequency').value;
        if (!isCloudPayrollMode()) {
            data.manualTaxCredits = data.manualTaxCredits ? parseFloat(data.manualTaxCredits) : '';
            data.manualCutOffPoint = data.manualCutOffPoint ? parseFloat(data.manualCutOffPoint) : '';
        }

        if (isCloudPayrollMode()) {
            data.rpn = Object.assign({}, existingRpn, {
                bik: parseFloat(document.getElementById('rpn-bik').value) || existingRpn.bik || 0,
                pensionPct: parseFloat(document.getElementById('rpn-pension-pct').value) || existingRpn.pensionPct || 0,
                avc: parseFloat(document.getElementById('rpn-avc').value) || existingRpn.avc || 0
            });
        } else {
            data.rpn = Object.assign({}, existingRpn, {
                taxCredits: data.manualTaxCredits ? parseFloat(data.manualTaxCredits) : (existingRpn.taxCredits || 0),
                cutOffPoint: data.manualCutOffPoint ? parseFloat(data.manualCutOffPoint) : (existingRpn.cutOffPoint || 0),
                periodicTaxCredit: existingRpn.periodicTaxCredit || 0,
                periodicStandardRateCutOffPoint: existingRpn.periodicStandardRateCutOffPoint || 0,
                prsiClass: data.prsiClass || existingRpn.prsiClass || 'A1',
                uscStatus: existingRpn.uscStatus || 'Normal',
                employerPrsiClass: existingRpn.employerPrsiClass || data.prsiClass || 'A1'
            });
        }
        return data;
    }

    function saveEmployee(formData) {
        const errors = validateEmployee(formData);
        if (errors.length > 0) {
            showValidationErrors(errors);
            return;
        }

        let employees = getEmployees();
        const isEdit = !!currentEmployeeId;
        let savedId = currentEmployeeId;

        if (currentEmployeeId) {
            // Edit
            const idx = employees.findIndex(e => e.id === currentEmployeeId);
            if (idx === -1) {
                showValidationErrors([{ field: null, message: 'Employee not found.' }]);
                return;
            }
            const employeeNumber = getEmployeeNumber(employees[idx]) || generateEmployeeNumber(employees);
            employees[idx] = { ...employees[idx], ...formData, id: currentEmployeeId, employeeNumber: employeeNumber };
        } else {
            // Add
            if (employees.length >= MAX_EMPLOYEES) {
                showValidationErrors([{ field: null, message: 'Maximum of ' + MAX_EMPLOYEES + ' employees reached.' }]);
                return;
            }
            savedId = generateId();
            employees.push({ ...formData, id: savedId, employeeNumber: generateEmployeeNumber(employees) });
        }

        if (!saveEmployees(employees)) {
            showValidationErrors([{ field: null, message: 'Failed to save employee data. Please export a backup and check browser storage.' }]);
            return;
        }

        // Stay in edit mode, re-render to show saved state
        currentEmployeeId = savedId;
        showEmployeeForm(savedId);

        // Show Saved feedback on button
        const saveBtn = document.querySelector('.btn-primary') || document.querySelector('[type="submit"]');
        if (saveBtn) {
            saveBtn.textContent = 'Saved';
            saveBtn.style.background = '#d32f2f';
            saveBtn.style.color = '#fff';
            setTimeout(function() {
                saveBtn.textContent = 'Save';
                saveBtn.style.background = '';
                saveBtn.style.color = '';
            }, 1000);
        }
    }

    function validateEmployee(data) {
        const errors = [];
        if (!data.firstName || !data.firstName.trim()) {
            errors.push({ field: 'firstName', message: 'First name is required.' });
        }
        if (!data.lastName || !data.lastName.trim()) {
            errors.push({ field: 'lastName', message: 'Last name is required.' });
        }
        if (!data.ppsNumber || !PPS_REGEX.test(data.ppsNumber.trim())) {
            errors.push({ field: 'ppsNumber', message: 'PPS number must be 7 digits followed by 1-2 letters.' });
        } else {
            // Check PPS uniqueness
            const normalizedPPS = data.ppsNumber.trim().toUpperCase();
            const employees = getEmployees();
            const duplicate = employees.find(function(emp) {
                return emp.id !== currentEmployeeId &&
                    emp.ppsNumber &&
                    emp.ppsNumber.trim().toUpperCase() === normalizedPPS;
            });
            if (duplicate) {
                errors.push({ field: 'ppsNumber', message: 'This PPS number is already assigned to another employee.' });
            }
        }
        const payType = data.payType || 'salaried';
        if (payType === 'hourly') {
            if (!data.hourlyRate || Number(data.hourlyRate) <= 0) {
                errors.push({ field: 'hourlyRate', message: 'Hourly rate is required and must be greater than 0.' });
            }
            if (!data.standardHoursPerWeek || Number(data.standardHoursPerWeek) <= 0 || Number(data.standardHoursPerWeek) > 168) {
                errors.push({ field: 'standardHoursPerWeek', message: 'Standard hours per week must be between 0.5 and 168.' });
            }
        } else {
            if (data.annualGross === undefined || data.annualGross === null || data.annualGross === '' || Number(data.annualGross) < 0) {
                errors.push({ field: 'annualGross', message: 'Annual gross salary is required and must be 0 or greater.' });
            }
        }
        if (data.overtimeMultiplier === '' || Number(data.overtimeMultiplier) < 1) {
            errors.push({ field: 'overtimeMultiplier', message: 'Overtime multiplier must be 1 or greater.' });
        }
        if (!isCloudPayrollMode() && data.familyStatus === 'custom') {
            if (data.manualTaxCredits === '' || Number(data.manualTaxCredits) < 0) {
                errors.push({ field: 'manualTaxCredits', message: 'Tax credit is required for custom tax credit status.' });
            }
            if (data.manualCutOffPoint === '' || Number(data.manualCutOffPoint) <= 0) {
                errors.push({ field: 'manualCutOffPoint', message: 'COP is required for custom tax credit status.' });
            }
        }
        return errors;
    }

    function showValidationErrors(errors) {
        const el = getContainer();
        // Clear previous errors
        el.querySelectorAll('.error-message').forEach(m => m.remove());
        el.querySelectorAll('.form-input, .form-select').forEach(i => i.classList.remove('invalid'));

        errors.forEach(err => {
            if (err.field) {
                const input = el.querySelector('[name="' + err.field + '"]');
                if (input) {
                    input.classList.add('invalid');
                    const msg = document.createElement('div');
                    msg.className = 'error-message';
                    msg.textContent = err.message;
                    const group = input.closest('.form-group');
                    if (group && !group.querySelector('.error-message')) {
                        group.appendChild(msg);
                    }
                }
            } else {
                // General error
                const msg = document.createElement('div');
                msg.className = 'error-message';
                msg.textContent = err.message;
                const form = el.querySelector('.employee-form');
                if (form) form.insertBefore(msg, form.firstChild);
            }
        });
    }

    function deleteEmployee(id) {
        const employees = getEmployees();
        const emp = employees.find(e => e.id === id);
        if (!emp) return;

        deleteTargetId = id;

        const el = getContainer();
        let modal = document.getElementById('delete-employee-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'delete-employee-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML = '<div class="modal-content"><h3>Confirm Deletion</h3><p class="modal-message"></p><div class="modal-actions"><button type="button" class="btn-danger" id="modal-confirm-delete">Delete</button><button type="button" class="btn-secondary" id="modal-cancel-delete">Cancel</button></div></div>';
            document.body.appendChild(modal);
        }

        modal.querySelector('.modal-message').textContent = 'Are you sure you want to delete ' + (emp.firstName || '') + ' ' + (emp.lastName || '') + '?';
        modal.classList.add('active');

        // Bind once
        const confirmBtn = modal.querySelector('#modal-confirm-delete');
        const cancelBtn = modal.querySelector('#modal-cancel-delete');

        const newConfirm = confirmBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        newConfirm.addEventListener('click', () => {
            performDelete();
            modal.classList.remove('active');
        });
        newCancel.addEventListener('click', () => {
            deleteTargetId = null;
            modal.classList.remove('active');
        });
    }

    function performDelete() {
        if (!deleteTargetId) return;
        let employees = getEmployees();
        employees = employees.filter(e => e.id !== deleteTargetId);
        if (!saveEmployees(employees)) {
            showValidationErrors([{ field: null, message: 'Failed to delete employee. Please export a backup and check browser storage.' }]);
            deleteTargetId = null;
            return;
        }
        deleteTargetId = null;
        renderEmployeeList();
        showSuccess('Employee deleted successfully.');
    }

    function getActiveEmployees() {
        return getEmployees().filter(e => e.isActive !== false);
    }

    function escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function handleHistoryRowClick(row, runs, employeeId) {
        const runId = row.dataset.runId;
        const run = runs.find(function(r) { return r.id === runId; });
        if (!run) return;
        const entry = run.entries.find(function(e) { return e.employeeId === employeeId; });
        if (!entry) return;

        document.querySelectorAll('.emp-hist-row').forEach(function(r) {
            r.classList.remove('selected');
        });
        row.classList.add('selected');

        const periodNum = row.dataset.period || row.querySelector('td').textContent;
        syncLedgerScheduleSelection(periodNum, row);

        if (isCloudPayrollMode()) {
            const hasSnapshot = !!entry.rpnSnapshot;
            const rpn = entry.rpnSnapshot || {
                taxCredits: entry.taxCreditsUsed || 0
            };
            const rpnSection = document.querySelector('.employee-rpn-section');
            if (rpnSection) {
                setRpnSelectValue('rpn-prsi-class', rpn.prsiClass);
                setRpnTextValue('rpn-number', rpn.rpnNumber);
                setRpnSelectValue('rpn-usc-status', rpn.uscStatus);
                setRpnSelectValue('rpn-employer-prsi', rpn.employerPrsiClass);
                setRpnFieldValue('rpn-prev-pay', rpn.previousPay);
                setRpnFieldValue('rpn-prev-tax', rpn.previousTax);
                setRpnFieldValue('rpn-prev-usc', rpn.previousUSC);
                setRpnFieldValue('rpn-bik', rpn.bik);
                setRpnFieldValue('rpn-pension-pct', rpn.pensionPct);
                setRpnFieldValue('rpn-avc', rpn.avc);

                rpnSection.querySelectorAll('input, select').forEach(function(input) {
                    input.disabled = true;
                });
                rpnSection.classList.add('rpn-readonly');

                const noteEl = rpnSection.querySelector('.rpn-note');
                if (noteEl) {
                    if (hasSnapshot) {
                        noteEl.textContent = 'Viewing Period ' + periodNum + ' (read-only). Click "Current Period" to edit.';
                    } else {
                        noteEl.textContent = 'Viewing Period ' + periodNum + ' — No RPN snapshot for this period. Click "Current Period" to edit.';
                    }
                    noteEl.style.color = '#d32f2f';
                }
            }
        } else if (typeof PayrollApp !== 'undefined' && PayrollApp.renderEmployeeCardPayslipPanel) {
            PayrollApp.renderEmployeeCardPayslipPanel(entry, run, employeeId, periodNum);
        }

        const btnCurrent = document.getElementById('btn-current-period');
        if (btnCurrent) {
            btnCurrent.classList.remove('hidden');
            const newBtn = btnCurrent.cloneNode(true);
            btnCurrent.parentNode.replaceChild(newBtn, btnCurrent);
            newBtn.addEventListener('click', function() {
                restoreRpnEditable();
            });
        }
    }

    function setRpnFieldValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = (value !== undefined && value !== null && value !== '') ? Number(value).toFixed(2) : '';
    }

    function setRpnSelectValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    }

    function setRpnTextValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value || '';
    }

    function restoreRpnEditable() {
        document.querySelectorAll('.emp-hist-row').forEach(function(r) {
            r.classList.remove('selected');
        });
        syncLedgerScheduleSelection(null);

        if (isCloudPayrollMode()) {
            applyCloudRpnReadOnlyState(document.querySelector('.employee-edit-layout') || document);
        } else if (typeof PayrollApp !== 'undefined' && PayrollApp.clearEmployeeCardPayslipPanel) {
            PayrollApp.clearEmployeeCardPayslipPanel();
        }

        const btnCurrent = document.getElementById('btn-current-period');
        if (btnCurrent) btnCurrent.classList.add('hidden');
    }

    // Expose public API
    return {
        init,
        renderEmployeeList,
        showEmployeeForm,
        saveEmployee,
        deleteEmployee,
        getActiveEmployees
    };
})();
