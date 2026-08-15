/**
 * Prior-period corrections applied on the current payroll run.
 * Committed history stays immutable.
 */
var PayrollAdjustments = (function () {
    'use strict';

    function round2(value) {
        return Math.round((Number(value) || 0) * 100) / 100;
    }

    function snapshotAmounts(entry) {
        return {
            grossPay: round2(entry.grossPay),
            regularHours: Number(entry.regularHours) || 0,
            overtimeHours: Number(entry.overtimeHours) || 0,
            hourlyRate: Number(entry.hourlyRate) || 0,
            pensionDeduction: round2(entry.pensionDeduction),
            bikAmount: round2(entry.bikAmount),
            paye: round2(entry.paye),
            usc: round2(entry.usc),
            prsi: round2(entry.prsi),
            employerPrsi: round2(entry.employerPrsi),
            lpt: round2(entry.lpt),
            taxCreditsUsed: round2(entry.taxCreditsUsed),
            netPay: round2(entry.netPay),
            totalDeductions: round2(entry.totalDeductions)
        };
    }

    function periodsFor(frequency) {
        if (frequency === 'weekly') return 52;
        if (frequency === 'fortnightly') return 26;
        return 12;
    }

    function recalculateCorrected(original, overrides) {
        overrides = overrides || {};
        var freq = original.payFrequency || 'monthly';
        var periods = periodsFor(freq);
        var hourlyRate = original.hourlyRate || 0;
        var otMult = original.overtimeMultiplier || 1.5;
        var regularHours = overrides.regularHours != null ? Number(overrides.regularHours) : (original.regularHours || 0);
        var overtimeHours = overrides.overtimeHours != null ? Number(overrides.overtimeHours) : (original.overtimeHours || 0);
        var regularGross;
        var overtimeGross;
        var grossPay;

        if (overrides.grossPay != null && overrides.grossPay !== '') {
            grossPay = Number(overrides.grossPay);
            regularGross = grossPay;
            overtimeGross = 0;
        } else if (original.payType === 'hourly') {
            regularGross = regularHours * hourlyRate;
            overtimeGross = overtimeHours * hourlyRate * otMult;
            grossPay = regularGross + overtimeGross;
        } else {
            regularGross = original.regularGross != null ? original.regularGross : original.grossPay;
            overtimeGross = overtimeHours * hourlyRate * otMult;
            grossPay = regularGross + overtimeGross;
        }

        var pension = overrides.pensionDeduction != null ? Number(overrides.pensionDeduction) : (original.pensionDeduction || 0);
        var bik = overrides.bikAmount != null ? Number(overrides.bikAmount) : (original.bikAmount || 0);
        var taxable = Math.max(grossPay - pension + bik, 0);
        var annual = taxable * periods;
        var rpn = original.rpnSnapshot || {};
        var annualCop = rpn.cutOffPoint || ((original.copUsed || 0) * periods) || 44000;
        var periodTc = original.taxCreditsUsed || 0;
        var payeAt20 = Math.min(annual, annualCop) * 0.2;
        var payeAt40 = Math.max(annual - annualCop, 0) * 0.4;
        var paye = Math.max(0, (payeAt20 + payeAt40) / periods - periodTc);
        var usc = 0;
        var prsi = 0;
        if (typeof calculateNetFromGross === 'function') {
            var savedTab = typeof activeTab !== 'undefined' ? activeTab : null;
            if (typeof activeTab !== 'undefined') activeTab = freq;
            if (typeof updateTaxRatesForYear === 'function' && typeof selectedYear !== 'undefined') {
                updateTaxRatesForYear(selectedYear);
            }
            var result = calculateNetFromGross(annual, 'single');
            usc = (result.usc || 0) / periods;
            prsi = (result.prsi || 0) / periods;
            if (savedTab !== null) activeTab = savedTab;
        }
        var weeklyEquivalent = grossPay * (freq === 'weekly' ? 1 : freq === 'fortnightly' ? 0.5 : 12 / 52);
        var employerPrsi = grossPay * (weeklyEquivalent <= 441 ? 0.088 : 0.1105);
        var lpt = original.lpt || 0;
        var totalDeductions = paye + usc + prsi + pension + lpt;
        return {
            grossPay: round2(grossPay),
            regularHours: regularHours,
            overtimeHours: overtimeHours,
            hourlyRate: hourlyRate,
            pensionDeduction: round2(pension),
            bikAmount: round2(bik),
            paye: round2(paye),
            usc: round2(usc),
            prsi: round2(prsi),
            employerPrsi: round2(employerPrsi),
            lpt: round2(lpt),
            taxCreditsUsed: round2(periodTc),
            totalDeductions: round2(totalDeductions),
            netPay: round2(grossPay - totalDeductions)
        };
    }

    function makeDelta(originalSnap, corrected) {
        var delta = {};
        Object.keys(corrected).forEach(function (key) {
            delta[key] = round2((corrected[key] || 0) - (originalSnap[key] || 0));
        });
        return delta;
    }

    function createFromHistory(companyId, run, entry, overrides, reasonCode, reasonNotes) {
        if (!companyId || !run || !entry) return null;
        if (run.taxYear && typeof selectedYear !== 'undefined' && String(run.taxYear) !== String(selectedYear)) {
            return { error: 'Cross-year corrections are not supported in this version.' };
        }
        var original = snapshotAmounts(entry);
        original.payFrequency = entry.payFrequency;
        original.payType = entry.payType;
        original.regularGross = entry.regularGross;
        original.overtimeMultiplier = entry.overtimeMultiplier;
        original.rpnSnapshot = entry.rpnSnapshot;
        original.copUsed = entry.copUsed;
        var corrected = recalculateCorrected(original, overrides);
        var record = {
            id: PayrollStorage.generateId(),
            status: 'pending',
            targetRunId: run.id,
            targetEmployeeId: entry.employeeId,
            targetEmployeeName: entry.employeeName,
            targetPeriodNumber: entry.periodNumber || run.periodNumber,
            targetPayDate: entry.payDate || run.payDate,
            targetPayFrequency: entry.payFrequency || run.frequency,
            reasonCode: reasonCode || 'HOURS',
            reasonNotes: reasonNotes || '',
            original: original,
            corrected: corrected,
            delta: makeDelta(original, corrected),
            createdAt: new Date().toISOString()
        };
        var list = PayrollStorage.loadAdjustments(companyId);
        list.push(record);
        PayrollStorage.saveAdjustments(companyId, list);
        return record;
    }

    function getPendingForEmployee(companyId, employeeId) {
        return PayrollStorage.loadAdjustments(companyId).filter(function (item) {
            return item.status === 'pending' && item.targetEmployeeId === employeeId;
        });
    }

    function applyPendingToEntry(companyId, entry) {
        var pending = getPendingForEmployee(companyId, entry.employeeId);
        if (!pending.length) return entry;
        entry.adjustments = (entry.adjustments || []).concat(pending);
        pending.forEach(function (adj) {
            var d = adj.delta || {};
            entry.grossPay = round2((entry.grossPay || 0) + (d.grossPay || 0));
            entry.paye = round2((entry.paye || 0) + (d.paye || 0));
            entry.usc = round2((entry.usc || 0) + (d.usc || 0));
            entry.prsi = round2((entry.prsi || 0) + (d.prsi || 0));
            entry.lpt = round2((entry.lpt || 0) + (d.lpt || 0));
            entry.pensionDeduction = round2((entry.pensionDeduction || 0) + (d.pensionDeduction || 0));
            entry.employerPrsi = round2((entry.employerPrsi || 0) + (d.employerPrsi || 0));
            entry.totalDeductions = round2((entry.totalDeductions || 0) + (d.paye || 0) + (d.usc || 0) + (d.prsi || 0) + (d.lpt || 0) + (d.pensionDeduction || 0));
            entry.netPay = round2((entry.grossPay || 0) - (entry.totalDeductions || 0));
        });
        return entry;
    }

    function markApplied(companyId, runId, entries) {
        var used = {};
        (entries || []).forEach(function (entry) {
            (entry.adjustments || []).forEach(function (adj) {
                if (adj && adj.id) used[adj.id] = true;
            });
        });
        var list = PayrollStorage.loadAdjustments(companyId).map(function (item) {
            if (used[item.id] && item.status === 'pending') {
                item.status = 'applied';
                item.appliedRunId = runId;
                item.appliedAt = new Date().toISOString();
            }
            return item;
        });
        PayrollStorage.saveAdjustments(companyId, list);
    }

    function renderPayslipBlock(entry) {
        var adjs = entry && entry.adjustments ? entry.adjustments : [];
        if (!adjs.length) return '';
        var html = '<div class="ips-section-title">Prior period adjustments</div>';
        html += '<table class="ips-table"><thead><tr><th>Description</th><th class="text-right">Amount</th></tr></thead><tbody>';
        adjs.forEach(function (adj) {
            var d = adj.delta || {};
            var label = (adj.reasonNotes || adj.reasonCode || 'Adjustment') +
                ' — Period ' + (adj.targetPeriodNumber || '') +
                (adj.targetPayDate ? ' (' + adj.targetPayDate + ')' : '');
            html += '<tr><td colspan="2"><strong>' + PayrollUtils.escapeHtml(label) + '</strong></td></tr>';
            if (d.grossPay) html += '<tr><td>Gross correction</td><td class="text-right">' + PayrollUtils.safeFormatCurrency(d.grossPay) + '</td></tr>';
            if (d.paye) html += '<tr><td>PAYE correction</td><td class="text-right">' + PayrollUtils.safeFormatCurrency(d.paye) + '</td></tr>';
            if (d.usc) html += '<tr><td>USC correction</td><td class="text-right">' + PayrollUtils.safeFormatCurrency(d.usc) + '</td></tr>';
            if (d.prsi) html += '<tr><td>PRSI correction</td><td class="text-right">' + PayrollUtils.safeFormatCurrency(d.prsi) + '</td></tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function openCreateModal(run, entry) {
        var companyId = PayrollContext.currentCompanyId;
        if (!companyId || !run || !entry) return;
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.display = 'flex';
        modal.innerHTML =
            '<div class="modal-content modal-dialog" role="dialog" aria-modal="true">' +
            '<div class="modal-header"><h3 class="modal-title">Adjust prior period</h3>' +
            '<button type="button" class="modal-close-btn" data-adj-close aria-label="Close">&times;</button></div>' +
            '<div class="modal-body">' +
            '<p>Correct ' + PayrollUtils.escapeHtml(entry.employeeName || 'employee') +
            ' period ' + PayrollUtils.escapeHtml(String(entry.periodNumber || '')) +
            ' on the next payroll run. The original committed figures stay unchanged.</p>' +
            '<label>Reason</label>' +
            '<select id="adj-reason" class="form-select">' +
            '<option value="HOURS">Hours / gross</option>' +
            '<option value="OVERTIME">Missed overtime</option>' +
            '<option value="PENSION_BIK">Pension / BIK</option>' +
            '<option value="OTHER">Other</option>' +
            '</select>' +
            '<label>Corrected regular hours</label>' +
            '<input id="adj-hours" class="form-input" type="number" step="0.01" value="' + (entry.regularHours || 0) + '">' +
            '<label>Corrected overtime hours</label>' +
            '<input id="adj-ot" class="form-input" type="number" step="0.01" value="' + (entry.overtimeHours || 0) + '">' +
            '<label>Or corrected gross (€)</label>' +
            '<input id="adj-gross" class="form-input" type="number" step="0.01" placeholder="' + (entry.grossPay || 0) + '">' +
            '<label>Notes</label>' +
            '<input id="adj-notes" class="form-input" type="text" maxlength="200" placeholder="Shown on the next payslip">' +
            '</div>' +
            '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" data-adj-close>Cancel</button>' +
            '<button type="button" class="btn btn-primary" id="adj-save">Save adjustment</button>' +
            '</div></div>';
        document.body.appendChild(modal);
        function close() {
            if (modal.parentNode) modal.parentNode.removeChild(modal);
        }
        modal.addEventListener('click', function (event) {
            if (event.target === modal || event.target.getAttribute('data-adj-close') !== null) close();
        });
        modal.querySelector('#adj-save').addEventListener('click', function () {
            var overrides = {
                regularHours: modal.querySelector('#adj-hours').value,
                overtimeHours: modal.querySelector('#adj-ot').value
            };
            var grossVal = modal.querySelector('#adj-gross').value;
            if (grossVal) overrides.grossPay = grossVal;
            var created = createFromHistory(
                companyId,
                run,
                entry,
                overrides,
                modal.querySelector('#adj-reason').value,
                modal.querySelector('#adj-notes').value
            );
            if (created && created.error) {
                PayrollUI.showMessage(created.error, 'error');
                return;
            }
            PayrollUI.showMessage('Adjustment saved. It will apply on the next payroll run for this employee.', 'success');
            close();
        });
    }

    return {
        recalculateCorrected: recalculateCorrected,
        createFromHistory: createFromHistory,
        getPendingForEmployee: getPendingForEmployee,
        applyPendingToEntry: applyPendingToEntry,
        markApplied: markApplied,
        renderPayslipBlock: renderPayslipBlock,
        openCreateModal: openCreateModal
    };
})();
