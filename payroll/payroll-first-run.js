// payroll/payroll-first-run.js — Guided first run for the RPN practice sandbox

var PayrollFirstRun = (function() {
    'use strict';

    var HIDE_KEY = 'payePractice.firstRunCoach.hide';
    var sessionDismissed = false;
    var sessionPreviewDone = false;
    var payslipOpened = false;
    var deps = {};

    function init(dependencies) {
        deps = dependencies || {};
        bindCoach();
        refresh();
    }

    function callDep(name) {
        var fn = deps[name];
        if (typeof fn === 'function') {
            return fn.apply(null, Array.prototype.slice.call(arguments, 1));
        }
    }

    function isDontShowAgain() {
        try {
            return localStorage.getItem(HIDE_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function setDontShowAgain() {
        try {
            localStorage.setItem(HIDE_KEY, '1');
        } catch (e) {}
    }

    function isRpnSandboxCompany(company) {
        if (!company) return false;
        var mode = (typeof PayrollMode !== 'undefined' && PayrollMode.getMode)
            ? PayrollMode.getMode(company)
            : company.payrollMode;
        return company.practicePreset === 'sandbox-cloud' && mode === 'cloud';
    }

    function hasLivePreview() {
        if (typeof PayrollContext === 'undefined' || !PayrollContext.currentRunData) return false;
        var entries = PayrollContext.currentRunData.entries;
        return Array.isArray(entries) && entries.length > 0;
    }

    function getProgress(companyId) {
        var employees = [];
        var savedRuns = [];
        if (companyId && typeof PayrollStorage !== 'undefined') {
            employees = PayrollStorage.loadEmployees(companyId) || [];
            savedRuns = PayrollStorage.loadPayrollRuns(companyId) || [];
        }
        var sandboxLoaded = employees.length > 0;
        var rpnRetrieved = employees.some(function(emp) {
            return !!(emp && emp.rpn && emp.rpn.rpnNumber);
        });
        var livePreview = hasLivePreview();
        var hasPreview = livePreview || savedRuns.length > 0 || sessionPreviewDone;
        return {
            sandboxLoaded: sandboxLoaded,
            rpnRetrieved: rpnRetrieved,
            hasPreview: hasPreview,
            hasSavedRun: savedRuns.length > 0,
            livePreview: livePreview,
            payslipOpened: payslipOpened
        };
    }

    function shouldShow(company) {
        if (!company || !isRpnSandboxCompany(company)) return false;
        if (isDontShowAgain() || sessionDismissed) return false;
        if (payslipOpened) return false;
        var progress = getProgress(company.id);
        if (progress.hasSavedRun && !sessionPreviewDone && !progress.livePreview) {
            return false;
        }
        return true;
    }

    function getCurrentCompany() {
        if (typeof PayrollContext === 'undefined' || !PayrollContext.currentCompanyId) return null;
        if (typeof PayrollStorage === 'undefined') return null;
        return PayrollStorage.getCompany(PayrollContext.currentCompanyId) || null;
    }

    function currentStepIndex(progress) {
        if (!progress.sandboxLoaded) return 0;
        if (!progress.rpnRetrieved) return 1;
        if (!progress.hasPreview) return 2;
        if (!progress.payslipOpened) return 3;
        return -1;
    }

    function bindCoach() {
        var el = document.getElementById('first-run-coach');
        if (!el || el.dataset.bound === 'true') return;
        el.dataset.bound = 'true';
        el.addEventListener('click', function(e) {
            var btn = e.target.closest ? e.target.closest('[data-first-run]') : null;
            if (!btn) return;
            e.preventDefault();
            var action = btn.getAttribute('data-first-run');
            if (action === 'dismiss') {
                sessionDismissed = true;
                refresh();
                return;
            }
            if (action === 'never') {
                setDontShowAgain();
                refresh();
                return;
            }
            if (action === 'step-1') {
                var company = getCurrentCompany();
                var progress = company ? getProgress(company.id) : { sandboxLoaded: false };
                if (!progress.sandboxLoaded && typeof PayrollWorkspace !== 'undefined' && PayrollWorkspace.exitCompany) {
                    PayrollWorkspace.exitCompany();
                }
                return;
            }
            if (action === 'step-2') {
                callDep('switchTab', 'rpn');
                refresh();
                return;
            }
            if (action === 'step-3' || action === 'step-4') {
                callDep('switchTab', 'run');
                refresh();
            }
        });
    }

    function stepClass(progress, index) {
        var current = currentStepIndex(progress);
        var done = (index === 0 && progress.sandboxLoaded)
            || (index === 1 && progress.rpnRetrieved)
            || (index === 2 && progress.hasPreview)
            || (index === 3 && progress.payslipOpened);
        if (done) return 'is-done';
        if (index === current) return 'is-current';
        return 'is-todo';
    }

    function render() {
        var el = document.getElementById('first-run-coach');
        if (!el) return;
        bindCoach();

        var company = getCurrentCompany();
        if (!shouldShow(company)) {
            el.classList.add('hidden');
            el.setAttribute('hidden', '');
            el.innerHTML = '';
            return;
        }

        var progress = getProgress(company.id);
        var html = '';
        html += '<div class="first-run-coach-inner">';
        html += '<h2 class="first-run-coach-title">First run — RPN practice</h2>';
        html += '<ol class="first-run-coach-steps">';
        html += '<li class="' + stepClass(progress, 0) + '">';
        html += '<button type="button" class="first-run-step-btn" data-first-run="step-1">Load RPN practice sandbox</button>';
        html += '</li>';
        html += '<li class="' + stepClass(progress, 1) + '">';
        html += '<button type="button" class="first-run-step-btn" data-first-run="step-2">Open RPN tab → Retrieve RPN</button>';
        html += '</li>';
        html += '<li class="' + stepClass(progress, 2) + '">';
        html += '<button type="button" class="first-run-step-btn" data-first-run="step-3">Open Run Payroll → Calculate Preview</button>';
        html += '</li>';
        html += '<li class="' + stepClass(progress, 3) + '">';
        html += '<button type="button" class="first-run-step-btn" data-first-run="step-4">Open the payslip / breakdown</button>';
        if (progress.hasPreview) {
            html += '<p class="first-run-coach-hint">Click a preview row. Sofia (PPSN ending 7) includes a €45 LPT deduction.</p>';
        }
        html += '</li>';
        html += '</ol>';
        html += '<div class="first-run-coach-actions">';
        html += '<button type="button" class="btn btn-secondary btn-sm" data-first-run="dismiss">Dismiss</button>';
        html += '<button type="button" class="btn btn-secondary btn-sm" data-first-run="never">Don\'t show again</button>';
        html += '</div>';
        html += '</div>';

        el.innerHTML = html;
        el.classList.remove('hidden');
        el.removeAttribute('hidden');
    }

    function refresh() {
        render();
    }

    function markPreviewDone() {
        sessionPreviewDone = true;
        refresh();
    }

    function markPayslipOpened() {
        payslipOpened = true;
        refresh();
    }

    function resetSessionState() {
        sessionDismissed = false;
        sessionPreviewDone = false;
        payslipOpened = false;
    }

    return {
        HIDE_KEY: HIDE_KEY,
        init: init,
        refresh: refresh,
        shouldShow: shouldShow,
        isRpnSandboxCompany: isRpnSandboxCompany,
        getProgress: getProgress,
        markPreviewDone: markPreviewDone,
        markPayslipOpened: markPayslipOpened,
        resetSessionState: resetSessionState
    };
})();
