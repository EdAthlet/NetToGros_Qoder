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

  /** Student fills these (drivers are pre-filled and locked). */
  var FILL_FIELDS = [
    { key: 'cumTaxable', label: 'D Cumulative Taxable Pay', col: 'D' },
    { key: 'cumSrcop', label: 'E Cumulative SRCOP', col: 'E' },
    { key: 'cumHigher', label: 'F Cum. taxable at Higher Rate', col: 'F' },
    { key: 'cumTaxStd', label: 'G Cum. Tax due at Standard Rate', col: 'G' },
    { key: 'cumTaxHigh', label: 'H Cum. Tax due at Higher Rate', col: 'H' },
    { key: 'cumGrossTax', label: 'I Cumulative Gross tax', col: 'I' },
    { key: 'cumTc', label: 'J Cumulative Tax Credit', col: 'J' },
    { key: 'cumTaxDue', label: 'K Cumulative tax due', col: 'K' },
    { key: 'taxDeducted', label: 'L Tax deducted this period', col: 'L' },
    { key: 'taxRefunded', label: 'M Tax refunded this period', col: 'M' },
    { key: 'prsiEe', label: 'N EE PRSI', col: 'N' },
    { key: 'prsiEr', label: 'O ER PRSI', col: 'O' }
  ];

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

  function generateExercise() {
    var setup = Ipass.getSetup ? Ipass.getSetup() : {
      annualTc: 3300,
      annualSrcop: 35300,
      periodsPerYear: 52,
      rateStd: 0.2,
      rateHigh: 0.4,
      prsiEeRate: 0.04,
      prsiErRate: 0.1095
    };
    // Prefer sample-style mid-year card
    var open = Ipass.sampleBryanWallaceOpening();
    setup.openingCumulativeTaxable = open.openingCumulativeTaxable;
    setup.openingCumulativeTaxDue = open.openingCumulativeTaxDue;
    setup.annualTc = 3300;
    setup.annualSrcop = 35300;
    setup.weeklyTc = 63.47;
    setup.weeklySrcop = 678.85;

    drivers = Ipass.sampleBryanWallacePeriods().map(function (p) {
      return {
        weekNo: p.weekNo,
        gross: p.gross,
        pension: 0,
        taxable: p.gross
      };
    });

    var card = Ipass.computeCard(setup, drivers);
    meta = {
      weeklyTc: card.weeklyTc,
      weeklySrcop: card.weeklySrcop,
      rateStd: 0.2,
      rateHigh: 0.4,
      prsiEeRate: 0.04,
      prsiErRate: 0.1095,
      openingD: setup.openingCumulativeTaxable,
      openingK: setup.openingCumulativeTaxDue
    };
    answers = card.rows;
    student = answers.map(function () {
      var s = { _check: {} };
      FILL_FIELDS.forEach(function (f) {
        s[f.key] = null;
        s._check[f.key] = null;
      });
      return s;
    });
    closeFormula();
    renderTable();
    flashMsg('New IPASS practice generated — fill cumulative columns (D–O).');
  }

  function clearAnswers() {
    if (!answers.length) return;
    student = answers.map(function () {
      var s = { _check: {} };
      FILL_FIELDS.forEach(function (f) {
        s[f.key] = null;
        s._check[f.key] = null;
      });
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
      html += '<tr>';
      html += '<td class="ipass-week">' + a.weekNo + '</td>';
      html += '<td class="ipass-driver">' + fmt(d.gross) + '</td>';
      html += '<td class="ipass-driver">' + fmt(d.taxable) + '</td>';
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
        return binary(
          '×',
          'Week number (A)',
          row.weekNo,
          'Weekly SRCOP (annual SRCOP ÷ 52)',
          m.weeklySrcop,
          row.cumSrcop,
          'E = Week No. × weekly SRCOP. Weekly SRCOP = annual SRCOP ÷ 52.'
        );
      case 'cumHigher':
        return {
          op: 'max0',
          hint: 'F = max(0, cumulative taxable pay D − cumulative SRCOP E).',
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
          hint: 'G = min(D, E) × 20% standard rate.',
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
          'Cumulative taxable at higher rate (F)',
          row.cumHigher,
          'Higher rate 40%',
          0.4,
          row.cumTaxHigh,
          'H = F × 40%.'
        );
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
    var spec = getFormulaSpec(rowIdx, field);
    if (!spec) return;
    active = { rowIdx: rowIdx, field: field };
    formulaState = { spec: spec, filled: {}, choices: {} };
    spec.slots.forEach(function (slot) {
      formulaState.filled[slot.id] = null;
      formulaState.choices[slot.id] = choiceSet(slot.correct);
    });
    if (els.formulaTitle) {
      els.formulaTitle.textContent =
        'Week ' + answers[rowIdx].weekNo + ' — ' + (FILL_FIELDS.find(function (f) { return f.key === field; }) || {}).label;
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

  function renderFormulaUi() {
    if (!formulaState || !els.formulaOperands) return;
    var spec = formulaState.spec;
    var opHtml = '';
    spec.slots.forEach(function (slot, idx) {
      var n = idx + 1;
      var tone = slotTone(n);
      opHtml += '<div class="operand-bank ' + tone + '">';
      opHtml += '<div class="operand-bank-label"><span class="operand-num">' + n + '</span><span>' +
        escapeHtml(slot.role) + '</span></div>';
      opHtml += '<div class="chip-row">';
      (formulaState.choices[slot.id] || []).forEach(function (v) {
        opHtml += '<span class="value-chip ' + tone + '" draggable="true" data-slot-target="' + slot.id +
          '" data-value="' + v + '">' + formatChip(v) + '</span>';
      });
      opHtml += '</div></div>';
    });
    els.formulaOperands.innerHTML = opHtml;

    var result = computeResult();
    var expr = '';
    if (spec.slots.length === 1) {
      expr += dropZone(spec.slots[0], 1) + ' <span class="op-fixed">=</span> ';
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
    var inner = filled == null
      ? '<span class="drop-placeholder">Drop ' + n + '</span>'
      : '<span class="drop-value">' + formatChip(filled) + '</span>';
    return (
      '<span class="drop-slot ' + tone + '" data-slot="' + slot.id + '">' +
      '<span class="drop-num">' + n + '</span>' + inner + '</span>'
    );
  }

  function formatChip(v) {
    if (nearlyEqual(v, 0.2)) return '0.20';
    if (nearlyEqual(v, 0.4)) return '0.40';
    if (nearlyEqual(v, 0.04)) return '0.04';
    if (Math.abs(v - Math.round(v)) < 1e-9 && Math.abs(v) <= 60) return String(Math.round(v));
    return fmt(v);
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

  function pasteResult() {
    if (!active || !formulaState) return;
    var result = computeResult();
    if (result == null) return;
    student[active.rowIdx][active.field] = result;
    student[active.rowIdx]._check[active.field] = null;
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
    var val = parseFloat(chip.getAttribute('data-value'));
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
      var chip = e.target.closest('.value-chip');
      if (!chip || !formulaState) return;
      var val = parseFloat(chip.getAttribute('data-value'));
      var prefer = chip.getAttribute('data-slot-target');
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
