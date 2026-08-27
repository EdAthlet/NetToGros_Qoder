const { test, expect } = require('@playwright/test');

async function uscSetup(page) {
  await page.goto('./');
  await page.locator('#level-btn-usc').click();
  await expect(page.locator('#setup-heading-usc')).toBeVisible();
}

test.describe('USC Lab 3 pay frequency', () => {
  test('fortnightly sets defaults, headers and Rate 1 COP slice', async ({ page }) => {
    await uscSetup(page);
    await page.locator('#usc-frequency').selectOption('fortnightly');
    await expect(page.locator('#usc-start-week')).toHaveValue('14');
    await expect(page.locator('#usc-period-count')).toHaveValue('6');
    await expect(page.locator('#usc-start-week')).toHaveAttribute('max', '26');
    await expect(page.locator('#label-usc-start')).toHaveText('Start period # (fortnightly)');
    await expect(page.locator('#usc-rate-cop1-label')).toHaveText('Rate 1 COP (fortnightly)');
    await expect(page.locator('#usc-practice-heading')).toHaveText('USC Practice 1 — fortnightly cumulative card');
    await expect(page.locator('#th-usc-period .sub').nth(1)).toHaveText('(fortnightly)');
    const cop1 = Number((await page.locator('#usc-weekly-cop1').innerText()).replace(/[^0-9.-]/g, ''));
    expect(cop1).toBeCloseTo(12012 / 26, 1);

    await page.locator('#tab-btn-usc-practice').click();
    await expect(page.locator('#usc-practice-rows tr[data-usc-row]')).toHaveCount(6);
    await expect(page.locator('#usc-practice-rows tr[data-usc-row="0"] .ipass-week')).toHaveText('14');
    const gross = await page.locator('#usc-practice-rows tr[data-usc-row="0"] .practice-prepop').innerText();
    expect(Number(gross)).toBeCloseTo(1960, 0);

    await page.locator('#usc-start-week').fill('40');
    await page.locator('#usc-start-week').dispatchEvent('change');
    await expect(page.locator('#usc-start-week')).toHaveValue('26');
    await expect(page.locator('#usc-period-count')).toHaveValue('1');
  });

  test('monthly sets defaults and clamps start/count to 12', async ({ page }) => {
    await uscSetup(page);
    await page.locator('#usc-frequency').selectOption('monthly');
    await expect(page.locator('#usc-start-week')).toHaveValue('7');
    await expect(page.locator('#usc-period-count')).toHaveValue('4');
    await expect(page.locator('#usc-start-week')).toHaveAttribute('max', '12');
    await expect(page.locator('#usc-practice-heading')).toHaveText('USC Practice 1 — monthly cumulative card');
    await expect(page.locator('#th-usc-gross .sub').nth(1)).toHaveText('(monthly)');
    const cop1 = Number((await page.locator('#usc-weekly-cop1').innerText()).replace(/[^0-9.-]/g, ''));
    expect(cop1).toBeCloseTo(12012 / 12, 1);

    await page.locator('#tab-btn-usc-practice').click();
    await expect(page.locator('#usc-practice-rows tr[data-usc-row]')).toHaveCount(4);
    await expect(page.locator('#usc-practice-rows tr[data-usc-row="0"] .ipass-week')).toHaveText('7');

    await page.locator('#usc-start-week').fill('20');
    await page.locator('#usc-start-week').dispatchEvent('change');
    await expect(page.locator('#usc-start-week')).toHaveValue('12');
    await expect(page.locator('#usc-period-count')).toHaveValue('1');

    await page.locator('#usc-start-week').fill('1');
    await page.locator('#usc-period-count').fill('4');
    await page.locator('#usc-start-week').dispatchEvent('change');
    await page.locator('#usc-start-week').fill('10');
    await page.locator('#usc-start-week').dispatchEvent('change');
    await expect(page.locator('#usc-start-week')).toHaveValue('10');
    await expect(page.locator('#usc-period-count')).toHaveValue('3');
  });
});
