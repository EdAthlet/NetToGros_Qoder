// payroll/payroll-first-run.js — The Coach (RPN practice first-run panel)

var PayrollFirstRun = (function() {
    'use strict';

    var HIDE_KEY = 'payePractice.theCoach.hide';
    var LEGACY_HIDE_KEY = 'payePractice.firstRunCoach.hide';
    var COLLAPSED_KEY = 'payePractice.theCoach.collapsed';
    var POS_X_KEY = 'payePractice.theCoach.x';
    var POS_Y_KEY = 'payePractice.theCoach.y';
    var POS_W_KEY = 'payePractice.theCoach.w';
    var POS_H_KEY = 'payePractice.theCoach.h';
    var MIN_W = 220;
    var MIN_H = 72;
    var sessionDismissed = false;
    var labLesson = '';
    var sawRpnTab = false;
    var sawRunTab = false;
    var historySeen = false;
    var failureRowSeen = false;
    var dragState = null;
    var sessionPreviewDone = false;
    var payslipOpened = false;
    // Step 1 stays ticked while sandbox employees exist. After a restart reload, hold it clear until Load RPN practice sandbox runs again.
    var suppressSandboxStep = false;
    var sandboxReloadedNote = false;
    var deps = {};

    function init(dependencies) {
        deps = dependencies || {};
        bindCoach();
        bindLabMessages();
        refresh();
    }

    function pageWindow() {
        try {
            if (typeof window === 'undefined') return null;
            return window;
        } catch (e) {
            return null;
        }
    }

    function inLabFrame() {
        var view = pageWindow();
        if (!view || view === view.top || !view.parent || !view.parent.location) return false;
        var path = view.parent.location.pathname || '';
        return path === '/learn/lab/' || path === '/learn/lab/index.html';
    }

    function isPayrollLabLesson(n) {
        return n === '1' || n === '2' || n === '4' || n === '5' || n === '6';
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
        var sandboxLoaded = employees.length > 0 && !suppressSandboxStep;
        var rpnRetrieved = employees.some(function(emp) {
            return !!(emp && emp.rpn && emp.rpn.rpnNumber);
        });
        var livePreview = hasLivePreview();
        var hasPreview = livePreview || savedRuns.length > 0 || sessionPreviewDone;
        var rpnAttempted = employees.some(function(emp) {
            return !!(emp && emp.rpn && (emp.rpn.rpnNumber || emp.rpn.retrievalError || emp.rpn.retrievedAt));
        });
        return {
            sandboxLoaded: sandboxLoaded,
            rpnRetrieved: rpnRetrieved,
            rpnAttempted: rpnAttempted,
            hasPreview: hasPreview,
            hasSavedRun: savedRuns.length > 0,
            livePreview: livePreview,
            payslipOpened: payslipOpened,
            companyOpen: !!(typeof PayrollContext !== 'undefined' && PayrollContext.currentCompanyId),
            sawRpnTab: sawRpnTab,
            sawRunTab: sawRunTab,
            historySeen: historySeen,
            failureRowSeen: failureRowSeen
        };
    }

    function shouldShow(company) {
        if (inLabFrame() && isPayrollLabLesson(labLesson)) return !sessionDismissed;
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
            if (action === 'restart') {
                restartFirstRun();
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
        bindDrag(el);
        bindViewportFit();
    }

    function viewportSize() {
        var view = pageWindow();
        return {
            w: view && view.innerWidth ? view.innerWidth : 800,
            h: view && view.innerHeight ? view.innerHeight : 600
        };
    }

    function resizeHandlesHtml() {
        var edges = ['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw'];
        var html = '';
        for (var i = 0; i < edges.length; i++) {
            html += '<div class="first-run-coach-resize" data-edge="' + edges[i] + '" aria-hidden="true"></div>';
        }
        return html;
    }

    function resizedBox(state, clientX, clientY) {
        var dx = clientX - state.startX;
        var dy = clientY - state.startY;
        var edge = state.edge;
        var east = edge === 'e' || edge === 'ne' || edge === 'se';
        var west = edge === 'w' || edge === 'nw' || edge === 'sw';
        var south = edge === 's' || edge === 'se' || edge === 'sw';
        var north = edge === 'n' || edge === 'ne' || edge === 'nw';
        var w = state.w;
        var h = state.h;
        if (east) w = state.w + dx;
        if (west) w = state.w - dx;
        if (south) h = state.h + dy;
        if (north) h = state.h - dy;
        var view = viewportSize();
        var minW = Math.min(MIN_W, Math.max(1, view.w));
        var minH = Math.min(MIN_H, Math.max(1, view.h));
        if (w < minW) w = minW;
        if (h < minH) h = minH;
        var x = west ? (state.x + state.w - w) : state.x;
        var y = north ? (state.y + state.h - h) : state.y;
        if (x < 0) {
            w += x;
            if (w < minW) w = minW;
            x = 0;
        }
        if (y < 0) {
            h += y;
            if (h < minH) h = minH;
            y = 0;
        }
        if (x + w > view.w) {
            if (west) x = Math.max(0, view.w - w);
            else w = Math.max(minW, view.w - x);
        }
        if (y + h > view.h) {
            if (north) y = Math.max(0, view.h - h);
            else h = Math.max(minH, view.h - y);
        }
        if (x + w > view.w) {
            w = Math.max(minW, view.w - Math.max(0, x));
            x = Math.max(0, Math.min(x, view.w - w));
        }
        if (y + h > view.h) {
            h = Math.max(minH, view.h - Math.max(0, y));
            y = Math.max(0, Math.min(y, view.h - h));
        }
        return {
            x: Math.round(x),
            y: Math.round(y),
            w: Math.round(w),
            h: Math.round(h)
        };
    }

    function applyBox(el, box, withSize) {
        if (!el.style) el.style = {};
        el.style.position = 'fixed';
        el.style.left = box.x + 'px';
        el.style.top = box.y + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        if (withSize) {
            el.style.width = box.w + 'px';
            el.style.height = box.h + 'px';
        }
    }

    function bindDrag(el) {
        if (!el || el.dataset.dragBound === 'true') return;
        el.dataset.dragBound = 'true';

        function move(e) {
            if (!dragState) return;
            if (dragState.mode === 'resize') {
                applyBox(el, resizedBox(dragState, e.clientX, e.clientY), true);
                return;
            }
            var view = viewportSize();
            var x = e.clientX - dragState.dx;
            var y = e.clientY - dragState.dy;
            var maxX = Math.max(0, view.w - (dragState.w || 320));
            var maxY = Math.max(0, view.h - (dragState.h || 120));
            x = Math.min(Math.max(0, x), maxX);
            y = Math.min(Math.max(0, y), maxY);
            applyBox(el, { x: Math.round(x), y: Math.round(y) }, false);
        }

        function endDrag() {
            if (!dragState) return;
            var mode = dragState.mode;
            dragState = null;
            var style = el.style || {};
            var x = parseFloat(style.left);
            var y = parseFloat(style.top);
            try {
                if (isFinite(x) && isFinite(y)) {
                    localStorage.setItem(POS_X_KEY, String(Math.round(x)));
                    localStorage.setItem(POS_Y_KEY, String(Math.round(y)));
                }
                if (mode === 'resize') {
                    var w = parseFloat(style.width);
                    var h = parseFloat(style.height);
                    if (isFinite(w)) localStorage.setItem(POS_W_KEY, String(Math.round(w)));
                    if (isFinite(h)) localStorage.setItem(POS_H_KEY, String(Math.round(h)));
                }
            } catch (err) {}
        }

        el.addEventListener('pointerdown', function(e) {
            if (e.target.closest && e.target.closest('button')) return;
            var handle = e.target.closest ? e.target.closest('[data-edge]') : null;
            var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: 320, height: 160 };
            if (handle) {
                dragState = {
                    mode: 'resize',
                    edge: handle.getAttribute('data-edge'),
                    startX: e.clientX,
                    startY: e.clientY,
                    x: rect.left,
                    y: rect.top,
                    w: rect.width,
                    h: rect.height
                };
            } else {
                var header = e.target.closest ? e.target.closest('.first-run-coach-header') : null;
                if (!header) return;
                dragState = { mode: 'move', dx: e.clientX - rect.left, dy: e.clientY - rect.top, w: rect.width, h: rect.height };
            }
            if (e.preventDefault) e.preventDefault();
            if (el.setPointerCapture && e.pointerId != null) {
                try { el.setPointerCapture(e.pointerId); } catch (err) {}
            }
        });
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', endDrag);
        el.addEventListener('pointercancel', endDrag);
    }

    function readStoredNumber(key) {
        try {
            return parseFloat(localStorage.getItem(key));
        } catch (e) {
            return NaN;
        }
    }

    function fitCoachToViewport(el) {
        if (!el) return;
        if (!el.style) el.style = {};
        if (el.hidden || (el.classList && el.classList.contains('hidden'))) return;
        var savedW = readStoredNumber(POS_W_KEY);
        var savedH = readStoredNumber(POS_H_KEY);
        var savedX = readStoredNumber(POS_X_KEY);
        var savedY = readStoredNumber(POS_Y_KEY);
        var collapsed = el.classList && el.classList.contains('is-collapsed');
        if (collapsed) el.style.height = 'auto';
        else if (!isFinite(savedH)) el.style.height = '';
        var view = viewportSize();
        var maxW = Math.max(1, view.w);
        var maxH = Math.max(1, view.h);
        var minW = Math.min(MIN_W, maxW);
        var minH = Math.min(MIN_H, maxH);
        var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 16, top: 16, width: 320, height: 160 };
        var w = isFinite(savedW) ? savedW : 320;
        var h = isFinite(savedH) ? savedH : (rect.height || 160);
        w = Math.min(Math.max(minW, w), maxW);
        h = Math.min(Math.max(minH, h), maxH);
        el.style.width = Math.round(w) + 'px';
        if (collapsed) el.style.height = 'auto';
        else if (isFinite(savedH) || h < (rect.height || h) || h >= maxH) el.style.height = Math.round(h) + 'px';
        else el.style.height = '';
        if (collapsed) h = Math.min(h, 64);
        if (!isFinite(savedX) || !isFinite(savedY)) {
            var left = rect.left;
            var top = rect.top;
            if (left < 0 || top < 0 || left + w > maxW || top + h > maxH) {
                left = Math.min(Math.max(0, left), Math.max(0, maxW - w));
                top = Math.min(Math.max(0, top), Math.max(0, maxH - h));
                el.style.left = Math.round(left) + 'px';
                el.style.top = Math.round(top) + 'px';
                el.style.right = 'auto';
            }
            return;
        }
        var x = Math.min(Math.max(0, savedX), Math.max(0, maxW - w));
        var y = Math.min(Math.max(0, savedY), Math.max(0, maxH - h));
        el.style.left = Math.round(x) + 'px';
        el.style.top = Math.round(y) + 'px';
        el.style.right = 'auto';
    }

    function bindViewportFit() {
        var view = pageWindow();
        if (!view || view.__payeCoachFitBound || typeof view.addEventListener !== 'function') return;
        view.__payeCoachFitBound = true;
        view.addEventListener('resize', function() {
            var node = document.getElementById('first-run-coach');
            fitCoachToViewport(node);
        });
    }

    function applySavedPosition(el) {
        fitCoachToViewport(el);
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

    var LAB_LESSONS = {
        '1': {
            title: 'Lesson 1 — Load the RPN sandbox',
            aim: 'This lesson trains you to load the RPN practice sandbox so the practice employees are listed.',
            steps: [
                'In the top menu click Free Payroll Practice.',
                'On Your Companies click Load RPN practice sandbox (Recommended first).',
                'Click Confirm.',
                'Click the company name Cloud Sandbox Ltd.'
            ]
        },
        '2': {
            title: 'Lesson 2 — Retrieve an RPN and run a preview',
            aim: 'This lesson trains you to retrieve an RPN and open a payslip from Calculate Preview.',
            steps: [
                'In the top menu click Free Payroll Practice.',
                'On Your Companies click Load RPN practice sandbox (Recommended first).',
                'Click Confirm.',
                'Click the company name Cloud Sandbox Ltd.',
                'Click the RPN tab.',
                'Click Retrieve RPN.',
                'Click the Run Payroll tab.',
                'Click Calculate Preview.',
                'Click an employee\'s line in the calculated Preview table.'
            ]
        },
        '4': {
            title: 'Lesson 4 — When Retrieve RPN fails',
            aim: 'This lesson trains you to read the designed Retrieve RPN failure for a PPSN ending in 0.',
            steps: [
                'In the top menu click Free Payroll Practice.',
                'On Your Companies click Load RPN practice sandbox (Recommended first).',
                'Click Confirm.',
                'Click the company name Cloud Sandbox Ltd.',
                'Click the RPN tab.',
                'Click Retrieve RPN.',
                'Click Daniel McCarthy\'s row (PPSN 7567890IJ).'
            ]
        },
        '5': {
            title: 'Lesson 5 — LPT on the payslip',
            aim: 'This lesson trains you to check Sofia OBrien\'s Local Property Tax of €45.00 on the payslip.',
            steps: [
                'In the top menu click Free Payroll Practice.',
                'On Your Companies click Load RPN practice sandbox (Recommended first).',
                'Click Confirm.',
                'Click the company name Cloud Sandbox Ltd.',
                'Click the RPN tab.',
                'Click Retrieve RPN.',
                'Click the Run Payroll tab.',
                'Click Calculate Preview.',
                'Click Sofia OBrien\'s line in the calculated Preview table (PPSN 7234567CD).'
            ]
        },
        '6': {
            title: 'Lesson 6 — Confirm and save the payroll run',
            aim: 'This lesson trains you to commit a calculated preview with Commit to Payroll so the run is stored in History.',
            steps: [
                'In the top menu click Free Payroll Practice.',
                'On Your Companies click Load RPN practice sandbox (Recommended first).',
                'Click Confirm.',
                'Click the company name Cloud Sandbox Ltd.',
                'Click the RPN tab.',
                'Click Retrieve RPN.',
                'Click the Run Payroll tab.',
                'Click Calculate Preview.',
                'Click Commit to Payroll.',
                'Click the History tab.'
            ]
        }
    };

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function labStepDone(text, progress) {
        var t = String(text || '').toLowerCase();
        if (t.indexOf('free payroll practice') !== -1) return true;
        if (t.indexOf('load rpn practice sandbox') !== -1 || t === 'click confirm.') return progress.sandboxLoaded;
        if (t.indexOf('cloud sandbox ltd') !== -1) return progress.companyOpen;
        if (t.indexOf('rpn tab') !== -1) return progress.sawRpnTab || progress.rpnRetrieved || progress.rpnAttempted;
        if (t.indexOf('retrieve rpn') !== -1) return progress.rpnRetrieved || progress.rpnAttempted;
        if (t.indexOf('run payroll tab') !== -1) return progress.sawRunTab || progress.hasPreview;
        if (t.indexOf('calculate preview') !== -1) return progress.hasPreview;
        if (t.indexOf('daniel') !== -1) return progress.failureRowSeen;
        if (t.indexOf('history tab') !== -1) return progress.historySeen;
        if (t.indexOf('confirm & save') !== -1 || t.indexOf('commit to payroll') !== -1) return progress.hasSavedRun;
        if (t.indexOf('line') !== -1) return progress.payslipOpened;
        return false;
    }

    function resetLabSession() {
        sessionDismissed = false;
        sessionPreviewDone = false;
        payslipOpened = false;
        sawRpnTab = false;
        sawRunTab = false;
        historySeen = false;
        failureRowSeen = false;
    }

    function renderLabSteps(progress, lesson) {
        var html = '<p class="first-run-coach-hint">' + escapeHtml(lesson.aim) + '</p>';
        html += '<ol class="first-run-coach-steps">';
        var foundCurrent = false;
        for (var i = 0; i < lesson.steps.length; i++) {
            var done = labStepDone(lesson.steps[i], progress);
            var cls = done ? 'is-done' : (!foundCurrent ? 'is-current' : 'is-todo');
            if (!done) foundCurrent = true;
            html += '<li class="' + cls + '"><span class="first-run-step-btn">' + escapeHtml(lesson.steps[i]) + '</span></li>';
        }
        html += '</ol>';
        return html;
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

        var progress = getProgress(company ? company.id : null);
        var collapsed = isCollapsed();
        var lesson = (inLabFrame() && LAB_LESSONS[labLesson]) ? LAB_LESSONS[labLesson] : null;
        if (collapsed) el.classList.add('is-collapsed');
        else el.classList.remove('is-collapsed');

        var html = resizeHandlesHtml();
        html += '<div class="first-run-coach-header">';
        html += '<div class="first-run-coach-heading">';
        html += '<h2 class="first-run-coach-title">The Coach</h2>';
        html += '<p class="first-run-coach-subtitle">' + (lesson ? escapeHtml(lesson.title) : 'RPN practice') + '</p>';
        html += '</div>';
        html += '<button type="button" class="btn btn-secondary btn-sm first-run-coach-toggle" data-first-run="toggle" aria-expanded="' + (collapsed ? 'false' : 'true') + '">';
        html += collapsed ? 'Show The Coach' : 'Collapse';
        html += '</button>';
        html += '</div>';
        if (!collapsed) {
        html += '<div class="first-run-coach-body">';
        if (lesson) {
            html += renderLabSteps(progress, lesson);
        } else {
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
        }
        if (!lesson && progress.payslipOpened) {
            html += '<p class="first-run-coach-complete">First run complete</p>';
        }
        if (sandboxReloadedNote) {
            html += '<p class="first-run-coach-hint">This loads the sandbox again.</p>';
        }
        html += '<div class="first-run-coach-actions">';
        html += '<button type="button" class="btn btn-secondary btn-sm" data-first-run="dismiss">Dismiss</button>';
        html += '<button type="button" class="btn btn-secondary btn-sm" data-first-run="never">Don\'t show again</button>';
        html += '<button type="button" class="btn btn-secondary btn-sm" data-first-run="restart">Restart first run</button>';
        html += '</div>';
        html += '</div>';
        }

        el.innerHTML = html;
        el.classList.remove('hidden');
        el.removeAttribute('hidden');
        applySavedPosition(el);
    }

    function showLabLesson(n) {
        var next = String(n || '');
        if (!isPayrollLabLesson(next)) {
            labLesson = '';
            refresh();
            return;
        }
        if (labLesson !== next) resetLabSession();
        labLesson = next;
        refresh();
    }

    function noteTab(tabName) {
        if (tabName === 'rpn') sawRpnTab = true;
        if (tabName === 'run') sawRunTab = true;
        if (tabName === 'history') historySeen = true;
        if (inLabFrame() && labLesson) refresh();
    }

    function noteRpnRow(empId) {
        var company = getCurrentCompany();
        var employees = [];
        if (company && typeof PayrollStorage !== 'undefined') {
            employees = PayrollStorage.loadEmployees(company.id) || [];
        }
        var emp = null;
        for (var i = 0; i < employees.length; i++) {
            if (employees[i] && employees[i].id === empId) emp = employees[i];
        }
        if (emp && emp.rpn && emp.rpn.retrievalError) failureRowSeen = true;
        if (inLabFrame() && labLesson) refresh();
    }

    function bindLabMessages() {
        var view = pageWindow();
        if (!view || view.__payeCoachLabBound || typeof view.addEventListener !== 'function') return;
        view.__payeCoachLabBound = true;
        view.addEventListener('message', function(event) {
            var data = event && event.data;
            if (!data || data.type !== 'paye-learn-lesson') return;
            try {
                if (event.origin && view.location && event.origin !== view.location.origin) return;
            } catch (e) {}
            if (!inLabFrame()) return;
            showLabLesson(data.lesson);
        });
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

    function storedCoachStepsRemain(companyId) {
        var employees = [];
        var savedRuns = [];
        if (companyId && typeof PayrollStorage !== 'undefined') {
            employees = PayrollStorage.loadEmployees(companyId) || [];
            savedRuns = PayrollStorage.loadPayrollRuns(companyId) || [];
        }
        var rpnRetrieved = employees.some(function(emp) {
            return !!(emp && emp.rpn && emp.rpn.rpnNumber);
        });
        return employees.length > 0 || rpnRetrieved || savedRuns.length > 0;
    }

    function restartFirstRun() {
        sessionPreviewDone = false;
        payslipOpened = false;
        sessionDismissed = false;
        suppressSandboxStep = false;
        sandboxReloadedNote = false;
        setCollapsed(false);
        if (typeof PayrollContext !== 'undefined') {
            PayrollContext.currentRunData = null;
        }

        var company = getCurrentCompany();
        if (company && isRpnSandboxCompany(company) && storedCoachStepsRemain(company.id)
            && typeof PayrollCompanies !== 'undefined' && PayrollCompanies.reloadRpnPracticeSandbox) {
            var loaded = PayrollCompanies.reloadRpnPracticeSandbox(company.id);
            if (loaded) {
                suppressSandboxStep = true;
                sandboxReloadedNote = true;
                if (typeof PayrollUI !== 'undefined' && PayrollUI.showMessage) {
                    PayrollUI.showMessage('This loads the sandbox again.', 'success');
                }
                if (typeof PayrollWorkspace !== 'undefined' && PayrollWorkspace.enterCompanyWorkspace) {
                    PayrollWorkspace.enterCompanyWorkspace(company.id);
                    return;
                }
            }
        }
        refresh();
    }

    function noteSandboxLoaded() {
        suppressSandboxStep = false;
        sandboxReloadedNote = false;
        refresh();
    }

    function resetSessionState() {
        sessionDismissed = false;
        sessionPreviewDone = false;
        payslipOpened = false;
        suppressSandboxStep = false;
        sandboxReloadedNote = false;
        labLesson = '';
        sawRpnTab = false;
        sawRunTab = false;
        historySeen = false;
        failureRowSeen = false;
    }

    return {
        HIDE_KEY: HIDE_KEY,
        LEGACY_HIDE_KEY: LEGACY_HIDE_KEY,
        COLLAPSED_KEY: COLLAPSED_KEY,
        POS_X_KEY: POS_X_KEY,
        POS_Y_KEY: POS_Y_KEY,
        POS_W_KEY: POS_W_KEY,
        POS_H_KEY: POS_H_KEY,
        init: init,
        showLabLesson: showLabLesson,
        noteTab: noteTab,
        noteRpnRow: noteRpnRow,
        refresh: refresh,
        shouldShow: shouldShow,
        isRpnSandboxCompany: isRpnSandboxCompany,
        getProgress: getProgress,
        markPreviewDone: markPreviewDone,
        markPayslipOpened: markPayslipOpened,
        dismiss: dismiss,
        neverShow: neverShow,
        restartFirstRun: restartFirstRun,
        noteSandboxLoaded: noteSandboxLoaded,
        resetSessionState: resetSessionState
    };
})();
