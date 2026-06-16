// payroll/payroll.js — Core Payroll App Orchestration (facade)
// Depends on: calculator-core.js, storage.js, employees.js, extracted modules

const PayrollApp = (function() {
    'use strict';

    function getPayrollStateSafe() {
        if (typeof PayrollStateMachine !== 'undefined' && PayrollStateMachine.getState) {
            return PayrollStateMachine.getState();
        }
        return {
            weekNumber: 1,
            weekly: { periodNumber: 1 },
            fortnightly: { periodNumber: 1, lastCommittedWeek: 0 },
            monthly: { periodNumber: 1, lastCommittedWeek: 0 },
            currentPeriodNumber: 1,
            commitCounter: 0,
            status: 'open',
            committedRunIds: [],
            rpnRetrievedForPeriod: false
        };
    }

    function init() {
        if (typeof tabConfig !== 'undefined') {
            Object.keys(tabConfig).forEach(function(key) {
                if (!tabConfig[key].multiplier && tabConfig[key].periods) {
                    tabConfig[key].multiplier = tabConfig[key].periods;
                }
            });
        }

        const backToCompanies = document.getElementById('back-to-companies');
        if (backToCompanies) {
            backToCompanies.addEventListener('click', function(e) {
                e.preventDefault();
                PayrollWorkspace.exitCompany();
            });
        }

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

        PayrollModeUI.bindPayrollModeControls();

        const headerHelpLink = document.getElementById('header-help-link');
        if (headerHelpLink) {
            headerHelpLink.addEventListener('click', function(e) {
                e.preventDefault();
                switchTab('help');
            });
        }

        document.addEventListener('click', handleRunPayrollActionClick);

        PayrollCompanies.renderCompanyList();
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
            PayrollSubmission.generateSubmissionPayload();
        } else if (target.id === 'submit-revenue-btn') {
            event.preventDefault();
            PayrollSubmission.submitSubmissionToRevenue();
        } else if (target.id === 'calc-preview-btn') {
            event.preventDefault();
            calculateTimesheetPreview();
        } else if (target.id === 'commit-payroll-btn') {
            event.preventDefault();
            confirmAndSaveRun();
        }
    }

    function switchTab(tabName) {
        if (tabName === 'help') {
            const workspaceNav = document.getElementById('workspace-nav');
            if (workspaceNav && !workspaceNav.classList.contains('hidden')) {
                workspaceNav.querySelectorAll('.tab-btn').forEach(function(btn) {
                    btn.classList.toggle('active', btn.dataset.tab === 'help');
                });
            }

            document.querySelectorAll('.tab-panel').forEach(function(panel) {
                panel.classList.toggle('active', panel.id === 'panel-help');
            });
            PayrollHelp.renderHelp();
            return;
        }

        if (PayrollTax.isLocalMode() && (tabName === 'rpn' || tabName === 'submission')) {
            tabName = 'employees';
        }

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
            PayrollRPN.renderRPNOverview();
        } else if (tabName === 'submission') {
            PayrollSubmission.renderSubmission();
        } else if (tabName === 'history') {
            renderHistory();
        }
    }

    function syncAllTables() {
        const historyPanel = document.getElementById('panel-history');
        if (historyPanel && historyPanel.classList.contains('active')) {
            renderHistory();
        }
        const tcPanel = document.getElementById('panel-taxcredits');
        if (tcPanel && tcPanel.classList.contains('active')) {
            renderTaxCreditsTable();
        }
        const rpnPanel = document.getElementById('panel-rpn');
        if (rpnPanel && rpnPanel.classList.contains('active')) {
            PayrollRPN.renderRPNOverview();
        }
        const submissionPanel = document.getElementById('panel-submission');
        if (submissionPanel && submissionPanel.classList.contains('active')) {
            PayrollSubmission.renderSubmission();
        }
    }

    // --- Run Payroll (delegated to PayrollRun) ---
    function showRunPayroll() { return PayrollRun.showRunPayroll(); }
    function calculatePayroll() { return PayrollRun.calculatePayroll(); }
    function calculateTimesheetPreview() { return PayrollRun.calculateTimesheetPreview(); }
    function calculateEstGross(emp, regularHours, overtimeHours, hourlyRate) { return PayrollRun.calculateEstGross(emp, regularHours, overtimeHours, hourlyRate); }
    function confirmAndSaveRun() { return PayrollRun.confirmAndSaveRun(); }
    function rollbackLastCommit(skipConfirm) { return PayrollRun.rollbackLastCommit(skipConfirm); }
    function submitPeriod(skipConfirm) { return PayrollRun.submitPeriod(skipConfirm); }
    function openCommittedRunInHistory(runId) { return PayrollRun.openCommittedRunInHistory(runId); }
    function closeActionModal() { return PayrollRun.closeActionModal(); }
    function buildPayrollPreviewDataFromRun(run) { return PayrollRun.buildPayrollPreviewDataFromRun(run); }
    function buildPayrollPreviewHtml(runData, options) { return PayrollRun.buildPayrollPreviewHtml(runData, options); }
    function bindPayrollPreviewPayslipRows(previewDiv) { return PayrollRun.bindPayrollPreviewPayslipRows(previewDiv); }

    // --- Payslips (delegated to PayrollPayslip) ---
    function showPayslip(runId, employeeId) { return PayrollPayslip.showPayslip(runId, employeeId); }
    function showPayslipFromEntry(entry, run, entries, currentIndex) { return PayrollPayslip.showPayslipFromEntry(entry, run, entries, currentIndex); }
    function renderEmployeeCardPayslipPanel(entry, run, employeeId, periodNumber) { return PayrollPayslip.renderEmployeeCardPayslipPanel(entry, run, employeeId, periodNumber); }
    function clearEmployeeCardPayslipPanel() { return PayrollPayslip.clearEmployeeCardPayslipPanel(); }
    function printPayslip() { return PayrollPayslip.printPayslip(); }
    function buildBreakdownSteps(entry, employee, calcResult, opts) { return PayrollPayslip.buildBreakdownSteps(entry, employee, calcResult, opts); }
    function renderBreakdownSteps(steps) { return PayrollPayslip.renderBreakdownSteps(steps); }

    // --- Exports & History (delegated to extracted modules) ---
    function exportRunCSV(run) {
        if (typeof PayrollExports !== 'undefined') PayrollExports.exportRunCSV(run);
    }

    function exportRunExcel(run) {
        if (typeof PayrollExports !== 'undefined') PayrollExports.exportRunExcel(run);
    }

    function exportPayslipCSV(entry, run) {
        if (typeof PayrollExports !== 'undefined') PayrollExports.exportPayslipCSV(entry, run);
    }

    function renderTaxCreditsTable() {
        if (typeof PayrollHistory !== 'undefined') PayrollHistory.renderTaxCreditsTable();
    }

    function renderHistory() {
        if (typeof PayrollHistory !== 'undefined') PayrollHistory.renderHistory();
    }

    function expandHistoryItem(runId) {
        if (typeof PayrollHistory !== 'undefined') PayrollHistory.expandHistoryItem(runId);
    }

    function deleteRun(runId) {
        if (typeof PayrollHistory !== 'undefined') PayrollHistory.deleteRun(runId);
    }

    // --- Backup ---
    function handleExportBackup() {
        PayrollStorage.exportBackup();
        PayrollUI.showMessage('Backup exported.', 'success');
    }

    function handleImportBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        PayrollStorage.importBackup(file)
            .then(function() {
                PayrollUI.showMessage('Backup imported successfully. Please select a company to continue.', 'success');
                PayrollWorkspace.exitCompany();
                PayrollCompanies.renderCompanyList();
                event.target.value = '';
            })
            .catch(function(err) {
                PayrollUI.showMessage('Import failed: ' + err, 'error');
                event.target.value = '';
            });
    }

    function wireExtractedModules() {
        PayrollUtils.init({
            getSelectedYear: function() { return selectedYear; },
            getActiveTab: function() { return activeTab; }
        });

        PayrollTax.init({
            getSelectedYear: function() { return selectedYear; },
            getCurrentCompany: function() { return PayrollCompanies.getCurrentCompany(); }
        });

        PayrollPAYE.init({
            getSelectedYear: function() { return selectedYear; }
        });

        PayrollModeUI.init({
            getSelectedYear: function() { return selectedYear; },
            switchTab: switchTab,
            syncAllTables: syncAllTables,
            initOrSyncLedger: function(companyId, year) { return PayrollTax.initOrSyncLedger(companyId, year); }
        });

        PayrollCompanies.init({
            enterCompany: function(companyId) { PayrollWorkspace.enterCompany(companyId); }
        });

        PayrollWorkspace.init({
            setSelectedYear: function(year) { selectedYear = year; },
            setActiveTab: function(tab) { activeTab = tab; },
            switchTab: switchTab,
            renderHistory: renderHistory
        });

        PayrollSubmission.init({
            getSelectedYear: function() { return selectedYear; },
            submitPeriod: submitPeriod
        });

        PayrollRPN.init({
            getSelectedYear: function() { return selectedYear; },
            switchTab: switchTab,
            syncAllTables: syncAllTables
        });

        if (typeof PayrollExports !== 'undefined') {
            PayrollExports.init({
                getCurrentRunData: function() { return PayrollContext.currentRunData; }
            });
        }

        if (typeof PayrollPayslip !== 'undefined') {
            PayrollPayslip.init({
                getEmployeeAnnualTaxCredits: PayrollTax.getEmployeeAnnualTaxCredits,
                getEmployeeCutOffPoint: PayrollTax.getEmployeeCutOffPoint,
                initOrSyncLedger: PayrollTax.initOrSyncLedger,
                getCompanyTaxNumber: PayrollCompanies.getCompanyTaxNumber,
                getEmployerRegistrationNumber: PayrollCompanies.getEmployerRegistrationNumber,
                generatePeriodLabel: PayrollUtils.generatePeriodLabel,
                switchTab: switchTab
            });
        }

        if (typeof PayrollRun !== 'undefined') {
            PayrollRun.init({
                getCompanyPayDay: PayrollUtils.getCompanyPayDay,
                getPayDayLabel: PayrollUtils.getPayDayLabel,
                getCurrentPayPeriodContext: PayrollUtils.getCurrentPayPeriodContext,
                getCurrentPeriodVar: PayrollUtils.getCurrentPeriodVar,
                getPeriodContextFromPayDate: PayrollUtils.getPeriodContextFromPayDate,
                getRevenueWeekNumberForDate: PayrollUtils.getRevenueWeekNumberForDate,
                formatDateInputValue: PayrollUtils.formatDateInputValue,
                escapeHtml: PayrollUtils.escapeHtml,
                safeFormatCurrency: PayrollUtils.safeFormatCurrency,
                formatLocalDateTime: PayrollUtils.formatLocalDateTime,
                formatLocalDateOnly: PayrollUtils.formatLocalDateOnly,
                isCloudMode: PayrollTax.isCloudMode,
                generatePeriodLabel: PayrollUtils.generatePeriodLabel,
                getPayrollStateSafe: getPayrollStateSafe,
                isFrequencyDueForContext: PayrollUtils.isFrequencyDueForContext,
                getPeriodNumberForFrequency: PayrollUtils.getPeriodNumberForFrequency,
                getEmployeePayFrequency: PayrollTax.getEmployeePayFrequency,
                getPayFrequencyLabel: PayrollUtils.getPayFrequencyLabel,
                initOrSyncLedger: PayrollTax.initOrSyncLedger,
                getWeek1PeriodicCOPAllocation: PayrollTax.getWeek1PeriodicCOPAllocation,
                getEmployeeAnnualTaxCredits: PayrollTax.getEmployeeAnnualTaxCredits,
                getEmployeeCutOffPoint: PayrollTax.getEmployeeCutOffPoint,
                calculatePAYE: PayrollPAYE.calculatePAYE,
                toFiniteNumber: PayrollUtils.toFiniteNumber,
                getPeriodicAnnualGross: PayrollTax.getPeriodicAnnualGross,
                hasValidRPN: PayrollTax.hasValidRPN,
                showMessage: PayrollUI.showMessage,
                showConfirmModal: PayrollUI.showConfirmModal,
                switchTab: switchTab,
                syncAllTables: syncAllTables
            });
        }

        if (typeof PayrollHistory !== 'undefined') {
            PayrollHistory.init({
                getCompanyId: function() { return PayrollContext.currentCompanyId; },
                getSelectedYear: function() { return selectedYear; },
                initOrSyncLedger: PayrollTax.initOrSyncLedger,
                getEmployeePeriodCOP: PayrollTax.getEmployeePeriodCOP,
                getEmployeeSubmittedPeriodProgress: PayrollTax.getEmployeeSubmittedPeriodProgress,
                getEmployeePayFrequency: PayrollTax.getEmployeePayFrequency,
                getTaxSourceDescription: PayrollTax.getTaxSourceDescription,
                getCurrentPayPeriodContext: PayrollUtils.getCurrentPayPeriodContext,
                getWeek1PeriodicCOPAllocation: PayrollTax.getWeek1PeriodicCOPAllocation,
                switchTab: switchTab,
                syncAllTables: syncAllTables,
                showConfirmModal: PayrollUI.showConfirmModal,
                showMessage: PayrollUI.showMessage,
                buildPayrollPreviewDataFromRun: buildPayrollPreviewDataFromRun,
                buildPayrollPreviewHtml: buildPayrollPreviewHtml,
                showPayslip: showPayslip,
                setPayslipReturnTab: function(tab) { PayrollContext.payslipReturnTab = tab; }
            });
        }

        if (typeof PayrollHelp !== 'undefined') {
            PayrollHelp.init({
                switchTab: switchTab
            });
        }
    }

    wireExtractedModules();

    return {
        init: init,
        renderCompanyList: function() { return PayrollCompanies.renderCompanyList(); },
        toggleCompanyDetails: function(id) { return PayrollCompanies.toggleCompanyDetails(id); },
        showCompanyEditForm: function(id) { return PayrollCompanies.showCompanyEditForm(id); },
        saveCompanyEdit: function(id) { return PayrollCompanies.saveCompanyEdit(id); },
        enterCompany: function(id) { return PayrollWorkspace.enterCompany(id); },
        exitCompany: function() { return PayrollWorkspace.exitCompany(); },
        switchTab: switchTab,
        showRunPayroll: showRunPayroll,
        calculatePayroll: calculatePayroll,
        calculatePAYE: PayrollPAYE.calculatePAYE,
        calculateNormalPAYE: PayrollPAYE.calculateNormalPAYE,
        calculateEmergencyPAYE: PayrollPAYE.calculateEmergencyPAYE,
        calculateTimesheetPreview: calculateTimesheetPreview,
        calculateEstGross: calculateEstGross,
        confirmAndSaveRun: confirmAndSaveRun,
        rollbackLastCommit: rollbackLastCommit,
        submitPeriod: submitPeriod,
        syncAllTables: syncAllTables,
        renderRPNOverview: function() { return PayrollRPN.renderRPNOverview(); },
        generatePeriodLabel: PayrollUtils.generatePeriodLabel,
        showPayslip: showPayslip,
        renderEmployeeCardPayslipPanel: renderEmployeeCardPayslipPanel,
        clearEmployeeCardPayslipPanel: clearEmployeeCardPayslipPanel,
        printPayslip: printPayslip,
        exportRunCSV: exportRunCSV,
        exportRunExcel: exportRunExcel,
        exportPayslipCSV: exportPayslipCSV,
        renderHistory: renderHistory,
        expandHistoryItem: expandHistoryItem,
        deleteRun: deleteRun,
        handleExportBackup: handleExportBackup,
        handleImportBackup: handleImportBackup,
        showMessage: PayrollUI.showMessage,
        showConfirmModal: PayrollUI.showConfirmModal
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    PayrollApp.init();
});