/**
 * PayrollMode - per-company local/cloud mode helpers.
 * Local: manual annual TC/COP, backup/import, no RPN or Revenue submission.
 * Cloud: simulated RPN + PSR via fakeRevenueServer (real ROS later).
 */
const PayrollMode = (function () {
  'use strict';

  var VALID_MODES = ['local', 'cloud'];

  function getDefaultModeForSlot(index) {
    if (index === 0) return 'local';
    if (index === 1) return 'cloud';
    return null;
  }

  function getDefaultNameForSlot(index) {
    if (index === 0) return 'Practice – Local';
    if (index === 1) return 'Practice – Cloud';
    return 'Live Payroll';
  }

  function getPracticePresetForSlot(index) {
    if (index === 0) return 'sandbox-local';
    if (index === 1) return 'sandbox-cloud';
    return null;
  }

  function normalizeMode(mode) {
    return VALID_MODES.indexOf(mode) !== -1 ? mode : null;
  }

  function getMode(company) {
    if (!company) return 'local';
    return normalizeMode(company.payrollMode) || 'local';
  }

  function isCloud(company) {
    return getMode(company) === 'cloud';
  }

  function isLocal(company) {
    return getMode(company) === 'local';
  }

  function needsModeSelection(company, slotIndex) {
    if (!company) return false;
    if (normalizeMode(company.payrollMode)) return false;
    return slotIndex === 2;
  }

  function getModeLabel(mode) {
    return mode === 'cloud' ? 'Cloud (RPN & Submission)' : 'Local (Manual TC/COP)';
  }

  function migrateCompanies(companies) {
    if (!Array.isArray(companies)) return companies;
    var changed = false;

    companies.forEach(function (company, index) {
      if (!company || typeof company !== 'object') return;

      if (!normalizeMode(company.payrollMode) && company.payrollMode !== null) {
        var defaultMode = getDefaultModeForSlot(index);
        if (defaultMode) {
          company.payrollMode = defaultMode;
          changed = true;
        }
      }

      if (!company.practicePreset && getPracticePresetForSlot(index)) {
        company.practicePreset = getPracticePresetForSlot(index);
        changed = true;
      }
    });

    if (changed && typeof PayrollStorage !== 'undefined') {
      PayrollStorage.saveCompanies(companies);
    }

    return companies;
  }

  function getSlotIndex(companyId) {
    if (typeof PayrollStorage === 'undefined') return -1;
    var companies = PayrollStorage.loadCompanies();
    for (var i = 0; i < companies.length; i++) {
      if (companies[i].id === companyId) return i;
    }
    return -1;
  }

  return {
    VALID_MODES: VALID_MODES,
    getDefaultModeForSlot: getDefaultModeForSlot,
    getDefaultNameForSlot: getDefaultNameForSlot,
    getPracticePresetForSlot: getPracticePresetForSlot,
    normalizeMode: normalizeMode,
    getMode: getMode,
    isCloud: isCloud,
    isLocal: isLocal,
    needsModeSelection: needsModeSelection,
    getModeLabel: getModeLabel,
    migrateCompanies: migrateCompanies,
    getSlotIndex: getSlotIndex
  };
})();