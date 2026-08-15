/**
 * Stage 1 GL posting lines: balanced Dr/Cr export, not a full ledger.
 */
var PayrollGL = (function () {
    'use strict';

    function round2(value) {
        return Math.round((Number(value) || 0) * 100) / 100;
    }

    function pushLine(lines, accountCode, side, amount) {
        var n = round2(amount);
        if (!n) return;
        lines.push({ accountCode: accountCode, side: side, amount: Math.abs(n) });
    }

    function buildEntryLines(entry) {
        var lines = [];
        var gross = round2(entry.grossPay);
        var paye = round2(entry.paye);
        var usc = round2(entry.usc);
        var prsi = round2(entry.prsi);
        var pension = round2(entry.pensionDeduction);
        var lpt = round2(entry.lpt);
        var net = round2(entry.netPay);
        var erPrsi = round2(entry.employerPrsi);

        pushLine(lines, 'WAGES_EXP', 'debit', gross);
        pushLine(lines, 'PAYE_CTRL', 'credit', paye);
        pushLine(lines, 'USC_CTRL', 'credit', usc);
        pushLine(lines, 'PRSI_EE_CTRL', 'credit', prsi);
        pushLine(lines, 'PENSION_CTRL', 'credit', pension);
        pushLine(lines, 'LPT_CTRL', 'credit', lpt);
        pushLine(lines, 'NET_WAGES', 'credit', net);
        pushLine(lines, 'PRSI_ER_EXP', 'debit', erPrsi);
        pushLine(lines, 'PRSI_ER_CTRL', 'credit', erPrsi);
        return lines;
    }

    function isBalanced(lines) {
        var debit = 0;
        var credit = 0;
        (lines || []).forEach(function (line) {
            if (line.side === 'debit') debit += line.amount;
            else credit += line.amount;
        });
        return Math.abs(round2(debit) - round2(credit)) < 0.02;
    }

    function buildBatch(run, companyId) {
        var lines = [];
        (run.entries || []).forEach(function (entry) {
            lines = lines.concat(buildEntryLines(entry));
        });
        return {
            id: (typeof PayrollStorage !== 'undefined' && PayrollStorage.generateId)
                ? PayrollStorage.generateId()
                : ('gl-' + Date.now()),
            postingDate: run.payDate || (run.runDate || '').slice(0, 10),
            taxYear: run.taxYear,
            periodNumber: run.periodNumber || (run.periodNumbers && run.periodNumbers.weekly) || '',
            sourceType: 'payroll_run',
            sourceId: run.id,
            companyId: companyId,
            lines: lines,
            balanced: isBalanced(lines)
        };
    }

    function recordRun(companyId, run) {
        if (typeof PayrollStorage === 'undefined' || !companyId || !run) return null;
        var batch = buildBatch(run, companyId);
        var list = PayrollStorage.loadGlPostings(companyId);
        list.push(batch);
        PayrollStorage.saveGlPostings(companyId, list);
        return batch;
    }

    function exportRunCsv(run, companyId) {
        var batch = buildBatch(run, companyId);
        var csv = 'Account,Side,Amount,Source,Pay Date,Employee\n';
        (run.entries || []).forEach(function (entry) {
            buildEntryLines(entry).forEach(function (line) {
                csv += line.accountCode + ',' + line.side + ',' + line.amount.toFixed(2) + ',';
                csv += (run.id || '') + ',' + (run.payDate || '') + ',';
                csv += '"' + String(entry.employeeName || '').replace(/"/g, '""') + '"\n';
            });
        });
        if (typeof PayrollExports !== 'undefined' && PayrollExports.downloadFile) {
            PayrollExports.downloadFile(csv, 'payroll-gl-' + (run.payDate || 'run') + '.csv', 'text/csv');
        } else {
            var blob = new Blob([csv], { type: 'text/csv' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'payroll-gl-' + (run.payDate || 'run') + '.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        return batch;
    }

    return {
        buildEntryLines: buildEntryLines,
        buildBatch: buildBatch,
        isBalanced: isBalanced,
        recordRun: recordRun,
        exportRunCsv: exportRunCsv
    };
})();
