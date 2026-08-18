const { test, expect } = require('@playwright/test');

test.describe('USC Lab', () => {
  test('thresholds tab shows 2026 bands split by period', async ({ page }) => {
    await page.goto('./');
    await page.locator('#level-btn-usc').click();
    await expect(page.locator('#tab-usc-rates')).toBeVisible();
    await expect(page.locator('#usc-rates-rows tr')).toHaveCount(4);
    const first = await page.locator('#usc-rates-rows tr').first().innerText();
    expect(first).toMatch(/0\.5%/);
    expect(first).toMatch(/12,012|12012/);
    expect(first).toMatch(/231/);
    await expect(page.locator('#usc-weekly-cop1')).toContainText('231');
  });

  test('practice card uses amended 2026 grosses and oval builder', async ({ page }) => {
    await page.goto('./#usc-practice');
    await page.locator('#level-btn-usc').click();
    await page.locator('#tab-btn-usc-practice').click();
    await page.locator('#btn-usc-practice-build').click();
    await expect(page.locator('#usc-practice-rows tr[data-usc-row]')).toHaveCount(8);
    const firstGross = await page.locator('#usc-practice-rows tr[data-usc-row="0"] .practice-prepop').innerText();
    expect(firstGross.trim()).toBe('980.00');
    await page.locator('#usc-practice-rows tr[data-usc-row="0"] .practice-cell-btn').first().click();
    await expect(page.locator('#usc-formula-workspace')).toBeVisible();
    await expect(page.locator('#usc-formula-operands .value-chip')).not.toHaveCount(0);
  });
});
