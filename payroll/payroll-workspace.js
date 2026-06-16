// payroll/payroll-workspace.js — Enter/exit company workspace

var PayrollWorkspace = (function() {
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

    function enterCompany(companyId) {
        const company = PayrollStorage.getCompany(companyId);
        const slotIndex = PayrollCompanies.getCompanySlotIndex(companyId);

        if (typeof PayrollMode !== 'undefined' && PayrollMode.needsModeSelection(company, slotIndex)) {
            PayrollModeUI.promptInitialModeSelection(companyId, function() {
                enterCompanyWorkspace(companyId);
            });
            return;
        }

        enterCompanyWorkspace(companyId);
    }

    function enterCompanyWorkspace(companyId) {
        PayrollContext.currentCompanyId = companyId;
        PayrollStorage.setActiveCompanyId(companyId);

        const company = PayrollStorage.getCompany(companyId);
        if (company) {
            callDep('setSelectedYear', company.taxYear || '2026');
            callDep('setActiveTab', company.payFrequency || 'monthly');
            const periodVar = 'selected' + (company.taxYear || '2026') + 'Period';
            if (typeof window[periodVar] !== 'undefined') {
                window[periodVar] = company.taxPeriod || 'jan-sep';
            }
            if (typeof updateTaxRatesForYear === 'function') {
                updateTaxRatesForYear(company.taxYear || '2026');
            }
        }

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
                            annualTaxCredits: PayrollTax.getEmployeeAnnualTaxCredits(emp || { familyStatus: famStatus }),
                            taxCreditsUsed: 0,
                            remaining: 0,
                            cutOffPoint: PayrollTax.getEmployeeCutOffPoint(emp || { familyStatus: famStatus }),
                            copUsed: 0,
                            copRemaining: 0,
                            source: PayrollTax.getEmployeeTaxSource(emp || { familyStatus: famStatus }),
                            lastUpdated: new Date().toISOString()
                        };
                    }
                    migrationLedger[entry.employeeId][runYear].taxCreditsUsed += (entry.taxCreditsUsed || 0);
                    migrationLedger[entry.employeeId][runYear].copUsed += (entry.grossPay || 0);
                });
            });
            Object.keys(migrationLedger).forEach(function(empId) {
                Object.keys(migrationLedger[empId]).forEach(function(yr) {
                    var e = migrationLedger[empId][yr];
                    e.remaining = e.annualTaxCredits - e.taxCreditsUsed;
                    e.copRemaining = e.cutOffPoint - e.copUsed;
                });
            });
            PayrollStorage.saveTaxCreditsLedger(companyId, migrationLedger);
        }

        var periodState = PayrollStorage.loadPeriodState(companyId);
        if (periodState && periodState.currentPeriodNumber && !periodState.weekNumber) {
            periodState.weekNumber = periodState.currentPeriodNumber;

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

            if (!periodState.weekly) periodState.weekly = {};
            periodState.weekly.periodNumber = weeklyCount + 1;

            if (!periodState.fortnightly) periodState.fortnightly = {};
            periodState.fortnightly.periodNumber = fortnightlyCount + 1;
            periodState.fortnightly.lastCommittedWeek = lastFortnightlyWeek;

            if (!periodState.monthly) periodState.monthly = {};
            periodState.monthly.periodNumber = monthlyCount + 1;
            periodState.monthly.lastCommittedWeek = lastMonthlyWeek;

            PayrollStorage.savePeriodState(companyId, periodState);
        }

        const dashboardPanel = document.getElementById('panel-dashboard');
        if (dashboardPanel) dashboardPanel.classList.remove('active');

        const workspaceHeader = document.getElementById('company-workspace-header');
        if (workspaceHeader) workspaceHeader.classList.remove('hidden');

        const companyNameEl = document.getElementById('workspace-company-name');
        if (companyNameEl) companyNameEl.textContent = company ? company.name : '';

        const companyNumberEl = document.getElementById('workspace-company-number');
        if (companyNumberEl) {
            const companyNumber = PayrollCompanies.getCompanyTaxNumber(company) || PayrollCompanies.getEmployerRegistrationNumber();
            companyNumberEl.textContent = companyNumber ? 'Company number: ' + companyNumber : '';
        }

        const workspaceNav = document.getElementById('workspace-nav');
        if (workspaceNav) workspaceNav.classList.remove('hidden');

        workspaceNav.querySelectorAll('.tab-btn').forEach(function(btn) {
            btn.onclick = function() {
                callDep('switchTab', btn.dataset.tab);
            };
        });

        if (typeof PayrollEmployees !== 'undefined' && PayrollEmployees.init) {
            PayrollEmployees.init(companyId);
        }

        if (typeof PayrollStateMachine !== 'undefined' && PayrollStateMachine.init) {
            PayrollStateMachine.init(companyId);
        }

        PayrollModeUI.applyModeToUI();
        PayrollModeUI.bindPayrollModeControls();

        callDep('switchTab', 'employees');
        callDep('renderHistory');
    }

    function exitCompany() {
        PayrollContext.currentCompanyId = null;

        const workspaceHeader = document.getElementById('company-workspace-header');
        if (workspaceHeader) workspaceHeader.classList.add('hidden');

        const workspaceNav = document.getElementById('workspace-nav');
        if (workspaceNav) workspaceNav.classList.add('hidden');

        document.querySelectorAll('.tab-panel').forEach(function(panel) {
            panel.classList.remove('active');
        });

        const dashboardPanel = document.getElementById('panel-dashboard');
        if (dashboardPanel) dashboardPanel.classList.add('active');

        PayrollCompanies.renderCompanyList();
    }

    return {
        init: init,
        enterCompany: enterCompany,
        enterCompanyWorkspace: enterCompanyWorkspace,
        exitCompany: exitCompany
    };
})();