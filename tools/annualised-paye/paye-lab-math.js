/**
 * PAYE Lab pure math — shared by browser lab + vitest (payroll-style practice checks).
 * 2026 single defaults: TC €4,000 · SRCOP €44,000 · weekly = annual ÷ 52.
 *
 * UMD: CommonJS (vitest) + window.PayeLabMath (browser).
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.PayeLabMath = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var RATE_20 = 0.2;
  var RATE_40 = 0.4;
  var WEEKS_PER_YEAR = 52;
  var DEFAULT_ANNUAL_TC = 4000;
  var DEFAULT_ANNUAL_SRCOP = 44000;
  /** First N practice taxable-pay cells are prepopulated; from N+1 free ovals. */
  var PREPOP_TAXABLE_COUNT = 4;

  var L1_FREQUENCY = {
    weekly: {
      key: 'weekly', label: 'weekly', periods: 52,
      defaultTaxable: 1000, defaultCount: 8,
      l2DefaultGross: 720, l2DefaultCount: 4, l2DefaultStart: 28,
      l2OpeningD: 16645, l2OpeningK: 1615.31,
      uscDefaultStart: 28, uscDefaultCount: 8, uscOpeningC: 18240
    },
    fortnightly: {
      key: 'fortnightly', label: 'fortnightly', periods: 26,
      defaultTaxable: 2000, defaultCount: 6,
      l2DefaultGross: 1440, l2DefaultCount: 4, l2DefaultStart: 14,
      l2OpeningD: 16645, l2OpeningK: 1615.31,
      uscDefaultStart: 14, uscDefaultCount: 6, uscOpeningC: 18240
    },
    monthly: {
      key: 'monthly', label: 'monthly', periods: 12,
      defaultTaxable: 4000, defaultCount: 4,
      l2DefaultGross: 3120, l2DefaultCount: 4, l2DefaultStart: 7,
      l2OpeningD: 16645, l2OpeningK: 1615.31,
      uscDefaultStart: 7, uscDefaultCount: 4, uscOpeningC: 18240
    }
  };

  function frequencySpec(freq) {
    return L1_FREQUENCY[freq] || L1_FREQUENCY.weekly;
  }

  function clampStartPeriod(start, freq) {
    var max = frequencySpec(freq).periods;
    var s = parseInt(start, 10);
    if (!isFinite(s) || s < 1) return 1;
    if (s > max) return max;
    return s;
  }

  function remainingPeriods(start, freq) {
    var spec = frequencySpec(freq);
    var s = clampStartPeriod(start, freq);
    return Math.max(1, spec.periods - s + 1);
  }

  function clampPeriodCount(count, start, freq) {
    var rem = remainingPeriods(start, freq);
    var spec = frequencySpec(freq);
    var c = parseInt(count, 10);
    if (!isFinite(c) || c < 1) c = spec.defaultCount;
    if (c > rem) return rem;
    return c;
  }

  function frequencyFieldLabel(base, freq) {
    return String(base || '') + ' (' + frequencySpec(freq).label + ')';
  }

  function frequencyConstLabel(freq) {
    var spec = frequencySpec(freq);
    return spec.periods + (spec.key === 'weekly' ? ' weeks' : ' periods');
  }

  function l2SamplePeriods(freq) {
    var spec = frequencySpec(freq);
    var start = spec.l2DefaultStart;
    var scale = WEEKS_PER_YEAR / spec.periods;
    var base = [720, 650, 525, 490];
    return base.map(function (g, i) {
      return { weekNo: start + i, gross: round2(g * scale), pension: 0 };
    });
  }

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function num(v, fb) {
    var n = parseFloat(v);
    return isFinite(n) ? n : (fb != null ? fb : 0);
  }

  function flatPeriodTc(annualTc, schedulePeriods) {
    var schedule = Math.max(1, parseInt(schedulePeriods, 10) || WEEKS_PER_YEAR);
    return round2(num(annualTc, 0) / schedule);
  }

  function autoPeriodCop(annualCop, schedulePeriods) {
    var schedule = Math.max(1, parseInt(schedulePeriods, 10) || WEEKS_PER_YEAR);
    return round2(num(annualCop, 0) / schedule);
  }

  function autoPeriodTc(annualisedTc, schedulePeriods, submittedBefore) {
    var schedule = Math.max(1, parseInt(schedulePeriods, 10) || WEEKS_PER_YEAR);
    var before = Math.max(0, parseInt(submittedBefore, 10) || 0);
    var periodsLeft = Math.max(schedule - before, 1);
    return round2(num(annualisedTc, 0) / periodsLeft);
  }

  /**
   * Remaining annual TC after even flat period TC used in prior periods.
   * e.g. start period 10 → 9 × flat weekly TC subtracted from annual.
   */
  function remainingTcAfterEvenPrior(annualTc, schedulePeriods, periodsBefore) {
    var annual = round2(num(annualTc, 0));
    var before = Math.max(0, parseInt(periodsBefore, 10) || 0);
    if (before <= 0) return annual;
    var flat = flatPeriodTc(annual, schedulePeriods);
    var used = round2(flat * before);
    return round2(Math.max(0, annual - used));
  }

  /**
   * Level 1 period-basis PAYE for one period.
   */
  function computeRowTax(taxablePay, periodCop, periodTc) {
    var pay = Math.max(0, num(taxablePay, 0));
    var cop = Math.max(0, num(periodCop, 0));
    var credit = Math.max(0, num(periodTc, 0));
    var taxable20 = Math.min(pay, cop);
    var taxable40 = Math.max(0, pay - cop);
    var paye20 = taxable20 * RATE_20;
    var paye40 = taxable40 * RATE_40;
    var totalPaye = paye20 + paye40;
    var appliedTc = Math.min(credit, totalPaye);
    var netTax = Math.max(0, totalPaye - appliedTc);
    return {
      taxable20: round2(taxable20),
      taxable40: round2(taxable40),
      paye20: round2(paye20),
      paye40: round2(paye40),
      totalPaye: round2(totalPaye),
      appliedTc: round2(appliedTc),
      netTax: round2(netTax)
    };
  }

  /**
   * Level 1 practice answer key (same cascade as app.js buildAnswerKey).
   */
  function buildL1AnswerKey(opts) {
    var schedule = Math.max(1, parseInt(opts.schedule, 10) || WEEKS_PER_YEAR);
    var setupAnnualTc = num(opts.annualTc, DEFAULT_ANNUAL_TC);
    var fullAnnualCop = num(opts.annualCop, DEFAULT_ANNUAL_SRCOP);
    var startP = Math.max(1, parseInt(opts.startPeriod, 10) || 1);
    var submittedBefore = 0;
    var remaining = setupAnnualTc;
    var flatTc = flatPeriodTc(setupAnnualTc, schedule);
    if (startP > 1) {
      submittedBefore = startP - 1;
      remaining = remainingTcAfterEvenPrior(setupAnnualTc, schedule, submittedBefore);
    }
    var taxablePays = opts.taxablePays || [];
    var out = [];

    for (var i = 0; i < taxablePays.length; i++) {
      var period = startP + i;
      var periodsLeft = Math.max(schedule - submittedBefore, 1);
      var prevLeft = remaining;
      var evenPriorOpening = i === 0 && startP > 1;
      var annualisedTc = round2(remaining);
      var periodTc = round2(autoPeriodTc(annualisedTc, schedule, submittedBefore));
      var annualisedCop = round2(fullAnnualCop);
      var periodCop = round2(autoPeriodCop(annualisedCop, schedule));
      var taxablePay = round2(taxablePays[i]);
      var tax = computeRowTax(taxablePay, periodCop, periodTc);
      var tcLeftAfter = round2(annualisedTc - tax.appliedTc);
      out.push({
        period: period,
        annualisedTc: annualisedTc,
        periodTc: periodTc,
        taxablePay: taxablePay,
        annualisedCop: annualisedCop,
        periodCop: periodCop,
        taxable20: tax.taxable20,
        taxable40: tax.taxable40,
        paye20: tax.paye20,
        paye40: tax.paye40,
        totalPaye: tax.totalPaye,
        appliedTc: tax.appliedTc,
        netTax: tax.netTax,
        tcLeftAfter: tcLeftAfter,
        _meta: {
          schedule: schedule,
          frequencyLabel: opts.frequencyLabel || (schedule === 12 ? 'monthly' : schedule === 26 ? 'fortnightly' : 'weekly'),
          submittedBefore: submittedBefore,
          periodsLeft: periodsLeft,
          prevLeft: prevLeft,
          evenPriorOpening: evenPriorOpening,
          priorPeriodsEven: evenPriorOpening ? startP - 1 : 0,
          flatPeriodTc: round2(flatTc),
          setupAnnualTc: setupAnnualTc,
          setupAnnualCop: fullAnnualCop,
          rowIndex: i,
          tableStartPeriod: startP
        }
      });
      remaining = tcLeftAfter;
      submittedBefore += 1;
    }
    return out;
  }

  /**
   * Column E practice: E = Period No. × (Annual SRCOP ÷ schedule).
   * Schedule (52 / 26 / 12) is a fixed constant (not student-chosen).
   */
  function evaluateCumSrcopE(weekNo, annualSrcop, schedulePeriods) {
    var w = parseInt(weekNo, 10) || 0;
    var annual = num(annualSrcop, DEFAULT_ANNUAL_SRCOP);
    var schedule = Math.max(1, parseInt(schedulePeriods, 10) || WEEKS_PER_YEAR);
    var weekly = round2(annual / schedule);
    return round2(w * weekly);
  }

  /**
   * IPASS-like cumulative tax deduction card (columns A–O drivers → calcs).
   * @param {object} setup
   * @param {Array<{weekNo:number,gross:number,pension?:number}>} periods
   */
  function computeIpassCard(setup, periods) {
    setup = setup || {};
    periods = periods || [];
    var annualTc = num(setup.annualTc, DEFAULT_ANNUAL_TC);
    var annualSrcop = num(setup.annualSrcop, DEFAULT_ANNUAL_SRCOP);
    var periodsPerYear = num(setup.periodsPerYear, WEEKS_PER_YEAR);
    var freqKey = setup.frequency || (periodsPerYear === 26 ? 'fortnightly' : periodsPerYear === 12 ? 'monthly' : 'weekly');
    var freqLabel = setup.frequencyLabel || frequencySpec(freqKey).label;
    var rateStd = num(setup.rateStd, RATE_20);
    var rateHigh = num(setup.rateHigh, RATE_40);
    var prsiEeRate = num(setup.prsiEeRate, 0.04);
    var prsiErRate = num(setup.prsiErRate, 0.1095);

    var weeklyTc = setup.weeklyTc != null && setup.weeklyTc !== ''
      ? round2(num(setup.weeklyTc))
      : round2(annualTc / periodsPerYear);
    var weeklySrcop = setup.weeklySrcop != null && setup.weeklySrcop !== ''
      ? round2(num(setup.weeklySrcop))
      : round2(annualSrcop / periodsPerYear);

    var openingD = num(setup.openingCumulativeTaxable, 0);
    var prevK = num(setup.openingCumulativeTaxDue, 0);
    var rows = [];
    var cumD = openingD;

    for (var i = 0; i < periods.length; i++) {
      var p = periods[i] || {};
      var weekNo = parseInt(p.weekNo, 10) || (i + 1);
      var gross = round2(num(p.gross, 0));
      var pension = round2(num(p.pension, 0));
      var taxable = round2(Math.max(0, gross - pension));

      var prevCumTaxable = cumD;
      cumD = round2(cumD + taxable);
      var cumSrcop = round2(weekNo * weeklySrcop);
      var cumHigher = round2(Math.max(0, cumD - cumSrcop));
      var cumStdBase = round2(Math.min(cumD, cumSrcop));
      var cumTaxStd = round2(cumStdBase * rateStd);
      var cumTaxHigh = round2(cumHigher * rateHigh);
      var cumGrossTax = round2(cumTaxStd + cumTaxHigh);
      var cumTc = round2(weekNo * weeklyTc);
      var cumTaxDue = round2(Math.max(0, cumGrossTax - cumTc));

      var taxDeducted = round2(Math.max(0, cumTaxDue - prevK));
      var taxRefunded = round2(Math.max(0, prevK - cumTaxDue));
      var prsiEe = round2(gross * prsiEeRate);
      var prsiEr = round2(gross * prsiErRate);

      rows.push({
        weekNo: weekNo,
        gross: gross,
        pension: pension,
        taxable: taxable,
        cumTaxable: cumD,
        cumSrcop: cumSrcop,
        cumHigher: cumHigher,
        cumStdBase: cumStdBase,
        cumTaxStd: cumTaxStd,
        cumTaxHigh: cumTaxHigh,
        cumGrossTax: cumGrossTax,
        cumTc: cumTc,
        cumTaxDue: cumTaxDue,
        taxDeducted: taxDeducted,
        taxRefunded: taxRefunded,
        prsiEe: prsiEe,
        prsiEr: prsiEr,
        _meta: {
          weeklyTc: weeklyTc,
          weeklySrcop: weeklySrcop,
          rateStd: rateStd,
          rateHigh: rateHigh,
          prsiEeRate: prsiEeRate,
          prsiErRate: prsiErRate,
          prevCumTaxDue: prevK,
          prevCumTaxable: prevCumTaxable,
          annualTc: annualTc,
          annualSrcop: annualSrcop,
          periodsPerYear: periodsPerYear,
          frequency: freqKey,
          frequencyLabel: freqLabel,
          openingCumulativeTaxable: openingD,
          openingCumulativeTaxDue: num(setup.openingCumulativeTaxDue, 0)
        }
      });
      prevK = cumTaxDue;
    }

    return {
      weeklyTc: weeklyTc,
      weeklySrcop: weeklySrcop,
      rows: rows
    };
  }

  function nearlyEqual(a, b, tol) {
    tol = tol != null ? tol : 0.02;
    return Math.abs(round2(a) - round2(b)) <= tol;
  }

  function isTaxablePrepopulated(rowIdx) {
    return rowIdx < PREPOP_TAXABLE_COUNT;
  }

  return {
    RATE_20: RATE_20,
    RATE_40: RATE_40,
    WEEKS_PER_YEAR: WEEKS_PER_YEAR,
    DEFAULT_ANNUAL_TC: DEFAULT_ANNUAL_TC,
    DEFAULT_ANNUAL_SRCOP: DEFAULT_ANNUAL_SRCOP,
    PREPOP_TAXABLE_COUNT: PREPOP_TAXABLE_COUNT,
    L1_FREQUENCY: L1_FREQUENCY,
    frequencySpec: frequencySpec,
    clampStartPeriod: clampStartPeriod,
    remainingPeriods: remainingPeriods,
    clampPeriodCount: clampPeriodCount,
    frequencyFieldLabel: frequencyFieldLabel,
    frequencyConstLabel: frequencyConstLabel,
    l2SamplePeriods: l2SamplePeriods,
    round2: round2,
    num: num,
    flatPeriodTc: flatPeriodTc,
    autoPeriodCop: autoPeriodCop,
    autoPeriodTc: autoPeriodTc,
    remainingTcAfterEvenPrior: remainingTcAfterEvenPrior,
    computeRowTax: computeRowTax,
    buildL1AnswerKey: buildL1AnswerKey,
    evaluateCumSrcopE: evaluateCumSrcopE,
    computeIpassCard: computeIpassCard,
    nearlyEqual: nearlyEqual,
    isTaxablePrepopulated: isTaxablePrepopulated
  };
});
