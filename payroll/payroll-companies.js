// payroll/payroll-companies.js — Company list, edit, sandbox, delete

var PayrollCompanies = (function() {
    'use strict';

    var deps = {};

    function init(dependencies) {
        deps = dependencies || {};
    }

    function callDep(name) {
        var fn = deps[name];
        if (typeof fn === 'function') {
            return fn.apply(null, Array.prototype.slice.call(arguments, 1));
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

    function bindCompanyListEvents(container) {
        container.querySelectorAll('[data-action]').forEach(function(el) {
            el.addEventListener('click', function(e) {
                e.preventDefault();
                const action = el.dataset.action;
                const companyId = el.dataset.companyId;
                if (!companyId) return;

                if (action === 'enter-company') {
                    callDep('enterCompany', companyId);
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
            const id = PayrollUtils.escapeHtml(company.id);
            const name = PayrollUtils.escapeHtml(company.name || 'Unnamed Company');
            const address = company.address || '';
            const eircode = company.eircode || '';
            const taxNumber = getCompanyTaxNumber(company);
            const payFrequency = company.payFrequency || 'monthly';
            const payDate = PayrollUtils.getCompanyPayDay(company);
            const taxYear = company.taxYear || '2026';
            const taxPeriod = company.taxPeriod === 'oct-dec' ? 'October - December' : 'January - September';
            const modeBadge = PayrollModeUI.getModeBadgeHtml(company, index);

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
            html += '<span class="company-detail-value">' + PayrollUtils.escapeHtml(address) + '</span>';
            html += '</div>';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Eircode</span>';
            html += '<span class="company-detail-value">' + PayrollUtils.escapeHtml(eircode) + '</span>';
            html += '</div>';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Company Tax Number</span>';
            html += '<span class="company-detail-value">' + PayrollUtils.escapeHtml(taxNumber || 'Not set') + '</span>';
            html += '</div>';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Pay Frequency</span>';
            html += '<span class="company-detail-value">' + PayrollUtils.escapeHtml(payFrequency.charAt(0).toUpperCase() + payFrequency.slice(1)) + '</span>';
            html += '</div>';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Pay Date</span>';
            html += '<span class="company-detail-value">' + PayrollUtils.escapeHtml(PayrollUtils.getPayDayLabel(payDate)) + '</span>';
            html += '</div>';
            html += '<div class="company-detail-item">';
            html += '<span class="company-detail-label">Tax Year</span>';
            html += '<span class="company-detail-value">' + PayrollUtils.escapeHtml(taxYear) + ' (' + PayrollUtils.escapeHtml(taxPeriod) + ')</span>';
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

    function loadLocalSandboxCompany(companyId) {
        if (getCompanySlotIndex(companyId) !== 0) {
            PayrollUI.showMessage('Local sandbox can only be loaded into Practice – Local.', 'error');
            return;
        }

        PayrollUI.showConfirmModal('Load Sandbox Ltd for local practice? This clears Company 1 data and removes RPN fields so manual tax credits/COP are used.', function() {
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
            }, PayrollModeUI.stripRpnForLocalMode(buildSandboxEmployees()));

            if (success) {
                PayrollUI.showMessage('Sandbox Ltd loaded for local mode with 8 practice employees.', 'success');
                renderCompanyList();
            } else {
                PayrollUI.showMessage('Failed to load Sandbox Ltd.', 'error');
            }
        });
    }

    function loadCloudSandboxCompany(companyId) {
        if (getCompanySlotIndex(companyId) !== 1) {
            PayrollUI.showMessage('Cloud sandbox can only be loaded into Practice – Cloud.', 'error');
            return;
        }

        PayrollUI.showConfirmModal('Load Cloud Sandbox for RPN practice? This clears Company 2 data. Retrieve RPN from the fake Revenue server before running payroll.', function() {
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
            }, PayrollModeUI.stripRpnNumbersForCloudPractice(buildSandboxEmployees()));

            if (success) {
                PayrollUI.showMessage('Cloud sandbox loaded with 8 employees. Open the company and click Retrieve RPN.', 'success');
                renderCompanyList();
            } else {
                PayrollUI.showMessage('Failed to load cloud sandbox.', 'error');
            }
        });
    }

    function deleteCompanyData(companyId) {
        const company = PayrollStorage.getCompany(companyId);
        if (!company) return;
        PayrollUI.showConfirmModal('This clears employees, payroll history, submissions, and company details for ' + (company.name || 'this company') + '. This cannot be undone.', function() {
            if (PayrollStorage.resetCompany(companyId)) {
                if (PayrollContext.currentCompanyId === companyId) {
                    PayrollContext.currentCompanyId = null;
                }
                PayrollUI.showMessage('Company data deleted.', 'success');
                renderCompanyList();
            } else {
                PayrollUI.showMessage('Failed to delete company data.', 'error');
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

        const id = PayrollUtils.escapeHtml(companyId);
        const name = PayrollUtils.escapeHtml(company.name || '');
        const address = PayrollUtils.escapeHtml(company.address || '');
        const eircode = PayrollUtils.escapeHtml(company.eircode || '');
        const taxNumber = PayrollUtils.escapeHtml(getCompanyTaxNumber(company));
        const payFrequency = company.payFrequency || 'monthly';
        const payDate = PayrollUtils.getCompanyPayDay(company);
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
            html += '<option value="' + day + '"' + (payDate === day ? ' selected' : '') + '>' + PayrollUtils.getPayDayLabel(day) + '</option>';
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
            PayrollUI.showMessage('Company details saved.', 'success');
            renderCompanyList();
        } else {
            PayrollUI.showMessage('Failed to save company details.', 'error');
        }
    }

    return {
        init: init,
        renderCompanyList: renderCompanyList,
        bindCompanyListEvents: bindCompanyListEvents,
        getCompanySlotIndex: getCompanySlotIndex,
        buildSandboxEmployees: buildSandboxEmployees,
        resetCompanyPracticeData: resetCompanyPracticeData,
        loadLocalSandboxCompany: loadLocalSandboxCompany,
        loadCloudSandboxCompany: loadCloudSandboxCompany,
        deleteCompanyData: deleteCompanyData,
        toggleCompanyDetails: toggleCompanyDetails,
        showCompanyEditForm: showCompanyEditForm,
        saveCompanyEdit: saveCompanyEdit,
        getCurrentCompany: getCurrentCompany,
        getCompanyTaxNumber: getCompanyTaxNumber,
        getEmployerRegistrationNumber: getEmployerRegistrationNumber
    };
})();