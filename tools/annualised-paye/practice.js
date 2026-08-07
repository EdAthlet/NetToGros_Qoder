/**
 * PAYE Lab — Practice mode: empty worksheet + drag-and-drop formula builder.
 */
(function () {
  'use strict';

  var Core = window.PayeLabCore;
  if (!Core) {
    console.error('PayeLabCore missing — load app.js first');
    return;
  }

  var PRACTICE_FIELDS = [
    { key: 'period', label: 'Period', given: true },
    { key: 'annualisedTc', label: 'TC remained till year end' },
    { key: 'periodTc', label: 'Period TC' },
    { key: 'taxablePay', label: 'Taxable pay', given: true },
    { key: 'annualisedCop', label: 'Annualised COP' },
    { key: 'periodCop', label: 'Period COP' },
    { key: 'taxable20', label: 'Taxable@20%' },
    { key: 'taxable40', label: 'Taxable@40%' },
    { key: 'paye20', label: 'PAYE 20%' },
    { key: 'paye40', label: 'PAYE 40%' },
    { key: 'totalPaye', label: 'Total PAYE' },
    { key: 'appliedTc', label: 'Applied TC' },
    { key: 'netTax', label: 'Net tax' },
    { key: 'tcLeftAfter', label: 'TC left' }
  ];

  var els = {
    tbody: document.getElementById('practice-rows'),
    empty: document.getElementById('practice-empty'),
    workspace: document.getElementById('formula-workspace'),
    formulaTitle: document.getElementById('formula-title'),
    formulaHint: document.getElementById('formula-hint'),
    formulaOperands: document.getElementById('formula-operands'),
    formulaExpression: document.getElementById('formula-expression'),
    formulaResult: document.getElementById('formula-result-value'),
    formulaStatus: document.getElementById('formula-status'),
    btnPaste: document.getElementById('btn-formula-paste'),
    btnClearSlots: document.getElementById('btn-formula-clear-slots'),
    btnClose: document.getElementById('btn-formula-close'),
    btnBuild: document.getElementById('btn-practice-build'),
    btnClear: document.getElementById('btn-practice-clear'),
    btnCheckAll: document.getElementById('btn-practice-check-all'),
    generateMsg: document.getElementById('practice-generate-msg'),
    scoreBar: document.getElementById('practice-score-bar'),
    scoreCells: document.getElementById('practice-score-cells'),
    scoreRows: document.getElementById('practice-score-rows')
  };

  var generateFlashTimer = null;
  var generateMsgTimer = null;

  /** @type {Array<Object>} answer key */
  var answers = [];
  /** @type {Array<Object>} student values (null = empty) */
  var student = [];
  /** @type {Object|null} row check marks: student[i]._check[field] = true|false|null */
  var active = null; // { rowIdx, field }
  var formulaState = null; // current formula builder state
  var dragValue = null;

  function money(n) {
    return Core.money(n);
  }

  function fmt(n) {
    return Core.fmt(n);
  }

  function round2(n) {
    return Core.round2(n);
  }

  function nearlyEqual(a, b) {
    return Math.abs(round2(a) - round2(b)) < 0.015;
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

  /**
   * Integer choices for prior-period counts (and similar).
   * Does not include products of period×TC — only nearby whole counts.
   */
  function integerChoiceSet(correct) {
    var c = Math.round(correct);
    var set = [c];
    var candidates = [c - 2, c - 1, c + 1, c + 2, c - 3, c + 3, Math.max(1, c - 4), c + 5];
    for (var i = 0; i < candidates.length && set.length < 4; i++) {
      var v = candidates[i];
      if (v < 1) continue;
      if (set.indexOf(v) === -1) set.push(v);
    }
    while (set.length < 3) set.push(c + set.length + 7);
    return shuffle(set);
  }

  /**
   * Build distractors near correct value (default 2 unique wrong + correct).
   */
  function choiceSet(correct, spreadHints, count) {
    var need = count || 3;
    var c = round2(correct);
    var set = [c];
    var attempts = 0;
    var hints = spreadHints || [0.05, 0.1, 0.15, 0.25, 5, 10, 50, 100];
    while (set.length < need && attempts < 60) {
      attempts++;
      var hint = hints[attempts % hints.length];
      var sign = attempts % 2 === 0 ? 1 : -1;
      var noise = (Math.random() * hint) + (hint * 0.2);
      var v = round2(c + sign * noise);
      if (v < 0) v = round2(Math.abs(v));
      var dup = set.some(function (x) { return nearlyEqual(x, v); });
      if (!dup) set.push(v);
    }
    while (set.length < need) {
      set.push(round2(c + set.length * 7.5 + 1));
    }
    return shuffle(set);
  }

  /**
   * Taxable pay samples across COP / tax-credit bands (for exercise generation + chips).
   * periodCop and periodTcApprox shape where PAYE sits vs credit.
   */
  function bandedTaxablePayOptions(periodCop, periodTcApprox) {
    var cop = Math.max(periodCop, 1);
    var ptc = Math.max(periodTcApprox, 1);
    // Gross PAYE ≈ pay×20% when pay ≤ COP → tax < credit when pay < ptc/0.2
    var creditBreakEven = ptc / 0.2;
    var opts = [
      {
        value: round2(Math.max(40, cop * 0.12)),
        band: 'Low · under COP · tax usually < credit'
      },
      {
        value: round2(Math.min(cop * 0.45, creditBreakEven * 0.55)),
        band: 'Mid-low · under COP · smaller tax vs credit'
      },
      {
        value: round2(Math.min(cop * 0.72, Math.max(creditBreakEven * 0.85, cop * 0.5))),
        band: 'Under COP · near credit break-even'
      },
      {
        value: round2(cop * 0.92),
        band: 'Just under period COP (all @20%)'
      },
      {
        value: round2(cop),
        band: 'At period COP (top of 20% band)'
      },
      {
        value: round2(cop * 1.12),
        band: 'Just over COP (into 40% band)'
      },
      {
        value: round2(cop * 1.55),
        band: 'Over COP · larger gross tax'
      },
      {
        value: round2(cop * 2.2),
        band: 'High · 40% band · tax usually > credit'
      },
      {
        value: round2(Math.max(cop * 2.8, creditBreakEven * 1.4)),
        band: 'Very high · tests credit cap'
      }
    ];
    // Deduplicate near-equal values
    var out = [];
    opts.forEach(function (o) {
      if (o.value <= 0) return;
      var dup = out.some(function (x) { return nearlyEqual(x.value, o.value); });
      if (!dup) out.push(o);
    });
    return out;
  }

  /**
   * Rich choice list for the Taxable pay cell: many band samples + correct period value.
   * Returns { value, band? }[]
   */
  function taxablePayChoiceBank(row) {
    var m = row._meta || {};
    var cop = row.periodCop || (m.setupAnnualCop / (m.schedule || 52));
    var ptc = row.periodTc || ((m.setupAnnualTc || 4000) / (m.schedule || 52));
    var bank = bandedTaxablePayOptions(cop, ptc);
    var correct = round2(row.taxablePay);
    var hasCorrect = bank.some(function (o) { return nearlyEqual(o.value, correct); });
    if (!hasCorrect) {
      bank.push({
        value: correct,
        band: 'This period’s sample pay'
      });
    }
    // Ensure we have a good spread (at least 7 chips when possible)
    return shuffle(bank);
  }

  /**
   * Assign each practice period a taxable pay from a different band pattern.
   */
  function buildExerciseTaxablePays(count, annualCop, annualTc, schedule) {
    var periodCop = annualCop / schedule;
    var periodTcApprox = annualTc / schedule;
    var bank = bandedTaxablePayOptions(periodCop, periodTcApprox);
    if (!bank.length) {
      return Array.apply(null, Array(count)).map(function () { return 1000; });
    }
    // Cycle through band patterns so successive periods train different COP / credit cases
    var pattern = [0, 3, 5, 1, 6, 2, 7, 4, 8];
    var pays = [];
    for (var i = 0; i < count; i++) {
      var idx = pattern[i % pattern.length] % bank.length;
      // Slight unique jitter so two periods rarely share the exact same amount
      var base = bank[idx].value;
      var jitter = round2((i % 5) * 3.25);
      pays.push(round2(Math.max(10, base + (i % 2 === 0 ? jitter : -jitter * 0.5))));
    }
    return pays;
  }

  /**
   * Formula spec for a cell — op, slots with correct values, labels, evaluate.
   */
  function getFormulaSpec(rowIdx, field) {
    var row = answers[rowIdx];
    if (!row) return null;
    var prev = rowIdx > 0 ? answers[rowIdx - 1] : null;
    var m = row._meta || {};

    function binary(op, opSymbol, leftLabel, leftVal, rightLabel, rightVal, result, hint) {
      return {
        op: op,
        opSymbol: opSymbol,
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
          if (op === 'max') return round2(Math.max(0, a - b)); // max(0, a-b) for taxable40 style
          return null;
        }
      };
    }

    function unary(label, val, result, hint) {
      return {
        op: 'id',
        opSymbol: '',
        hint: hint,
        result: round2(result),
        slots: [{ id: 'a', role: label, correct: round2(val) }],
        evaluate: function (a) {
          return a == null ? null : round2(a);
        }
      };
    }

    switch (field) {
      case 'period':
        return unary('Period number', row.period, row.period,
          'Period is the pay-period index in the tax year (given for this exercise).');

      case 'taxablePay':
        return {
          op: 'id',
          opSymbol: '',
          hint:
            'Taxable pay is arbitrary for this exercise — not a real wage. ' +
            'Pick this period’s sample amount from the chips (options span under/over the period COP and ' +
            'cases where gross tax is smaller or larger than the period tax credit).',
          result: round2(row.taxablePay),
          slots: [{ id: 'a', role: 'Taxable pay for this period', correct: round2(row.taxablePay) }],
          choiceMode: 'taxablePayBands',
          evaluate: function (a) {
            return a == null ? null : round2(a);
          }
        };

      case 'annualisedTc':
        // Mid-year start: do NOT offer the pre-multiplied total — student must
        // build (prior periods × flat period TC) then subtract from annual TC.
        if (!prev && m.evenPriorOpening && m.priorPeriodsEven > 0) {
          var priorN = m.priorPeriodsEven;
          var flatTc = round2(m.flatPeriodTc);
          var usedTotal = round2(priorN * flatTc);
          return {
            op: 'minusProduct',
            opSymbol: '−',
            hint:
              'Start period is not 1. Preceding payrolls (period 1 through period ' + priorN +
              ') are assumed to have used the flat period tax credit evenly. ' +
              'Quest: (1) count those prior periods (including period 1), (2) multiply by the flat period TC ' +
              '(annual TC ÷ periods in year) to get total TC assumed used — do not pick that total from a list, ' +
              'build it with × — then (3) annual TC − that product = TC remained till year end at this start period. ' +
              'Example weekly: start 10 → 9 × (4000÷52), then 4000 − that product.',
            result: round2(row.annualisedTc),
            productResult: usedTotal,
            slots: [
              {
                id: 'a',
                role: 'Annual tax credit at period 1 (full year)',
                correct: round2(m.setupAnnualTc)
              },
              {
                id: 'b',
                role: 'Prior periods count (start − 1, includes period 1)',
                correct: priorN,
                integerChoices: true
              },
              {
                id: 'c',
                role: 'Flat period TC assumed used each prior period (annual ÷ periods/year)',
                correct: flatTc
              }
            ],
            evaluate: function (a, b, c) {
              if (a == null || b == null || c == null) return null;
              return round2(a - b * c);
            },
            evaluateProduct: function (b, c) {
              if (b == null || c == null) return null;
              return round2(b * c);
            }
          };
        }
        if (!prev) {
          return unary('Opening annual tax credit', m.setupAnnualTc, row.annualisedTc,
            'Period 1: TC remained till year end is the full setup annual tax credit.');
        }
        return binary('-', '−',
          'Previous TC remained (minuend)', prev.annualisedTc,
          'Previous applied TC (subtrahend)', prev.appliedTc,
          row.annualisedTc,
          'TC remained at start of this period = previous period’s TC remained − previous applied tax credit.');

      case 'periodTc':
        return binary('÷', '÷',
          'TC remained till year end', row.annualisedTc,
          'Periods left in year', m.periodsLeft,
          row.periodTc,
          'Period tax credit = TC remained till year end ÷ periods still left in the year.');

      case 'annualisedCop':
        return unary('Annual COP / SRCOP', m.setupAnnualCop, row.annualisedCop,
          'Annualised COP is the full annual standard-rate cut-off (week‑1 basis — does not reduce each period).');

      case 'periodCop':
        return binary('÷', '÷',
          'Annualised COP', row.annualisedCop,
          'Periods in year', m.schedule,
          row.periodCop,
          'Period COP = annualised COP ÷ number of periods in the year.');

      case 'taxable20':
        return binary('min', 'min',
          'Taxable pay', row.taxablePay,
          'Period COP', row.periodCop,
          row.taxable20,
          'Taxable at 20% = the smaller of taxable pay and period COP.');

      case 'taxable40':
        // max(0, pay - cop) — show as minuend − subtrahend with floor at 0
        return {
          op: 'max0sub',
          opSymbol: '−',
          hint: 'Taxable at 40% = max(0, taxable pay − period COP).',
          result: row.taxable40,
          slots: [
            { id: 'a', role: 'Taxable pay (minuend)', correct: row.taxablePay },
            { id: 'b', role: 'Period COP (subtrahend)', correct: row.periodCop }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(Math.max(0, a - b));
          }
        };

      case 'paye20':
        return binary('×', '×',
          'Taxable@20%', row.taxable20,
          'Rate 20%', 0.2,
          row.paye20,
          'PAYE at 20% = Taxable@20% × 0.20.');

      case 'paye40':
        return binary('×', '×',
          'Taxable@40%', row.taxable40,
          'Rate 40%', 0.4,
          row.paye40,
          'PAYE at 40% = Taxable@40% × 0.40.');

      case 'totalPaye':
        return binary('+', '+',
          'PAYE 20%', row.paye20,
          'PAYE 40%', row.paye40,
          row.totalPaye,
          'Total (gross) PAYE = PAYE 20% + PAYE 40%.');

      case 'appliedTc':
        return binary('min', 'min',
          'Period TC', row.periodTc,
          'Total PAYE', row.totalPaye,
          row.appliedTc,
          'Applied tax credit = the smaller of period TC and total PAYE (credit cannot exceed tax due).');

      case 'netTax':
        return binary('-', '−',
          'Total PAYE (minuend)', row.totalPaye,
          'Applied TC (subtrahend)', row.appliedTc,
          row.netTax,
          'Net tax = total PAYE − applied tax credit.');

      case 'tcLeftAfter':
        return binary('-', '−',
          'TC remained at start (minuend)', row.annualisedTc,
          'Applied TC (subtrahend)', row.appliedTc,
          row.tcLeftAfter,
          'TC left after this period = TC remained at start − applied TC. This becomes next period’s TC remained till year end.');

      default:
        return null;
    }
  }

  function fieldLabel(field) {
    for (var i = 0; i < PRACTICE_FIELDS.length; i++) {
      if (PRACTICE_FIELDS[i].key === field) return PRACTICE_FIELDS[i].label;
    }
    return field;
  }

  function flashGenerateFeedback(fromUserClick) {
    // Only flash when the student explicitly generates (not auto on first tab open)
    if (!fromUserClick) return;

    if (els.btnBuild) {
      els.btnBuild.classList.add('is-just-generated');
      els.btnBuild.textContent = 'Exercise generated';
      if (generateFlashTimer) clearTimeout(generateFlashTimer);
      generateFlashTimer = setTimeout(function () {
        els.btnBuild.classList.remove('is-just-generated');
        els.btnBuild.textContent = 'Generate practice exercise';
        generateFlashTimer = null;
      }, 2000);
    }

    if (els.generateMsg) {
      var n = answers.length;
      els.generateMsg.hidden = false;
      els.generateMsg.textContent =
        'New exercise generated for the student — ' + n +
        ' period' + (n === 1 ? '' : 's') +
        '. Click a cell to start building figures.';
      if (generateMsgTimer) clearTimeout(generateMsgTimer);
      generateMsgTimer = setTimeout(function () {
        els.generateMsg.hidden = true;
        els.generateMsg.textContent = '';
        generateMsgTimer = null;
      }, 4000);
    }
  }

  function generateExercise(fromUserClick) {
    var setup = Core.getSetup();
    var taxablePays = buildExerciseTaxablePays(
      setup.periodCount,
      setup.annualCop,
      setup.annualTc,
      setup.schedule
    );
    answers = Core.buildAnswerKey({
      annualTc: setup.annualTc,
      annualCop: setup.annualCop,
      schedule: setup.schedule,
      frequencyLabel: setup.frequencyLabel,
      startPeriod: setup.startPeriod,
      taxablePays: taxablePays
    });
    student = answers.map(function (row) {
      var s = { period: row.period, _check: {} };
      PRACTICE_FIELDS.forEach(function (f) {
        if (f.key === 'period') {
          s.period = row.period;
        } else if (f.given && f.key === 'taxablePay') {
          // Leave empty so student must paste given value via formula (or we could prefill)
          s[f.key] = null;
        } else {
          s[f.key] = null;
        }
        s._check[f.key] = null;
      });
      return s;
    });
    closeFormula();
    renderPracticeTable();
    updateScore();
    flashGenerateFeedback(!!fromUserClick);
  }

  function clearStudentAnswers() {
    if (!answers.length) return;
    student = answers.map(function (row) {
      var s = { period: row.period, _check: {} };
      PRACTICE_FIELDS.forEach(function (f) {
        if (f.key === 'period') s.period = row.period;
        else s[f.key] = null;
        s._check[f.key] = null;
      });
      return s;
    });
    closeFormula();
    renderPracticeTable();
    updateScore();
  }

  function practiceGapRowsHtml() {
    if (!answers.length) return '';
    var m0 = answers[0]._meta || {};
    var startP = m0.tableStartPeriod || answers[0].period || 1;
    if (startP <= 1) return '';
    var annual = m0.setupAnnualTc;
    var flat = m0.flatPeriodTc != null ? m0.flatPeriodTc : Core.flatPeriodTc(annual, m0.schedule);
    var html = '';
    html += '<tr class="gap-context-row gap-period1">';
    html += '<td class="gap-cell"><span class="gap-muted">1</span></td>';
    html += '<td class="gap-cell"><span class="gap-muted">' + fmt(annual) + '</span></td>';
    html += '<td class="gap-cell"><span class="gap-muted">' + fmt(flat) + '</span></td>';
    for (var g = 0; g < 10; g++) {
      html += '<td class="gap-cell"><span class="gap-muted">—</span></td>';
    }
    html += '<td class="gap-cell"><span class="gap-muted">' + fmt(annual - flat) + '</span></td>';
    html += '<td class="practice-check-cell"></td>';
    html += '</tr>';
    if (startP > 2) {
      html += '<tr class="gap-ellipsis-row">';
      html += '<td colspan="15" class="gap-ellipsis-cell">';
      html += '<span class="gap-dots">· · ·</span>';
      html += '<span class="gap-ellipsis-label">periods 2–' + (startP - 1) +
        ' (even period TC × ' + (startP - 1) + ' assumed used)</span>';
      html += '</td></tr>';
    }
    return html;
  }

  function renderPracticeTable() {
    if (!els.tbody) return;
    if (!answers.length) {
      els.tbody.innerHTML = '';
      if (els.empty) els.empty.hidden = false;
      if (els.scoreBar) els.scoreBar.hidden = true;
      return;
    }
    if (els.empty) els.empty.hidden = true;
    if (els.scoreBar) els.scoreBar.hidden = false;

    var html = practiceGapRowsHtml();
    for (var i = 0; i < answers.length; i++) {
      var s = student[i];
      html += '<tr data-practice-row="' + i + '">';
      PRACTICE_FIELDS.forEach(function (f) {
        var val = s[f.key];
        var check = s._check[f.key];
        var cls = 'practice-cell';
        if (f.key === 'period') cls += ' is-given';
        if (active && active.rowIdx === i && active.field === f.key) cls += ' is-active';
        if (check === true) cls += ' is-correct';
        if (check === false) cls += ' is-wrong';
        if (val == null && f.key !== 'period') cls += ' is-empty';

        var display = f.key === 'period'
          ? String(s.period)
          : (val == null ? '' : fmt(val));

        html += '<td class="' + cls + '">';
        if (f.key === 'period') {
          html += '<span class="practice-given" data-row="' + i + '" data-field="period">' + display + '</span>';
        } else {
          html += '<button type="button" class="practice-cell-btn" data-row="' + i + '" data-field="' + f.key + '">' +
            (display === '' ? '—' : display) +
            '</button>';
        }
        html += '</td>';
      });
      html += '<td class="practice-check-cell">';
      html += '<button type="button" class="btn btn-secondary btn-sm btn-check-row" data-check-row="' + i + '">Check</button>';
      html += '</td></tr>';
    }
    els.tbody.innerHTML = html;
  }

  function openFormula(rowIdx, field) {
    var spec = getFormulaSpec(rowIdx, field);
    if (!spec) return;
    active = { rowIdx: rowIdx, field: field };
    formulaState = {
      spec: spec,
      filled: {},
      choices: {}
    };

    // Build choice banks per slot
    formulaState.choiceMeta = {}; // slotId -> optional {value, band}[]
    spec.slots.forEach(function (slot) {
      formulaState.filled[slot.id] = null;
      if (spec.choiceMode === 'taxablePayBands' && field === 'taxablePay') {
        var bank = taxablePayChoiceBank(answers[rowIdx]);
        formulaState.choiceMeta[slot.id] = bank;
        formulaState.choices[slot.id] = bank.map(function (o) { return o.value; });
      } else if (slot.role && /taxable pay/i.test(slot.role)) {
        // Other formulas that use taxable pay as an operand: still offer band spread
        var bank2 = taxablePayChoiceBank(answers[rowIdx]);
        // Ensure this slot's correct value is present
        if (!bank2.some(function (o) { return nearlyEqual(o.value, slot.correct); })) {
          bank2.push({ value: round2(slot.correct), band: 'This period’s sample pay' });
        }
        formulaState.choiceMeta[slot.id] = shuffle(bank2);
        formulaState.choices[slot.id] = formulaState.choiceMeta[slot.id].map(function (o) { return o.value; });
      } else if (slot.integerChoices) {
        formulaState.choices[slot.id] = integerChoiceSet(slot.correct);
        formulaState.choiceMeta[slot.id] = null;
      } else {
        // Never offer pre-multiplied "total used" as a single chip for minusProduct factors
        formulaState.choices[slot.id] = choiceSet(slot.correct);
        formulaState.choiceMeta[slot.id] = null;
      }
    });

    els.formulaTitle.textContent =
      'Period ' + answers[rowIdx].period + ' — ' + fieldLabel(field);
    els.formulaHint.textContent = spec.hint || '';
    els.workspace.hidden = false;
    els.formulaStatus.textContent = '';
    renderFormulaUi();
    renderPracticeTable();
    els.workspace.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeFormula() {
    active = null;
    formulaState = null;
    dragValue = null;
    if (els.workspace) els.workspace.hidden = true;
    if (els.tbody) renderPracticeTable();
  }

  /** 1 = yellow, 2 = pink, 3 = light blue */
  function slotColorClass(index1based) {
    var n = Math.min(Math.max(index1based, 1), 3);
    return 'slot-tone-' + n;
  }

  function slotIndexOf(slotId) {
    if (!formulaState || !formulaState.spec) return 1;
    var slots = formulaState.spec.slots;
    for (var i = 0; i < slots.length; i++) {
      if (slots[i].id === slotId) return i + 1;
    }
    return 1;
  }

  function renderFormulaUi() {
    if (!formulaState) return;
    var spec = formulaState.spec;
    var result = computeFormulaResult();

    // Operand banks — numbered + colour-matched ovals
    var opHtml = '';
    spec.slots.forEach(function (slot, idx) {
      var n = idx + 1;
      var tone = slotColorClass(n);
      var meta = formulaState.choiceMeta[slot.id];
      opHtml += '<div class="operand-bank ' + tone + '">';
      opHtml += '<div class="operand-bank-label">';
      opHtml += '<span class="operand-num" aria-hidden="true">' + n + '</span>';
      opHtml += '<span>' + escapeHtml(slot.role) + ' — pick one</span>';
      opHtml += '</div>';
      if (meta && meta.length) {
        opHtml += '<div class="operand-bank-note">' +
          'Band labels describe where the amount sits vs COP / credit — they do not mark the correct answer.</div>';
      }
      opHtml += '<div class="chip-row">';
      if (meta && meta.length) {
        meta.forEach(function (o) {
          opHtml += '<span class="value-chip has-band ' + tone + '" draggable="true" data-slot-target="' + slot.id +
            '" data-value="' + o.value + '">' +
            '<span>' + formatChip(o.value) + '</span>' +
            (o.band ? '<span class="chip-band">' + escapeHtml(o.band) + '</span>' : '') +
            '</span>';
        });
      } else {
        formulaState.choices[slot.id].forEach(function (v) {
          opHtml += '<span class="value-chip ' + tone + '" draggable="true" data-slot-target="' + slot.id +
            '" data-value="' + v + '">' + formatChip(v) + '</span>';
        });
      }
      opHtml += '</div></div>';
    });
    els.formulaOperands.innerHTML = opHtml;

    // Expression: numbered, colour-matched drop boxes + result after =
    var expr = '';
    var product = null;
    if (spec.evaluateProduct) {
      product = spec.evaluateProduct(
        formulaState.filled[spec.slots[1] && spec.slots[1].id],
        formulaState.filled[spec.slots[2] && spec.slots[2].id]
      );
    }

    if (spec.slots.length === 1) {
      expr += dropZone(spec.slots[0], 1);
      expr += ' <span class="op-fixed">=</span> ';
    } else if (spec.op === 'min') {
      expr += '<span class="op-fn">min(</span>';
      expr += dropZone(spec.slots[0], 1);
      expr += '<span class="op-fixed">,</span>';
      expr += dropZone(spec.slots[1], 2);
      expr += '<span class="op-fn">)</span>';
      expr += ' <span class="op-fixed">=</span> ';
    } else if (spec.op === 'minusProduct' && spec.slots.length >= 3) {
      // annual − ( priorCount × flatPeriodTc )
      expr += dropZone(spec.slots[0], 1);
      expr += ' <span class="op-fixed op-sign" title="Subtract total TC assumed used">−</span> ';
      expr += '<span class="op-fn">(</span>';
      expr += dropZone(spec.slots[1], 2);
      expr += ' <span class="op-fixed op-sign op-sign-mul" title="Multiply">×</span> ';
      expr += dropZone(spec.slots[2], 3);
      expr += '<span class="op-fn">)</span>';
      // Intermediate product (total TC assumed used in skipped periods)
      if (product == null) {
        expr += ' <span class="formula-product-step is-waiting" title="Total TC assumed used in prior periods">used = ?</span> ';
      } else {
        expr += ' <span class="formula-product-step is-ready" title="Total TC assumed used in prior periods">' +
          'used = ' + money(product) + '</span> ';
      }
      expr += ' <span class="op-fixed">→</span> ';
      expr += ' <span class="op-fixed">=</span> ';
    } else {
      expr += dropZone(spec.slots[0], 1);
      expr += ' <span class="op-fixed op-sign" title="Fixed operation">' + escapeHtml(spec.opSymbol) + '</span> ';
      expr += dropZone(spec.slots[1], 2);
      expr += ' <span class="op-fixed">=</span> ';
    }

    if (result == null) {
      expr += '<span class="formula-eq-result is-waiting" aria-live="polite">?</span>';
    } else {
      expr += '<span class="formula-eq-result is-ready" aria-live="polite">' + money(result) + '</span>';
    }
    els.formulaExpression.innerHTML = expr;

    // Same value next to Result_
    if (els.formulaResult) {
      els.formulaResult.classList.remove('is-ready', 'is-waiting');
      if (result == null) {
        els.formulaResult.textContent = '—';
        els.formulaResult.classList.add('is-waiting');
        els.btnPaste.disabled = true;
      } else {
        els.formulaResult.textContent = money(result);
        els.formulaResult.classList.add('is-ready');
        els.btnPaste.disabled = false;
        // brief pop animation each time a complete result appears
        els.formulaResult.classList.remove('pop-in');
        void els.formulaResult.offsetWidth;
        els.formulaResult.classList.add('pop-in');
      }
    }
  }

  function dropZone(slot, index1based) {
    var n = index1based || slotIndexOf(slot.id);
    var tone = slotColorClass(n);
    var filled = formulaState.filled[slot.id];
    var inner = filled == null
      ? '<span class="drop-placeholder">Drop value ' + n + '</span>'
      : '<span class="drop-value">' + formatChip(filled) + '</span>';
    return (
      '<span class="drop-slot ' + tone + '" data-slot="' + slot.id + '" data-slot-num="' + n +
      '" tabindex="0">' +
      '<span class="drop-num" aria-hidden="true">' + n + '</span>' +
      inner +
      '</span>'
    );
  }

  function formatChip(v) {
    if (nearlyEqual(v, 0.2)) return '0.20';
    if (nearlyEqual(v, 0.4)) return '0.40';
    // Whole periods / counts
    if (Math.abs(v - Math.round(v)) < 1e-9 && Math.abs(v) <= 60) {
      return String(Math.round(v));
    }
    return fmt(v);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function computeFormulaResult() {
    if (!formulaState) return null;
    var spec = formulaState.spec;
    var args = spec.slots.map(function (slot) {
      return formulaState.filled[slot.id];
    });
    if (args.some(function (a) { return a == null; })) return null;
    return spec.evaluate.apply(null, args);
  }

  function pasteResult() {
    if (!active || !formulaState) return;
    var result = computeFormulaResult();
    if (result == null) return;
    var row = student[active.rowIdx];
    row[active.field] = result;
    row._check[active.field] = null; // clear prior check mark for this cell
    els.formulaStatus.textContent = 'Pasted ' + money(result) + ' into ' + fieldLabel(active.field) + '.';
    els.formulaStatus.className = 'formula-status is-ok';
    renderPracticeTable();
    updateScore();
  }

  function checkRow(rowIdx) {
    var ans = answers[rowIdx];
    var stu = student[rowIdx];
    if (!ans || !stu) return;
    PRACTICE_FIELDS.forEach(function (f) {
      if (f.key === 'period') {
        stu._check.period = true;
        return;
      }
      var expected = ans[f.key];
      var got = stu[f.key];
      if (got == null || got === '') {
        stu._check[f.key] = false;
      } else {
        stu._check[f.key] = nearlyEqual(got, expected);
      }
    });
    renderPracticeTable();
    updateScore();
  }

  function checkAllRows() {
    for (var i = 0; i < answers.length; i++) checkRow(i);
  }

  function updateScore() {
    if (!answers.length) return;
    var cellsOk = 0;
    var cellsTotal = 0;
    var rowsOk = 0;
    for (var i = 0; i < answers.length; i++) {
      var rowAll = true;
      PRACTICE_FIELDS.forEach(function (f) {
        if (f.key === 'period') return;
        cellsTotal++;
        var mark = student[i]._check[f.key];
        if (mark === true) cellsOk++;
        // row fully correct only if every non-period field matches answer (checked or not)
        if (student[i][f.key] == null || !nearlyEqual(student[i][f.key], answers[i][f.key])) {
          rowAll = false;
        }
      });
      if (rowAll) rowsOk++;
    }
    if (els.scoreCells) els.scoreCells.textContent = cellsOk + ' checked OK (of ' + cellsTotal + ' cells)';
    if (els.scoreRows) els.scoreRows.textContent = rowsOk + ' / ' + answers.length;
  }

  // ——— Events ———

  if (els.btnBuild) {
    els.btnBuild.addEventListener('click', function () {
      generateExercise(true);
    });
  }
  if (els.btnClear) els.btnClear.addEventListener('click', clearStudentAnswers);
  if (els.btnCheckAll) els.btnCheckAll.addEventListener('click', checkAllRows);
  if (els.btnClose) els.btnClose.addEventListener('click', closeFormula);
  if (els.btnPaste) els.btnPaste.addEventListener('click', pasteResult);
  if (els.btnClearSlots) {
    els.btnClearSlots.addEventListener('click', function () {
      if (!formulaState) return;
      Object.keys(formulaState.filled).forEach(function (k) {
        formulaState.filled[k] = null;
      });
      els.formulaStatus.textContent = '';
      renderFormulaUi();
    });
  }

  if (els.tbody) {
    els.tbody.addEventListener('click', function (e) {
      var checkBtn = e.target.closest('[data-check-row]');
      if (checkBtn) {
        checkRow(parseInt(checkBtn.getAttribute('data-check-row'), 10));
        return;
      }
      var cellBtn = e.target.closest('.practice-cell-btn');
      if (cellBtn) {
        openFormula(parseInt(cellBtn.getAttribute('data-row'), 10), cellBtn.getAttribute('data-field'));
      }
    });
  }

  // Drag and drop (chips → slots). Also click chip then click slot for touch-friendly use.
  var pendingChip = null;

  document.addEventListener('dragstart', function (e) {
    var chip = e.target.closest('.value-chip');
    if (!chip || !els.workspace || els.workspace.hidden) return;
    dragValue = {
      value: parseFloat(chip.getAttribute('data-value')),
      preferSlot: chip.getAttribute('data-slot-target')
    };
    e.dataTransfer.setData('text/plain', String(dragValue.value));
    e.dataTransfer.effectAllowed = 'copy';
    chip.classList.add('is-dragging');
  });

  document.addEventListener('dragend', function (e) {
    var chip = e.target.closest('.value-chip');
    if (chip) chip.classList.remove('is-dragging');
    dragValue = null;
  });

  if (els.formulaExpression) {
    els.formulaExpression.addEventListener('dragover', function (e) {
      var slot = e.target.closest('.drop-slot');
      if (!slot) return;
      e.preventDefault();
      slot.classList.add('drag-over');
    });
    els.formulaExpression.addEventListener('dragleave', function (e) {
      var slot = e.target.closest('.drop-slot');
      if (slot) slot.classList.remove('drag-over');
    });
    els.formulaExpression.addEventListener('drop', function (e) {
      var slot = e.target.closest('.drop-slot');
      if (!slot || !formulaState) return;
      e.preventDefault();
      slot.classList.remove('drag-over');
      var slotId = slot.getAttribute('data-slot');
      var val = dragValue ? dragValue.value : parseFloat(e.dataTransfer.getData('text/plain'));
      if (!isFinite(val)) return;
      formulaState.filled[slotId] = round2(val);
      els.formulaStatus.textContent = '';
      renderFormulaUi();
    });
  }

  // Click-to-place (mobile / accessibility)
  if (els.formulaOperands) {
    els.formulaOperands.addEventListener('click', function (e) {
      var chip = e.target.closest('.value-chip');
      if (!chip || !formulaState) return;
      pendingChip = {
        value: parseFloat(chip.getAttribute('data-value')),
        preferSlot: chip.getAttribute('data-slot-target')
      };
      els.formulaOperands.querySelectorAll('.value-chip').forEach(function (c) {
        c.classList.toggle('is-selected', c === chip);
      });
      els.formulaStatus.textContent = 'Selected ' + formatChip(pendingChip.value) + ' — click a formula slot to place it.';
      els.formulaStatus.className = 'formula-status';
    });
  }

  if (els.formulaExpression) {
    els.formulaExpression.addEventListener('click', function (e) {
      var slot = e.target.closest('.drop-slot');
      if (!slot || !formulaState || !pendingChip) return;
      var slotId = slot.getAttribute('data-slot');
      formulaState.filled[slotId] = round2(pendingChip.value);
      pendingChip = null;
      els.formulaOperands.querySelectorAll('.value-chip').forEach(function (c) {
        c.classList.remove('is-selected');
      });
      els.formulaStatus.textContent = '';
      renderFormulaUi();
    });
  }

  window.PayeLabPractice = {
    onShow: function () {
      if (!answers.length) {
        // auto-generate first time user opens Practice (no flash)
        generateExercise(false);
      }
    },
    generate: function () {
      generateExercise(true);
    }
  };
})();
