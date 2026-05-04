/**
 * PayrollStorage - localStorage abstraction layer for payroll data.
 * Loaded as a plain <script> tag. All methods live on the PayrollStorage namespace.
 * Supports multi-company model (up to 3 companies).
 */
const PayrollStorage = (function () {
  'use strict';

  /* ─── Keys ─── */
  const KEY_COMPANIES = 'payrollCompanies';
  const KEY_ACTIVE_COMPANY = 'payrollActiveCompany';
  const KEY_COMPANY_OLD = 'payrollCompany';
  const KEY_EMPLOYEES_OLD = 'payrollEmployees';
  const KEY_RUNS_OLD = 'payrollRuns';

  function _employeesKey(companyId) {
    return 'payrollEmployees_' + companyId;
  }

  function _runsKey(companyId) {
    return 'payrollRuns_' + companyId;
  }

  /* ─── Helpers ─── */

  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        console.error('localStorage quota exceeded for key:', key);
      } else {
        console.error('localStorage save error:', e);
      }
      return false;
    }
  }

  function _get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch (e) {
      console.error('localStorage read error:', e);
      return null;
    }
  }

  function _remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('localStorage remove error:', e);
      return false;
    }
  }

  function _isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
  }

  function _makeDefaultCompany(index, id) {
    var defaults = [
      { name: 'Company1', address: '123 Main Street, Dublin', eircode: 'D01 A1B2', payFrequency: 'monthly' },
      { name: 'Company2', address: '456 High Street, Cork', eircode: 'T12 X3Y4', payFrequency: 'weekly' },
      { name: 'Company3', address: '789 Market Square, Galway', eircode: 'H91 Z5W6', payFrequency: 'fortnightly' }
    ];
    var d = defaults[index] || defaults[0];
    var now = new Date().toISOString();
    return {
      id: id,
      name: d.name,
      address: d.address,
      eircode: d.eircode,
      payFrequency: d.payFrequency,
      taxYear: '2026',
      taxPeriod: 'jan-sep',
      createdAt: now,
      updatedAt: now
    };
  }

  function _validateEmployeeList(list) {
    if (!Array.isArray(list)) {
      console.error('Employees must be an array');
      return false;
    }
    if (list.length > 10) {
      console.error('Maximum 10 employees allowed');
      return false;
    }

    var validFrequencies = ['single', 'married', 'marriedOneWorking', 'singleParent'];
    var validPrsiClasses = ['A', 'A0', 'AX', 'AL', 'A1'];

    for (var i = 0; i < list.length; i++) {
      var emp = list[i];
      if (!emp || typeof emp !== 'object') {
        console.error('Employee at index', i, 'is not an object');
        return false;
      }
      if (!_isNonEmptyString(emp.firstName)) {
        console.error('Employee at index', i, 'missing firstName');
        return false;
      }
      if (!_isNonEmptyString(emp.lastName)) {
        console.error('Employee at index', i, 'missing lastName');
        return false;
      }
      if (!validFrequencies.includes(emp.familyStatus)) {
        console.error('Employee at index', i, 'has invalid familyStatus');
        return false;
      }
      var payType = emp.payType || 'salaried';
      if (typeof emp.annualGross !== 'number' || isNaN(emp.annualGross) || emp.annualGross < 0) {
        console.error('Employee at index', i, 'has invalid annualGross');
        return false;
      }
      if (payType === 'hourly') {
        // hourly employees may have annualGross === 0; hourlyRate is not validated here for backward compat
      }
      if (_isNonEmptyString(emp.ppsNumber)) {
        var pps = emp.ppsNumber.trim().toUpperCase();
        if (!/^\d{7}[A-Z]{1,2}$/.test(pps)) {
          console.error('Employee at index', i, 'has invalid PPS number format');
          return false;
        }
      }
      if (emp.prsiClass && !validPrsiClasses.includes(emp.prsiClass)) {
        console.error('Employee at index', i, 'has invalid prsiClass');
        return false;
      }
    }
    return true;
  }

  /* ─── Public API ─── */

  return {
    /* ─── 1. Company defaults ─── */

    initDefaults: function () {
      var existing = _get(KEY_COMPANIES);
      if (existing !== null) {
        return;
      }

      var id1 = this.generateId();
      var id2 = this.generateId();
      var id3 = this.generateId();

      var company1 = _makeDefaultCompany(0, id1);
      var company2 = _makeDefaultCompany(1, id2);
      var company3 = _makeDefaultCompany(2, id3);

      var oldCompany = _get(KEY_COMPANY_OLD);
      if (oldCompany && typeof oldCompany === 'object') {
        company1.name = _isNonEmptyString(oldCompany.name) ? oldCompany.name : company1.name;
        company1.address = _isNonEmptyString(oldCompany.address) ? oldCompany.address : company1.address;
        company1.eircode = _isNonEmptyString(oldCompany.eircode) ? oldCompany.eircode : company1.eircode;
        company1.payFrequency = ['weekly', 'fortnightly', 'monthly'].includes(oldCompany.payFrequency)
          ? oldCompany.payFrequency
          : company1.payFrequency;
        company1.taxYear = ['2024', '2025', '2026'].includes(oldCompany.taxYear)
          ? oldCompany.taxYear
          : company1.taxYear;
        company1.taxPeriod = ['jan-sep', 'oct-dec'].includes(oldCompany.taxPeriod)
          ? oldCompany.taxPeriod
          : company1.taxPeriod;
        if (oldCompany.createdAt) {
          company1.createdAt = oldCompany.createdAt;
        }
        company1.updatedAt = new Date().toISOString();
      }

      var companies = [company1, company2, company3];
      _set(KEY_COMPANIES, companies);
      this.setActiveCompanyId(id1);

      var oldEmployees = _get(KEY_EMPLOYEES_OLD);
      if (Array.isArray(oldEmployees)) {
        _set(_employeesKey(id1), oldEmployees);
      }

      var oldRuns = _get(KEY_RUNS_OLD);
      if (Array.isArray(oldRuns)) {
        _set(_runsKey(id1), oldRuns);
      }

      _remove(KEY_COMPANY_OLD);
      _remove(KEY_EMPLOYEES_OLD);
      _remove(KEY_RUNS_OLD);
    },

    /* ─── 2. Companies ─── */

    loadCompanies: function () {
      var data = _get(KEY_COMPANIES);
      return Array.isArray(data) ? data : [];
    },

    saveCompanies: function (list) {
      if (!Array.isArray(list)) {
        console.error('Companies must be an array');
        return false;
      }
      return _set(KEY_COMPANIES, list);
    },

    getCompany: function (id) {
      var companies = this.loadCompanies();
      for (var i = 0; i < companies.length; i++) {
        if (companies[i].id === id) {
          return companies[i];
        }
      }
      return null;
    },

    updateCompany: function (id, data) {
      var companies = this.loadCompanies();
      var found = false;
      var now = new Date().toISOString();
      for (var i = 0; i < companies.length; i++) {
        if (companies[i].id === id) {
          if (data && typeof data === 'object') {
            if (_isNonEmptyString(data.name)) companies[i].name = data.name.trim();
            if (_isNonEmptyString(data.address)) companies[i].address = data.address.trim();
            if (_isNonEmptyString(data.eircode)) companies[i].eircode = data.eircode.trim();
            if (['weekly', 'fortnightly', 'monthly'].includes(data.payFrequency)) {
              companies[i].payFrequency = data.payFrequency;
            }
            if (['2024', '2025', '2026'].includes(data.taxYear)) {
              companies[i].taxYear = data.taxYear;
            }
            if (['jan-sep', 'oct-dec'].includes(data.taxPeriod)) {
              companies[i].taxPeriod = data.taxPeriod;
            }
            companies[i].updatedAt = now;
          }
          found = true;
          break;
        }
      }
      if (!found) {
        console.error('Company not found:', id);
        return false;
      }
      return _set(KEY_COMPANIES, companies);
    },

    /* ─── 3. Active company ─── */

    getActiveCompanyId: function () {
      var raw = _get(KEY_ACTIVE_COMPANY);
      return typeof raw === 'string' ? raw : null;
    },

    setActiveCompanyId: function (id) {
      if (!_isNonEmptyString(id)) {
        console.error('Invalid company ID');
        return false;
      }
      return _set(KEY_ACTIVE_COMPANY, id);
    },

    /* ─── 4. Employees (company-scoped) ─── */

    saveEmployees: function (companyId, list) {
      if (!_isNonEmptyString(companyId)) {
        console.error('Invalid companyId');
        return false;
      }
      if (!_validateEmployeeList(list)) {
        return false;
      }
      return _set(_employeesKey(companyId), list);
    },

    loadEmployees: function (companyId) {
      if (!_isNonEmptyString(companyId)) {
        console.error('Invalid companyId');
        return [];
      }
      var data = _get(_employeesKey(companyId));
      return Array.isArray(data) ? data : [];
    },

    /* ─── 5. Payroll Runs (company-scoped) ─── */

    savePayrollRun: function (companyId, run) {
      if (!_isNonEmptyString(companyId)) {
        console.error('Invalid companyId');
        return false;
      }
      if (!run || typeof run !== 'object') {
        console.error('Invalid payroll run data');
        return false;
      }
      var runs = this.loadPayrollRuns(companyId);
      var idx = -1;
      for (var i = 0; i < runs.length; i++) {
        if (runs[i].id === run.id) {
          idx = i;
          break;
        }
      }
      if (idx >= 0) {
        runs[idx] = run;
      } else {
        runs.push(run);
      }
      return _set(_runsKey(companyId), runs);
    },

    loadPayrollRuns: function (companyId) {
      if (!_isNonEmptyString(companyId)) {
        console.error('Invalid companyId');
        return [];
      }
      var data = _get(_runsKey(companyId));
      return Array.isArray(data) ? data : [];
    },

    deletePayrollRun: function (companyId, id) {
      if (!_isNonEmptyString(companyId)) {
        console.error('Invalid companyId');
        return false;
      }
      if (!_isNonEmptyString(id)) {
        console.error('Invalid run id');
        return false;
      }
      var runs = this.loadPayrollRuns(companyId);
      var filtered = [];
      for (var i = 0; i < runs.length; i++) {
        if (runs[i].id !== id) {
          filtered.push(runs[i]);
        }
      }
      return _set(_runsKey(companyId), filtered);
    },

    /* ─── 6. Backup Export ─── */

    exportBackup: function () {
      var companies = this.loadCompanies();
      var employeesByCompany = {};
      var runsByCompany = {};

      for (var i = 0; i < companies.length; i++) {
        var cid = companies[i].id;
        employeesByCompany[cid] = this.loadEmployees(cid);
        runsByCompany[cid] = this.loadPayrollRuns(cid);
      }

      var payload = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        companies: companies,
        employeesByCompany: employeesByCompany,
        runsByCompany: runsByCompany
      };

      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var dateStr = new Date().toISOString().split('T')[0];
      var filename = 'payroll-backup-' + dateStr + '.json';

      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();

      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
    },

    /* ─── 7. Backup Import ─── */

    importBackup: function (file) {
      var self = this;
      return new Promise(function (resolve, reject) {
        if (!(file instanceof File)) {
          reject('Expected a File object');
          return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
          try {
            var data = JSON.parse(e.target.result);
            if (!data || typeof data !== 'object') {
              reject('Invalid JSON structure');
              return;
            }
            if (typeof data.version !== 'string') {
              reject('Missing "version" field');
              return;
            }

            if (data.version === '1.0') {
              if (data.company === undefined) {
                reject('Missing "company" field');
                return;
              }
              if (!Array.isArray(data.employees)) {
                reject('Missing or invalid "employees" field');
                return;
              }
              if (!Array.isArray(data.payrollRuns)) {
                reject('Missing or invalid "payrollRuns" field');
                return;
              }

              self.clearAllData();

              var id1 = self.generateId();
              var id2 = self.generateId();
              var id3 = self.generateId();

              var company1 = _makeDefaultCompany(0, id1);
              if (data.company && typeof data.company === 'object') {
                if (_isNonEmptyString(data.company.name)) company1.name = data.company.name.trim();
                if (_isNonEmptyString(data.company.address)) company1.address = data.company.address.trim();
                if (_isNonEmptyString(data.company.eircode)) company1.eircode = data.company.eircode.trim();
                if (['weekly', 'fortnightly', 'monthly'].includes(data.company.payFrequency)) {
                  company1.payFrequency = data.company.payFrequency;
                }
                if (['2024', '2025', '2026'].includes(data.company.taxYear)) {
                  company1.taxYear = data.company.taxYear;
                }
                if (['jan-sep', 'oct-dec'].includes(data.company.taxPeriod)) {
                  company1.taxPeriod = data.company.taxPeriod;
                }
                if (data.company.createdAt) company1.createdAt = data.company.createdAt;
                company1.updatedAt = new Date().toISOString();
              }

              var companies = [company1, _makeDefaultCompany(1, id2), _makeDefaultCompany(2, id3)];
              _set(KEY_COMPANIES, companies);
              self.setActiveCompanyId(id1);
              _set(_employeesKey(id1), data.employees);
              _set(_runsKey(id1), data.payrollRuns);
              resolve();
              return;
            }

            if (data.version === '2.0') {
              if (!Array.isArray(data.companies)) {
                reject('Missing or invalid "companies" field');
                return;
              }
              if (!data.employeesByCompany || typeof data.employeesByCompany !== 'object') {
                reject('Missing or invalid "employeesByCompany" field');
                return;
              }
              if (!data.runsByCompany || typeof data.runsByCompany !== 'object') {
                reject('Missing or invalid "runsByCompany" field');
                return;
              }

              self.clearAllData();
              _set(KEY_COMPANIES, data.companies);

              var activeId = data.companies.length > 0 ? data.companies[0].id : null;
              if (activeId) {
                self.setActiveCompanyId(activeId);
              }

              for (var j = 0; j < data.companies.length; j++) {
                var cid = data.companies[j].id;
                var empList = data.employeesByCompany[cid];
                var runList = data.runsByCompany[cid];
                if (Array.isArray(empList)) {
                  _set(_employeesKey(cid), empList);
                }
                if (Array.isArray(runList)) {
                  _set(_runsKey(cid), runList);
                }
              }
              resolve();
              return;
            }

            reject('Unsupported backup version: ' + data.version);
          } catch (err) {
            reject('Failed to parse backup file: ' + err.message);
          }
        };
        reader.onerror = function () {
          reject('Failed to read file');
        };
        reader.readAsText(file);
      });
    },

    /* ─── 8. Clear ─── */

    clearAllData: function () {
      _remove(KEY_COMPANIES);
      _remove(KEY_ACTIVE_COMPANY);
      _remove(KEY_COMPANY_OLD);
      _remove(KEY_EMPLOYEES_OLD);
      _remove(KEY_RUNS_OLD);

      var companies = this.loadCompanies();
      for (var i = 0; i < companies.length; i++) {
        var cid = companies[i].id;
        _remove(_employeesKey(cid));
        _remove(_runsKey(cid));
      }
      return true;
    },

    /* ─── 9. ID Generator ─── */

    generateId: function () {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
  };
})();

/* Initialize defaults on script load */
PayrollStorage.initDefaults();
