// payroll/payroll-paye.js — PAYE calculation (normal, emergency, combined)

var PayrollPAYE = (function() {
    'use strict';

    var deps = {};

    function init(dependencies) {
        deps = dependencies || {};
    }

    function getSelectedYear() {
        return typeof deps.getSelectedYear === 'function' ? deps.getSelectedYear() : '2026';
    }

    function calculateNormalPAYE(grossPay, rpn) {
        const taxCredit = parseFloat(rpn.periodicTaxCredit) || 0;
        const cop = parseFloat(rpn.periodicStandardRateCutOffPoint) || 0;
        const taxableAt20 = Math.min(grossPay, cop);
        const taxableAt40 = Math.max(0, grossPay - cop);
        const taxAt20 = taxableAt20 * 0.2;
        const taxAt40 = taxableAt40 * 0.4;
        const taxBeforeCredit = taxAt20 + taxAt40;
        const paye = Math.max(0, taxBeforeCredit - taxCredit);

        return {
            mode: 'NORMAL',
            paye: parseFloat(paye.toFixed(2)),
            taxCreditUsed: Math.min(taxCredit, taxBeforeCredit),
            copUsed: cop,
            source: 'RPN',
            taxableAt20: taxableAt20,
            taxableAt40: taxableAt40,
            taxAt20: taxAt20,
            taxAt40: taxAt40,
            taxBeforeCredit: taxBeforeCredit
        };
    }

    function calculateEmergencyPAYE(grossPay, weeksOnEmergency, hasPPSN, totalPeriodsInYear) {
        if (!hasPPSN) {
            return {
                mode: 'EMERGENCY_NO_PPSN',
                paye: parseFloat((grossPay * 0.4).toFixed(2)),
                taxCreditUsed: 0,
                copUsed: 0,
                source: 'Emergency Rules (No PPSN)',
                taxableAt20: 0,
                taxableAt40: grossPay,
                taxAt20: 0,
                taxAt40: grossPay * 0.4,
                taxBeforeCredit: grossPay * 0.4
            };
        }

        const periodWeeks = totalPeriodsInYear ? 52 / totalPeriodsInYear : 1;
        const singlePersonPeriodCOP = (PayrollUtils.getDefaultCutOffPoint('single') / 52) * periodWeeks;

        if ((weeksOnEmergency || 0) <= 4) {
            const taxableAt20 = Math.min(grossPay, singlePersonPeriodCOP);
            const taxableAt40 = Math.max(0, grossPay - singlePersonPeriodCOP);
            const taxAt20 = taxableAt20 * 0.2;
            const taxAt40 = taxableAt40 * 0.4;
            return {
                mode: 'EMERGENCY_WEEKS_1_4',
                paye: parseFloat((taxAt20 + taxAt40).toFixed(2)),
                taxCreditUsed: 0,
                copUsed: singlePersonPeriodCOP,
                source: 'Emergency Rules (Weeks 1-4)',
                taxableAt20: taxableAt20,
                taxableAt40: taxableAt40,
                taxAt20: taxAt20,
                taxAt40: taxAt40,
                taxBeforeCredit: taxAt20 + taxAt40
            };
        }

        return {
            mode: 'EMERGENCY_WEEK_5_PLUS',
            paye: parseFloat((grossPay * 0.4).toFixed(2)),
            taxCreditUsed: 0,
            copUsed: 0,
            source: 'Emergency Rules (Week 5+)',
            taxableAt20: 0,
            taxableAt40: grossPay,
            taxAt20: 0,
            taxAt40: grossPay * 0.4,
            taxBeforeCredit: grossPay * 0.4
        };
    }

    function calculateWeek53PAYE(grossPay, annualTC, annualCOP, frequency) {
        const freq = frequency || 'weekly';
        const amounts = PayrollWeek53.buildWeek53PeriodicAmounts(annualTC, annualCOP, freq);
        const result = calculateNormalPAYE(grossPay, {
            periodicTaxCredit: amounts.periodicTaxCredit,
            periodicStandardRateCutOffPoint: amounts.periodicStandardRateCutOffPoint
        });
        const capped = PayrollWeek53.applyWeek53PayCap(Object.assign({}, result, {
            periodicTaxCredit: amounts.periodicTaxCredit
        }), grossPay);

        return Object.assign({}, capped, {
            mode: 'WEEK_53_FORCED_W1',
            source: 'Week 53 (Section 480B)',
            week53ForcedWeek1: true,
            week53ExtraTaxCredit: amounts.extraTaxCredit,
            week53ExtraCutOffPoint: amounts.extraCutOffPoint
        });
    }

    function calculatePAYE(employee, grossPay, weeksOnEmergency, totalPeriodsInYear, week53Context) {
        if (weeksOnEmergency === undefined) weeksOnEmergency = 0;
        const periods = totalPeriodsInYear || 52;
        const selectedYear = getSelectedYear();
        const frequency = PayrollTax.getEmployeePayFrequency(employee);
        const week53 = week53Context || null;

        if (week53 && week53.isWeek53Run) {
            const annualTC = PayrollTax.getEmployeeAnnualTaxCredits(employee);
            const annualCOP = PayrollTax.getEmployeeCutOffPoint(employee);
            if (PayrollTax.shouldUseRPN(employee)) {
                const rpn = employee.rpn || {};
                return calculateWeek53PAYE(
                    grossPay,
                    rpn.annualTaxCredits || rpn.taxCredits || annualTC,
                    rpn.cutOffPoint || annualCOP,
                    frequency
                );
            }
            if (PayrollTax.isLocalMode()) {
                const ledgerEntry = PayrollContext.currentCompanyId
                    ? PayrollStorage.getEmployeeLedgerEntry(PayrollContext.currentCompanyId, employee.id, selectedYear)
                    : null;
                const localAnnualTC = ledgerEntry && ledgerEntry.annualTaxCredits > 0
                    ? ledgerEntry.annualTaxCredits
                    : annualTC;
                const localAnnualCOP = ledgerEntry && ledgerEntry.cutOffPoint > 0
                    ? ledgerEntry.cutOffPoint
                    : annualCOP;
                return calculateWeek53PAYE(grossPay, localAnnualTC, localAnnualCOP, frequency);
            }
        }

        if (PayrollTax.shouldUseRPN(employee)) {
            const rpn = employee.rpn || {};
            return calculateNormalPAYE(grossPay, {
                periodicTaxCredit: rpn.periodicTaxCredit || (PayrollTax.getEmployeeAnnualTaxCredits(employee) / periods),
                periodicStandardRateCutOffPoint: rpn.periodicStandardRateCutOffPoint || (PayrollTax.getEmployeeCutOffPoint(employee) / periods)
            });
        }

        if (PayrollTax.isLocalMode()) {
            const ledgerEntry = PayrollContext.currentCompanyId
                ? PayrollStorage.getEmployeeLedgerEntry(PayrollContext.currentCompanyId, employee.id, selectedYear)
                : null;
            const annualTC = ledgerEntry && ledgerEntry.remaining > 0
                ? ledgerEntry.remaining
                : PayrollTax.getEmployeeAnnualTaxCredits(employee);
            const annualCOP = ledgerEntry && ledgerEntry.cutOffPoint > 0
                ? ledgerEntry.cutOffPoint
                : PayrollTax.getEmployeeCutOffPoint(employee);
            const submittedPeriods = PayrollTax.countSubmittedPayrollPeriodsForEmployee(employee.id, selectedYear, {
                excludeWeek53: true
            });
            const periodicTaxCredit = PayrollUtils.getLocalPeriodicTaxCredit
                ? PayrollUtils.getLocalPeriodicTaxCredit(annualTC, periods, submittedPeriods, frequency)
                : annualTC / Math.max(periods - submittedPeriods, 1);
            const periodicCOP = PayrollUtils.getLocalPeriodicCOP
                ? PayrollUtils.getLocalPeriodicCOP(annualCOP, periods)
                : annualCOP / periods;

            return calculateNormalPAYE(grossPay, {
                periodicTaxCredit: periodicTaxCredit,
                periodicStandardRateCutOffPoint: periodicCOP
            });
        }

        return calculateEmergencyPAYE(grossPay, weeksOnEmergency, !!(employee && employee.ppsNumber), periods);
    }

    return {
        init: init,
        calculateNormalPAYE: calculateNormalPAYE,
        calculateEmergencyPAYE: calculateEmergencyPAYE,
        calculateWeek53PAYE: calculateWeek53PAYE,
        calculatePAYE: calculatePAYE
    };
})();