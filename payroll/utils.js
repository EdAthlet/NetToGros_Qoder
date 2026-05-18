// payroll/utils.js — Shared utilities for the Payroll module
// Load this BEFORE employees.js, state-machine.js, and payroll.js

var PayrollUtils = (function() {
    'use strict';

    /**
     * Escape HTML to prevent XSS in dynamic content.
     */
    function escapeHtml(text) {
        if (text == null) return '';
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Format a number as Irish Euro currency.
     * Falls back to Intl if the global formatCurrency isn't available.
     */
    function safeFormatCurrency(amount) {
        if (typeof formatCurrency === 'function') {
            return formatCurrency(amount);
        }
        return new Intl.NumberFormat('en-IE', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
    }

    /**
     * Format a number to 2 decimal places (for CSV/Excel export).
     */
    function formatNumber(amount) {
        return (amount || 0).toFixed(2);
    }

    /**
     * Default annual tax credits by family status (2025/2026 rates).
     * Single source of truth — do not duplicate elsewhere.
     */
    var DEFAULT_TAX_CREDITS = {
        'single': 4000,
        'married': 8000,
        'marriedOneWorking': 6000,
        'married_one': 6000,
        'married_two': 8000,
        'singleParent': 5900
    };

    /**
     * Default annual cut-off points (standard rate bands) by family status.
     * Single source of truth — do not duplicate elsewhere.
     */
    var DEFAULT_CUT_OFF_POINTS = {
        'single': 44000,
        'married': 88000,
        'marriedOneWorking': 53000,
        'married_one': 53000,
        'married_two': 88000,
        'singleParent': 48000
    };

    function getDefaultAnnualTC(familyStatus) {
        return DEFAULT_TAX_CREDITS[familyStatus] || 4000;
    }

    function getDefaultCutOffPoint(familyStatus) {
        return DEFAULT_CUT_OFF_POINTS[familyStatus] || 44000;
    }

    // --- Public API ---
    return {
        escapeHtml: escapeHtml,
        safeFormatCurrency: safeFormatCurrency,
        formatNumber: formatNumber,
        getDefaultAnnualTC: getDefaultAnnualTC,
        getDefaultCutOffPoint: getDefaultCutOffPoint,
        DEFAULT_TAX_CREDITS: DEFAULT_TAX_CREDITS,
        DEFAULT_CUT_OFF_POINTS: DEFAULT_CUT_OFF_POINTS
    };
})();
