// payroll/payroll-rpn.js — RPN retrieval and overview (cloud mode)

var PayrollRPN = (function() {
    'use strict';

    var deps = {};

    function init(dependencies) {
        deps = dependencies || {};
    }

    function getSelectedYear() {
        return typeof deps.getSelectedYear === 'function' ? deps.getSelectedYear() : '2026';
    }

    function callDep(name) {
        var fn = deps[name];
        if (typeof fn === 'function') {
            return fn.apply(null, Array.prototype.slice.call(arguments, 1));
        }
    }

    function mapRevenueRPNToEmployee(employee, result, payload) {
        const existing = employee.rpn || {};
        const annualTaxCredits = PayrollUtils.toFiniteNumber(result.yearlyTaxCredit, PayrollUtils.toFiniteNumber(result.taxCredits, existing.taxCredits || existing.annualTaxCredits));
        const annualCutOffPoint = PayrollUtils.toFiniteNumber(result.yearlyStandardRateCutOffPoint, PayrollUtils.toFiniteNumber(result.cutOffPoint, existing.cutOffPoint));
        const payFrequency = PayrollTax.getEmployeePayFrequency(employee);
        const periodsPerYear = PayrollUtils.getPeriodsPerYearForFrequency(payFrequency);

        return Object.assign({}, existing, {
            rpnNumber: String(result.rpnNumber || existing.rpnNumber || ''),
            taxYear: result.taxYear || getSelectedYear(),
            taxCredits: annualTaxCredits,
            annualTaxCredits: annualTaxCredits,
            cutOffPoint: annualCutOffPoint,
            periodicTaxCredit: annualTaxCredits / periodsPerYear,
            periodicStandardRateCutOffPoint: annualCutOffPoint / periodsPerYear,
            period: PayrollUtils.getPayFrequencyLabel(payFrequency),
            payFrequency: payFrequency,
            periodsPerYear: periodsPerYear,
            prsiClass: result.prsiClass || existing.prsiClass || employee.prsiClass || 'A1',
            uscStatus: result.uscStatus || existing.uscStatus || 'Normal',
            employerPrsiClass: result.employerPrsiClass || existing.employerPrsiClass || result.prsiClass || 'A1',
            previousPay: PayrollUtils.toFiniteNumber(result.previousPayYTD, PayrollUtils.toFiniteNumber(result.previousPay, existing.previousPay)),
            previousTax: PayrollUtils.toFiniteNumber(result.previousTaxYTD, PayrollUtils.toFiniteNumber(result.previousTax, existing.previousTax)),
            previousUSC: PayrollUtils.toFiniteNumber(result.previousUSCYTD, PayrollUtils.toFiniteNumber(result.previousUSC, existing.previousUSC)),
            lptDeduction: PayrollUtils.toFiniteNumber(result.lptDeduction, existing.lptDeduction),
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
        const payFrequency = PayrollTax.getEmployeePayFrequency(employee);
        return Object.assign({}, existing, {
            ppsn: result && result.ppsn ? result.ppsn : employee.ppsNumber || '',
            employmentId: result && result.employmentId ? result.employmentId : employee.id,
            period: PayrollUtils.getPayFrequencyLabel(payFrequency),
            payFrequency: payFrequency,
            periodsPerYear: PayrollUtils.getPeriodsPerYearForFrequency(payFrequency),
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
        if (!PayrollContext.currentCompanyId) {
            PayrollUI.showMessage('Select a company before retrieving RPN.', 'error');
            return;
        }

        if (!PayrollTax.isCloudMode()) {
            PayrollUI.showMessage('RPN retrieval is only available in Cloud mode.', 'error');
            return;
        }

        const employees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];
        if (employees.length === 0) {
            PayrollUI.showMessage('No employees found. Add employees before retrieving RPN.', 'error');
            return;
        }

        const company = PayrollStorage.getCompany(PayrollContext.currentCompanyId) || {};
        const originalText = button ? button.textContent : '';
        if (button) {
            button.disabled = true;
            button.textContent = 'Retrieving...';
        }

        try {
            const requestPayload = {
                employerRegistrationNumber: PayrollCompanies.getCompanyTaxNumber(company) || '1234567T',
                taxYear: parseInt(company.taxYear || getSelectedYear(), 10) || 2026,
                employees: employees.map(function(emp) {
                    return {
                        ppsn: emp.ppsNumber || '',
                        employmentId: emp.id,
                        employmentCommencementDate: emp.startDate || emp.employmentCommencementDate || ''
                    };
                })
            };

            const payload = typeof RevenueApi !== 'undefined'
                ? await RevenueApi.retrieveRPN(requestPayload)
                : null;

            if (!payload) {
                throw new Error('Revenue API is unavailable');
            }
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

            if (!PayrollStorage.saveEmployees(PayrollContext.currentCompanyId, employees)) {
                throw new Error('Failed to save retrieved RPN data');
            }

            PayrollTax.initOrSyncLedger(PayrollContext.currentCompanyId, company.taxYear || getSelectedYear());

            if (typeof PayrollStateMachine !== 'undefined' && PayrollStateMachine.dismissRPNSuggestion) {
                PayrollStateMachine.dismissRPNSuggestion();
            }

            renderRPNOverview();
            callDep('syncAllTables');

            if (errors.length > 0) {
                PayrollUI.showMessage('Retrieved RPN for ' + updated + ' employee(s). ' + errors.length + ' employee(s) returned errors.', updated > 0 ? 'success' : 'error');
                console.warn('RPN retrieval errors:', errors);
            } else {
                PayrollUI.showMessage('Retrieved RPN for ' + updated + ' employee(s) from fake Revenue server.', 'success');
            }
        } catch (err) {
            PayrollUI.showMessage('RPN retrieval failed: ' + err.message, 'error');
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = originalText || 'Retrieve RPN';
            }
        }
    }

    function renderRPNOverview() {
        const container = document.getElementById('rpn-content');
        if (!container) return;

        if (!PayrollContext.currentCompanyId) {
            container.innerHTML = '<div class="empty-state">Select a company to view RPN data.</div>';
            return;
        }

        const employees = PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) || [];
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
            const validRpn = PayrollTax.hasValidRPN(emp);
            const error = rpn.retrievalError;
            const status = error ? 'Error' : validRpn ? 'Retrieved' : 'Not retrieved';
            const payeMode = validRpn ? 'RPN ' + rpn.rpnNumber : 'Emergency';
            html += '<tr class="rpn-row-clickable' + (error ? ' rpn-error-row' : '') + '" data-emp-id="' + PayrollUtils.escapeHtml(emp.id) + '">';
            html += '<td>' + PayrollUtils.escapeHtml(name) + '</td>';
            html += '<td>' + PayrollUtils.escapeHtml(emp.ppsNumber || rpn.ppsn || '') + '</td>';
            html += '<td>' + PayrollUtils.escapeHtml(status) + '</td>';
            html += '<td>' + PayrollUtils.escapeHtml(payeMode) + '</td>';
            html += '<td>' + PayrollUtils.escapeHtml(rpn.rpnNumber || '') + '</td>';
            html += '<td>' + PayrollUtils.escapeHtml(rpn.period || PayrollUtils.getPayFrequencyLabel(PayrollTax.getEmployeePayFrequency(emp))) + '</td>';
            html += '<td>' + PayrollUtils.escapeHtml(rpn.taxYear || '') + '</td>';
            html += '<td>' + PayrollUtils.escapeHtml(rpn.basis || '') + '</td>';
            html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(validRpn ? PayrollTax.getEmployeeAnnualTaxCredits(emp) : 0) + '</td>';
            html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(rpn.periodicTaxCredit || 0) + '</td>';
            html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(validRpn ? PayrollTax.getEmployeeCutOffPoint(emp) : 0) + '</td>';
            html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(rpn.periodicStandardRateCutOffPoint || 0) + '</td>';
            html += '<td>' + PayrollUtils.escapeHtml(rpn.prsiClass || 'A') + '</td>';
            html += '<td>' + PayrollUtils.escapeHtml(rpn.uscStatus || 'Normal') + '</td>';
            html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(rpn.previousPay || 0) + '</td>';
            html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(rpn.previousTax || 0) + '</td>';
            html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(rpn.previousUSC || 0) + '</td>';
            html += '<td class="text-right">' + PayrollUtils.safeFormatCurrency(rpn.lptDeduction || 0) + '</td>';
            html += '<td>' + PayrollUtils.escapeHtml(rpn.requestId || '') + '</td>';
            html += '<td>' + PayrollUtils.escapeHtml(formatRPNDate(rpn.retrievedAt || rpn.serverTimestamp)) + '</td>';
            html += '<td class="' + (error ? 'rpn-error-text' : '') + '">' + PayrollUtils.escapeHtml(error ? ((error.code || 'ERROR') + ': ' + (error.message || '')) : (rpn.message || '')) + '</td>';
            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;

        container.querySelectorAll('.rpn-row-clickable').forEach(function(row) {
            row.addEventListener('click', function() {
                const empId = row.dataset.empId;
                callDep('switchTab', 'employees');
                if (typeof PayrollEmployees !== 'undefined' && PayrollEmployees.showEmployeeForm) {
                    PayrollEmployees.showEmployeeForm(empId);
                }
            });
        });

        const retrieveBtn = document.getElementById('rpn-retrieve-btn');
        if (retrieveBtn) {
            retrieveBtn.addEventListener('click', function() {
                const apiBase = typeof RevenueApi !== 'undefined' ? RevenueApi.getBaseUrl() : 'http://localhost:3001';
                PayrollUI.showConfirmModal('Retrieve RPN from the fake Revenue server? This will update all employee RPN fields using ' + apiBase + '/rpn.', function() {
                    retrieveRPNFromRevenueServer(retrieveBtn);
                });
            });
        }
    }

    return {
        init: init,
        mapRevenueRPNToEmployee: mapRevenueRPNToEmployee,
        mapRevenueRPNErrorToEmployee: mapRevenueRPNErrorToEmployee,
        formatRPNDate: formatRPNDate,
        retrieveRPNFromRevenueServer: retrieveRPNFromRevenueServer,
        renderRPNOverview: renderRPNOverview
    };
})();