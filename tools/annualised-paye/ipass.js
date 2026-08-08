/**
 * Level 2 — IPASS-like Cumulative Tax Deduction Card
 * Columns A–O match Irish Payroll Association style training card.
 * Defaults: 2026 single-person rates (TC €4,000 · SRCOP €44,000).
 */
(function () {
  'use strict';

  var DEFAULT_ANNUAL_TC = 4000;
  var DEFAULT_ANNUAL_SRCOP = 44000;
  var STORAGE_KEY_TIPS = 'payeLab.deriveTipsEnabled';

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

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Compute one cumulative card from setup + period inputs.
   * @param {object} setup
   * @param {Array<{weekNo:number,gross:number,pension?:number}>} periods
   */
  function computeCard(setup, periods) {
    var annualTc = num(setup.annualTc, DEFAULT_ANNUAL_TC);
    var annualSrcop = num(setup.annualSrcop, DEFAULT_ANNUAL_SRCOP);
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

  /**
   * Mid-year training sample (weeks 28–31).
   * Pay figures are arbitrary for the exercise; rates use 2026 single defaults.
   */
  function sampleMidYearPeriods() {
    return [
      { weekNo: 28, gross: 720, pension: 0 },
      { weekNo: 29, gross: 650, pension: 0 },
      { weekNo: 30, gross: 525, pension: 0 },
      { weekNo: 31, gross: 490, pension: 0 }
    ];
  }

  /** Opening balances before week 28 (training scenario). */
  function sampleMidYearOpening() {
    // D for week 28 = opening + 720; sample keeps opening D = 16645
    // Opening K (cum tax due after week 27) = 1615.31
    return {
      openingCumulativeTaxable: 16645,
      openingCumulativeTaxDue: 1615.31
    };
  }

  // ——— Worksheet UI ———
  var els = {
    tbody: document.getElementById('ipass-rows'),
    tableWrap: document.getElementById('ipass-table-wrap'),
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
    btnClear: document.getElementById('btn-ipass-clear'),
    deriveTipsEnabled: document.getElementById('ipass-derive-tips-enabled')
  };

  /** @type {Array<{weekNo:number,gross:number,pension:number}>} */
  var sheetInputs = [];
  /** @type {Array<Object>} last computed rows for tip HTML */
  var lastRows = [];

  // Reuse L1 tip element if app.js already created it
  var tipEl = document.getElementById('derive-tip');
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.id = 'derive-tip';
    tipEl.className = 'derive-tip';
    tipEl.setAttribute('role', 'tooltip');
    tipEl.hidden = true;
    document.body.appendChild(tipEl);
  }
  var tipHideTimer = null;

  function areDeriveTipsEnabled() {
    return !!(els.deriveTipsEnabled && els.deriveTipsEnabled.checked);
  }

  function applyDeriveTipsUiState() {
    var on = areDeriveTipsEnabled();
    if (els.tableWrap) {
      els.tableWrap.classList.toggle('derive-tips-off', !on);
    }
    if (!on) hideTip();
  }

  function loadDeriveTipsPreference() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY_TIPS);
      if (saved === '0' || saved === 'false') {
        if (els.deriveTipsEnabled) els.deriveTipsEnabled.checked = false;
      } else if (saved === '1' || saved === 'true') {
        if (els.deriveTipsEnabled) els.deriveTipsEnabled.checked = true;
      }
    } catch (e) { /* ignore */ }
    applyDeriveTipsUiState();
  }

  function saveDeriveTipsPreference() {
    try {
      localStorage.setItem(STORAGE_KEY_TIPS, areDeriveTipsEnabled() ? '1' : '0');
    } catch (e) { /* ignore */ }
  }

  function getIpassSetup() {
    return {
      annualTc: num(els.annualTc && els.annualTc.value, DEFAULT_ANNUAL_TC),
      annualSrcop: num(els.annualSrcop && els.annualSrcop.value, DEFAULT_ANNUAL_SRCOP),
      periodsPerYear: 52,
      rateStd: 0.2,
      rateHigh: 0.4,
      prsiEeRate: 0.04,
      prsiErRate: 0.1095,
      openingCumulativeTaxable: num(els.openingD && els.openingD.value, 0),
      openingCumulativeTaxDue: num(els.openingK && els.openingK.value, 0)
    };
  }

  function getBuildOptions() {
    return {
      startWeek: Math.max(1, parseInt(els.startWeek && els.startWeek.value, 10) || 1),
      periodCount: Math.max(1, Math.min(53, parseInt(els.periodCount && els.periodCount.value, 10) || 8)),
      defaultGross: num(els.defaultGross && els.defaultGross.value, 720)
    };
  }

  /**
   * Copy of current worksheet period drivers (week / gross / pension).
   * Empty array if the card has no rows yet.
   */
  function getSheetInputs() {
    return sheetInputs.map(function (p) {
      return {
        weekNo: p.weekNo,
        gross: p.gross,
        pension: p.pension || 0
      };
    });
  }

  /**
   * Related weekly gross figures scaled from default gross.
   * Pattern mirrors mid-year sample shape (100%, ~90%, ~73%, ~68%…), not fixed 720.
   */
  function relatedGrossSeries(defaultGross, count) {
    var base = Math.max(0, round2(defaultGross));
    // Sample shape relative to 720: 720, 650, 525, 490, then mild taper
    var ratios = [1, 650 / 720, 525 / 720, 490 / 720, 0.64, 0.6, 0.58, 0.55];
    var out = [];
    for (var i = 0; i < count; i++) {
      var r = ratios[i] != null ? ratios[i] : Math.max(0.45, 1 - i * 0.08);
      out.push(round2(base * r));
    }
    return out;
  }

  function buildPeriodsFromSetup(opts) {
    opts = opts || getBuildOptions();
    var start = opts.startWeek;
    var count = opts.periodCount;
    var grosses = relatedGrossSeries(opts.defaultGross, count);
    var periods = [];
    for (var i = 0; i < count; i++) {
      periods.push({ weekNo: start + i, gross: grosses[i], pension: 0 });
    }
    return periods;
  }

  function buildInputsFromSetup() {
    sheetInputs = buildPeriodsFromSetup(getBuildOptions());
  }

  function derivationHtml(row, field) {
    if (!row || !field) return '';
    var m = row._meta || {};
    var w = row.weekNo;
    var lines = [];
    var title = '';

    function add(label, text) {
      lines.push(
        '<div class="derive-line"><span class="derive-label">' + esc(label) +
        '</span><code>' + esc(text) + '</code></div>'
      );
    }

    if (field === 'gross') {
      title = 'B Gross pay this period';
      add('Source', 'Editable driver — pay subject to PRSI / starting point for taxable');
      add('Value', money(row.gross));
      add('Used in', 'C Taxable (if no pension), N EE PRSI, O ER PRSI');
    } else if (field === 'taxable') {
      title = 'C Taxable pay this period';
      add('Formula', 'max(0, Gross − pension / relief)');
      if (row.pension) {
        add('Calculation', money(row.gross) + ' − ' + money(row.pension) + ' = ' + money(row.taxable));
      } else {
        add('Calculation', money(row.gross) + ' (no pension) = ' + money(row.taxable));
      }
      add('Used in', 'D Cumulative taxable pay');
      add('Result', money(row.taxable));
    } else if (field === 'cumTaxable') {
      title = 'D Cumulative taxable pay';
      add('Formula', 'previous D + C this period');
      add('Previous D', money(m.prevCumTaxable) + (m.prevCumTaxable === m.openingCumulativeTaxable
        ? ' (opening before first shown week)'
        : ''));
      add('This period C', money(row.taxable));
      add('Calculation', money(m.prevCumTaxable) + ' + ' + money(row.taxable) + ' = ' + money(row.cumTaxable));
      add('Result', money(row.cumTaxable));
    } else if (field === 'cumSrcop') {
      title = 'E Cumulative SRCOP';
      add('Formula', 'Week no. × weekly SRCOP');
      add('Weekly SRCOP', money(m.weeklySrcop) + ' = ' + money(m.annualSrcop) + ' ÷ ' + m.periodsPerYear);
      add('Calculation', w + ' × ' + money(m.weeklySrcop) + ' = ' + money(row.cumSrcop));
      add('Result', money(row.cumSrcop));
    } else if (field === 'cumHigher') {
      title = 'F Cum. taxable at higher rate';
      add('Formula', 'max(0, D − E)');
      add('Calculation', 'max(0, ' + money(row.cumTaxable) + ' − ' + money(row.cumSrcop) + ')');
      add('Result', money(row.cumHigher));
    } else if (field === 'cumTaxStd') {
      title = 'G Cum. tax due at standard rate';
      add('Formula', 'min(D, E) × 20%');
      add('Standard base', money(row.cumStdBase) + ' = min(' + money(row.cumTaxable) + ', ' + money(row.cumSrcop) + ')');
      add('Calculation', money(row.cumStdBase) + ' × 0.20 = ' + money(row.cumTaxStd));
      add('Result', money(row.cumTaxStd));
    } else if (field === 'cumTaxHigh') {
      title = 'H Cum. tax due at higher rate';
      add('Formula', 'F × 40%');
      add('Calculation', money(row.cumHigher) + ' × 0.40 = ' + money(row.cumTaxHigh));
      add('Result', money(row.cumTaxHigh));
    } else if (field === 'cumGrossTax') {
      title = 'I Cumulative gross tax';
      add('Formula', 'G + H');
      add('Calculation', money(row.cumTaxStd) + ' + ' + money(row.cumTaxHigh) + ' = ' + money(row.cumGrossTax));
      add('Result', money(row.cumGrossTax));
    } else if (field === 'cumTc') {
      title = 'J Cumulative tax credit';
      add('Formula', 'Week no. × weekly TC');
      add('Weekly TC', money(m.weeklyTc) + ' = ' + money(m.annualTc) + ' ÷ ' + m.periodsPerYear);
      add('Calculation', w + ' × ' + money(m.weeklyTc) + ' = ' + money(row.cumTc));
      add('Result', money(row.cumTc));
    } else if (field === 'cumTaxDue') {
      title = 'K Cumulative tax due';
      add('Formula', 'max(0, I − J)');
      add('Calculation', 'max(0, ' + money(row.cumGrossTax) + ' − ' + money(row.cumTc) + ')');
      add('Result', money(row.cumTaxDue));
    } else if (field === 'taxDeducted') {
      title = 'L Tax deducted this period';
      add('Formula', 'max(0, K this week − previous K)');
      add('Previous K', money(m.prevCumTaxDue));
      add('This week K', money(row.cumTaxDue));
      add('Calculation', 'max(0, ' + money(row.cumTaxDue) + ' − ' + money(m.prevCumTaxDue) + ')');
      add('Result', money(row.taxDeducted));
    } else if (field === 'taxRefunded') {
      title = 'M Tax refunded this period';
      add('Formula', 'max(0, previous K − K this week)');
      add('Previous K', money(m.prevCumTaxDue));
      add('This week K', money(row.cumTaxDue));
      if (row.taxRefunded === 0) {
        add('Calculation', 'max(0, ' + money(m.prevCumTaxDue) + ' − ' + money(row.cumTaxDue) + ') = 0 → shown as —');
      } else {
        add('Calculation', 'max(0, ' + money(m.prevCumTaxDue) + ' − ' + money(row.cumTaxDue) + ')');
      }
      add('Result', row.taxRefunded === 0 ? '—' : money(row.taxRefunded));
    } else if (field === 'prsiEe') {
      title = 'N Employee PRSI';
      add('Formula', 'Gross × EE PRSI rate (simplified)');
      add('Rate', ((m.prsiEeRate || 0.04) * 100).toFixed(2) + '%');
      add('Calculation', money(row.gross) + ' × ' + (m.prsiEeRate || 0.04) + ' = ' + money(row.prsiEe));
      add('Result', money(row.prsiEe));
    } else if (field === 'prsiEr') {
      title = 'O Employer PRSI';
      add('Formula', 'Gross × ER PRSI rate (simplified)');
      add('Rate', ((m.prsiErRate || 0.1095) * 100).toFixed(2) + '%');
      add('Calculation', money(row.gross) + ' × ' + (m.prsiErRate || 0.1095) + ' = ' + money(row.prsiEr));
      add('Result', money(row.prsiEr));
    } else {
      return '';
    }

    return (
      '<div class="derive-title">Week ' + esc(String(w)) + ' — ' + esc(title) + '</div>' +
      lines.join('')
    );
  }

  function showTip(html, anchor) {
    if (!areDeriveTipsEnabled()) {
      hideTip();
      return;
    }
    if (!html || !anchor) {
      hideTip();
      return;
    }
    if (tipHideTimer) {
      clearTimeout(tipHideTimer);
      tipHideTimer = null;
    }
    tipEl.innerHTML = html;
    tipEl.hidden = false;
    tipEl.classList.add('is-visible');

    var rect = anchor.getBoundingClientRect();
    var tipRect = tipEl.getBoundingClientRect();
    var margin = 8;
    var left = rect.left + (rect.width / 2) - (tipRect.width / 2);
    var top = rect.bottom + margin;

    if (left < margin) left = margin;
    if (left + tipRect.width > window.innerWidth - margin) {
      left = window.innerWidth - tipRect.width - margin;
    }
    if (top + tipRect.height > window.innerHeight - margin && rect.top > tipRect.height + margin) {
      top = rect.top - tipRect.height - margin;
    }

    tipEl.style.left = Math.round(left + window.scrollX) + 'px';
    tipEl.style.top = Math.round(top + window.scrollY) + 'px';
  }

  function hideTip() {
    tipEl.classList.remove('is-visible');
    tipEl.hidden = true;
  }

  function scheduleHideTip() {
    if (tipHideTimer) clearTimeout(tipHideTimer);
    tipHideTimer = setTimeout(hideTip, 120);
  }

  function renderIpassTable() {
    if (!els.tbody) return;
    var setup = getIpassSetup();
    var card = computeCard(setup, sheetInputs);
    lastRows = card.rows;
    if (els.weeklyTcOut) els.weeklyTcOut.textContent = money(card.weeklyTc);
    if (els.weeklySrcopOut) els.weeklySrcopOut.textContent = money(card.weeklySrcop);

    var html = '';
    card.rows.forEach(function (r, idx) {
      html += '<tr data-ipass-idx="' + idx + '">';
      html += '<td class="ipass-week">' + r.weekNo + '</td>';
      html += cellInput(idx, 'gross', r.gross);
      html += cellInput(idx, 'taxable', r.taxable);
      html += cellRo(r.cumTaxable, false, 'cumTaxable', idx);
      html += cellRo(r.cumSrcop, false, 'cumSrcop', idx);
      html += cellRo(r.cumHigher, false, 'cumHigher', idx);
      html += cellRo(r.cumTaxStd, false, 'cumTaxStd', idx);
      html += cellRo(r.cumTaxHigh, false, 'cumTaxHigh', idx);
      html += cellRo(r.cumGrossTax, false, 'cumGrossTax', idx);
      html += cellRo(r.cumTc, false, 'cumTc', idx);
      html += cellRo(r.cumTaxDue, false, 'cumTaxDue', idx);
      html += cellRo(r.taxDeducted, false, 'taxDeducted', idx);
      html += cellRo(r.taxRefunded === 0 ? '—' : r.taxRefunded, r.taxRefunded === 0, 'taxRefunded', idx);
      html += cellRo(r.prsiEe, false, 'prsiEe', idx);
      html += cellRo(r.prsiEr, false, 'prsiEr', idx);
      html += '</tr>';
    });
    if (!card.rows.length) {
      html = '<tr><td colspan="15" class="ipass-empty">No periods — click Build card or Load mid-year sample.</td></tr>';
    }
    els.tbody.innerHTML = html;
  }

  function cellInput(idx, field, value) {
    return (
      '<td><input type="text" inputmode="decimal" class="ipass-input driver has-derive" data-idx="' +
      idx + '" data-field="' + field + '" value="' + fmt(value) +
      '" aria-describedby="derive-tip" /></td>'
    );
  }

  function cellRo(value, isDash, field, idx) {
    var t = isDash ? '—' : fmt(value);
    return (
      '<td class="ipass-calc">' +
      '<span class="ipass-ro has-derive" tabindex="0" data-idx="' + idx +
      '" data-field="' + field + '" aria-describedby="derive-tip">' + t + '</span></td>'
    );
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

  function onDeriveEnter(e) {
    if (!areDeriveTipsEnabled()) return;
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('has-derive')) return;
    var idx = parseInt(t.dataset.idx, 10);
    var field = t.dataset.field;
    if (!lastRows[idx] || !field) return;
    showTip(derivationHtml(lastRows[idx], field), t);
  }

  function onDeriveLeave(e) {
    if (!areDeriveTipsEnabled()) {
      hideTip();
      return;
    }
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('has-derive')) return;
    var related = e.relatedTarget;
    if (related && (tipEl === related || tipEl.contains(related))) return;
    scheduleHideTip();
  }

  function loadSample() {
    if (els.annualTc) els.annualTc.value = String(DEFAULT_ANNUAL_TC);
    if (els.annualSrcop) els.annualSrcop.value = String(DEFAULT_ANNUAL_SRCOP);
    if (els.startWeek) els.startWeek.value = '28';
    if (els.periodCount) els.periodCount.value = '4';
    if (els.defaultGross) els.defaultGross.value = '720';
    var open = sampleMidYearOpening();
    if (els.openingD) els.openingD.value = String(open.openingCumulativeTaxable);
    if (els.openingK) els.openingK.value = String(open.openingCumulativeTaxDue);
    sheetInputs = sampleMidYearPeriods().map(function (p) {
      return { weekNo: p.weekNo, gross: p.gross, pension: p.pension || 0 };
    });
    renderIpassTable();
  }

  function buildCard() {
    buildInputsFromSetup();
    renderIpassTable();
  }

  function clearCard() {
    sheetInputs = [];
    lastRows = [];
    hideTip();
    renderIpassTable();
  }

  if (els.btnBuild) els.btnBuild.addEventListener('click', buildCard);
  if (els.btnSample) els.btnSample.addEventListener('click', loadSample);
  if (els.btnClear) els.btnClear.addEventListener('click', clearCard);
  if (els.tbody) {
    els.tbody.addEventListener('change', onIpassInput);
    els.tbody.addEventListener('mouseover', onDeriveEnter);
    els.tbody.addEventListener('mouseout', onDeriveLeave);
    els.tbody.addEventListener('focusin', onDeriveEnter);
    els.tbody.addEventListener('focusout', onDeriveLeave);
  }

  if (els.deriveTipsEnabled) {
    els.deriveTipsEnabled.addEventListener('change', function () {
      saveDeriveTipsPreference();
      applyDeriveTipsUiState();
      // Keep L1 checkbox in sync if present
      var l1 = document.getElementById('derive-tips-enabled');
      if (l1 && l1.checked !== els.deriveTipsEnabled.checked) {
        l1.checked = els.deriveTipsEnabled.checked;
      }
    });
  }
  // Sync from L1 toggle when user changes it
  var l1Tips = document.getElementById('derive-tips-enabled');
  if (l1Tips) {
    l1Tips.addEventListener('change', function () {
      if (els.deriveTipsEnabled) {
        els.deriveTipsEnabled.checked = l1Tips.checked;
        applyDeriveTipsUiState();
      }
    });
  }
  loadDeriveTipsPreference();

  tipEl.addEventListener('mouseenter', function () {
    if (tipHideTimer) {
      clearTimeout(tipHideTimer);
      tipHideTimer = null;
    }
  });
  tipEl.addEventListener('mouseleave', scheduleHideTip);

  window.PayeLabIpass = {
    computeCard: computeCard,
    round2: round2,
    fmt: fmt,
    money: money,
    num: num,
    getSetup: getIpassSetup,
    getBuildOptions: getBuildOptions,
    getSheetInputs: getSheetInputs,
    buildPeriodsFromSetup: buildPeriodsFromSetup,
    relatedGrossSeries: relatedGrossSeries,
    DEFAULT_ANNUAL_TC: DEFAULT_ANNUAL_TC,
    DEFAULT_ANNUAL_SRCOP: DEFAULT_ANNUAL_SRCOP,
    sampleMidYearPeriods: sampleMidYearPeriods,
    sampleMidYearOpening: sampleMidYearOpening,
    // Back-compat aliases
    sampleBryanWallacePeriods: sampleMidYearPeriods,
    sampleBryanWallaceOpening: sampleMidYearOpening,
    buildCard: buildCard,
    loadSample: loadSample,
    onShow: function () {
      if (!sheetInputs.length) loadSample();
      else renderIpassTable();
    }
  };

  if (els.tbody) {
    loadSample();
  }
})();
