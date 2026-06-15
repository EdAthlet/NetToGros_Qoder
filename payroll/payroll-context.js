// payroll/payroll-context.js — shared mutable state across payroll modules
var PayrollContext = {
    currentRunData: null,
    payslipReturnTab: 'history',
    currentPayslipContext: null,
    currentCompanyId: null
};
