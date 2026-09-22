import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Bulk Calculator export and money display', () => {
    const html = readFileSync(resolve('batch/index.html'), 'utf8');

    it('places Export PDF beside Export CSV and prints a practice sheet', () => {
        const csvAt = html.indexOf('Export CSV');
        const pdfAt = html.indexOf('Export PDF');
        const clearAt = html.indexOf('>Clear</button>');
        expect(csvAt).toBeGreaterThan(-1);
        expect(pdfAt).toBeGreaterThan(csvAt);
        expect(clearAt).toBeGreaterThan(pdfAt);
        expect(html).toContain('function exportResultsToPDF()');
        expect(html).toContain('window.print()');
        expect(html).toContain('Bulk Calculator — Free Payroll Practice');
        expect(html).toContain('Practice figures, not a payslip.');
        expect(html).toContain('Pay frequency');
        expect(html).toContain('id="startAmount" class="form-input money-input" value="800.00"');
    });

    it('shows money with two decimal places in results and CSV', () => {
        expect(html).toContain('minimumFractionDigits: 2');
        expect(html).toContain('maximumFractionDigits: 2');
        expect(html).toContain('r.gross.toFixed(2)');
        expect(html).toContain('r.net.toFixed(2)');
        expect(html).toContain('r.paye.toFixed(2)');
        expect(html).toContain('r.usc.toFixed(2)');
        expect(html).toContain('r.prsi.toFixed(2)');
        expect(html).toContain('r.totalDeductions.toFixed(2)');
        expect(html).toContain('formatMoney(batchMeta.start)');
        expect(html).not.toContain('batchMeta.start.toFixed(0)');
    });
});
