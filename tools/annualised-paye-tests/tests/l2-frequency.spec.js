const { test, expect } = require('@playwright/test');

async function l2Setup(page) {
  await page.goto('./');
  await page.locator('#level-btn-2').click();
  await expect(page.locator('#setup-heading-l2')).toBeVisible();
}

test.describe('PAYE lab 2 pay frequency', () => {
  test('fortnightly sets defaults, headers and SRCOP slice', async ({ page }) => {
    await l2Setup(page);
    await page.locator('#ipass-frequency').selectOption('fortnightly');
    await expect(page.locator('#ipass-default-gross')).toHaveValue('1440.00');
    await expect(page.locator('#ipass-start-week')).toHaveValue('14');
    await expect(page.locator('#ipass-period-count')).toHaveValue('4');
    await expect(page.locator('#ipass-start-week')).toHaveAttribute('max', '26');
    await expect(page.locator('#label-ipass-start')).toHaveText('Start period # (fortnightly)');
    await expect(page.locator('#ipass-rate-srcop-label')).toHaveText('Period SRCOP (fortnightly)');
    await expect(page.locator('#l2-worksheet-heading')).toHaveText('L2 Worksheet — fortnightly cumulative card');
    await expect(page.locator('#th-l2-ws-period .sub').nth(1)).toHaveText('(fortnightly)');
    await expect(page.locator('#ipass-rows tr[data-ipass-idx]')).toHaveCount(4);
    await expect(page.locator('#ipass-rows tr[data-ipass-idx="0"] .ipass-week')).toHaveText('14');
    const gross = await page.locator('#ipass-rows tr[data-ipass-idx="0"] input[data-field="gross"]').inputValue();
    expect(gross).toBe('1440.00');
    const srcop = Number((await page.locator('#ipass-weekly-srcop').innerText()).replace(/[^0-9.-]/g, ''));
    expect(srcop).toBeCloseTo(44000 / 26, 1);
    const tc = Number((await page.locator('#ipass-weekly-tc').innerText()).replace(/[^0-9.-]/g, ''));
    expect(tc).toBeCloseTo(4000 / 26, 1);

    await page.locator('#ipass-start-week').fill('40');
    await page.locator('#ipass-start-week').dispatchEvent('change');
    await expect(page.locator('#ipass-start-week')).toHaveValue('26');
    await expect(page.locator('#ipass-period-count')).toHaveValue('1');
    await expect(page.locator('#ipass-rows tr[data-ipass-idx]')).toHaveCount(1);

    await page.locator('#tab-btn-l2-practice1').click();
    await page.locator('#btn-ipass-practice-build').click();
    await expect(page.locator('#l2-practice-heading')).toHaveText('L2 Practice 1 — fortnightly cumulative card');
    await expect(page.locator('#th-l2-pr-period .sub').nth(1)).toHaveText('(fortnightly)');
    await expect(page.locator('#ipass-practice-rows tr')).toHaveCount(1);
    await expect(page.locator('#ipass-practice-rows tr').first().locator('.ipass-week')).toHaveText('26');
  });

  test('monthly sets defaults and clamps start/count to 12', async ({ page }) => {
    await l2Setup(page);
    await page.locator('#ipass-frequency').selectOption('monthly');
    await expect(page.locator('#ipass-default-gross')).toHaveValue('3120.00');
    await expect(page.locator('#ipass-start-week')).toHaveValue('7');
    await expect(page.locator('#ipass-period-count')).toHaveValue('4');
    await expect(page.locator('#ipass-start-week')).toHaveAttribute('max', '12');
    await expect(page.locator('#l2-worksheet-heading')).toHaveText('L2 Worksheet — monthly cumulative card');
    await expect(page.locator('#th-l2-ws-period .sub').nth(1)).toHaveText('(monthly)');
    await expect(page.locator('#ipass-rows tr[data-ipass-idx]')).toHaveCount(4);
    await expect(page.locator('#ipass-rows tr[data-ipass-idx="0"] .ipass-week')).toHaveText('7');
    const srcop = Number((await page.locator('#ipass-weekly-srcop').innerText()).replace(/[^0-9.-]/g, ''));
    expect(srcop).toBeCloseTo(3666.67, 1);
    const gross = await page.locator('#ipass-rows tr[data-ipass-idx="0"] input[data-field="gross"]').inputValue();
    expect(gross).toBe('3120.00');

    await page.locator('#ipass-start-week').fill('20');
    await page.locator('#ipass-start-week').dispatchEvent('change');
    await expect(page.locator('#ipass-start-week')).toHaveValue('12');
    await expect(page.locator('#ipass-period-count')).toHaveValue('1');

    await page.locator('#ipass-start-week').fill('1');
    await page.locator('#ipass-period-count').fill('4');
    await page.locator('#ipass-start-week').dispatchEvent('change');
    await page.locator('#ipass-start-week').fill('10');
    await page.locator('#ipass-start-week').dispatchEvent('change');
    await expect(page.locator('#ipass-start-week')).toHaveValue('10');
    await expect(page.locator('#ipass-period-count')).toHaveValue('3');
    await expect(page.locator('#ipass-rows tr[data-ipass-idx]')).toHaveCount(3);

    await page.locator('#tab-btn-l2-practice1').click();
    await page.locator('#btn-ipass-practice-build').click();
    await expect(page.locator('#l2-practice-heading')).toHaveText('L2 Practice 1 — monthly cumulative card');
    await expect(page.locator('#th-l2-pr-gross .sub').nth(1)).toHaveText('(monthly)');
    await expect(page.locator('#ipass-practice-rows tr')).toHaveCount(3);
    await expect(page.locator('#ipass-practice-rows tr').first().locator('.ipass-week')).toHaveText('10');
  });
});
