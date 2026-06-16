// payroll/payroll-submission.js — Cloud submission payload and Revenue submit

var PayrollSubmission = (function() {
    'use strict';

    var deps = {};

    function init(dependencies) {
        deps = dependencies || {};
    }

    function getSelectedYear() {
        return typeof deps.getSelectedYear === 'function' ? deps.getSelectedYear() : '2026';
    }

    function submitPeriod(skipConfirm) {
        if (typeof deps.submitPeriod === 'function') {
            return deps.submitPeriod(skipConfirm);
        }
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
            employerRegistrationNumber: PayrollCompanies.getEmployerRegistrationNumber(),
            taxYear: parseInt((run && run.taxYear) || getSelectedYear(), 10),
            payPeriod: getSubmissionPayPeriod(run || {}),
            timestamp: new Date().toISOString(),
            message: payloadStatus === 'ACCEPTED' ? 'Payroll Submission accepted (FAKE)' : 'Payroll Submission ready (FAKE)',
            runId: run ? run.id : '',
            runIds: run ? [run.id] : [],
            summary: summary
        };
    }

    function upsertSubmissionFromRun(run, status) {
        if (!PayrollContext.currentCompanyId || !run) return null;
        const submissions = PayrollStorage.loadSubmissions(PayrollContext.currentCompanyId) || [];
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
        PayrollStorage.saveSubmissions(PayrollContext.currentCompanyId, submissions);
        return existingIndex >= 0 ? submissions[existingIndex] : payload;
    }

    function getLatestSubmissionRun() {
        const runs = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];
        const pending = runs.filter(function(run) { return run.status === 'committed'; });
        const source = pending.length > 0 ? pending : runs;
        source.sort(function(a, b) { return new Date(b.runDate) - new Date(a.runDate); });
        return source[0] || null;
    }

    function getLatestSubmissionRecord() {
        const submissions = PayrollStorage.loadSubmissions(PayrollContext.currentCompanyId) || [];
        submissions.sort(function(a, b) { return new Date(b.timestamp || b.submittedAt || 0) - new Date(a.timestamp || a.submittedAt || 0); });
        return submissions[0] || null;
    }

    function renderSubmission() {
        const list = document.getElementById('submission-list');
        const output = document.getElementById('submission-form-output');
        if (!list) return;
        if (!PayrollContext.currentCompanyId) {
            list.innerHTML = '<div class="empty-state">Select a company to view submissions.</div>';
            if (output) output.classList.add('hidden');
            return;
        }
        const submissions = PayrollStorage.loadSubmissions(PayrollContext.currentCompanyId) || [];
        submissions.sort(function(a, b) { return new Date(b.timestamp || b.submittedAt || 0) - new Date(a.timestamp || a.submittedAt || 0); });
        if (submissions.length === 0) {
            list.innerHTML = '<div class="empty-state">No submissions generated yet. Commit payroll, then click Generate Submission to create the submission file.</div>';
        } else {
            let html = '<div class="table-container"><table class="results-table submission-table"><thead><tr>';
            html += '<th>Submission ID</th><th>Status</th><th>Employer Reg.</th><th>Tax Year</th><th>Pay Period</th><th>Timestamp</th>';
            html += '<th class="text-right">Gross</th><th class="text-right">PAYE</th><th class="text-right">USC</th><th class="text-right">PRSI</th><th>Message</th>';
            html += '</tr></thead><tbody>';
            submissions.forEach(function(item) {
                const summary = item.summary || {};
                html += '<tr>';
                html += '<td>' + PayrollUtils.escapeHtml(item.submissionId || item.id || '') + '</td>';
                html += '<td>' + PayrollUtils.escapeHtml(item.status || 'READY') + '</td>';
                html += '<td>' + PayrollUtils.escapeHtml(item.employerRegistrationNumber || PayrollCompanies.getEmployerRegistrationNumber()) + '</td>';
                html += '<td>' + PayrollUtils.escapeHtml(String(item.taxYear || getSelectedYear())) + '</td>';
                html += '<td>' + PayrollUtils.escapeHtml(item.payPeriod || '') + '</td>';
                html += '<td>' + PayrollUtils.escapeHtml(PayrollUtils.formatLocalDateTime(item.timestamp || item.submittedAt || '')) + '</td>';
                html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(summary.totalGrossPay || 0) + '</td>';
                html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(summary.totalPAYE || 0) + '</td>';
                html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(summary.totalUSC || 0) + '</td>';
                html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(summary.totalPRSI || 0) + '</td>';
                html += '<td>' + PayrollUtils.escapeHtml(item.message || '') + '</td>';
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
            PayrollUtils.escapeHtml(JSON.stringify(payload, null, 2)) +
            '</textarea>';
    }

    function generateSubmissionPayload() {
        if (!PayrollTax.isCloudMode()) {
            PayrollUI.showMessage('Submission is only available in Cloud mode.', 'error');
            return null;
        }

        const run = getLatestSubmissionRun();
        if (!run) {
            PayrollUI.showMessage('No payroll run available to generate a submission.', 'error');
            return null;
        }
        const payload = upsertSubmissionFromRun(run, 'ACCEPTED');
        renderSubmission();
        renderSubmissionPayload(payload);
        PayrollUI.showMessage('Submission generated.', 'success');
        return payload;
    }

    function buildPSRRequest(run) {
        const employees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];
        const employeeMap = {};
        employees.forEach(function(emp) {
            employeeMap[emp.id] = emp;
        });

        return {
            employerRegistrationNumber: PayrollCompanies.getEmployerRegistrationNumber(),
            taxYear: parseInt((run && run.taxYear) || getSelectedYear(), 10),
            payPeriod: getSubmissionPayPeriod(run || {}),
            employees: (run && run.entries ? run.entries : []).map(function(entry) {
                const emp = employeeMap[entry.employeeId] || {};
                return {
                    employmentId: entry.employeeId,
                    ppsn: emp.ppsNumber || '',
                    grossPay: entry.grossPay || 0,
                    paye: entry.paye || 0,
                    usc: entry.usc || 0,
                    prsi: entry.prsi || 0
                };
            })
        };
    }

    function refreshCloudTaxValuesAfterSubmit(run) {
        if (!PayrollContext.currentCompanyId || !run) return;

        const year = run.taxYear || getSelectedYear();
        PayrollTax.initOrSyncLedger(PayrollContext.currentCompanyId, year);
        const ledger = PayrollStorage.loadTaxCreditsLedger(PayrollContext.currentCompanyId);
        const employees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];

        employees.forEach(function(emp) {
            const entry = ledger[emp.id] && ledger[emp.id][year];
            if (!entry) return;

            const payFrequency = PayrollTax.getEmployeePayFrequency(emp);
            const periods = PayrollUtils.getPeriodsPerYearForFrequency(payFrequency);
            const remainingTC = Math.max((entry.annualTaxCredits || 0) - (entry.taxCreditsUsed || 0), 0);
            const annualCOP = entry.cutOffPoint || 0;
            const periodicCOP = PayrollUtils.getLocalPeriodicCOP
                ? PayrollUtils.getLocalPeriodicCOP(annualCOP, periods)
                : annualCOP / periods;

            emp.rpn = Object.assign({}, emp.rpn || {}, {
                annualTaxCredits: entry.annualTaxCredits || 0,
                taxCredits: remainingTC,
                cutOffPoint: annualCOP,
                periodicTaxCredit: remainingTC / periods,
                periodicStandardRateCutOffPoint: periodicCOP,
                period: PayrollUtils.getPayFrequencyLabel(payFrequency),
                payFrequency: payFrequency,
                periodsPerYear: periods,
                source: 'submission-refresh'
            });
        });

        PayrollStorage.saveEmployees(PayrollContext.currentCompanyId, employees);
    }

    async function submitSubmissionToRevenue() {
        if (!PayrollTax.isCloudMode()) {
            PayrollUI.showMessage('Submission to Revenue is only available in Cloud mode.', 'error');
            return;
        }

        let payload = getLatestSubmissionRecord();
        const run = getLatestSubmissionRun();
        if (!payload || !run) {
            PayrollUI.showMessage('Generate a submission before submitting to Revenue.', 'error');
            return;
        }

        const submitBtn = document.getElementById('submit-revenue-btn');
        const originalText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }

        try {
            const psrRequest = buildPSRRequest(run);
            const response = typeof RevenueApi !== 'undefined'
                ? await RevenueApi.submitPSR(psrRequest)
                : null;

            if (!response) {
                throw new Error('Revenue API is unavailable');
            }

            payload = upsertSubmissionFromRun(run, response.status || 'ACCEPTED');
            payload.submissionId = response.submissionId || payload.submissionId;
            payload.message = response.message || payload.message;
            payload.summary = response.summary || payload.summary;
            payload.timestamp = response.timestamp || new Date().toISOString();
            PayrollStorage.saveSubmissions(PayrollContext.currentCompanyId, (PayrollStorage.loadSubmissions(PayrollContext.currentCompanyId) || []).map(function(item) {
                return item.id === payload.id ? payload : item;
            }));

            submitPeriod(true);
            refreshCloudTaxValuesAfterSubmit(run);
            renderSubmission();
            renderSubmissionPayload(payload);
            PayrollUI.showMessage('Payroll submitted to fake Revenue server and period advanced.', 'success');
        } catch (err) {
            PayrollUI.showMessage('Revenue submission failed: ' + err.message, 'error');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText || 'Submit to Revenue';
            }
        }
    }

    return {
        init: init,
        getSubmissionPayPeriod: getSubmissionPayPeriod,
        summarizeRunForSubmission: summarizeRunForSubmission,
        roundSubmissionSummary: roundSubmissionSummary,
        buildSubmissionPayload: buildSubmissionPayload,
        upsertSubmissionFromRun: upsertSubmissionFromRun,
        getLatestSubmissionRun: getLatestSubmissionRun,
        getLatestSubmissionRecord: getLatestSubmissionRecord,
        renderSubmission: renderSubmission,
        renderSubmissionPayload: renderSubmissionPayload,
        generateSubmissionPayload: generateSubmissionPayload,
        buildPSRRequest: buildPSRRequest,
        refreshCloudTaxValuesAfterSubmit: refreshCloudTaxValuesAfterSubmit,
        submitSubmissionToRevenue: submitSubmissionToRevenue
    };
})();