// payroll/payroll-first-run.js — The Coach (RPN practice first-run panel)

var PayrollFirstRun = (function() {
    'use strict';

    var HIDE_KEY = 'payePractice.theCoach.hide';
    var LEGACY_HIDE_KEY = 'payePractice.firstRunCoach.hide';
    var COLLAPSED_KEY = 'payePractice.theCoach.collapsed';
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
            if (localStorage.getItem(HIDE_KEY) === '1') return true;
            if (localStorage.getItem(LEGACY_HIDE_KEY) === '1') {
                localStorage.setItem(HIDE_KEY, '1');
                localStorage.removeItem(LEGACY_HIDE_KEY);
                return true;
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    function setDontShowAgain() {
        try {
            localStorage.setItem(HIDE_KEY, '1');
            localStorage.removeItem(LEGACY_HIDE_KEY);
        } catch (e) {}
    }

    function isCollapsed() {
        try {
            return localStorage.getItem(COLLAPSED_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function setCollapsed(collapsed) {
        try {
            if (collapsed) localStorage.setItem(COLLAPSED_KEY, '1');
            else localStorage.removeItem(COLLAPSED_KEY);
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
                dismiss();
                return;
            }
            if (action === 'never') {
                neverShow();
                return;
            }
            if (action === 'toggle') {
                toggleCollapsed();
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
            el.classList.remove('is-collapsed');
            el.setAttribute('hidden', '');
            el.innerHTML = '';
            return;
        }

        var progress = getProgress(company.id);
        var collapsed = isCollapsed();
        if (collapsed) el.classList.add('is-collapsed');
        else el.classList.remove('is-collapsed');

        var html = '';
        html += '<div class="first-run-coach-inner">';
        html += '<div class="first-run-coach-header">';
        html += '<div class="first-run-coach-heading">';
        html += '<h2 class="first-run-coach-title">The Coach</h2>';
        html += '<p class="first-run-coach-subtitle">RPN practice</p>';
        html += '</div>';
        html += '<button type="button" class="btn btn-secondary btn-sm first-run-coach-toggle" data-first-run="toggle" aria-expanded="' + (collapsed ? 'false' : 'true') + '">';
        html += collapsed ? 'Show The Coach' : 'Collapse';
        html += '</button>';
        html += '</div>';
        if (!collapsed) {
        html += '<div class="first-run-coach-body">';
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
        html += '<button type="button" class="first-run-step-btn" data-first-run="step-4">Open the payslip / breakdown (click on the Employee\'s line in the calculated Preview table)</button>';
        if (progress.hasPreview && !progress.payslipOpened) {
            html += '<p class="first-run-coach-hint">Click a preview row. Sofia (PPSN ending 7) includes a €45 LPT deduction.</p>';
        }
        html += '</li>';
        html += '</ol>';
        if (progress.payslipOpened) {
            html += '<p class="first-run-coach-complete">First run complete</p>';
        }
        html += '<div class="first-run-coach-actions">';
        html += '<button type="button" class="btn btn-secondary btn-sm" data-first-run="dismiss">Dismiss</button>';
        html += '<button type="button" class="btn btn-secondary btn-sm" data-first-run="never">Don\'t show again</button>';
        html += '</div>';
        html += '</div>';
        }
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

    function dismiss() {
        sessionDismissed = true;
        refresh();
    }

    function neverShow() {
        setDontShowAgain();
        refresh();
    }

    function toggleCollapsed() {
        setCollapsed(!isCollapsed());
        refresh();
    }

    function resetSessionState() {
        sessionDismissed = false;
        sessionPreviewDone = false;
        payslipOpened = false;
    }

    return {
        HIDE_KEY: HIDE_KEY,
        LEGACY_HIDE_KEY: LEGACY_HIDE_KEY,
        COLLAPSED_KEY: COLLAPSED_KEY,
        init: init,
        refresh: refresh,
        shouldShow: shouldShow,
        isRpnSandboxCompany: isRpnSandboxCompany,
        getProgress: getProgress,
        markPreviewDone: markPreviewDone,
        markPayslipOpened: markPayslipOpened,
        dismiss: dismiss,
        neverShow: neverShow,
        resetSessionState: resetSessionState
    };
})();
