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
            PayrollStorage.saveEmployees(currentCompanyId, employees);
        }
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
        const isEdit = !!emp;

        let html = '<form class="employee-form" id="employee-form">';
        html += '<h2>' + (isEdit ? 'Edit Employee' : 'Add Employee') + '</h2>';

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
        html += '<label for="emp-hourly-rate">' + (isHourly ? 'Hourly Rate <span class="required">*</span>' : 'Overtime Hourly Rate') + '</label>';
        html += '<input type="number" id="emp-hourly-rate" name="hourlyRate" class="form-input" value="' + (emp && emp.hourlyRate ? Number(emp.hourlyRate).toFixed(2) : '') + '"' + (isHourly ? ' required' : '') + ' min="0" step="0.01">';
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
        html += '<div class="form-group manual-fields"' + manualVisible + '>';
        html += '<label for="emp-manual-tax-credits">Manual Tax Credits</label>';
        html += '<input type="number" id="emp-manual-tax-credits" name="manualTaxCredits" class="form-input" value="' + (emp && emp.manualTaxCredits ? Number(emp.manualTaxCredits).toFixed(2) : '') + '" min="0" step="0.01">';
        html += '</div>';

        html += '<div class="form-group manual-fields"' + manualVisible + '>';
        html += '<label for="emp-manual-cutoff">Manual Cut-Off Point</label>';
        html += '<input type="number" id="emp-manual-cutoff" name="manualCutOffPoint" class="form-input" value="' + (emp && emp.manualCutOffPoint ? Number(emp.manualCutOffPoint).toFixed(2) : '') + '" min="0" step="0.01">';
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
        html += '<button type="button" class="btn-secondary" id="btn-cancel">Cancel</button>';
        html += '</div>';

        html += '</form>';

        el.innerHTML = html;

        // Bind toggle for manual fields
        const modeRadios = el.querySelectorAll('input[name="taxCreditsMode"]');
        modeRadios.forEach(r => {
            r.addEventListener('change', (e) => {
                const show = e.target.value === 'manual';
                el.querySelectorAll('.manual-fields').forEach(f => {
                    f.style.display = show ? '' : 'none';
                });
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

        // Bind cancel
        el.querySelector('#btn-cancel').addEventListener('click', () => {
            currentEmployeeId = null;
            renderEmployeeList();
        });
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
        data.overtimeMultiplier = parseFloat(data.overtimeMultiplier) || 1.5;
        if (data.payType === 'hourly') {
            data.annualGross = 0;
        }
        data.manualTaxCredits = data.manualTaxCredits ? parseFloat(data.manualTaxCredits) : '';
        data.manualCutOffPoint = data.manualCutOffPoint ? parseFloat(data.manualCutOffPoint) : '';
        return data;
    }

    function saveEmployee(formData) {
        const errors = validateEmployee(formData);
        if (errors.length > 0) {
            showValidationErrors(errors);
            return;
        }

        let employees = getEmployees();

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
            const newId = generateId();
            employees.push({ ...formData, id: newId });
        }

        const isEdit = !!currentEmployeeId;
        saveEmployees(employees);
        currentEmployeeId = null;
        renderEmployeeList();
        showSuccess(isEdit ? 'Employee updated successfully.' : 'Employee added successfully.');
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
        }
        const payType = data.payType || 'salaried';
        if (payType === 'hourly') {
            if (!data.hourlyRate || Number(data.hourlyRate) <= 0) {
                errors.push({ field: 'hourlyRate', message: 'Hourly rate is required and must be greater than 0.' });
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
        modal.style.display = 'flex';

        // Bind once
        const confirmBtn = modal.querySelector('#modal-confirm-delete');
        const cancelBtn = modal.querySelector('#modal-cancel-delete');

        const newConfirm = confirmBtn.cloneNode(true);
        const newCancel = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

        newConfirm.addEventListener('click', () => {
            performDelete();
            modal.style.display = 'none';
        });
        newCancel.addEventListener('click', () => {
            deleteTargetId = null;
            modal.style.display = 'none';
        });
    }

    function performDelete() {
        if (!deleteTargetId) return;
        let employees = getEmployees();
        employees = employees.filter(e => e.id !== deleteTargetId);
        saveEmployees(employees);
        deleteTargetId = null;
        renderEmployeeList();
        showSuccess('Employee deleted successfully.');
    }

    function getActiveEmployees() {
        return getEmployees().filter(e => e.isActive === true);
    }

    function escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
