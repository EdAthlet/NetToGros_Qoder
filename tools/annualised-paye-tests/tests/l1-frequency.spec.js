const { test, expect } = require('@playwright/test');

async function l1Setup(page) {
  await page.goto('./');
  await expect(page.locator('#level-btn-1 .lab-level-label')).toHaveText('PAYE lab 1');
}

test.describe('PAYE lab 1 pay frequency', () => {
  test('fortnightly sets defaults, headers and COP slice', async ({ page }) => {
    await l1Setup(page);
    await page.locator('#frequency').selectOption('fortnightly');
    await expect(page.locator('#defaultTaxable')).toHaveValue('2000.00');
    await expect(page.locator('#periodCount')).toHaveValue('6');
    await expect(page.locator('#startPeriod')).toHaveAttribute('max', '26');
    await expect(page.locator('#periodCount')).toHaveAttribute('max', '26');
    await expect(page.locator('#label-default-taxable')).toHaveText('Default taxable pay / fortnightly period (€)');
    await expect(page.locator('#label-start-period')).toHaveText('Start period # (fortnightly)');
    await expect(page.locator('#label-period-count')).toHaveText('Periods to build (fortnightly, max 26)');
    await expect(page.locator('#l1-worksheet-heading')).toHaveText('L1 Worksheet — fortnightly period basis');
    await expect(page.locator('#th-ws-period .sub')).toHaveText('(fortnightly)');
    await expect(page.locator('#th-ws-period-cop .sub')).toHaveText('(fortnightly)');
    await expect(page.locator('#th-ws-period-tc .sub')).toHaveText('(fortnightly)');
    await expect(page.locator('#th-ws-taxable .sub')).toHaveText('(fortnightly)');
    await expect(page.locator('#th-ws-period-cop')).toContainText('Period COP');
    await expect(page.locator('#paye-rows tr[data-idx]')).toHaveCount(6);
    const taxable = await page.locator('#paye-rows tr[data-idx="0"] input[data-field="taxablePay"]').inputValue();
    expect(taxable).toBe('2000.00');
    const cop = Number(await page.locator('#paye-rows tr[data-idx="0"] input[data-field="periodCop"]').inputValue());
    expect(cop).toBeCloseTo(44000 / 26, 1);
    const tc = Number(await page.locator('#paye-rows tr[data-idx="0"] input[data-field="periodTc"]').inputValue());
    expect(tc).toBeCloseTo(4000 / 26, 1);

    await page.locator('#startPeriod').fill('40');
    await page.locator('#startPeriod').dispatchEvent('change');
    await expect(page.locator('#startPeriod')).toHaveValue('26');
    await expect(page.locator('#periodCount')).toHaveValue('1');
    await expect(page.locator('#paye-rows tr[data-idx]')).toHaveCount(1);

    await page.locator('#tab-btn-l1-practice1').click();
    await page.locator('#btn-practice-build').click();
    await expect(page.locator('#l1-practice-heading')).toHaveText('L1 Practice 1 — fortnightly formula builder');
    await expect(page.locator('#th-pr-period .sub')).toHaveText('(fortnightly)');
    await expect(page.locator('#th-pr-period-cop .sub')).toHaveText('(fortnightly)');
    await expect(page.locator('#th-pr-period-tc .sub')).toHaveText('(fortnightly)');
    await expect(page.locator('#th-pr-taxable .sub')).toHaveText('(fortnightly)');
    await expect(page.locator('#th-pr-period-cop')).toContainText('Period COP');
    await expect(page.locator('#practice-rows tr[data-practice-row]')).toHaveCount(1);
    await expect(page.locator('#practice-rows tr[data-practice-row="0"] .practice-given[data-field="period"]')).toHaveText('26');
  });

  test('monthly sets defaults and clamps start/count to 12', async ({ page }) => {
    await l1Setup(page);
    await page.locator('#frequency').selectOption('monthly');
    await expect(page.locator('#defaultTaxable')).toHaveValue('4000.00');
    await expect(page.locator('#periodCount')).toHaveValue('4');
    await expect(page.locator('#startPeriod')).toHaveAttribute('max', '12');
    await expect(page.locator('#periodCount')).toHaveAttribute('max', '12');
    await expect(page.locator('#label-period-count')).toHaveText('Periods to build (monthly, max 12)');
    await expect(page.locator('#l1-worksheet-heading')).toHaveText('L1 Worksheet — monthly period basis');
    await expect(page.locator('#th-ws-period-cop .sub')).toHaveText('(monthly)');
    await expect(page.locator('#th-ws-period-tc .sub')).toHaveText('(monthly)');
    await expect(page.locator('#th-ws-taxable .sub')).toHaveText('(monthly)');
    await expect(page.locator('#th-ws-period-cop')).toContainText('Period COP');
    await expect(page.locator('#paye-rows tr[data-idx]')).toHaveCount(4);
    const cop = Number(await page.locator('#paye-rows tr[data-idx="0"] input[data-field="periodCop"]').inputValue());
    expect(cop).toBeCloseTo(3666.67, 1);
    const tc = Number(await page.locator('#paye-rows tr[data-idx="0"] input[data-field="periodTc"]').inputValue());
    expect(tc).toBeCloseTo(4000 / 12, 1);
    const taxable = await page.locator('#paye-rows tr[data-idx="0"] input[data-field="taxablePay"]').inputValue();
    expect(taxable).toBe('4000.00');

    await page.locator('#startPeriod').fill('20');
    await page.locator('#startPeriod').dispatchEvent('change');
    await expect(page.locator('#startPeriod')).toHaveValue('12');
    await expect(page.locator('#periodCount')).toHaveValue('1');

    await page.locator('#startPeriod').fill('1');
    await page.locator('#periodCount').fill('4');
    await page.locator('#startPeriod').dispatchEvent('change');
    await page.locator('#startPeriod').fill('10');
    await page.locator('#startPeriod').dispatchEvent('change');
    await expect(page.locator('#startPeriod')).toHaveValue('10');
    await expect(page.locator('#periodCount')).toHaveValue('3');
    await expect(page.locator('#periodCount')).toHaveAttribute('max', '3');
    await expect(page.locator('#paye-rows tr[data-idx]')).toHaveCount(3);

    await page.locator('#periodCount').fill('20');
    await page.locator('#periodCount').dispatchEvent('change');
    await expect(page.locator('#periodCount')).toHaveValue('3');

    await page.locator('#tab-btn-l1-practice1').click();
    await page.locator('#btn-practice-build').click();
    await expect(page.locator('#l1-practice-heading')).toHaveText('L1 Practice 1 — monthly formula builder');
    await expect(page.locator('#th-pr-period-cop .sub')).toHaveText('(monthly)');
    await expect(page.locator('#th-pr-period-tc .sub')).toHaveText('(monthly)');
    await expect(page.locator('#th-pr-taxable .sub')).toHaveText('(monthly)');
    await expect(page.locator('#th-pr-period-cop')).toContainText('Period COP');
    await expect(page.locator('#practice-rows tr[data-practice-row]')).toHaveCount(3);
    await expect(page.locator('#practice-rows tr[data-practice-row="0"] .practice-given[data-field="period"]')).toHaveText('10');
  });

  test('add period stops at the frequency maximum', async ({ page }) => {
    await l1Setup(page);
    await page.locator('#frequency').selectOption('monthly');
    await page.locator('#startPeriod').fill('1');
    await page.locator('#periodCount').fill('12');
    await page.locator('#periodCount').dispatchEvent('change');
    await expect(page.locator('#paye-rows tr[data-idx]')).toHaveCount(12);
    await page.locator('#btn-add-row').click();
    await expect(page.locator('#paye-rows tr[data-idx]')).toHaveCount(12);
  });
});
