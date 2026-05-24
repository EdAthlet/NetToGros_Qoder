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
        { value: 'singleParent', label: 'Single Parent' }
    ];
    const PRSI_CLASS_OPTIONS = ['A', 'A0', 'AX', 'AL', 'A1'];

    let container = null;
    let currentEmployeeId = null;
    let deleteTargetId = null;
    let currentCompanyId = null;

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

    function formatTaxDefaultSummary(familyStatus) {
        const label = getFamilyStatusLabel(familyStatus);
        return '<div class="tax-default-summary" id="tax-default-summary">' +
            '<div><span>Selected Status</span><strong id="tax-default-status">' + escapeHtml(label) + '</strong></div>' +
            '<div><span>Tax Credit</span><strong id="tax-default-tc">' + safeFormatCurrency(getDefaultAnnualTC(familyStatus)) + '</strong></div>' +
            '<div><span>COP</span><strong id="tax-default-cop">' + safeFormatCurrency(getDefaultCutOffPoint(familyStatus)) + '</strong></div>' +
            '</div>';
    }

    function maskPPS(pps) {
        if (!pps || pps.length < 4) return pps;
        return '****' + pps.slice(-4);
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

                html += '<div class="employee-card" data-id="' + (emp.id || '') + '">';
                html += '<div class="employee-card-header">';
                html += '<h3 class="employee-name">' + escapeHtml(emp.firstName || '') + ' ' + escapeHtml(emp.lastName || '') + '</h3>';
                html += '<span class="' + statusClass + '">' + statusText + '</span>';
                html += '</div>';
                html += '<div class="employee-card-body">';
                html += '<div class="employee-detail"><span class="label">PPS:</span> <span class="value">' + maskPPS(emp.ppsNumber || '') + '</span></div>';
                html += '<div class="employee-detail"><span class="label">Status:</span> <span class="value">' + familyLabel + '</span></div>';
                html += '<div class="employee-detail"><span class="label">Gross:</span> <span class="value">' + safeFormatCurrency(emp.annualGross || 0) + '</span></div>';
                html += '<div class="employee-detail"><span class="label">PRSI:</span> <span class="value">' + escapeHtml(emp.prsiClass || 'A1') + '</span></div>';
                html += '</div>';
                html += '<div class="employee-card-actions">';
                html += '<button type="button" class="btn-secondary btn-edit" data-id="' + (emp.id || '') + '">Edit</button>';
                html += '<button type="button" class="btn-danger btn-delete" data-id="' + (emp.id || '') + '">Delete</button>';
                html += '</div>';
                html += '</div>';
            });
            html += '</div>';
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
        const selectedFamilyStatus = emp && emp.familyStatus ? emp.familyStatus : 'single';

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
        html += '<label for="emp-family-status">Family Status</label>';
        html += '<select id="emp-family-status" name="familyStatus" class="form-select">';
        FAMILY_STATUS_OPTIONS.forEach(opt => {
            html += '<option value="' + opt.value + '"' + ((emp && emp.familyStatus === opt.value) || (!emp && opt.value === 'single') ? ' selected' : '') + '>' + opt.label + '</option>';
        });
        html += '</select>';
        html += formatTaxDefaultSummary(selectedFamilyStatus);
        html += '</div>';

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

        const taxMode = emp && emp.taxCreditsMode === 'manual' ? 'manual' : 'automatic';
        html += '<div class="form-group">';
        html += '<label>Tax Credits Mode</label>';
        html += '<div class="toggle-group">';
        html += '<label><input type="radio" name="taxCreditsMode" value="automatic"' + (taxMode === 'automatic' ? ' checked' : '') + '> Automatic</label>';
        html += '<label><input type="radio" name="taxCreditsMode" value="manual"' + (taxMode === 'manual' ? ' checked' : '') + '> Manual</label>';
        html += '</div>';
        html += '</div>';

        const manualVisible = taxMode === 'manual' ? '' : ' style="display:none"';
        const manualTaxCreditsValue = emp && emp.manualTaxCredits ? Number(emp.manualTaxCredits).toFixed(2) : Number(getDefaultAnnualTC(selectedFamilyStatus)).toFixed(2);
        const manualCutOffValue = emp && emp.manualCutOffPoint ? Number(emp.manualCutOffPoint).toFixed(2) : Number(getDefaultCutOffPoint(selectedFamilyStatus)).toFixed(2);
        html += '<div class="form-group manual-fields"' + manualVisible + '>';
        html += '<label for="emp-manual-tax-credits">Manual Tax Credits</label>';
        html += '<input type="number" id="emp-manual-tax-credits" name="manualTaxCredits" class="form-input" value="' + manualTaxCreditsValue + '" min="0" step="0.01">';
        html += '</div>';

        html += '<div class="form-group manual-fields"' + manualVisible + '>';
        html += '<label for="emp-manual-cutoff">Manual Cut-Off Point</label>';
        html += '<input type="number" id="emp-manual-cutoff" name="manualCutOffPoint" class="form-input" value="' + manualCutOffValue + '" min="0" step="0.01">';
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
        html += '<div class="employee-rpn-section">';
        html += '<h3>Revenue Payroll Notification (RPN)</h3>';
        html += '<p class="rpn-note">Enter values from Revenue\'s ROS/myAccount</p>';
        html += '<div class="rpn-form">';
        html += '<div class="form-group">';
        html += '<label for="rpn-tax-credits">Tax Credits</label>';
        html += '<input type="number" id="rpn-tax-credits" class="form-input" step="0.01" min="0" value="' + (rpn.taxCredits ? Number(rpn.taxCredits).toFixed(2) : '') + '">';
        html += '</div>';
        html += '<div class="form-group">';
        html += '<label for="rpn-cutoff">Cut-Off Point (Standard Rate Band)</label>';
        html += '<input type="number" id="rpn-cutoff" class="form-input" step="0.01" min="0" value="' + (rpn.cutOffPoint ? Number(rpn.cutOffPoint).toFixed(2) : '') + '">';
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
        html += '<button type="button" class="btn btn-secondary btn-current-period hidden" id="btn-current-period">Current Period</button>';
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
        html += '<th class="text-right">RPN TC Applied</th>';
        html += '<th class="text-right">Credit Left</th>';
        html += '</tr>';
        html += '</thead>';
        html += '<tbody id="tc-remaining-body"></tbody>';
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
                    // Sort runs by date ascending
                    const sortedRuns = submittedRuns.slice().sort(function(a, b) {
                        return new Date(a.runDate) - new Date(b.runDate);
                    });
                    let periodNum = 0;
                    let histHtml = '';
                    sortedRuns.forEach(function(run) {
                        const entry = run.entries.find(function(e) { return e.employeeId === employeeId; });
                        if (entry) {
                            periodNum++;
                            const date = new Date(run.runDate);
                            const dateStr = date.toLocaleDateString('en-IE') + ' ' + date.toLocaleTimeString('en-IE', {hour:'2-digit', minute:'2-digit'});
                            histHtml += '<tr class="emp-hist-row" data-run-id="' + run.id + '" data-emp-id="' + employeeId + '">';
                            histHtml += '<td>' + periodNum + '</td>';
                            histHtml += '<td>' + dateStr + '</td>';
                            histHtml += '<td class="text-right">' + safeFormatCurrency(entry.grossPay) + '</td>';
                            histHtml += '<td class="text-right">' + safeFormatCurrency(entry.paye) + '</td>';
                            histHtml += '<td class="text-right">' + safeFormatCurrency(entry.usc) + '</td>';
                            histHtml += '<td class="text-right">' + safeFormatCurrency(entry.prsi) + '</td>';
                            histHtml += '<td class="text-right">' + safeFormatCurrency(entry.netPay) + '</td>';
                            histHtml += '<td class="text-right">' + safeFormatCurrency(entry.taxCreditsUsed || 0) + '</td>';
                            histHtml += '</tr>';
                        }
                    });
                    histBody.innerHTML = histHtml || '<tr><td colspan="8" class="text-center">No submitted payroll runs yet</td></tr>';

                    // Bind row clicks
                    histBody.querySelectorAll('.emp-hist-row').forEach(function(row) {
                        row.addEventListener('click', function() {
                            handleHistoryRowClick(row, sortedRuns, employeeId);
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

            // Annual TC from RPN or from employee settings
            let annualTC = (emp.rpn && emp.rpn.taxCredits) ? emp.rpn.taxCredits : (emp.manualTaxCredits || 0);
            // If automatic mode, use a default
            if (emp.taxCreditsMode === 'automatic' && !annualTC) {
                if (emp.familyStatus === 'married_one' || emp.familyStatus === 'married_two' || emp.familyStatus === 'married' || emp.familyStatus === 'marriedOneWorking') {
                    annualTC = 7500;
                } else {
                    annualTC = 3750;
                }
            }

            const estCreditPerPeriod = annualTC / periodsPerYear;
            const rpnTCPerPeriod = (emp.rpn && emp.rpn.taxCredits) ? emp.rpn.taxCredits / periodsPerYear : estCreditPerPeriod;

            // Build array of committed credits per period from submitted runs only
            const committedCredits = {};  // periodNum -> credit used
            const submittedOnly = (runs || []).filter(function(r) { return r.status === 'submitted'; });
            if (submittedOnly.length > 0) {
                const sortedRuns2 = submittedOnly.slice().sort(function(a, b) { return new Date(a.runDate) - new Date(b.runDate); });
                let pNum = 0;
                sortedRuns2.forEach(function(run) {
                    const entry = run.entries.find(function(e) { return e.employeeId === employeeId; });
                    if (entry) {
                        pNum++;
                        committedCredits[pNum] = entry.taxCreditsUsed || estCreditPerPeriod;
                    }
                });
            }

            // Generate rows for all periods
            let tcHtml = '';
            let remainingTC = annualTC;
            for (let p = 1; p <= periodsPerYear; p++) {
                const creditUsed = committedCredits[p] || 0;
                const creditLeftAfter = committedCredits[p] ? (remainingTC - creditUsed) : '';
                const rpnApplied = committedCredits[p] ? (rpnTCPerPeriod > 0 ? rpnTCPerPeriod.toFixed(2) : estCreditPerPeriod.toFixed(2)) : '';

                tcHtml += '<tr' + (committedCredits[p] ? ' class="tc-committed"' : '') + '>';
                tcHtml += '<td>' + payFreqLabel + '</td>';
                tcHtml += '<td>' + p + '</td>';
                tcHtml += '<td class="text-right">' + remainingTC.toFixed(2) + '</td>';
                tcHtml += '<td class="text-right">' + estCreditPerPeriod.toFixed(2) + '</td>';
                tcHtml += '<td class="text-right">' + rpnApplied + '</td>';
                tcHtml += '<td class="text-right">' + (creditLeftAfter !== '' ? creditLeftAfter.toFixed(2) : '') + '</td>';
                tcHtml += '</tr>';

                // Decrease remaining for next period (only for committed periods)
                if (committedCredits[p]) {
                    remainingTC -= creditUsed;
                }
            }
            tcBody.innerHTML = tcHtml;
        }

        function updateTaxDefaultSummary(familyStatus) {
            const statusEl = el.querySelector('#tax-default-status');
            const tcEl = el.querySelector('#tax-default-tc');
            const copEl = el.querySelector('#tax-default-cop');
            if (statusEl) statusEl.textContent = getFamilyStatusLabel(familyStatus);
            if (tcEl) tcEl.textContent = safeFormatCurrency(getDefaultAnnualTC(familyStatus));
            if (copEl) copEl.textContent = safeFormatCurrency(getDefaultCutOffPoint(familyStatus));
        }

        function applyManualDefaults(familyStatus, force) {
            const tcInput = el.querySelector('#emp-manual-tax-credits');
            const copInput = el.querySelector('#emp-manual-cutoff');
            if (tcInput && (force || !tcInput.value)) {
                tcInput.value = Number(getDefaultAnnualTC(familyStatus)).toFixed(2);
            }
            if (copInput && (force || !copInput.value)) {
                copInput.value = Number(getDefaultCutOffPoint(familyStatus)).toFixed(2);
            }
        }

        const familyStatusSelect = el.querySelector('#emp-family-status');
        if (familyStatusSelect) {
            familyStatusSelect.addEventListener('change', function() {
                updateTaxDefaultSummary(familyStatusSelect.value);
                applyManualDefaults(familyStatusSelect.value, true);
            });
        }

        // Bind toggle for manual fields
        const modeRadios = el.querySelectorAll('input[name="taxCreditsMode"]');
        modeRadios.forEach(r => {
            r.addEventListener('change', (e) => {
                const show = e.target.value === 'manual';
                el.querySelectorAll('.manual-fields').forEach(f => {
                    f.style.display = show ? '' : 'none';
                });
                if (show) {
                    applyManualDefaults(familyStatusSelect ? familyStatusSelect.value : 'single', false);
                }
            });
        });

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
        formData.forEach((value, key) => {
            if (key === 'isActive') {
                data[key] = true;
            } else {
                data[key] = value;
            }
        });
        // Checkbox special handling
        data.isActive = form.querySelector('#emp-active').checked;
        // Manual fields
        if (data.taxCreditsMode !== 'manual') {
            data.manualTaxCredits = '';
            data.manualCutOffPoint = '';
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
        data.payFrequency = document.getElementById('emp-pay-frequency').value;
        data.manualTaxCredits = data.manualTaxCredits ? parseFloat(data.manualTaxCredits) : '';
        data.manualCutOffPoint = data.manualCutOffPoint ? parseFloat(data.manualCutOffPoint) : '';
        data.rpn = {
            taxCredits: parseFloat(document.getElementById('rpn-tax-credits').value) || 0,
            cutOffPoint: parseFloat(document.getElementById('rpn-cutoff').value) || 0,
            prsiClass: document.getElementById('rpn-prsi-class').value,
            uscStatus: document.getElementById('rpn-usc-status').value,
            employerPrsiClass: document.getElementById('rpn-employer-prsi').value,
            previousPay: parseFloat(document.getElementById('rpn-prev-pay').value) || 0,
            previousTax: parseFloat(document.getElementById('rpn-prev-tax').value) || 0,
            previousUSC: parseFloat(document.getElementById('rpn-prev-usc').value) || 0,
            bik: parseFloat(document.getElementById('rpn-bik').value) || 0,
            pensionPct: parseFloat(document.getElementById('rpn-pension-pct').value) || 0,
            avc: parseFloat(document.getElementById('rpn-avc').value) || 0
        };
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
            employees[idx] = { ...employees[idx], ...formData, id: currentEmployeeId };
        } else {
            // Add
            if (employees.length >= MAX_EMPLOYEES) {
                showValidationErrors([{ field: null, message: 'Maximum of ' + MAX_EMPLOYEES + ' employees reached.' }]);
                return;
            }
            savedId = generateId();
            employees.push({ ...formData, id: savedId });
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
        if (data.taxCreditsMode === 'manual') {
            if (data.manualTaxCredits === '' || Number(data.manualTaxCredits) < 0) {
                errors.push({ field: 'manualTaxCredits', message: 'Manual tax credits are required when manual mode is selected.' });
            }
            if (data.manualCutOffPoint === '' || Number(data.manualCutOffPoint) <= 0) {
                errors.push({ field: 'manualCutOffPoint', message: 'Manual cut-off point is required when manual mode is selected.' });
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

        // Highlight selected row
        document.querySelectorAll('.emp-hist-row').forEach(function(r) {
            r.classList.remove('selected');
        });
        row.classList.add('selected');

        // Get period number from row
        const periodNum = row.querySelector('td').textContent;

        // Populate RPN fields with snapshot values (read-only)
        const hasSnapshot = !!entry.rpnSnapshot;
        const rpn = entry.rpnSnapshot || {
            taxCredits: entry.taxCreditsUsed || 0
        };
        const rpnSection = document.querySelector('.employee-rpn-section');
        if (rpnSection) {
            // Set values from snapshot
            setRpnFieldValue('rpn-tax-credits', rpn.taxCredits);
            setRpnFieldValue('rpn-cutoff', rpn.cutOffPoint);
            setRpnSelectValue('rpn-prsi-class', rpn.prsiClass);
            setRpnSelectValue('rpn-usc-status', rpn.uscStatus);
            setRpnSelectValue('rpn-employer-prsi', rpn.employerPrsiClass);
            setRpnFieldValue('rpn-prev-pay', rpn.previousPay);
            setRpnFieldValue('rpn-prev-tax', rpn.previousTax);
            setRpnFieldValue('rpn-prev-usc', rpn.previousUSC);
            setRpnFieldValue('rpn-bik', rpn.bik);
            setRpnFieldValue('rpn-pension-pct', rpn.pensionPct);
            setRpnFieldValue('rpn-avc', rpn.avc);

            // Disable all RPN inputs
            rpnSection.querySelectorAll('input, select').forEach(function(input) {
                input.disabled = true;
            });
            rpnSection.classList.add('rpn-readonly');

            // Show read-only note
            const noteEl = rpnSection.querySelector('.rpn-note');
            if (noteEl) {
                if (hasSnapshot) {
                    noteEl.textContent = 'Viewing Period ' + periodNum + ' (read-only). Click "Current Period" to edit.';
                } else {
                    noteEl.textContent = 'Viewing Period ' + periodNum + ' — No RPN snapshot for this period. Tax Credits show period value used. Click "Current Period" to edit.';
                }
                noteEl.style.color = '#d32f2f';
            }
        }

        // Show "Current Period" button
        const btnCurrent = document.getElementById('btn-current-period');
        if (btnCurrent) {
            btnCurrent.classList.remove('hidden');
            // Remove old listener, add new
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

    function restoreRpnEditable() {
        // Deselect history row
        document.querySelectorAll('.emp-hist-row').forEach(function(r) {
            r.classList.remove('selected');
        });

        // Re-enable RPN fields
        const rpnSection = document.querySelector('.employee-rpn-section');
        if (rpnSection) {
            rpnSection.querySelectorAll('input, select').forEach(function(input) {
                input.disabled = false;
            });
            rpnSection.classList.remove('rpn-readonly');

            // Restore original note
            const noteEl = rpnSection.querySelector('.rpn-note');
            if (noteEl) {
                noteEl.textContent = "Enter values from Revenue's ROS/myAccount";
                noteEl.style.color = '';
            }
        }

        // Restore original RPN values from the employee object
        // Re-read from the currently editing employee
        const employees = getEmployees();
        const emp = currentEmployeeId ? employees.find(function(e) { return e.id === currentEmployeeId; }) : null;
        const rpn = emp ? (emp.rpn || {}) : {};
        setRpnFieldValue('rpn-tax-credits', rpn.taxCredits);
        setRpnFieldValue('rpn-cutoff', rpn.cutOffPoint);
        setRpnSelectValue('rpn-prsi-class', rpn.prsiClass);
        setRpnSelectValue('rpn-usc-status', rpn.uscStatus);
        setRpnSelectValue('rpn-employer-prsi', rpn.employerPrsiClass);
        setRpnFieldValue('rpn-prev-pay', rpn.previousPay);
        setRpnFieldValue('rpn-prev-tax', rpn.previousTax);
        setRpnFieldValue('rpn-prev-usc', rpn.previousUSC);
        setRpnFieldValue('rpn-bik', rpn.bik);
        setRpnFieldValue('rpn-pension-pct', rpn.pensionPct);
        setRpnFieldValue('rpn-avc', rpn.avc);

        // Hide button
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
