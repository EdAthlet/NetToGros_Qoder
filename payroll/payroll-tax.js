// payroll/payroll-tax.js — Tax credits, COP, mode, and ledger helpers

var PayrollTax = (function() {
    'use strict';

    var deps = {};

    function init(dependencies) {
        deps = dependencies || {};
    }

    function getSelectedYear() {
        return typeof deps.getSelectedYear === 'function' ? deps.getSelectedYear() : '2026';
    }

    function getCurrentCompany() {
        if (typeof deps.getCurrentCompany === 'function') {
            return deps.getCurrentCompany();
        }
        if (typeof PayrollCompanies !== 'undefined' && PayrollCompanies.getCurrentCompany) {
            return PayrollCompanies.getCurrentCompany();
        }
        return null;
    }

    var FAMILY_STATUS_LABELS = {
        single: 'Single',
        married: 'Married',
        marriedOneWorking: 'Married One Working',
        singleParent: 'Single Parent',
        custom: 'Custom Tax Credit',
        manual: 'Manual'
    };

    function isCustomTaxStatus(emp) {
        return !!emp && (emp.familyStatus === 'custom' || emp.taxCreditsMode === 'manual');
    }

    function getCurrentCompanyMode() {
        const company = getCurrentCompany();
        if (typeof PayrollMode !== 'undefined') {
            return PayrollMode.getMode(company);
        }
        return company && company.payrollMode === 'cloud' ? 'cloud' : 'local';
    }

    function isCloudMode() {
        return getCurrentCompanyMode() === 'cloud';
    }

    function isLocalMode() {
        return !isCloudMode();
    }

    function hasValidRPN(employee) {
        return !!(employee && employee.rpn && employee.rpn.rpnNumber);
    }

    function shouldUseRPN(employee) {
        return isCloudMode() && hasValidRPN(employee);
    }

    function getEmployeeAnnualTaxCredits(emp) {
        if (!emp) return PayrollUtils.getDefaultAnnualTC('single');

        if (isLocalMode()) {
            if (isCustomTaxStatus(emp)) return parseFloat(emp.manualTaxCredits) || 0;
            return PayrollUtils.getDefaultAnnualTC(emp.familyStatus || 'single');
        }

        if (hasValidRPN(emp)) {
            if (emp.rpn.annualTaxCredits !== undefined) return parseFloat(emp.rpn.annualTaxCredits) || 0;
            if (emp.rpn.taxCredits !== undefined) return parseFloat(emp.rpn.taxCredits) || 0;
        }
        if (isCustomTaxStatus(emp)) return parseFloat(emp.manualTaxCredits) || 0;
        return PayrollUtils.getDefaultAnnualTC(emp.familyStatus || 'single');
    }

    function getEmployeeCutOffPoint(emp) {
        if (!emp) return PayrollUtils.getDefaultCutOffPoint('single');

        if (isLocalMode()) {
            if (isCustomTaxStatus(emp) && emp.manualCutOffPoint) return parseFloat(emp.manualCutOffPoint) || 0;
            return PayrollUtils.getDefaultCutOffPoint(emp.familyStatus || 'single');
        }

        if (hasValidRPN(emp) && emp.rpn.cutOffPoint !== undefined) return parseFloat(emp.rpn.cutOffPoint) || 0;
        if (isCustomTaxStatus(emp) && emp.manualCutOffPoint) return parseFloat(emp.manualCutOffPoint) || 0;
        return PayrollUtils.getDefaultCutOffPoint(emp.familyStatus || 'single');
    }

    function getEmployeeTaxSource(emp) {
        if (isLocalMode()) {
            return isCustomTaxStatus(emp) ? 'manual' : 'automatic';
        }
        if (hasValidRPN(emp)) return 'rpn';
        return isCustomTaxStatus(emp) ? 'manual' : 'automatic';
    }

    function getEmployeePayFrequency(emp) {
        return (emp && emp.payFrequency) || 'monthly';
    }

    function countSubmittedPayrollPeriodsForEmployee(employeeId, taxYear, options) {
        if (!PayrollContext.currentCompanyId || !employeeId) return 0;
        const runs = PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || [];
        const year = taxYear || getSelectedYear();
        const opts = options || {};
        return runs.filter(function(run) {
            if (run.status !== 'submitted') return false;
            if (year && run.taxYear && String(run.taxYear) !== String(year)) return false;
            return (run.entries || []).some(function(entry) {
                if (entry.employeeId !== employeeId) return false;
                if (opts.excludeWeek53 && entry.isWeek53Run) return false;
                return true;
            });
        }).length;
    }

    function getEmployeeSubmittedPeriodProgress(emp, taxYear) {
        var empFreq = getEmployeePayFrequency(emp);
        var company = getCurrentCompany();
        var payDay = PayrollUtils.getCompanyPayDay(company);
        var year = taxYear || getSelectedYear();
        var total = PayrollUtils.getPeriodsPerYearForFrequency(empFreq, year, payDay);
        var latestPeriod = 0;
        if (PayrollContext.currentCompanyId && PayrollUtils.getLatestSubmittedPayPeriodNumber) {
            var submittedRuns = (PayrollStorage.loadPayrollRuns(PayrollContext.currentCompanyId) || []).filter(function(run) {
                if (run.status !== 'submitted') return false;
                if (taxYear && run.taxYear && String(run.taxYear) !== String(taxYear)) return false;
                return true;
            });
            latestPeriod = PayrollUtils.getLatestSubmittedPayPeriodNumber(emp.id, empFreq, submittedRuns);
        }
        return { latestPeriod: latestPeriod, total: total, frequency: empFreq };
    }

    function getEmployeePeriodCOP(annualCOP, emp) {
        var periods = PayrollUtils.getPeriodsPerYearForFrequency(getEmployeePayFrequency(emp));
        if (PayrollUtils.getLocalPeriodicCOP) {
            return PayrollUtils.getLocalPeriodicCOP(annualCOP, periods);
        }
        return (parseFloat(annualCOP) || 0) / periods;
    }

    function getTaxSourceDescription(source) {
        if (source === 'rpn') {
            return 'Annual TC and COP were loaded from the employee\'s Revenue Payroll Notification (cloud mode).';
        }
        if (source === 'manual') {
            return 'Annual TC and COP were entered manually on the employee card (custom tax status).';
        }
        return 'Annual TC and COP use the preset values for the employee\'s family status.';
    }

    function getWeek1PeriodicCOPAllocation(cutOffPoint, employee) {
        var annualCOP = parseFloat(cutOffPoint) || 0;
        var periods = PayrollUtils.getPeriodsPerYearForFrequency(getEmployeePayFrequency(employee));
        if (PayrollUtils.getLocalPeriodicCOP) {
            return PayrollUtils.getLocalPeriodicCOP(annualCOP, periods);
        }
        return annualCOP / periods;
    }

    function getPeriodicAnnualGross(emp) {
        var annualGross = PayrollUtils.toFiniteNumber(emp && emp.annualGross, 0);
        return annualGross / PayrollUtils.getPeriodsPerYearForFrequency(getEmployeePayFrequency(emp));
    }

    function initOrSyncLedger(companyId, year) {
        var ledger = PayrollStorage.loadTaxCreditsLedger(companyId);
        var employees = PayrollStorage.loadEmployees(companyId) || [];

        for (var i = 0; i < employees.length; i++) {
            var emp = employees[i];
            if (!ledger[emp.id]) {
                ledger[emp.id] = {};
            }
            if (!ledger[emp.id][year]) {
                var annualTaxCredits, cutOffPoint, source;
                annualTaxCredits = getEmployeeAnnualTaxCredits(emp);
                source = getEmployeeTaxSource(emp);
                cutOffPoint = getEmployeeCutOffPoint(emp);

                ledger[emp.id][year] = {
                    annualTaxCredits: annualTaxCredits,
                    taxCreditsUsed: 0,
                    remaining: annualTaxCredits,
                    cutOffPoint: cutOffPoint,
                    copUsed: 0,
                    copRemaining: cutOffPoint,
                    source: source,
                    lastUpdated: new Date().toISOString()
                };
            } else {
                var entry = ledger[emp.id][year];
                var newAnnualTC, newCOP, newSource;
                newAnnualTC = getEmployeeAnnualTaxCredits(emp);
                newSource = getEmployeeTaxSource(emp);
                newCOP = getEmployeeCutOffPoint(emp);

                entry.annualTaxCredits = newAnnualTC;
                entry.cutOffPoint = newCOP;
                entry.source = newSource;
                entry.remaining = newAnnualTC - (entry.taxCreditsUsed || 0);
                entry.copRemaining = newCOP - (entry.copUsed || 0);
                entry.lastUpdated = new Date().toISOString();
            }
        }

        PayrollStorage.saveTaxCreditsLedger(companyId, ledger);
        return ledger;
    }

    return {
        init: init,
        FAMILY_STATUS_LABELS: FAMILY_STATUS_LABELS,
        isCustomTaxStatus: isCustomTaxStatus,
        getCurrentCompanyMode: getCurrentCompanyMode,
        isCloudMode: isCloudMode,
        isLocalMode: isLocalMode,
        shouldUseRPN: shouldUseRPN,
        hasValidRPN: hasValidRPN,
        getEmployeeAnnualTaxCredits: getEmployeeAnnualTaxCredits,
        getEmployeeCutOffPoint: getEmployeeCutOffPoint,
        getEmployeeTaxSource: getEmployeeTaxSource,
        getEmployeePayFrequency: getEmployeePayFrequency,
        countSubmittedPayrollPeriodsForEmployee: countSubmittedPayrollPeriodsForEmployee,
        getEmployeeSubmittedPeriodProgress: getEmployeeSubmittedPeriodProgress,
        getEmployeePeriodCOP: getEmployeePeriodCOP,
        getTaxSourceDescription: getTaxSourceDescription,
        getWeek1PeriodicCOPAllocation: getWeek1PeriodicCOPAllocation,
        getPeriodicAnnualGross: getPeriodicAnnualGross,
        initOrSyncLedger: initOrSyncLedger
    };
})();