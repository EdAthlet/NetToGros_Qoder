/**
 * Practice Revenue dashboard — static page, live API calls.
 * Session log is browser-only (localStorage); not a server-wide audit trail.
 */

const LOG_KEY = 'fakeRevenueDashboardLog_v1';
const MAX_LOG = 40;

const samples = {
  rpn: {
    employerRegistrationNumber: '1234567T',
    taxYear: 2026,
    employees: [
      { ppsn: '12345675A', employmentId: 'emp-high' },
      { ppsn: '12345673A', employmentId: 'emp-low' },
      { ppsn: '12345678A', employmentId: 'emp-std' },
      { ppsn: '12345670A', employmentId: 'emp-error' }
    ]
  },
  psr: {
    employerRegistrationNumber: '1234567T',
    taxYear: 2026,
    payPeriod: '2026-07',
    employees: [
      { ppsn: '1234567A', grossPay: 4500, paye: 650, usc: 180, prsi: 180 },
      { ppsn: '2345678B', grossPay: 5200, paye: 780, usc: 210, prsi: 208 }
    ]
  }
};

const endpointSelect = document.querySelector('#endpointSelect');
const payloadInput = document.querySelector('#payloadInput');
const responseOutput = document.querySelector('#responseOutput');
const sendButton = document.querySelector('#sendButton');
const resetButton = document.querySelector('#resetButton');
const refreshStatusButton = document.querySelector('#refreshStatusButton');
const clearLogButton = document.querySelector('#clearLogButton');
const connectionStatus = document.querySelector('#connectionStatus');
const connectionLabel = document.querySelector('#connectionLabel');

function getApiBase() {
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'http://localhost:3001/api';
  }
  return window.location.origin + '/api';
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function setSample() {
  payloadInput.value = prettyJson(samples[endpointSelect.value] || samples.rpn);
}

function setConnectionState(isOnline) {
  connectionStatus.classList.toggle('online', isOnline);
  connectionStatus.classList.toggle('offline', !isOnline);
  connectionLabel.textContent = isOnline ? 'Online' : 'Offline';
}

function loadLog() {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLog(entries) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(0, MAX_LOG)));
  } catch {
    // ignore quota
  }
}

function summarizeBody(body, path) {
  if (!body || typeof body !== 'object') return path;
  if (Array.isArray(body.results)) {
    const errors = body.results.filter(function (r) {
      return r && (r.error || r.errorCode);
    }).length;
    return body.count + ' RPN result(s)' + (errors ? ', ' + errors + ' error(s)' : '');
  }
  if (body.submissionId) {
    return body.status + ' · ' + body.submissionId;
  }
  if (body.message) return String(body.message).slice(0, 80);
  return path;
}

function renderLog() {
  const tbody = document.querySelector('#eventRows');
  const events = loadLog();

  if (!events.length) {
    tbody.innerHTML =
      '<tr><td colspan="5">No tests yet from this browser. Send a request above.</td></tr>';
    return;
  }

  tbody.innerHTML = events
    .map(function (event) {
      const time = new Date(event.timestamp).toLocaleString('en-IE');
      const statusClass = event.status < 400 ? 'status-ok' : 'status-bad';
      return (
        '<tr>' +
        '<td>' +
        time +
        '</td>' +
        '<td class="mono">' +
        event.path +
        '</td>' +
        '<td class="' +
        statusClass +
        '">' +
        event.status +
        '</td>' +
        '<td>' +
        event.durationMs +
        ' ms</td>' +
        '<td>' +
        escapeHtml(event.summary) +
        '</td>' +
        '</tr>'
      );
    })
    .join('');
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pushLogEntry(entry) {
  const events = loadLog();
  events.unshift(entry);
  saveLog(events);
  renderLog();
}

async function refreshStatus() {
  const base = getApiBase();
  document.querySelector('#baseValue').textContent = base;

  try {
    const response = await fetch(base + '/status', { method: 'GET' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const status = await response.json();

    document.querySelector('#statusValue').textContent = status.status || 'running';
    document.querySelector('#modeValue').textContent = status.mode || status.host || '—';
    document.querySelector('#lastCheckValue').textContent = new Date().toLocaleTimeString('en-IE');
    setConnectionState(true);
  } catch (error) {
    document.querySelector('#statusValue').textContent = 'offline';
    document.querySelector('#modeValue').textContent = '—';
    document.querySelector('#lastCheckValue').textContent = new Date().toLocaleTimeString('en-IE');
    setConnectionState(false);
  }
}

async function sendTestRequest() {
  let payload;
  try {
    payload = JSON.parse(payloadInput.value);
  } catch (error) {
    responseOutput.textContent = 'Invalid JSON: ' + error.message;
    return;
  }

  const base = getApiBase();
  const path = '/' + endpointSelect.value;
  const url = base + path;

  sendButton.disabled = true;
  responseOutput.textContent = 'Sending to ' + url + ' …';

  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const durationMs = Date.now() - started;
    let data;
    try {
      data = await response.json();
    } catch {
      data = { error: 'Non-JSON response', status: response.status };
    }

    responseOutput.textContent = prettyJson(data);

    pushLogEntry({
      timestamp: new Date().toISOString(),
      path: '/api' + path,
      status: response.status,
      durationMs: durationMs,
      summary: summarizeBody(data, path)
    });

    await refreshStatus();
  } catch (error) {
    const durationMs = Date.now() - started;
    responseOutput.textContent = 'Request failed: ' + error.message;
    pushLogEntry({
      timestamp: new Date().toISOString(),
      path: '/api' + path,
      status: 0,
      durationMs: durationMs,
      summary: error.message
    });
    setConnectionState(false);
  } finally {
    sendButton.disabled = false;
  }
}

function clearSessionLog() {
  saveLog([]);
  renderLog();
}

endpointSelect.addEventListener('change', setSample);
resetButton.addEventListener('click', setSample);
sendButton.addEventListener('click', sendTestRequest);
refreshStatusButton.addEventListener('click', refreshStatus);
clearLogButton.addEventListener('click', clearSessionLog);

setSample();
renderLog();
refreshStatus();
setInterval(refreshStatus, 15000);
