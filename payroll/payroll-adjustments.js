/**
 * Prior-period corrections applied on the current payroll run.
 * Committed history stays immutable. One store; Adjustments tab + employee card.
 */
var PayrollAdjustments = (function () {
    'use strict';

    var CHANGE_TYPES = {
        HOURS: 'Hours / gross',
        OVERTIME: 'Missed overtime',
        PENSION_BIK: 'Pension / BIK',
        OTHER: 'Other'
    };

    var workspaceFilter = { status: 'all', employeeId: '' };

    function round2(value) {
        return Math.round((Number(value) || 0) * 100) / 100;
    }

    function escapeHtml(value) {
        if (typeof PayrollUtils !== 'undefined' && PayrollUtils.escapeHtml) {
            return PayrollUtils.escapeHtml(value);
        }
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatMoney(value) {
        if (typeof PayrollUtils !== 'undefined' && PayrollUtils.safeFormatCurrency) {
            return PayrollUtils.safeFormatCurrency(value || 0);
        }
        return '€' + round2(value || 0).toFixed(2);
    }

    function signedMoney(value) {
        var amount = round2(value || 0);
        if (Math.abs(amount) < 0.005) return formatMoney(0);
        return (amount > 0 ? '+' : '−') + formatMoney(Math.abs(amount));
    }

    function changeTypeLabel(code) {
        return CHANGE_TYPES[code] || code || 'Hours / gross';
    }

    function snapshotAmounts(entry) {
        return {
            grossPay: round2(entry.grossPay),
            regularHours: Number(entry.regularHours) || 0,
            overtimeHours: Number(entry.overtimeHours) || 0,
            hourlyRate: Number(entry.hourlyRate) || 0,
            overtimeMultiplier: Number(entry.overtimeMultiplier) || 1.5,
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

    function snapshotPeriodRates(entry) {
        var hourly = Number(entry.hourlyRate) || 0;
        var otMult = Number(entry.overtimeMultiplier) || 1.5;
        return {
            hourlyRate: hourly,
            overtimeMultiplier: otMult,
            overtimeRate: round2(hourly * otMult),
            payType: entry.payType || '',
            payFrequency: entry.payFrequency || ''
        };
    }

    function ratesFor(adj) {
        if (adj && adj.periodRates) return adj.periodRates;
        var orig = (adj && adj.original) || {};
        return snapshotPeriodRates(orig);
    }

    function formatRates(adj) {
        var rates = ratesFor(adj);
        var hourly = Number(rates.hourlyRate) || 0;
        var otMult = Number(rates.overtimeMultiplier) || 1.5;
        var otRate = rates.overtimeRate != null ? Number(rates.overtimeRate) : round2(hourly * otMult);
        if (!hourly) return '—';
        return formatMoney(hourly) + '/hr · OT ×' + otMult + ' (' + formatMoney(otRate) + ')';
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
            var originalHours = Number(original.regularHours) || 0;
            var hoursChanged = overrides.regularHours != null && Number(overrides.regularHours) !== originalHours;
            if (hoursChanged) {
                var impliedRate = hourlyRate;
                if (!impliedRate && originalHours > 0) {
                    impliedRate = (original.regularGross || original.grossPay || 0) / originalHours;
                }
                regularGross = Number(overrides.regularHours) * (impliedRate || 0);
                overtimeGross = overtimeHours * (impliedRate || 0) * otMult;
                grossPay = regularGross + overtimeGross;
            } else {
                regularGross = original.regularGross != null ? original.regularGross : original.grossPay;
                overtimeGross = overtimeHours * hourlyRate * otMult;
                grossPay = regularGross + overtimeGross;
            }
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
            overtimeMultiplier: otMult,
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

    function sumDeltas(items) {
        var sum = {};
        (items || []).forEach(function (item) {
            var d = item.delta || {};
            Object.keys(d).forEach(function (key) {
                sum[key] = round2((sum[key] || 0) + (d[key] || 0));
            });
        });
        return sum;
    }

    function subtractDelta(fullDelta, priorSum) {
        var delta = {};
        var keys = {};
        Object.keys(fullDelta || {}).forEach(function (key) { keys[key] = true; });
        Object.keys(priorSum || {}).forEach(function (key) { keys[key] = true; });
        Object.keys(keys).forEach(function (key) {
            delta[key] = round2((fullDelta[key] || 0) - (priorSum[key] || 0));
        });
        return delta;
    }

    function deltaHasChange(delta) {
        return Object.keys(delta || {}).some(function (key) {
            return Math.abs(delta[key] || 0) >= 0.005;
        });
    }

    function loadAll(companyId) {
        if (typeof PayrollStorage === 'undefined' || !companyId) return [];
        return PayrollStorage.loadAdjustments(companyId) || [];
    }

    function sameClosedPeriod(item, employeeId, periodNumber, payFrequency, targetRunId) {
        if (!item || item.targetEmployeeId !== employeeId) return false;
        if (String(item.targetPeriodNumber) !== String(periodNumber)) return false;
        if (item.status !== 'pending' && item.status !== 'applied') return false;
        if (targetRunId && item.targetRunId && item.targetRunId !== targetRunId) return false;
        if (payFrequency && item.targetPayFrequency && item.targetPayFrequency !== payFrequency) return false;
        return true;
    }

    function listPriorForTarget(companyId, employeeId, periodNumber, payFrequency, targetRunId) {
        return loadAll(companyId)
            .filter(function (item) {
                return sameClosedPeriod(item, employeeId, periodNumber, payFrequency, targetRunId);
            })
            .slice()
            .sort(function (a, b) {
                return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
            });
    }

    function createFromHistory(companyId, run, entry, overrides, reasonCode, reasonNotes) {
        if (!companyId || !run || !entry) return null;
        if ((run.status || '') !== 'submitted') {
            return { error: 'Adjust only works on submitted (closed) periods. Rollback the current commit if you still need to change this run.' };
        }
        if (run.taxYear && typeof selectedYear !== 'undefined' && String(run.taxYear) !== String(selectedYear)) {
            return { error: 'Cross-year corrections are not supported in this version.' };
        }
        var original = snapshotAmounts(entry);
        original.payFrequency = entry.payFrequency;
        original.payType = entry.payType;
        original.regularGross = entry.regularGross;
        original.overtimeMultiplier = entry.overtimeMultiplier || 1.5;
        original.rpnSnapshot = entry.rpnSnapshot;
        original.copUsed = entry.copUsed;
        var corrected = recalculateCorrected(original, overrides);
        var fullDelta = makeDelta(original, corrected);
        var prior = listPriorForTarget(
            companyId,
            entry.employeeId,
            entry.periodNumber || run.periodNumber,
            entry.payFrequency || run.frequency,
            run.id
        );
        var priorDelta = sumDeltas(prior);
        var delta = subtractDelta(fullDelta, priorDelta);
        if (!deltaHasChange(delta)) {
            return { error: prior.length
                ? 'Nothing further to pay. Earlier adjustments already move this closed period to those figures.'
                : 'Nothing changed. Enter different hours or a corrected gross, then save.' };
        }
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
            changeType: reasonCode || 'HOURS',
            reasonNotes: reasonNotes || '',
            periodRates: snapshotPeriodRates(entry),
            original: original,
            corrected: corrected,
            fullDelta: fullDelta,
            priorAdjustmentIds: prior.map(function (item) { return item.id; }),
            priorDelta: priorDelta,
            delta: delta,
            createdAt: new Date().toISOString()
        };
        var list = loadAll(companyId);
        list.push(record);
        PayrollStorage.saveAdjustments(companyId, list);
        return record;
    }

    function listPending(companyId) {
        return loadAll(companyId).filter(function (item) {
            return item.status === 'pending';
        });
    }

    function getPendingForEmployee(companyId, employeeId) {
        return loadAll(companyId).filter(function (item) {
            return item.status === 'pending' && item.targetEmployeeId === employeeId;
        });
    }

    function listForEmployee(companyId, employeeId) {
        if (!companyId || !employeeId) return [];
        return loadAll(companyId)
            .filter(function (item) { return item.targetEmployeeId === employeeId; })
            .slice()
            .sort(function (a, b) {
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            });
    }

    function listAll(companyId) {
        return loadAll(companyId).slice().sort(function (a, b) {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
    }

    function formatRegisterDate(value) {
        if (!value) return '—';
        var date = new Date(value);
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function appliedPeriodLabel(companyId, adj) {
        if (!adj.appliedRunId || typeof PayrollStorage === 'undefined') return '—';
        var run = (PayrollStorage.loadPayrollRuns ? PayrollStorage.loadPayrollRuns(companyId) : []).find(function (item) {
            return item.id === adj.appliedRunId;
        });
        if (!run) return 'Applied';
        var period = adj.appliedPeriodNumber || run.periodNumber ||
            (run.periodNumbers && (run.periodNumbers.weekly || run.periodNumbers.monthly)) || '';
        return period ? ('Period ' + period) : 'Applied';
    }

    function hoursGrossCell(adj) {
        var orig = adj.original || {};
        var corr = adj.corrected || {};
        var hours = (orig.regularHours || 0) + ' → ' + (corr.regularHours || 0);
        var otOrig = Number(orig.overtimeHours) || 0;
        var otCorr = Number(corr.overtimeHours) || 0;
        if (otOrig || otCorr) {
            hours += ' (OT ' + otOrig + ' → ' + otCorr + ')';
        }
        var gross = formatMoney(orig.grossPay || 0) + ' → ' + formatMoney(corr.grossPay || 0);
        return escapeHtml(hours) + '<br><span class="adj-gross-line">' + escapeHtml(gross) + '</span>';
    }

    function statusBadge(adj) {
        var pending = adj.status === 'pending';
        return '<span class="adj-status-badge' + (pending ? ' adj-status-pending' : ' adj-status-applied') + '">' +
            (pending ? 'Pending' : 'Applied') + '</span>';
    }

    function renderEmployeeRegister(companyId, employeeId) {
        var items = listForEmployee(companyId, employeeId);
        var html = '<div class="employee-adjustment-register">';
        html += '<h3>Prior-period adjustments</h3>';
        html += '<p class="employee-adjustment-note">Read-only history for this employee (same records as the Adjustments tab). Rates are those used on the closed period. Click a row for the calculation. Pending items apply on the next Calculate Preview; applied items were paid on a later run. The original submitted period is not rewritten.</p>';
        html += '<div class="emp-history-scroll">';
        html += '<table class="employee-history-table employee-adjustment-table">';
        html += '<thead><tr>';
        html += '<th>Queued</th><th>Closed period</th><th>Type</th><th>Period rates</th><th>Hours / gross</th><th>This adj.</th><th>Applied on</th><th>Status</th>';
        html += '</tr></thead><tbody>';
        if (!items.length) {
            html += '<tr class="adj-register-empty"><td colspan="8" class="text-center">No prior-period adjustments for this employee</td></tr>';
        } else {
            items.forEach(function (adj) {
                var pending = adj.status === 'pending';
                html += '<tr class="emp-adj-row emp-adj-clickable' + (pending ? '' : ' emp-adj-applied') + '"' +
                    ' data-adj-id="' + escapeHtml(adj.id) + '"' +
                    (adj.appliedRunId ? ' data-applied-run-id="' + escapeHtml(adj.appliedRunId) + '"' : '') +
                    ' data-employee-id="' + escapeHtml(employeeId) + '"' +
                    ' tabindex="0" role="button">';
                html += '<td>' + escapeHtml(formatRegisterDate(adj.createdAt)) + '</td>';
                html += '<td>Period ' + escapeHtml(String(adj.targetPeriodNumber || '')) + '</td>';
                html += '<td>' + escapeHtml(changeTypeLabel(adj.changeType || adj.reasonCode)) + '</td>';
                html += '<td class="adj-rates-cell">' + escapeHtml(formatRates(adj)) + '</td>';
                html += '<td>' + hoursGrossCell(adj) + '</td>';
                html += '<td>' + escapeHtml(signedMoney((adj.delta || {}).grossPay)) + '</td>';
                html += '<td>' + escapeHtml(pending ? '—' : appliedPeriodLabel(companyId, adj)) + '</td>';
                html += '<td>' + statusBadge(adj) + '</td>';
                html += '</tr>';
            });
        }
        html += '</tbody></table></div></div>';
        return html;
    }

    function bindEmployeeRegister(root, employeeId) {
        if (!root) return;
        var companyId = typeof PayrollContext !== 'undefined' ? PayrollContext.currentCompanyId : null;
        root.querySelectorAll('.emp-adj-clickable').forEach(function (row) {
            function open() {
                var adjId = row.getAttribute('data-adj-id');
                if (!adjId || !companyId) return;
                var adj = loadAll(companyId).find(function (item) { return item.id === adjId; });
                if (adj) showDetailPopup(companyId, adj, { returnTab: 'employees', employeeId: employeeId });
            }
            row.addEventListener('click', open);
            row.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open();
                }
            });
        });
    }

    function breakdownRows() {
        return [
            { key: 'regularHours', label: 'Regular hours', money: false },
            { key: 'overtimeHours', label: 'Overtime hours', money: false },
            { key: 'hourlyRate', label: 'Hourly rate (period)', money: true },
            { key: 'grossPay', label: 'Gross', money: true },
            { key: 'paye', label: 'PAYE', money: true },
            { key: 'usc', label: 'USC', money: true },
            { key: 'prsi', label: 'PRSI', money: true },
            { key: 'lpt', label: 'LPT', money: true },
            { key: 'pensionDeduction', label: 'Pension', money: true },
            { key: 'employerPrsi', label: 'Employer PRSI', money: true },
            { key: 'netPay', label: 'Net', money: true }
        ];
    }

    function formatBreakdownValue(value, money) {
        if (money) return formatMoney(value || 0);
        var n = Number(value);
        if (!isFinite(n)) return '—';
        return String(n);
    }

    function formatBreakdownDelta(value, money) {
        var amount = round2(value || 0);
        if (money) return signedMoney(amount);
        if (Math.abs(amount) < 0.005) return '0';
        return (amount > 0 ? '+' : '') + String(amount);
    }

    function renderDetailHtml(companyId, adj) {
        var orig = adj.original || {};
        var corr = adj.corrected || {};
        var delta = adj.delta || {};
        var prior = adj.priorDelta || {};
        var hasPrior = (adj.priorAdjustmentIds && adj.priorAdjustmentIds.length) || deltaHasChange(prior);
        var html = '<div class="adj-detail-body">';
        html += '<p class="adj-detail-meta"><strong>' + escapeHtml(adj.targetEmployeeName || 'Employee') + '</strong>';
        html += ' · closed period ' + escapeHtml(String(adj.targetPeriodNumber || ''));
        if (adj.targetPayDate) html += ' (' + escapeHtml(String(adj.targetPayDate)) + ')';
        html += '</p>';
        html += '<p class="adj-detail-meta">Type: <strong>' + escapeHtml(changeTypeLabel(adj.changeType || adj.reasonCode)) + '</strong>';
        html += ' · Period rates: ' + escapeHtml(formatRates(adj));
        html += '</p>';
        if (adj.reasonNotes) {
            html += '<p class="adj-detail-notes">' + escapeHtml(adj.reasonNotes) + '</p>';
        }
        html += '<p class="adj-detail-status">Status: ' + statusBadge(adj);
        if (adj.status !== 'pending') {
            html += ' · paid on ' + escapeHtml(appliedPeriodLabel(companyId, adj));
        } else {
            html += ' · applies on the next Calculate Preview';
        }
        html += '</p>';
        if (hasPrior) {
            html += '<p class="adj-detail-netting">This is a further correction of the same closed period. Earlier adjustments already moved gross by ' +
                escapeHtml(signedMoney(prior.grossPay)) +
                '. This row pays only the remaining difference.</p>';
        }
        html += '<div class="emp-history-scroll"><table class="adj-detail-table">';
        html += '<thead><tr><th>Item</th><th class="text-right">Filed</th><th class="text-right">Should be</th><th class="text-right">This adjustment</th></tr></thead><tbody>';
        breakdownRows().forEach(function (row) {
            var origVal = orig[row.key];
            var corrVal = corr[row.key];
            var dVal = delta[row.key];
            if (row.key === 'hourlyRate' && origVal == null) origVal = ratesFor(adj).hourlyRate;
            if (row.key === 'hourlyRate' && corrVal == null) corrVal = origVal;
            html += '<tr>';
            html += '<td>' + escapeHtml(row.label) + '</td>';
            html += '<td class="text-right">' + escapeHtml(formatBreakdownValue(origVal, row.money)) + '</td>';
            html += '<td class="text-right">' + escapeHtml(formatBreakdownValue(corrVal, row.money)) + '</td>';
            html += '<td class="text-right">' + escapeHtml(formatBreakdownDelta(dVal, row.money)) + '</td>';
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        html += '<p class="adj-detail-footnote">The submitted History run stays as filed. Deltas are bonded to this employee and apply on a later open payroll.</p>';
        html += '</div>';
        return html;
    }

    function closeOverlay(node) {
        if (node && node.parentNode) node.parentNode.removeChild(node);
    }

    function showDetailPopup(companyId, adj, options) {
        options = options || {};
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.display = 'flex';
        var footer = '<button type="button" class="btn btn-secondary" data-adj-close>Close</button>';
        if (adj.status !== 'pending' && adj.appliedRunId) {
            footer = '<button type="button" class="btn btn-secondary" id="adj-open-payslip">Open payslip</button>' + footer;
        }
        modal.innerHTML =
            '<div class="modal-content modal-dialog adj-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="adj-detail-title">' +
            '<div class="modal-header"><h3 class="modal-title" id="adj-detail-title">Adjustment calculation</h3>' +
            '<button type="button" class="modal-close-btn" data-adj-close aria-label="Close">&times;</button></div>' +
            '<div class="modal-body">' + renderDetailHtml(companyId, adj) + '</div>' +
            '<div class="modal-footer">' + footer + '</div></div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (event) {
            if (event.target === modal || event.target.getAttribute('data-adj-close') !== null) closeOverlay(modal);
        });
        var payslipBtn = modal.querySelector('#adj-open-payslip');
        if (payslipBtn) {
            payslipBtn.addEventListener('click', function () {
                closeOverlay(modal);
                if (typeof PayrollPayslip === 'undefined' || !PayrollPayslip.showPayslip) return;
                if (typeof PayrollContext !== 'undefined') {
                    PayrollContext.payslipReturnTab = options.returnTab || 'adjustments';
                }
                PayrollPayslip.showPayslip(adj.appliedRunId, options.employeeId || adj.targetEmployeeId);
            });
        }
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
        var list = loadAll(companyId).map(function (item) {
            if (used[item.id] && item.status === 'pending') {
                item.status = 'applied';
                item.appliedRunId = runId;
                item.appliedAt = new Date().toISOString();
                var appliedEntry = (entries || []).find(function (entry) {
                    return (entry.adjustments || []).some(function (adj) { return adj && adj.id === item.id; });
                });
                if (appliedEntry && appliedEntry.periodNumber) {
                    item.appliedPeriodNumber = appliedEntry.periodNumber;
                }
            }
            return item;
        });
        PayrollStorage.saveAdjustments(companyId, list);
    }

    function renderPendingBanner(companyId) {
        var pending = listPending(companyId);
        if (!pending.length) return '';
        var html = '<div class="adjustment-pending-banner" role="status">';
        html += '<p><strong>' + pending.length + ' pending prior-period adjustment' +
            (pending.length === 1 ? '' : 's') + '.</strong> ';
        html += 'History and the committed preview stay as originally paid. The correction is added on the <em>next</em> payroll calculation. Review the full list on the <strong>Adjustments</strong> tab.</p>';
        html += '<ul>';
        pending.forEach(function (adj) {
            var d = adj.delta || {};
            var orig = adj.original || {};
            var corr = adj.corrected || {};
            html += '<li><strong>' + escapeHtml(adj.targetEmployeeName || 'Employee') +
                '</strong> — period ' + escapeHtml(String(adj.targetPeriodNumber || '')) +
                ': hours ' + (orig.regularHours || 0) + ' → ' + (corr.regularHours || 0) +
                ', gross ' + formatMoney(orig.grossPay || 0) +
                ' → ' + formatMoney(corr.grossPay || 0);
            if (d.grossPay) html += ' (this adj. ' + signedMoney(d.grossPay) + ')';
            html += '</li>';
        });
        html += '</ul>';
        html += '<p><strong>Next:</strong> go to Run Payroll and <em>Calculate Preview</em> for the current open period. The amendment is added there and on that payslip. The submitted History run stays as filed.</p>';
        html += '</div>';
        return html;
    }

    function renderPayslipBlock(entry) {
        var adjs = entry && entry.adjustments ? entry.adjustments : [];
        if (!adjs.length) return '';
        var html = '<div class="ips-section-title">Prior period adjustments</div>';
        html += '<table class="ips-table"><thead><tr><th>Description</th><th class="text-right">Amount</th></tr></thead><tbody>';
        adjs.forEach(function (adj) {
            var d = adj.delta || {};
            var label = (adj.reasonNotes || changeTypeLabel(adj.changeType || adj.reasonCode) || 'Adjustment') +
                ' — Period ' + (adj.targetPeriodNumber || '') +
                (adj.targetPayDate ? ' (' + adj.targetPayDate + ')' : '');
            html += '<tr><td colspan="2"><strong>' + escapeHtml(label) + '</strong></td></tr>';
            if (d.grossPay) html += '<tr><td>Gross correction</td><td class="text-right">' + formatMoney(d.grossPay) + '</td></tr>';
            if (d.paye) html += '<tr><td>PAYE correction</td><td class="text-right">' + formatMoney(d.paye) + '</td></tr>';
            if (d.usc) html += '<tr><td>USC correction</td><td class="text-right">' + formatMoney(d.usc) + '</td></tr>';
            if (d.prsi) html += '<tr><td>PRSI correction</td><td class="text-right">' + formatMoney(d.prsi) + '</td></tr>';
        });
        html += '</tbody></table>';
        return html;
    }

    function afterSaveRefresh() {
        if (typeof PayrollApp !== 'undefined' && typeof PayrollApp.switchTab === 'function') {
            PayrollApp.switchTab('adjustments');
            return;
        }
        if (typeof PayrollContext !== 'undefined') {
            renderWorkspace(PayrollContext.currentCompanyId);
        }
    }

    function openCreateModal(run, entry) {
        var companyId = typeof PayrollContext !== 'undefined' ? PayrollContext.currentCompanyId : null;
        if (!companyId || !run || !entry) return;
        if ((run.status || '') !== 'submitted') {
            if (typeof PayrollUI !== 'undefined') {
                PayrollUI.showMessage('Adjust is only available after the period has been submitted. Rollback this commit to change hours before submission.', 'error');
            }
            return;
        }
        var prior = listPriorForTarget(
            companyId,
            entry.employeeId,
            entry.periodNumber || run.periodNumber,
            entry.payFrequency || run.frequency,
            run.id
        );
        var latest = prior.length ? prior[prior.length - 1] : null;
        var seedHours = latest && latest.corrected ? latest.corrected.regularHours : (entry.regularHours || 0);
        var seedOt = latest && latest.corrected ? latest.corrected.overtimeHours : (entry.overtimeHours || 0);
        var seedGross = latest && latest.corrected ? latest.corrected.grossPay : (entry.grossPay || 0);
        var nettingNote = prior.length
            ? '<p class="adj-modal-netting">This closed period already has ' + prior.length +
                ' adjustment' + (prior.length === 1 ? '' : 's') +
                '. Saving another one pays only the difference from the last correction (currently ' +
                (seedHours || 0) + ' hours / ' + formatMoney(seedGross || 0) + ').</p>'
            : '';
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.display = 'flex';
        modal.innerHTML =
            '<div class="modal-content modal-dialog" role="dialog" aria-modal="true">' +
            '<div class="modal-header"><h3 class="modal-title">Adjust prior period</h3>' +
            '<button type="button" class="modal-close-btn" data-adj-close aria-label="Close">&times;</button></div>' +
            '<div class="modal-body">' +
            '<p>This submitted period stays as filed. The correction is added on the <strong>next</strong> Calculate Preview.</p>' +
            '<p>Filed: ' + (entry.regularHours || 0) + ' regular hours, ' +
            (entry.overtimeHours || 0) + ' overtime hours, gross ' +
            formatMoney(entry.grossPay || 0) +
            ' (period ' + escapeHtml(String(entry.periodNumber || '')) +
            ', ' + escapeHtml(formatRates({ original: entry, periodRates: snapshotPeriodRates(entry) })) + ').</p>' +
            nettingNote +
            '<label>Reason</label>' +
            '<select id="adj-reason" class="form-select">' +
            '<option value="HOURS">Hours / gross</option>' +
            '<option value="OVERTIME">Missed overtime</option>' +
            '<option value="PENSION_BIK">Pension / BIK</option>' +
            '<option value="OTHER">Other</option>' +
            '</select>' +
            '<label>Corrected regular hours</label>' +
            '<input id="adj-hours" class="form-input" type="number" step="0.01" value="' + (seedHours || 0) + '">' +
            '<label>Corrected overtime hours</label>' +
            '<input id="adj-ot" class="form-input" type="number" step="0.01" value="' + (seedOt || 0) + '">' +
            '<label>Or corrected gross (€)</label>' +
            '<input id="adj-gross" class="form-input" type="number" step="0.01" placeholder="' + (seedGross || 0) + '">' +
            '<label>Notes</label>' +
            '<input id="adj-notes" class="form-input" type="text" maxlength="200" placeholder="Shown on the next payslip">' +
            '</div>' +
            '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" data-adj-close>Cancel</button>' +
            '<button type="button" class="btn btn-primary" id="adj-save">Save adjustment</button>' +
            '</div></div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function (event) {
            if (event.target === modal || event.target.getAttribute('data-adj-close') !== null) closeOverlay(modal);
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
                if (typeof PayrollUI !== 'undefined') PayrollUI.showMessage(created.error, 'error');
                return;
            }
            closeOverlay(modal);
            if (typeof PayrollUI !== 'undefined') {
                PayrollUI.showMessage(
                    'Adjustment queued. Review it on the Adjustments tab. Calculate Preview on the current open period to apply it. The submitted period stays as filed.',
                    'success'
                );
            }
            afterSaveRefresh();
        });
    }

    function submittedRuns(companyId) {
        if (typeof PayrollStorage === 'undefined' || !PayrollStorage.loadPayrollRuns || !companyId) return [];
        return (PayrollStorage.loadPayrollRuns(companyId) || [])
            .filter(function (run) { return (run.status || '') === 'submitted'; })
            .slice()
            .sort(function (a, b) {
                return new Date(b.payDate || b.runDate || 0) - new Date(a.payDate || a.runDate || 0);
            });
    }

    function runLabel(run) {
        var period = run.periodNumber ||
            (run.periodNumbers && (run.periodNumbers.weekly || run.periodNumbers.monthly)) || '';
        var date = run.payDate || run.payPeriodLabel || '';
        return 'Period ' + (period || '?') + (date ? ' · ' + date : '') +
            (run.frequency ? ' · ' + run.frequency : '');
    }

    function uniqueEmployees(items) {
        var seen = {};
        var list = [];
        (items || []).forEach(function (item) {
            if (!item.targetEmployeeId || seen[item.targetEmployeeId]) return;
            seen[item.targetEmployeeId] = true;
            list.push({ id: item.targetEmployeeId, name: item.targetEmployeeName || item.targetEmployeeId });
        });
        list.sort(function (a, b) {
            return String(a.name).localeCompare(String(b.name));
        });
        return list;
    }

    function filteredWorkspaceItems(companyId) {
        return listAll(companyId).filter(function (item) {
            if (workspaceFilter.status !== 'all' && item.status !== workspaceFilter.status) return false;
            if (workspaceFilter.employeeId && item.targetEmployeeId !== workspaceFilter.employeeId) return false;
            return true;
        });
    }

    function renderWorkspaceHtml(companyId) {
        var all = listAll(companyId);
        var items = filteredWorkspaceItems(companyId);
        var employees = uniqueEmployees(all);
        var pendingCount = all.filter(function (item) { return item.status === 'pending'; }).length;
        var html = '<div class="adjustments-workspace">';
        html += '<div class="adjustments-workspace-header">';
        html += '<h2>Adjustments</h2>';
        html += '<p class="adjustments-intro">Workplace for prior-period corrections. Queue a change against a <strong>submitted</strong> period, print the register, or click a row for the calculation. Records stay on the employee card as history. Pending items apply on the next <em>Calculate Preview</em>; the filed History run is not rewritten. A second fix of the same week pays only the remaining difference.</p>';
        html += '</div>';
        html += '<div class="adjustments-toolbar no-print">';
        html += '<label class="adjustments-filter">Status <select id="adj-filter-status" class="form-select">';
        html += '<option value="all"' + (workspaceFilter.status === 'all' ? ' selected' : '') + '>All</option>';
        html += '<option value="pending"' + (workspaceFilter.status === 'pending' ? ' selected' : '') + '>Pending</option>';
        html += '<option value="applied"' + (workspaceFilter.status === 'applied' ? ' selected' : '') + '>Applied</option>';
        html += '</select></label>';
        html += '<label class="adjustments-filter">Employee <select id="adj-filter-employee" class="form-select">';
        html += '<option value="">All employees</option>';
        employees.forEach(function (emp) {
            html += '<option value="' + escapeHtml(emp.id) + '"' +
                (workspaceFilter.employeeId === emp.id ? ' selected' : '') + '>' +
                escapeHtml(emp.name) + '</option>';
        });
        html += '</select></label>';
        html += '<span class="adjustments-count">' + items.length + ' shown' +
            (pendingCount ? ' · ' + pendingCount + ' pending' : '') + '</span>';
        html += '<div class="adjustments-toolbar-actions">';
        html += '<button type="button" class="btn btn-secondary" id="adj-print-btn">Print</button>';
        html += '<button type="button" class="btn btn-primary" id="adj-new-btn">New adjustment</button>';
        html += '</div></div>';
        html += '<div class="emp-history-scroll">';
        html += '<table class="employee-history-table adjustments-table">';
        html += '<thead><tr>';
        html += '<th>Queued</th><th>Employee</th><th>Closed period</th><th>Type</th><th>Period rates</th><th>Hours / gross</th><th>This adj.</th><th>Applied on</th><th>Status</th>';
        html += '</tr></thead><tbody>';
        if (!items.length) {
            html += '<tr class="adj-register-empty"><td colspan="9" class="text-center">';
            html += all.length
                ? 'No adjustments match this filter.'
                : 'No prior-period adjustments yet. Submit a period, then queue a correction here or from History → View Details.';
            html += '</td></tr>';
        } else {
            items.forEach(function (adj) {
                var pending = adj.status === 'pending';
                html += '<tr class="emp-adj-row emp-adj-clickable' + (pending ? '' : ' emp-adj-applied') + '"' +
                    ' data-adj-id="' + escapeHtml(adj.id) + '" tabindex="0" role="button">';
                html += '<td>' + escapeHtml(formatRegisterDate(adj.createdAt)) + '</td>';
                html += '<td>' + escapeHtml(adj.targetEmployeeName || '') + '</td>';
                html += '<td>Period ' + escapeHtml(String(adj.targetPeriodNumber || '')) + '</td>';
                html += '<td>' + escapeHtml(changeTypeLabel(adj.changeType || adj.reasonCode)) + '</td>';
                html += '<td class="adj-rates-cell">' + escapeHtml(formatRates(adj)) + '</td>';
                html += '<td>' + hoursGrossCell(adj) + '</td>';
                html += '<td>' + escapeHtml(signedMoney((adj.delta || {}).grossPay)) + '</td>';
                html += '<td>' + escapeHtml(pending ? '—' : appliedPeriodLabel(companyId, adj)) + '</td>';
                html += '<td>' + statusBadge(adj) + '</td>';
                html += '</tr>';
            });
        }
        html += '</tbody></table></div></div>';
        return html;
    }

    function printWorkspace(companyId) {
        var items = filteredWorkspaceItems(companyId);
        var companyNameEl = document.getElementById('workspace-company-name');
        var companyNumberEl = document.getElementById('workspace-company-number');
        var companyName = companyNameEl ? companyNameEl.textContent : 'Company';
        var companyNumber = companyNumberEl ? companyNumberEl.textContent : '';
        var generatedAt = new Date().toLocaleString('en-IE');
        var html = '<!doctype html><html><head><title>Prior-period adjustments</title>';
        html += '<style>';
        html += 'body{font-family:Arial,sans-serif;color:#111;margin:24px;}';
        html += 'h1{font-size:20px;margin:0 0 4px;}';
        html += '.meta{color:#555;font-size:12px;margin-bottom:18px;}';
        html += 'table{width:100%;border-collapse:collapse;font-size:11px;}';
        html += 'th,td{border:1px solid #bbb;padding:6px;text-align:left;vertical-align:top;}';
        html += 'th{background:#f1f1f1;}';
        html += '.text-right{text-align:right;}';
        html += '@media print{body{margin:12mm;}}';
        html += '</style></head><body>';
        html += '<h1>Prior-period adjustments</h1>';
        html += '<div class="meta">' + escapeHtml(companyName) +
            (companyNumber ? ' | ' + escapeHtml(companyNumber) : '') +
            ' | Generated ' + escapeHtml(generatedAt) + '</div>';
        html += '<table><thead><tr>';
        html += '<th>Queued</th><th>Employee</th><th>Closed period</th><th>Type</th><th>Period rates</th><th>Hours / gross</th><th>This adj.</th><th>Applied on</th><th>Status</th>';
        html += '</tr></thead><tbody>';
        if (!items.length) {
            html += '<tr><td colspan="9">No adjustments to print.</td></tr>';
        } else {
            items.forEach(function (adj) {
                var orig = adj.original || {};
                var corr = adj.corrected || {};
                html += '<tr>';
                html += '<td>' + escapeHtml(formatRegisterDate(adj.createdAt)) + '</td>';
                html += '<td>' + escapeHtml(adj.targetEmployeeName || '') + '</td>';
                html += '<td>Period ' + escapeHtml(String(adj.targetPeriodNumber || '')) + '</td>';
                html += '<td>' + escapeHtml(changeTypeLabel(adj.changeType || adj.reasonCode)) + '</td>';
                html += '<td>' + escapeHtml(formatRates(adj)) + '</td>';
                html += '<td>' + escapeHtml((orig.regularHours || 0) + ' → ' + (corr.regularHours || 0) +
                    ' / ' + formatMoney(orig.grossPay || 0) + ' → ' + formatMoney(corr.grossPay || 0)) + '</td>';
                html += '<td>' + escapeHtml(signedMoney((adj.delta || {}).grossPay)) + '</td>';
                html += '<td>' + escapeHtml(adj.status === 'pending' ? '—' : appliedPeriodLabel(companyId, adj)) + '</td>';
                html += '<td>' + escapeHtml(adj.status === 'pending' ? 'Pending' : 'Applied') + '</td>';
                html += '</tr>';
            });
        }
        html += '</tbody></table>';
        html += '<script>window.onload=function(){window.print();};<\/script></body></html>';
        var reportWindow = window.open('', '_blank');
        if (!reportWindow) {
            if (typeof PayrollUI !== 'undefined') {
                PayrollUI.showMessage('Pop-up blocked. Allow pop-ups to print the adjustments register.', 'error');
            }
            return;
        }
        reportWindow.document.open();
        reportWindow.document.write(html);
        reportWindow.document.close();
    }

    function openPickTargetModal(companyId) {
        var runs = submittedRuns(companyId);
        if (!runs.length) {
            if (typeof PayrollUI !== 'undefined') {
                PayrollUI.showMessage('Submit a period first. Adjust is only for submitted (closed) periods.', 'error');
            }
            return;
        }
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.style.display = 'flex';
        function optionsForRun(run) {
            return (run.entries || []).map(function (entry) {
                return '<option value="' + escapeHtml(entry.employeeId) + '">' +
                    escapeHtml(entry.employeeName || entry.employeeId) + '</option>';
            }).join('');
        }
        modal.innerHTML =
            '<div class="modal-content modal-dialog" role="dialog" aria-modal="true">' +
            '<div class="modal-header"><h3 class="modal-title">New prior-period adjustment</h3>' +
            '<button type="button" class="modal-close-btn" data-adj-close aria-label="Close">&times;</button></div>' +
            '<div class="modal-body">' +
            '<p>Choose a submitted (closed) period and employee. The filed run will not change.</p>' +
            '<label>Closed period</label>' +
            '<select id="adj-pick-run" class="form-select">' +
            runs.map(function (run) {
                return '<option value="' + escapeHtml(run.id) + '">' + escapeHtml(runLabel(run)) + '</option>';
            }).join('') +
            '</select>' +
            '<label>Employee</label>' +
            '<select id="adj-pick-employee" class="form-select">' + optionsForRun(runs[0]) + '</select>' +
            '</div>' +
            '<div class="modal-footer">' +
            '<button type="button" class="btn btn-secondary" data-adj-close>Cancel</button>' +
            '<button type="button" class="btn btn-primary" id="adj-pick-continue">Continue</button>' +
            '</div></div>';
        document.body.appendChild(modal);
        var runSelect = modal.querySelector('#adj-pick-run');
        var empSelect = modal.querySelector('#adj-pick-employee');
        runSelect.addEventListener('change', function () {
            var run = runs.find(function (item) { return item.id === runSelect.value; });
            empSelect.innerHTML = run ? optionsForRun(run) : '';
        });
        modal.addEventListener('click', function (event) {
            if (event.target === modal || event.target.getAttribute('data-adj-close') !== null) closeOverlay(modal);
        });
        modal.querySelector('#adj-pick-continue').addEventListener('click', function () {
            var run = runs.find(function (item) { return item.id === runSelect.value; });
            var entry = run && (run.entries || []).find(function (item) {
                return item.employeeId === empSelect.value;
            });
            if (!run || !entry) {
                if (typeof PayrollUI !== 'undefined') PayrollUI.showMessage('Choose a submitted period and employee.', 'error');
                return;
            }
            closeOverlay(modal);
            openCreateModal(run, entry);
        });
    }

    function bindWorkspace(root, companyId) {
        if (!root) return;
        var statusEl = root.querySelector('#adj-filter-status');
        var employeeEl = root.querySelector('#adj-filter-employee');
        if (statusEl) {
            statusEl.addEventListener('change', function () {
                workspaceFilter.status = statusEl.value || 'all';
                renderWorkspace(companyId);
            });
        }
        if (employeeEl) {
            employeeEl.addEventListener('change', function () {
                workspaceFilter.employeeId = employeeEl.value || '';
                renderWorkspace(companyId);
            });
        }
        var printBtn = root.querySelector('#adj-print-btn');
        if (printBtn) {
            printBtn.addEventListener('click', function () {
                printWorkspace(companyId);
            });
        }
        var newBtn = root.querySelector('#adj-new-btn');
        if (newBtn) {
            newBtn.addEventListener('click', function () {
                openPickTargetModal(companyId);
            });
        }
        root.querySelectorAll('.emp-adj-clickable').forEach(function (row) {
            function open() {
                var adjId = row.getAttribute('data-adj-id');
                var adj = loadAll(companyId).find(function (item) { return item.id === adjId; });
                if (adj) showDetailPopup(companyId, adj, { returnTab: 'adjustments' });
            }
            row.addEventListener('click', open);
            row.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    open();
                }
            });
        });
    }

    function renderWorkspace(companyId) {
        var host = document.getElementById('adjustments-content');
        if (!host) return;
        if (!companyId) {
            host.innerHTML = '<div class="empty-state">Select a company to work on adjustments.</div>';
            return;
        }
        host.innerHTML = renderWorkspaceHtml(companyId);
        bindWorkspace(host, companyId);
    }

    return {
        recalculateCorrected: recalculateCorrected,
        createFromHistory: createFromHistory,
        listPending: listPending,
        listAll: listAll,
        listForEmployee: listForEmployee,
        listPriorForTarget: listPriorForTarget,
        getPendingForEmployee: getPendingForEmployee,
        renderEmployeeRegister: renderEmployeeRegister,
        bindEmployeeRegister: bindEmployeeRegister,
        renderWorkspace: renderWorkspace,
        renderWorkspaceHtml: renderWorkspaceHtml,
        renderDetailHtml: renderDetailHtml,
        showDetailPopup: showDetailPopup,
        applyPendingToEntry: applyPendingToEntry,
        markApplied: markApplied,
        renderPendingBanner: renderPendingBanner,
        renderPayslipBlock: renderPayslipBlock,
        openCreateModal: openCreateModal
    };
})();
