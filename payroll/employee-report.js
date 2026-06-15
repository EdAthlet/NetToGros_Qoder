// payroll/employee-report.js — Employee list report (Phase 2, Path A)
// Wired from employees.js via PayrollEmployeeReport.init()

var PayrollEmployeeReport = (function() {
    'use strict';

    var deps = {};

    var employeeReportVisible = false;
    var employeeReportSort = { field: 'name', direction: 'asc' };
    var EMPLOYEE_REPORT_FIELDS = [
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
    var employeeReportFields = {
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

    function init(dependencies) {
        deps = dependencies || {};
    }

    function getEmployeeSortValue(emp, field) {
        if (!emp) return '';
        if (field === 'name') return deps.getEmployeeName(emp).toLowerCase();
        if (field === 'employeeNumber') return deps.getEmployeeNumber(emp).toLowerCase();
        if (field === 'status') return emp.isActive !== false ? 'active' : 'inactive';
        if (field === 'familyStatus') return deps.getFamilyStatusLabel(emp.familyStatus).toLowerCase();
        if (field === 'payType') return deps.getEmployeePayTypeLabel(emp).toLowerCase();
        if (field === 'payFrequency') return deps.getPayFrequencyLabel(emp.payFrequency || 'monthly').toLowerCase();
        if (field === 'pay') return deps.getEmployeePayAmount(emp);
        if (field === 'pps') return (emp.ppsNumber || '').toLowerCase();
        if (field === 'bank') return deps.getEmployeeIban(emp).toLowerCase();
        if (field === 'prsi') return (emp.prsiClass || 'A1').toLowerCase();
        if (field === 'startDate') return emp.startDate || '';
        if (field === 'taxCredits') return emp.manualTaxCredits || 0;
        if (field === 'cutOffPoint') return emp.manualCutOffPoint || 0;
        return '';
    }

    function getSortedEmployeesForReport() {
        var employees = deps.getEmployees().slice();
        var field = employeeReportSort.field || 'name';
        var dir = employeeReportSort.direction === 'desc' ? -1 : 1;
        employees.sort(function(a, b) {
            var av = getEmployeeSortValue(a, field);
            var bv = getEmployeeSortValue(b, field);
            if (typeof av === 'number' || typeof bv === 'number') {
                return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
            }
            return String(av).localeCompare(String(bv)) * dir;
        });
        return employees;
    }

    function getEmployeeReportColumns() {
        var columnsByKey = {
            name: { key: 'name', label: 'Name', render: function(emp) { return deps.escapeHtml(deps.getEmployeeName(emp)); } },
            employeeNumber: { key: 'employeeNumber', label: 'Employee No.', render: function(emp) { return deps.escapeHtml(deps.getEmployeeNumber(emp) || 'Not assigned'); } },
            status: { key: 'status', label: 'Status', render: function(emp) { return emp.isActive !== false ? 'Active' : 'Inactive'; } },
            familyStatus: { key: 'familyStatus', label: 'Family Status', render: function(emp) { return deps.escapeHtml(deps.getFamilyStatusLabel(emp.familyStatus)); } },
            payType: { key: 'payType', label: 'Pay Type', render: function(emp) { return deps.getEmployeePayTypeLabel(emp); } },
            payFrequency: { key: 'payFrequency', label: 'Pay Frequency', render: function(emp) { return deps.getPayFrequencyLabel(emp.payFrequency || 'monthly'); } },
            pay: { key: 'pay', label: 'Pay Amount', className: 'text-right', render: function(emp) { return deps.getEmployeePayAmountLabel(emp); } },
            pps: { key: 'pps', label: 'PPS', render: function(emp) { return deps.escapeHtml(emp.ppsNumber || ''); } },
            bank: { key: 'bank', label: 'Bank Account', render: function(emp) { return deps.escapeHtml(deps.getEmployeeIban(emp) || 'Not provided'); } },
            prsi: { key: 'prsi', label: 'PRSI', render: function(emp) { return deps.escapeHtml(emp.prsiClass || 'A1'); } },
            startDate: { key: 'startDate', label: 'Start Date', render: function(emp) { return deps.escapeHtml(emp.startDate || ''); } },
            taxCredits: { key: 'taxCredits', label: 'Tax Credit', className: 'text-right', render: function(emp) { return deps.safeFormatCurrency(emp.manualTaxCredits || 0); } },
            cutOffPoint: { key: 'cutOffPoint', label: 'COP', className: 'text-right', render: function(emp) { return deps.safeFormatCurrency(emp.manualCutOffPoint || 0); } }
        };
        return EMPLOYEE_REPORT_FIELDS
            .filter(function(field) { return employeeReportFields[field.key] !== false; })
            .map(function(field) { return columnsByKey[field.key]; })
            .filter(Boolean);
    }

    function renderEmployeeReportTable() {
        var employees = getSortedEmployeesForReport();
        var columns = getEmployeeReportColumns();
        if (columns.length === 0) {
            return '<div class="employee-report-empty">Select at least one field to render the employee list.</div>';
        }
        var html = '<div class="employee-report-table-wrap">';
        html += '<table class="employee-report-table">';
        html += '<thead><tr>';
        columns.forEach(function(column) {
            var sortMarker = employeeReportSort.field === column.key ? (employeeReportSort.direction === 'asc' ? ' (asc)' : ' (desc)') : '';
            html += '<th' + (column.className ? ' class="' + column.className + '"' : '') + '><button type="button" class="employee-report-sort" data-sort-field="' + column.key + '">' + deps.escapeHtml(column.label + sortMarker) + '</button></th>';
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

    function renderControls() {
        var html = '<div class="employee-report-panel">';
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

    function printEmployeeReport() {
        var employees = getSortedEmployeesForReport();
        var columns = getEmployeeReportColumns();
        var companyNameEl = document.getElementById('workspace-company-name');
        var companyNumberEl = document.getElementById('workspace-company-number');
        var companyName = companyNameEl ? companyNameEl.textContent : 'Company';
        var companyNumber = companyNumberEl ? companyNumberEl.textContent : '';
        var generatedAt = new Date().toLocaleString('en-IE');

        var reportHtml = '<!doctype html><html><head><title>Employee List</title>';
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
        reportHtml += '<div class="meta">' + deps.escapeHtml(companyName) + (companyNumber ? ' | ' + deps.escapeHtml(companyNumber) : '') + ' | Generated ' + deps.escapeHtml(generatedAt) + '</div>';
        reportHtml += '<table><thead><tr>';
        columns.forEach(function(column) {
            reportHtml += '<th class="' + (column.className || '') + '">' + deps.escapeHtml(column.label) + '</th>';
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

        var reportWindow = window.open('', '_blank');
        if (!reportWindow) {
            deps.showValidationErrors([{ field: null, message: 'Pop-up blocked. Please allow pop-ups to print the employee list.' }]);
            return;
        }
        reportWindow.document.open();
        reportWindow.document.write(reportHtml);
        reportWindow.document.close();
    }

    function bindEvents(el) {
        var toggleBtn = el.querySelector('#btn-toggle-employee-report');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function() {
                employeeReportVisible = !employeeReportVisible;
                deps.refreshList();
            });
        }
        var printBtn = el.querySelector('#btn-print-employee-report');
        if (printBtn) {
            printBtn.addEventListener('click', printEmployeeReport);
        }
        el.querySelectorAll('.employee-report-field-toggle').forEach(function(input) {
            input.addEventListener('change', function() {
                employeeReportFields[input.dataset.field] = input.checked;
                if (employeeReportVisible) {
                    deps.refreshList();
                }
            });
        });
        el.querySelectorAll('.employee-report-sort').forEach(function(button) {
            button.addEventListener('click', function() {
                var field = button.dataset.sortField;
                if (employeeReportSort.field === field) {
                    employeeReportSort.direction = employeeReportSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    employeeReportSort.field = field;
                    employeeReportSort.direction = 'asc';
                }
                employeeReportVisible = true;
                deps.refreshList();
            });
        });
    }

    return {
        init: init,
        renderControls: renderControls,
        bindEvents: bindEvents
    };
})();