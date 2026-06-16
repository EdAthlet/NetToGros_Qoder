// payroll/PayrollPayslip.js — extracted in Phase 2 (Path A)
// Wired from payroll.js via PayrollPayslip.init()

var PayrollPayslip = (function() {
    'use strict';

    var deps = {};

    function escapeHtml(text) {
        return PayrollUtils.escapeHtml(text);
    }
    function safeFormatCurrency(amount) {
        return PayrollUtils.safeFormatCurrency(amount);
    }

    function init(dependencies) {
        deps = dependencies || {};
    }

    function callDep(name) {
        var fn = deps[name];
        return typeof fn === 'function' ? fn.apply(null, Array.prototype.slice.call(arguments, 1)) : undefined;
    }

    function getEmployeeAnnualTaxCredits() { return deps.getEmployeeAnnualTaxCredits.apply(deps, arguments); }
    function getEmployeeCutOffPoint() { return deps.getEmployeeCutOffPoint.apply(deps, arguments); }
    function initOrSyncLedger() { return deps.initOrSyncLedger.apply(deps, arguments); }
    function getCompanyTaxNumber() { return deps.getCompanyTaxNumber.apply(deps, arguments); }
    function getEmployerRegistrationNumber() { return deps.getEmployerRegistrationNumber.apply(deps, arguments); }
    function generatePeriodLabel() { return deps.generatePeriodLabel.apply(deps, arguments); }
    function switchTab() { return deps.switchTab.apply(deps, arguments); }
    function exportPayslipCSV(entry, run) {
        if (typeof PayrollExports !== 'undefined' && PayrollExports.exportPayslipCSV) {
            PayrollExports.exportPayslipCSV(entry, run);
        }
    }

    function showPayslip(runId, employeeId) {
        if (!PayrollContext.currentCompanyId) return;
        const runs = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId);
        const run = runs.find(function(r) { return r.id === runId; });
        if (!run) return;

        const entry = run.entries.find(function(e) { return e.employeeId === employeeId; });
        if (!entry) return;

        const entries = run.entries;
        const currentIndex = entries.findIndex(function(e) { return e.employeeId === employeeId; });
        showPayslipFromEntry(entry, run, entries, currentIndex);
    }

    function getTaxBasisLabel(entry, employee) {
        if (entry.payeMode && entry.payeMode.indexOf('EMERGENCY') === 0) {
            return 'Emergency';
        }

        var rpn = entry.rpnSnapshot || (employee && employee.rpn) || {};
        var basis = String(rpn.basis || '').trim().toLowerCase();

        if (basis) {
            if (basis.indexOf('emergency') >= 0) {
                return 'Emergency';
            }
            if ((basis.indexOf('week') >= 0 && basis.indexOf('1') >= 0) ||
                (basis.indexOf('month') >= 0 && basis.indexOf('1') >= 0) ||
                (basis.indexOf('non') >= 0 && basis.indexOf('cumul') >= 0) ||
                basis === 'w1' || basis === 'm1' || basis === 'week1' || basis === 'month1') {
                return 'Week 1/Non-Cumulative';
            }
            if (basis.indexOf('cumul') >= 0) {
                return 'Cumulative';
            }
        }

        return 'Cumulative';
    }

    function resolveEntryCalcResult(entry, run, employee) {
        if (entry._payeBreakdown || entry._uscBreakdown || entry._prsiBreakdown) {
            return {
                payeBreakdown: entry._payeBreakdown || null,
                uscBreakdown: entry._uscBreakdown || null,
                prsiBreakdown: entry._prsiBreakdown || null
            };
        }

        try {
            var entryFreq = entry.payFrequency || (run ? run.frequency : activeTab);
            var freqMult = entryFreq === 'weekly' ? 52 : entryFreq === 'fortnightly' ? 26 : 12;
            var annualGross = (entry.grossPay || 0) * freqMult;
            var savedTab = activeTab;
            activeTab = entryFreq;
            var result = calculateNetFromGross(annualGross, employee ? employee.familyStatus : 'single');
            activeTab = savedTab;
            return result;
        } catch (e) {
            console.error('Breakdown calculation error:', e);
            return null;
        }
    }

    function buildEmployeeCardPayslipHtml(entry, run, employee, periodNumber) {
        var calcResult = resolveEntryCalcResult(entry, run, employee);
        var frequency = entry.payFrequency || (run ? run.frequency : activeTab);
        var freqDivisor = frequency === 'weekly' ? 52 : frequency === 'fortnightly' ? 26 : 12;
        var freqLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);
        var runDate = run ? new Date(run.runDate) : new Date();
        var dateStr = runDate.toLocaleDateString('en-IE') + ' ' + runDate.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
        var rpn = entry.rpnSnapshot || (employee && employee.rpn) || {};
        var annualTC = entry.payeMode && entry.payeMode.indexOf('EMERGENCY') === 0
            ? (rpn.taxCredits || 0)
            : (rpn.taxCredits || rpn.annualTaxCredits || getEmployeeAnnualTaxCredits(employee));
        var annualCOP = entry.payeMode && entry.payeMode.indexOf('EMERGENCY') === 0
            ? (rpn.cutOffPoint || 0)
            : (rpn.cutOffPoint || getEmployeeCutOffPoint(employee));
        var appliedTC = entry.taxCreditsUsed || 0;
        var periodTC = appliedTC > 0
            ? appliedTC
            : (rpn.periodicTaxCredit !== undefined
                ? (parseFloat(rpn.periodicTaxCredit) || 0)
                : (annualTC / freqDivisor));
        var periodCOP = rpn.periodicStandardRateCutOffPoint !== undefined
            ? (parseFloat(rpn.periodicStandardRateCutOffPoint) || 0)
            : (annualCOP / freqDivisor);
        var pensionDeduction = entry.pensionDeduction || 0;
        var bikAmount = entry.bikAmount || 0;
        var thisPeriodTotalDed = entry.totalDeductions || ((entry.paye || 0) + (entry.usc || 0) + (entry.prsi || 0) + pensionDeduction);
        var displayNetPay = typeof entry.netPay === 'number' ? entry.netPay : (entry.grossPay || 0) - thisPeriodTotalDed;
        var taxBasisLabel = getTaxBasisLabel(entry, employee);

        var html = '<div class="emp-card-payslip">';
        html += '<div class="emp-card-payslip-meta">';
        html += '<div><strong>Period ' + escapeHtml(String(periodNumber || '')) + '</strong> &middot; ' + escapeHtml(freqLabel) + '</div>';
        html += '<div class="emp-card-payslip-date">' + escapeHtml(dateStr) + '</div>';
        html += '</div>';

        html += '<table class="emp-card-payslip-summary">';
        html += '<tbody>';
        html += '<tr><td>Gross Pay</td><td class="text-right">' + safeFormatCurrency(entry.grossPay) + '</td></tr>';
        html += '<tr><td>PAYE</td><td class="text-right">' + safeFormatCurrency(entry.paye) + '</td></tr>';
        html += '<tr><td>USC</td><td class="text-right">' + safeFormatCurrency(entry.usc) + '</td></tr>';
        html += '<tr><td>PRSI</td><td class="text-right">' + safeFormatCurrency(entry.prsi) + '</td></tr>';
        if (pensionDeduction > 0) {
            html += '<tr><td>Pension</td><td class="text-right">' + safeFormatCurrency(pensionDeduction) + '</td></tr>';
        }
        html += '<tr class="emp-card-payslip-net"><td>Net Pay</td><td class="text-right">' + safeFormatCurrency(displayNetPay) + '</td></tr>';
        html += '</tbody></table>';

        html += '<div class="emp-card-payslip-tax-grid">';
        html += '<div><span>Annual Tax Credit</span><strong>' + safeFormatCurrency(annualTC) + '</strong></div>';
        html += '<div><span>Period Tax Credit</span><strong>' + safeFormatCurrency(periodTC) + '</strong></div>';
        html += '<div><span>Annual COP</span><strong>' + safeFormatCurrency(annualCOP) + '</strong></div>';
        html += '<div><span>Period COP</span><strong>' + safeFormatCurrency(periodCOP) + '</strong></div>';
        html += '<div><span>Tax basis</span><strong>' + escapeHtml(taxBasisLabel) + '</strong></div>';
        html += '<div><span>TC Applied</span><strong>' + safeFormatCurrency(appliedTC) + '</strong></div>';
        html += '</div>';

        html += '<h4 class="emp-card-payslip-calc-title">Calculation Breakdown</h4>';
        html += '<div class="emp-card-payslip-calc">';
        html += renderBreakdownSteps(buildBreakdownSteps(entry, employee, calcResult, {
            annualTC: annualTC,
            periodTC: periodTC,
            appliedTC: appliedTC,
            freqLabel: freqLabel,
            freqDivisor: freqDivisor
        }));
        html += '</div>';
        html += '</div>';

        return html;
    }

    function renderEmployeeCardPayslipPanel(entry, run, employeeId, periodNumber) {
        var panel = document.getElementById('employee-payslip-panel');
        var note = document.getElementById('employee-payslip-note');
        if (!panel) return;

        var employees = PayrollContext.currentCompanyId ? PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) : [];
        var employee = employees.find(function(e) { return e.id === (employeeId || entry.employeeId); });
        panel.innerHTML = buildEmployeeCardPayslipHtml(entry, run, employee, periodNumber);
        if (note) {
            note.textContent = 'Viewing Period ' + (periodNumber || '') + ' payslip calculation.';
        }
    }

    function clearEmployeeCardPayslipPanel() {
        var panel = document.getElementById('employee-payslip-panel');
        var note = document.getElementById('employee-payslip-note');
        if (panel) panel.innerHTML = '';
        if (note) {
            note.textContent = 'Select a payroll history row to view the calculation breakdown.';
        }
    }

    function generatePayeBreakdownHtml(calcResult, entryPAYE, freqDivisor, appliedPeriodTC) {
        if (!calcResult || !calcResult.payeBreakdown) {
            return '<div class="calc-step-equation">Result: ' + safeFormatCurrency(entryPAYE) + '</div>';
        }
        var html = '';
        var pb = calcResult.payeBreakdown;
        var divisor = freqDivisor || 52;
        var periodTC = appliedPeriodTC != null && appliedPeriodTC !== ''
            ? (parseFloat(appliedPeriodTC) || 0)
            : (pb.periodTaxCredits != null ? pb.periodTaxCredits : (pb.taxCredits / divisor));
        var periodGrossTax = 0;
        pb.bands.forEach(function(band) {
            html += '<div class="calc-step-equation">' + safeFormatCurrency(band.taxableAmount) + ' @ ' + escapeHtml(band.rateDisplay) + '% = ' + safeFormatCurrency(band.tax) + ' &nbsp;&nbsp;(' + escapeHtml(band.description) + ')</div>';
            periodGrossTax += band.tax;
        });
        html += '<div class="calc-step-equation">Gross Tax: ' + safeFormatCurrency(periodGrossTax) + '</div>';
        html += '<div class="calc-step-equation">Tax Credits: &minus;' + safeFormatCurrency(periodTC) + '</div>';
        html += '<div class="calc-step-equation">Net PAYE: ' + safeFormatCurrency(entryPAYE) + '</div>';
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
            html: generatePayeBreakdownHtml(calcResult, entry.paye, freqDivisor, appliedTC)
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

    function getInsurableWeeksForPayFrequency(payFrequency) {
        if (payFrequency === 'fortnightly') return 2;
        if (payFrequency === 'monthly') return 4;
        return 1;
    }

    /**
     * PRSI insurable weeks YTD from submitted payrolls only, for the employee's pay frequency.
     * Weekly: 1 week per submitted period (aligns with periodNumber when periods are sequential).
     */
    function computePrsiWeeksToDate(employeeId, taxYear, payFrequency) {
        var runs = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];
        var total = 0;
        var freq = payFrequency || 'monthly';

        runs.forEach(function(r) {
            if (String(r.taxYear) !== String(taxYear)) return;
            if (r.status !== 'submitted') return;
            (r.entries || []).forEach(function(e) {
                if (e.employeeId !== employeeId) return;
                var entryFreq = e.payFrequency || freq;
                if (entryFreq !== freq) return;
                total += getInsurableWeeksForPayFrequency(entryFreq);
            });
        });

        return total;
    }

    function computeYTD(employeeId, taxYear, currentRunId) {
        var runs = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];
        var ytd = {
            grossPay: 0,
            paye: 0,
            usc: 0,
            prsi: 0,
            employerPrsi: 0,
            totalDeductions: 0,
            taxCreditsUsed: 0,
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
                ytd.pensionDeductions += e.pensionDeduction || 0;
                ytd.bikAmount += e.bikAmount || 0;
            });
        });

        return ytd;
    }

    function getPayslipEmployeeNumber(employee) {
        return employee ? (employee.employeeNumber || employee.employeeNo || employee.personnelNumber || employee.id || '') : '';
    }

    function showPayslipFromEntry(entry, run, entries, currentIndex) {
        const company = PayrollContext.currentCompanyId ? (PayrollStorage.getCompany(PayrollContext.currentCompanyId) || {}) : {};
        const employees = PayrollContext.currentCompanyId ? PayrollStorage.loadEmployees(PayrollContext.currentCompanyId) : [];
        const employee = employees.find(function(e) { return e.id === entry.employeeId; });
        const container = document.getElementById('payslip-content');
        if (!container) return;

        // Store navigation context
        PayrollContext.currentPayslipContext = {
            run: run || PayrollContext.currentRunData,
            entries: entries || (run ? run.entries : (PayrollContext.currentRunData ? PayrollContext.currentRunData.entries : [])),
            currentIndex: typeof currentIndex === 'number' ? currentIndex : -1
        };

        var calcResult = resolveEntryCalcResult(entry, run, employee);

        const frequency = entry.payFrequency || (run ? run.frequency : activeTab);
        const freqDivisor = frequency === 'weekly' ? 52 : frequency === 'fortnightly' ? 26 : 12;
        const freqLabel = frequency.charAt(0).toUpperCase() + frequency.slice(1);
        const runDate = run ? new Date(run.runDate) : new Date();
        const taxYear = run ? run.taxYear : selectedYear;
        const periodNumber = entry.periodNumber ? entry.periodNumber :
            (run && run.periodNumbers && run.periodNumbers[frequency]) ? run.periodNumbers[frequency] :
            (run && run.periodNumber) ? run.periodNumber :
            (function() {
                var sm = (typeof PayrollStateMachine !== 'undefined') ? PayrollStateMachine.getState() : null;
                if (sm && sm[frequency]) return sm[frequency].periodNumber || 1;
                if (sm && sm.currentPeriodNumber) return sm.currentPeriodNumber;
                return 1;
            })();

        const rpn = entry.rpnSnapshot || (employee && employee.rpn) || {};
        const annualTC = entry.payeMode && entry.payeMode.indexOf('EMERGENCY') === 0 ? ((rpn.taxCredits || 0)) : (rpn.taxCredits || getEmployeeAnnualTaxCredits(employee));
        const annualCOP = entry.payeMode && entry.payeMode.indexOf('EMERGENCY') === 0 ? ((rpn.cutOffPoint || 0)) : (rpn.cutOffPoint || getEmployeeCutOffPoint(employee));
        const appliedTC = entry.taxCreditsUsed || 0;
        const periodTC = appliedTC > 0
            ? appliedTC
            : (rpn.periodicTaxCredit !== undefined ? (parseFloat(rpn.periodicTaxCredit) || 0) : (annualTC / freqDivisor));
        const periodCOP = rpn.periodicStandardRateCutOffPoint !== undefined ? (parseFloat(rpn.periodicStandardRateCutOffPoint) || 0) : (annualCOP / freqDivisor);
        const prsiClass = rpn.prsiClass || (employee ? employee.prsiClass : '') || 'A1';
        const taxBasisLabel = getTaxBasisLabel(entry, employee);

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
        const ytdTaxablePay = ytdGross - ytdPension + ytdBik;
        const prsiWeeksToDate = computePrsiWeeksToDate(entry.employeeId, taxYear, frequency);
        const ytdTaxCredits = ytd.taxCreditsUsed + (entry.taxCreditsUsed || 0);
        const thisPeriodTotalDed = entry.totalDeductions || ((entry.paye || 0) + (entry.usc || 0) + (entry.prsi || 0) + pensionDeduction);
        const ytdTotalDed = ytd.totalDeductions + thisPeriodTotalDed;
        const ytdTakeHome = ytdGross - ytdTotalDed;
        const displayNetPay = typeof entry.netPay === 'number' ? entry.netPay : (entry.grossPay || 0) - thisPeriodTotalDed;

        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const dateFormatted = String(runDate.getDate()).padStart(2, '0') + '-' + months[runDate.getMonth()] + '-' + String(runDate.getFullYear()).slice(-2);
        const payPeriodCode = String(taxYear) + String(periodNumber).padStart(2, '0');
        const employeeNumber = getPayslipEmployeeNumber(employee);
        const regularHours = entry.regularHours || 0;
        const overtimeHours = entry.overtimeHours || 0;
        const hourlyRate = entry.hourlyRate || 0;
        const overtimeMultiplier = entry.overtimeMultiplier || 1.5;
        const regularGross = entry.regularGross || 0;
        const overtimeGross = entry.overtimeGross || 0;

        let html = '<div class="payslip-document">';

        const ctx = PayrollContext.currentPayslipContext;
        const canPrev = ctx && ctx.currentIndex > 0;
        const canNext = ctx && ctx.entries && ctx.currentIndex < ctx.entries.length - 1;
        html += '<div class="payslip-nav">';
        html += '<button type="button" class="btn btn-secondary payslip-nav-btn" id="payslip-prev"' + (canPrev ? '' : ' disabled') + ' title="Previous Employee">&larr; Previous</button>';
        html += '<button type="button" class="btn btn-secondary payslip-nav-btn" id="payslip-back" title="Back">Back</button>';
        html += '<button type="button" class="btn btn-secondary payslip-nav-btn" id="payslip-next"' + (canNext ? '' : ' disabled') + ' title="Next Employee">Next &rarr;</button>';
        html += '</div>';

        html += '<div class="ips-payslip">';
        const companyTaxNumber = getCompanyTaxNumber(company) || getEmployerRegistrationNumber();
        html += '<div class="ips-header">';
        html += '<div class="ips-header-names">';
        html += '<div class="ips-employee-name">' + escapeHtml(entry.employeeName) + '</div>';
        html += '<div class="ips-company-name">' + escapeHtml(company.name || 'Company Name') + '</div>';
        html += '</div>';
        html += '<div class="ips-header-details">';
        html += '<div class="ips-header-left">';
        html += '<div class="ips-employee-pps">PPS: ' + escapeHtml(employee ? employee.ppsNumber : '') + '</div>';
        html += '</div>';
        html += '<div class="ips-header-right">';
        if (company.address) html += '<div class="ips-company-detail">' + escapeHtml(company.address) + '</div>';
        if (companyTaxNumber) html += '<div class="ips-company-detail">Employer number: ' + escapeHtml(companyTaxNumber) + '</div>';
        if (companyTaxNumber) html += '<div class="ips-company-detail">Reg No: ' + escapeHtml(companyTaxNumber) + '</div>';
        html += '</div>';
        html += '</div>';
        html += '</div>';

        html += '<div class="ips-meta-row">';
        html += '<span>Payslip Date: <strong>' + escapeHtml(dateFormatted) + '</strong></span>';
        html += '<span>Pay Period: <strong>' + escapeHtml(payPeriodCode) + '</strong></span>';
        html += '<span>Employee number: <strong>' + escapeHtml(employeeNumber) + '</strong></span>';
        html += '</div>';

        const payType = entry.payType || (employee ? employee.payType : '') || 'salaried';
        const rateOfPay = payType === 'hourly'
            ? safeFormatCurrency(entry.hourlyRate || (employee ? employee.hourlyRate : 0) || 0)
            : safeFormatCurrency((employee ? employee.annualGross : 0) || (regularGross * freqDivisor) || 0);

        html += '<div class="ips-section-title">Employee\'s Tax / PRSI Details</div>';
        html += '<div class="ips-details-grid">';
        html += '<div class="ips-kv"><span>Frequency of pay</span><span>' + escapeHtml(freqLabel) + '</span></div>';
        html += '<div class="ips-kv"><span>PRSI Class</span><span>' + escapeHtml(prsiClass) + '</span></div>';
        html += '<div class="ips-kv"><span>Annual Tax Credit</span><span>' + safeFormatCurrency(annualTC) + '</span></div>';
        html += '<div class="ips-kv"><span>Tax basis</span><span>' + escapeHtml(taxBasisLabel) + '</span></div>';
        html += '<div class="ips-kv"><span>Annual Cut Off</span><span>' + safeFormatCurrency(annualCOP) + '</span></div>';
        html += '<div class="ips-kv ips-kv-future"><span></span><span>—</span></div>';
        html += '<div class="ips-kv"><span>Rate of Pay</span><span>' + rateOfPay + '</span></div>';
        html += '<div class="ips-kv ips-kv-future"><span></span><span>—</span></div>';
        html += '</div>';

        html += '<div class="ips-section-title">Cumulatives (Year-to-Date)</div>';
        html += '<div class="ips-ytd-grid">';
        html += '<div class="ips-kv"><span>To Date Earnings</span><span>' + safeFormatCurrency(ytdGross) + '</span></div>';
        html += '<div class="ips-kv"><span>LPT</span><span>' + safeFormatCurrency(0) + '</span></div>';
        html += '<div class="ips-kv"><span>Taxable Pay to date</span><span>' + safeFormatCurrency(ytdTaxablePay) + '</span></div>';
        html += '<div class="ips-kv"><span>PRSI Weeks-to-date</span><span>' + prsiWeeksToDate + '</span></div>';
        html += '<div class="ips-kv"><span>Cumulative Tax Credit</span><span>' + safeFormatCurrency(ytdTaxCredits) + '</span></div>';
        html += '<div class="ips-kv"><span>Cumulative USC paid</span><span>' + safeFormatCurrency(ytdUsc) + '</span></div>';
        html += '<div class="ips-kv"><span>PAYE paid to date</span><span>' + safeFormatCurrency(ytdPaye) + '</span></div>';
        html += '<div class="ips-kv"><span>Cumulative Ee PRSI to date</span><span>' + safeFormatCurrency(ytdPrsi) + '</span></div>';
        html += '<div class="ips-kv ips-kv-emphasis"><span>Take-home YTD</span><span>' + safeFormatCurrency(ytdTakeHome) + '</span></div>';
        html += '<div class="ips-kv"><span>Employer PRSI to date</span><span>' + safeFormatCurrency(ytdEmployerPrsi) + '</span></div>';
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
            if (pensionDeduction > 0) {
                html += '<tr class="ips-subtotal ips-subline"><td colspan="3">Less non-taxable deductions</td><td class="text-right">&minus;' + safeFormatCurrency(pensionDeduction) + '</td></tr>';
            }
            if (bikAmount > 0) {
                html += '<tr class="ips-subtotal ips-subline"><td colspan="3">Plus taxable benefits (BIK)</td><td class="text-right">+' + safeFormatCurrency(bikAmount) + '</td></tr>';
            }
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
        html += '<div class="ips-calc-identity">';
        html += '<span>Name: <strong>' + escapeHtml(entry.employeeName || '') + '</strong></span>';
        html += '<span>PPS No: <strong>' + escapeHtml(employee ? employee.ppsNumber : '') + '</strong></span>';
        html += '<span>Payslip Date: <strong>' + escapeHtml(dateFormatted) + '</strong></span>';
        html += '<span>Pay Period: <strong>' + escapeHtml(payPeriodCode) + '</strong></span>';
        html += '<span>Employee number: <strong>' + escapeHtml(employeeNumber) + '</strong></span>';
        html += '</div>';
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
                switchTab(PayrollContext.payslipReturnTab);
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
                if (PayrollContext.currentPayslipContext && PayrollContext.currentPayslipContext.currentIndex > 0) {
                    const newIndex = PayrollContext.currentPayslipContext.currentIndex - 1;
                    const newEntry = PayrollContext.currentPayslipContext.entries[newIndex];
                    showPayslipFromEntry(newEntry, PayrollContext.currentPayslipContext.run, PayrollContext.currentPayslipContext.entries, newIndex);
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                if (PayrollContext.currentPayslipContext && PayrollContext.currentPayslipContext.currentIndex < PayrollContext.currentPayslipContext.entries.length - 1) {
                    const newIndex = PayrollContext.currentPayslipContext.currentIndex + 1;
                    const newEntry = PayrollContext.currentPayslipContext.entries[newIndex];
                    showPayslipFromEntry(newEntry, PayrollContext.currentPayslipContext.run, PayrollContext.currentPayslipContext.entries, newIndex);
                }
            });
        }

        if (topBackBtn) {
            topBackBtn.addEventListener('click', function() {
                switchTab(PayrollContext.payslipReturnTab);
            });
        }

        switchTab('payslip');
    }

    function printPayslip() {
        var panel = document.getElementById('payslip-calc-panel');
        var toggleBtn = document.getElementById('payslip-toggle-calc');
        if (panel) {
            panel.style.display = 'block';
        }
        if (toggleBtn) {
            toggleBtn.textContent = 'Hide Calculation Details';
        }
        window.print();
    }

    return {
        init: init,
        showPayslip: showPayslip,
        showPayslipFromEntry: showPayslipFromEntry,
        renderEmployeeCardPayslipPanel: renderEmployeeCardPayslipPanel,
        clearEmployeeCardPayslipPanel: clearEmployeeCardPayslipPanel,
        printPayslip: printPayslip,
        buildEmployeeCardPayslipHtml: buildEmployeeCardPayslipHtml,
        buildBreakdownSteps: buildBreakdownSteps,
        renderBreakdownSteps: renderBreakdownSteps
    };
})();
