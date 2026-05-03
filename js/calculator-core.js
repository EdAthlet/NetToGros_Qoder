// Irish Tax Calculator — Shared Core Logic
// Used by both the main calculator (index.html) and the batch calculator (batch/index.html)
// This file contains pure tax calculation functions and tax rate data.
// Pages that include this script must define the following globals:
//   selectedYear, selected2024Period, selected2025Period, selected2026Period,
//   activeTab, tabConfig, getCurrentPeriodConfig(), convertToAnnual(), convertFromAnnual()

// Tax rates and thresholds for 2024, 2025 and 2026
const TAX_RATES = {
    2024: {
        PAYE_RATES: {
            standardRate: 0.20,
            higherRate: 0.40,
            standardBand: 42000,
            standardBandMarried: 84000,
            standardBandMarriedOneWorking: 51000,
            standardBandSingleParent: 46000
        },
        USC_RATES: [
            { min: 0, max: 12012, rate: 0.005 },
            { min: 12012, max: 25760, rate: 0.02 },
            { min: 25760, max: 70044, rate: 0.04 },
            { min: 70044, max: Infinity, rate: 0.08 }
        ],
        PRSI_RATES: {
            employee: {
                rate: 0.041, // 4.0% (Jan-Sep 2024) / 4.1% (Oct-Dec 2024)
                ceiling: 127200,
                exemption: 352
            }
        },
        TAX_CREDITS: {
            personalCredit: 1875,
            employeeCredit: 1875,
            marriedCredit: 3750,
            marriedOneWorkingCredit: 3750,
            singleParentCredit: 1750
        },
        PRSI_CREDIT_BANDS: {
            'Weekly': { min: 352.01, max: 424.00, maxCredit: 12.00, threshold: 352.00 },
            'Fortnightly': { min: 704.01, max: 848.00, maxCredit: 24.00, threshold: 704.00 },
            'Monthly': { min: 1525.34, max: 1837.33, maxCredit: 52.00, threshold: 1525.33 },
            'Annual': { min: 18304.01, max: 22048.00, maxCredit: 624.00, threshold: 18304.00 }
        }
    },
    2025: {
        PAYE_RATES: {
            standardRate: 0.20,
            higherRate: 0.40,
            standardBand: 44000,
            standardBandMarried: 88000,
            standardBandMarriedOneWorking: 53000,
            standardBandSingleParent: 48000
        },
        USC_RATES: [
            { min: 0, max: 12012, rate: 0.005 },
            { min: 12012, max: 27382, rate: 0.02 },
            { min: 27382, max: 70044, rate: 0.03 },
            { min: 70044, max: Infinity, rate: 0.08 }
        ],
        PRSI_RATES: {
            employee: {
                rate: 0.041, // 4.1% (Jan-Sep 2025) / 4.2% (Oct-Dec 2025)
                ceiling: null, // No ceiling for 2025
                exemption: 352
            }
        },
        TAX_CREDITS: {
            personalCredit: 2000,
            employeeCredit: 2000,
            marriedCredit: 4000,
            marriedOneWorkingCredit: 4000,
            singleParentCredit: 1900
        },
        PRSI_CREDIT_BANDS: {
            'Weekly': { min: 352.01, max: 424.00, maxCredit: 12.00, threshold: 352.00 },
            'Fortnightly': { min: 704.01, max: 848.00, maxCredit: 24.00, threshold: 704.00 },
            'Monthly': { min: 1525.34, max: 1837.33, maxCredit: 52.00, threshold: 1525.33 },
            'Annual': { min: 18304.01, max: 22048.00, maxCredit: 624.00, threshold: 18304.00 }
        }
    },
    2026: {
        PAYE_RATES: {
            standardRate: 0.20,
            higherRate: 0.40,
            standardBand: 44000,
            standardBandMarried: 88000,
            standardBandMarriedOneWorking: 53000,
            standardBandSingleParent: 48000
        },
        USC_RATES: [
            { min: 0, max: 12012, rate: 0.005 },
            { min: 12012, max: 27382, rate: 0.02 },
            { min: 27382, max: 70044, rate: 0.03 },
            { min: 70044, max: Infinity, rate: 0.08 }
        ],
        PRSI_RATES: {
            employee: {
                rate: 0.042, // 4.2% (Jan-Sep 2026) / 4.35% (Oct-Dec 2026)
                ceiling: null, // No ceiling for 2026
                exemption: 352
            }
        },
        TAX_CREDITS: {
            personalCredit: 2000,
            employeeCredit: 2000,
            marriedCredit: 4000,
            marriedOneWorkingCredit: 4000,
            singleParentCredit: 1900
        },
        PRSI_CREDIT_BANDS: {
            'Weekly': { min: 352.01, max: 424.00, maxCredit: 12.00, threshold: 352.00 },
            'Fortnightly': { min: 704.01, max: 848.00, maxCredit: 24.00, threshold: 704.00 },
            'Monthly': { min: 1525.34, max: 1837.33, maxCredit: 52.00, threshold: 1525.33 },
            'Annual': { min: 18304.01, max: 22048.00, maxCredit: 624.00, threshold: 18304.00 }
        }
    }
};

// Current tax rates (updated based on selected year)
let PAYE_RATES, USC_RATES, PRSI_RATES, TAX_CREDITS;

function updateTaxRatesForYear(year) {
    const rates = TAX_RATES[year] || TAX_RATES[2024];
    PAYE_RATES = rates.PAYE_RATES;
    USC_RATES = rates.USC_RATES;
    PRSI_RATES = rates.PRSI_RATES;
    TAX_CREDITS = rates.TAX_CREDITS;
}

// Tax calculation functions
function roundToThree(value) {
    return Math.round(value * 1000) / 1000;
}

function get2024PRSIRate() {
    // Return the correct PRSI rate based on selected 2024 period
    return selected2024Period === 'jan-sep' ? 0.040 : 0.041;
}

function get2025PRSIRate() {
    // Return the correct PRSI rate based on selected 2025 period
    return selected2025Period === 'jan-sep' ? 0.041 : 0.042;
}

function get2026PRSIRate() {
    // Return the correct PRSI rate based on selected 2026 period
    return selected2026Period === 'jan-sep' ? 0.042 : 0.0435;
}

function calculatePAYE(grossIncome, status = 'single') {
    let standardBand;

    if (status === 'manual') {
        const defaultCutOff = selectedYear === '2024' ? 42000 : 44000;
        const manualCutOffEl = document.getElementById('manualCutOffPoint');
        standardBand = (manualCutOffEl ? parseFloat(manualCutOffEl.value) : NaN) || defaultCutOff;
    } else if (status === 'married') {
        standardBand = PAYE_RATES.standardBandMarried;
    } else if (status === 'marriedOneWorking') {
        standardBand = PAYE_RATES.standardBandMarriedOneWorking;
    } else if (status === 'singleParent') {
        standardBand = PAYE_RATES.standardBandSingleParent;
    } else {
        standardBand = PAYE_RATES.standardBand;
    }

    let paye = 0;

    if (grossIncome <= standardBand) {
        paye = grossIncome * PAYE_RATES.standardRate;
    } else {
        paye = (standardBand * PAYE_RATES.standardRate) +
               ((grossIncome - standardBand) * PAYE_RATES.higherRate);
    }

    return roundToThree(Math.max(0, paye));
}

function calculateUSC(grossIncome) {
    if (grossIncome < 13000) {
        return 0;
    }

    let usc = 0;
    let remainingIncome = grossIncome;

    for (const band of USC_RATES) {
        if (remainingIncome <= 0) break;

        const taxableInThisBand = Math.min(remainingIncome, band.max - band.min);
        usc += taxableInThisBand * band.rate;
        remainingIncome -= taxableInThisBand;
    }

    return roundToThree(usc);
}

function calculateUSCWithBreakdown(grossIncome) {
    if (grossIncome < 13000) {
        return {
            total: 0,
            bands: [],
            exempt: true,
            grossIncome: grossIncome
        };
    }

    let totalUSC = 0;
    let remainingIncome = grossIncome;
    let bands = [];

    for (const band of USC_RATES) {
        if (remainingIncome <= 0) break;

        const taxableInThisBand = Math.min(remainingIncome, band.max - band.min);
        const uscForBand = roundToThree(taxableInThisBand * band.rate);

        bands.push({
            min: band.min,
            max: band.max === Infinity ? 'Above' : band.max,
            rate: band.rate,
            taxableAmount: roundToThree(taxableInThisBand),
            uscAmount: uscForBand
        });

        totalUSC += uscForBand;
        remainingIncome -= taxableInThisBand;
    }

    return {
        total: roundToThree(totalUSC),
        bands: bands,
        exempt: false,
        grossIncome: grossIncome
    };
}

function calculatePRSI(grossIncome) {
    const prsiBreakdown = calculatePRSIWithBreakdown(grossIncome);
    return prsiBreakdown.total;
}

function calculatePRSIWithBreakdown(grossIncome) {
    const currentPeriod = getCurrentPeriodConfig();
    const periodMultiplier = currentPeriod.multiplier;
    const periodGross = grossIncome / periodMultiplier;

    let prsiBreakdown = {
        total: 0,
        bands: [],
        periodGross: roundToThree(periodGross),
        period: currentPeriod.label
    };

    // Get year-specific credit bands from current tax rates
    const currentTaxRates = TAX_RATES[selectedYear] || TAX_RATES[2024];
    const creditBands = currentTaxRates.PRSI_CREDIT_BANDS || {
        'Weekly': { min: 352.01, max: 424.00, maxCredit: 12.00, threshold: 352.00 },
        'Fortnightly': { min: 704.01, max: 848.00, maxCredit: 24.00, threshold: 704.00 },
        'Monthly': { min: 1525.34, max: 1837.33, maxCredit: 52.00, threshold: 1525.33 },
        'Annual': { min: 18304.01, max: 22048.00, maxCredit: 624.00, threshold: 18304.00 }
    };

    const creditConfig = creditBands[currentPeriod.label];

    // A0 band: Below minimum PRSI threshold
    if (periodGross <= creditConfig.threshold) {
        // Calculate proper A0 minimum threshold based on period
        const a0Min = currentPeriod.label === 'Weekly' ? 38.00 :
                    currentPeriod.label === 'Fortnightly' ? 76.00 :
                    currentPeriod.label === 'Monthly' ? 164.65 :
                    1976.00; // Annual

        const bandCode = periodGross < a0Min ? 'Below A0' : 'A0';
        const description = periodGross < a0Min ? 'Below minimum threshold' : 'No employee PRSI';

        prsiBreakdown.bands.push({
            code: bandCode,
            range: bandCode === 'Below A0' ? `Under ${formatCurrency(a0Min)}` : `${formatCurrency(a0Min)} \u2212 ${formatCurrency(creditConfig.threshold)}`,
            rate: 0,
            periodPRSI: 0,
            credit: 0,
            netPRSI: 0,
            description: description
        });
        return prsiBreakdown;
    }

    // AX band: Credit band with tapered credit using period-specific formula
    if (periodGross > creditConfig.threshold && periodGross <= creditConfig.max) {
        const prsiRate = selectedYear === '2024' ? get2024PRSIRate() :
                       selectedYear === '2025' ? get2025PRSIRate() :
                       selectedYear === '2026' ? get2026PRSIRate() :
                       PRSI_RATES.employee.rate;
        const periodPRSI = periodGross * prsiRate;

        // Apply Excel formula: =ROUND(MAX(0,MIN(maxCredit,maxCredit-((periodGross-threshold)/6))),2)
        const credit = Math.round(Math.max(0, Math.min(creditConfig.maxCredit, creditConfig.maxCredit - ((periodGross - creditConfig.min) / 6))) * 100) / 100;
        const netPeriodPRSI = Math.max(0, periodPRSI - credit);

        prsiBreakdown.bands.push({
            code: 'AX',
            range: `${formatCurrency(creditConfig.min)} \u2212 ${formatCurrency(creditConfig.max)}`,
            rate: prsiRate,
            periodPRSI: roundToThree(periodPRSI),
            credit: credit,
            netPRSI: roundToThree(netPeriodPRSI),
            description: `${(prsiRate * 100).toFixed(1)}% with tapered credit`
        });

        prsiBreakdown.total = roundToThree(netPeriodPRSI * periodMultiplier);
        return prsiBreakdown;
    }

    // AL band: Above credit band up to AL threshold
    // For 2024: \u20ac441 weekly (Jan-Sep) / \u20ac496 weekly (Oct-Dec)
    // For 2025: \u20ac527 weekly (full year)
    let alMaxWeekly;
    if (selectedYear === '2024') {
        // Use the selected 2024 period to determine AL threshold
        alMaxWeekly = selected2024Period === 'jan-sep' ? 441.00 : 496.00;
    } else {
        // 2025 uses \u20ac527 weekly
        alMaxWeekly = 527.00;
    }

    const alMax = currentPeriod.label === 'Weekly' ? alMaxWeekly :
                 currentPeriod.label === 'Fortnightly' ? alMaxWeekly * 2 :
                 currentPeriod.label === 'Monthly' ? Math.round(alMaxWeekly * 4.333 * 100) / 100 :
                 alMaxWeekly * 52; // Annual
    if (periodGross > creditConfig.max && periodGross <= alMax) {
        const prsiRate = selectedYear === '2024' ? get2024PRSIRate() :
                       selectedYear === '2025' ? get2025PRSIRate() :
                       selectedYear === '2026' ? get2026PRSIRate() :
                       PRSI_RATES.employee.rate;
        const periodPRSI = periodGross * prsiRate;

        prsiBreakdown.bands.push({
            code: 'AL',
            range: `${formatCurrency(creditConfig.max)} \u2212 ${formatCurrency(alMax)}`,
            rate: prsiRate,
            periodPRSI: roundToThree(periodPRSI),
            credit: 0,
            netPRSI: roundToThree(periodPRSI),
            description: `${(prsiRate * 100).toFixed(1)}% standard rate`
        });

        prsiBreakdown.total = roundToThree(periodPRSI * periodMultiplier);
        return prsiBreakdown;
    }

    // A1 band: Over AL threshold
    if (periodGross > alMax) {
        const prsiRate = selectedYear === '2024' ? get2024PRSIRate() :
                       selectedYear === '2025' ? get2025PRSIRate() :
                       selectedYear === '2026' ? get2026PRSIRate() :
                       PRSI_RATES.employee.rate;
        const periodPRSI = periodGross * prsiRate;

        // Calculate the proper period threshold for A1 band
        // For 2024: Over \u20ac441 weekly (Jan-Sep) / Over \u20ac496 weekly (Oct-Dec)
        // For 2025: Over \u20ac527 weekly (full year)
        // For 2026: Over \u20ac527 weekly (full year)
        let a1ThresholdWeekly;
        if (selectedYear === '2024') {
            // Use the selected 2024 period to determine A1 threshold
            a1ThresholdWeekly = selected2024Period === 'jan-sep' ? 441.00 : 496.00;
        } else {
            // 2025 uses \u20ac527 weekly
            a1ThresholdWeekly = 527.00;
        }

        const a1Threshold = currentPeriod.label === 'Weekly' ? a1ThresholdWeekly :
                          currentPeriod.label === 'Fortnightly' ? a1ThresholdWeekly * 2 :
                          currentPeriod.label === 'Monthly' ? Math.round(a1ThresholdWeekly * 4.333 * 100) / 100 :
                          a1ThresholdWeekly * 52; // Annual

        prsiBreakdown.bands.push({
            code: 'A1',
            range: `Over ${formatCurrency(a1Threshold)}`,
            rate: prsiRate,
            periodPRSI: roundToThree(periodPRSI),
            credit: 0,
            netPRSI: roundToThree(periodPRSI),
            description: `${(prsiRate * 100).toFixed(1)}% standard rate`
        });

        prsiBreakdown.total = roundToThree(periodPRSI * periodMultiplier);
        return prsiBreakdown;
    }

    return prsiBreakdown;
}

function calculatePAYEWithBreakdown(grossIncome, status = 'single') {
    const currentPeriod = getCurrentPeriodConfig();

    let standardBand;
    let taxCredits;

    if (status === 'manual') {
        const defaultCredits = selectedYear === '2024' ? 3750 : 4000;
        const defaultCutOff = selectedYear === '2024' ? 42000 : 44000;
        const manualCutOffEl = document.getElementById('manualCutOffPoint');
        const manualTaxCreditsEl = document.getElementById('manualTaxCredits');
        standardBand = (manualCutOffEl ? parseFloat(manualCutOffEl.value) : NaN) || defaultCutOff;
        taxCredits = (manualTaxCreditsEl ? parseFloat(manualTaxCreditsEl.value) : NaN) || defaultCredits;
    } else if (status === 'married') {
        standardBand = PAYE_RATES.standardBandMarried;
        taxCredits = calculateTaxCredits(status);
    } else if (status === 'marriedOneWorking') {
        standardBand = PAYE_RATES.standardBandMarriedOneWorking;
        taxCredits = calculateTaxCredits(status);
    } else if (status === 'singleParent') {
        standardBand = PAYE_RATES.standardBandSingleParent;
        taxCredits = calculateTaxCredits(status);
    } else {
        standardBand = PAYE_RATES.standardBand;
        taxCredits = calculateTaxCredits(status);
    }

    // Convert to period amounts
    const periodGross = convertFromAnnual(grossIncome);
    const periodStandardBand = convertFromAnnual(standardBand);
    const periodTaxCredits = convertFromAnnual(taxCredits);

    let payeBreakdown = {
        grossIncome: roundToThree(grossIncome),
        periodGross: roundToThree(periodGross),
        period: currentPeriod.label,
        bands: [],
        grossTax: 0,
        taxCredits: roundToThree(taxCredits),
        periodTaxCredits: roundToThree(periodTaxCredits),
        standardBand: roundToThree(standardBand),
        periodStandardBand: roundToThree(periodStandardBand),
        netTax: 0,
        status: status
    };

    let totalGrossTax = 0;

    // Standard rate band (20%)
    if (grossIncome > 0) {
        const standardRateIncome = Math.min(grossIncome, standardBand);
        const standardRateTax = standardRateIncome * PAYE_RATES.standardRate;
        const periodStandardRateIncome = convertFromAnnual(standardRateIncome);
        const periodStandardRateTax = convertFromAnnual(standardRateTax);

        payeBreakdown.bands.push({
            rate: PAYE_RATES.standardRate,
            rateDisplay: (PAYE_RATES.standardRate * 100).toFixed(0),
            range: `${formatCurrency(0)} \u2212 ${formatCurrency(periodStandardBand)}`,
            annualRange: `${formatCurrency(0)} \u2212 ${formatCurrency(standardBand)}`,
            taxableAmount: roundToThree(periodStandardRateIncome),
            annualTaxableAmount: roundToThree(standardRateIncome),
            tax: roundToThree(periodStandardRateTax),
            annualTax: roundToThree(standardRateTax),
            description: 'Standard rate'
        });

        totalGrossTax += standardRateTax;
    }

    // Higher rate band (40%)
    const higherRateIncome = grossIncome - standardBand;
    const higherRateTax = higherRateIncome * PAYE_RATES.higherRate;
    const periodHigherRateIncome = convertFromAnnual(higherRateIncome);
    const periodHigherRateTax = convertFromAnnual(higherRateTax);

    if (higherRateIncome > 0) {
        payeBreakdown.bands.push({
            rate: PAYE_RATES.higherRate,
            rateDisplay: (PAYE_RATES.higherRate * 100).toFixed(0),
            range: `Over ${formatCurrency(periodStandardBand)}`,
            annualRange: `Over ${formatCurrency(standardBand)}`,
            taxableAmount: roundToThree(periodHigherRateIncome),
            annualTaxableAmount: roundToThree(higherRateIncome),
            tax: roundToThree(periodHigherRateTax),
            annualTax: roundToThree(higherRateTax),
            description: 'Higher rate'
        });

        totalGrossTax += higherRateTax;
    }

    payeBreakdown.grossTax = roundToThree(totalGrossTax);
    payeBreakdown.netTax = roundToThree(Math.max(0, totalGrossTax - taxCredits));

    return payeBreakdown;
}

function calculateTaxCredits(status = 'single') {
    if (status === 'manual') {
        const defaultCredits = selectedYear === '2024' ? 3750 : 4000;
        const manualTaxCreditsEl = document.getElementById('manualTaxCredits');
        const manualCredits = (manualTaxCreditsEl ? parseFloat(manualTaxCreditsEl.value) : NaN) || defaultCredits;
        return roundToThree(manualCredits);
    }

    switch (status) {
        case 'married':
            return TAX_CREDITS.marriedCredit + (TAX_CREDITS.employeeCredit * 2);
        case 'marriedOneWorking':
            return TAX_CREDITS.marriedOneWorkingCredit + TAX_CREDITS.employeeCredit;
        case 'singleParent':
            return TAX_CREDITS.personalCredit + TAX_CREDITS.employeeCredit + TAX_CREDITS.singleParentCredit;
        default:
            return TAX_CREDITS.personalCredit + TAX_CREDITS.employeeCredit;
    }
}

function calculateNetFromGross(grossIncome, status = 'single') {
    const paye = calculatePAYE(grossIncome, status);
    const payeBreakdown = calculatePAYEWithBreakdown(grossIncome, status);
    const uscBreakdown = calculateUSCWithBreakdown(grossIncome);
    const usc = uscBreakdown.total;
    const prsiBreakdown = calculatePRSIWithBreakdown(grossIncome);
    const prsi = prsiBreakdown.total;
    const taxCredits = calculateTaxCredits(status);

    const payeAfterCredits = roundToThree(Math.max(0, paye - taxCredits));

    const totalDeductions = roundToThree(payeAfterCredits + usc + prsi);
    const netIncome = roundToThree(grossIncome - totalDeductions);
    const takeHomePercentage = roundToThree((netIncome / grossIncome) * 100);

    return {
        grossIncome: roundToThree(grossIncome),
        paye: payeAfterCredits,
        payeBreakdown,
        usc,
        uscBreakdown,
        prsi,
        prsiBreakdown,
        taxCredits: roundToThree(taxCredits),
        totalDeductions,
        netIncome,
        takeHomePercentage
    };
}

function calculateGrossFromNet(targetNetIncome, status = 'single') {
    let grossEstimate = roundToThree(targetNetIncome * 1.4);
    let iterations = 0;
    const maxIterations = 100;
    const tolerance = 0.001; // Reduced tolerance for better accuracy

    while (iterations < maxIterations) {
        const result = calculateNetFromGross(grossEstimate, status);
        const difference = roundToThree(result.netIncome - targetNetIncome);

        if (Math.abs(difference) <= tolerance) {
            return {
                ...result,
                targetNetIncome: roundToThree(targetNetIncome),
                iterations: iterations + 1
            };
        }

        const adjustmentFactor = difference / result.netIncome;
        grossEstimate = roundToThree(grossEstimate * (1 - adjustmentFactor * 0.5));

        iterations++;
    }

    const finalResult = calculateNetFromGross(grossEstimate, status);
    return {
        ...finalResult,
        targetNetIncome: roundToThree(targetNetIncome),
        iterations,
        converged: false
    };
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatNumber(amount) {
    return new Intl.NumberFormat('en-IE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}

function formatPercentage(value) {
    return `${value.toFixed(1)}%`;
}
