/**
 * Week 53 payroll rules (Section 480B TCA).
 * Detection is driven by actual payday count in the calendar year, not Revenue week blocks.
 */
var PayrollWeek53 = (function() {
    'use strict';

    var PAY_DAY_INDEXES = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5
    };

    function normalizePayDay(payDay) {
        return PAY_DAY_INDEXES[payDay] ? payDay : 'friday';
    }

    function getPayDayJsIndex(payDay) {
        return PAY_DAY_INDEXES[normalizePayDay(payDay)] || 5;
    }

    function toLocalDate(date) {
        if (!date) return null;
        if (date instanceof Date) {
            return new Date(date.getFullYear(), date.getMonth(), date.getDate());
        }
        var parsed = new Date(date);
        if (isNaN(parsed.getTime())) return null;
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

    function sameLocalDate(a, b) {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    function getPaydaySequence(year, payDay) {
        var targetDay = getPayDayJsIndex(payDay);
        var dates = [];
        var cursor = new Date(year, 0, 1);
        var end = new Date(year, 11, 31);
        while (cursor <= end) {
            if (cursor.getDay() === targetDay) {
                dates.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
            }
            cursor.setDate(cursor.getDate() + 1);
        }
        return dates;
    }

    function countPaydaysInYear(year, payDay) {
        return getPaydaySequence(year, payDay).length;
    }

    function getPaydayIndexInYear(payDate, payDay) {
        var date = toLocalDate(payDate);
        if (!date) return 0;
        var sequence = getPaydaySequence(date.getFullYear(), payDay);
        for (var i = 0; i < sequence.length; i++) {
            if (sameLocalDate(sequence[i], date)) {
                return i + 1;
            }
        }
        return 0;
    }

    function isWeek53Year(year, payDay) {
        return countPaydaysInYear(year, payDay) > 52;
    }

    function getWeeklyPeriodsInYear(year, payDay) {
        return isWeek53Year(year, payDay) ? 53 : 52;
    }

    function getFortnightlyPaydaySequence(year, payDay) {
        var weekly = getPaydaySequence(year, payDay);
        var fortnightly = [];
        for (var i = 0; i < weekly.length; i += 2) {
            fortnightly.push(weekly[i]);
        }
        return fortnightly;
    }

    function getFortnightlyPeriodsInYear(year, payDay) {
        return getFortnightlyPaydaySequence(year, payDay).length;
    }

    function getFortnightlyPaydayIndex(payDate, payDay) {
        var date = toLocalDate(payDate);
        if (!date) return 0;
        var sequence = getFortnightlyPaydaySequence(date.getFullYear(), payDay);
        for (var i = 0; i < sequence.length; i++) {
            if (sameLocalDate(sequence[i], date)) {
                return i + 1;
            }
        }
        return 0;
    }

    function isWeek53PayRun(payDate, payDay) {
        var date = toLocalDate(payDate);
        if (!date) return false;
        var year = date.getFullYear();
        if (!isWeek53Year(year, payDay)) return false;
        return getPaydayIndexInYear(date, payDay) === 53;
    }

    function isWeek53FortnightlyPayRun(payDate, payDay) {
        var date = toLocalDate(payDate);
        if (!date) return false;
        var year = date.getFullYear();
        if (!isWeek53Year(year, payDay)) return false;
        var sequence = getFortnightlyPaydaySequence(year, payDay);
        if (sequence.length < 27) return false;
        return getFortnightlyPaydayIndex(date, payDay) === sequence.length;
    }

    function isWeek53FrequencyPayRun(payDate, payDay, frequency) {
        if (frequency === 'monthly') return false;
        if (frequency === 'fortnightly') return isWeek53FortnightlyPayRun(payDate, payDay);
        return isWeek53PayRun(payDate, payDay);
    }

    function isWeek53Eligible(company, year, payDay) {
        var normalizedPayDay = normalizePayDay(payDay);
        if (!isWeek53Year(year, normalizedPayDay)) return true;

        var log = company && company.payDateChangeLog ? company.payDateChangeLog : [];
        var yearKey = String(year);
        var changes = log.filter(function(entry) {
            return entry && String(entry.year) === yearKey;
        });
        if (changes.length === 0) return true;

        var lastChange = changes[changes.length - 1];
        var fromPayDay = normalizePayDay(lastChange.from);
        var toPayDay = normalizePayDay(lastChange.to);
        if (fromPayDay === toPayDay) return true;

        var had53Before = isWeek53Year(year, fromPayDay);
        var has53After = isWeek53Year(year, toPayDay);
        if (!had53Before && has53After) return false;
        return true;
    }

    function buildWeek53PeriodicAmounts(annualTC, annualCOP, frequency) {
        var annualTaxCredits = parseFloat(annualTC) || 0;
        var annualCutOff = parseFloat(annualCOP) || 0;
        var periodWeeks = frequency === 'fortnightly' ? 2 : 1;
        var extraTC = annualTaxCredits / 52;
        var extraCOP = annualCutOff / 52;
        var baseTC = (annualTaxCredits / 52) * periodWeeks;
        var baseCOP = (annualCutOff / 52) * periodWeeks;

        return {
            periodicTaxCredit: baseTC + extraTC,
            periodicStandardRateCutOffPoint: baseCOP + extraCOP,
            extraTaxCredit: extraTC,
            extraCutOffPoint: extraCOP
        };
    }

    function applyWeek53PayCap(payeResult, grossPay) {
        var gross = parseFloat(grossPay) || 0;
        var taxBeforeCredit = parseFloat(payeResult.taxBeforeCredit) || 0;
        var requestedCredit = parseFloat(payeResult.periodicTaxCredit != null
            ? payeResult.periodicTaxCredit
            : payeResult.taxCreditUsed) || 0;
        var cappedCredit = Math.min(requestedCredit, taxBeforeCredit, gross);
        var paye = Math.max(0, taxBeforeCredit - cappedCredit);

        return Object.assign({}, payeResult, {
            paye: parseFloat(paye.toFixed(2)),
            taxCreditUsed: parseFloat(cappedCredit.toFixed(2)),
            week53CreditCapped: cappedCredit < requestedCredit
        });
    }

    function buildPayrollWeek53Context(payDate, payDay, frequency, company) {
        var date = toLocalDate(payDate);
        var normalizedPayDay = normalizePayDay(payDay);
        var year = date ? date.getFullYear() : new Date().getFullYear();
        var freq = frequency || 'weekly';
        var week53Year = isWeek53Year(year, normalizedPayDay);
        var eligible = isWeek53Eligible(company, year, normalizedPayDay);
        var isRun = eligible && isWeek53FrequencyPayRun(date, normalizedPayDay, freq);

        return {
            year: year,
            payDay: normalizedPayDay,
            frequency: freq,
            isWeek53Year: week53Year,
            week53Eligible: eligible,
            isWeek53Run: isRun,
            weeklyPeriodsInYear: getWeeklyPeriodsInYear(year, normalizedPayDay),
            fortnightlyPeriodsInYear: getFortnightlyPeriodsInYear(year, normalizedPayDay),
            paydayIndex: freq === 'fortnightly'
                ? getFortnightlyPaydayIndex(date, normalizedPayDay)
                : getPaydayIndexInYear(date, normalizedPayDay)
        };
    }

    function getPeriodsPerYearForFrequency(frequency, year, payDay) {
        var normalizedPayDay = normalizePayDay(payDay);
        var taxYear = parseInt(year, 10) || new Date().getFullYear();
        if (frequency === 'weekly') return getWeeklyPeriodsInYear(taxYear, normalizedPayDay);
        if (frequency === 'fortnightly') return getFortnightlyPeriodsInYear(taxYear, normalizedPayDay);
        return 12;
    }

    function getStandardTcPeriodsPerYear(frequency) {
        if (frequency === 'weekly') return 52;
        if (frequency === 'fortnightly') return 26;
        return 12;
    }

    function recordPayDateChange(company, oldPayDay, newPayDay, year) {
        if (!company) return company;
        var fromDay = normalizePayDay(oldPayDay);
        var toDay = normalizePayDay(newPayDay);
        if (fromDay === toDay) return company;

        company.payDateChangeLog = company.payDateChangeLog || [];
        company.payDateChangeLog.push({
            year: String(year || new Date().getFullYear()),
            from: fromDay,
            to: toDay,
            changedAt: new Date().toISOString()
        });
        return company;
    }

    return {
        normalizePayDay: normalizePayDay,
        getPayDayJsIndex: getPayDayJsIndex,
        getPaydaySequence: getPaydaySequence,
        countPaydaysInYear: countPaydaysInYear,
        getPaydayIndexInYear: getPaydayIndexInYear,
        isWeek53Year: isWeek53Year,
        getWeeklyPeriodsInYear: getWeeklyPeriodsInYear,
        getFortnightlyPaydaySequence: getFortnightlyPaydaySequence,
        getFortnightlyPeriodsInYear: getFortnightlyPeriodsInYear,
        getFortnightlyPaydayIndex: getFortnightlyPaydayIndex,
        isWeek53PayRun: isWeek53PayRun,
        isWeek53FortnightlyPayRun: isWeek53FortnightlyPayRun,
        isWeek53FrequencyPayRun: isWeek53FrequencyPayRun,
        isWeek53Eligible: isWeek53Eligible,
        buildWeek53PeriodicAmounts: buildWeek53PeriodicAmounts,
        applyWeek53PayCap: applyWeek53PayCap,
        buildPayrollWeek53Context: buildPayrollWeek53Context,
        getPeriodsPerYearForFrequency: getPeriodsPerYearForFrequency,
        getStandardTcPeriodsPerYear: getStandardTcPeriodsPerYear,
        recordPayDateChange: recordPayDateChange
    };
})();