const { test, expect } = require('@playwright/test');

async function stubPrintWindow(page) {
  await page.addInitScript(() => {
    window.__printedHtml = '';
    window.open = function () {
      return {
        document: {
          open() {},
          write(html) { window.__printedHtml = String(html || ''); },
          close() {}
        }
      };
    };
  });
}

test.describe('PAYE Lab print table buttons', () => {
  test('Level 1 worksheet print includes current table values', async ({ page }) => {
    await stubPrintWindow(page);
    await page.goto('./');
    await page.locator('#btn-build').click();
    await expect(page.locator('#paye-rows tr[data-idx]')).not.toHaveCount(0);
    const firstTaxable = await page.locator('#paye-rows tr[data-idx="0"] input[data-field="taxablePay"]').inputValue();
    await page.locator('#btn-print-table').click();
    const html = await page.evaluate(() => window.__printedHtml);
    expect(html).toContain('Level 1 period-basis worksheet');
    expect(html).toContain(firstTaxable);
    expect(html).toContain('Sum net tax');
    expect(html).not.toMatch(/row-del|Remove period/);
  });

  test('Level 2 card print includes week and gross figures', async ({ page }) => {
    await stubPrintWindow(page);
    await page.goto('./');
    await page.locator('#level-btn-2').click();
    await expect(page.locator('#btn-ipass-print')).toBeVisible();
    await page.locator('#btn-ipass-build').click();
    await expect(page.locator('#ipass-rows tr[data-ipass-idx]')).not.toHaveCount(0);
    const week = await page.locator('#ipass-rows tr[data-ipass-idx="0"] .ipass-week').innerText();
    const gross = await page.locator('#ipass-rows tr[data-ipass-idx="0"] input[data-field="gross"]').inputValue();
    await page.locator('#btn-ipass-print').click();
    const html = await page.evaluate(() => window.__printedHtml);
    expect(html).toContain('Level 2 cumulative tax deduction card');
    expect(html).toContain(week.trim());
    expect(html).toContain(gross);
    expect(html).toContain('Opening D');
  });

  test('Level 1 practice print keeps student cell values and drops Check', async ({ page }) => {
    await stubPrintWindow(page);
    await page.goto('./');
    await page.locator('#tab-btn-l1-practice1').click();
    await page.locator('#btn-practice-build').click();
    await expect(page.locator('#practice-rows tr[data-practice-row]')).not.toHaveCount(0);
    const given = await page.locator('#practice-rows tr[data-practice-row="0"] .practice-prepop').innerText();
    await expect(page.locator('#btn-practice-print')).toBeVisible();
    await page.locator('#btn-practice-print').click();
    const html = await page.evaluate(() => window.__printedHtml);
    expect(html).toContain('L1 Practice 1');
    expect(html).toContain(given.trim());
    expect(html).toMatch(/print-blank/);
    expect(html).not.toMatch(/print-blank[^>]*>\s*(?:<span[^>]*>)?(?:—|–|-|−)/);
    expect(html).not.toMatch(/>Check</);
  });

  test('Level 2 practice print uses Cumulative Tax Deduction Card title', async ({ page }) => {
    await stubPrintWindow(page);
    await page.goto('./');
    await page.locator('#level-btn-2').click();
    await page.locator('#tab-btn-l2-practice1').click();
    await expect(page.locator('#tab-l2-practice1 h2')).toHaveText('L2 Practice 1 Cumulative Tax Deduction Card');
    await page.locator('#btn-ipass-practice-build').click();
    await expect(page.locator('#ipass-practice-rows tr')).not.toHaveCount(0);
    const week = await page.locator('#ipass-practice-rows tr').first().locator('.ipass-week').innerText();
    const gross = await page.locator('#ipass-practice-rows tr').first().locator('.ipass-driver').first().innerText();
    await expect(page.locator('#btn-ipass-practice-print')).toBeVisible();
    await page.locator('#btn-ipass-practice-print').click();
    const html = await page.evaluate(() => window.__printedHtml);
    expect(html).toContain('L2 Practice 1 Cumulative Tax Deduction Card');
    expect(html).toContain(week.trim());
    expect(html).toContain(gross.trim());
    expect(html).toMatch(/print-blank/);
    expect(html).not.toMatch(/print-blank[^>]*>\s*(?:<span[^>]*>)?(?:—|–|-|−)/);
    expect(html).not.toMatch(/>Check</);
  });
});
