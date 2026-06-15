// payroll/payroll-exports.js — CSV and Excel export helpers
// Depends on: utils.js (PayrollUtils)
// Wired from payroll.js via PayrollExports.init()

var PayrollExports = (function() {
    'use strict';

    var deps = {};

    function init(dependencies) {
        deps = dependencies || {};
    }

    function utils() {
        return typeof PayrollUtils !== 'undefined' ? PayrollUtils : null;
    }

    function escapeHtml(text) {
        var u = utils();
        if (u && u.escapeHtml) return u.escapeHtml(text);
        if (text == null) return '';
        return String(text);
    }

    function formatNumber(amount) {
        var u = utils();
        if (u && u.formatNumber) return u.formatNumber(amount);
        return (amount || 0).toFixed(2);
    }

    function csvNumber(amount) {
        var u = utils();
        if (u && u.csvNumber) return u.csvNumber(amount);
        return (amount || 0).toFixed(2);
    }

    function downloadFile(content, filename, mimeType) {
        var blob = new Blob([content], { type: mimeType });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    }

    function exportRunCSV(run) {
        var entries = run.entries || [];
        var csv = 'Employee,Gross,PAYE,USC,PRSI,Total Deductions,Net Pay\n';

        entries.forEach(function(e) {
            csv += '"' + (e.employeeName || '').replace(/"/g, '""') + '",';
            csv += csvNumber(e.grossPay) + ',';
            csv += csvNumber(e.paye) + ',';
            csv += csvNumber(e.usc) + ',';
            csv += csvNumber(e.prsi) + ',';
            csv += csvNumber(e.totalDeductions) + ',';
            csv += csvNumber(e.netPay) + '\n';
        });

        var totals = entries.reduce(function(acc, e) {
            acc.gross += e.grossPay || 0;
            acc.paye += e.paye || 0;
            acc.usc += e.usc || 0;
            acc.prsi += e.prsi || 0;
            acc.deductions += e.totalDeductions || 0;
            acc.net += e.netPay || 0;
            return acc;
        }, { gross: 0, paye: 0, usc: 0, prsi: 0, deductions: 0, net: 0 });

        csv += '"Totals",';
        csv += csvNumber(totals.gross) + ',';
        csv += csvNumber(totals.paye) + ',';
        csv += csvNumber(totals.usc) + ',';
        csv += csvNumber(totals.prsi) + ',';
        csv += csvNumber(totals.deductions) + ',';
        csv += csvNumber(totals.net) + '\n';

        var dateStr = new Date(run.runDate).toISOString().split('T')[0];
        downloadFile(csv, 'payroll-run-' + dateStr + '.csv', 'text/csv');
    }

    function exportCurrentRunCSV() {
        var currentRunData = deps.getCurrentRunData ? deps.getCurrentRunData() : null;
        if (!currentRunData) return;
        exportRunCSV({ runDate: new Date().toISOString(), entries: currentRunData.entries });
    }

    function exportRunExcel(run) {
        var entries = run.entries || [];
        var html = '<table border="1">';
        html += '<tr><th>Employee</th><th>Gross</th><th>PAYE</th><th>USC</th><th>PRSI</th><th>Total Deductions</th><th>Net Pay</th></tr>';

        entries.forEach(function(e) {
            html += '<tr>';
            html += '<td>' + escapeHtml(e.employeeName || '') + '</td>';
            html += '<td>' + formatNumber(e.grossPay) + '</td>';
            html += '<td>' + formatNumber(e.paye) + '</td>';
            html += '<td>' + formatNumber(e.usc) + '</td>';
            html += '<td>' + formatNumber(e.prsi) + '</td>';
            html += '<td>' + formatNumber(e.totalDeductions) + '</td>';
            html += '<td>' + formatNumber(e.netPay) + '</td>';
            html += '</tr>';
        });

        var totals = entries.reduce(function(acc, e) {
            acc.gross += e.grossPay || 0;
            acc.paye += e.paye || 0;
            acc.usc += e.usc || 0;
            acc.prsi += e.prsi || 0;
            acc.deductions += e.totalDeductions || 0;
            acc.net += e.netPay || 0;
            return acc;
        }, { gross: 0, paye: 0, usc: 0, prsi: 0, deductions: 0, net: 0 });

        html += '<tr><td><strong>Totals</strong></td>';
        html += '<td><strong>' + formatNumber(totals.gross) + '</strong></td>';
        html += '<td><strong>' + formatNumber(totals.paye) + '</strong></td>';
        html += '<td><strong>' + formatNumber(totals.usc) + '</strong></td>';
        html += '<td><strong>' + formatNumber(totals.prsi) + '</strong></td>';
        html += '<td><strong>' + formatNumber(totals.deductions) + '</strong></td>';
        html += '<td><strong>' + formatNumber(totals.net) + '</strong></td></tr>';
        html += '</table>';

        var dateStr = new Date(run.runDate).toISOString().split('T')[0];
        downloadFile(html, 'payroll-run-' + dateStr + '.xls', 'application/vnd.ms-excel');
    }

    function exportCurrentRunExcel() {
        var currentRunData = deps.getCurrentRunData ? deps.getCurrentRunData() : null;
        if (!currentRunData) return;
        exportRunExcel({ runDate: new Date().toISOString(), entries: currentRunData.entries });
    }

    function exportPayslipCSV(entry, run) {
        var csv = 'Item,Amount\n';
        csv += 'Basic Pay,' + csvNumber(entry.grossPay) + '\n';
        csv += 'PAYE,-' + csvNumber(entry.paye) + '\n';
        csv += 'USC,-' + csvNumber(entry.usc) + '\n';
        csv += 'PRSI,-' + csvNumber(entry.prsi) + '\n';
        csv += 'Total Deductions,-' + csvNumber(entry.totalDeductions) + '\n';
        csv += 'Net Pay,' + csvNumber(entry.netPay) + '\n';

        var filename = 'payslip-' + (entry.employeeName || 'employee').replace(/\s+/g, '-').toLowerCase() + '.csv';
        downloadFile(csv, filename, 'text/csv');
    }

    return {
        init: init,
        exportRunCSV: exportRunCSV,
        exportRunExcel: exportRunExcel,
        exportCurrentRunCSV: exportCurrentRunCSV,
        exportCurrentRunExcel: exportCurrentRunExcel,
        exportPayslipCSV: exportPayslipCSV
    };
})();