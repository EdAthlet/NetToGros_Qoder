import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadUscMath() {
  const code = readFileSync(resolve('tools/annualised-paye/usc-math.js'), 'utf8');
  const sandbox = { module: { exports: {} }, exports: {}, globalThis: {} };
  sandbox.module.exports = sandbox.exports;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'usc-math.js' });
  const api = sandbox.module.exports && sandbox.module.exports.computeUscCard
    ? sandbox.module.exports
    : sandbox.UscLabMath;
  if (!api || typeof api.computeUscCard !== 'function') {
    throw new Error('Failed to load UscLabMath');
  }
  return api;
}

describe('USC Lab 2026 math', () => {
  const math = loadUscMath();

  it('splits 2026 annual ceilings by week / fortnight / month', () => {
    expect(math.periodSlice(12012, 52)).toBe(231);
    expect(math.periodSlice(70044, 52)).toBe(1347);
    expect(math.weeklyCops().rate1).toBe(231);
    expect(math.weeklyCops().rate2).toBeCloseTo(526.58, 2);
    expect(math.weeklyCops().rate3).toBe(1347);
    const table = math.thresholdTable2026();
    expect(table.bands).toHaveLength(4);
    expect(table.bands[0].rateLabel).toBe('0.5%');
    expect(table.bands[2].rateLabel).toBe('3%');
    expect(table.bands[3].rateLabel).toBe('8%');
    expect(table.exemptAnnual).toBe(13000);
  });

  it('computes a mid-year cumulative USC card at 2026 rates', () => {
    const setup = math.defaultPracticeSetup();
    expect(setup.startWeek).toBe(28);
    expect(setup.openingCumulativeGross).toBe(18240);
    const grosses = math.defaultPracticeGrosses(4);
    expect(grosses[0]).toBe(980);
    expect(grosses).not.toEqual([720, 650, 525, 490]);

    const periods = grosses.map((gross, i) => ({ weekNo: 28 + i, gross }));
    const card = math.computeUscCard(setup, periods);
    expect(card.rows).toHaveLength(4);
    const first = card.rows[0];
    expect(first.weekNo).toBe(28);
    expect(first.gross).toBe(980);
    expect(first.cumGross).toBeCloseTo(18240 + 980, 2);
    expect(first.cop1).toBeCloseTo(28 * 231, 2);
    expect(first.cop2).toBeCloseTo(28 * math.weeklyCops().rate2, 2);
    expect(first.cop3).toBeCloseTo(28 * 1347, 2);
    expect(first.due1).toBeCloseTo(first.cop1 * 0.005, 2);
    expect(first.cumUsc).toBeCloseTo(first.due1 + first.due2 + first.due3 + first.due4, 2);
    expect(first.deducted).toBeCloseTo(Math.max(0, first.cumUsc - setup.openingCumulativeUsc), 2);
    expect(first.refunded).toBe(0);

    const second = card.rows[1];
    expect(second.cumGross).toBeCloseTo(first.cumGross + 870, 2);
    expect(second.deducted).toBeCloseTo(Math.max(0, second.cumUsc - first.cumUsc), 2);
  });

  it('derives opening USC from opening gross at the week before start', () => {
    const opening = math.openingUscFromGross(18240, 28);
    expect(opening).toBeGreaterThan(0);
    const cops = math.weeklyCops();
    const due = math.uscDueFromCumulative(
      18240,
      math.round2(27 * cops.rate1),
      math.round2(27 * cops.rate2),
      math.round2(27 * cops.rate3)
    );
    expect(opening).toBeCloseTo(due.total, 2);
  });
});

describe('USC formula builder — 0.5% must not double', () => {
  const math = loadUscMath();

  it('must not 2-decimal-round 0.5% to 1%', () => {
    expect(math.round2(0.005)).toBe(0.01);
    expect(math.storeOperand(0.005)).toBe(0.005);
    expect(math.storeOperand(0.005)).not.toBe(math.round2(0.005));
    expect(math.formatRateLabel(0.005)).toBe('0.5%');
    expect(math.formatRateLabel(0.01)).not.toBe('0.5%');
  });

  it('parses the 0.5% label as 0.005, not 0.5 (the €3,234 bug)', () => {
    expect(parseFloat('0.5%')).toBe(0.5);
    expect(math.parseOperand('0.5%')).toBe(0.005);
    expect(math.parseOperand(0.005)).toBe(0.005);
    expect(math.evaluateUscOp('×min', [19220, 6468, '0.5%'])).toBeCloseTo(32.34, 2);
    expect(math.evaluateUscOp('×min', [19220, 6468, 0.5])).toBeCloseTo(3234, 2);
    expect(math.evaluateUscOp('×min', [19220, 6468, '0.5%'])).not.toBeCloseTo(3234, 2);
  });

  it('screenshot week 28 Rate 1: min(19220, 6468) × 0.5% = 32.34 not 64.68', () => {
    const cumGross = 19220;
    const cop1 = 6468;
    const withHalfPercent = math.evaluateUscOp('×min', [cumGross, cop1, 0.005]);
    const withRoundedRate = math.evaluateUscOp('×min', [cumGross, cop1, math.round2(0.005)]);
    const withStoredRate = math.evaluateUscOp('×min', [cumGross, cop1, math.storeOperand(0.005)]);

    expect(withHalfPercent).toBeCloseTo(32.34, 2);
    expect(withStoredRate).toBeCloseTo(32.34, 2);
    expect(withRoundedRate).toBeCloseTo(64.68, 2);
    expect(withHalfPercent).not.toBeCloseTo(64.68, 2);
    expect(withStoredRate).not.toBeCloseTo(withRoundedRate, 2);
  });

  it('evaluates every week-28 card column against hand-checked 2026 figures', () => {
    const setup = math.defaultPracticeSetup();
    const card = math.computeUscCard(setup, [{ weekNo: 28, gross: 980 }]);
    const row = card.rows[0];
    const cops = math.weeklyCops();

    expect(row.cumGross).toBe(19220);
    expect(math.evaluateUscOp('+', [18240, 980])).toBe(19220);

    expect(row.cop1).toBe(6468);
    expect(math.evaluateUscOp('×div', [28, 12012])).toBe(6468);

    expect(row.due1).toBe(32.34);
    expect(math.evaluateUscOp('×min', [19220, 6468, 0.005])).toBe(32.34);

    expect(row.cop2).toBeCloseTo(28 * cops.rate2, 2);
    expect(math.evaluateUscOp('×div', [28, 27382])).toBeCloseTo(row.cop2, 2);

    const due2 = math.evaluateUscOp('bandx', [19220, row.cop2, 6468, 0.02]);
    expect(row.due2).toBeCloseTo(due2, 2);
    expect(due2).toBeCloseTo((row.cop2 - 6468) * 0.02, 2);

    expect(row.cop3).toBe(28 * 1347);
    expect(math.evaluateUscOp('×div', [28, 70044])).toBe(row.cop3);

    const due3 = math.evaluateUscOp('bandx', [19220, row.cop3, row.cop2, 0.03]);
    expect(row.due3).toBeCloseTo(due3, 2);

    expect(row.due4).toBe(0);
    expect(math.evaluateUscOp('max0x', [19220, row.cop3, 0.08])).toBe(0);

    expect(row.cumUsc).toBeCloseTo(row.due1 + row.due2 + row.due3 + row.due4, 2);
    expect(math.evaluateUscOp('sum4', [row.due1, row.due2, row.due3, row.due4])).toBeCloseTo(row.cumUsc, 2);

    expect(row.deducted).toBeCloseTo(Math.max(0, row.cumUsc - setup.openingCumulativeUsc), 2);
    expect(math.evaluateUscOp('max0', [row.cumUsc, setup.openingCumulativeUsc])).toBeCloseTo(row.deducted, 2);
    expect(math.evaluateUscOp('max0', [setup.openingCumulativeUsc, row.cumUsc])).toBe(0);
    expect(row.refunded).toBe(0);
  });

  it('practice builder must store rates with storeOperand, not money round2', () => {
    const src = readFileSync(resolve('tools/annualised-paye/usc-practice.js'), 'utf8');
    expect(src).toMatch(/storeOperand\s*\(/);
    expect(src).toMatch(/evaluateUscOp\s*\(/);
    expect(src).not.toMatch(/formulaState\.filled\[[^\]]+\]\s*=\s*round2\(/);
  });

  it('2% / 3% / 8% band slices stay on the 2026 rates', () => {
    const due = math.uscDueFromCumulative(80000, 231 * 52, 526.58 * 52, 1347 * 52);
    expect(due.due1).toBeCloseTo(12012 * 0.005, 2);
    expect(due.due2).toBeCloseTo((27382 - 12012) * 0.02, 1);
    expect(due.due3).toBeCloseTo((70044 - 27382) * 0.03, 1);
    expect(due.due4).toBeCloseTo((80000 - 70044) * 0.08, 1);
  });
});
