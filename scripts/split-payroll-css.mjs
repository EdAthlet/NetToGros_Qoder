import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.join(__dirname, '..', 'payroll', 'payroll.css');
const lines = fs.readFileSync(cssPath, 'utf8').split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

const chunks = {
  'payroll-base.css': [
    [1, 251],
    [803, 895],
    [1483, 1934],
    [2635, 2664]
  ],
  'payroll-employees.css': [
    [252, 802],
    [2484, 2511]
  ],
  'payroll-run.css': [
    [896, 950],
    [2092, 2306],
    [2513, 2633]
  ],
  'payroll-payslip.css': [
    [951, 1271]
  ],
  'payroll-tables.css': [
    [1272, 1482],
    [2307, 2483],
    [2666, 2767]
  ],
  'payroll-print.css': [
    [1935, 2091]
  ]
};

const payrollDir = path.join(__dirname, '..', 'payroll');

for (const [file, ranges] of Object.entries(chunks)) {
  const header = `/* ${file} — extracted from payroll.css (Phase 3) */\n\n`;
  const body = ranges.map(([start, end]) => slice(start, end)).join('\n\n');
  fs.writeFileSync(path.join(payrollDir, file), header + body + '\n');
}

const aggregator = `/* Payroll styles — aggregator (Phase 3 split) */
@import url('payroll-base.css');
@import url('payroll-employees.css');
@import url('payroll-run.css');
@import url('payroll-payslip.css');
@import url('payroll-tables.css');
@import url('payroll-print.css');
`;

fs.writeFileSync(cssPath, aggregator);
console.log('Split payroll.css into', Object.keys(chunks).join(', '));