import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const payrollDir = path.join(root, 'payroll');

function makeDepShim(names) {
  return names.map(function(name) {
    return `    function ${name}() { return deps.${name}.apply(deps, arguments); }`;
  }).join('\n');
}

const runDeps = [
  'getCompanyPayDay', 'getPayDayLabel', 'getCurrentPayPeriodContext', 'getCurrentPeriodVar',
  'getPeriodContextFromPayDate', 'getRevenueWeekNumberForDate', 'formatDateInputValue',
  'escapeHtml', 'safeFormatCurrency', 'formatLocalDateTime', 'formatLocalDateOnly',
  'isCloudMode', 'generatePeriodLabel', 'getPayrollStateSafe', 'isFrequencyDueForContext',
  'getPeriodNumberForFrequency', 'getEmployeePayFrequency', 'getPayFrequencyLabel',
  'initOrSyncLedger', 'getWeek1PeriodicCOPAllocation', 'getEmployeeAnnualTaxCredits',
  'getEmployeeCutOffPoint', 'calculatePAYE', 'calculateEstGross', 'showMessage',
  'showConfirmModal', 'switchTab', 'syncAllTables', 'updateEmergencyTrackingAfterRun',
  'getEmergencyPeriodWeeks'
];

const payslipDeps = [
  'getEmployeeAnnualTaxCredits', 'getEmployeeCutOffPoint', 'initOrSyncLedger',
  'getCompanyTaxNumber', 'getEmployerRegistrationNumber', 'generatePeriodLabel', 'switchTab'
];

function injectDeps(filePath, depNames, crossModule) {
  let content = fs.readFileSync(filePath, 'utf8');
  const shim = makeDepShim(depNames) + '\n' + crossModule;
  content = content.replace(
    /function callDep\(name\) \{[\s\S]*?\}\n\n/,
    function(match) {
      return match + shim + '\n\n';
    }
  );
  fs.writeFileSync(filePath, content);
}

injectDeps(path.join(payrollDir, 'payroll-run.js'), runDeps, `    function showPayslipFromEntry() {
        if (typeof PayrollPayslip !== 'undefined' && PayrollPayslip.showPayslipFromEntry) {
            return PayrollPayslip.showPayslipFromEntry.apply(PayrollPayslip, arguments);
        }
    }
    function renderTaxCreditsTable() {
        if (typeof PayrollHistory !== 'undefined' && PayrollHistory.renderTaxCreditsTable) {
            PayrollHistory.renderTaxCreditsTable();
        }
    }
    function expandHistoryItem(runId) {
        if (typeof PayrollHistory !== 'undefined' && PayrollHistory.expandHistoryItem) {
            PayrollHistory.expandHistoryItem(runId);
        }
    }`);

injectDeps(path.join(payrollDir, 'payroll-payslip.js'), payslipDeps, `    function exportPayslipCSV(entry, run) {
        if (typeof PayrollExports !== 'undefined' && PayrollExports.exportPayslipCSV) {
            PayrollExports.exportPayslipCSV(entry, run);
        }
    }`);

// Patch payroll.js: remove extracted ranges and sync context
let payroll = fs.readFileSync(path.join(payrollDir, 'payroll.js'), 'utf8');
let lines = payroll.split(/\r?\n/);

// Remove run block (1487-2980) and payslip block (3582-4282) - 1-based, adjust after first removal
const runStart = lines.findIndex(l => l.includes('// --- Run Payroll ---'));
const runEnd = lines.findIndex(l => l.includes('// --- Sync All Tables ---'));
const payslipStart = lines.findIndex(l => l.includes('// --- Payslips ---'));
const payslipEnd = lines.findIndex(l => l.includes('// --- Exports & History'));

const delegation = `    // --- Run Payroll (delegated to PayrollRun) ---
    function showRunPayroll() { return PayrollRun.showRunPayroll(); }
    function calculatePayroll() { return PayrollRun.calculatePayroll(); }
    function calculateTimesheetPreview() { return PayrollRun.calculateTimesheetPreview(); }
    function calculateEstGross(emp, regularHours, overtimeHours, hourlyRate) { return PayrollRun.calculateEstGross(emp, regularHours, overtimeHours, hourlyRate); }
    function confirmAndSaveRun() { return PayrollRun.confirmAndSaveRun(); }
    function rollbackLastCommit(skipConfirm) { return PayrollRun.rollbackLastCommit(skipConfirm); }
    function submitPeriod(skipConfirm) { return PayrollRun.submitPeriod(skipConfirm); }
    function openCommittedRunInHistory(runId) { return PayrollRun.openCommittedRunInHistory(runId); }
    function closeActionModal() { return PayrollRun.closeActionModal(); }
    function buildPayrollPreviewDataFromRun(run) { return PayrollRun.buildPayrollPreviewDataFromRun(run); }
    function buildPayrollPreviewHtml(runData, options) { return PayrollRun.buildPayrollPreviewHtml(runData, options); }
    function bindPayrollPreviewPayslipRows(previewDiv) { return PayrollRun.bindPayrollPreviewPayslipRows(previewDiv); }

    // --- Payslips (delegated to PayrollPayslip) ---
    function showPayslip(runId, employeeId) { return PayrollPayslip.showPayslip(runId, employeeId); }
    function showPayslipFromEntry(entry, run, entries, currentIndex) { return PayrollPayslip.showPayslipFromEntry(entry, run, entries, currentIndex); }
    function renderEmployeeCardPayslipPanel(entry, run, employeeId, periodNumber) { return PayrollPayslip.renderEmployeeCardPayslipPanel(entry, run, employeeId, periodNumber); }
    function clearEmployeeCardPayslipPanel() { return PayrollPayslip.clearEmployeeCardPayslipPanel(); }
    function printPayslip() { return PayrollPayslip.printPayslip(); }
    function buildBreakdownSteps(entry, employee, calcResult, opts) { return PayrollPayslip.buildBreakdownSteps(entry, employee, calcResult, opts); }
    function renderBreakdownSteps(steps) { return PayrollPayslip.renderBreakdownSteps(steps); }
`;

const beforeRun = lines.slice(0, runStart);
const syncStart = runEnd;
const between = lines.slice(syncStart, payslipStart);
const afterPayslip = lines.slice(payslipEnd);

lines = beforeRun.concat(delegation.split('\n')).concat(between).concat(afterPayslip);
payroll = lines.join('\n');

// State -> PayrollContext
payroll = payroll.replace(
  /    \/\/ --- State ---\n    let currentRunData = null;\n    let payslipReturnTab = 'history';\n    let currentPayslipContext = null;\n    let currentCompanyId = null;/,
  `    // --- State (shared via PayrollContext) ---
    function getCurrentRunData() { return PayrollContext.currentRunData; }
    function setCurrentRunData(value) { PayrollContext.currentRunData = value; }
    function getPayslipReturnTab() { return PayrollContext.payslipReturnTab; }
    function setPayslipReturnTab(value) { PayrollContext.payslipReturnTab = value; }`
);

payroll = payroll
  .replace(/\bcurrentRunData\b/g, 'PayrollContext.currentRunData')
  .replace(/\bcurrentPayslipContext\b/g, 'PayrollContext.currentPayslipContext')
  .replace(/\bpayslipReturnTab\b/g, 'PayrollContext.payslipReturnTab')
  .replace(/\bcurrentCompanyId\b/g, 'PayrollContext.currentCompanyId');

// Fix wireExtractedModules setPayslipReturnTab
payroll = payroll.replace(
  'setPayslipReturnTab: function(tab) { PayrollContext.payslipReturnTab = tab; }',
  'setPayslipReturnTab: function(tab) { PayrollContext.payslipReturnTab = tab; }'
);

fs.writeFileSync(path.join(payrollDir, 'payroll.js'), payroll);
console.log('Patched payroll.js, injected dep shims');