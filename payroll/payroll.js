// payroll/payroll.js — Core Payroll App Orchestration (Multi-Company)
// Depends on: calculator-core.js, storage.js, employees.js

const PayrollApp = (function() {
    'use strict';

    // --- State ---
    let currentRunData = null;
    let payslipReturnTab = 'history';
    let currentPayslipContext = null;
    let currentCompanyId = null;
    const RPN_API_URL = 'http://localhost:3001/rpn';

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

    function getEmployeeAnnualTaxCredits(emp) {
        if (!emp) return getDefaultAnnualTC('single');
        if (hasValidRPN(emp) && emp.rpn.taxCredits !== undefined) return parseFloat(emp.rpn.taxCredits) || 0;
        if (isCustomTaxStatus(emp)) return parseFloat(emp.manualTaxCredits) || 0;
        return getDefaultAnnualTC(emp.familyStatus || 'single');
    }

    function getEmployeeCutOffPoint(emp) {
        if (!emp) return getDefaultCutOffPoint('single');
        if (hasValidRPN(emp) && emp.rpn.cutOffPoint !== undefined) return parseFloat(emp.rpn.cutOffPoint) || 0;
        if (isCustomTaxStatus(emp) && emp.manualCutOffPoint) return parseFloat(emp.manualCutOffPoint) || 0;
        return getDefaultCutOffPoint(emp.familyStatus || 'single');
    }

    function getEmployeeTaxSource(emp) {
        return isCustomTaxStatus(emp) ? 'manual' : 'automatic';
    }

    function hasValidRPN(employee) {
        return !!(employee && employee.rpn && employee.rpn.rpnNumber);
    }

    function toFiniteNumber(value, fallback) {
        const parsed = parseFloat(value);
        return Number.isFinite(parsed) ? parsed : (fallback || 0);
    }

    function getEmployeePayFrequency(emp) {
        return (emp && emp.payFrequency) || 'monthly';
    }

    function getPeriodsPerYearForFrequency(frequency) {
        if (frequency === 'weekly') return 52;
        if (frequency === 'fortnightly') return 26;
        return 12;
    }

    function getPayFrequencyLabel(frequency) {
        if (frequency === 'weekly') return 'Weekly';
        if (frequency === 'fortnightly') return 'Fortnightly';
        return 'Monthly';
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
        if (hasValidRPN(employee)) {
            const periods = totalPeriodsInYear || 52;
            const rpn = employee.rpn || {};
            return calculateNormalPAYE(grossPay, {
                periodicTaxCredit: rpn.periodicTaxCredit || (getEmployeeAnnualTaxCredits(employee) / periods),
                periodicStandardRateCutOffPoint: rpn.periodicStandardRateCutOffPoint || (getEmployeeCutOffPoint(employee) / periods)
            });
        }

        return calculateEmergencyPAYE(grossPay, weeksOnEmergency, !!(employee && employee.ppsNumber), totalPeriodsInYear || 52);
    }

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
            const taxYear = company.taxYear || '2026';
            const taxPeriod = company.taxPeriod === 'oct-dec' ? 'October - December' : 'January - September';
            const isCompanyOne = index === 0;

            html += '<div class="company-item" data-company-id="' + id + '">';
            html += '<div class="company-item-header">';
            html += '<a href="#" class="company-name-link" data-action="enter-company" data-company-id="' + id + '">' + name + '</a>';
            html += '<div class="company-actions">';
            if (isCompanyOne) {
                html += '<button type="button" class="btn btn-primary btn-sm" data-action="load-sandbox" data-company-id="' + id + '">Load Sandbox Ltd</button>';
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
                } else if (action === 'load-sandbox') {
                    loadSandboxCompany(companyId);
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

    function loadSandboxCompany(companyId) {
        if (getCompanySlotIndex(companyId) !== 0) {
            showMessage('Sandbox data can only be loaded into Company1.', 'error');
            return;
        }

        showConfirmModal('Load Sandbox Ltd into Company1? This will erase Company1 employees, payroll history, submissions, and tax credit ledger.', function() {
            const resetDone = PayrollStorage.resetCompany(companyId);
            const companyUpdated = PayrollStorage.updateCompany(companyId, {
                name: 'Sandbox Ltd',
                address: '123 Main Street, Dublin',
                eircode: 'D01 A1B2',
                taxNumber: '1234567T',
                payFrequency: 'weekly',
                taxYear: '2026',
                taxPeriod: 'jan-sep'
            });
            const employeesSaved = PayrollStorage.saveEmployees(companyId, buildSandboxEmployees());
            PayrollStorage.saveSubmissions(companyId, []);
            PayrollStorage.saveTaxCreditsLedger(companyId, {});
            PayrollStorage.savePeriodState(companyId, {
                currentPeriodNumber: 1,
                commitCounter: 0,
                commits: [],
                weekly: { periodNumber: 1, lastCommittedWeek: 0 },
                fortnightly: { periodNumber: 1, lastCommittedWeek: 0 },
                monthly: { periodNumber: 1, lastCommittedMonth: 0 }
            });

            if (resetDone && companyUpdated && employeesSaved) {
                showMessage('Sandbox Ltd loaded with 8 practice employees.', 'success');
                renderCompanyList();
            } else {
                showMessage('Failed to load Sandbox Ltd.', 'error');
            }
        });
    }

    function deleteCompanyData(companyId) {
        const company = PayrollStorage.getCompany(companyId);
        if (!company) return;
        showConfirmModal('Delete all data for ' + (company.name || 'this company') + '? This clears employees, payroll history, submissions, and company details for this slot.', function() {
            if (PayrollStorage.resetCompany(companyId)) {
                if (currentCompanyId === companyId) {
                    currentCompanyId = null;
                }
                showMessage('Company data deleted.', 'success');
                renderCompanyList();
            } else {
                showMessage('Failed to delete company data.', 'error');
            }
        });
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
        const taxYearInput = document.getElementById('edit-taxyear-' + companyId);
        const taxPeriodInput = document.getElementById('edit-taxperiod-' + companyId);

        const data = {
            name: nameInput ? nameInput.value.trim() : '',
            address: addressInput ? addressInput.value.trim() : '',
            eircode: eircodeInput ? eircodeInput.value.trim() : '',
            taxNumber: taxNumberInput ? taxNumberInput.value.trim() : '',
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
        } else if (tabName === 'submission') {
            renderSubmission();
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
        const previousConfirmation = document.getElementById('commit-confirmation');

        if (timesheetForm) timesheetForm.classList.add('hidden');
        if (timesheetPreview) timesheetPreview.classList.add('hidden');
        if (timesheetCommit) timesheetCommit.classList.add('hidden');
        if (resultsDiv) resultsDiv.classList.add('hidden');
        if (previousConfirmation) previousConfirmation.remove();

        currentRunData = null;

        const employees = typeof PayrollEmployees !== 'undefined' && PayrollEmployees.getActiveEmployees
            ? PayrollEmployees.getActiveEmployees()
            : [];
        const smState = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.getState() : null;
        const now = new Date();
        const calendarWeekNumber = (typeof PayrollStateMachine !== 'undefined' && PayrollStateMachine.getISOWeekNumber)
            ? PayrollStateMachine.getISOWeekNumber(now)
            : Math.ceil((((now - new Date(now.getFullYear(), 0, 1)) / 86400000) + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7);
        const stateWeekNumber = calendarWeekNumber;
        const hasPendingCommit = !!(smState && (
            smState.commitCounter > 0 ||
            (smState.committedRunIds && smState.committedRunIds.length > 0) ||
            (typeof PayrollStateMachine !== 'undefined' && PayrollStateMachine.canSubmit && PayrollStateMachine.canSubmit())
        ));

        let html = '<div class="run-info-line">';
        html += '<span><strong>Tax Year:</strong> ' + escapeHtml(selectedYear) + '</span>';
        html += '<span><strong>Tax Period:</strong> ' + escapeHtml(getCurrentPeriodVar() === 'jan-sep' ? 'Jan \u2013 Sep' : 'Oct \u2013 Dec') + '</span>';
        html += '<span><strong>Current Week:</strong> ' + escapeHtml(String(calendarWeekNumber)) + '</span>';
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
            formHtml += '<div class="period-status-banner">';
            formHtml += '<span class="period-badge">Period ' + smState.currentPeriodNumber + '</span>';
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

        if (smState && hasPendingCommit) {
            formHtml += buildCommittedPeriodPanel(smState);
            if (timesheetForm) {
                timesheetForm.innerHTML = formHtml;
                timesheetForm.classList.remove('hidden');
            }
            bindCommittedPeriodActions();
            bindStateMachineActionButtons();
            bindRPNSuggestionActions();
            return;
        }

        // Render timesheet form
        var weeksInYear = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.getWeeksInYear(parseInt(selectedYear)) : 52;

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
        var fortnightlyNextDue = (typeof PayrollStateMachine !== 'undefined' && PayrollStateMachine.getNextFortnightlyDueWeek)
            ? PayrollStateMachine.getNextFortnightlyDueWeek(stateWeekNumber, smState && smState.fortnightly ? smState.fortnightly.lastCommittedWeek : 0)
            : 24;
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
                var estGross = isHourly ? safeFormatCurrency(calculateEstGross(emp, standardHours, 0, hourlyRate)) : safeFormatCurrency(convertFromAnnual(toFiniteNumber(emp.annualGross, 0)));
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
        var runs = PayrollStorage.loadPayrollRuns(currentCompanyId) || [];
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

        var html = '<div class="commit-confirmation post-commit-panel">';
        html += '<div><strong>Payroll committed and awaiting Revenue submission.</strong>';
        html += '<span>' + escapeHtml(smState.commitCounter + ' commit(s), ' + totalEmployees + ' employee calculation(s), net pay ' + safeFormatCurrency(totalNet) + '.') + '</span>';
        html += '<span>Rollback returns this period to its pre-commit calculation state. Proceed to Submission to generate and submit the Revenue payload.</span></div>';
        html += '<div class="post-commit-actions">';
        html += '<button type="button" class="btn btn-warning btn-sm" id="post-commit-rollback-btn">Rollback Commit</button>';
        html += '<button type="button" class="btn btn-success btn-sm" id="post-commit-submit-btn">Proceed to Submission</button>';
        if (latestRunId) {
            html += '<button type="button" class="btn btn-secondary btn-sm" id="post-commit-history-btn" data-run-id="' + escapeHtml(latestRunId) + '">Open in History</button>';
        }
        html += '</div></div>';
        return html;
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
            var fortnightlyNextDue = PayrollStateMachine.getNextFortnightlyDueWeek
                ? PayrollStateMachine.getNextFortnightlyDueWeek(currentWeek, smState.fortnightly ? smState.fortnightly.lastCommittedWeek : 0)
                : 24;
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
        var weekInput = document.getElementById('payroll-week-number');
        var currentWeek = weekInput ? (parseInt(weekInput.value, 10) || 1) : (state.weekNumber || 1);

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
                    var annualCutOff = ledgerEntry.cutOffPoint || getEmployeeCutOffPoint(emp);
                    var annualTC = ledgerEntry.annualTaxCredits || getEmployeeAnnualTaxCredits(emp);
                    var payeResult = calculatePAYE(emp, taxableGross, emp.weeksOnEmergency || 0, totalPeriodsInYear);
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
                        payeMode: payeResult.mode,
                        payeSource: payeResult.source,
                        copUsed: payeResult.copUsed,
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
        const periodStateBeforeCommit = JSON.parse(JSON.stringify(PayrollStateMachine.getState()));
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
            periodStateBeforeCommit: periodStateBeforeCommit,
            employeeEmergencySnapshots: employeeEmergencySnapshots,
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
                    payeMode: e.payeMode || '',
                    payeSource: e.payeSource || '',
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
            updateEmergencyTrackingAfterRun(run);
            upsertSubmissionFromRun(run, 'READY');

            // Advance per-frequency period counters via state machine API
            PayrollStateMachine.advanceFrequencyCounters(run.frequenciesIncluded || [], run.weekNumber);

            const smState = PayrollStateMachine.getState();
            currentRunData = null;
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
        const employees = PayrollStorage.loadEmployees(currentCompanyId) || [];
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
            PayrollStorage.saveEmployees(currentCompanyId, employees);
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
                var allRuns = PayrollStorage.loadPayrollRuns(currentCompanyId) || [];
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

                restoreEmergencyTrackingSnapshot(rolledBackRun);

                showMessage('Last commit rolled back successfully.', 'success');
                currentRunData = null;
                syncAllTables();
                showRunPayroll();
            } else {
                showMessage('Failed to rollback.', 'error');
            }
        }

        if (skipConfirm) {
            performRollbackAction();
        } else {
            showConfirmModal('Undo last commit? This will remove the most recent committed payroll run.', performRollbackAction);
        }
    }

    function restoreEmergencyTrackingSnapshot(run) {
        if (!run || !run.employeeEmergencySnapshots) return;
        const employees = PayrollStorage.loadEmployees(currentCompanyId) || [];
        let changed = false;
        employees.forEach(function(emp) {
            const snapshot = run.employeeEmergencySnapshots[emp.id];
            if (!snapshot) return;
            emp.weeksOnEmergency = snapshot.weeksOnEmergency || 0;
            emp.emergencyStartDate = snapshot.emergencyStartDate || '';
            changed = true;
        });
        if (changed) {
            PayrollStorage.saveEmployees(currentCompanyId, employees);
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
            currentRunData = null;
            syncAllTables();
            showRunPayroll();
        }

        if (skipConfirm) {
            performSubmitAction();
        } else {
            showConfirmModal(message, performSubmitAction);
        }
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
        const submissionPanel = document.getElementById('panel-submission');
        if (submissionPanel && submissionPanel.classList.contains('active')) {
            renderSubmission();
        }
    }

    function getCurrentCompany() {
        const companies = PayrollStorage.loadCompanies() || [];
        return companies.find(function(company) { return company.id === currentCompanyId; }) || null;
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
        if (!currentCompanyId || !run) return null;
        const submissions = PayrollStorage.loadSubmissions(currentCompanyId) || [];
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
        PayrollStorage.saveSubmissions(currentCompanyId, submissions);
        return existingIndex >= 0 ? submissions[existingIndex] : payload;
    }

    function getLatestSubmissionRun() {
        const runs = PayrollStorage.loadPayrollRuns(currentCompanyId) || [];
        const pending = runs.filter(function(run) { return run.status === 'committed'; });
        const source = pending.length > 0 ? pending : runs;
        source.sort(function(a, b) { return new Date(b.runDate) - new Date(a.runDate); });
        return source[0] || null;
    }

    function getLatestSubmissionRecord() {
        const submissions = PayrollStorage.loadSubmissions(currentCompanyId) || [];
        submissions.sort(function(a, b) { return new Date(b.timestamp || b.submittedAt || 0) - new Date(a.timestamp || a.submittedAt || 0); });
        return submissions[0] || null;
    }

    function renderSubmission() {
        const list = document.getElementById('submission-list');
        const output = document.getElementById('submission-form-output');
        if (!list) return;
        if (!currentCompanyId) {
            list.innerHTML = '<div class="empty-state">Select a company to view submissions.</div>';
            if (output) output.classList.add('hidden');
            return;
        }
        const submissions = PayrollStorage.loadSubmissions(currentCompanyId) || [];
        submissions.sort(function(a, b) { return new Date(b.timestamp || b.submittedAt || 0) - new Date(a.timestamp || a.submittedAt || 0); });
        if (submissions.length === 0) {
            list.innerHTML = '<div class="empty-state">No submissions yet. Commit payroll to prepare a submission.</div>';
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

    function submitSubmissionToRevenue() {
        let payload = getLatestSubmissionRecord();
        if (!payload || payload.status !== 'ACCEPTED') {
            payload = generateSubmissionPayload();
        }
        if (!payload) return;
        submitPeriod(true);
        renderSubmission();
    }

    function formatLocalDateTime(value) {
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
        if (!currentCompanyId) {
            showMessage('Select a company before retrieving RPN.', 'error');
            return;
        }

        const employees = PayrollStorage.loadEmployees(currentCompanyId) || [];
        if (employees.length === 0) {
            showMessage('No employees found. Add employees before retrieving RPN.', 'error');
            return;
        }

        const company = PayrollStorage.getCompany(currentCompanyId) || {};
        const originalText = button ? button.textContent : '';
        if (button) {
            button.disabled = true;
            button.textContent = 'Retrieving...';
        }

        try {
            const response = await fetch(RPN_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employerRegistrationNumber: getCompanyTaxNumber(company) || '1234567T',
                    taxYear: parseInt(company.taxYear || selectedYear, 10) || 2026,
                    employees: employees.map(function(emp) {
                        return {
                            ppsn: emp.ppsNumber || '',
                            employmentId: emp.id,
                            employmentCommencementDate: emp.startDate || emp.employmentCommencementDate || ''
                        };
                    })
                })
            });

            if (!response.ok) {
                throw new Error('Server returned HTTP ' + response.status);
            }

            const payload = await response.json();
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

            if (!PayrollStorage.saveEmployees(currentCompanyId, employees)) {
                throw new Error('Failed to save retrieved RPN data');
            }

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
                showConfirmModal('Retrieve RPN from the fake Revenue server? This will update all employee RPN fields using http://localhost:3001/rpn.', function() {
                    retrieveRPNFromRevenueServer(retrieveBtn);
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

    function computeYTD(employeeId, taxYear, currentRunId) {
        var runs = PayrollStorage.loadPayrollRuns(currentCompanyId) || [];
        var ytd = {
            grossPay: 0,
            paye: 0,
            usc: 0,
            prsi: 0,
            employerPrsi: 0,
            totalDeductions: 0,
            taxCreditsUsed: 0,
            prsiWeeks: 0,
            pensionDeductions: 0,
            bikAmount: 0
        };

        runs.forEach(function(r) {
            if (r.taxYear !== taxYear) return;
            if (r.id === currentRunId) return;
            (r.entries || []).forEach(function(e) {
                if (e.employeeId !== employeeId) return;
                ytd.grossPay += e.grossPay || 0;
                ytd.paye += e.paye || 0;
                ytd.usc += e.usc || 0;
                ytd.prsi += e.prsi || 0;
                ytd.employerPrsi += e.employerPrsi || 0;
                ytd.totalDeductions += e.totalDeductions || 0;
                ytd.taxCreditsUsed += e.taxCreditsUsed || 0;
                ytd.prsiWeeks += 1;
                ytd.pensionDeductions += e.pensionDeduction || 0;
                ytd.bikAmount += e.bikAmount || 0;
            });
        });

        return ytd;
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

        const frequency = entry.payFrequency || (run ? run.frequency : activeTab);
        const freqDivisor = frequency === 'weekly' ? 52 : frequency === 'fortnightly' ? 26 : 12;
        const freqLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);
        const runDate = run ? new Date(run.runDate) : new Date();
        const taxYear = run ? run.taxYear : selectedYear;
        const periodNumber = (run && run.periodNumber) ? run.periodNumber :
            (function() {
                var sm = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.getState() : null;
                if (sm && sm[frequency]) return sm[frequency].periodNumber || 1;
                if (sm && sm.currentPeriodNumber) return sm.currentPeriodNumber;
                return 1;
            })();

        const rpn = entry.rpnSnapshot || (employee && employee.rpn) || {};
        const annualTC = entry.payeMode && entry.payeMode.indexOf('EMERGENCY') === 0 ? ((rpn.taxCredits || 0)) : (rpn.taxCredits || getEmployeeAnnualTaxCredits(employee));
        const annualCOP = entry.payeMode && entry.payeMode.indexOf('EMERGENCY') === 0 ? ((rpn.cutOffPoint || 0)) : (rpn.cutOffPoint || getEmployeeCutOffPoint(employee));
        const periodTC = rpn.periodicTaxCredit !== undefined ? (parseFloat(rpn.periodicTaxCredit) || 0) : (annualTC / freqDivisor);
        const periodCOP = rpn.periodicStandardRateCutOffPoint !== undefined ? (parseFloat(rpn.periodicStandardRateCutOffPoint) || 0) : (annualCOP / freqDivisor);
        const appliedTC = entry.taxCreditsUsed || 0;
        const prsiClass = rpn.prsiClass || (employee ? employee.prsiClass : '') || 'A1';
        const payeModeLabel = entry.payeSource || (entry.payeMode || 'Cumulative');

        const pensionDeduction = entry.pensionDeduction || 0;
        const bikAmount = entry.bikAmount || 0;
        const grossPayForPAYE = (entry.grossPay || 0) - pensionDeduction + bikAmount;
        const ytd = computeYTD(entry.employeeId, taxYear, run ? run.id : null);
        const ytdGross = ytd.grossPay + (entry.grossPay || 0);
        const ytdPaye = ytd.paye + (entry.paye || 0);
        const ytdUsc = ytd.usc + (entry.usc || 0);
        const ytdPrsi = ytd.prsi + (entry.prsi || 0);
        const ytdEmployerPrsi = ytd.employerPrsi + (entry.employerPrsi || 0);
        const ytdPension = ytd.pensionDeductions + pensionDeduction;
        const ytdBik = ytd.bikAmount + bikAmount;
        const ytdPreTax = ytdPension;
        const ytdTaxablePay = ytdGross - ytdPension + ytdBik;
        const prsiWeeksToDate = ytd.prsiWeeks + 1;
        const ytdTaxCredits = ytd.taxCreditsUsed + (entry.taxCreditsUsed || 0);
        const thisPeriodTotalDed = entry.totalDeductions || ((entry.paye || 0) + (entry.usc || 0) + (entry.prsi || 0) + pensionDeduction);
        const ytdTotalDed = ytd.totalDeductions + thisPeriodTotalDed;
        const displayNetPay = typeof entry.netPay === 'number' ? entry.netPay : (entry.grossPay || 0) - thisPeriodTotalDed;

        var ledgerCopUsed = 0;
        try {
            initOrSyncLedger(currentCompanyId, taxYear);
            var ledger = PayrollStorage.loadTaxCreditsLedger(currentCompanyId);
            if (ledger && ledger[entry.employeeId] && ledger[entry.employeeId][taxYear]) {
                ledgerCopUsed = ledger[entry.employeeId][taxYear].copUsed || 0;
            }
        } catch (e) {
            ledgerCopUsed = 0;
        }

        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const dateFormatted = String(runDate.getDate()).padStart(2, '0') + '-' + months[runDate.getMonth()] + '-' + String(runDate.getFullYear()).slice(-2);
        const payPeriodCode = String(taxYear) + String(periodNumber).padStart(2, '0');
        const regularHours = entry.regularHours || 0;
        const overtimeHours = entry.overtimeHours || 0;
        const hourlyRate = entry.hourlyRate || 0;
        const overtimeMultiplier = entry.overtimeMultiplier || 1.5;
        const regularGross = entry.regularGross || 0;
        const overtimeGross = entry.overtimeGross || 0;

        let html = '<div class="payslip-document">';

        const ctx = currentPayslipContext;
        const canPrev = ctx && ctx.currentIndex > 0;
        const canNext = ctx && ctx.entries && ctx.currentIndex < ctx.entries.length - 1;
        html += '<div class="payslip-nav">';
        html += '<button type="button" class="btn btn-secondary payslip-nav-btn" id="payslip-prev"' + (canPrev ? '' : ' disabled') + ' title="Previous Employee">&larr; Previous</button>';
        html += '<button type="button" class="btn btn-secondary payslip-nav-btn" id="payslip-back" title="Back">Back</button>';
        html += '<button type="button" class="btn btn-secondary payslip-nav-btn" id="payslip-next"' + (canNext ? '' : ' disabled') + ' title="Next Employee">Next &rarr;</button>';
        html += '</div>';

        html += '<div class="ips-payslip">';
        html += '<div class="ips-header">';
        html += '<div class="ips-header-left">';
        html += '<div class="ips-employee-name">' + escapeHtml(entry.employeeName) + '</div>';
        html += '<div class="ips-employee-pps">PPS: ' + escapeHtml(employee ? employee.ppsNumber : '') + '</div>';
        html += '</div>';
        const companyTaxNumber = getCompanyTaxNumber(company) || getEmployerRegistrationNumber();
        html += '<div class="ips-header-right">';
        html += '<div class="ips-company-name">' + escapeHtml(company.name || 'Company Name') + '</div>';
        if (company.address) html += '<div class="ips-company-detail">' + escapeHtml(company.address) + '</div>';
        if (companyTaxNumber) html += '<div class="ips-company-detail">Employer number: ' + escapeHtml(companyTaxNumber) + '</div>';
        if (companyTaxNumber) html += '<div class="ips-company-detail">Reg No: ' + escapeHtml(companyTaxNumber) + '</div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="ips-meta-row">';
        html += '<span>Payslip Date: <strong>' + escapeHtml(dateFormatted) + '</strong></span>';
        html += '<span>Pay Period: <strong>' + escapeHtml(payPeriodCode) + '</strong></span>';
        html += '<span>Personnel No: <strong>' + escapeHtml(employee ? employee.id.slice(0, 8) : '') + '</strong></span>';
        html += '</div>';

        html += '<div class="ips-section-title">Tax / PRSI Details</div>';
        html += '<div class="ips-details-grid">';
        html += '<div class="ips-kv"><span>Rate Current</span><span>' + safeFormatCurrency(entry.grossPay) + '</span></div>';
        html += '<div class="ips-kv"><span>Annual Cut Off</span><span>' + safeFormatCurrency(annualCOP) + '</span></div>';
        html += '<div class="ips-kv"><span>Annual Tax Credit</span><span>' + safeFormatCurrency(annualTC) + '</span></div>';
        html += '<div class="ips-kv"><span>PRSI Weeks</span><span>1</span></div>';
        html += '<div class="ips-kv"><span>PRSI Class</span><span>' + escapeHtml(prsiClass) + '</span></div>';
        html += '<div class="ips-kv"><span>Tax Basis</span><span>' + escapeHtml(payeModeLabel) + '</span></div>';
        html += '<div class="ips-kv"><span>This Period Tax Credit</span><span>' + safeFormatCurrency(periodTC) + '</span></div>';
        html += '<div class="ips-kv"><span>This Period Cut Off</span><span>' + safeFormatCurrency(periodCOP) + '</span></div>';
        html += '</div>';

        html += '<div class="ips-section-title">Cumulatives (Year-to-Date)</div>';
        html += '<div class="ips-ytd-grid">';
        html += '<div class="ips-kv"><span>Gross Earnings</span><span>' + safeFormatCurrency(ytdGross) + '</span></div>';
        html += '<div class="ips-kv"><span>Pre Tax Deductions</span><span>' + safeFormatCurrency(ytdPreTax) + '</span></div>';
        html += '<div class="ips-kv"><span>Taxable Pay</span><span>' + safeFormatCurrency(ytdTaxablePay) + '</span></div>';
        html += '<div class="ips-kv"><span>LPT</span><span>' + safeFormatCurrency(0) + '</span></div>';
        html += '<div class="ips-kv"><span>Cut Off</span><span>' + safeFormatCurrency(ledgerCopUsed || (periodCOP * prsiWeeksToDate)) + '</span></div>';
        html += '<div class="ips-kv"><span>Tax (PAYE)</span><span>' + safeFormatCurrency(ytdPaye) + '</span></div>';
        html += '<div class="ips-kv"><span>Tax Credit</span><span>' + safeFormatCurrency(ytdTaxCredits) + '</span></div>';
        html += '<div class="ips-kv"><span>PRSI Weeks-to-date</span><span>' + prsiWeeksToDate + '</span></div>';
        html += '<div class="ips-kv"><span>USC</span><span>' + safeFormatCurrency(ytdUsc) + '</span></div>';
        html += '<div class="ips-kv"><span>Employee PRSI</span><span>' + safeFormatCurrency(ytdPrsi) + '</span></div>';
        html += '<div class="ips-kv"><span>Employer PRSI</span><span>' + safeFormatCurrency(ytdEmployerPrsi) + '</span></div>';
        html += '</div>';

        html += '<div class="ips-section-title">Gross Earnings</div>';
        html += '<table class="ips-table">';
        html += '<thead><tr><th>Description</th><th class="text-right">Hours</th><th class="text-right">Rate</th><th class="text-right">Value</th></tr></thead>';
        html += '<tbody>';
        if (entry.payType === 'hourly') {
            html += '<tr><td>Basic Pay</td><td class="text-right">' + escapeHtml(String(regularHours)) + '</td><td class="text-right">' + safeFormatCurrency(hourlyRate) + '</td><td class="text-right">' + safeFormatCurrency(regularGross) + '</td></tr>';
            if (overtimeHours > 0) {
                html += '<tr><td>Overtime (&times;' + escapeHtml(String(overtimeMultiplier)) + ')</td><td class="text-right">' + escapeHtml(String(overtimeHours)) + '</td><td class="text-right">' + safeFormatCurrency(hourlyRate * overtimeMultiplier) + '</td><td class="text-right">' + safeFormatCurrency(overtimeGross) + '</td></tr>';
            }
        } else {
            html += '<tr><td>Basic Pay/Salary</td><td class="text-right"></td><td class="text-right"></td><td class="text-right">' + safeFormatCurrency(regularGross || entry.grossPay) + '</td></tr>';
            if (overtimeHours > 0) {
                html += '<tr><td>Overtime (&times;' + escapeHtml(String(overtimeMultiplier)) + ')</td><td class="text-right">' + escapeHtml(String(overtimeHours)) + '</td><td class="text-right">' + safeFormatCurrency(hourlyRate * overtimeMultiplier) + '</td><td class="text-right">' + safeFormatCurrency(overtimeGross) + '</td></tr>';
            }
        }
        html += '</tbody><tfoot>';
        html += '<tr class="ips-total"><td colspan="3">Total Pay</td><td class="text-right">' + safeFormatCurrency(entry.grossPay) + '</td></tr>';
        if (pensionDeduction > 0 || bikAmount > 0) {
            html += '<tr class="ips-subtotal"><td colspan="3">Gross Pay for PAYE</td><td class="text-right">' + safeFormatCurrency(grossPayForPAYE) + '</td></tr>';
        }
        html += '</tfoot></table>';

        html += '<div class="ips-section-title">Deductions</div>';
        html += '<table class="ips-table">';
        html += '<thead><tr><th>Description</th><th class="text-right">This Period</th><th class="text-right">Year to Date</th></tr></thead>';
        html += '<tbody>';
        html += '<tr><td>USC</td><td class="text-right">' + safeFormatCurrency(entry.usc) + '</td><td class="text-right">' + safeFormatCurrency(ytdUsc) + '</td></tr>';
        html += '<tr><td>PAYE</td><td class="text-right">' + safeFormatCurrency(entry.paye) + '</td><td class="text-right">' + safeFormatCurrency(ytdPaye) + '</td></tr>';
        html += '<tr><td>PRSI</td><td class="text-right">' + safeFormatCurrency(entry.prsi) + '</td><td class="text-right">' + safeFormatCurrency(ytdPrsi) + '</td></tr>';
        if (pensionDeduction > 0) {
            html += '<tr><td>Personal Pension</td><td class="text-right">' + safeFormatCurrency(pensionDeduction) + '</td><td class="text-right">' + safeFormatCurrency(ytdPension) + '</td></tr>';
        }
        html += '</tbody><tfoot>';
        html += '<tr class="ips-total"><td>Total Deductions</td><td class="text-right">' + safeFormatCurrency(thisPeriodTotalDed) + '</td><td class="text-right">' + safeFormatCurrency(ytdTotalDed) + '</td></tr>';
        html += '</tfoot></table>';

        html += '<div class="ips-net-pay">';
        html += '<span>Net Pay</span>';
        html += '<span class="ips-net-amount">EUR ' + safeFormatCurrency(displayNetPay) + '</span>';
        html += '</div>';
        html += '</div>';

        html += '<div class="payslip-actions">';
        html += '<button type="button" class="btn btn-secondary" id="payslip-back-btn">Back</button>';
        html += '<button type="button" class="btn btn-secondary" id="payslip-print-btn">Print</button>';
        html += '<button type="button" class="btn btn-secondary" id="payslip-export-csv-btn">Export CSV</button>';
        html += '</div>';

        html += '<div class="ips-calc-toggle">';
        html += '<button type="button" class="btn btn-secondary" id="payslip-toggle-calc">Show Calculation Details</button>';
        html += '</div>';
        html += '<div class="ips-calc-breakdown" id="payslip-calc-panel" style="display:none;">';
        html += '<h3>Calculation Breakdown</h3>';
        html += renderBreakdownSteps(buildBreakdownSteps(entry, employee, calcResult, {
            annualTC: annualTC,
            periodTC: periodTC,
            appliedTC: appliedTC,
            freqLabel: freqLabel,
            freqDivisor: freqDivisor
        }));
        html += '</div>';

        html += '</div>';

        container.innerHTML = html;

        // Event listeners. Some controls are optional because older payslip
        // layouts and the current compact layout expose different action bars.
        const bottomBackBtn = document.getElementById('payslip-back-btn');
        const printBtn = document.getElementById('payslip-print-btn');
        const exportCsvBtn = document.getElementById('payslip-export-csv-btn');
        const toggleCalcBtn = document.getElementById('payslip-toggle-calc');

        if (bottomBackBtn) {
            bottomBackBtn.addEventListener('click', function() {
                switchTab(payslipReturnTab);
            });
        }
        if (printBtn) {
            printBtn.addEventListener('click', printPayslip);
        }
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', function() {
                exportPayslipCSV(entry, run || { payPeriodLabel: (run ? run.payPeriodLabel : generatePeriodLabel()), runDate: runDate.toISOString(), taxYear: taxYear, id: null });
            });
        }

        if (toggleCalcBtn) {
            toggleCalcBtn.addEventListener('click', function() {
                var panel = document.getElementById('payslip-calc-panel');
                if (!panel) return;
                if (panel.style.display === 'none') {
                    panel.style.display = 'block';
                    this.textContent = 'Hide Calculation Details';
                } else {
                    panel.style.display = 'none';
                    this.textContent = 'Show Calculation Details';
                }
            });
        }

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
                if (e.target.closest && e.target.closest('.btn-view-payslip')) return;
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
