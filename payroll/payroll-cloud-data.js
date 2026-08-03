/**
 * PayrollCloudData — push/pull full payroll snapshots to Neon via Netlify Functions.
 * Practice workspace key is stored in localStorage (not full user accounts yet).
 */
var PayrollCloudData = (function () {
  'use strict';

  var WORKSPACE_KEY = 'payrollCloudWorkspaceKey';
  var WORKSPACE_ID_KEY = 'payrollCloudWorkspaceId';
  var WORKSPACE_LABEL_KEY = 'payrollCloudWorkspaceLabel';

  function isLocalHost() {
    var host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  function getDataApiBase() {
    if (window.PAYROLL_CONFIG && window.PAYROLL_CONFIG.dataApiBase) {
      return String(window.PAYROLL_CONFIG.dataApiBase).replace(/\/$/, '');
    }
    // Same origin /api on Netlify; local needs `netlify dev` or deployed API
    if (isLocalHost()) {
      return window.location.origin + '/api';
    }
    return window.location.origin + '/api';
  }

  function getWorkspaceKey() {
    try {
      return sessionStorage.getItem(WORKSPACE_KEY) || localStorage.getItem(WORKSPACE_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setWorkspaceMeta(meta) {
    try {
      if (meta.accessKey) {
        localStorage.setItem(WORKSPACE_KEY, meta.accessKey);
      }
      if (meta.workspaceId) {
        localStorage.setItem(WORKSPACE_ID_KEY, meta.workspaceId);
      }
      if (meta.label) {
        localStorage.setItem(WORKSPACE_LABEL_KEY, meta.label);
      }
    } catch (e) {
      // ignore
    }
  }

  function clearWorkspaceMeta() {
    try {
      localStorage.removeItem(WORKSPACE_KEY);
      localStorage.removeItem(WORKSPACE_ID_KEY);
      localStorage.removeItem(WORKSPACE_LABEL_KEY);
    } catch (e) {
      // ignore
    }
  }

  function getStoredLabel() {
    try {
      return localStorage.getItem(WORKSPACE_LABEL_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  async function request(path, options) {
    options = options || {};
    var headers = Object.assign(
      { 'Content-Type': 'application/json' },
      options.headers || {}
    );
    var key = getWorkspaceKey();
    if (key && !headers['X-Workspace-Key']) {
      headers['X-Workspace-Key'] = key;
    }

    var response = await fetch(getDataApiBase() + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body != null ? JSON.stringify(options.body) : undefined
    });

    var data = null;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }

    if (!response.ok) {
      var msg =
        (data && (data.message || data.error)) ||
        'Request failed (HTTP ' + response.status + ')';
      var err = new Error(msg);
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function health() {
    return request('/data/health', { method: 'GET' });
  }

  async function createWorkspace(label) {
    var data = await request('/data/workspace', {
      method: 'POST',
      body: { label: label || 'Practice workspace' },
      headers: {}
    });
    // create must not require existing key
    setWorkspaceMeta({
      accessKey: data.accessKey,
      workspaceId: data.workspaceId,
      label: data.label
    });
    return data;
  }

  async function pushSnapshot() {
    if (!getWorkspaceKey()) {
      throw new Error('No workspace key. Create a cloud workspace first.');
    }
    if (typeof PayrollStorage === 'undefined' || !PayrollStorage.buildBackupPayload) {
      throw new Error('PayrollStorage is unavailable');
    }
    var payload = PayrollStorage.buildBackupPayload();
    return request('/data/snapshot', {
      method: 'PUT',
      body: { payload: payload }
    });
  }

  async function pullSnapshot() {
    if (!getWorkspaceKey()) {
      throw new Error('No workspace key. Paste a key or create a workspace first.');
    }
    if (typeof PayrollStorage === 'undefined' || !PayrollStorage.applyBackupPayload) {
      throw new Error('PayrollStorage is unavailable');
    }
    var data = await request('/data/snapshot', { method: 'GET' });
    var result = PayrollStorage.applyBackupPayload(data.payload);
    if (!result.ok) {
      throw new Error(result.error || 'Failed to apply cloud snapshot');
    }
    return data;
  }

  function setWorkspaceKeyManually(key) {
    var cleaned = String(key || '').trim();
    if (!cleaned) {
      clearWorkspaceMeta();
      return;
    }
    setWorkspaceMeta({ accessKey: cleaned });
  }

  return {
    getDataApiBase: getDataApiBase,
    getWorkspaceKey: getWorkspaceKey,
    getStoredLabel: getStoredLabel,
    setWorkspaceKeyManually: setWorkspaceKeyManually,
    clearWorkspaceMeta: clearWorkspaceMeta,
    health: health,
    createWorkspace: createWorkspace,
    pushSnapshot: pushSnapshot,
    pullSnapshot: pullSnapshot
  };
})();
