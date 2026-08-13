/**
 * Level 2 Practice 1 — IPASS cumulative card formula practice
 * (same interaction pattern as L1 Practice 1: click cell → formula → paste → check)
 */
(function () {
  'use strict';

  var Ipass = window.PayeLabIpass;
  if (!Ipass) {
    console.error('PayeLabIpass missing — load ipass.js first');
    return;
  }

  var round2 = Ipass.round2;
  var fmt = Ipass.fmt;
  var money = Ipass.money;
  var num = Ipass.num;

  /** Student fills these (drivers A–C are given; first 4 taxables prepopulated). */
  var FILL_FIELDS = [
    { key: 'cumTaxable', label: 'D Cumulative Taxable Pay', col: 'D' },
    { key: 'cumSrcop', label: 'E Cumulative SRCOP', col: 'E' },
    { key: 'cumHigher', label: 'F Cum. taxable at Higher Rate (40%)', col: 'F' },
    { key: 'cumTaxStd', label: 'G Cum. Tax due at Standard Rate (20%)', col: 'G' },
    { key: 'cumTaxHigh', label: 'H Cum. Tax due at Higher Rate (40%)', col: 'H' },
    { key: 'cumGrossTax', label: 'I Cumulative Gross tax', col: 'I' },
    { key: 'cumTc', label: 'J Cumulative Tax Credit', col: 'J' },
    { key: 'cumTaxDue', label: 'K Cumulative tax due', col: 'K' },
    { key: 'taxDeducted', label: 'L Tax deducted this period', col: 'L' },
    { key: 'taxRefunded', label: 'M Tax refunded this period', col: 'M' },
    { key: 'prsiEe', label: 'N EE PRSI', col: 'N' },
    { key: 'prsiEr', label: 'O ER PRSI', col: 'O' }
  ];

  /** First N taxable/gross cells are prefilled random salaries; from N+1 use ovals / arbitrary. */
  var PREPOP_TAXABLE_COUNT = 4;

  var els = {
    tbody: document.getElementById('ipass-practice-rows'),
    empty: document.getElementById('ipass-practice-empty'),
    btnBuild: document.getElementById('btn-ipass-practice-build'),
    btnClear: document.getElementById('btn-ipass-practice-clear'),
    btnCheckAll: document.getElementById('btn-ipass-practice-check-all'),
    msg: document.getElementById('ipass-practice-msg'),
    scoreBar: document.getElementById('ipass-practice-score-bar'),
    scoreCells: document.getElementById('ipass-practice-score-cells'),
    scoreRows: document.getElementById('ipass-practice-score-rows'),
    workspace: document.getElementById('ipass-formula-workspace'),
    formulaTitle: document.getElementById('ipass-formula-title'),
    formulaHint: document.getElementById('ipass-formula-hint'),
    formulaOperands: document.getElementById('ipass-formula-operands'),
    formulaExpression: document.getElementById('ipass-formula-expression'),
    formulaResult: document.getElementById('ipass-formula-result-value'),
    formulaStatus: document.getElementById('ipass-formula-status'),
    btnPaste: document.getElementById('btn-ipass-formula-paste'),
    btnClearSlots: document.getElementById('btn-ipass-formula-clear-slots'),
    btnClose: document.getElementById('btn-ipass-formula-close')
  };

  var answers = [];
  var student = [];
  var drivers = []; // weekNo, gross, taxable
  var meta = null; // weeklyTc, weeklySrcop, rates, openings
  var active = null;
  var formulaState = null;
  var dragValue = null;
  var pendingChip = null;
  var flashTimer = null;

  function nearlyEqual(a, b) {
    return Math.abs(round2(a) - round2(b)) <= 0.02;
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function choiceSet(correct) {
    var c = round2(correct);
    var set = [c];
    var deltas = [1, 2, 5, 10, 20, 50, 0.5, 3.5, -1, -2, -5, -10];
    for (var i = 0; i < deltas.length && set.length < 4; i++) {
      var v = round2(Math.max(0, c + deltas[i] * (1 + (i % 3) * 0.1)));
      if (!set.some(function (x) { return nearlyEqual(x, v); })) set.push(v);
    }
    while (set.length < 3) set.push(round2(c + set.length * 7 + 1));
    return shuffle(set);
  }

  /**
   * Realistic weekly gross pays (€) so cumulative taxable can cross SRCOP
   * and exercise F (40%) / G (20%) / H (40%) columns.
   */
  function realisticPracticeGrosses(count, annualSrcop, periodsPerYear, openingD, startWeek) {
    var ppy = periodsPerYear || 52;
    var weeklySrcop = round2(num(annualSrcop, 44000) / ppy);
    // Irish-style weekly salaries (some above weekly SRCOP)
    var pool = [
      850, 920, 980, 1050, 1120, 1180, 1250, 1320, 1400, 1480,
      1550, 1620, 1750, 1850, 1950, 2100, 2250, 2400, 2550, 2800
    ];
    // Shuffle pool and take unique-ish values with small jitter
    var shuffled = shuffle(pool.slice());
    var grosses = [];
    for (var i = 0; i < count; i++) {
      var base = shuffled[i % shuffled.length];
      var jitter = round2((Math.random() - 0.5) * 60);
      grosses.push(round2(Math.max(400, base + jitter)));
    }

    // Ensure at least one period ends up with cum taxable > cum SRCOP (higher rate base)
    var open = num(openingD, 0);
    var start = startWeek || 1;
    var lastWeek = start + count - 1;
    var targetE = round2(lastWeek * weeklySrcop);
    var sum = grosses.reduce(function (a, b) { return a + b; }, 0);
    var projected = round2(open + sum);
    if (projected <= targetE && count > 0) {
      // Bump later weeks so the card crosses into the 40% band
      var need = round2(targetE - open + weeklySrcop * 0.35);
      var boost = round2(Math.max(0, need - sum) / count);
      for (var j = 0; j < count; j++) {
        // Heavier boost on later weeks
        var w = 0.6 + (j / Math.max(count - 1, 1)) * 0.9;
        grosses[j] = round2(grosses[j] + boost * w);
      }
    }
    return grosses;
  }

  function isTaxablePrepopulated(rowIdx) {
    return rowIdx < PREPOP_TAXABLE_COUNT;
  }

  function recomputeAnswersFromDrivers() {
    if (!meta) return;
    var setup = {
      annualTc: meta.annualTc,
      annualSrcop: meta.annualSrcop,
      periodsPerYear: meta.periodsPerYear || 52,
      rateStd: meta.rateStd,
      rateHigh: meta.rateHigh,
      prsiEeRate: meta.prsiEeRate,
      prsiErRate: meta.prsiErRate,
      openingCumulativeTaxable: meta.openingD,
      openingCumulativeTaxDue: meta.openingK
    };
    var periods = drivers.map(function (d) {
      var pay = d.taxableStudent != null ? d.taxableStudent : d.taxable;
      return { weekNo: d.weekNo, gross: pay, pension: 0 };
    });
    var card = Ipass.computeCard(setup, periods);
    meta.weeklyTc = card.weeklyTc;
    meta.weeklySrcop = card.weeklySrcop;
    answers = card.rows;
  }

  function generateExercise() {
    var defaultTc = Ipass.DEFAULT_ANNUAL_TC || 4000;
    var defaultSrcop = Ipass.DEFAULT_ANNUAL_SRCOP || 44000;

    // Use live Level 2 cumulative card setup (not hardcoded sample rates / pays)
    var setup = Ipass.getSetup
      ? Ipass.getSetup()
      : {
          annualTc: defaultTc,
          annualSrcop: defaultSrcop,
          periodsPerYear: 52,
          rateStd: 0.2,
          rateHigh: 0.4,
          prsiEeRate: 0.04,
          prsiErRate: 0.1095,
          openingCumulativeTaxable: 0,
          openingCumulativeTaxDue: 0
        };
    delete setup.weeklyTc;
    delete setup.weeklySrcop;

    var opts = Ipass.getBuildOptions
      ? Ipass.getBuildOptions()
      : { startWeek: 28, periodCount: 4, defaultGross: 720 };

    // Prefer at least 5 weeks when possible so period 5+ can use ovals
    var count = Math.max(1, opts.periodCount);
    var start = opts.startWeek;
    var grosses = realisticPracticeGrosses(
      count,
      setup.annualSrcop,
      setup.periodsPerYear || 52,
      setup.openingCumulativeTaxable,
      start
    );

    drivers = [];
    for (var i = 0; i < count; i++) {
      var g = grosses[i];
      drivers.push({
        weekNo: start + i,
        gross: g,
        pension: 0,
        taxable: g,
        // First four taxables locked as prepopulated random salaries
        taxableLocked: isTaxablePrepopulated(i),
        // From 5th: student may set taxable via ovals (starts empty for fill)
        taxableStudent: isTaxablePrepopulated(i) ? g : null
      });
    }

    // For answer key: use prepopulated taxables; for open rows use generated gross as provisional
    var computeDrivers = drivers.map(function (d) {
      return {
        weekNo: d.weekNo,
        gross: d.gross,
        pension: 0,
        taxable: d.taxableStudent != null ? d.taxableStudent : d.taxable
      };
    });

    var card = Ipass.computeCard(setup, computeDrivers);
    meta = {
      weeklyTc: card.weeklyTc,
      weeklySrcop: card.weeklySrcop,
      rateStd: setup.rateStd != null ? setup.rateStd : 0.2,
      rateHigh: setup.rateHigh != null ? setup.rateHigh : 0.4,
      prsiEeRate: setup.prsiEeRate != null ? setup.prsiEeRate : 0.04,
      prsiErRate: setup.prsiErRate != null ? setup.prsiErRate : 0.1095,
      openingD: setup.openingCumulativeTaxable,
      openingK: setup.openingCumulativeTaxDue,
      annualTc: setup.annualTc,
      annualSrcop: setup.annualSrcop,
      periodsPerYear: setup.periodsPerYear || 52,
      defaultGross: opts.defaultGross
    };
    answers = card.rows;
    student = answers.map(function (row, rowIdx) {
      var s = {
        _check: {},
        taxablePay: isTaxablePrepopulated(rowIdx) ? round2(drivers[rowIdx].taxable) : null,
        _prepopulatedTaxable: isTaxablePrepopulated(rowIdx)
      };
      FILL_FIELDS.forEach(function (f) {
        s[f.key] = null;
        s._check[f.key] = null;
      });
      if (s._prepopulatedTaxable) s._check.taxablePay = true;
      return s;
    });
    closeFormula();
    renderTable();
    flashMsg(
      'Practice generated — TC €' + fmt(setup.annualTc) +
      ', SRCOP €' + fmt(setup.annualSrcop) +
      ', ' + drivers.length + ' week(s) from ' + (drivers[0] ? drivers[0].weekNo : '—') +
      '. First ' + Math.min(PREPOP_TAXABLE_COUNT, drivers.length) +
      ' taxable pays prepopulated; from week ' + (PREPOP_TAXABLE_COUNT + 1) +
      ' use ovals. Fill D–O.'
    );
  }

  function clearAnswers() {
    if (!answers.length) return;
    student = answers.map(function (row, rowIdx) {
      var s = {
        _check: {},
        taxablePay: isTaxablePrepopulated(rowIdx) ? round2(drivers[rowIdx].taxable) : null,
        _prepopulatedTaxable: isTaxablePrepopulated(rowIdx)
      };
      FILL_FIELDS.forEach(function (f) {
        s[f.key] = null;
        s._check[f.key] = null;
      });
      if (s._prepopulatedTaxable) s._check.taxablePay = true;
      // Reset free taxable drivers from 5th
      if (!isTaxablePrepopulated(rowIdx) && drivers[rowIdx]) {
        drivers[rowIdx].taxableStudent = null;
        drivers[rowIdx].taxable = drivers[rowIdx].gross;
      }
      return s;
    });
    recomputeAnswersFromDrivers();
    closeFormula();
    renderTable();
  }

  function flashMsg(text) {
    if (!els.msg) return;
    els.msg.hidden = false;
    els.msg.textContent = text;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function () {
      els.msg.hidden = true;
      els.msg.textContent = '';
    }, 4000);
  }

  function renderTable() {
    if (!els.tbody) return;
    if (!answers.length) {
      els.tbody.innerHTML = '';
      if (els.empty) els.empty.hidden = false;
      if (els.scoreBar) els.scoreBar.hidden = true;
      return;
    }
    if (els.empty) els.empty.hidden = true;
    if (els.scoreBar) els.scoreBar.hidden = false;

    var html = '';
    for (var i = 0; i < answers.length; i++) {
      var a = answers[i];
      var s = student[i];
      var d = drivers[i];
      var taxDisplay = d.taxableStudent != null ? d.taxableStudent : (s.taxablePay != null ? s.taxablePay : d.taxable);
      var prepop = isTaxablePrepopulated(i);
      html += '<tr>';
      html += '<td class="ipass-week">' + a.weekNo + '</td>';
      html += '<td class="ipass-driver">' + fmt(d.gross) + '</td>';
      if (prepop) {
        html += '<td class="ipass-driver practice-cell is-given" title="Prepopulated random salary">';
        html += '<span class="practice-given practice-prepop">' + fmt(taxDisplay) + '</span></td>';
      } else {
        var tCls = 'practice-cell';
        if (active && active.rowIdx === i && active.field === 'taxablePay') tCls += ' is-active';
        if (s._check && s._check.taxablePay === true) tCls += ' is-correct';
        if (s._check && s._check.taxablePay === false) tCls += ' is-wrong';
        if (s.taxablePay == null && d.taxableStudent == null) tCls += ' is-empty';
        var tShow = s.taxablePay != null ? s.taxablePay : d.taxableStudent;
        html += '<td class="' + tCls + '">';
        html += '<button type="button" class="practice-cell-btn" data-row="' + i +
          '" data-field="taxablePay" title="Choose taxable pay (ovals / arbitrary)">';
        html += tShow == null ? '—' : fmt(tShow);
        html += '</button></td>';
      }
      FILL_FIELDS.forEach(function (f) {
        var val = s[f.key];
        var chk = s._check[f.key];
        var cls = 'practice-cell';
        if (active && active.rowIdx === i && active.field === f.key) cls += ' is-active';
        if (chk === true) cls += ' is-correct';
        if (chk === false) cls += ' is-wrong';
        if (val == null) cls += ' is-empty';
        var display = val == null ? '—' : fmt(val);
        html += '<td class="' + cls + '">';
        html += '<button type="button" class="practice-cell-btn" data-row="' + i + '" data-field="' + f.key + '" title="Open formula quest">';
        html += display;
        html += '</button></td>';
      });
      html += '<td class="practice-check-cell"><button type="button" class="btn btn-secondary btn-sm" data-check-row="' + i + '">Check</button></td>';
      html += '</tr>';
    }
    els.tbody.innerHTML = html;
    updateScore();
  }

  function getFormulaSpec(rowIdx, field) {
    var row = answers[rowIdx];
    var prev = rowIdx > 0 ? answers[rowIdx - 1] : null;
    var d = drivers[rowIdx];
    var m = meta;
    if (!row || !m) return null;

    function binary(op, leftLabel, leftVal, rightLabel, rightVal, result, hint) {
      return {
        op: op,
        hint: hint,
        result: round2(result),
        slots: [
          { id: 'a', role: leftLabel, correct: round2(leftVal) },
          { id: 'b', role: rightLabel, correct: round2(rightVal) }
        ],
        evaluate: function (a, b) {
          if (a == null || b == null) return null;
          if (op === '+') return round2(a + b);
          if (op === '-') return round2(a - b);
          if (op === '×') return round2(a * b);
          if (op === '÷') return b === 0 ? null : round2(a / b);
          if (op === 'min') return round2(Math.min(a, b));
          if (op === 'max0') return round2(Math.max(0, a - b));
          return null;
        }
      };
    }

    switch (field) {
      case 'cumTaxable': {
        var prevD = prev ? prev.cumTaxable : m.openingD;
        return binary(
          '+',
          'Previous cumulative taxable (or opening)',
          prevD,
          'Taxable pay this period (C)',
          d.taxable,
          row.cumTaxable,
          'D = previous cumulative taxable pay + taxable pay this period (C).'
        );
      }
      case 'cumSrcop':
        // E = Week No. × (Annual SRCOP ÷ 52 weeks) — 52 is fixed, not a student option
        return {
          op: '×div',
          hint:
            'E = Week No. × weekly SRCOP. Weekly SRCOP = annual SRCOP ÷ 52 weeks. ' +
            'Yellow ① = Week No. Pink ② = Annual SRCOP. The “52 weeks” after ÷ is fixed.',
          result: row.cumSrcop,
          slots: [
            { id: 'a', role: 'Week number (A)', correct: round2(row.weekNo) },
            {
              id: 'b',
              role: 'Annual SRCOP (setup)',
              correct: round2(m.annualSrcop),
              tone: 2
            }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            // Match card: weekly SRCOP = round2(annual ÷ 52), then × week
            var weekly = round2(b / 52);
            return round2(a * weekly);
          }
        };
      case 'cumHigher':
        return {
          op: 'max0',
          hint: 'F = max(0, D − E) — cumulative taxable at Higher Rate (40% band base).',
          result: row.cumHigher,
          slots: [
            { id: 'a', role: 'Cumulative taxable pay (D)', correct: row.cumTaxable },
            { id: 'b', role: 'Cumulative SRCOP (E)', correct: row.cumSrcop }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(Math.max(0, a - b));
          }
        };
      case 'cumTaxStd':
        return {
          op: '×min',
          hint: 'G = min(D, E) × 20% — Cum. Tax due at Standard Rate (20%).',
          result: row.cumTaxStd,
          slots: [
            { id: 'a', role: 'Cumulative taxable pay (D)', correct: row.cumTaxable },
            { id: 'b', role: 'Cumulative SRCOP (E)', correct: row.cumSrcop },
            { id: 'c', role: 'Standard rate 20%', correct: 0.2 }
          ],
          evaluate: function (a, b, c) {
            if (a == null || b == null || c == null) return null;
            return round2(Math.min(a, b) * c);
          }
        };
      case 'cumTaxHigh':
        return binary(
          '×',
          'Cum. taxable at Higher Rate (F · 40% base)',
          row.cumHigher,
          'Higher rate 40%',
          0.4,
          row.cumTaxHigh,
          'H = F × 40% — Cum. Tax due at Higher Rate (40%).'
        );
      case 'taxablePay': {
        var dTax = d.taxable;
        return {
          op: 'id',
          hint:
            'Taxable pay for week ' + row.weekNo + ' (period ' + (PREPOP_TAXABLE_COUNT + 1) +
            '+). Pick a sample oval or type an arbitrary amount. ' +
            'This updates the answer key for D–O on this row.',
          result: round2(dTax),
          slots: [{ id: 'a', role: 'Taxable pay this period (C) — any positive amount', correct: round2(dTax) }],
          anyValueAcceptable: true,
          choiceMode: 'taxablePayBands',
          evaluate: function (a) {
            return a == null ? null : round2(a);
          }
        };
      }
      case 'cumGrossTax':
        return binary(
          '+',
          'Cum. tax at standard rate (G)',
          row.cumTaxStd,
          'Cum. tax at higher rate (H)',
          row.cumTaxHigh,
          row.cumGrossTax,
          'I = G + H.'
        );
      case 'cumTc':
        return binary(
          '×',
          'Week number (A)',
          row.weekNo,
          'Weekly tax credit (annual TC ÷ 52)',
          m.weeklyTc,
          row.cumTc,
          'J = Week No. × weekly tax credit.'
        );
      case 'cumTaxDue':
        return {
          op: 'max0',
          hint: 'K = max(0, cumulative gross tax I − cumulative tax credit J).',
          result: row.cumTaxDue,
          slots: [
            { id: 'a', role: 'Cumulative gross tax (I)', correct: row.cumGrossTax },
            { id: 'b', role: 'Cumulative tax credit (J)', correct: row.cumTc }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(Math.max(0, a - b));
          }
        };
      case 'taxDeducted': {
        var prevK = prev ? prev.cumTaxDue : m.openingK;
        return {
          op: 'max0',
          hint: 'L = max(0, this period K − previous K). Increase in cumulative tax due.',
          result: row.taxDeducted,
          slots: [
            { id: 'a', role: 'Cumulative tax due this week (K)', correct: row.cumTaxDue },
            { id: 'b', role: 'Previous cumulative tax due (K)', correct: prevK }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(Math.max(0, a - b));
          }
        };
      }
      case 'taxRefunded': {
        var prevK2 = prev ? prev.cumTaxDue : m.openingK;
        return {
          op: 'max0',
          hint: 'M = max(0, previous K − this K). Only when cumulative tax due falls.',
          result: row.taxRefunded,
          slots: [
            { id: 'a', role: 'Previous cumulative tax due (K)', correct: prevK2 },
            { id: 'b', role: 'Cumulative tax due this week (K)', correct: row.cumTaxDue }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(Math.max(0, a - b));
          }
        };
      }
      case 'prsiEe':
        return binary(
          '×',
          'Gross pay this period (B)',
          d.gross,
          'EE PRSI rate (e.g. 4%)',
          m.prsiEeRate,
          row.prsiEe,
          'N = Gross pay × employee PRSI rate (training rate 4%).'
        );
      case 'prsiEr':
        return binary(
          '×',
          'Gross pay this period (B)',
          d.gross,
          'ER PRSI rate (e.g. ~10.95%)',
          m.prsiErRate,
          row.prsiEr,
          'O = Gross pay × employer PRSI rate (training approximation).'
        );
      default:
        return null;
    }
  }

  function openFormula(rowIdx, field) {
    if (field === 'taxablePay' && isTaxablePrepopulated(rowIdx)) {
      return; // given — no oval builder
    }
    var spec = getFormulaSpec(rowIdx, field);
    if (!spec) return;
    active = { rowIdx: rowIdx, field: field };
    formulaState = { spec: spec, filled: {}, choices: {}, customPayInput: '' };
    if (field === 'taxablePay' && student[rowIdx] && student[rowIdx].taxablePay != null) {
      formulaState.customPayInput = String(student[rowIdx].taxablePay);
    }
    spec.slots.forEach(function (slot) {
      formulaState.filled[slot.id] = null;
      if (spec.choiceMode === 'taxablePayBands' && field === 'taxablePay') {
        formulaState.choices[slot.id] = taxablePayChoiceBankL2(rowIdx);
      } else {
        formulaState.choices[slot.id] = choiceSet(slot.correct);
      }
    });
    var titleField = FILL_FIELDS.find(function (f) { return f.key === field; });
    var titleLabel = titleField
      ? titleField.label
      : (field === 'taxablePay' ? 'C Taxable Pay this period' : field);
    if (els.formulaTitle) {
      els.formulaTitle.textContent =
        'Week ' + answers[rowIdx].weekNo + ' — ' + titleLabel;
    }
    if (els.formulaHint) els.formulaHint.textContent = spec.hint || '';
    if (els.workspace) els.workspace.hidden = false;
    if (els.formulaStatus) els.formulaStatus.textContent = '';
    renderFormulaUi();
    renderTable();
    if (els.workspace) els.workspace.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeFormula() {
    active = null;
    formulaState = null;
    dragValue = null;
    pendingChip = null;
    if (els.workspace) els.workspace.hidden = true;
    if (els.formulaOperands) els.formulaOperands.innerHTML = '';
    if (els.formulaExpression) els.formulaExpression.innerHTML = '';
    renderTable();
  }

  function slotTone(n) {
    return 'slot-tone-' + Math.min(Math.max(n, 1), 3);
  }

  function slotToneFor(slot, idx) {
    if (slot && slot.tone) return slotTone(slot.tone);
    return slotTone(idx + 1);
  }

  function slotDisplayNum(slot, idx) {
    return idx + 1;
  }

  function formatChip(v) {
    if (nearlyEqual(v, 0.2)) return '0.20';
    if (nearlyEqual(v, 0.4)) return '0.40';
    if (nearlyEqual(v, 0.04)) return '0.04';
    if (Math.abs(v - Math.round(v)) < 1e-9 && Math.abs(v) <= 60) return String(Math.round(v));
    return fmt(v);
  }

  /** Sample taxable-pay ovals for free periods (L2). */
  function taxablePayChoiceBankL2(rowIdx) {
    var d = drivers[rowIdx];
    var m = meta || {};
    var weeklySrcop = m.weeklySrcop || round2((m.annualSrcop || 44000) / 52);
    var correct = d && d.taxableStudent != null ? d.taxableStudent : (d ? d.gross : 1000);
    var samples = [
      round2(weeklySrcop * 0.7),
      round2(weeklySrcop * 0.95),
      round2(weeklySrcop),
      round2(weeklySrcop * 1.15),
      round2(weeklySrcop * 1.4),
      round2(weeklySrcop * 1.8),
      round2(weeklySrcop * 2.2),
      round2(d ? d.gross : correct)
    ];
    var set = [round2(correct)];
    samples.forEach(function (v) {
      if (!set.some(function (x) { return nearlyEqual(x, v); })) set.push(v);
    });
    return shuffle(set).slice(0, 6);
  }

  function renderFormulaUi() {
    if (!formulaState || !els.formulaOperands) return;
    var spec = formulaState.spec;
    var opHtml = '';
    // Column E: Week No. × (Annual SRCOP ÷ 52 weeks) — 52 is a fixed label, not an oval
    if (spec.op === '×div' && spec.slots.length >= 2) {
      var slotA = spec.slots[0];
      var slotB = spec.slots[1];
      opHtml += '<div class="operand-bank slot-tone-1">';
      opHtml += '<div class="operand-bank-label"><span class="operand-num">1</span><span>' +
        escapeHtml(slotA.role) + '</span></div>';
      opHtml += '<div class="chip-row">';
      (formulaState.choices[slotA.id] || []).forEach(function (v) {
        opHtml += '<span class="value-chip slot-tone-1" draggable="true" data-slot-target="' + slotA.id +
          '" data-value="' + v + '">' + formatChip(v) + '</span>';
      });
      opHtml += '</div></div>';

      opHtml += '<div class="operand-bank slot-tone-2">';
      opHtml += '<div class="operand-bank-label"><span class="operand-num">2</span><span>' +
        escapeHtml('Annual SRCOP (÷ 52 weeks)') + '</span></div>';
      opHtml += '<div class="chip-row">';
      (formulaState.choices[slotB.id] || []).forEach(function (v) {
        opHtml += '<span class="value-chip slot-tone-2" draggable="true" data-slot-target="' + slotB.id +
          '" data-value="' + v + '">' + formatChip(v) + '</span>';
      });
      opHtml += '</div></div>';
    } else {
      spec.slots.forEach(function (slot, idx) {
        var n = slotDisplayNum(slot, idx);
        var tone = slotToneFor(slot, idx);
        opHtml += '<div class="operand-bank ' + tone + '">';
        opHtml += '<div class="operand-bank-label"><span class="operand-num">' + n + '</span><span>' +
          escapeHtml(slot.role) + '</span></div>';
        opHtml += '<div class="chip-row">';
        (formulaState.choices[slot.id] || []).forEach(function (v) {
          opHtml += '<span class="value-chip ' + tone + '" draggable="true" data-slot-target="' + slot.id +
            '" data-value="' + v + '">' + formatChip(v) + '</span>';
        });
        // Mint custom oval for free taxable pay
        if (spec.anyValueAcceptable && idx === 0) {
          var customVal = formulaState.customPayInput != null ? formulaState.customPayInput : '';
          opHtml += '<span class="value-chip value-chip-custom has-band" draggable="true" ' +
            'data-slot-target="' + slot.id + '" data-custom-chip="1">' +
            '<label class="custom-chip-label">Your value</label>' +
            '<input type="text" inputmode="decimal" class="custom-chip-input" ' +
            'value="' + escapeHtml(customVal) + '" placeholder="e.g. 1450.00" /></span>';
        }
        opHtml += '</div></div>';
      });
    }
    els.formulaOperands.innerHTML = opHtml;
    bindCustomChipInputs();

    var result = computeResult();
    var expr = '';
    if (spec.slots.length === 1) {
      expr += dropZone(spec.slots[0], 1) + ' <span class="op-fixed">=</span> ';
    } else if (spec.op === '×div' && spec.slots.length >= 2) {
      // E = Week No. × (Annual SRCOP ÷ 52 weeks) — 52 weeks is constant text
      expr += dropZone(spec.slots[0], 1);
      expr += ' <span class="op-sign op-sign-mul">×</span> ';
      expr += '<span class="op-bracket">(</span>';
      expr += dropZone(spec.slots[1], 2);
      expr += ' <span class="op-sign">÷</span> ';
      expr += '<span class="op-fixed op-const-weeks">52 weeks</span>';
      expr += '<span class="op-bracket">)</span>';
      expr += ' <span class="op-fixed">=</span> ';
    } else if (spec.op === '×min' && spec.slots.length >= 3) {
      expr += '<span class="op-fn-min">min</span><span class="op-bracket">(</span>';
      expr += dropZone(spec.slots[0], 1) + '<span class="op-fixed">,</span>';
      expr += dropZone(spec.slots[1], 2);
      expr += '<span class="op-bracket">)</span>';
      expr += ' <span class="op-sign op-sign-mul">×</span> ';
      expr += dropZone(spec.slots[2], 3);
      expr += ' <span class="op-fixed">=</span> ';
    } else if (spec.op === 'max0') {
      expr += '<span class="op-fn-min">max</span><span class="op-bracket">(</span>0<span class="op-fixed">,</span> ';
      expr += dropZone(spec.slots[0], 1);
      expr += ' <span class="op-sign">−</span> ';
      expr += dropZone(spec.slots[1], 2);
      expr += '<span class="op-bracket">)</span> <span class="op-fixed">=</span> ';
    } else if (spec.op === 'min') {
      expr += '<span class="op-fn-min">min</span><span class="op-bracket">(</span>';
      expr += dropZone(spec.slots[0], 1) + '<span class="op-fixed">,</span>';
      expr += dropZone(spec.slots[1], 2);
      expr += '<span class="op-bracket">)</span> <span class="op-fixed">=</span> ';
    } else {
      var sym = spec.op === '×' ? '×' : spec.op === '+' ? '+' : '−';
      expr += dropZone(spec.slots[0], 1);
      expr += ' <span class="op-sign' + (spec.op === '×' ? ' op-sign-mul' : '') + '">' + sym + '</span> ';
      expr += dropZone(spec.slots[1], 2);
      expr += ' <span class="op-fixed">=</span> ';
    }
    expr += result == null
      ? '<span class="formula-eq-result is-waiting">?</span>'
      : '<span class="formula-eq-result is-ready">' + money(result) + '</span>';
    if (els.formulaExpression) els.formulaExpression.innerHTML = expr;
    if (els.formulaResult) {
      els.formulaResult.textContent = result == null ? '—' : money(result);
      els.formulaResult.classList.toggle('is-ready', result != null);
      els.formulaResult.classList.toggle('is-waiting', result == null);
    }
    if (els.btnPaste) els.btnPaste.disabled = result == null;
  }

  function dropZone(slot, n) {
    var filled = formulaState.filled[slot.id];
    var tone = slotTone(n);
    var label = n;
    var inner = filled == null
      ? '<span class="drop-placeholder">Drop ' + label + '</span>'
      : '<span class="drop-value">' + formatChip(filled) + '</span>';
    return (
      '<span class="drop-slot ' + tone + '" data-slot="' + slot.id + '">' +
      '<span class="drop-num">' + label + '</span>' + inner + '</span>'
    );
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function computeResult() {
    if (!formulaState) return null;
    var spec = formulaState.spec;
    var args = spec.slots.map(function (s) { return formulaState.filled[s.id]; });
    if (args.some(function (a) { return a == null; })) return null;
    return spec.evaluate.apply(null, args);
  }

  function placeInSlot(slotId, val, prefer) {
    if (!formulaState || !isFinite(val)) return;
    if (prefer && prefer !== slotId) {
      if (els.formulaStatus) {
        els.formulaStatus.textContent = 'Use a matching colour oval for that box.';
      }
      return;
    }
    formulaState.filled[slotId] = round2(val);
    renderFormulaUi();
  }

  function bindCustomChipInputs() {
    if (!els.formulaOperands) return;
    var inputs = els.formulaOperands.querySelectorAll('.custom-chip-input');
    inputs.forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (!formulaState) return;
        formulaState.customPayInput = inp.value;
        var n = parseFloat(inp.value);
        var chip = inp.closest('.value-chip');
        if (chip) {
          if (isFinite(n) && n >= 0) {
            chip.setAttribute('data-value', String(round2(n)));
            var prefer = chip.getAttribute('data-slot-target') || 'a';
            formulaState.filled[prefer] = round2(n);
          } else {
            chip.removeAttribute('data-value');
            var pref = chip.getAttribute('data-slot-target') || 'a';
            formulaState.filled[pref] = null;
          }
        }
        // Refresh expression result without wiping the input focus
        var result = computeResult();
        if (els.formulaResult) {
          els.formulaResult.textContent = result == null ? '—' : money(result);
          els.formulaResult.classList.toggle('is-ready', result != null);
          els.formulaResult.classList.toggle('is-waiting', result == null);
        }
        if (els.btnPaste) els.btnPaste.disabled = result == null;
        if (els.formulaExpression) {
          // only update eq result tail
          var eq = els.formulaExpression.querySelector('.formula-eq-result');
          if (eq) {
            if (result == null) {
              eq.textContent = '?';
              eq.className = 'formula-eq-result is-waiting';
            } else {
              eq.textContent = money(result);
              eq.className = 'formula-eq-result is-ready';
            }
          }
          var slot = els.formulaExpression.querySelector('.drop-slot[data-slot="a"]');
          if (slot && isFinite(n) && n >= 0) {
            var dv = slot.querySelector('.drop-value, .drop-placeholder');
            if (dv) {
              dv.className = 'drop-value';
              dv.textContent = formatChip(round2(n));
            }
          }
        }
      });
      inp.addEventListener('click', function (e) { e.stopPropagation(); });
      inp.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    });
  }

  function pasteResult() {
    if (!active || !formulaState) return;
    var result = computeResult();
    if (result == null) return;
    var field = active.field;
    var rowIdx = active.rowIdx;

    if (field === 'taxablePay') {
      // Free taxable (period 5+): update driver and recompute answer key cascade
      student[rowIdx].taxablePay = result;
      student[rowIdx]._check.taxablePay = true;
      if (drivers[rowIdx]) {
        drivers[rowIdx].taxableStudent = result;
        drivers[rowIdx].taxable = result;
        // Keep gross in sync when no pension (training default)
        if (!drivers[rowIdx].pension) drivers[rowIdx].gross = result;
      }
      // Clear D–O answers from this row onward (drivers changed)
      for (var r = rowIdx; r < student.length; r++) {
        FILL_FIELDS.forEach(function (f) {
          student[r][f.key] = null;
          student[r]._check[f.key] = null;
        });
      }
      recomputeAnswersFromDrivers();
      if (els.formulaStatus) {
        els.formulaStatus.textContent = 'Taxable pay set to ' + money(result) + '. D–O recalculated.';
        els.formulaStatus.className = 'formula-status is-ok';
      }
      renderTable();
      return;
    }

    student[rowIdx][field] = result;
    student[rowIdx]._check[field] = null;
    if (els.formulaStatus) {
      els.formulaStatus.textContent = 'Pasted ' + money(result) + '.';
      els.formulaStatus.className = 'formula-status is-ok';
    }
    renderTable();
  }

  function checkRow(rowIdx) {
    var ans = answers[rowIdx];
    var stu = student[rowIdx];
    if (!ans || !stu) return;
    FILL_FIELDS.forEach(function (f) {
      var got = stu[f.key];
      if (got == null || got === '') stu._check[f.key] = false;
      else stu._check[f.key] = nearlyEqual(got, ans[f.key]);
    });
    renderTable();
  }

  function checkAll() {
    for (var i = 0; i < answers.length; i++) checkRow(i);
  }

  function updateScore() {
    if (!answers.length || !els.scoreCells) return;
    var ok = 0;
    var total = 0;
    var rowsOk = 0;
    for (var i = 0; i < answers.length; i++) {
      var all = true;
      FILL_FIELDS.forEach(function (f) {
        total++;
        if (student[i]._check[f.key] === true) ok++;
        if (student[i][f.key] == null || !nearlyEqual(student[i][f.key], answers[i][f.key])) all = false;
      });
      if (all) rowsOk++;
    }
    els.scoreCells.textContent = ok + ' / ' + total;
    if (els.scoreRows) els.scoreRows.textContent = rowsOk + ' / ' + answers.length;
  }

  // Events
  if (els.btnBuild) els.btnBuild.addEventListener('click', generateExercise);
  if (els.btnClear) els.btnClear.addEventListener('click', clearAnswers);
  if (els.btnCheckAll) els.btnCheckAll.addEventListener('click', checkAll);
  if (els.btnClose) els.btnClose.addEventListener('click', closeFormula);
  if (els.btnPaste) els.btnPaste.addEventListener('click', pasteResult);
  if (els.btnClearSlots) {
    els.btnClearSlots.addEventListener('click', function () {
      if (!formulaState) return;
      Object.keys(formulaState.filled).forEach(function (k) {
        formulaState.filled[k] = null;
      });
      renderFormulaUi();
    });
  }

  if (els.tbody) {
    els.tbody.addEventListener('click', function (e) {
      var chk = e.target.closest('[data-check-row]');
      if (chk) {
        checkRow(parseInt(chk.getAttribute('data-check-row'), 10));
        return;
      }
      var btn = e.target.closest('.practice-cell-btn');
      if (btn) {
        openFormula(parseInt(btn.getAttribute('data-row'), 10), btn.getAttribute('data-field'));
      }
    });
  }

  document.addEventListener('dragstart', function (e) {
    var chip = e.target.closest('#ipass-formula-operands .value-chip');
    if (!chip || !formulaState) return;
    if (e.target.closest('.custom-chip-input')) return;
    var val = parseFloat(chip.getAttribute('data-value'));
    if (!isFinite(val) && chip.getAttribute('data-custom-chip')) {
      var inp = chip.querySelector('.custom-chip-input');
      val = inp ? parseFloat(inp.value) : NaN;
    }
    if (!isFinite(val)) return;
    dragValue = { value: val, preferSlot: chip.getAttribute('data-slot-target') };
    try {
      e.dataTransfer.setData('text/plain', String(val));
      e.dataTransfer.effectAllowed = 'copy';
    } catch (err) { /* ignore */ }
  });

  if (els.formulaExpression) {
    els.formulaExpression.addEventListener('dragover', function (e) {
      if (!formulaState) return;
      e.preventDefault();
    });
    els.formulaExpression.addEventListener('drop', function (e) {
      if (!formulaState) return;
      e.preventDefault();
      var slot = e.target.closest('.drop-slot');
      if (!slot && formulaState.spec.slots.length === 1) {
        slot = els.formulaExpression.querySelector('.drop-slot');
      }
      if (!slot) return;
      var slotId = slot.getAttribute('data-slot');
      var val = dragValue ? dragValue.value : parseFloat(e.dataTransfer.getData('text/plain'));
      var prefer = dragValue ? dragValue.preferSlot : null;
      if (prefer && prefer !== slotId) {
        if (els.formulaStatus) els.formulaStatus.textContent = 'Use a matching colour oval for that box.';
        return;
      }
      if (!isFinite(val)) return;
      formulaState.filled[slotId] = round2(val);
      renderFormulaUi();
    });
  }

  if (els.formulaOperands) {
    els.formulaOperands.addEventListener('click', function (e) {
      if (e.target.closest('.custom-chip-input')) return;
      var chip = e.target.closest('.value-chip');
      if (!chip || !formulaState) return;
      var val = parseFloat(chip.getAttribute('data-value'));
      var prefer = chip.getAttribute('data-slot-target');
      if (!isFinite(val) && chip.getAttribute('data-custom-chip')) {
        var inp = chip.querySelector('.custom-chip-input');
        val = inp ? parseFloat(inp.value) : NaN;
      }
      if (!isFinite(val)) return;
      if (prefer) {
        formulaState.filled[prefer] = round2(val);
        renderFormulaUi();
        return;
      }
      pendingChip = { value: val, preferSlot: prefer };
    });
  }

  window.PayeLabIpassPractice = {
    onShow: function () {
      if (!answers.length) generateExercise();
      else renderTable();
    },
    generate: generateExercise
  };
})();
