/**
 * RevenueApi — client for practice fake Revenue API (future: real ROS).
 *
 * Local:  http://localhost:3001  (npm run revenue:start)
 * Prod:   same origin /api       (Netlify Functions on Pro site)
 */
const RevenueApi = (function () {
  'use strict';

  function isLocalHost() {
    var host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  function getBaseUrl() {
    if (window.PAYROLL_CONFIG && window.PAYROLL_CONFIG.revenueApiBase) {
      return String(window.PAYROLL_CONFIG.revenueApiBase).replace(/\/$/, '');
    }

    if (isLocalHost()) {
      return 'http://localhost:3001';
    }

    // Netlify Functions via /api/* redirects (same domain as the site)
    return window.location.origin + '/api';
  }

  async function requestJson(path, options) {
    var url = getBaseUrl() + path;
    var response = await fetch(url, options);

    if (!response.ok) {
      var detail = '';
      try {
        var errBody = await response.json();
        detail = errBody.message || errBody.error || '';
      } catch (e) {
        // ignore parse errors
      }
      throw new Error(
        (options && options.method === 'GET' ? 'Status' : path) +
          ' request failed with HTTP ' +
          response.status +
          (detail ? ': ' + detail : '')
      );
    }

    return response.json();
  }

  async function retrieveRPN(payload) {
    return requestJson('/rpn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async function submitPSR(payload) {
    return requestJson('/psr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async function getStatus() {
    return requestJson('/status', { method: 'GET' });
  }

  return {
    getBaseUrl: getBaseUrl,
    retrieveRPN: retrieveRPN,
    submitPSR: submitPSR,
    getStatus: getStatus
  };
})();
