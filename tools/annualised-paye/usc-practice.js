/**
 * USC Lab — 2026 thresholds page + Cumulative USC Deduction Card practice
 * (same oval / paste / check pattern as PAYE Lab L2).
 */
(function () {
  'use strict';

  var MathApi = window.UscLabMath;
  if (!MathApi) {
    console.error('UscLabMath missing — load usc-math.js first');
    return;
  }

  var round2 = MathApi.round2;
  var num = MathApi.num;
  var storeOperand = MathApi.storeOperand;
  var parseOperand = MathApi.parseOperand;
  var formatRateLabel = MathApi.formatRateLabel;
  var evaluateUscOp = MathApi.evaluateUscOp;
  var isRateValue = MathApi.isRateValue;
  var PREPOP = MathApi.PREPOP_GROSS_COUNT || 4;

  function fmt(n) {
    return round2(n).toFixed(2);
  }

  function money(n) {
    return '€' + fmt(n);
  }

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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var FILL_FIELDS = [
    { key: 'cumGross', label: 'Cumulative Gross Pay for USC', col: 'C' },
    { key: 'cop1', label: 'Cumulative USC Rate 1 COP', col: 'D' },
    { key: 'due1', label: 'Cumulative USC due at Rate 1', col: 'E' },
    { key: 'cop2', label: 'Cumulative USC Rate 2 COP', col: 'F' },
    { key: 'due2', label: 'Cumulative USC due at Rate 2', col: 'G' },
    { key: 'cop3', label: 'Cumulative USC Rate 3 COP', col: 'H' },
    { key: 'due3', label: 'Cumulative USC due at Rate 3', col: 'I' },
    { key: 'due4', label: 'Cumulative USC due at Rate 4', col: 'J' },
    { key: 'cumUsc', label: 'Cumulative USC', col: 'K' },
    { key: 'deducted', label: 'USC deducted this period', col: 'L' },
    { key: 'refunded', label: 'USC refunded this period', col: 'M' }
  ];

  var els = {
    ratesBody: document.getElementById('usc-rates-rows'),
    ratesPrint: document.getElementById('btn-usc-rates-print'),
    startWeek: document.getElementById('usc-start-week'),
    periodCount: document.getElementById('usc-period-count'),
    openingC: document.getElementById('usc-opening-c'),
    openingK: document.getElementById('usc-opening-k'),
    weekly1: document.getElementById('usc-weekly-cop1'),
    weekly2: document.getElementById('usc-weekly-cop2'),
    weekly3: document.getElementById('usc-weekly-cop3'),
    tbody: document.getElementById('usc-practice-rows'),
    empty: document.getElementById('usc-practice-empty'),
    btnBuild: document.getElementById('btn-usc-practice-build'),
    btnClear: document.getElementById('btn-usc-practice-clear'),
    btnCheckAll: document.getElementById('btn-usc-practice-check-all'),
    btnPrint: document.getElementById('btn-usc-practice-print'),
    msg: document.getElementById('usc-practice-msg'),
    scoreBar: document.getElementById('usc-practice-score-bar'),
    scoreCells: document.getElementById('usc-practice-score-cells'),
    scoreRows: document.getElementById('usc-practice-score-rows'),
    workspace: document.getElementById('usc-formula-workspace'),
    formulaTitle: document.getElementById('usc-formula-title'),
    formulaHint: document.getElementById('usc-formula-hint'),
    formulaOperands: document.getElementById('usc-formula-operands'),
    formulaExpression: document.getElementById('usc-formula-expression'),
    formulaResult: document.getElementById('usc-formula-result-value'),
    formulaStatus: document.getElementById('usc-formula-status'),
    btnPaste: document.getElementById('btn-usc-formula-paste'),
    btnClearSlots: document.getElementById('btn-usc-formula-clear-slots'),
    btnClose: document.getElementById('btn-usc-formula-close')
  };

  var answers = [];
  var student = [];
  var drivers = [];
  var meta = null;
  var active = null;
  var formulaState = null;
  var dragValue = null;
  var openingKManual = false;
  var flashTimer = null;

  function moneyFmt(n) {
    return '€' + Number(n).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function renderRatesTable() {
    if (!els.ratesBody) return;
    var table = MathApi.thresholdTable2026();
    var html = '';
    table.bands.forEach(function (b) {
      var annual = b.annualTo == null
        ? 'Over ' + moneyFmt(b.annualFrom)
        : (b.band === 1
          ? '€0.00 – ' + moneyFmt(b.annualTo)
          : moneyFmt(b.annualFrom) + ' – ' + moneyFmt(b.annualTo));
      var wk = b.weeklyTo == null ? 'Over ' + moneyFmt(MathApi.periodSlice(MathApi.USC_2026.rate3.annualEnd, 52)) : moneyFmt(b.weeklyTo);
      var fn = b.fortnightlyTo == null ? 'Over ' + moneyFmt(MathApi.periodSlice(MathApi.USC_2026.rate3.annualEnd, 26)) : moneyFmt(b.fortnightlyTo);
      var mo = b.monthlyTo == null ? 'Over ' + moneyFmt(MathApi.periodSlice(MathApi.USC_2026.rate3.annualEnd, 12)) : moneyFmt(b.monthlyTo);
      if (b.band > 1 && b.weeklyTo != null) {
        var prev = table.bands[b.band - 2];
        wk = moneyFmt(prev.weeklyTo) + ' – ' + moneyFmt(b.weeklyTo);
        fn = moneyFmt(prev.fortnightlyTo) + ' – ' + moneyFmt(b.fortnightlyTo);
        mo = moneyFmt(prev.monthlyTo) + ' – ' + moneyFmt(b.monthlyTo);
      } else if (b.band === 1) {
        wk = '€0.00 – ' + moneyFmt(b.weeklyTo);
        fn = '€0.00 – ' + moneyFmt(b.fortnightlyTo);
        mo = '€0.00 – ' + moneyFmt(b.monthlyTo);
      }
      html += '<tr>';
      html += '<td>Rate ' + b.band + '</td>';
      html += '<td>' + escapeHtml(b.rateLabel) + '</td>';
      html += '<td>' + annual + '</td>';
      html += '<td>' + wk + '</td>';
      html += '<td>' + fn + '</td>';
      html += '<td>' + mo + '</td>';
      html += '</tr>';
    });
    els.ratesBody.innerHTML = html;
  }

  function syncRateStrip() {
    var cops = MathApi.weeklyCops();
    if (els.weekly1) els.weekly1.textContent = money(cops.rate1);
    if (els.weekly2) els.weekly2.textContent = money(cops.rate2);
    if (els.weekly3) els.weekly3.textContent = money(cops.rate3);
  }

  function getSetupFromForm() {
    var startWeek = Math.max(1, parseInt(els.startWeek && els.startWeek.value, 10) || 28);
    var periodCount = Math.max(1, Math.min(53, parseInt(els.periodCount && els.periodCount.value, 10) || 8));
    var openingC = num(els.openingC && els.openingC.value, 18240);
    var openingK = openingKManual
      ? num(els.openingK && els.openingK.value, 0)
      : MathApi.openingUscFromGross(openingC, startWeek);
    if (!openingKManual && els.openingK) {
      els.openingK.value = fmt(openingK);
    }
    return {
      startWeek: startWeek,
      periodCount: periodCount,
      openingCumulativeGross: openingC,
      openingCumulativeUsc: openingK
    };
  }

  function isGrossPrepopulated(rowIdx) {
    return rowIdx < PREPOP;
  }

  function choiceSet(correct) {
    var c = storeOperand(correct);
    var set = [c];
    if (isRateValue(c)) {
      var rateExtras = [0.005, 0.01, 0.02, 0.03, 0.08, 0.004];
      rateExtras.forEach(function (v) {
        if (!set.some(function (x) { return Math.abs(x - v) < 1e-6; })) set.push(v);
      });
      return shuffle(set).slice(0, 4);
    }
    var deltas = [1, 2, 5, 10, 20, 50, 0.5, 3.5, -1, -2, -5, -10, 231, 526.58];
    for (var i = 0; i < deltas.length && set.length < 4; i++) {
      var v = round2(Math.max(0, c + deltas[i]));
      if (!set.some(function (x) { return nearlyEqual(x, v); })) set.push(v);
    }
    while (set.length < 3) set.push(round2(c + set.length * 11 + 1));
    return shuffle(set);
  }

  function recomputeAnswers() {
    if (!meta) return;
    var periods = drivers.map(function (d) {
      return { weekNo: d.weekNo, gross: d.grossStudent != null ? d.grossStudent : d.gross };
    });
    var card = MathApi.computeUscCard({
      openingCumulativeGross: meta.openingC,
      openingCumulativeUsc: meta.openingK
    }, periods);
    answers = card.rows;
    meta.weekly1 = card.weekly1;
    meta.weekly2 = card.weekly2;
    meta.weekly3 = card.weekly3;
  }

  function generateExercise() {
    var setup = getSetupFromForm();
    var cops = MathApi.weeklyCops();
    var grosses = MathApi.defaultPracticeGrosses(setup.periodCount);
    drivers = [];
    for (var i = 0; i < setup.periodCount; i++) {
      var g = grosses[i];
      drivers.push({
        weekNo: setup.startWeek + i,
        gross: g,
        grossStudent: isGrossPrepopulated(i) ? g : null
      });
    }
    meta = {
      openingC: setup.openingCumulativeGross,
      openingK: setup.openingCumulativeUsc,
      weekly1: cops.rate1,
      weekly2: cops.rate2,
      weekly3: cops.rate3,
      annual1: MathApi.USC_2026.rate1.annualEnd,
      annual2: MathApi.USC_2026.rate2.annualEnd,
      annual3: MathApi.USC_2026.rate3.annualEnd,
      r1: MathApi.USC_2026.rate1.rate,
      r2: MathApi.USC_2026.rate2.rate,
      r3: MathApi.USC_2026.rate3.rate,
      r4: MathApi.USC_2026.rate4.rate
    };
    recomputeAnswers();
    student = answers.map(function (row, rowIdx) {
      var s = {
        _check: {},
        gross: isGrossPrepopulated(rowIdx) ? round2(drivers[rowIdx].gross) : null,
        _prepopulatedGross: isGrossPrepopulated(rowIdx)
      };
      FILL_FIELDS.forEach(function (f) {
        s[f.key] = null;
        s._check[f.key] = null;
      });
      if (s._prepopulatedGross) s._check.gross = true;
      return s;
    });
    closeFormula();
    renderTable();
    flashMsg(
      'Practice generated — 2026 USC, ' + drivers.length + ' week(s) from ' +
      (drivers[0] ? drivers[0].weekNo : '—') +
      '. First ' + Math.min(PREPOP, drivers.length) +
      ' gross pays prepopulated (amended 2026 figures). Fill C–M.'
    );
  }

  function clearAnswers() {
    if (!answers.length) return;
    student = answers.map(function (row, rowIdx) {
      var s = {
        _check: {},
        gross: isGrossPrepopulated(rowIdx) ? round2(drivers[rowIdx].gross) : null,
        _prepopulatedGross: isGrossPrepopulated(rowIdx)
      };
      FILL_FIELDS.forEach(function (f) {
        s[f.key] = null;
        s._check[f.key] = null;
      });
      if (s._prepopulatedGross) s._check.gross = true;
      return s;
    });
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
    }, 8000);
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
    answers.forEach(function (a, i) {
      var s = student[i];
      var d = drivers[i];
      html += '<tr data-usc-row="' + i + '">';
      html += '<td class="ipass-week">' + a.weekNo + '</td>';
      if (isGrossPrepopulated(i)) {
        html += '<td class="ipass-driver practice-cell is-given"><span class="practice-given practice-prepop">' +
          fmt(d.gross) + '</span></td>';
      } else {
        var gCls = 'practice-cell';
        if (active && active.rowIdx === i && active.field === 'gross') gCls += ' is-active';
        if (s._check && s._check.gross === true) gCls += ' is-correct';
        if (s._check && s._check.gross === false) gCls += ' is-wrong';
        if (s.gross == null) gCls += ' is-empty';
        html += '<td class="' + gCls + '">';
        html += '<button type="button" class="practice-cell-btn" data-row="' + i +
          '" data-field="gross">' + (s.gross == null ? '—' : fmt(s.gross)) + '</button></td>';
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
        html += '<button type="button" class="practice-cell-btn" data-row="' + i +
          '" data-field="' + f.key + '">' + display + '</button></td>';
      });
      html += '<td class="practice-check-cell"><button type="button" class="btn btn-secondary btn-sm" data-check-row="' +
        i + '">Check</button></td>';
      html += '</tr>';
    });
    els.tbody.innerHTML = html;
    updateScore();
  }

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
        return evaluateUscOp(op, [a, b]);
      }
    };
  }

  function getFormulaSpec(rowIdx, field) {
    var row = answers[rowIdx];
    var prev = rowIdx > 0 ? answers[rowIdx - 1] : null;
    var d = drivers[rowIdx];
    var m = meta;
    if (!row || !m) return null;

    function copSpec(annualEnd, weekly, result, rateLabel) {
      return {
        op: '×div',
        hint: rateLabel + ' COP = Week No. × (annual end of this rate ÷ 52 weeks). 52 weeks is fixed.',
        result: result,
        slots: [
          { id: 'a', role: 'Week number', correct: round2(row.weekNo) },
          { id: 'b', role: 'Annual end of this USC rate', correct: round2(annualEnd), tone: 2 }
        ],
        evaluate: function (a, b) {
          if (a == null || b == null) return null;
          return evaluateUscOp('×div', [a, b]);
        }
      };
    }

    function bandDueSpec(cumKey, thisCop, prevCop, rate, result, hint) {
      return {
        op: 'bandx',
        hint: hint,
        result: result,
        slots: [
          { id: 'a', role: 'Cumulative gross for USC (C)', correct: row.cumGross },
          { id: 'b', role: 'This rate cumulative COP', correct: thisCop },
          { id: 'c', role: 'Previous rate cumulative COP', correct: prevCop, tone: 3 },
          { id: 'd', role: 'This USC rate', correct: rate, tone: 2 }
        ],
        evaluate: function (a, b, c, d) {
          if (a == null || b == null || c == null || d == null) return null;
          return evaluateUscOp('bandx', [a, b, c, d]);
        }
      };
    }

    switch (field) {
      case 'gross':
        return {
          op: 'id',
          hint: 'Gross pay for USC, week ' + row.weekNo + '. Pick an oval or type an amount. This updates C–M for this row onward.',
          result: round2(d.gross),
          anyValueAcceptable: true,
          slots: [{ id: 'a', role: 'Gross pay for USC this period', correct: round2(d.gross) }],
          evaluate: function (a) { return a == null ? null : round2(a); }
        };
      case 'cumGross':
        return binary(
          '+',
          'Previous cumulative gross (or opening)',
          prev ? prev.cumGross : m.openingC,
          'Gross pay this period',
          d.grossStudent != null ? d.grossStudent : d.gross,
          row.cumGross,
          'C = previous cumulative gross for USC + this period’s gross.'
        );
      case 'cop1':
        return copSpec(m.annual1, m.weekly1, row.cop1, 'Rate 1');
      case 'due1':
        return {
          op: '×min',
          hint: 'Rate 1 due = min(cumulative gross, Rate 1 COP) × 0.5%.',
          result: row.due1,
          slots: [
            { id: 'a', role: 'Cumulative gross for USC (C)', correct: row.cumGross },
            { id: 'b', role: 'Cumulative Rate 1 COP', correct: row.cop1 },
            { id: 'c', role: 'Rate 1 (0.5%)', correct: m.r1 }
          ],
          evaluate: function (a, b, c) {
            if (a == null || b == null || c == null) return null;
            return evaluateUscOp('×min', [a, b, c]);
          }
        };
      case 'cop2':
        return copSpec(m.annual2, m.weekly2, row.cop2, 'Rate 2');
      case 'due2':
        return bandDueSpec('cumGross', row.cop2, row.cop1, m.r2, row.due2,
          'Rate 2 due = max(0, min(C, Rate 2 COP) − Rate 1 COP) × 2%.');
      case 'cop3':
        return copSpec(m.annual3, m.weekly3, row.cop3, 'Rate 3');
      case 'due3':
        return bandDueSpec('cumGross', row.cop3, row.cop2, m.r3, row.due3,
          'Rate 3 due = max(0, min(C, Rate 3 COP) − Rate 2 COP) × 3%.');
      case 'due4':
        return {
          op: 'max0x',
          hint: 'Rate 4 due = max(0, C − Rate 3 COP) × 8%.',
          result: row.due4,
          slots: [
            { id: 'a', role: 'Cumulative gross for USC (C)', correct: row.cumGross },
            { id: 'b', role: 'Cumulative Rate 3 COP', correct: row.cop3 },
            { id: 'c', role: 'Rate 4 (8%)', correct: m.r4 }
          ],
          evaluate: function (a, b, c) {
            if (a == null || b == null || c == null) return null;
            return evaluateUscOp('max0x', [a, b, c]);
          }
        };
      case 'cumUsc':
        return {
          op: 'sum4',
          hint: 'Cumulative USC = Rate 1 due + Rate 2 due + Rate 3 due + Rate 4 due.',
          result: row.cumUsc,
          slots: [
            { id: 'a', role: 'USC due at Rate 1', correct: row.due1 },
            { id: 'b', role: 'USC due at Rate 2', correct: row.due2 },
            { id: 'c', role: 'USC due at Rate 3', correct: row.due3 },
            { id: 'd', role: 'USC due at Rate 4', correct: row.due4 }
          ],
          evaluate: function (a, b, c, d) {
            if (a == null || b == null || c == null || d == null) return null;
            return evaluateUscOp('sum4', [a, b, c, d]);
          }
        };
      case 'deducted':
        return {
          op: 'max0',
          hint: 'USC deducted this period = max(0, this cumulative USC − previous cumulative USC).',
          result: row.deducted,
          slots: [
            { id: 'a', role: 'Cumulative USC this week', correct: row.cumUsc },
            { id: 'b', role: 'Previous cumulative USC (or opening)', correct: prev ? prev.cumUsc : m.openingK }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return evaluateUscOp('max0', [a, b]);
          }
        };
      case 'refunded':
        return {
          op: 'max0',
          hint: 'USC refunded this period = max(0, previous cumulative USC − this cumulative USC). Usually 0 unless YTD USC falls.',
          result: row.refunded,
          slots: [
            { id: 'a', role: 'Previous cumulative USC (or opening)', correct: prev ? prev.cumUsc : m.openingK },
            { id: 'b', role: 'Cumulative USC this week', correct: row.cumUsc }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return evaluateUscOp('max0', [a, b]);
          }
        };
      default:
        return null;
    }
  }

  function formatChip(v) {
    var rateLabel = formatRateLabel(v);
    if (rateLabel === '0.5%' || rateLabel === '2%' || rateLabel === '3%' || rateLabel === '8%') {
      return rateLabel;
    }
    if (Math.abs(v - Math.round(v)) < 1e-9 && Math.abs(v) <= 60) return String(Math.round(v));
    return fmt(v);
  }

  function slotTone(n) {
    return 'slot-tone-' + Math.min(Math.max(n, 1), 4);
  }

  function dropZone(slot, n) {
    var filled = formulaState.filled[slot.id];
    var inner = filled == null
      ? '<span class="drop-placeholder">Drop ' + n + '</span>'
      : '<span class="drop-value">' + formatChip(filled) + '</span>';
    return (
      '<span class="drop-slot ' + slotTone(n) + '" data-slot="' + slot.id + '">' +
      '<span class="drop-num">' + n + '</span>' + inner + '</span>'
    );
  }

  function computeResult() {
    if (!formulaState) return null;
    var spec = formulaState.spec;
    var args = spec.slots.map(function (s) { return formulaState.filled[s.id]; });
    if (args.some(function (a) { return a == null; })) return null;
    return spec.evaluate.apply(null, args);
  }

  function bindCustomChipInputs() {
    if (!els.formulaOperands) return;
    els.formulaOperands.querySelectorAll('.custom-chip-input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        if (!formulaState) return;
        formulaState.customPayInput = inp.value;
        var n = parseOperand(inp.value);
        var chip = inp.closest('.value-chip');
        var prefer = chip ? chip.getAttribute('data-slot-target') || 'a' : 'a';
        if (isFinite(n) && n >= 0) {
          if (chip) chip.setAttribute('data-value', String(storeOperand(n)));
          formulaState.filled[prefer] = storeOperand(n);
        } else {
          if (chip) chip.removeAttribute('data-value');
          formulaState.filled[prefer] = null;
        }
        var result = computeResult();
        if (els.formulaResult) {
          els.formulaResult.textContent = result == null ? '—' : money(result);
          els.formulaResult.classList.toggle('is-ready', result != null);
          els.formulaResult.classList.toggle('is-waiting', result == null);
        }
        if (els.btnPaste) els.btnPaste.disabled = result == null;
        if (els.formulaExpression) {
          var eq = els.formulaExpression.querySelector('.formula-eq-result');
          if (eq) {
            eq.textContent = result == null ? '?' : money(result);
            eq.className = 'formula-eq-result ' + (result == null ? 'is-waiting' : 'is-ready');
          }
        }
      });
      inp.addEventListener('click', function (e) { e.stopPropagation(); });
      inp.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    });
  }

  function renderFormulaUi() {
    if (!formulaState || !els.formulaOperands) return;
    var spec = formulaState.spec;
    var opHtml = '';
    spec.slots.forEach(function (slot, idx) {
      var n = idx + 1;
      var tone = slotTone(slot.tone || n);
      opHtml += '<div class="operand-bank ' + tone + '">';
      opHtml += '<div class="operand-bank-label"><span class="operand-num">' + n + '</span><span>' +
        escapeHtml(slot.role) + (spec.op === '×div' && slot.id === 'b' ? ' (÷ 52 weeks)' : '') +
        '</span></div>';
      opHtml += '<div class="chip-row">';
      (formulaState.choices[slot.id] || []).forEach(function (v) {
        opHtml += '<span class="value-chip ' + tone + '" draggable="true" data-slot-target="' + slot.id +
          '" data-value="' + storeOperand(v) + '">' + formatChip(v) + '</span>';
      });
      if (spec.anyValueAcceptable && idx === 0) {
        var customVal = formulaState.customPayInput != null ? formulaState.customPayInput : '';
        opHtml += '<span class="value-chip value-chip-custom has-band" draggable="true" data-slot-target="' +
          slot.id + '" data-custom-chip="1">' +
          '<label class="custom-chip-label">Your value</label>' +
          '<input type="text" inputmode="decimal" class="custom-chip-input" value="' +
          escapeHtml(customVal) + '" placeholder="e.g. 980.00" /></span>';
      }
      opHtml += '</div></div>';
    });
    els.formulaOperands.innerHTML = opHtml;
    bindCustomChipInputs();

    var result = computeResult();
    var expr = '';
    if (spec.slots.length === 1) {
      expr += dropZone(spec.slots[0], 1) + ' <span class="op-fixed">=</span> ';
    } else if (spec.op === '×div') {
      expr += dropZone(spec.slots[0], 1);
      expr += ' <span class="op-sign op-sign-mul">×</span> ';
      expr += '<span class="op-bracket">(</span>';
      expr += dropZone(spec.slots[1], 2);
      expr += ' <span class="op-sign">÷</span> ';
      expr += '<span class="op-fixed op-const-weeks">52 weeks</span>';
      expr += '<span class="op-bracket">)</span> <span class="op-fixed">=</span> ';
    } else if (spec.op === '×min') {
      expr += '<span class="op-fn-min">min</span><span class="op-bracket">(</span>';
      expr += dropZone(spec.slots[0], 1) + '<span class="op-fixed">,</span>';
      expr += dropZone(spec.slots[1], 2);
      expr += '<span class="op-bracket">)</span>';
      expr += ' <span class="op-sign op-sign-mul">×</span> ';
      expr += dropZone(spec.slots[2], 3);
      expr += ' <span class="op-fixed">=</span> ';
    } else if (spec.op === 'bandx') {
      expr += '<span class="op-fn-min">max</span><span class="op-bracket">(</span>0<span class="op-fixed">,</span> ';
      expr += '<span class="op-fn-min">min</span><span class="op-bracket">(</span>';
      expr += dropZone(spec.slots[0], 1) + '<span class="op-fixed">,</span>';
      expr += dropZone(spec.slots[1], 2);
      expr += '<span class="op-bracket">)</span> <span class="op-sign">−</span> ';
      expr += dropZone(spec.slots[2], 3);
      expr += '<span class="op-bracket">)</span> <span class="op-sign op-sign-mul">×</span> ';
      expr += dropZone(spec.slots[3], 4);
      expr += ' <span class="op-fixed">=</span> ';
    } else if (spec.op === 'max0x') {
      expr += '<span class="op-fn-min">max</span><span class="op-bracket">(</span>0<span class="op-fixed">,</span> ';
      expr += dropZone(spec.slots[0], 1);
      expr += ' <span class="op-sign">−</span> ';
      expr += dropZone(spec.slots[1], 2);
      expr += '<span class="op-bracket">)</span> <span class="op-sign op-sign-mul">×</span> ';
      expr += dropZone(spec.slots[2], 3);
      expr += ' <span class="op-fixed">=</span> ';
    } else if (spec.op === 'max0') {
      expr += '<span class="op-fn-min">max</span><span class="op-bracket">(</span>0<span class="op-fixed">,</span> ';
      expr += dropZone(spec.slots[0], 1);
      expr += ' <span class="op-sign">−</span> ';
      expr += dropZone(spec.slots[1], 2);
      expr += '<span class="op-bracket">)</span> <span class="op-fixed">=</span> ';
    } else if (spec.op === 'sum4') {
      expr += dropZone(spec.slots[0], 1) + ' <span class="op-sign">+</span> ';
      expr += dropZone(spec.slots[1], 2) + ' <span class="op-sign">+</span> ';
      expr += dropZone(spec.slots[2], 3) + ' <span class="op-sign">+</span> ';
      expr += dropZone(spec.slots[3], 4) + ' <span class="op-fixed">=</span> ';
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

  function openFormula(rowIdx, field) {
    if (field === 'gross' && isGrossPrepopulated(rowIdx)) return;
    var spec = getFormulaSpec(rowIdx, field);
    if (!spec) return;
    active = { rowIdx: rowIdx, field: field };
    formulaState = { spec: spec, filled: {}, choices: {}, customPayInput: '' };
    if (field === 'gross' && student[rowIdx] && student[rowIdx].gross != null) {
      formulaState.customPayInput = String(student[rowIdx].gross);
    }
    spec.slots.forEach(function (slot) {
      formulaState.filled[slot.id] = null;
      formulaState.choices[slot.id] = choiceSet(slot.correct);
    });
    var titleField = FILL_FIELDS.find(function (f) { return f.key === field; });
    var titleLabel = titleField ? titleField.label : (field === 'gross' ? 'Gross Pay for USC this period' : field);
    if (els.formulaTitle) {
      els.formulaTitle.textContent = 'Week ' + answers[rowIdx].weekNo + ' — ' + titleLabel;
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
    if (els.workspace) els.workspace.hidden = true;
    if (els.formulaOperands) els.formulaOperands.innerHTML = '';
    if (els.formulaExpression) els.formulaExpression.innerHTML = '';
    renderTable();
  }

  function pasteResult() {
    if (!active || !formulaState) return;
    var result = computeResult();
    if (result == null) return;
    var field = active.field;
    var rowIdx = active.rowIdx;
    if (field === 'gross') {
      student[rowIdx].gross = result;
      student[rowIdx]._check.gross = true;
      if (drivers[rowIdx]) {
        drivers[rowIdx].grossStudent = result;
        drivers[rowIdx].gross = result;
      }
      for (var r = rowIdx; r < student.length; r++) {
        FILL_FIELDS.forEach(function (f) {
          student[r][f.key] = null;
          student[r]._check[f.key] = null;
        });
      }
      recomputeAnswers();
      if (els.formulaStatus) {
        els.formulaStatus.textContent = 'Gross set to ' + money(result) + '. C–M recalculated.';
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

  function printRatesTable() {
    if (typeof PayeLabPrint === 'undefined') return;
    PayeLabPrint.printTable({
      title: 'USC Lab — 2026 USC thresholds',
      meta: 'Standard (non-reduced) USC · exemption below €13,000 annual · Generated ' +
        new Date().toLocaleString('en-IE'),
      table: document.getElementById('usc-rates-table')
    });
  }

  function printPracticeTable() {
    if (typeof PayeLabPrint === 'undefined') return;
    var setup = getSetupFromForm();
    var extras = '';
    if (els.scoreBar && !els.scoreBar.hidden) {
      extras += '<div><span>Cells correct</span><strong>' + (els.scoreCells ? els.scoreCells.textContent : '') + '</strong></div>';
      extras += '<div><span>Rows fully correct</span><strong>' + (els.scoreRows ? els.scoreRows.textContent : '') + '</strong></div>';
    }
    PayeLabPrint.printTable({
      title: 'USC Lab — Cumulative USC Deduction Card',
      meta: '2026 standard USC · Start week ' + setup.startWeek +
        ' · Opening cum. gross ' + money(setup.openingCumulativeGross) +
        ' · Opening cum. USC ' + money(setup.openingCumulativeUsc) +
        ' · Generated ' + new Date().toLocaleString('en-IE'),
      table: document.getElementById('usc-practice-table'),
      dropLastColumn: true,
      extrasHtml: extras
    });
  }

  if (els.ratesPrint) els.ratesPrint.addEventListener('click', printRatesTable);
  if (els.btnBuild) els.btnBuild.addEventListener('click', generateExercise);
  if (els.btnClear) els.btnClear.addEventListener('click', clearAnswers);
  if (els.btnCheckAll) els.btnCheckAll.addEventListener('click', checkAll);
  if (els.btnPrint) els.btnPrint.addEventListener('click', printPracticeTable);
  if (els.btnClose) els.btnClose.addEventListener('click', closeFormula);
  if (els.btnPaste) els.btnPaste.addEventListener('click', pasteResult);
  if (els.btnClearSlots) {
    els.btnClearSlots.addEventListener('click', function () {
      if (!formulaState) return;
      Object.keys(formulaState.filled).forEach(function (k) { formulaState.filled[k] = null; });
      renderFormulaUi();
    });
  }

  if (els.openingK) {
    els.openingK.addEventListener('input', function () { openingKManual = true; });
  }
  if (els.openingC) {
    els.openingC.addEventListener('change', function () {
      if (!openingKManual) getSetupFromForm();
    });
  }
  if (els.startWeek) {
    els.startWeek.addEventListener('change', function () {
      if (!openingKManual) getSetupFromForm();
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
      if (btn) openFormula(parseInt(btn.getAttribute('data-row'), 10), btn.getAttribute('data-field'));
    });
  }

  document.addEventListener('dragstart', function (e) {
    var chip = e.target.closest('#usc-formula-operands .value-chip');
    if (!chip || !formulaState) return;
    if (e.target.closest('.custom-chip-input')) return;
    var val = parseOperand(chip.getAttribute('data-value') || chip.textContent);
    if (val == null && chip.getAttribute('data-custom-chip')) {
      var inp = chip.querySelector('.custom-chip-input');
      val = inp ? parseOperand(inp.value) : null;
    }
    if (val == null) return;
    dragValue = { value: val, preferSlot: chip.getAttribute('data-slot-target') };
    try {
      e.dataTransfer.setData('text/plain', String(val));
      e.dataTransfer.effectAllowed = 'copy';
    } catch (err) { /* ignore */ }
  });

  if (els.formulaExpression) {
    els.formulaExpression.addEventListener('dragover', function (e) {
      if (formulaState) e.preventDefault();
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
      var val = dragValue ? dragValue.value : parseOperand(e.dataTransfer.getData('text/plain'));
      var prefer = dragValue ? dragValue.preferSlot : null;
      if (prefer && prefer !== slotId) {
        if (els.formulaStatus) els.formulaStatus.textContent = 'Use a matching colour oval for that box.';
        return;
      }
      if (val == null) return;
      formulaState.filled[slotId] = storeOperand(val);
      renderFormulaUi();
    });
  }

  if (els.formulaOperands) {
    els.formulaOperands.addEventListener('click', function (e) {
      if (e.target.closest('.custom-chip-input')) return;
      var chip = e.target.closest('.value-chip');
      if (!chip || !formulaState) return;
      var val = parseOperand(chip.getAttribute('data-value') || chip.textContent);
      var prefer = chip.getAttribute('data-slot-target');
      if (val == null && chip.getAttribute('data-custom-chip')) {
        var inp = chip.querySelector('.custom-chip-input');
        val = inp ? parseOperand(inp.value) : null;
      }
      if (val == null) return;
      if (prefer) {
        formulaState.filled[prefer] = storeOperand(val);
        renderFormulaUi();
      }
    });
  }

  renderRatesTable();
  syncRateStrip();
  getSetupFromForm();

  if (document.body.classList.contains('level-usc')) {
    if (location.hash === '#usc-practice') {
      window.setTimeout(function () {
        if (window.UscLab && window.UscLab.onShowPractice) window.UscLab.onShowPractice();
      }, 0);
    } else {
      renderRatesTable();
      syncRateStrip();
    }
  }

  window.UscLab = {
    renderRatesTable: renderRatesTable,
    generateExercise: generateExercise,
    getSetupFromForm: getSetupFromForm,
    onShowRates: function () {
      renderRatesTable();
      syncRateStrip();
    },
    onShowPractice: function () {
      syncRateStrip();
      getSetupFromForm();
      if (!answers.length) generateExercise();
      else renderTable();
    }
  };
})();
