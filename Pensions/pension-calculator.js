/**
 * Single Public Service Pension Scheme (SPSPS) contribution calculator.
 * Logic derived from PensionsProject CSV specification.
 */

/** Annual State Pension Contributory reference (€299.30 × 52.18). */
export const SPC_ANNUAL = 15617.47;

/** SPSPS applies to public service entrants from 1 January 2013. */
export const SPSPS_START_DATE = '2013-01-01';

/** Pay frequency divisors (cd1 / PayFreqDict). */
export const PAY_FREQ = {
  weekly: 52,
  fortnight: 26.09,
  twoWeekly: 26,
  monthly: 12,
};

/** Preset contribution rates from CSV (d1, e1). */
export const RATES = {
  pensionableRemunerationPct: 3,
  netPensionableRemunerationPct: 3.5,
};

export const SCHEME_OPTIONS = [
  { value: 'SPSPS', label: 'Single Public Service Pension Scheme (SPSPS)' },
  { value: 'placeholder1', label: 'Other scheme (coming soon)', disabled: true },
  { value: 'placeholder2', label: 'Other scheme (coming soon)', disabled: true },
  { value: 'placeholder3', label: 'Other scheme (coming soon)', disabled: true },
];

/**
 * @param {string|Date|null|undefined} value
 * @returns {Date|null}
 */
export function parseEntranceDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * ca — member entered public service on or after 1 Jan 2013.
 * @param {Date|null} entranceDate
 */
export function isSpspsEntrant(entranceDate) {
  if (!entranceDate) return false;
  const threshold = new Date(`${SPSPS_START_DATE}T00:00:00`);
  return entranceDate >= threshold;
}

/**
 * @param {number} value
 * @param {number} [decimals=2]
 */
export function roundMoney(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * @typedef {Object} PensionCalculatorInput
 * @property {string|Date|null} [entranceDate] cb
 * @property {string} [scheme] cb0
 * @property {keyof PAY_FREQ} [payFrequency] cd
 * @property {number} [grossEarnings] d21
 * @property {number} [overtime] d22
 */

/**
 * @param {PensionCalculatorInput} input
 */
export function calculatePensionContribution(input = {}) {
  const entranceDate = parseEntranceDate(input.entranceDate);
  const scheme = input.scheme || 'SPSPS';
  const payFrequency = input.payFrequency || 'fortnight';
  const grossEarnings = Math.max(0, Number(input.grossEarnings) || 0);
  const overtime = Math.max(0, Number(input.overtime) || 0);

  const payDivisor = PAY_FREQ[payFrequency];
  if (!payDivisor) {
    throw new Error(`Unknown pay frequency: ${payFrequency}`);
  }

  // Scheme membership flags from CSV logical conditions
  const ca = isSpspsEntrant(entranceDate);
  const cc = ca;
  const cdFinalSalary = !ca;
  const ceServiceRelated = !ca;

  const d21 = grossEarnings;
  const d22 = overtime;
  const d2 = d21 + d22;
  const d1 = RATES.pensionableRemunerationPct;
  const e1 = RATES.netPensionableRemunerationPct;

  const d = d2 / payDivisor;
  const spcOffsetPerPeriod = (2 * SPC_ANNUAL) / payDivisor;
  const e = Math.max(0, d - spcOffsetPerPeriod);

  const schemeSupported = scheme === 'SPSPS';
  const eligible = ca && schemeSupported;

  if (!eligible) {
    return {
      entranceDate,
      scheme,
      payFrequency,
      payDivisor,
      ca,
      cc,
      cdFinalSalary,
      ceServiceRelated,
      d21,
      d22,
      d2: roundMoney(d2),
      d1,
      e1,
      d: roundMoney(d),
      e: roundMoney(e),
      b: null,
      c: null,
      a: null,
      eligible: false,
      message: !ca
        ? 'This calculator applies to Single PSPS members who entered public service on or after 1 January 2013.'
        : 'Selected pension scheme is not yet supported. Choose SPSPS for contribution estimates.',
    };
  }

  const b = d * (d1 / 100);
  const c = e * (e1 / 100);
  const a = b + c;

  return {
    entranceDate,
    scheme,
    payFrequency,
    payDivisor,
    ca,
    cc,
    cdFinalSalary,
    ceServiceRelated,
    d21,
    d22,
    d2: roundMoney(d2),
    d1,
    e1,
    d: roundMoney(d),
    e: roundMoney(e),
    b: roundMoney(b),
    c: roundMoney(c),
    a: roundMoney(a),
    eligible: true,
    message: null,
  };
}

export function formatEuro(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}