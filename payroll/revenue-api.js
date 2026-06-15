/**
 * RevenueApi - client for fake Revenue server (future: real ROS).
 * Defaults to http://localhost:3001 when running locally.
 */
const RevenueApi = (function () {
  'use strict';

  function getBaseUrl() {
    if (window.PAYROLL_CONFIG && window.PAYROLL_CONFIG.revenueApiBase) {
      return String(window.PAYROLL_CONFIG.revenueApiBase).replace(/\/$/, '');
    }

    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3001';
    }

    return 'http://localhost:3001';
  }

  async function retrieveRPN(payload) {
    var response = await fetch(getBaseUrl() + '/rpn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('RPN request failed with HTTP ' + response.status);
    }

    return response.json();
  }

  async function submitPSR(payload) {
    var response = await fetch(getBaseUrl() + '/psr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('PSR request failed with HTTP ' + response.status);
    }

    return response.json();
  }

  return {
    getBaseUrl: getBaseUrl,
    retrieveRPN: retrieveRPN,
    submitPSR: submitPSR
  };
})();