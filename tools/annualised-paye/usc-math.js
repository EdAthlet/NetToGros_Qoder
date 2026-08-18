/**
 * USC Lab math — 2026 standard USC bands + IPASS-like cumulative USC deduction card.
 * UMD: CommonJS (vitest) + window.UscLabMath (browser).
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.UscLabMath = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var YEAR = 2026;
  var WEEKS_PER_YEAR = 52;
  var EXEMPT_ANNUAL = 13000;
  var PREPOP_GROSS_COUNT = 4;

  /** Standard (non-reduced) 2026 USC — annual ceilings at the *end* of each rate. */
  var USC_2026 = {
    rate1: { annualEnd: 12012, rate: 0.005, label: '0.5%' },
    rate2: { annualEnd: 27382, rate: 0.02, label: '2%' },
    rate3: { annualEnd: 70044, rate: 0.03, label: '3%' },
    rate4: { annualEnd: Infinity, rate: 0.08, label: '8%' }
  };

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function round4(n) {
    return Math.round((Number(n) + Number.EPSILON) * 10000) / 10000;
  }

  function num(v, fb) {
    var n = parseFloat(v);
    return isFinite(n) ? n : (fb != null ? fb : 0);
  }

  /** USC rates are 0.5% / 2% / 3% / 8% — never 2-decimal money rounding. */
  function isRateValue(v) {
    var n = Number(v);
    return isFinite(n) && n > 0 && n < 1;
  }

  function storeOperand(v) {
    var parsed = parseOperand(v);
    return parsed;
  }

  /**
   * Accept 0.005, "0.005", or "0.5%" (percent label).
   * parseFloat("0.5%") is 0.5 (50%) — that is the 3234 bug.
   */
  function parseOperand(raw) {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number') {
      if (!isFinite(raw)) return null;
      return isRateValue(raw) ? round4(raw) : round2(raw);
    }
    var s = String(raw).trim().replace(/,/g, '');
    if (!s) return null;
    var pct = s.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    if (pct) {
      return round4(parseFloat(pct[1], 10) / 100);
    }
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return isRateValue(n) ? round4(n) : round2(n);
  }

  function formatRateLabel(v) {
    if (typeof v === 'string' && /%$/.test(v.trim())) {
      var fromPct = parseOperand(v);
      if (fromPct == null) return String(v);
      v = fromPct;
    }
    var n = Number(v);
    if (!isFinite(n)) return '';
    if (Math.abs(n - 0.005) < 1e-6) return '0.5%';
    if (Math.abs(n - 0.02) < 1e-6) return '2%';
    if (Math.abs(n - 0.03) < 1e-6) return '3%';
    if (Math.abs(n - 0.08) < 1e-6) return '8%';
    if (isRateValue(n)) return round4(n * 100) + '%';
    return String(n);
  }

  function evaluateUscOp(op, args) {
    args = (args || []).map(function (x) { return parseOperand(x); });
    var a = args[0];
    var b = args[1];
    var c = args[2];
    var d = args[3];
    if (a == null) return null;
    if (op === '+') return b == null ? null : round2(a + b);
    if (op === '-') return b == null ? null : round2(a - b);
    if (op === '×') return b == null ? null : round2(a * b);
    if (op === 'max0') return b == null ? null : round2(Math.max(0, a - b));
    if (op === '×div') return b == null ? null : round2(a * round2(b / 52));
    if (op === '×min') return (b == null || c == null) ? null : round2(Math.min(a, b) * c);
    if (op === 'bandx') return (b == null || c == null || d == null) ? null : round2(Math.max(0, Math.min(a, b) - c) * d);
    if (op === 'max0x') return (b == null || c == null) ? null : round2(Math.max(0, a - b) * c);
    if (op === 'sum4') return (b == null || c == null || d == null) ? null : round2(a + b + c + d);
    return null;
  }

  function periodSlice(annual, periods) {
    return round2(num(annual, 0) / Math.max(1, parseInt(periods, 10) || WEEKS_PER_YEAR));
  }

  function weeklyCops() {
    return {
      rate1: periodSlice(USC_2026.rate1.annualEnd, 52),
      rate2: periodSlice(USC_2026.rate2.annualEnd, 52),
      rate3: periodSlice(USC_2026.rate3.annualEnd, 52)
    };
  }

  function periodThresholds(periodsPerYear) {
    var ppy = Math.max(1, parseInt(periodsPerYear, 10) || 52);
    return {
      periodsPerYear: ppy,
      rate1End: periodSlice(USC_2026.rate1.annualEnd, ppy),
      rate2End: periodSlice(USC_2026.rate2.annualEnd, ppy),
      rate3End: periodSlice(USC_2026.rate3.annualEnd, ppy),
      exempt: periodSlice(EXEMPT_ANNUAL, ppy)
    };
  }

  /**
   * Threshold table for the USC Lab rates page.
   * Each row is one USC band with annual + weekly / fortnightly / monthly ends.
   */
  function thresholdTable2026() {
    var weekly = periodThresholds(52);
    var fortnightly = periodThresholds(26);
    var monthly = periodThresholds(12);
    return {
      year: YEAR,
      exemptAnnual: EXEMPT_ANNUAL,
      bands: [
        {
          band: 1,
          rate: USC_2026.rate1.rate,
          rateLabel: USC_2026.rate1.label,
          annualFrom: 0,
          annualTo: USC_2026.rate1.annualEnd,
          weeklyTo: weekly.rate1End,
          fortnightlyTo: fortnightly.rate1End,
          monthlyTo: monthly.rate1End
        },
        {
          band: 2,
          rate: USC_2026.rate2.rate,
          rateLabel: USC_2026.rate2.label,
          annualFrom: USC_2026.rate1.annualEnd,
          annualTo: USC_2026.rate2.annualEnd,
          weeklyTo: weekly.rate2End,
          fortnightlyTo: fortnightly.rate2End,
          monthlyTo: monthly.rate2End
        },
        {
          band: 3,
          rate: USC_2026.rate3.rate,
          rateLabel: USC_2026.rate3.label,
          annualFrom: USC_2026.rate2.annualEnd,
          annualTo: USC_2026.rate3.annualEnd,
          weeklyTo: weekly.rate3End,
          fortnightlyTo: fortnightly.rate3End,
          monthlyTo: monthly.rate3End
        },
        {
          band: 4,
          rate: USC_2026.rate4.rate,
          rateLabel: USC_2026.rate4.label,
          annualFrom: USC_2026.rate3.annualEnd,
          annualTo: null,
          weeklyTo: null,
          fortnightlyTo: null,
          monthlyTo: null
        }
      ]
    };
  }

  function uscDueFromCumulative(cumGross, cop1, cop2, cop3) {
    var c = Math.max(0, num(cumGross, 0));
    var d = Math.max(0, num(cop1, 0));
    var f = Math.max(0, num(cop2, 0));
    var h = Math.max(0, num(cop3, 0));
    var due1 = round2(Math.min(c, d) * USC_2026.rate1.rate);
    var due2 = round2(Math.max(0, Math.min(c, f) - d) * USC_2026.rate2.rate);
    var due3 = round2(Math.max(0, Math.min(c, h) - f) * USC_2026.rate3.rate);
    var due4 = round2(Math.max(0, c - h) * USC_2026.rate4.rate);
    var total = round2(due1 + due2 + due3 + due4);
    return {
      due1: due1,
      due2: due2,
      due3: due3,
      due4: due4,
      total: total
    };
  }

  /**
   * IPASS-like Cumulative USC Deduction Card.
   * Columns: week, period gross, cum gross, COP1, due1, COP2, due2, COP3, due3, due4,
   * cum USC, deducted this period, refunded this period.
   */
  function computeUscCard(setup, periods) {
    setup = setup || {};
    periods = periods || [];
    var cops = weeklyCops();
    var weekly1 = setup.weeklyCop1 != null ? round2(num(setup.weeklyCop1)) : cops.rate1;
    var weekly2 = setup.weeklyCop2 != null ? round2(num(setup.weeklyCop2)) : cops.rate2;
    var weekly3 = setup.weeklyCop3 != null ? round2(num(setup.weeklyCop3)) : cops.rate3;
    var openingC = num(setup.openingCumulativeGross, 0);
    var prevK = setup.openingCumulativeUsc != null
      ? num(setup.openingCumulativeUsc, 0)
      : 0;
    var rows = [];
    var cumC = openingC;

    for (var i = 0; i < periods.length; i++) {
      var p = periods[i] || {};
      var weekNo = parseInt(p.weekNo, 10) || (i + 1);
      var gross = round2(num(p.gross, 0));
      var prevCum = cumC;
      cumC = round2(cumC + gross);
      var cop1 = round2(weekNo * weekly1);
      var cop2 = round2(weekNo * weekly2);
      var cop3 = round2(weekNo * weekly3);
      var due = uscDueFromCumulative(cumC, cop1, cop2, cop3);
      var deducted = round2(Math.max(0, due.total - prevK));
      var refunded = round2(Math.max(0, prevK - due.total));

      rows.push({
        weekNo: weekNo,
        gross: gross,
        cumGross: cumC,
        cop1: cop1,
        due1: due.due1,
        cop2: cop2,
        due2: due.due2,
        cop3: cop3,
        due3: due.due3,
        due4: due.due4,
        cumUsc: due.total,
        deducted: deducted,
        refunded: refunded,
        _meta: {
          weekly1: weekly1,
          weekly2: weekly2,
          weekly3: weekly3,
          prevCumGross: prevCum,
          prevCumUsc: prevK,
          openingCumulativeGross: openingC,
          openingCumulativeUsc: num(setup.openingCumulativeUsc, 0)
        }
      });
      prevK = due.total;
    }

    return {
      weekly1: weekly1,
      weekly2: weekly2,
      weekly3: weekly3,
      rates: USC_2026,
      rows: rows
    };
  }

  /**
   * Opening cumulative USC due immediately *before* startWeek,
   * given opening cumulative gross (as if that YTD is measured at week startWeek-1).
   */
  function openingUscFromGross(openingGross, startWeek) {
    var weekBefore = Math.max(0, (parseInt(startWeek, 10) || 1) - 1);
    if (weekBefore < 1) return 0;
    var cops = weeklyCops();
    var due = uscDueFromCumulative(
      openingGross,
      round2(weekBefore * cops.rate1),
      round2(weekBefore * cops.rate2),
      round2(weekBefore * cops.rate3)
    );
    return due.total;
  }

  /**
   * Amended 2026-style weekly grosses (not the 2019 textbook 720/650/525/490).
   * First four are the locked practice pays; later weeks vary.
   */
  function defaultPracticeGrosses(count) {
    var series = [980, 870, 790, 1040, 760, 910, 680, 1150, 830, 990, 720, 1080];
    var out = [];
    var n = Math.max(1, parseInt(count, 10) || 8);
    for (var i = 0; i < n; i++) {
      out.push(series[i % series.length]);
    }
    return out;
  }

  function defaultPracticeSetup() {
    var startWeek = 28;
    var periodCount = 8;
    var openingGross = 18240;
    return {
      startWeek: startWeek,
      periodCount: periodCount,
      openingCumulativeGross: openingGross,
      openingCumulativeUsc: openingUscFromGross(openingGross, startWeek),
      weeklyCops: weeklyCops()
    };
  }

  return {
    YEAR: YEAR,
    WEEKS_PER_YEAR: WEEKS_PER_YEAR,
    EXEMPT_ANNUAL: EXEMPT_ANNUAL,
    PREPOP_GROSS_COUNT: PREPOP_GROSS_COUNT,
    USC_2026: USC_2026,
    round2: round2,
    round4: round4,
    num: num,
    isRateValue: isRateValue,
    storeOperand: storeOperand,
    parseOperand: parseOperand,
    formatRateLabel: formatRateLabel,
    evaluateUscOp: evaluateUscOp,
    periodSlice: periodSlice,
    weeklyCops: weeklyCops,
    periodThresholds: periodThresholds,
    thresholdTable2026: thresholdTable2026,
    uscDueFromCumulative: uscDueFromCumulative,
    computeUscCard: computeUscCard,
    openingUscFromGross: openingUscFromGross,
    defaultPracticeGrosses: defaultPracticeGrosses,
    defaultPracticeSetup: defaultPracticeSetup
  };
});
