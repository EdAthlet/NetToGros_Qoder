/**
 * Local Express fake Revenue server (port 3001).
 * Production uses Netlify Functions with the same handlers.
 */
import express from 'express';
import {
  handleRpnRequest,
  handlePsrRequest,
  getServiceStatus,
  corsHeaders
} from './lib/handlers.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const startedAt = new Date();

app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (key !== 'Content-Type') res.setHeader(key, value);
  });
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

function sendJson(res, result) {
  res.status(result.statusCode).json(result.body);
}

app.get('/api/status', (req, res) => {
  res.json(
    getServiceStatus({
      mode: 'local-express',
      port: PORT,
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startedAt.getTime()) / 1000)
    })
  );
});

app.get('/status', (req, res) => {
  res.redirect(302, '/api/status');
});

app.post('/rpn', (req, res) => {
  const count = Array.isArray(req.body && req.body.employees) ? req.body.employees.length : 0;
  console.log(`RPN request received for ${count} employee(s)`);
  sendJson(res, handleRpnRequest(req.body));
});

app.post('/api/rpn', (req, res) => {
  sendJson(res, handleRpnRequest(req.body));
});

app.post('/psr', (req, res) => {
  const count = Array.isArray(req.body && req.body.employees) ? req.body.employees.length : 0;
  console.log(`PSR received for ${count} employee(s)`);
  sendJson(res, handlePsrRequest(req.body));
});

app.post('/api/psr', (req, res) => {
  sendJson(res, handlePsrRequest(req.body));
});

app.get('/', (req, res) => {
  res.json(
    getServiceStatus({
      mode: 'local-express',
      port: PORT,
      hint: 'Use POST /rpn and POST /psr. Dashboard UI is optional; see services/fake-revenue-server README.'
    })
  );
});

app.listen(PORT, () => {
  console.log(`
============================================================
 Fake Revenue Server v2.1 (local Express)
------------------------------------------------------------
 Base URL:  http://localhost:${PORT}
 Status:    http://localhost:${PORT}/api/status
 RPN:       POST http://localhost:${PORT}/rpn
 PSR:       POST http://localhost:${PORT}/psr
============================================================
`);
});
