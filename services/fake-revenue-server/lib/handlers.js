/**
 * Shared fake Revenue logic for local Express and Netlify Functions.
 * Practice only — not real ROS.
 */

function parsePpsnNumber(ppsn) {
  return Number.parseInt(String(ppsn || '').replace(/\D/g, ''), 10) || 1234567;
}

function generateFakeRPN(ppsn, employmentId, taxYear) {
  if (!ppsn) {
    return {
      ppsn,
      employmentId: employmentId || '1',
      error: 'PPSN is required',
      errorCode: 'ERR_MISSING_PPSN'
    };
  }

  const ppsnNum = parsePpsnNumber(ppsn);
  const profiles = {
    high: { taxCredit: 4000, cop: 44000, rpnBase: 87000 },
    standard: { taxCredit: 3750, cop: 42000, rpnBase: 65000 },
    low: { taxCredit: 4000, cop: 20000, rpnBase: 32000 },
    error: { error: true }
  };

  let profile;
  if (ppsnNum % 10 === 0) profile = profiles.error;
  else if (ppsnNum % 5 === 0) profile = profiles.high;
  else if (ppsnNum % 3 === 0) profile = profiles.low;
  else profile = profiles.standard;

  if (profile.error) {
    return {
      ppsn,
      employmentId: employmentId || '1',
      error: 'Invalid or unknown PPSN',
      errorCode: 'ERR_001'
    };
  }

  const year = taxYear || 2026;
  const rpnNumber = profile.rpnBase + Math.floor(Math.random() * 5000);

  return {
    rpnNumber,
    ppsn,
    employmentId: employmentId || '1',
    taxYear: year,
    yearlyTaxCredit: profile.taxCredit,
    periodicTaxCredit: Number((profile.taxCredit / 52).toFixed(2)),
    yearlyStandardRateCutOffPoint: profile.cop,
    periodicStandardRateCutOffPoint: Number((profile.cop / 52).toFixed(2)),
    uscBands: [
      { rate: 0.5, threshold: 12012 },
      { rate: 2.0, threshold: 28700 },
      { rate: 4.0, threshold: 70044 },
      { rate: 8.0, threshold: null }
    ],
    prsiClass: 'A',
    basis: 'Cumulative',
    previousPayYTD: 0,
    previousTaxYTD: 0,
    previousUSCYTD: 0,
    lptDeduction: ppsnNum % 7 === 0 ? 45 : 0,
    message: 'RPN generated successfully (FAKE)'
  };
}

/**
 * @param {object} body
 * @returns {{ statusCode: number, body: object }}
 */
function handleRpnRequest(body) {
  const payload = body && typeof body === 'object' ? body : {};
  const { employees, taxYear, employerRegistrationNumber } = payload;

  if (!Array.isArray(employees)) {
    return {
      statusCode: 400,
      body: {
        error: 'Bad Request',
        message: 'employees array is required'
      }
    };
  }

  if (employees.length > 1000) {
    return {
      statusCode: 400,
      body: {
        error: 'Bad Request',
        message: 'employees array cannot contain more than 1000 records'
      }
    };
  }

  const year = taxYear || 2026;
  const results = employees.map((employee) =>
    generateFakeRPN(
      employee && employee.ppsn,
      employee && employee.employmentId,
      year
    )
  );

  return {
    statusCode: 200,
    body: {
      requestId: `REQ-${Date.now()}`,
      employerRegistrationNumber: employerRegistrationNumber || '1234567T',
      taxYear: year,
      timestamp: new Date().toISOString(),
      count: results.length,
      results
    }
  };
}

/**
 * @param {object} body
 * @returns {{ statusCode: number, body: object }}
 */
function handlePsrRequest(body) {
  const payload = body && typeof body === 'object' ? body : {};
  const { employerRegistrationNumber, taxYear, payPeriod, employees } = payload;
  const employeeList = Array.isArray(employees) ? employees : [];

  const submissionId = `PSR-${Date.now()}`;

  return {
    statusCode: 200,
    body: {
      submissionId,
      status: 'ACCEPTED',
      employerRegistrationNumber: employerRegistrationNumber || '1234567T',
      taxYear: taxYear || 2026,
      payPeriod: payPeriod || '2026-05',
      timestamp: new Date().toISOString(),
      message: 'Payroll Submission accepted (FAKE)',
      summary: {
        totalGrossPay: employeeList.reduce((sum, e) => sum + (e.grossPay || 0), 0),
        totalPAYE: employeeList.reduce((sum, e) => sum + (e.paye || 0), 0),
        totalUSC: employeeList.reduce((sum, e) => sum + (e.usc || 0), 0),
        totalPRSI: employeeList.reduce((sum, e) => sum + (e.prsi || 0), 0)
      }
    }
  };
}

function getServiceStatus(extra) {
  return {
    status: 'running',
    service: 'Fake Revenue Server',
    version: '2.1',
    host: 'netlify-or-local',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /rpn or /api/rpn — RPN request (single or bulk)',
      'POST /psr or /api/psr — Payroll Submission Request',
      'GET /api/status — health check'
    ],
    ...(extra || {})
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export {
  parsePpsnNumber,
  generateFakeRPN,
  handleRpnRequest,
  handlePsrRequest,
  getServiceStatus,
  corsHeaders
};
