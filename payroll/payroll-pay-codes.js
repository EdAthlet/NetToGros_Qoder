/**
 * Thin pay-line codes on top of existing payroll totals.
 * Canonical tax fields on the entry remain the source of truth.
 */
var PayrollPayCodes = (function () {
    'use strict';

    function round2(value) {
        return Math.round((Number(value) || 0) * 100) / 100;
    }

    function addLine(lines, code, category, amount, source, metadata) {
        var n = round2(amount);
        if (!n) return;
        lines.push({
            code: code,
            category: category,
            amount: n,
            source: source || 'timesheet',
            metadata: metadata || {}
        });
    }

    function buildPayLines(entry) {
        var lines = [];
        if (!entry) return lines;
        addLine(lines, 'BASIC', 'earning', entry.regularGross || 0, 'timesheet');
        addLine(lines, 'OT', 'earning', entry.overtimeGross || 0, 'timesheet');
        addLine(lines, 'BIK', 'earning', entry.bikAmount || 0, 'statutory');
        addLine(lines, 'PAYE', 'deduction', entry.paye || 0, 'statutory');
        addLine(lines, 'USC', 'deduction', entry.usc || 0, 'statutory');
        addLine(lines, 'PRSI_EE', 'deduction', entry.prsi || 0, 'statutory');
        addLine(lines, 'PRSI_ER', 'employer', entry.employerPrsi || 0, 'statutory');
        addLine(lines, 'PENSION', 'deduction', entry.pensionDeduction || 0, 'timesheet');
        addLine(lines, 'LPT', 'deduction', entry.lpt || 0, 'statutory');

        (entry.adjustments || []).forEach(function (adj) {
            var delta = adj && adj.delta ? adj.delta : {};
            var meta = { adjustmentId: adj.id, targetPeriodNumber: adj.targetPeriodNumber };
            addLine(lines, 'ADJ_GROSS', 'earning', delta.grossPay, 'adjustment', meta);
            addLine(lines, 'ADJ_PAYE', 'deduction', delta.paye, 'adjustment', meta);
            addLine(lines, 'ADJ_USC', 'deduction', delta.usc, 'adjustment', meta);
            addLine(lines, 'ADJ_PRSI', 'deduction', delta.prsi, 'adjustment', meta);
        });
        return lines;
    }

    return {
        buildPayLines: buildPayLines
    };
})();
