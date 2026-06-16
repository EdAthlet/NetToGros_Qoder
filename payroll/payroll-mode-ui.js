// payroll/payroll-mode-ui.js — Payroll mode toggle UI and persistence

var PayrollModeUI = (function() {
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

    function companyHasPayrollData(companyId) {
        const employees = PayrollStorage.loadEmployees(companyId) || [];
        const runs = PayrollStorage.loadPayrollRuns(companyId) || [];
        return employees.length > 0 || runs.length > 0;
    }

    function getModeBadgeHtml(company, slotIndex) {
        const mode = company && company.payrollMode;
        if (!mode && slotIndex === 2) {
            return '<span class="company-mode-badge mode-unset">Choose mode</span>';
        }
        const label = mode === 'cloud' ? 'Cloud' : 'Local';
        const css = mode === 'cloud' ? 'mode-cloud' : 'mode-local';
        return '<span class="company-mode-badge ' + css + '">' + label + '</span>';
    }

    function applyModeToUI() {
        const mode = PayrollTax.getCurrentCompanyMode();
        const localBtn = document.getElementById('btn-mode-local');
        const cloudBtn = document.getElementById('btn-mode-cloud');
        const description = document.getElementById('payroll-mode-description');
        const hint = document.getElementById('payroll-mode-hint');

        if (localBtn) localBtn.classList.toggle('active', mode === 'local');
        if (cloudBtn) cloudBtn.classList.toggle('active', mode === 'cloud');

        if (description) {
            description.textContent = mode === 'cloud'
                ? 'RPN retrieval and Revenue submission via simulated server'
                : 'Manual annual tax credits/COP with local backup';
        }

        if (hint) {
            hint.textContent = mode === 'cloud'
                ? 'Start fake Revenue server on port 3001, retrieve RPN, then commit and submit payroll.'
                : 'Enter custom tax credits/COP where needed. RPN and Revenue submission are hidden in local mode.';
        }

        const workspaceNav = document.getElementById('workspace-nav');
        if (workspaceNav) {
            workspaceNav.querySelectorAll('.tab-btn').forEach(function(btn) {
                const tab = btn.dataset.tab;
                const hideInLocal = tab === 'rpn' || tab === 'submission';
                btn.classList.toggle('nav-tab-hidden', mode === 'local' && hideInLocal);
            });
        }

        const submissionActions = document.querySelector('.submission-actions');
        if (submissionActions) {
            submissionActions.style.display = mode === 'cloud' ? '' : 'none';
        }
    }

    function persistPayrollMode(mode) {
        if (!PayrollContext.currentCompanyId) return false;
        return PayrollStorage.updateCompany(PayrollContext.currentCompanyId, { payrollMode: mode });
    }

    function requestPayrollModeChange(mode) {
        if (!PayrollContext.currentCompanyId || mode === PayrollTax.getCurrentCompanyMode()) return;

        const hasData = companyHasPayrollData(PayrollContext.currentCompanyId);
        const smState = typeof PayrollStateMachine !== 'undefined' ? PayrollStateMachine.getState() : null;
        const hasOpenCommits = smState && smState.commitCounter > 0;

        function applyMode() {
            if (!persistPayrollMode(mode)) {
                PayrollUI.showMessage('Failed to update payroll mode.', 'error');
                return;
            }
            applyModeToUI();
            callDep('initOrSyncLedger', PayrollContext.currentCompanyId, callDep('getSelectedYear'));
            callDep('syncAllTables');
            if (mode === 'local' && document.getElementById('panel-rpn') && document.getElementById('panel-rpn').classList.contains('active')) {
                callDep('switchTab', 'employees');
            }
            if (mode === 'local' && document.getElementById('panel-submission') && document.getElementById('panel-submission').classList.contains('active')) {
                callDep('switchTab', 'run');
            }
            PayrollUI.showMessage('Switched to ' + (mode === 'cloud' ? 'Cloud' : 'Local') + ' mode.', 'success');
        }

        if (!hasData && !hasOpenCommits) {
            applyMode();
            return;
        }

        const warning = mode === 'cloud'
            ? 'Existing payroll data stays in this browser. You will use RPN retrieval and Revenue submission instead of manual-only tax credits.'
            : 'RPN data will be ignored for calculations. Manual tax credits/COP and backup/import remain available.';

        PayrollUI.showConfirmModal(warning, applyMode, {
            title: mode === 'cloud' ? 'Switch to Cloud mode' : 'Switch to Local mode',
            variant: 'primary'
        });
    }

    function bindPayrollModeControls() {
        const localBtn = document.getElementById('btn-mode-local');
        const cloudBtn = document.getElementById('btn-mode-cloud');

        if (localBtn) {
            localBtn.onclick = function() {
                requestPayrollModeChange('local');
            };
        }
        if (cloudBtn) {
            cloudBtn.onclick = function() {
                requestPayrollModeChange('cloud');
            };
        }
    }

    function promptInitialModeSelection(companyId, onComplete) {
        const modal = document.createElement('div');
        modal.className = 'payroll-action-modal active';
        modal.innerHTML =
            '<div class="payroll-action-modal-content">' +
            '<h3>Choose Payroll Mode</h3>' +
            '<p>Select how this company should handle tax credits and Revenue integration.</p>' +
            '<div class="payroll-mode-prompt-actions">' +
            '<button type="button" class="btn btn-secondary" id="choose-mode-local">Local – Manual TC/COP</button>' +
            '<button type="button" class="btn btn-primary" id="choose-mode-cloud">Cloud – RPN &amp; Submission</button>' +
            '</div>' +
            '</div>';

        document.body.appendChild(modal);

        function choose(mode) {
            PayrollStorage.updateCompany(companyId, { payrollMode: mode });
            document.body.removeChild(modal);
            if (typeof onComplete === 'function') onComplete();
        }

        modal.querySelector('#choose-mode-local').onclick = function() { choose('local'); };
        modal.querySelector('#choose-mode-cloud').onclick = function() { choose('cloud'); };
    }

    function stripRpnForLocalMode(employees) {
        return employees.map(function(emp) {
            const clone = Object.assign({}, emp);
            if (clone.rpn) {
                const rpn = Object.assign({}, clone.rpn);
                delete rpn.rpnNumber;
                delete rpn.annualTaxCredits;
                delete rpn.taxCredits;
                delete rpn.cutOffPoint;
                delete rpn.periodicTaxCredit;
                delete rpn.periodicStandardRateCutOffPoint;
                clone.rpn = rpn;
            }
            return clone;
        });
    }

    function stripRpnNumbersForCloudPractice(employees) {
        return employees.map(function(emp) {
            const clone = Object.assign({}, emp);
            clone.rpn = Object.assign({}, clone.rpn || {});
            delete clone.rpn.rpnNumber;
            delete clone.rpn.annualTaxCredits;
            delete clone.rpn.taxCredits;
            delete clone.rpn.cutOffPoint;
            delete clone.rpn.periodicTaxCredit;
            delete clone.rpn.periodicStandardRateCutOffPoint;
            delete clone.rpn.retrievedAt;
            delete clone.rpn.requestId;
            delete clone.rpn.retrievalError;
            return clone;
        });
    }

    return {
        init: init,
        companyHasPayrollData: companyHasPayrollData,
        getModeBadgeHtml: getModeBadgeHtml,
        applyModeToUI: applyModeToUI,
        persistPayrollMode: persistPayrollMode,
        requestPayrollModeChange: requestPayrollModeChange,
        bindPayrollModeControls: bindPayrollModeControls,
        promptInitialModeSelection: promptInitialModeSelection,
        stripRpnForLocalMode: stripRpnForLocalMode,
        stripRpnNumbersForCloudPractice: stripRpnNumbersForCloudPractice
    };
})();