/**
 * Annualised Tax Credit & PAYE lab — one sample employee, period by period.
 * Matches local payroll week-1 COP + remaining-TC spreading (see payroll/utils.js).
 */
(function () {
  'use strict';

  var RATE_20 = 0.2;
  var RATE_40 = 0.4;

  var els = {
    frequency: document.getElementById('frequency'),
    annualTc: document.getElementById('annualTc'),
    annualCop: document.getElementById('annualCop'),
    defaultTaxable: document.getElementById('defaultTaxable'),
    periodCount: document.getElementById('periodCount'),
    startPeriod: document.getElementById('startPeriod'),
    tbody: document.getElementById('paye-rows'),
    btnBuild: document.getElementById('btn-build'),
    btnAdd: document.getElementById('btn-add-row'),
    btnRecalc: document.getElementById('btn-recalc'),
    btnClear: document.getElementById('btn-clear'),
    statTaxable: document.getElementById('stat-taxable'),
    statGrossPaye: document.getElementById('stat-gross-paye'),
    statAppliedTc: document.getElementById('stat-applied-tc'),
    statNetTax: document.getElementById('stat-net-tax'),
    statTcLeft: document.getElementById('stat-tc-left'),
    deriveTipsEnabled: document.getElementById('derive-tips-enabled'),
    tableWrap: document.getElementById('worksheet-table-wrap')
  };

  /** @type {Array<Object>} */
  var rows = [];

  var STORAGE_KEY = 'payeLab.deriveTipsEnabled';

  /** Floating derivation popup */
  var tipEl = document.createElement('div');
  tipEl.id = 'derive-tip';
  tipEl.className = 'derive-tip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.hidden = true;
  document.body.appendChild(tipEl);
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
      var saved = localStorage.getItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, areDeriveTipsEnabled() ? '1' : '0');
    } catch (e) { /* ignore */ }
  }

  function periodsPerYear() {
    var f = els.frequency.value;
    if (f === 'weekly') return 52;
    if (f === 'fortnightly') return 26;
    return 12;
  }

  function frequencyLabel() {
    var f = els.frequency.value;
    if (f === 'weekly') return 'weekly';
    if (f === 'fortnightly') return 'fortnightly';
    return 'monthly';
  }

  function num(v, fallback) {
    var n = parseFloat(v);
    return isFinite(n) ? n : (fallback != null ? fallback : 0);
  }

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function fmt(n) {
    return round2(n).toFixed(2);
  }

  function money(n) {
    return '€' + fmt(n);
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function autoPeriodTc(remainingAnnualTc, schedulePeriods, submittedBefore) {
    var left = Math.max(schedulePeriods - submittedBefore, 1);
    // Round at each step so period TC chips match TC-remained ÷ periods left
    return round2((parseFloat(remainingAnnualTc) || 0) / left);
  }

  function autoPeriodCop(annualCop, schedulePeriods) {
    return round2((parseFloat(annualCop) || 0) / Math.max(parseInt(schedulePeriods, 10) || 52, 1));
  }

  /**
   * Even (flat) period tax credit = annual TC ÷ periods in year, rounded to cents.
   * Same figure students drag in the mid-year “× flat period TC” quest.
   */
  function flatPeriodTc(annualTc, schedulePeriods) {
    var schedule = Math.max(parseInt(schedulePeriods, 10) || 52, 1);
    return round2((parseFloat(annualTc) || 0) / schedule);
  }

  /**
   * TC remaining at start of period N if periods 1…(N-1) each used the
   * rounded flat period TC (not unrounded annual/schedule × N — that drifts cents).
   * e.g. annual 4000, 52 weeks, start 10 → 4000 − 9×round2(4000/52).
   */
  function remainingTcAfterEvenPrior(annualTc, schedulePeriods, periodsBefore) {
    var annual = round2(parseFloat(annualTc) || 0);
    var before = Math.max(0, parseInt(periodsBefore, 10) || 0);
    if (before <= 0) return annual;
    var flat = flatPeriodTc(annual, schedulePeriods);
    var used = round2(flat * before);
    return round2(Math.max(0, annual - used));
  }

  function computeRowTax(taxablePay, periodCop, periodTc) {
    var pay = Math.max(0, taxablePay);
    var cop = Math.max(0, periodCop);
    var credit = Math.max(0, periodTc);
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

  function cascade() {
    var schedule = periodsPerYear();
    var setupAnnualTc = num(els.annualTc.value, 4000);
    var fullAnnualCop = num(els.annualCop.value, 44000);
    var startP = rows.length ? rows[0].period : 1;
    var submittedBefore = 0;
    // Preceding periods assumed to use flat period TC evenly
    var remaining = setupAnnualTc;
    if (startP > 1) {
      submittedBefore = startP - 1;
      remaining = remainingTcAfterEvenPrior(setupAnnualTc, schedule, submittedBefore);
    }

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var prevLeft = remaining;
      var periodsLeft = Math.max(schedule - submittedBefore, 1);
      var fromPrev = i > 0;
      var evenPriorOpening = i === 0 && startP > 1;

      var annualisedTc = row.annualisedTcManual && row.annualisedTc != null
        ? row.annualisedTc
        : remaining;
      row.annualisedTc = round2(annualisedTc);

      var periodTc = row.periodTcManual && row.periodTc != null
        ? row.periodTc
        : autoPeriodTc(row.annualisedTc, schedule, submittedBefore);
      row.periodTc = round2(periodTc);

      var annualisedCop = row.annualisedCopManual && row.annualisedCop != null
        ? row.annualisedCop
        : fullAnnualCop;
      row.annualisedCop = round2(annualisedCop);

      var periodCop = row.periodCopManual && row.periodCop != null
        ? row.periodCop
        : autoPeriodCop(row.annualisedCop, schedule);
      row.periodCop = round2(periodCop);

      var tax = computeRowTax(row.taxablePay, row.periodCop, row.periodTc);
      row.taxable20 = tax.taxable20;
      row.taxable40 = tax.taxable40;
      row.paye20 = tax.paye20;
      row.paye40 = tax.paye40;
      row.totalPaye = tax.totalPaye;
      row.appliedTc = tax.appliedTc;
      row.netTax = tax.netTax;
      row.tcLeftAfter = round2(row.annualisedTc - row.appliedTc);

      row._meta = {
        schedule: schedule,
        frequencyLabel: frequencyLabel(),
        submittedBefore: submittedBefore,
        periodsLeft: periodsLeft,
        prevLeft: prevLeft,
        fromPrev: fromPrev,
        evenPriorOpening: evenPriorOpening,
        priorPeriodsEven: evenPriorOpening ? (startP - 1) : 0,
        flatPeriodTc: round2(flatPeriodTc(setupAnnualTc, schedule)),
        setupAnnualTc: setupAnnualTc,
        setupAnnualCop: fullAnnualCop,
        rowIndex: i,
        tableStartPeriod: startP
      };

      remaining = row.tcLeftAfter;
      submittedBefore += 1;
    }

    updateTotals();
  }

  /**
   * Build rich HTML explaining how a cell value was derived.
   */
  function derivationHtml(row, field) {
    if (!row) return '';
    var m = row._meta || {};
    var p = row.period;
    var lines = [];
    var title = '';

    function add(label, formula) {
      lines.push(
        '<div class="derive-line"><span class="derive-label">' + esc(label) + '</span>' +
        '<code>' + esc(formula) + '</code></div>'
      );
    }

    if (field === 'period') {
      title = 'Payroll period';
      add('Meaning', 'Pay period number in the tax year (1…' + m.schedule + ' for ' + m.frequencyLabel + ')');
      add('Value', 'Period ' + p);
      add('Note', 'Editable label only — does not change the formula math by itself');
    } else if (field === 'annualisedTc') {
      title = 'TC remained till year end (at start of period)';
      if (row.annualisedTcManual) {
        add('Source', 'Manual override (you typed this)');
        add('Value', money(row.annualisedTc));
        add('Tip', 'Double-click the cell to restore auto');
      } else if (m.fromPrev) {
        add('Source', 'Credit left after previous period in this table');
        add('Previous period', 'Period ' + rows[m.rowIndex - 1].period);
        add('Formula', 'TC left after period ' + rows[m.rowIndex - 1].period);
        add('Calculation', money(m.prevLeft) + ' carried forward');
        add('Result', money(row.annualisedTc));
      } else if (m.evenPriorOpening && m.priorPeriodsEven > 0) {
        add('Source', 'Start period > 1 — preceding periods used flat period TC evenly');
        add('Formula', 'annual TC − (start − 1) × (annual TC ÷ periods in year)');
        add('Flat period TC', money(m.flatPeriodTc) + ' = ' + money(m.setupAnnualTc) + ' ÷ ' + m.schedule);
        add('Prior periods', String(m.priorPeriodsEven) + ' × ' + money(m.flatPeriodTc) +
          ' = ' + money(m.priorPeriodsEven * m.flatPeriodTc));
        add('Calculation', money(m.setupAnnualTc) + ' − ' + money(m.priorPeriodsEven * m.flatPeriodTc));
        add('Result', money(row.annualisedTc));
      } else {
        add('Source', 'Setup “Annual tax credit” (start of tax year / period 1)');
        add('Formula', 'TC remained till year end at period 1');
        add('Calculation', money(m.setupAnnualTc));
        add('Result', money(row.annualisedTc));
      }
    } else if (field === 'periodTc') {
      title = 'Period tax credit';
      if (row.periodTcManual) {
        add('Source', 'Manual override (you typed this)');
        add('Value', money(row.periodTc));
        add('Tip', 'Double-click the cell to restore auto');
      } else {
        add('Method', 'Remaining annual TC ÷ periods still left in the year');
        add('Periods in year', String(m.schedule) + ' (' + m.frequencyLabel + ')');
        add('Periods already counted', String(m.submittedBefore));
        add('Periods left', String(m.periodsLeft) + ' = max(' + m.schedule + ' − ' + m.submittedBefore + ', 1)');
        add('Formula', 'period TC = annualised TC ÷ periods left');
        add('Calculation', money(row.annualisedTc) + ' ÷ ' + m.periodsLeft + ' = ' + money(row.periodTc));
        add('Result', money(row.periodTc));
      }
    } else if (field === 'taxablePay') {
      title = 'Taxable pay (this period)';
      add('Source', 'Editable driver — gross pay subject to PAYE for this period');
      add('Value', money(row.taxablePay));
      add('Used in', 'Taxable@20%, Taxable@40%, and all PAYE figures');
    } else if (field === 'annualisedCop') {
      title = 'Annual COP (standard rate cut-off)';
      if (row.annualisedCopManual) {
        add('Source', 'Manual override (you typed this)');
        add('Value', money(row.annualisedCop));
        add('Tip', 'Double-click the cell to restore auto');
      } else {
        add('Source', 'Setup “Annual COP / SRCOP” (week‑1 basis — does not reduce period to period)');
        add('Formula', 'Annual standard rate cut-off point');
        add('Calculation', money(m.setupAnnualCop));
        add('Result', money(row.annualisedCop));
      }
    } else if (field === 'periodCop') {
      title = 'Period COP';
      if (row.periodCopManual) {
        add('Source', 'Manual override (you typed this)');
        add('Value', money(row.periodCop));
        add('Tip', 'Double-click the cell to restore auto');
      } else {
        add('Method', 'Week‑1 / month‑1 slice — unused COP does not roll forward');
        add('Formula', 'period COP = annual COP ÷ periods in year');
        add('Calculation', money(row.annualisedCop) + ' ÷ ' + m.schedule + ' = ' + money(row.periodCop));
        add('Result', money(row.periodCop));
      }
    } else if (field === 'taxable20') {
      title = 'Taxable at 20%';
      add('Formula', 'min(taxable pay, period COP)');
      add('Calculation', 'min(' + money(row.taxablePay) + ', ' + money(row.periodCop) + ')');
      add('Result', money(row.taxable20));
    } else if (field === 'taxable40') {
      title = 'Taxable at 40%';
      add('Formula', 'max(0, taxable pay − period COP)');
      add('Calculation', 'max(0, ' + money(row.taxablePay) + ' − ' + money(row.periodCop) + ')');
      add('Result', money(row.taxable40));
    } else if (field === 'paye20') {
      title = 'PAYE at 20%';
      add('Formula', 'Taxable@20% × 20%');
      add('Calculation', money(row.taxable20) + ' × 0.20');
      add('Result', money(row.paye20));
    } else if (field === 'paye40') {
      title = 'PAYE at 40%';
      add('Formula', 'Taxable@40% × 40%');
      add('Calculation', money(row.taxable40) + ' × 0.40');
      add('Result', money(row.paye40));
    } else if (field === 'totalPaye') {
      title = 'Total PAYE (gross tax before credit)';
      add('Formula', 'PAYE 20% + PAYE 40%');
      add('Calculation', money(row.paye20) + ' + ' + money(row.paye40));
      add('Result', money(row.totalPaye));
    } else if (field === 'appliedTc') {
      title = 'Applied tax credit';
      add('Formula', 'min(period TC, total PAYE)');
      add('Why', 'Credit cannot exceed tax due this period');
      add('Calculation', 'min(' + money(row.periodTc) + ', ' + money(row.totalPaye) + ')');
      add('Result', money(row.appliedTc));
    } else if (field === 'netTax') {
      title = 'Net tax (PAYE after credit)';
      add('Formula', 'max(0, total PAYE − applied TC)');
      add('Calculation', 'max(0, ' + money(row.totalPaye) + ' − ' + money(row.appliedTc) + ')');
      add('Result', money(row.netTax));
    } else {
      return '';
    }

    return (
      '<div class="derive-title">Period ' + esc(String(p)) + ' — ' + esc(title) + '</div>' +
      lines.join('')
    );
  }

  function showTip(html, anchor) {
    if (!areDeriveTipsEnabled()) {
      hideTip();
      return;
    }
    if (!html) {
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
    // If not enough space below, place above
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

  function updateTotals() {
    var sumTaxable = 0;
    var sumGross = 0;
    var sumApplied = 0;
    var sumNet = 0;
    for (var i = 0; i < rows.length; i++) {
      sumTaxable += rows[i].taxablePay || 0;
      sumGross += rows[i].totalPaye || 0;
      sumApplied += rows[i].appliedTc || 0;
      sumNet += rows[i].netTax || 0;
    }
    // End balance = last row’s TC remained − applied (feeds next period’s TC remained)
    var last = rows.length ? rows[rows.length - 1] : null;
    var lastLeft = last
      ? round2((last.annualisedTc || 0) - (last.appliedTc || 0))
      : num(els.annualTc.value, 0);
    els.statTaxable.textContent = money(sumTaxable);
    els.statGrossPaye.textContent = money(sumGross);
    els.statAppliedTc.textContent = money(sumApplied);
    els.statNetTax.textContent = money(sumNet);
    els.statTcLeft.textContent = money(lastLeft);
  }

  function inputClass(isManual, isDriver) {
    if (isManual) return 'manual-override';
    if (isDriver) return 'driver';
    return 'calc';
  }

  function mutedCell(text) {
    return '<td class="gap-cell"><span class="gap-muted">' + esc(text) + '</span></td>';
  }

  /**
   * When start period > 1: show period 1 (full year TC) then … then live rows.
   */
  function gapContextRowsHtml(startPeriod, setupAnnualTc, schedule, flatTc) {
    if (!startPeriod || startPeriod <= 1) return '';
    var html = '';
    html += '<tr class="gap-context-row gap-period1" title="Tax year start — full annual TC remaining">';
    html += mutedCell('1');
    html += mutedCell(fmt(setupAnnualTc));
    html += mutedCell(fmt(flatTc));
    // taxable pay, annual COP, period COP, tax bands, PAYE, applied, net (10 placeholders)
    for (var g = 0; g < 10; g++) html += mutedCell('—');
    html += '<td class="row-actions"></td>';
    html += '</tr>';

    if (startPeriod > 2) {
      html += '<tr class="gap-ellipsis-row" title="Periods 2…' + (startPeriod - 1) + ' skipped (even TC used)">';
      html += '<td colspan="14" class="gap-ellipsis-cell">';
      html += '<span class="gap-dots">· · ·</span>';
      html += '<span class="gap-ellipsis-label">periods 2–' + (startPeriod - 1) +
        ' (even period TC × ' + (startPeriod - 1) + ' assumed used)</span>';
      html += '</td></tr>';
    }
    return html;
  }

  function render() {
    cascade();
    var schedule = periodsPerYear();
    var setupAnnualTc = num(els.annualTc.value, 4000);
    var flatTc = round2(flatPeriodTc(setupAnnualTc, schedule));
    var startP = rows.length ? rows[0].period : 1;
    var html = gapContextRowsHtml(startP, setupAnnualTc, schedule, flatTc);

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      html += '<tr data-idx="' + i + '">';
      html += cellInput(i, 'period', r.period, 'driver', false, 0);
      html += cellInput(i, 'annualisedTc', r.annualisedTc, inputClass(r.annualisedTcManual, false), r.annualisedTcManual, 2);
      html += cellInput(i, 'periodTc', r.periodTc, inputClass(r.periodTcManual, false), r.periodTcManual, 2);
      html += cellInput(i, 'taxablePay', r.taxablePay, 'driver', false, 2);
      html += cellInput(i, 'annualisedCop', r.annualisedCop, inputClass(r.annualisedCopManual, false), r.annualisedCopManual, 2);
      html += cellInput(i, 'periodCop', r.periodCop, inputClass(r.periodCopManual, false), r.periodCopManual, 2);
      html += cellReadonly(i, 'taxable20', r.taxable20);
      html += cellReadonly(i, 'taxable40', r.taxable40);
      html += cellReadonly(i, 'paye20', r.paye20);
      html += cellReadonly(i, 'paye40', r.paye40);
      html += cellReadonly(i, 'totalPaye', r.totalPaye);
      html += cellReadonly(i, 'appliedTc', r.appliedTc);
      html += cellReadonly(i, 'netTax', r.netTax);
      html += '<td class="row-actions"><button type="button" class="row-del" data-del="' + i + '" title="Remove row" aria-label="Remove period row">×</button></td>';
      html += '</tr>';
    }
    els.tbody.innerHTML = html || '<tr><td colspan="14" style="text-align:center;padding:16px;color:#666;">No periods yet — click Build table or Add period.</td></tr>';
  }

  /** Editable fields that the user types into (never rewrite while focused). */
  var EDITABLE_FIELDS = {
    period: true,
    annualisedTc: true,
    periodTc: true,
    taxablePay: true,
    annualisedCop: true,
    periodCop: true
  };

  /** Auto-filled fields that cascade can update when not manually overridden. */
  var AUTO_FIELDS = {
    annualisedTc: 'annualisedTcManual',
    periodTc: 'periodTcManual',
    annualisedCop: 'annualisedCopManual',
    periodCop: 'periodCopManual'
  };

  var CALC_FIELDS = [
    'taxable20', 'taxable40', 'paye20', 'paye40', 'totalPaye', 'appliedTc', 'netTax'
  ];

  function cellInput(idx, field, value, cls, isManual, decimals) {
    var v = field === 'period'
      ? String(Math.round(Number(value) || 0))
      : (decimals != null ? Number(value).toFixed(decimals) : String(value));
    return (
      '<td class="col-' + field + '">' +
      '<input type="text" inputmode="' + (field === 'period' ? 'numeric' : 'decimal') + '" ' +
      'autocomplete="off" spellcheck="false" data-idx="' + idx + '" data-field="' + field + '" ' +
      'class="' + cls + ' has-derive" value="' + v + '" ' +
      'aria-describedby="derive-tip" />' +
      '</td>'
    );
  }

  function cellReadonly(idx, field, value) {
    return (
      '<td><input type="text" inputmode="decimal" class="calc has-derive" value="' + fmt(value) + '" ' +
      'data-idx="' + idx + '" data-field="' + field + '" readonly tabindex="0" ' +
      'aria-describedby="derive-tip" /></td>'
    );
  }

  function buildRowsFromSetup() {
    var count = Math.max(1, Math.min(53, parseInt(els.periodCount.value, 10) || 8));
    var start = Math.max(1, parseInt(els.startPeriod.value, 10) || 1);
    var taxable = num(els.defaultTaxable.value, 1000);
    rows = [];
    for (var i = 0; i < count; i++) {
      rows.push(blankRow(start + i, taxable));
    }
    render();
  }

  function blankRow(period, taxablePay) {
    return {
      period: period,
      annualisedTc: null,
      periodTc: null,
      taxablePay: taxablePay,
      annualisedCop: null,
      periodCop: null,
      annualisedTcManual: false,
      periodTcManual: false,
      annualisedCopManual: false,
      periodCopManual: false,
      taxable20: 0,
      taxable40: 0,
      paye20: 0,
      paye40: 0,
      totalPaye: 0,
      appliedTc: 0,
      netTax: 0,
      tcLeftAfter: 0
    };
  }

  /**
   * Parse a number while typing. Empty / intermediate strings are allowed.
   * Returns { ok, value, incomplete }.
   */
  function parseTypingNumber(raw, asInteger) {
    var s = String(raw == null ? '' : raw).trim().replace(/,/g, '');
    if (s === '' || s === '-' || s === '.' || s === '-.') {
      return { ok: true, value: 0, incomplete: true };
    }
    // Allow trailing decimal while typing: "12."
    if (/^-?\d+\.$/.test(s)) {
      var base = parseFloat(s);
      return { ok: isFinite(base), value: isFinite(base) ? base : 0, incomplete: true };
    }
    if (asInteger) {
      if (!/^-?\d+$/.test(s)) return { ok: false, value: 0, incomplete: true };
      return { ok: true, value: parseInt(s, 10), incomplete: false };
    }
    if (!/^-?\d+(\.\d*)?$/.test(s)) return { ok: false, value: 0, incomplete: true };
    var n = parseFloat(s);
    if (!isFinite(n)) return { ok: false, value: 0, incomplete: true };
    return { ok: true, value: n, incomplete: /\.$/.test(s) };
  }

  function applyFieldToRow(row, field, value) {
    if (field === 'period') {
      row.period = Math.max(1, Math.round(value) || 1);
    } else if (field === 'taxablePay') {
      row.taxablePay = value;
    } else if (field === 'annualisedTc') {
      row.annualisedTc = value;
      row.annualisedTcManual = true;
    } else if (field === 'periodTc') {
      row.periodTc = value;
      row.periodTcManual = true;
    } else if (field === 'annualisedCop') {
      row.annualisedCop = value;
      row.annualisedCopManual = true;
    } else if (field === 'periodCop') {
      row.periodCop = value;
      row.periodCopManual = true;
    }
  }

  function setInputValueIfChanged(input, next) {
    if (!input) return;
    if (String(input.value) !== String(next)) {
      input.value = next;
    }
  }

  /**
   * Update DOM from model without rewriting the active editable cell
   * (fixes caret / right-to-left typing caused by full re-render + toFixed).
   */
  function patchTableFromModel(activeIdx, activeField) {
    var inputs = els.tbody.querySelectorAll('input[data-field]');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      var idx = parseInt(el.dataset.idx, 10);
      var field = el.dataset.field;
      var row = rows[idx];
      if (!row) continue;

      // Never touch the field the user is typing in
      if (idx === activeIdx && field === activeField) continue;

      if (CALC_FIELDS.indexOf(field) !== -1) {
        setInputValueIfChanged(el, fmt(row[field]));
        continue;
      }

      if (field === 'period') {
        setInputValueIfChanged(el, String(row.period));
        el.className = 'driver has-derive';
        continue;
      }

      if (field === 'taxablePay') {
        setInputValueIfChanged(el, fmt(row.taxablePay));
        el.className = 'driver has-derive';
        continue;
      }

      if (AUTO_FIELDS[field]) {
        var manualFlag = AUTO_FIELDS[field];
        var isManual = !!row[manualFlag];
        // Only auto-update non-manual auto fields; leave other rows' manual values formatted
        if (!isManual) {
          setInputValueIfChanged(el, fmt(row[field]));
        } else if (!(idx === activeIdx && field === activeField)) {
          // Keep manual values formatted when not actively editing them
          setInputValueIfChanged(el, fmt(row[field]));
        }
        el.className = inputClass(isManual, false) + ' has-derive';
      }
    }
    updateTotals();
  }

  function formatCommittedField(el, field, value) {
    if (field === 'period') {
      el.value = String(Math.max(1, Math.round(value) || 1));
    } else {
      el.value = fmt(value);
    }
  }

  /**
   * Live edit: update model + cascade, patch other cells only.
   * Do not re-render or reformat the active input.
   */
  function onTableLiveEdit(e) {
    var t = e.target;
    if (!t || t.tagName !== 'INPUT' || !t.dataset.field || t.readOnly) return;
    var field = t.dataset.field;
    if (!EDITABLE_FIELDS[field]) return;
    var idx = parseInt(t.dataset.idx, 10);
    if (!rows[idx]) return;

    var parsed = parseTypingNumber(t.value, field === 'period');
    if (!parsed.ok) return;

    applyFieldToRow(rows[idx], field, parsed.value);
    cascade();
    patchTableFromModel(idx, field);
  }

  /**
   * Blur/change: commit value, format this field, full cascade patch.
   */
  function onTableCommit(e) {
    var t = e.target;
    if (!t || t.tagName !== 'INPUT' || !t.dataset.field || t.readOnly) return;
    var field = t.dataset.field;
    if (!EDITABLE_FIELDS[field]) return;
    var idx = parseInt(t.dataset.idx, 10);
    if (!rows[idx]) return;

    var parsed = parseTypingNumber(t.value, field === 'period');
    var value = parsed.ok ? parsed.value : 0;
    if (field === 'period') value = Math.max(1, Math.round(value) || 1);

    applyFieldToRow(rows[idx], field, value);
    cascade();
    formatCommittedField(t, field, field === 'period' ? rows[idx].period : rows[idx][field]);
    // After commit, safe to refresh all auto/calc cells including this row's auto siblings
    patchTableFromModel(-1, null);
  }

  function onTableDblClick(e) {
    var t = e.target;
    if (!t || t.tagName !== 'INPUT' || !t.dataset.field) return;
    var idx = parseInt(t.dataset.idx, 10);
    var field = t.dataset.field;
    var row = rows[idx];
    if (!row) return;

    if (field === 'annualisedTc' && row.annualisedTcManual) {
      row.annualisedTcManual = false;
      row.annualisedTc = null;
      render();
    } else if (field === 'periodTc' && row.periodTcManual) {
      row.periodTcManual = false;
      row.periodTc = null;
      render();
    } else if (field === 'annualisedCop' && row.annualisedCopManual) {
      row.annualisedCopManual = false;
      row.annualisedCop = null;
      render();
    } else if (field === 'periodCop' && row.periodCopManual) {
      row.periodCopManual = false;
      row.periodCop = null;
      render();
    }
  }

  function onTableClick(e) {
    var btn = e.target.closest('[data-del]');
    if (!btn) return;
    var idx = parseInt(btn.getAttribute('data-del'), 10);
    if (!isFinite(idx)) return;
    rows.splice(idx, 1);
    render();
  }

  function onDeriveEnter(e) {
    if (!areDeriveTipsEnabled()) return;
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('has-derive')) return;
    var idx = parseInt(t.dataset.idx, 10);
    var field = t.dataset.field;
    if (!rows[idx] || !field) return;
    showTip(derivationHtml(rows[idx], field), t);
  }

  function onDeriveLeave(e) {
    if (!areDeriveTipsEnabled()) {
      hideTip();
      return;
    }
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains('has-derive')) return;
    // Keep tip if moving into the tip itself
    var related = e.relatedTarget;
    if (related && (tipEl === related || tipEl.contains(related))) return;
    scheduleHideTip();
  }

  function addRow() {
    var lastPeriod = rows.length ? rows[rows.length - 1].period : (parseInt(els.startPeriod.value, 10) || 1) - 1;
    var taxable = rows.length ? rows[rows.length - 1].taxablePay : num(els.defaultTaxable.value, 1000);
    rows.push(blankRow(lastPeriod + 1, taxable));
    render();
  }

  function clearRows() {
    rows = [];
    hideTip();
    render();
  }

  els.btnBuild.addEventListener('click', buildRowsFromSetup);
  els.btnAdd.addEventListener('click', addRow);
  els.btnRecalc.addEventListener('click', function () {
    for (var i = 0; i < rows.length; i++) {
      rows[i].annualisedTcManual = false;
      rows[i].periodTcManual = false;
      rows[i].annualisedCopManual = false;
      rows[i].periodCopManual = false;
      rows[i].annualisedTc = null;
      rows[i].periodTc = null;
      rows[i].annualisedCop = null;
      rows[i].periodCop = null;
    }
    render();
  });
  els.btnClear.addEventListener('click', clearRows);

  els.tbody.addEventListener('input', onTableLiveEdit);
  // change fires on commit (leave field) for text inputs — format without full re-render
  els.tbody.addEventListener('change', onTableCommit);
  els.tbody.addEventListener('dblclick', onTableDblClick);
  els.tbody.addEventListener('click', onTableClick);

  // Hover / keyboard focus → derivation popup (gated by toggle)
  els.tbody.addEventListener('mouseover', onDeriveEnter);
  els.tbody.addEventListener('mouseout', onDeriveLeave);
  els.tbody.addEventListener('focusin', onDeriveEnter);
  els.tbody.addEventListener('focusout', onDeriveLeave);

  if (els.deriveTipsEnabled) {
    els.deriveTipsEnabled.addEventListener('change', function () {
      saveDeriveTipsPreference();
      applyDeriveTipsUiState();
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

  window.addEventListener('scroll', hideTip, true);
  window.addEventListener('resize', hideTip);

  ['frequency', 'annualTc', 'annualCop', 'startPeriod'].forEach(function (id) {
    if (!els[id]) return;
    els[id].addEventListener('change', function () {
      // Rebuild from setup so gap rows + even-prior TC match Start period
      if (id === 'startPeriod' || id === 'frequency') {
        buildRowsFromSetup();
      } else if (rows.length) {
        render();
      }
    });
  });

  /**
   * Build a full answer-key row list from setup (used by Practice mode).
   * @param {{ annualTc:number, annualCop:number, schedule:number, frequencyLabel:string, startPeriod:number, taxablePays:number[] }} opts
   */
  function buildAnswerKey(opts) {
    var schedule = opts.schedule;
    var setupAnnualTc = opts.annualTc;
    var fullAnnualCop = opts.annualCop;
    var startP = opts.startPeriod || 1;
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
          frequencyLabel: opts.frequencyLabel || 'weekly',
          submittedBefore: submittedBefore,
          periodsLeft: periodsLeft,
          prevLeft: prevLeft,
          fromPrev: i > 0,
          evenPriorOpening: evenPriorOpening,
          priorPeriodsEven: evenPriorOpening ? (startP - 1) : 0,
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

  // Shared API for Practice tab
  window.PayeLabCore = {
    RATE_20: RATE_20,
    RATE_40: RATE_40,
    round2: round2,
    fmt: fmt,
    money: money,
    num: num,
    periodsPerYear: periodsPerYear,
    frequencyLabel: frequencyLabel,
    flatPeriodTc: flatPeriodTc,
    remainingTcAfterEvenPrior: remainingTcAfterEvenPrior,
    buildAnswerKey: buildAnswerKey,
    getSetup: function () {
      return {
        annualTc: num(els.annualTc.value, 4000),
        annualCop: num(els.annualCop.value, 44000),
        defaultTaxable: num(els.defaultTaxable.value, 1000),
        startPeriod: Math.max(1, parseInt(els.startPeriod.value, 10) || 1),
        periodCount: Math.max(1, Math.min(53, parseInt(els.periodCount.value, 10) || 8)),
        schedule: periodsPerYear(),
        frequencyLabel: frequencyLabel()
      };
    }
  };

  // ——— Level + module tab switching ———
  var currentLevel = 1;
  var currentTab = 'l1-worksheet';

  var tabPanels = {
    'l1-worksheet': document.getElementById('tab-l1-worksheet'),
    'l1-practice1': document.getElementById('tab-l1-practice1'),
    'l2-worksheet': document.getElementById('tab-l2-worksheet'),
    'l2-practice1': document.getElementById('tab-l2-practice1')
  };

  var setupL1 = document.getElementById('setup-level-1');
  var setupL2 = document.getElementById('setup-level-2');
  var subtabsL1 = document.getElementById('subtabs-level-1');
  var subtabsL2 = document.getElementById('subtabs-level-2');
  var actionsWorksheet = document.getElementById('actions-worksheet');
  var actionsPractice = document.getElementById('actions-practice');
  var actionsIpassWs = document.getElementById('actions-ipass-worksheet');
  var noteWorksheet = document.getElementById('method-note-worksheet');
  var notePractice1 = document.getElementById('method-note-practice1');
  var noteIpass = document.getElementById('method-note-ipass');
  var noteIpassPractice = document.getElementById('method-note-ipass-practice');

  function setHidden(el, hide) {
    if (!el) return;
    el.hidden = hide;
    el.style.display = hide ? 'none' : '';
    el.setAttribute('aria-hidden', hide ? 'true' : 'false');
  }

  function switchLevel(level) {
    currentLevel = level === 2 ? 2 : 1;
    document.body.classList.toggle('level-1', currentLevel === 1);
    document.body.classList.toggle('level-2', currentLevel === 2);

    document.querySelectorAll('.level-tab').forEach(function (btn) {
      var on = String(btn.getAttribute('data-level')) === String(currentLevel);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    setHidden(setupL1, currentLevel !== 1);
    setHidden(setupL2, currentLevel !== 2);
    setHidden(subtabsL1, currentLevel !== 1);
    setHidden(subtabsL2, currentLevel !== 2);

    if (currentLevel === 1) {
      switchTab('l1-worksheet');
    } else {
      switchTab('l2-worksheet');
      if (window.PayeLabIpass && typeof window.PayeLabIpass.onShow === 'function') {
        window.PayeLabIpass.onShow();
      }
    }
  }

  function switchTab(name) {
    if (name === 'l2-practice2') name = 'l2-practice1';
    currentTab = name;
    var isL1Ws = name === 'l1-worksheet';
    var isL1P1 = name === 'l1-practice1';
    var isL2Ws = name === 'l2-worksheet';
    var isL2P1 = name === 'l2-practice1';
    var isAnyPractice = isL1P1 || isL2P1;

    document.body.classList.toggle('mode-practice', isAnyPractice);
    document.body.classList.toggle('mode-worksheet', isL1Ws || isL2Ws);
    document.body.classList.toggle('mode-ipass', isL2Ws || isL2P1);

    document.querySelectorAll('.lab-tab').forEach(function (btn) {
      var on = btn.getAttribute('data-tab') === name;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });

    Object.keys(tabPanels).forEach(function (key) {
      setHidden(tabPanels[key], key !== name);
    });

    // L1 setup toolbars / notes
    setHidden(actionsWorksheet, !isL1Ws);
    setHidden(actionsPractice, !isL1P1);
    setHidden(noteWorksheet, !isL1Ws);
    setHidden(notePractice1, !isL1P1);

    // L2 setup toolbars / notes
    setHidden(actionsIpassWs, !(isL2Ws && currentLevel === 2));
    setHidden(noteIpass, !isL2Ws);
    setHidden(noteIpassPractice, !isL2P1);

    if (!isL1P1) hideTip();
    if (isL1P1 && window.PayeLabPractice && typeof window.PayeLabPractice.onShow === 'function') {
      window.PayeLabPractice.onShow();
    }
    if (isL2Ws && window.PayeLabIpass && typeof window.PayeLabIpass.onShow === 'function') {
      window.PayeLabIpass.onShow();
    }
    if (isL2P1 && window.PayeLabIpassPractice && typeof window.PayeLabIpassPractice.onShow === 'function') {
      window.PayeLabIpassPractice.onShow();
    }
  }

  document.querySelectorAll('.level-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchLevel(parseInt(btn.getAttribute('data-level'), 10));
    });
  });

  document.querySelectorAll('.lab-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  // Little “i” info popovers (setup labels + L2 practice table headers — click, not hover)
  function closeAllLabInfoPopovers(exceptId) {
    document.querySelectorAll('.lab-info-popover').forEach(function (pop) {
      if (exceptId && pop.id === exceptId) return;
      pop.hidden = true;
      pop.classList.remove('is-fixed');
      pop.style.left = '';
      pop.style.top = '';
    });
    document.querySelectorAll('.lab-info-btn[aria-expanded="true"]').forEach(function (btn) {
      var key = btn.getAttribute('data-info');
      if (exceptId && key && ('info-' + key) === exceptId) return;
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  function positionLabInfoPopover(pop, btn) {
    // Headers sit inside a horizontally scrolling table — pin to viewport
    var inTableHeader = !!(btn.closest('th') || btn.closest('thead'));
    if (!inTableHeader) {
      pop.classList.remove('is-fixed');
      pop.style.left = '';
      pop.style.top = '';
      return;
    }
    pop.classList.add('is-fixed');
    pop.hidden = false;
    var rect = btn.getBoundingClientRect();
    var margin = 8;
    var popW = pop.offsetWidth || 280;
    var popH = pop.offsetHeight || 120;
    var left = rect.left + rect.width / 2 - popW / 2;
    var top = rect.bottom + 6;
    if (left < margin) left = margin;
    if (left + popW > window.innerWidth - margin) {
      left = window.innerWidth - popW - margin;
    }
    if (top + popH > window.innerHeight - margin && rect.top > popH + margin) {
      top = rect.top - popH - 6;
    }
    pop.style.left = Math.round(left) + 'px';
    pop.style.top = Math.round(top) + 'px';
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.lab-info-btn');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      var key = btn.getAttribute('data-info');
      var pop = key ? document.getElementById('info-' + key) : null;
      if (!pop) return;
      var willOpen = pop.hidden;
      closeAllLabInfoPopovers(willOpen ? pop.id : null);
      if (willOpen) {
        pop.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
        positionLabInfoPopover(pop, btn);
      } else {
        pop.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
      return;
    }
    if (!e.target.closest('.lab-info-popover')) {
      closeAllLabInfoPopovers();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeAllLabInfoPopovers();
  });

  window.addEventListener('scroll', function () {
    closeAllLabInfoPopovers();
  }, true);
  window.addEventListener('resize', function () {
    closeAllLabInfoPopovers();
  });

  // Format money setup defaults to 2 decimal places on load / blur (both levels)
  function formatMoneyInputEl(el) {
    if (!el) return;
    var n = parseFloat(el.value);
    if (!isFinite(n)) return;
    el.value = (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(2);
  }
  var moneySetupIds = [
    'annualTc', 'annualCop', 'defaultTaxable',
    'ipass-annual-tc', 'ipass-annual-srcop', 'ipass-default-gross',
    'ipass-opening-d', 'ipass-opening-k'
  ];
  moneySetupIds.forEach(function (id) {
    var el = document.getElementById(id);
    formatMoneyInputEl(el);
    if (el) {
      el.addEventListener('blur', function () {
        formatMoneyInputEl(el);
      });
    }
  });

  // Initial mode
  switchLevel(1);
  buildRowsFromSetup();
})();
