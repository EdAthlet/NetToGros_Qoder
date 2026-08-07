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
    { key: 'taxablePay', label: 'Taxable pay' },
    { key: 'annualisedCop', label: 'Annual COP' },
    { key: 'periodCop', label: 'Period COP' },
    { key: 'taxable20', label: 'Taxable@20%' },
    { key: 'taxable40', label: 'Taxable@40%' },
    { key: 'paye20', label: 'PAYE 20%' },
    { key: 'paye40', label: 'PAYE 40%' },
    { key: 'totalPaye', label: 'Total PAYE' },
    { key: 'appliedTc', label: 'Applied TC' },
    { key: 'netTax', label: 'Net tax' }
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

  /** Cent-level compare after normalising both sides to 2 d.p. */
  function nearlyEqual(a, b) {
    return Math.abs(round2(a) - round2(b)) <= 0.01;
  }

  /**
   * Money chip set that always includes the true value(s) students just computed
   * (e.g. TC remained from the previous quest must appear for Period TC).
   */
  function moneyChoiceSet(correct, mustIncludeList) {
    var primary = round2(correct);
    var set = choiceSet(primary, [0.5, 1, 2, 5, 10, 25, 50, 100], 4);
    var must = mustIncludeList || [];
    must.forEach(function (v) {
      if (v == null || v === '' || !isFinite(Number(v))) return;
      var r = round2(v);
      if (!set.some(function (x) { return nearlyEqual(x, r); })) {
        set.push(r);
      }
    });
    if (!set.some(function (x) { return nearlyEqual(x, primary); })) {
      set.push(primary);
    }
    return shuffle(set);
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
   * Uses current (effective) period COP so bands stay consistent if Annual COP was changed.
   * Returns { value, band? }[]
   */
  function taxablePayChoiceBank(row, rowIdx) {
    var m = row._meta || {};
    var schedule = m.schedule || 52;
    var cop = (rowIdx != null)
      ? effectivePeriodCop(rowIdx)
      : (row.periodCop || ((m.setupAnnualCop || 44000) / schedule));
    var ptc = row.periodTc || ((m.setupAnnualTc || 4000) / schedule);
    var bank = bandedTaxablePayOptions(cop, ptc);
    var correct = round2(row.taxablePay);
    var hasCorrect = bank.some(function (o) { return nearlyEqual(o.value, correct); });
    if (!hasCorrect) {
      bank.push({
        value: correct,
        band: 'This period’s sample pay'
      });
    }
    return shuffle(bank);
  }

  /** Rate chips only — never mix with euro amounts. */
  function rateChoiceSet(correct) {
    var c = round2(correct);
    var pool = [0.1, 0.2, 0.4, 0.5, 0.02, 0.08];
    var set = [c];
    pool.forEach(function (r) {
      if (!set.some(function (x) { return nearlyEqual(x, r); })) set.push(r);
    });
    return shuffle(set.slice(0, 4));
  }

  /**
   * Build chips for one formula slot only (no cross-slot pollution).
   * Returns { choices: number[], meta: {value,band}[]|null }
   */
  function buildSlotChoiceBank(slot, rowIdx, field, spec) {
    var ans = answers[rowIdx];
    var stu = student[rowIdx];

    // Taxable pay quest — band samples + mint custom oval added in render
    if (spec.choiceMode === 'taxablePayBands' && field === 'taxablePay') {
      var bank = taxablePayChoiceBank(ans, rowIdx);
      return {
        choices: bank.map(function (o) { return o.value; }),
        meta: bank
      };
    }

    // Taxable pay as operand (Taxable@20% / @40% yellow)
    if (slot.taxablePayOperand || (slot.role && /^taxable pay/i.test(String(slot.role)))) {
      var payCorrect = effectiveTaxablePay(rowIdx);
      slot.correct = payCorrect;
      var bank2 = taxablePayOperandBank(rowIdx, payCorrect);
      return {
        choices: bank2.map(function (o) { return o.value; }),
        meta: bank2
      };
    }

    // Whole numbers (period counts, periods in year)
    if (slot.integerChoices) {
      return { choices: integerChoiceSet(slot.correct), meta: null };
    }

    // Tax rates only
    if (nearlyEqual(slot.correct, 0.2) || nearlyEqual(slot.correct, 0.4) ||
        (slot.role && /rate/i.test(String(slot.role)))) {
      return { choices: rateChoiceSet(slot.correct), meta: null };
    }

    // Linked prior-quest money values (TC remained, Annual COP, Period COP, PAYE figures…)
    var correct = round2(slot.correct);
    var must = [correct];
    var labelCorrect = 'For this slot';

    if (slot.linkFromField === 'annualisedTc') {
      correct = (stu && isFilledNumber(stu.annualisedTc))
        ? round2(stu.annualisedTc)
        : round2(ans.annualisedTc);
      must = [correct, round2(ans.annualisedTc)];
      if (stu && isFilledNumber(stu.annualisedTc)) labelCorrect = 'Your TC remained quest';
    } else if (slot.linkFromField === 'annualisedCop') {
      correct = effectiveAnnualCop(rowIdx);
      must = [correct, round2(ans.annualisedCop)];
      if (stu && isFilledNumber(stu.annualisedCop)) labelCorrect = 'Your Annual COP';
    } else if (slot.linkFromField === 'periodCop') {
      correct = effectivePeriodCop(rowIdx);
      must = [correct, round2(ans.periodCop)];
      if (stu && isFilledNumber(stu.periodCop)) labelCorrect = 'Your Period COP';
    } else if (slot.linkFromField && stu && isFilledNumber(stu[slot.linkFromField])) {
      correct = round2(stu[slot.linkFromField]);
      must = [correct];
      if (ans[slot.linkFromField] != null) must.push(round2(ans[slot.linkFromField]));
      labelCorrect = 'Your previous answer';
    }

    slot.correct = correct;
    var vals = moneyChoiceSet(correct, must);
    // Keep only same order-of-magnitude-ish distractors (avoid mixing COP with period TC etc.)
    var scale = Math.max(Math.abs(correct), 1);
    vals = vals.filter(function (v) {
      if (nearlyEqual(v, correct)) return true;
      // Allow distractors within 50%–200% of scale, or within €500 for mid values
      return Math.abs(v - correct) <= Math.max(scale * 0.5, 500);
    });
    if (vals.length < 3) vals = moneyChoiceSet(correct, must);

    var meta = vals.map(function (v) {
      return {
        value: v,
        band: nearlyEqual(v, correct) ? labelCorrect : null
      };
    });
    return { choices: vals, meta: meta };
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
            'Any positive amount is valid: pick a sample chip (bands under/over COP, tax vs credit) ' +
            'or type your own value in the mint “Your value” oval. Check always accepts any taxable pay you enter; ' +
            'other PAYE cells are then judged against that pay plus the period’s TC/COP.',
          result: round2(row.taxablePay),
          slots: [{ id: 'a', role: 'Taxable pay for this period (any value is valid)', correct: round2(row.taxablePay) }],
          choiceMode: 'taxablePayBands',
          anyValueAcceptable: true,
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
              // Match answer key: round product first, then subtract (cent-stable)
              var used = round2(b * c);
              return round2(a - used);
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

      case 'periodTc': {
        // Yellow ovals must include the exact TC remained from the answer key
        // (and the student's filled value if they already completed that quest).
        var tcRemained = round2(row.annualisedTc);
        var periodsLeft = m.periodsLeft;
        var periodTcExpected = round2(tcRemained / Math.max(periodsLeft, 1));
        // Prefer key periodTc if already computed consistently
        if (row.periodTc != null) periodTcExpected = round2(row.periodTc);
        return {
          op: '÷',
          opSymbol: '÷',
          hint:
            'Period tax credit = TC remained till year end ÷ periods still left in the year. ' +
            'The yellow ovals for TC remained must match the value from the previous “TC remained till year end” quest ' +
            '(same cents — use that result, do not re-round differently).',
          result: periodTcExpected,
          slots: [
            {
              id: 'a',
              role: 'TC remained till year end (same as previous quest result)',
              correct: tcRemained,
              moneyChoices: true,
              linkFromField: 'annualisedTc'
            },
            {
              id: 'b',
              role: 'Periods left in year',
              correct: periodsLeft,
              integerChoices: true
            }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null || b === 0) return null;
            return round2(a / b);
          }
        };
      }

      case 'annualisedCop': {
        var copOpen = effectiveAnnualCop(rowIdx);
        return {
          op: 'id',
          opSymbol: '',
          anyValueAcceptable: true,
          customField: 'annualisedCop',
          customLabel: 'Your Annual COP',
          customPlaceholder: 'e.g. 44000',
          hint:
            'Annual COP (SRCOP) is week‑1 basis and does not reduce period to period. ' +
            'You can change it on the go: pick a sample oval or type your own in the mint “Your Annual COP” field ' +
            'without regenerating the exercise. Check accepts any Annual COP; Period COP and tax bands then follow your figure.',
          result: copOpen,
          slots: [
            {
              id: 'a',
              role: 'Annual COP / SRCOP',
              correct: copOpen,
              moneyChoices: true,
              linkFromField: 'annualisedCop'
            }
          ],
          evaluate: function (a) {
            return a == null ? null : round2(a);
          }
        };
      }

      case 'periodCop': {
        var annCop = effectiveAnnualCop(rowIdx);
        var sched = m.schedule || 52;
        var pCop = round2(annCop / Math.max(sched, 1));
        return {
          op: '÷',
          opSymbol: '÷',
          hint:
            'Period COP = annual COP ÷ number of periods in the year. ' +
            'Yellow ovals include your Annual COP if you already set one (including a custom value).',
          result: pCop,
          slots: [
            {
              id: 'a',
              role: 'Annual COP',
              correct: annCop,
              moneyChoices: true,
              linkFromField: 'annualisedCop'
            },
            {
              id: 'b',
              role: 'Periods in year',
              correct: sched,
              integerChoices: true
            }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null || b === 0) return null;
            return round2(a / b);
          }
        };
      }

      case 'taxable20': {
        var pay20 = effectiveTaxablePay(rowIdx);
        var cop20 = effectivePeriodCop(rowIdx);
        var t20 = round2(Math.min(Math.max(0, pay20), Math.max(0, cop20)));
        return {
          op: 'min',
          opSymbol: 'min',
          hint:
            'Taxable at 20% = the smaller of taxable pay and period COP. ' +
            'If you chose an arbitrary taxable pay or Annual COP, use those same amounts on the matching ovals.',
          result: t20,
          slots: [
            {
              id: 'a',
              role: 'Taxable pay',
              correct: pay20,
              taxablePayOperand: true,
              linkFromField: 'taxablePay'
            },
            {
              id: 'b',
              role: 'Period COP',
              correct: cop20,
              moneyChoices: true,
              linkFromField: 'periodCop'
            }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(Math.min(a, b));
          }
        };
      }

      case 'taxable40': {
        var pay40 = effectiveTaxablePay(rowIdx);
        var cop40 = effectivePeriodCop(rowIdx);
        var t40 = round2(Math.max(0, pay40 - cop40));
        return {
          op: 'max0sub',
          opSymbol: '−',
          hint:
            'Taxable at 40% = max(0, taxable pay − period COP). ' +
            'Yellow ovals include your arbitrary taxable pay if you already entered one.',
          result: t40,
          slots: [
            {
              id: 'a',
              role: 'Taxable pay (minuend)',
              correct: pay40,
              taxablePayOperand: true,
              linkFromField: 'taxablePay'
            },
            {
              id: 'b',
              role: 'Period COP (subtrahend)',
              correct: cop40,
              moneyChoices: true,
              linkFromField: 'periodCop'
            }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(Math.max(0, a - b));
          }
        };
      }

      case 'paye20': {
        var exp20 = expectedRowForCheck(rowIdx);
        var t20v = exp20 ? exp20.taxable20 : row.taxable20;
        // Prefer student's pasted Taxable@20% when present
        if (student[rowIdx] && isFilledNumber(student[rowIdx].taxable20)) {
          t20v = round2(student[rowIdx].taxable20);
        }
        return {
          op: '×',
          opSymbol: '×',
          hint: 'PAYE at 20% = Taxable@20% × 0.20. Yellow ovals include the Taxable@20% you calculated if already filled.',
          result: round2(t20v * 0.2),
          slots: [
            {
              id: 'a',
              role: 'Taxable@20%',
              correct: round2(t20v),
              moneyChoices: true,
              linkFromField: 'taxable20'
            },
            { id: 'b', role: 'Rate 20%', correct: 0.2 }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(a * b);
          }
        };
      }

      case 'paye40': {
        var exp40 = expectedRowForCheck(rowIdx);
        var t40v = exp40 ? exp40.taxable40 : row.taxable40;
        if (student[rowIdx] && isFilledNumber(student[rowIdx].taxable40)) {
          t40v = round2(student[rowIdx].taxable40);
        }
        return {
          op: '×',
          opSymbol: '×',
          hint: 'PAYE at 40% = Taxable@40% × 0.40.',
          result: round2(t40v * 0.4),
          slots: [
            {
              id: 'a',
              role: 'Taxable@40%',
              correct: round2(t40v),
              moneyChoices: true,
              linkFromField: 'taxable40'
            },
            { id: 'b', role: 'Rate 40%', correct: 0.4 }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(a * b);
          }
        };
      }

      case 'totalPaye': {
        var expT = expectedRowForCheck(rowIdx);
        var p20 = (student[rowIdx] && isFilledNumber(student[rowIdx].paye20))
          ? round2(student[rowIdx].paye20)
          : (expT ? expT.paye20 : row.paye20);
        var p40 = (student[rowIdx] && isFilledNumber(student[rowIdx].paye40))
          ? round2(student[rowIdx].paye40)
          : (expT ? expT.paye40 : row.paye40);
        return {
          op: '+',
          opSymbol: '+',
          hint: 'Total (gross) PAYE = PAYE 20% + PAYE 40%.',
          result: round2(p20 + p40),
          slots: [
            { id: 'a', role: 'PAYE 20%', correct: p20, moneyChoices: true, linkFromField: 'paye20' },
            { id: 'b', role: 'PAYE 40%', correct: p40, moneyChoices: true, linkFromField: 'paye40' }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(a + b);
          }
        };
      }

      case 'appliedTc': {
        var expA = expectedRowForCheck(rowIdx);
        var tot = (student[rowIdx] && isFilledNumber(student[rowIdx].totalPaye))
          ? round2(student[rowIdx].totalPaye)
          : (expA ? expA.totalPaye : row.totalPaye);
        return {
          op: 'min',
          opSymbol: 'min',
          hint: 'Applied tax credit = the smaller of period TC and total PAYE (credit cannot exceed tax due).',
          result: round2(Math.min(row.periodTc, tot)),
          slots: [
            { id: 'a', role: 'Period TC', correct: round2(row.periodTc), moneyChoices: true },
            { id: 'b', role: 'Total PAYE', correct: tot, moneyChoices: true, linkFromField: 'totalPaye' }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(Math.min(a, b));
          }
        };
      }

      case 'netTax': {
        var expN = expectedRowForCheck(rowIdx);
        var totN = (student[rowIdx] && isFilledNumber(student[rowIdx].totalPaye))
          ? round2(student[rowIdx].totalPaye)
          : (expN ? expN.totalPaye : row.totalPaye);
        var appN = (student[rowIdx] && isFilledNumber(student[rowIdx].appliedTc))
          ? round2(student[rowIdx].appliedTc)
          : (expN ? expN.appliedTc : row.appliedTc);
        return {
          op: '-',
          opSymbol: '−',
          hint: 'Net tax = total PAYE − applied tax credit.',
          result: round2(Math.max(0, totN - appN)),
          slots: [
            { id: 'a', role: 'Total PAYE (minuend)', correct: totN, moneyChoices: true, linkFromField: 'totalPaye' },
            { id: 'b', role: 'Applied TC (subtrahend)', correct: appN, moneyChoices: true, linkFromField: 'appliedTc' }
          ],
          evaluate: function (a, b) {
            if (a == null || b == null) return null;
            return round2(Math.max(0, a - b));
          }
        };
      }

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

  /** Student's pasted taxable pay if any; otherwise answer-key sample. */
  function effectiveTaxablePay(rowIdx) {
    var ans = answers[rowIdx];
    var stu = student[rowIdx];
    if (stu && isFilledNumber(stu.taxablePay)) return round2(stu.taxablePay);
    return ans ? round2(ans.taxablePay) : 0;
  }

  /**
   * Annual COP for quests/checks: prefer this row’s paste, else any row’s paste
   * (so user can change COP on the go without regenerating), else answer key.
   */
  function effectiveAnnualCop(rowIdx) {
    if (student[rowIdx] && isFilledNumber(student[rowIdx].annualisedCop)) {
      return round2(student[rowIdx].annualisedCop);
    }
    for (var i = 0; i < student.length; i++) {
      if (student[i] && isFilledNumber(student[i].annualisedCop)) {
        return round2(student[i].annualisedCop);
      }
    }
    var ans = answers[rowIdx];
    return ans ? round2(ans.annualisedCop) : 0;
  }

  /** Period COP: student’s paste, or annual COP ÷ periods in year. */
  function effectivePeriodCop(rowIdx) {
    if (student[rowIdx] && isFilledNumber(student[rowIdx].periodCop)) {
      return round2(student[rowIdx].periodCop);
    }
    var ans = answers[rowIdx];
    var schedule = (ans && ans._meta && ans._meta.schedule) || 52;
    return round2(effectiveAnnualCop(rowIdx) / Math.max(schedule, 1));
  }

  /**
   * Band chips + always include answer-key sample and the student's own pay
   * (so Taxable@20% / @40% yellow ovals offer the arbitrary value they chose).
   */
  function taxablePayOperandBank(rowIdx, preferredCorrect) {
    var ans = answers[rowIdx];
    var bank = taxablePayChoiceBank(ans, rowIdx);
    var must = [];
    if (preferredCorrect != null && isFinite(Number(preferredCorrect))) {
      must.push({ value: round2(preferredCorrect), band: 'Use this pay for this quest' });
    }
    if (student[rowIdx] && isFilledNumber(student[rowIdx].taxablePay)) {
      must.push({
        value: round2(student[rowIdx].taxablePay),
        band: 'Your entered pay'
      });
    }
    if (ans) {
      must.push({ value: round2(ans.taxablePay), band: 'Exercise sample pay' });
    }
    must.forEach(function (item) {
      var exists = bank.some(function (o) { return nearlyEqual(o.value, item.value); });
      if (!exists) bank.unshift(item);
      else {
        // Prefer explicit “Your entered pay” label on matching chip
        bank.forEach(function (o) {
          if (nearlyEqual(o.value, item.value) && item.band === 'Your entered pay') {
            o.band = item.band;
          }
        });
      }
    });
    return shuffle(bank);
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
    // taxable pay … net tax (10 columns) — no separate “TC left” column
    for (var g = 0; g < 10; g++) {
      html += '<td class="gap-cell"><span class="gap-muted">—</span></td>';
    }
    html += '<td class="practice-check-cell"></td>';
    html += '</tr>';
    if (startP > 2) {
      html += '<tr class="gap-ellipsis-row">';
      html += '<td colspan="14" class="gap-ellipsis-cell">';
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

        html += '<td class="' + cls + '" data-row="' + i + '" data-field="' + f.key + '">';
        if (f.key === 'period') {
          html += '<span class="practice-given" data-row="' + i + '" data-field="period">' + display + '</span>';
        } else {
          // Always a real button so filled values stay clickable to re-open the quest
          html += '<button type="button" class="practice-cell-btn" data-row="' + i + '" data-field="' + f.key + '" ' +
            'title="Click to open formula quest">' +
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

  function clearFormulaDom() {
    pendingChip = null;
    dragValue = null;
    if (els.formulaOperands) els.formulaOperands.innerHTML = '';
    if (els.formulaExpression) els.formulaExpression.innerHTML = '';
    if (els.formulaResult) {
      els.formulaResult.textContent = '—';
      els.formulaResult.classList.remove('is-ready', 'pop-in');
      els.formulaResult.classList.add('is-waiting');
    }
    if (els.btnPaste) els.btnPaste.disabled = true;
    if (els.formulaStatus) {
      els.formulaStatus.textContent = '';
      els.formulaStatus.className = 'formula-status';
    }
    if (els.formulaTitle) els.formulaTitle.textContent = 'Formula builder';
    if (els.formulaHint) els.formulaHint.textContent = '';
  }

  function openFormula(rowIdx, field) {
    var spec = getFormulaSpec(rowIdx, field);
    if (!spec || !answers[rowIdx]) {
      console.warn('No formula for', field, 'row', rowIdx);
      return;
    }

    // Always wipe previous quest UI first (avoids “stuck on last formula”)
    clearFormulaDom();

    active = { rowIdx: rowIdx, field: field };
    formulaState = {
      spec: spec,
      field: field,
      rowIdx: rowIdx,
      filled: {},
      choices: {},
      choiceMeta: {},
      customPayInput: '',
      customCopInput: ''
    };
    // Prefill mint oval when re-opening a free-form cell
    if (field === 'taxablePay' && student[rowIdx] && isFilledNumber(student[rowIdx].taxablePay)) {
      formulaState.customPayInput = String(student[rowIdx].taxablePay);
    }
    if (field === 'annualisedCop' && student[rowIdx] && isFilledNumber(student[rowIdx].annualisedCop)) {
      formulaState.customCopInput = String(student[rowIdx].annualisedCop);
    }

    // Build choice banks per slot (isolated — no mixing TC / COP / rates / counts)
    spec.slots.forEach(function (slot) {
      formulaState.filled[slot.id] = null;
      var bank = buildSlotChoiceBank(slot, rowIdx, field, spec);
      formulaState.choices[slot.id] = bank.choices || [];
      formulaState.choiceMeta[slot.id] = bank.meta;
    });

    els.formulaTitle.textContent =
      'Period ' + answers[rowIdx].period + ' — ' + fieldLabel(field);
    els.formulaHint.textContent = spec.hint || '';
    els.workspace.hidden = false;
    els.formulaStatus.textContent = '';
    els.formulaStatus.className = 'formula-status';

    try {
      renderFormulaUi();
    } catch (err) {
      console.error('renderFormulaUi failed', err);
      clearFormulaDom();
      if (els.formulaStatus) {
        els.formulaStatus.textContent = 'Could not build this quest. Try another cell or regenerate.';
        els.formulaStatus.className = 'formula-status';
      }
    }
    renderPracticeTable();
    els.workspace.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function closeFormula() {
    active = null;
    formulaState = null;
    clearFormulaDom();
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
    if (!formulaState || !formulaState.spec) return;
    var spec = formulaState.spec;
    var activeField = formulaState.field || (active && active.field) || '';
    var result = computeFormulaResult();

    // Operand banks — numbered + colour-matched ovals (always rebuild from current state)
    var opHtml = '';
    var slots = spec.slots || [];
    slots.forEach(function (slot, idx) {
      var n = idx + 1;
      var tone = slotColorClass(n);
      var meta = formulaState.choiceMeta && formulaState.choiceMeta[slot.id];
      var choiceList = (formulaState.choices && formulaState.choices[slot.id]) || [];
      opHtml += '<div class="operand-bank ' + tone + '" data-bank-slot="' + slot.id + '">';
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
        choiceList.forEach(function (v) {
          opHtml += '<span class="value-chip ' + tone + '" draggable="true" data-slot-target="' + slot.id +
            '" data-value="' + v + '">' + formatChip(v) + '</span>';
        });
      }
      // Custom mint oval — taxable pay and/or Annual COP (change on the go)
      if (idx === 0 && (spec.choiceMode === 'taxablePayBands' || spec.anyValueAcceptable)) {
        var isCop = spec.customField === 'annualisedCop' || activeField === 'annualisedCop';
        var customVal = isCop
          ? (formulaState.customCopInput != null ? formulaState.customCopInput : '')
          : (formulaState.customPayInput != null ? formulaState.customPayInput : '');
        var customLabel = spec.customLabel || (isCop ? 'Your Annual COP' : 'Your value');
        var customPh = spec.customPlaceholder || (isCop ? 'e.g. 44000' : 'e.g. 1250');
        var customHint = isCop
          ? 'type any annual COP · no need to regenerate'
          : 'type any pay · drag or click to use';
        opHtml += '<span class="value-chip value-chip-custom has-band" draggable="true" ' +
          'data-slot-target="' + slot.id + '" data-custom-chip="1" data-custom-kind="' +
          (isCop ? 'cop' : 'pay') + '" data-value="' +
          (customVal !== '' ? customVal : '') + '">' +
          '<span class="chip-custom-label">' + escapeHtml(customLabel) + '</span>' +
          '<input type="text" inputmode="decimal" class="chip-custom-input" ' +
          'placeholder="' + escapeHtml(customPh) + '" autocomplete="off" spellcheck="false" ' +
          'value="' + escapeHtml(String(customVal)) + '" />' +
          '<span class="chip-band">' + escapeHtml(customHint) + '</span>' +
          '</span>';
      }
      opHtml += '</div></div>';
    });
    if (els.formulaOperands) els.formulaOperands.innerHTML = opHtml;

    // Keep custom input caret/value stable after re-render
    var customInput = els.formulaOperands.querySelector('.chip-custom-input');
    if (customInput) {
      customInput.addEventListener('input', function () {
        var chip = customInput.closest('[data-custom-chip]');
        var kind = chip && chip.getAttribute('data-custom-kind');
        if (kind === 'cop') formulaState.customCopInput = customInput.value;
        else formulaState.customPayInput = customInput.value;
        if (chip) chip.setAttribute('data-value', customInput.value);
      });
      customInput.addEventListener('click', function (e) {
        e.stopPropagation();
      });
      customInput.addEventListener('mousedown', function (e) {
        e.stopPropagation();
      });
    }

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
    var field = active.field;
    row[field] = result;
    row._check[field] = null; // clear prior check mark for this cell
    // Free-form fields: mark green immediately when pasted
    if (field === 'taxablePay' && isFinite(result)) {
      row._check.taxablePay = true;
    }
    if (field === 'annualisedCop' && isFinite(result)) {
      row._check.annualisedCop = true;
      // Mirror custom Annual COP onto other empty rows so later periods use it without regenerate
      for (var ri = 0; ri < student.length; ri++) {
        if (ri === active.rowIdx) continue;
        if (student[ri] && !isFilledNumber(student[ri].annualisedCop)) {
          student[ri].annualisedCop = result;
          student[ri]._check.annualisedCop = true;
        }
      }
    }
    var freeNote = '';
    if (field === 'taxablePay') freeNote = ' (any taxable pay is accepted).';
    if (field === 'annualisedCop') freeNote = ' (any Annual COP is accepted — no need to regenerate).';
    els.formulaStatus.textContent = 'Pasted ' + money(result) + ' into ' + fieldLabel(field) + freeNote;
    els.formulaStatus.className = 'formula-status is-ok';
    renderPracticeTable();
    updateScore();
    // Keep quest open; re-mark active cell after table re-render
    if (active) {
      active = { rowIdx: active.rowIdx, field: field };
      var btn = els.tbody && els.tbody.querySelector(
        '.practice-cell-btn[data-row="' + active.rowIdx + '"][data-field="' + field + '"]'
      );
      if (btn) {
        var td = btn.closest('td');
        if (td) td.classList.add('is-active');
      }
    }
  }

  /** After a slot is filled: refresh UI; auto-paste single-slot free-form quests (taxable pay / Annual COP). */
  function afterSlotFilled() {
    if (!formulaState) return;
    renderFormulaUi();
    var result = computeFormulaResult();
    if (result == null) return;
    var spec = formulaState.spec;
    if (spec && (spec.anyValueAcceptable || spec.op === 'id') && spec.slots && spec.slots.length === 1) {
      pasteResult();
    }
  }

  function placeValueInSlot(slotId, val, preferSlot) {
    if (!formulaState || !isFinite(val)) return;
    // Chip from line N may only fill drop box N
    if (preferSlot && preferSlot !== slotId) {
      if (els.formulaStatus) {
        var want = slotIndexOf(preferSlot);
        var got = slotIndexOf(slotId);
        els.formulaStatus.textContent =
          'That oval belongs in box ' + want + ' (not box ' + got + '). Use a matching colour.';
        els.formulaStatus.className = 'formula-status';
      }
      return;
    }
    formulaState.filled[slotId] = round2(val);
    if (els.formulaStatus) {
      els.formulaStatus.textContent = '';
      els.formulaStatus.className = 'formula-status';
    }
    afterSlotFilled();
  }

  /**
   * Expected figures using student’s taxable pay and Annual COP when set.
   * Taxable pay and Annual COP themselves are never graded against the key.
   */
  function expectedRowForCheck(rowIdx) {
    var ans = answers[rowIdx];
    var stu = student[rowIdx];
    if (!ans) return null;
    var pay = effectiveTaxablePay(rowIdx);
    var annualCop = effectiveAnnualCop(rowIdx);
    var periodCop = effectivePeriodCop(rowIdx);
    var periodTc = ans.periodTc;
    if (stu && isFilledNumber(stu.periodTc)) {
      // keep answer-key period TC for credit maths unless we later free that too
      periodTc = ans.periodTc;
    }
    var taxable20 = round2(Math.min(Math.max(0, pay), Math.max(0, periodCop)));
    var taxable40 = round2(Math.max(0, pay - periodCop));
    var paye20 = round2(taxable20 * 0.2);
    var paye40 = round2(taxable40 * 0.4);
    var totalPaye = round2(paye20 + paye40);
    var appliedTc = round2(Math.min(Math.max(0, periodTc), totalPaye));
    var netTax = round2(Math.max(0, totalPaye - appliedTc));
    return {
      period: ans.period,
      annualisedTc: ans.annualisedTc,
      periodTc: ans.periodTc,
      taxablePay: pay,
      annualisedCop: annualCop,
      periodCop: periodCop,
      taxable20: taxable20,
      taxable40: taxable40,
      paye20: paye20,
      paye40: paye40,
      totalPaye: totalPaye,
      appliedTc: appliedTc,
      netTax: netTax
    };
  }

  function isFilledNumber(v) {
    return v != null && v !== '' && isFinite(Number(v));
  }

  function checkRow(rowIdx) {
    var ans = answers[rowIdx];
    var stu = student[rowIdx];
    if (!ans || !stu) return;
    var expected = expectedRowForCheck(rowIdx);
    PRACTICE_FIELDS.forEach(function (f) {
      if (f.key === 'period') {
        stu._check.period = true;
        return;
      }
      // Free-form fields — any entered number passes
      if (f.key === 'taxablePay') {
        stu._check.taxablePay = isFilledNumber(stu.taxablePay);
        return;
      }
      if (f.key === 'annualisedCop') {
        stu._check.annualisedCop = isFilledNumber(stu.annualisedCop);
        return;
      }
      var exp = expected[f.key];
      var got = stu[f.key];
      if (!isFilledNumber(got)) {
        stu._check[f.key] = false;
      } else {
        stu._check[f.key] = nearlyEqual(got, exp);
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
      var expected = expectedRowForCheck(i);
      PRACTICE_FIELDS.forEach(function (f) {
        if (f.key === 'period') return;
        cellsTotal++;
        var mark = student[i]._check[f.key];
        if (mark === true) cellsOk++;
        if (f.key === 'taxablePay') {
          if (!isFilledNumber(student[i].taxablePay)) rowAll = false;
          return;
        }
        if (f.key === 'annualisedCop') {
          if (!isFilledNumber(student[i].annualisedCop)) rowAll = false;
          return;
        }
        if (!isFilledNumber(student[i][f.key]) || !nearlyEqual(student[i][f.key], expected[f.key])) {
          rowAll = false;
        }
      });
      if (rowAll) rowsOk++;
    }
    if (els.scoreCells) els.scoreCells.textContent = cellsOk + ' checked OK (of ' + cellsTotal + ' cells)';
    if (els.scoreRows) els.scoreRows.textContent = rowsOk + ' / ' + answers.length;
  }

  function readCustomChipValue(chip) {
    if (!chip) return null;
    var input = chip.querySelector('.chip-custom-input');
    var raw = input ? input.value : chip.getAttribute('data-value');
    var n = parseFloat(String(raw || '').replace(/,/g, '').trim());
    return isFinite(n) ? round2(n) : null;
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
      // Prefer button; also allow click on the cell (filled Taxable pay must stay openable)
      var cellBtn = e.target.closest('.practice-cell-btn');
      var cellTd = e.target.closest('td.practice-cell[data-field]');
      if (cellBtn) {
        e.preventDefault();
        openFormula(parseInt(cellBtn.getAttribute('data-row'), 10), cellBtn.getAttribute('data-field'));
        return;
      }
      if (cellTd && cellTd.getAttribute('data-field') !== 'period') {
        e.preventDefault();
        openFormula(parseInt(cellTd.getAttribute('data-row'), 10), cellTd.getAttribute('data-field'));
      }
    });
  }

  // Drag and drop (chips → slots). Also click chip then click slot for touch-friendly use.
  var pendingChip = null;

  document.addEventListener('dragstart', function (e) {
    var chip = e.target.closest('.value-chip');
    if (!chip || !els.workspace || els.workspace.hidden) return;
    if (e.target && e.target.classList && e.target.classList.contains('chip-custom-input')) {
      // allow selecting text in custom input without starting drag from the input itself
      e.preventDefault();
      return;
    }
    var val = chip.getAttribute('data-custom-chip')
      ? readCustomChipValue(chip)
      : parseFloat(chip.getAttribute('data-value'));
    if (!isFinite(val)) {
      e.preventDefault();
      if (chip.getAttribute('data-custom-chip') && els.formulaStatus) {
        var kind = chip.getAttribute('data-custom-kind');
        els.formulaStatus.textContent = kind === 'cop'
          ? 'Enter an Annual COP amount in the mint oval first.'
          : 'Enter a taxable pay amount in the mint oval first.';
        els.formulaStatus.className = 'formula-status';
      }
      return;
    }
    dragValue = {
      value: val,
      preferSlot: chip.getAttribute('data-slot-target')
    };
    try {
      e.dataTransfer.setData('text/plain', String(dragValue.value));
      e.dataTransfer.effectAllowed = 'copy';
    } catch (err) { /* ignore */ }
    chip.classList.add('is-dragging');
  });

  document.addEventListener('dragend', function (e) {
    var chip = e.target.closest('.value-chip');
    if (chip) chip.classList.remove('is-dragging');
    dragValue = null;
  });

  if (els.formulaExpression) {
    // Allow drop on expression area (not only exact slot edge)
    els.formulaExpression.addEventListener('dragover', function (e) {
      if (!formulaState) return;
      e.preventDefault();
      var slot = e.target.closest('.drop-slot') || els.formulaExpression.querySelector('.drop-slot');
      if (slot) slot.classList.add('drag-over');
    });
    els.formulaExpression.addEventListener('dragleave', function (e) {
      var slot = e.target.closest('.drop-slot');
      if (slot) slot.classList.remove('drag-over');
    });
    els.formulaExpression.addEventListener('drop', function (e) {
      if (!formulaState) return;
      e.preventDefault();
      var slot = e.target.closest('.drop-slot');
      // Single-slot quests (Taxable pay): drop anywhere on the formula line
      if (!slot && formulaState.spec.slots.length === 1) {
        slot = els.formulaExpression.querySelector('.drop-slot');
      }
      if (!slot) return;
      slot.classList.remove('drag-over');
      var slotId = slot.getAttribute('data-slot');
      var val = dragValue ? dragValue.value : parseFloat(e.dataTransfer.getData('text/plain'));
      var prefer = dragValue ? dragValue.preferSlot : null;
      if (!isFinite(val)) return;
      placeValueInSlot(slotId, val, prefer);
    });
  }

  // Click-to-place (mobile / accessibility)
  if (els.formulaOperands) {
    els.formulaOperands.addEventListener('click', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('chip-custom-input')) return;
      var chip = e.target.closest('.value-chip');
      if (!chip || !formulaState) return;
      var val = chip.getAttribute('data-custom-chip')
        ? readCustomChipValue(chip)
        : parseFloat(chip.getAttribute('data-value'));
      if (!isFinite(val)) {
        if (chip.getAttribute('data-custom-chip') && els.formulaStatus) {
          var kind2 = chip.getAttribute('data-custom-kind');
          els.formulaStatus.textContent = kind2 === 'cop'
            ? 'Enter an Annual COP amount in the mint oval first.'
            : 'Enter a taxable pay amount in the mint oval first.';
          els.formulaStatus.className = 'formula-status';
        }
        return;
      }
      var preferSlot = chip.getAttribute('data-slot-target');
      // Click chip → auto-fill its matching numbered box (and auto-paste if single-slot)
      if (preferSlot) {
        placeValueInSlot(preferSlot, val, preferSlot);
        return;
      }
      if (formulaState.spec.slots.length === 1) {
        placeValueInSlot(formulaState.spec.slots[0].id, val);
        return;
      }
      pendingChip = { value: val, preferSlot: preferSlot };
      els.formulaOperands.querySelectorAll('.value-chip').forEach(function (c) {
        c.classList.toggle('is-selected', c === chip);
      });
      els.formulaStatus.textContent = 'Selected ' + formatChip(pendingChip.value) + ' — click a matching formula slot.';
      els.formulaStatus.className = 'formula-status';
    });
  }

  if (els.formulaExpression) {
    els.formulaExpression.addEventListener('click', function (e) {
      var slot = e.target.closest('.drop-slot');
      if (!slot || !formulaState || !pendingChip) return;
      var slotId = slot.getAttribute('data-slot');
      var val = pendingChip.value;
      var prefer = pendingChip.preferSlot;
      pendingChip = null;
      els.formulaOperands.querySelectorAll('.value-chip').forEach(function (c) {
        c.classList.remove('is-selected');
      });
      placeValueInSlot(slotId, val, prefer);
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
