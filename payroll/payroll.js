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

        bindCloudSyncControls();
        bindDataStorageOverrides();
        refreshCloudSyncStatus();
        updateDataStoragePanels();

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
        if (typeof PayrollModeUI !== 'undefined' && PayrollModeUI.applyModeTheme) {
            PayrollModeUI.applyModeTheme();
        }
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

    function setCloudSyncStatus(text, kind) {
        var el = document.getElementById('cloud-sync-status');
        if (!el) return;
        // kind: undefined | 'error' | 'success' | 'busy'  (true = error for older callers)
        if (kind === true) kind = 'error';
        el.textContent = text;
        el.classList.remove(
            'cloud-sync-status--error',
            'cloud-sync-status--success',
            'cloud-sync-status--busy'
        );
        if (kind === 'error') el.classList.add('cloud-sync-status--error');
        if (kind === 'success') el.classList.add('cloud-sync-status--success');
        if (kind === 'busy') el.classList.add('cloud-sync-status--busy');
        try {
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (e) {
            // ignore
        }
    }

    function getActiveStorageMode() {
        if (!PayrollContext.currentCompanyId) {
            return { mode: 'dashboard', companyName: '' };
        }
        var company = PayrollStorage.getCompany(PayrollContext.currentCompanyId);
        var mode = 'local';
        if (typeof PayrollTax !== 'undefined' && PayrollTax.getCurrentCompanyMode) {
            mode = PayrollTax.getCurrentCompanyMode();
        } else if (company && company.payrollMode === 'cloud') {
            mode = 'cloud';
        }
        return {
            mode: mode,
            companyName: company && company.name ? company.name : 'This company'
        };
    }

    function setControlsDisabled(root, disabled) {
        if (!root) return;
        root.querySelectorAll('button, input, select, textarea').forEach(function(el) {
            if (el.type === 'checkbox' && el.closest('.data-panel-override')) return;
            el.disabled = !!disabled;
        });
    }

    /**
     * Local practice → file backup primary; Cloud practice → Neon primary.
     * Override checkboxes re-enable the secondary path when needed.
     */
    function updateDataStoragePanels() {
        var ctx = getActiveStorageMode();
        var filePanel = document.getElementById('data-panel-file');
        var cloudPanel = document.getElementById('data-panel-cloud');
        var fileActions = document.getElementById('data-panel-file-actions');
        var cloudActions = document.getElementById('data-panel-cloud-actions');
        var fileNote = document.getElementById('data-panel-file-note');
        var cloudNote = document.getElementById('data-panel-cloud-note');
        var fileOverrideWrap = document.getElementById('data-panel-file-override-wrap');
        var cloudOverrideWrap = document.getElementById('data-panel-cloud-override-wrap');
        var fileOverride = document.getElementById('enable-file-backup-override');
        var cloudOverride = document.getElementById('enable-cloud-sync-override');
        var fileBadge = document.getElementById('data-panel-file-badge');
        var cloudBadge = document.getElementById('data-panel-cloud-badge');
        var intro = document.getElementById('data-storage-intro');

        if (!filePanel || !cloudPanel) return;

        var fileOverrideOn = fileOverride && fileOverride.checked;
        var cloudOverrideOn = cloudOverride && cloudOverride.checked;

        var fileEnabled = true;
        var cloudEnabled = true;
        var showFileOverride = false;
        var showCloudOverride = false;

        if (ctx.mode === 'dashboard') {
            if (intro) {
                intro.textContent =
                    'Day-to-day work stays in this browser. Open a company to match tools to Local vs Cloud practice — or use either option below for a full-browser backup.';
            }
            if (fileBadge) fileBadge.textContent = 'File on this computer';
            if (cloudBadge) cloudBadge.textContent = 'Neon multi-device';
            if (fileNote) {
                fileNote.textContent = 'Exports/imports every company slot in this browser.';
                fileNote.classList.remove('is-emphasis');
            }
            if (cloudNote) {
                cloudNote.textContent = 'Push/pull every company slot for this workspace key.';
                cloudNote.classList.remove('is-emphasis');
            }
        } else if (ctx.mode === 'cloud') {
            fileEnabled = !!fileOverrideOn;
            cloudEnabled = true;
            showFileOverride = true;
            showCloudOverride = false;
            if (intro) {
                intro.textContent =
                    'You are in Cloud practice (“' +
                    ctx.companyName +
                    '”). Prefer Cloud sync for phone/desktop. File backup is off unless you enable it below.';
            }
            if (fileBadge) fileBadge.textContent = fileEnabled ? 'Enabled (override)' : 'Off in Cloud mode';
            if (cloudBadge) cloudBadge.textContent = 'Recommended';
            if (fileNote) {
                fileNote.textContent = fileEnabled
                    ? 'File backup re-enabled for advanced use.'
                    : 'Turn on the checkbox below if you still need Export/Import while in Cloud mode.';
                fileNote.classList.toggle('is-emphasis', !fileEnabled);
            }
            if (cloudNote) {
                cloudNote.textContent = 'Primary way to save this browser’s data for multi-device practice.';
                cloudNote.classList.remove('is-emphasis');
            }
        } else {
            // local practice
            fileEnabled = true;
            cloudEnabled = !!cloudOverrideOn;
            showFileOverride = false;
            showCloudOverride = true;
            if (intro) {
                intro.textContent =
                    'You are in Local practice (“' +
                    ctx.companyName +
                    '”). Prefer File backup. Cloud sync is off unless you enable it below.';
            }
            if (fileBadge) fileBadge.textContent = 'Recommended';
            if (cloudBadge) cloudBadge.textContent = cloudEnabled ? 'Enabled (override)' : 'Off in Local mode';
            if (fileNote) {
                fileNote.textContent = 'Primary way to save a copy of this browser’s data on disc.';
                fileNote.classList.remove('is-emphasis');
            }
            if (cloudNote) {
                cloudNote.textContent = cloudEnabled
                    ? 'Cloud sync re-enabled for advanced use.'
                    : 'Turn on the checkbox below if you need Neon push/pull while in Local practice.';
                cloudNote.classList.toggle('is-emphasis', !cloudEnabled);
            }
        }

        filePanel.classList.toggle('is-disabled', !fileEnabled);
        cloudPanel.classList.toggle('is-disabled', !cloudEnabled);
        setControlsDisabled(fileActions, !fileEnabled);
        setControlsDisabled(cloudActions, !cloudEnabled);

        if (fileOverrideWrap) {
            fileOverrideWrap.classList.toggle('is-hidden', !showFileOverride);
        }
        if (cloudOverrideWrap) {
            cloudOverrideWrap.classList.toggle('is-hidden', !showCloudOverride);
        }
        // Reset override when switching mode so it does not stick silently
        if (!showFileOverride && fileOverride) fileOverride.checked = false;
        if (!showCloudOverride && cloudOverride) cloudOverride.checked = false;
    }

    function bindDataStorageOverrides() {
        var fileOverride = document.getElementById('enable-file-backup-override');
        var cloudOverride = document.getElementById('enable-cloud-sync-override');
        if (fileOverride) {
            fileOverride.addEventListener('change', updateDataStoragePanels);
        }
        if (cloudOverride) {
            cloudOverride.addEventListener('change', updateDataStoragePanels);
        }
    }

    function refreshCloudSyncStatus() {
        var keyInput = document.getElementById('cloud-workspace-key');
        if (keyInput && typeof PayrollCloudData !== 'undefined') {
            keyInput.value = PayrollCloudData.getWorkspaceKey() || '';
        }
        if (typeof PayrollCloudData === 'undefined') {
            setCloudSyncStatus('Cloud sync module not loaded.', true);
            return;
        }
        PayrollCloudData.health()
            .then(function(info) {
                if (info.status === 'ok') {
                    var key = PayrollCloudData.getWorkspaceKey();
                    var label = PayrollCloudData.getStoredLabel();
                    setCloudSyncStatus(
                        'Neon connected · workspaces: ' +
                            (info.workspaceCount != null ? info.workspaceCount : '?') +
                            (key ? ' · key saved' + (label ? ' (' + label + ')' : '') : ' · no key yet'),
                        false
                    );
                } else {
                    setCloudSyncStatus(info.message || 'Cloud database not ready.', true);
                }
            })
            .catch(function(err) {
                setCloudSyncStatus(
                    'Cloud API unavailable: ' +
                        (err && err.message ? err.message : 'error') +
                        (isLocalDevHint()),
                    true
                );
            });
    }

    function isLocalDevHint() {
        var host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return ' (local: use netlify dev or the live site for Neon APIs)';
        }
        return '';
    }

    function bindCloudSyncControls() {
        var createBtn = document.getElementById('cloud-create-workspace-btn');
        var pushBtn = document.getElementById('cloud-push-btn');
        var pullBtn = document.getElementById('cloud-pull-btn');
        var saveKeyBtn = document.getElementById('cloud-save-key-btn');
        var keyInput = document.getElementById('cloud-workspace-key');

        if (saveKeyBtn && keyInput) {
            saveKeyBtn.addEventListener('click', function() {
                if (typeof PayrollCloudData === 'undefined') return;
                PayrollCloudData.setWorkspaceKeyManually(keyInput.value);
                var saved = !!keyInput.value.trim();
                setCloudSyncStatus(
                    saved ? 'Workspace key saved on this browser.' : 'Workspace key cleared.',
                    saved ? 'success' : 'error'
                );
                PayrollUI.showMessage(
                    saved ? 'Workspace key saved on this browser.' : 'Workspace key cleared.',
                    saved ? 'success' : 'error'
                );
                refreshCloudSyncStatus();
            });
        }

        if (createBtn) {
            createBtn.addEventListener('click', function() {
                if (typeof PayrollCloudData === 'undefined') return;
                createBtn.disabled = true;
                setCloudSyncStatus('Creating workspace…', 'busy');
                PayrollCloudData.createWorkspace('Practice workspace')
                    .then(function(data) {
                        if (keyInput) keyInput.value = data.accessKey || '';
                        setCloudSyncStatus(
                            'Workspace created. Key is in the box — copy it for your phone, then Push to cloud.',
                            'success'
                        );
                        PayrollUI.showMessage(
                            'Cloud workspace created. Copy the key if you will use another device.',
                            'success'
                        );
                        refreshCloudSyncStatus();
                    })
                    .catch(function(err) {
                        var msg = 'Create workspace failed: ' + (err.message || err) + isLocalDevHint();
                        setCloudSyncStatus(msg, 'error');
                        PayrollUI.showMessage(msg, 'error');
                    })
                    .finally(function() {
                        updateDataStoragePanels();
                    });
            });
        }

        if (pushBtn) {
            pushBtn.addEventListener('click', function() {
                if (typeof PayrollCloudData === 'undefined') return;
                if (!PayrollCloudData.getWorkspaceKey()) {
                    var needKey = 'Create a workspace first (or paste a key and Save key), then Push.';
                    setCloudSyncStatus(needKey, 'error');
                    PayrollUI.showMessage(needKey, 'error');
                    return;
                }
                pushBtn.disabled = true;
                setCloudSyncStatus('Pushing snapshot to Neon…', 'busy');
                PayrollCloudData.pushSnapshot()
                    .then(function(result) {
                        setCloudSyncStatus(
                            'Push OK — snapshot saved' +
                                (result && result.updatedAt ? ' at ' + result.updatedAt : '') +
                                '.',
                            'success'
                        );
                        PayrollUI.showMessage('Payroll snapshot pushed to Neon.', 'success');
                        refreshCloudSyncStatus();
                    })
                    .catch(function(err) {
                        var msg = 'Push failed: ' + (err.message || err) + isLocalDevHint();
                        setCloudSyncStatus(msg, 'error');
                        PayrollUI.showMessage(msg, 'error');
                    })
                    .finally(function() {
                        updateDataStoragePanels();
                    });
            });
        }

        if (pullBtn) {
            pullBtn.addEventListener('click', function() {
                if (typeof PayrollCloudData === 'undefined') return;
                if (!PayrollCloudData.getWorkspaceKey()) {
                    var needKeyPull = 'Paste your workspace key and click Save key, then Pull.';
                    setCloudSyncStatus(needKeyPull, 'error');
                    PayrollUI.showMessage(needKeyPull, 'error');
                    return;
                }
                PayrollUI.showConfirmModal(
                    'Pull will replace all payroll data in this browser with the cloud snapshot. Continue?',
                    function() {
                        pullBtn.disabled = true;
                        setCloudSyncStatus('Pulling snapshot from Neon…', 'busy');
                        PayrollCloudData.pullSnapshot()
                            .then(function() {
                                setCloudSyncStatus('Pull OK — browser data replaced from cloud.', 'success');
                                PayrollUI.showMessage(
                                    'Cloud snapshot applied. Select a company to continue.',
                                    'success'
                                );
                                PayrollWorkspace.exitCompany();
                                PayrollCompanies.renderCompanyList();
                                refreshCloudSyncStatus();
                            })
                            .catch(function(err) {
                                var msg = 'Pull failed: ' + (err.message || err) + isLocalDevHint();
                                setCloudSyncStatus(msg, 'error');
                                PayrollUI.showMessage(msg, 'error');
                            })
                            .finally(function() {
                                updateDataStoragePanels();
                            });
                    },
                    { title: 'Pull from cloud', confirmLabel: 'Pull and replace' }
                );
            });
        }
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
        updateDataStoragePanels: updateDataStoragePanels,
        showMessage: PayrollUI.showMessage,
        showConfirmModal: PayrollUI.showConfirmModal
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    PayrollApp.init();
});