import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function extractFunction(source, name) {
    const signature = 'function ' + name + '(';
    const start = source.indexOf(signature);
    if (start < 0) throw new Error('missing ' + name);
    let depth = 0;
    for (let i = source.indexOf('{', start); i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error('unclosed ' + name);
}

function loadTakeHomeReader(search) {
    const html = readFileSync(resolve('index.html'), 'utf8');
    const fields = {
        manualTaxCredits: { value: '4000' },
        manualCutOffPoint: { value: '44000' },
        inputAmount: { value: '800' }
    };
    const context = {
        creditsFromQuery: null,
        selectedYear: '2026',
        TAX_RATES: {
            2024: {
                TAX_CREDITS: { personalCredit: 1875, employeeCredit: 1875 },
                PAYE_RATES: { standardBand: 42000 }
            },
            2026: {
                TAX_CREDITS: { personalCredit: 2000, employeeCredit: 2000 },
                PAYE_RATES: { standardBand: 44000 }
            }
        },
        taxStatus: { value: 'single' },
        document: {
            getElementById(id) {
                return fields[id] || null;
            }
        },
        window: { location: { search } },
        URLSearchParams,
        fields
    };
    context.updateTaxStatusInfo = function () {
        if (context.taxStatus.value === 'manual') context.updateManualInputDefaults();
    };
    vm.createContext(context);
    vm.runInContext(
        extractFunction(html, 'updateManualInputDefaults') + '\n' +
        extractFunction(html, 'applyCreditsQuery') + '\n' +
        'this.updateManualInputDefaults = updateManualInputDefaults;\n' +
        'this.applyCreditsQuery = applyCreditsQuery;',
        context
    );
    return context;
}

describe('Take Home Pay credits query', () => {
    it('opens Manual Tax Configuration and keeps the credits after the default reset', () => {
        const ctx = loadTakeHomeReader('?status=manual&credits=5200.5');
        ctx.applyCreditsQuery();
        expect(ctx.taxStatus.value).toBe('manual');
        expect(ctx.fields.manualTaxCredits.value).toBe('5200.5');
        expect(ctx.fields.inputAmount.value).toBe('800');

        ctx.updateTaxStatusInfo();
        expect(ctx.fields.manualTaxCredits.value).toBe('5200.5');
        expect(ctx.fields.inputAmount.value).toBe('800');
        expect(ctx.fields.manualCutOffPoint.value).toBe(44000);
    });

    it('leaves the weekly salary and single status alone when there is no query', () => {
        const ctx = loadTakeHomeReader('');
        ctx.applyCreditsQuery();
        expect(ctx.taxStatus.value).toBe('single');
        expect(ctx.creditsFromQuery).toBe(null);
        expect(ctx.fields.manualTaxCredits.value).toBe('4000');
        expect(ctx.fields.inputAmount.value).toBe('800');
    });
});

describe('Annual Tax Credits tip', () => {
    it('sits beside the label and links Tax Credits to the tax-credits page', () => {
        const html = readFileSync(resolve('index.html'), 'utf8');
        const labelAt = html.indexOf('Annual Tax Credits (€):');
        const inputAt = html.indexOf('id="manualTaxCredits"');
        const tipAt = html.indexOf('id="manualCreditsTip"');
        expect(labelAt).toBeGreaterThan(-1);
        expect(tipAt).toBeGreaterThan(labelAt);
        expect(tipAt).toBeLessThan(inputAt);
        expect(html).toContain('class="field-tip-btn"');
        expect(html).toContain('href="/tax-credits/">Tax Credits</a>');
        expect(html).toContain('Use in Take Home Pay');
        expect(html).toContain('value="800"');
    });

    it('shows 2026 cut-off bands beside the label without filling the field', () => {
        const html = readFileSync(resolve('index.html'), 'utf8');
        const labelAt = html.indexOf('PAYE Cut-off Point (€):');
        const inputAt = html.indexOf('id="manualCutOffPoint"');
        const tipAt = html.indexOf('id="manualCutoffTip"');
        const tipEnd = html.indexOf('</table>', tipAt);
        const tip = html.slice(tipAt, tipEnd);
        expect(tipAt).toBeGreaterThan(labelAt);
        expect(tipAt).toBeLessThan(inputAt);
        expect(tip).toContain('2026 published bands');
        expect(tip).toContain('taxed at 20% before 40%');
        expect(tip).toContain('Single / widowed');
        expect(tip).toContain('€44,000');
        expect(tip).toContain('€48,000');
        expect(tip).toContain('€53,000');
        expect(tip).toContain('up to €88,000 (extra band transferable, cap €35,000)');
        expect(tip).not.toContain('manualCutOffPoint');
        expect(html).toContain('value="44000"');
    });
});

describe('Tax credits Use in Take Home Pay link', () => {
    it('points at Take Home Pay manual credits and follows the formula total', () => {
        const source = readFileSync(resolve('tax-credits/tax-credits.js'), 'utf8');
        const context = {
            document: {
                getElementById(id) {
                    if (id === 'useInTakeHome') return context.link;
                    return { textContent: '' };
                }
            },
            formatEuro(value) {
                return '€' + value;
            },
            link: { href: '' }
        };
        vm.createContext(context);
        vm.runInContext(extractFunction(source, 'setSummary') + '\nsetSummary(2, 5900, 5900.2);', context);
        expect(context.link.href).toBe('/?status=manual&credits=5900.2');
        expect(context.link.href).not.toContain('/payroll/');
    });
});

describe('Tax credits print preview', () => {
    it('lists selected credits and quieter unselected ones, then prints', () => {
        const source = readFileSync(resolve('tax-credits/tax-credits.js'), 'utf8');
        const sheet = { innerHTML: '' };
        const context = {
            document: {
                readyState: 'loading',
                addEventListener() {},
                getElementById(id) {
                    return id === 'taxCreditsPrint' ? sheet : null;
                },
                querySelector() {
                    return null;
                },
                createElement() {
                    return {};
                }
            },
            window: {
                print() {
                    context.printed = true;
                }
            },
            printed: false,
            console
        };
        vm.createContext(context);
        vm.runInContext(
            source + '\nglobalThis.__tcPrint = { buildTaxCreditsPrintHtml, selectedIds, printTaxCreditsPreview };',
            context
        );
        const api = context.__tcPrint;
        api.selectedIds.add('personal_single');
        api.selectedIds.add('employee_paye');
        const model = api.buildTaxCreditsPrintHtml();
        expect(model.year).toBe(2026);
        expect(model.total).toBe('€4,000');
        expect(model.selected.map((item) => item.value)).toEqual(['€2,000', '€2,000']);
        expect(model.selected.some((item) => item.name.includes('Employee (PAYE)'))).toBe(true);
        expect(model.available.some((item) => item.name.includes('Employee (PAYE)'))).toBe(false);
        expect(model.available.length).toBeGreaterThan(0);

        api.printTaxCreditsPreview();
        expect(context.printed).toBe(true);
        expect(sheet.innerHTML).toContain('Tax Credits — Free Payroll Practice');
        expect(sheet.innerHTML).toContain('Tax year 2026');
        expect(sheet.innerHTML).toContain('Your total');
        expect(sheet.innerHTML).toContain('Selected');
        expect(sheet.innerHTML).toContain('Available but not selected');
        expect(sheet.innerHTML).toContain('Practice figures, not a Revenue certificate.');
        expect(sheet.innerHTML).not.toContain('Use in Take Home Pay');
    });
});
