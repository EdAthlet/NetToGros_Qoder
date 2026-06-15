import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const payrollPath = path.join(root, 'payroll', 'payroll.js');
const lines = fs.readFileSync(payrollPath, 'utf8').split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function transformBody(body) {
  return body
    .replace(/\bcurrentRunData\b/g, 'PayrollContext.currentRunData')
    .replace(/\bcurrentPayslipContext\b/g, 'PayrollContext.currentPayslipContext')
    .replace(/\bpayslipReturnTab\b/g, 'PayrollContext.payslipReturnTab')
    .replace(/\bcurrentCompanyId\b/g, 'PayrollContext.currentCompanyId');
}

function wrapModule(name, body, extraHelpers) {
  return `// payroll/${name}.js — extracted in Phase 2 (Path A)
// Wired from payroll.js via ${name}.init()

var ${name} = (function() {
    'use strict';

    var deps = {};
${extraHelpers || ''}
    function init(dependencies) {
        deps = dependencies || {};
    }

    function callDep(name) {
        var fn = deps[name];
        return typeof fn === 'function' ? fn.apply(null, Array.prototype.slice.call(arguments, 1)) : undefined;
    }

${transformBody(body)}

    return {
        init: init,
${getExports(name)}
    };
})();
`;
}

function getExports(name) {
  const exportMap = {
    PayrollRun: `        showRunPayroll: showRunPayroll,
        calculatePayroll: calculatePayroll,
        calculateTimesheetPreview: calculateTimesheetPreview,
        calculateEstGross: calculateEstGross,
        confirmAndSaveRun: confirmAndSaveRun,
        rollbackLastCommit: rollbackLastCommit,
        submitPeriod: submitPeriod,
        openCommittedRunInHistory: openCommittedRunInHistory,
        closeActionModal: closeActionModal,
        buildPayrollPreviewDataFromRun: buildPayrollPreviewDataFromRun,
        buildPayrollPreviewHtml: buildPayrollPreviewHtml,
        bindPayrollPreviewPayslipRows: bindPayrollPreviewPayslipRows`,
    PayrollPayslip: `        showPayslip: showPayslip,
        showPayslipFromEntry: showPayslipFromEntry,
        renderEmployeeCardPayslipPanel: renderEmployeeCardPayslipPanel,
        clearEmployeeCardPayslipPanel: clearEmployeeCardPayslipPanel,
        printPayslip: printPayslip,
        buildEmployeeCardPayslipHtml: buildEmployeeCardPayslipHtml,
        buildBreakdownSteps: buildBreakdownSteps,
        renderBreakdownSteps: renderBreakdownSteps`
  };
  return exportMap[name] || '';
}

// payroll-context.js
const contextJs = `// payroll/payroll-context.js — shared mutable state across payroll modules
var PayrollContext = {
    currentRunData: null,
    payslipReturnTab: 'history',
    currentPayslipContext: null,
    currentCompanyId: null
};
`;
fs.writeFileSync(path.join(root, 'payroll', 'payroll-context.js'), contextJs);

// Run payroll: 1487-2980
const runBody = slice(1487, 2980).replace(/^    /gm, '    ');
fs.writeFileSync(path.join(root, 'payroll', 'payroll-run.js'), wrapModule('PayrollRun', runBody));

// Payslips: 3582-4282
const payslipBody = slice(3582, 4282).replace(/^    /gm, '    ');
const payslipHelpers = `
    function escapeHtml(text) {
        return PayrollUtils.escapeHtml(text);
    }
    function safeFormatCurrency(amount) {
        return PayrollUtils.safeFormatCurrency(amount);
    }
`;
fs.writeFileSync(path.join(root, 'payroll', 'payroll-payslip.js'), wrapModule('PayrollPayslip', payslipBody, payslipHelpers));

console.log('Wrote payroll-context.js, payroll-run.js, payroll-payslip.js');