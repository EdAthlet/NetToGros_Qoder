const { test, expect } = require('@playwright/test');

const FIELDS = [
  'annualisedTc', 'periodTc', 'taxablePay', 'annualisedCop', 'periodCop',
  'taxable20', 'taxable40', 'paye20', 'paye40', 'totalPaye', 'appliedTc', 'netTax'
];

const round2 = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const displayedNumber = text => Number(String(text).replace(/[^0-9.-]/g, ''));

function expectedRows({ annualTc, annualCop, schedule, startPeriod, pays }) {
  const flatPeriodTc = round2(annualTc / schedule);
  let remainingTc = round2(annualTc - round2((startPeriod - 1) * flatPeriodTc));

  return pays.map((taxablePay, index) => {
    const period = startPeriod + index;
    const periodsLeft = schedule - period + 1;
    const annualisedTc = remainingTc;
    const periodTc = round2(annualisedTc / periodsLeft);
    const periodCop = round2(annualCop / schedule);
    const taxable20 = round2(Math.min(Math.max(0, taxablePay), Math.max(0, periodCop)));
    const taxable40 = round2(Math.max(0, taxablePay - periodCop));
    const paye20 = round2(taxable20 * 0.20);
    const paye40 = round2(taxable40 * 0.40);
    const totalPaye = round2(paye20 + paye40);
    const appliedTc = round2(Math.min(Math.max(0, periodTc), totalPaye));
    const netTax = round2(Math.max(0, totalPaye - appliedTc));
    remainingTc = round2(annualisedTc - appliedTc);

    return {
      period, annualisedTc, periodTc, taxablePay, annualisedCop: annualCop,
      periodCop, taxable20, taxable40, paye20, paye40, totalPaye, appliedTc, netTax,
      operands: {
        annualisedTc: index === 0 && startPeriod > 1
          ? [annualTc, startPeriod - 1, flatPeriodTc]
          : index === 0 ? [annualTc] : null,
        periodTc: [annualisedTc, periodsLeft],
        periodCop: [annualCop, schedule],
        taxable20: [taxablePay, periodCop],
        taxable40: [taxablePay, periodCop],
        paye20: [taxable20, 0.20],
        paye40: [taxable40, 0.40],
        totalPaye: [paye20, paye40],
        appliedTc: [periodTc, totalPaye],
        netTax: [totalPaye, appliedTc]
      }
    };
  }).map((row, index, rows) => {
    if (index > 0) row.operands.annualisedTc = [rows[index - 1].annualisedTc, rows[index - 1].appliedTc];
    return row;
  });
}

async function openPractice(page, setup) {
  await page.goto('./');
  await page.locator('#frequency').selectOption(setup.frequency);
  await page.locator('#annualTc').fill(String(setup.annualTc));
  await page.locator('#annualCop').fill(String(setup.annualCop));
  await page.locator('#startPeriod').fill(String(setup.startPeriod));
  await page.locator('#periodCount').fill(String(setup.periodCount));
  await page.getByRole('tab', { name: 'Practice 1', exact: true }).click();
  await page.locator('#btn-practice-build').click();
  await expect(page.locator('#practice-rows tr[data-practice-row]')).toHaveCount(setup.periodCount);
}

async function clickOperand(page, slot, expected) {
  const candidates = page.locator(`.value-chip[data-slot-target="${slot}"]`);
  const count = await candidates.count();
  for (let i = 0; i < count; i += 1) {
    const candidate = candidates.nth(i);
    if (await candidate.getAttribute('data-custom-chip')) continue;
    const actual = Number(await candidate.getAttribute('data-value'));
    if (Number.isFinite(actual) && Math.abs(round2(actual) - round2(expected)) <= 0.01) {
      await candidate.click();
      return;
    }
  }
  throw new Error(`No operand chip for slot ${slot}, expected ${expected}`);
}

async function pasteCustomValue(page, row, field, value) {
  await page.locator(`.practice-cell-btn[data-row="${row}"][data-field="${field}"]`).click();
  const custom = page.locator('#formula-operands .chip-custom-input');
  await expect(custom).toBeVisible();
  await custom.fill(String(value));
  // Click the label, not the chip centre (the centre is the input and intentionally ignores clicks).
  await page.locator('#formula-operands .value-chip-custom .chip-custom-label').click();
  expect(round2(displayedNumber(await page.locator('#formula-result-value').innerText()))).toBe(round2(value));
  await page.locator('#btn-formula-paste').click();
}

async function pasteFormula(page, row, field, operands, expected) {
  await page.locator(`.practice-cell-btn[data-row="${row}"][data-field="${field}"]`).click();
  const slots = await page.locator('#formula-expression [data-slot]').evaluateAll(nodes =>
    nodes.map(node => node.getAttribute('data-slot'))
  );
  expect(slots.length).toBe(operands.length);
  for (let i = 0; i < slots.length; i += 1) await clickOperand(page, slots[i], operands[i]);
  expect(round2(displayedNumber(await page.locator('#formula-result-value').innerText()))).toBe(round2(expected));
  await page.locator('#btn-formula-paste').click();
}

async function completeRow(page, rowIndex, row) {
  await pasteFormula(page, rowIndex, 'annualisedTc', row.operands.annualisedTc, row.annualisedTc);
  await pasteFormula(page, rowIndex, 'periodTc', row.operands.periodTc, row.periodTc);
  await pasteCustomValue(page, rowIndex, 'taxablePay', row.taxablePay);
  await pasteCustomValue(page, rowIndex, 'annualisedCop', row.annualisedCop);
  for (const field of ['periodCop', 'taxable20', 'taxable40', 'paye20', 'paye40', 'totalPaye', 'appliedTc', 'netTax']) {
    await pasteFormula(page, rowIndex, field, row.operands[field], row[field]);
  }
}

test('loads Practice 1 with an empty 8-row exercise and stable accessible controls', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('tab', { name: 'Practice 1', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Practice 1 — formula builder' })).toBeVisible();
  await expect(page.locator('#practice-rows tr[data-practice-row]')).toHaveCount(8);
  await expect(page.locator('.practice-cell-btn')).toHaveCount(96);
  await expect(page.locator('#practice-score-cells')).toHaveText('0 checked OK (of 96 cells)');
});

test('marks blank cells wrong, then clears all marks and answers', async ({ page }) => {
  await openPractice(page, { frequency: 'weekly', annualTc: 4000, annualCop: 44000, startPeriod: 1, periodCount: 2 });
  await page.locator('[data-check-row="0"]').click();
  await expect(page.locator('tr[data-practice-row="0"] td.is-wrong')).toHaveCount(12);
  await page.locator('#btn-practice-clear').click();
  await expect(page.locator('tr[data-practice-row="0"] td.is-wrong')).toHaveCount(0);
  await expect(page.locator('tr[data-practice-row="0"] .practice-cell-btn')).toHaveText(Array(12).fill('—'));
});

for (const scenario of [
  {
    name: 'weekly low pay caps Applied TC at gross PAYE and produces zero net tax',
    setup: { frequency: 'weekly', schedule: 52, annualTc: 4000, annualCop: 44000, startPeriod: 1, periodCount: 1 },
    pays: [100]
  },
  {
    name: 'weekly high pay uses both 20% and 40% bands',
    setup: { frequency: 'weekly', schedule: 52, annualTc: 4000, annualCop: 44000, startPeriod: 1, periodCount: 1 },
    pays: [2000]
  },
  {
    name: 'monthly mid-year start uses annual TC minus prior periods times flat TC',
    setup: { frequency: 'monthly', schedule: 12, annualTc: 4200, annualCop: 48000, startPeriod: 7, periodCount: 1 },
    pays: [5000]
  }
]) {
  test(scenario.name, async ({ page }) => {
    await openPractice(page, scenario.setup);
    const rows = expectedRows({ ...scenario.setup, pays: scenario.pays });
    await completeRow(page, 0, rows[0]);
    await page.locator('[data-check-row="0"]').click();
    await expect(page.locator('tr[data-practice-row="0"] td.is-correct')).toHaveCount(13);
    await expect(page.locator('#practice-score-cells')).toHaveText('12 checked OK (of 12 cells)');
    await expect(page.locator('#practice-score-rows')).toHaveText('1 / 1');
  });
}

test('rolls remaining tax credit into the next row', async ({ page }) => {
  const setup = { frequency: 'weekly', schedule: 52, annualTc: 4000, annualCop: 44000, startPeriod: 1, periodCount: 2 };
  await openPractice(page, setup);
  const rows = expectedRows({ ...setup, pays: [100, 2000] });
  await completeRow(page, 0, rows[0]);
  await completeRow(page, 1, rows[1]);
  await page.locator('#btn-practice-check-all').click();
  await expect(page.locator('#practice-score-cells')).toHaveText('24 checked OK (of 24 cells)');
  await expect(page.locator('#practice-score-rows')).toHaveText('2 / 2');
});

test('regeneration honours changed frequency, start period and row count', async ({ page }) => {
  await openPractice(page, { frequency: 'fortnightly', annualTc: 3900, annualCop: 52000, startPeriod: 10, periodCount: 3 });
  await expect(page.locator('#practice-rows tr[data-practice-row]')).toHaveCount(3);
  await expect(page.locator('tr[data-practice-row="0"] .practice-given')).toHaveText('10');
  await expect(page.locator('tr[data-practice-row="2"] .practice-given')).toHaveText('12');
  await expect(page.locator('#practice-rows .gap-context-row')).toHaveCount(1);
  await expect(page.locator('#practice-rows .gap-ellipsis-row')).toHaveCount(1);
});
