import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadPrintApi() {
  const src = readFileSync(resolve('tools/annualised-paye/app.js'), 'utf8');
  const start = src.indexOf('var PayeLabPrint = (function ()');
  const end = src.indexOf('\n(function () {\n  \'use strict\';', start);
  if (start < 0 || end < 0) {
    throw new Error('Could not isolate PayeLabPrint from app.js');
  }
  const context = {
    document: {
      createElement: function () { return { textContent: '', parentNode: null }; }
    }
  };
  vm.createContext(context);
  vm.runInContext(src.slice(start, end), context);
  return context.PayeLabPrint;
}

describe('PAYE Lab print table', () => {
  it('builds a landscape print document with title, meta and table', () => {
    const api = loadPrintApi();
    const html = api.buildPrintDocument({
      title: 'PAYE Lab — Level 1 period-basis worksheet',
      meta: 'Weekly · Annual TC €4000.00',
      tableHtml: '<table><tr><td>1000.00</td></tr></table>',
      extrasHtml: '<div><span>Sum net tax</span><strong>€12.00</strong></div>'
    });
    expect(html).toMatch(/Level 1 period-basis worksheet/);
    expect(html).toMatch(/Weekly · Annual TC €4000\.00/);
    expect(html).toMatch(/<table><tr><td>1000\.00<\/td><\/tr><\/table>/);
    expect(html).toMatch(/Sum net tax/);
    expect(html).toMatch(/size:A4 landscape/);
    expect(html).toMatch(/window\.print/);
    expect(html).toMatch(/td\.print-blank,td\.is-empty/);
  });

  it('treats placeholder dashes as blank print values', () => {
    const api = loadPrintApi();
    expect(api.isBlankPrintValue('—')).toBe(true);
    expect(api.isBlankPrintValue('-')).toBe(true);
    expect(api.isBlankPrintValue('  ')).toBe(true);
    expect(api.isBlankPrintValue('76.92')).toBe(false);
    expect(api.isBlankPrintValue('1000.00')).toBe(false);
  });
});
