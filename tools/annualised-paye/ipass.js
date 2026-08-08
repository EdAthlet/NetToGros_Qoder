/**
 * Level 2 — IPASS-like Cumulative Tax Deduction Card
 * Columns A–O match Irish Payroll Association style training card.
 */
(function () {
  'use strict';

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function num(v, fb) {
    var n = parseFloat(v);
    return isFinite(n) ? n : (fb != null ? fb : 0);
  }

  function fmt(n) {
    if (n == null || n === '' || !isFinite(Number(n))) return '—';
    return round2(n).toFixed(2);
  }

  function money(n) {
    return '€' + fmt(n);
  }

  /**
   * Compute one cumulative card from setup + period inputs.
   * @param {object} setup
   * @param {Array<{weekNo:number,gross:number,pension?:number}>} periods
   */
  function computeCard(setup, periods) {
    var annualTc = num(setup.annualTc, 3300);
    var annualSrcop = num(setup.annualSrcop, 35300);
    var periodsPerYear = num(setup.periodsPerYear, 52);
    var rateStd = num(setup.rateStd, 0.2);
    var rateHigh = num(setup.rateHigh, 0.4);
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
      var p = periods[i];
      var weekNo = parseInt(p.weekNo, 10) || (i + 1);
      var gross = round2(num(p.gross, 0));
      var pension = round2(num(p.pension, 0));
      var taxable = round2(Math.max(0, gross - pension));

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
          prevCumTaxDue: prevK,
          annualTc: annualTc,
          annualSrcop: annualSrcop,
          periodsPerYear: periodsPerYear
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

  /** Bryan Wallace-style demo periods (weeks 28–31) from the sample card. */
  function sampleBryanWallacePeriods() {
    return [
      { weekNo: 28, gross: 720, pension: 0 },
      { weekNo: 29, gross: 650, pension: 0 },
      { weekNo: 30, gross: 525, pension: 0 },
      { weekNo: 31, gross: 490, pension: 0 }
    ];
  }

  /** Opening balances so week 28 matches the card when using sample pays. */
  function sampleBryanWallaceOpening() {
    // D for week 28 = 17365 = opening + 720 → opening = 16645
    // K for week 27 implied: L=80.53, K=1695.84 → prevK = 1695.84 - 80.53 = 1615.31
    return {
      openingCumulativeTaxable: 16645,
      openingCumulativeTaxDue: 1615.31
    };
  }

  // ——— Worksheet UI ———
  var els = {
    tbody: document.getElementById('ipass-rows'),
    annualTc: document.getElementById('ipass-annual-tc'),
    annualSrcop: document.getElementById('ipass-annual-srcop'),
    startWeek: document.getElementById('ipass-start-week'),
    periodCount: document.getElementById('ipass-period-count'),
    defaultGross: document.getElementById('ipass-default-gross'),
    openingD: document.getElementById('ipass-opening-d'),
    openingK: document.getElementById('ipass-opening-k'),
    weeklyTcOut: document.getElementById('ipass-weekly-tc'),
    weeklySrcopOut: document.getElementById('ipass-weekly-srcop'),
    btnBuild: document.getElementById('btn-ipass-build'),
    btnSample: document.getElementById('btn-ipass-sample'),
    btnClear: document.getElementById('btn-ipass-clear')
  };

  /** @type {Array<{weekNo:number,gross:number,pension:number}>} */
  var sheetInputs = [];

  function getIpassSetup() {
    return {
      annualTc: num(els.annualTc && els.annualTc.value, 3300),
      annualSrcop: num(els.annualSrcop && els.annualSrcop.value, 35300),
      periodsPerYear: 52,
      rateStd: 0.2,
      rateHigh: 0.4,
      prsiEeRate: 0.04,
      prsiErRate: 0.1095,
      openingCumulativeTaxable: num(els.openingD && els.openingD.value, 0),
      openingCumulativeTaxDue: num(els.openingK && els.openingK.value, 0)
    };
  }

  function buildInputsFromSetup() {
    var start = Math.max(1, parseInt(els.startWeek && els.startWeek.value, 10) || 1);
    var count = Math.max(1, Math.min(53, parseInt(els.periodCount && els.periodCount.value, 10) || 8));
    var gross = num(els.defaultGross && els.defaultGross.value, 700);
    sheetInputs = [];
    for (var i = 0; i < count; i++) {
      sheetInputs.push({ weekNo: start + i, gross: gross, pension: 0 });
    }
    // Drop published weekly overrides when rebuilding from annual inputs
    delete sheetInputs._weeklyOverride;
  }

  function renderIpassTable() {
    if (!els.tbody) return;
    var setup = getIpassSetup();
    if (sheetInputs._weeklyOverride) {
      setup.weeklyTc = sheetInputs._weeklyOverride.weeklyTc;
      setup.weeklySrcop = sheetInputs._weeklyOverride.weeklySrcop;
    }
    var card = computeCard(setup, sheetInputs);
    if (els.weeklyTcOut) els.weeklyTcOut.textContent = money(card.weeklyTc);
    if (els.weeklySrcopOut) els.weeklySrcopOut.textContent = money(card.weeklySrcop);

    var html = '';
    card.rows.forEach(function (r, idx) {
      html += '<tr data-ipass-idx="' + idx + '">';
      html += '<td class="ipass-week">' + r.weekNo + '</td>';
      html += cellInput(idx, 'gross', r.gross);
      html += cellInput(idx, 'taxable', r.taxable);
      html += cellRo(r.cumTaxable);
      html += cellRo(r.cumSrcop);
      html += cellRo(r.cumHigher);
      html += cellRo(r.cumTaxStd);
      html += cellRo(r.cumTaxHigh);
      html += cellRo(r.cumGrossTax);
      html += cellRo(r.cumTc);
      html += cellRo(r.cumTaxDue);
      html += cellRo(r.taxDeducted);
      html += cellRo(r.taxRefunded === 0 ? '—' : r.taxRefunded, r.taxRefunded === 0);
      html += cellRo(r.prsiEe);
      html += cellRo(r.prsiEr);
      html += '</tr>';
    });
    if (!card.rows.length) {
      html = '<tr><td colspan="15" class="ipass-empty">No periods — click Build card or Load sample (Bryan Wallace).</td></tr>';
    }
    els.tbody.innerHTML = html;
  }

  function cellInput(idx, field, value) {
    return (
      '<td><input type="text" inputmode="decimal" class="ipass-input driver" data-idx="' +
      idx + '" data-field="' + field + '" value="' + fmt(value) + '" /></td>'
    );
  }

  function cellRo(value, isDash) {
    var t = isDash ? '—' : fmt(value);
    return '<td class="ipass-calc"><span class="ipass-ro">' + t + '</span></td>';
  }

  function onIpassInput(e) {
    var t = e.target;
    if (!t || !t.dataset || t.dataset.idx == null) return;
    var idx = parseInt(t.dataset.idx, 10);
    var field = t.dataset.field;
    if (!sheetInputs[idx]) return;
    var v = num(t.value, 0);
    if (field === 'gross') {
      var prevTaxable = round2(sheetInputs[idx].gross - (sheetInputs[idx].pension || 0));
      sheetInputs[idx].gross = v;
      if (sheetInputs[idx]._taxableLocked) {
        sheetInputs[idx].pension = round2(Math.max(0, v - prevTaxable));
      } else {
        sheetInputs[idx].pension = 0;
      }
    }
    if (field === 'taxable') {
      var g = sheetInputs[idx].gross;
      sheetInputs[idx].pension = round2(Math.max(0, g - v));
      sheetInputs[idx]._taxableLocked = true;
    }
    renderIpassTable();
    var again = els.tbody.querySelector('input[data-idx="' + idx + '"][data-field="' + field + '"]');
    if (again) {
      again.focus();
      try {
        var len = again.value.length;
        again.setSelectionRange(len, len);
      } catch (err) { /* ignore */ }
    }
  }

  function loadSample() {
    if (els.annualTc) els.annualTc.value = '3300';
    if (els.annualSrcop) els.annualSrcop.value = '35300';
    if (els.startWeek) els.startWeek.value = '28';
    if (els.periodCount) els.periodCount.value = '4';
    if (els.defaultGross) els.defaultGross.value = '720';
    var open = sampleBryanWallaceOpening();
    if (els.openingD) els.openingD.value = String(open.openingCumulativeTaxable);
    if (els.openingK) els.openingK.value = String(open.openingCumulativeTaxDue);
    // Card publishes weekly figures (63.47 / 678.85) rather than raw annual÷52 rounding
    sheetInputs = sampleBryanWallacePeriods().map(function (p) {
      return { weekNo: p.weekNo, gross: p.gross, pension: p.pension || 0 };
    });
    sheetInputs._weeklyOverride = { weeklyTc: 63.47, weeklySrcop: 678.85 };
    renderIpassTable();
  }

  function buildCard() {
    buildInputsFromSetup();
    renderIpassTable();
  }

  function clearCard() {
    sheetInputs = [];
    renderIpassTable();
  }

  if (els.btnBuild) els.btnBuild.addEventListener('click', buildCard);
  if (els.btnSample) els.btnSample.addEventListener('click', loadSample);
  if (els.btnClear) els.btnClear.addEventListener('click', clearCard);
  if (els.tbody) {
    els.tbody.addEventListener('change', onIpassInput);
  }

  window.PayeLabIpass = {
    computeCard: computeCard,
    round2: round2,
    fmt: fmt,
    money: money,
    num: num,
    getSetup: getIpassSetup,
    sampleBryanWallacePeriods: sampleBryanWallacePeriods,
    sampleBryanWallaceOpening: sampleBryanWallaceOpening,
    buildCard: buildCard,
    loadSample: loadSample,
    onShow: function () {
      if (!sheetInputs.length) loadSample();
      else renderIpassTable();
    }
  };

  // Initial sample when DOM ready
  if (els.tbody) {
    loadSample();
  }
})();
