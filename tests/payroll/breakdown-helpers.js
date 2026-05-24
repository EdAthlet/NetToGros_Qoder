/**
 * Extracted payroll breakdown logic for testing.
 * This mirrors the buildBreakdownSteps function in payroll.js
 * and validates the correctness of breakdown figures.
 */

/**
 * Simulates the payroll PAYE breakdown data structure built during a run.
 * This replicates the logic at payroll.js line ~1095-1130.
 */
export function buildPayeBreakdown(annualizedTaxable, annualCutOff, annualTC, totalPeriodsInYear, frequency) {
    var payeAt20Annual = Math.min(annualizedTaxable, annualCutOff) * 0.2;
    var payeAt40Annual = Math.max(annualizedTaxable - annualCutOff, 0) * 0.4;
    var grossPayeAnnual = payeAt20Annual + payeAt40Annual;

    var standardRateIncome = Math.min(annualizedTaxable, annualCutOff);
    var higherRateIncome = Math.max(annualizedTaxable - annualCutOff, 0);

    var breakdown = {
        grossIncome: annualizedTaxable,
        periodGross: annualizedTaxable / totalPeriodsInYear,
        period: frequency === 'weekly' ? 'Weekly' : frequency === 'fortnightly' ? 'Fortnightly' : 'Monthly',
        bands: [],
        grossTax: grossPayeAnnual,
        taxCredits: annualTC,
        periodTaxCredits: annualTC / totalPeriodsInYear,
        standardBand: annualCutOff,
        periodStandardBand: annualCutOff / totalPeriodsInYear,
        netTax: Math.max(0, grossPayeAnnual - annualTC),
        status: 'single'
    };

    if (standardRateIncome > 0) {
        breakdown.bands.push({
            rate: 0.2,
            rateDisplay: '20',
            taxableAmount: standardRateIncome / totalPeriodsInYear,
            annualTaxableAmount: standardRateIncome,
            tax: payeAt20Annual / totalPeriodsInYear,
            annualTax: payeAt20Annual,
            description: 'Standard rate'
        });
    }
    if (higherRateIncome > 0) {
        breakdown.bands.push({
            rate: 0.4,
            rateDisplay: '40',
            taxableAmount: higherRateIncome / totalPeriodsInYear,
            annualTaxableAmount: higherRateIncome,
            tax: payeAt40Annual / totalPeriodsInYear,
            annualTax: payeAt40Annual,
            description: 'Higher rate'
        });
    }

    return {
        breakdown,
        payeAt20Annual,
        payeAt40Annual,
        grossPayeAnnual
    };
}

/**
 * Simulates the entry calculation logic in processEmployeeGroup.
 * Returns a mock entry object with all the fields that showPayslipFromEntry needs.
 */
export function simulatePayrollEntry({
    payType = 'salaried',
    annualGross = 0,
    frequency = 'monthly',
    familyStatus = 'single',
    annualCutOff = 44000,
    annualTC = 4000,
    remainingTC = 4000,
    committedPeriods = 0,
    pensionPct = 0,
    avc = 0,
    bik = 0,
    regularHours = 0,
    overtimeHours = 0,
    hourlyRate = 0,
    overtimeMultiplier = 1.5
}) {
    var totalPeriodsInYear = frequency === 'weekly' ? 52 : frequency === 'fortnightly' ? 26 : 12;
    var periodsRemaining = Math.max(totalPeriodsInYear - committedPeriods, 1);

    // Calculate period gross
    var periodGross;
    var regularGross;
    var overtimeGross;
    if (payType === 'hourly') {
        regularGross = regularHours * hourlyRate;
        overtimeGross = overtimeHours * hourlyRate * overtimeMultiplier;
        periodGross = regularGross + overtimeGross;
    } else {
        regularGross = annualGross / totalPeriodsInYear;
        overtimeGross = overtimeHours * hourlyRate * overtimeMultiplier;
        periodGross = regularGross + overtimeGross;
    }

    // Pension and BIK
    var periodPensionDeduction = (periodGross * pensionPct / 100) + (avc / totalPeriodsInYear);
    var periodBik = bik / totalPeriodsInYear;

    // Taxable gross
    var taxableGross = Math.max(periodGross - periodPensionDeduction + periodBik, 0);
    var annualizedTaxable = taxableGross * totalPeriodsInYear;

    // PAYE with actual cut-off
    var payeAt20Annual = Math.min(annualizedTaxable, annualCutOff) * 0.2;
    var payeAt40Annual = Math.max(annualizedTaxable - annualCutOff, 0) * 0.4;
    var grossPayeAnnual = payeAt20Annual + payeAt40Annual;

    // Cumulative TC logic
    var currentPeriodTC = remainingTC / periodsRemaining;
    var grossPaye = grossPayeAnnual / totalPeriodsInYear;
    var actualTCUsed = Math.min(currentPeriodTC, grossPaye);
    var netPaye = Math.max(grossPaye - currentPeriodTC, 0);

    // USC (simplified — flat 4.5% approximation for testing, not full band logic)
    // In real code this uses calculateNetFromGross which has full band logic
    var uscAnnual = annualizedTaxable * 0.045; // simplified
    var usc = uscAnnual / totalPeriodsInYear;

    // PRSI (simplified — 4.1%)
    var prsiAnnual = annualizedTaxable * 0.041;
    var prsi = prsiAnnual / totalPeriodsInYear;

    var paye = netPaye;
    var totalDeductions = paye + usc + prsi + periodPensionDeduction;
    var netPay = periodGross - totalDeductions;

    // Build PAYE breakdown (as stored in the entry)
    var payeBreakdownData = buildPayeBreakdown(annualizedTaxable, annualCutOff, annualTC, totalPeriodsInYear, frequency);

    return {
        employeeName: 'Test Employee',
        payFrequency: frequency,
        payType: payType,
        grossPay: periodGross,
        paye: paye,
        usc: usc,
        prsi: prsi,
        totalDeductions: totalDeductions,
        netPay: netPay,
        taxCreditsUsed: actualTCUsed,
        regularHours: regularHours,
        overtimeHours: overtimeHours,
        hourlyRate: hourlyRate,
        overtimeMultiplier: overtimeMultiplier,
        regularGross: regularGross,
        overtimeGross: overtimeGross,
        payeAt20: payeAt20Annual / totalPeriodsInYear,
        payeAt40: payeAt40Annual / totalPeriodsInYear,
        grossPaye: grossPaye,
        pensionDeduction: periodPensionDeduction,
        bikAmount: periodBik,
        _payeBreakdown: payeBreakdownData.breakdown,
        // Internal values for verification
        _annualizedTaxable: annualizedTaxable,
        _annualCutOff: annualCutOff,
        _annualTC: annualTC,
        _totalPeriodsInYear: totalPeriodsInYear,
        _currentPeriodTC: currentPeriodTC
    };
}

/**
 * Validates that breakdown band figures match the entry's stored PAYE values.
 */
export function validatePayeBreakdown(entry) {
    var bd = entry._payeBreakdown;
    if (!bd) return { valid: false, errors: ['No _payeBreakdown stored'] };

    var errors = [];
    var freqDivisor = entry.payFrequency === 'weekly' ? 52 : entry.payFrequency === 'fortnightly' ? 26 : 12;

    // Sum period taxes from bands
    var periodGrossTax = 0;
    bd.bands.forEach(function(band) {
        periodGrossTax += band.tax;
    });

    // Gross Paye from bands should match entry.grossPaye
    var expectedGrossPaye = entry.grossPaye;
    if (Math.abs(periodGrossTax - expectedGrossPaye) > 0.01) {
        errors.push('Band period tax sum (' + periodGrossTax.toFixed(4) + ') != entry.grossPaye (' + expectedGrossPaye.toFixed(4) + ')');
    }

    // Annual gross tax should match sum of annual band taxes
    var annualGrossTax = 0;
    bd.bands.forEach(function(band) {
        annualGrossTax += band.annualTax;
    });
    if (Math.abs(annualGrossTax - bd.grossTax) > 0.01) {
        errors.push('Annual band tax sum (' + annualGrossTax.toFixed(4) + ') != bd.grossTax (' + bd.grossTax.toFixed(4) + ')');
    }

    // Period band taxableAmount * rate should equal band.tax
    bd.bands.forEach(function(band) {
        var expectedTax = band.taxableAmount * band.rate;
        if (Math.abs(expectedTax - band.tax) > 0.01) {
            errors.push('Band ' + band.rateDisplay + '% period: taxableAmount*rate (' + expectedTax.toFixed(4) + ') != tax (' + band.tax.toFixed(4) + ')');
        }
    });

    // Annual band taxableAmount * rate should equal annualTax
    bd.bands.forEach(function(band) {
        var expectedAnnualTax = band.annualTaxableAmount * band.rate;
        if (Math.abs(expectedAnnualTax - band.annualTax) > 0.01) {
            errors.push('Band ' + band.rateDisplay + '% annual: taxableAmount*rate (' + expectedAnnualTax.toFixed(4) + ') != annualTax (' + band.annualTax.toFixed(4) + ')');
        }
    });

    // Net PAYE: grossPaye - periodTC = entry.paye (when positive)
    var expectedNetPaye = Math.max(0, entry.grossPaye - entry._currentPeriodTC);
    if (Math.abs(expectedNetPaye - entry.paye) > 0.01) {
        errors.push('Expected Net PAYE (' + expectedNetPaye.toFixed(4) + ') != entry.paye (' + entry.paye.toFixed(4) + ')');
    }

    return { valid: errors.length === 0, errors: errors };
}
