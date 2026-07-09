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
 * Default d2 from gross earnings and overtime when d2 is not supplied.
 * @param {number} grossEarnings d21
 * @param {number} overtime d22
 */
export function defaultAnnualPensionableRemuneration(grossEarnings, overtime) {
  return Math.max(0, Number(grossEarnings) || 0) + Math.max(0, Number(overtime) || 0);
}

/**
 * Resolve d2 — use explicit annual pensionable remuneration when provided.
 * @param {number} grossEarnings d21
 * @param {number} overtime d22
 * @param {number|string|null|undefined} annualPensionableRemuneration d2
 */
export function resolveAnnualPensionableRemuneration(
  grossEarnings,
  overtime,
  annualPensionableRemuneration,
) {
  if (
    annualPensionableRemuneration !== null
    && annualPensionableRemuneration !== undefined
    && annualPensionableRemuneration !== ''
  ) {
    return Math.max(0, Number(annualPensionableRemuneration) || 0);
  }
  return defaultAnnualPensionableRemuneration(grossEarnings, overtime);
}

/**
 * @typedef {Object} PensionCalculatorInput
 * @property {string|Date|null} [entranceDate] cb
 * @property {string} [scheme] cb0
 * @property {keyof PAY_FREQ} [payFrequency] cd
 * @property {number} [grossEarnings] d21
 * @property {number} [overtime] d22
 * @property {number} [annualPensionableRemuneration] d2
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
  const d2 = resolveAnnualPensionableRemuneration(
    d21,
    d22,
    input.annualPensionableRemuneration,
  );
  const d2FromComponents = defaultAnnualPensionableRemuneration(d21, d22);
  const d2Overridden = d2 !== d2FromComponents;
  const d1 = RATES.pensionableRemunerationPct;
  const e1 = RATES.netPensionableRemunerationPct;

  const d = d2 / payDivisor;
  const spcOffsetAnnual = 2 * SPC_ANNUAL;
  const spcOffsetPerPeriod = spcOffsetAnnual / payDivisor;
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
      d2FromComponents: roundMoney(d2FromComponents),
      d2Overridden,
      d1,
      e1,
      spcAnnual: SPC_ANNUAL,
      spcOffsetAnnual,
      spcOffsetPerPeriod: roundMoney(spcOffsetPerPeriod),
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
    d2FromComponents: roundMoney(d2FromComponents),
    d2Overridden,
    d1,
    e1,
    spcAnnual: SPC_ANNUAL,
    spcOffsetAnnual,
    spcOffsetPerPeriod: roundMoney(spcOffsetPerPeriod),
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

const PAY_FREQUENCY_LABELS = {
  weekly: 'Weekly',
  fortnight: 'Fortnightly',
  twoWeekly: 'Two-weekly',
  monthly: 'Monthly',
};

/**
 * Step-by-step breakdown rows for intermediate values panel.
 * @param {ReturnType<typeof calculatePensionContribution>} result
 */
export function getIntermediateBreakdowns(result) {
  const fmt = formatEuro;

  return [
    {
      code: 'd2',
      label: 'Annual pensionable remuneration',
      value: fmt(result.d2),
      formula: result.d2Overridden ? 'd2 = manual override' : 'd2 = d21 + d22',
      steps: result.d2Overridden
        ? [
            { label: 'd21 (gross earnings)', value: fmt(result.d21) },
            { label: 'd22 (overtime)', value: fmt(result.d22) },
            { label: 'd21 + d22', value: fmt(result.d2FromComponents) },
            { label: 'd2 override used', value: fmt(result.d2) },
          ]
        : [
            { label: 'd21 (gross earnings)', value: fmt(result.d21) },
            { label: 'd22 (overtime)', value: fmt(result.d22) },
            { label: 'd2 = d21 + d22', value: fmt(result.d2) },
          ],
    },
    {
      code: 'd',
      label: 'Pensionable remuneration (this period)',
      value: fmt(result.d),
      formula: 'd = d2 ÷ cd1',
      steps: [
        { label: 'd2', value: fmt(result.d2) },
        { label: 'cd1 (pay periods per year)', value: String(result.payDivisor) },
        { label: 'd = d2 ÷ cd1', value: fmt(result.d) },
      ],
    },
    {
      code: 'd1',
      label: 'Pensionable remuneration rate',
      value: `${result.d1}%`,
      formula: 'Preset SPSPS rate',
      steps: [
        { label: 'Scheme rate (CSV d1)', value: `${RATES.pensionableRemunerationPct}%` },
        { label: 'Applied as', value: `${result.d1}%` },
      ],
    },
    {
      code: 'e',
      label: 'Net pensionable remuneration (this period)',
      value: fmt(result.e),
      formula: 'e = max(0, d − (2 × SPC) ÷ cd1)',
      steps: [
        { label: 'd', value: fmt(result.d) },
        { label: 'SPC annual reference', value: fmt(result.spcAnnual) },
        { label: '2 × SPC annual', value: fmt(result.spcOffsetAnnual) },
        { label: '(2 × SPC) ÷ cd1', value: fmt(result.spcOffsetPerPeriod) },
        { label: 'e = d − offset', value: fmt(result.d - result.spcOffsetPerPeriod) },
        { label: 'e = max(0, …)', value: fmt(result.e) },
      ],
    },
    {
      code: 'e1',
      label: 'Net pensionable remuneration rate',
      value: `${result.e1}%`,
      formula: 'Preset SPSPS rate',
      steps: [
        { label: 'Scheme rate (CSV e1)', value: `${RATES.netPensionableRemunerationPct}%` },
        { label: 'Applied as', value: `${result.e1}%` },
      ],
    },
    {
      code: 'cd1',
      label: 'Pay periods per year',
      value: String(result.payDivisor),
      formula: 'cd1 = PayFreq[cd]',
      steps: [
        { label: 'cd (payroll frequency)', value: PAY_FREQUENCY_LABELS[result.payFrequency] || result.payFrequency },
        { label: 'PayFreq dictionary lookup', value: String(result.payDivisor) },
      ],
    },
  ];
}

/**
 * Step-by-step breakdown rows for contribution panel.
 * @param {ReturnType<typeof calculatePensionContribution>} result
 */
export function getContributionBreakdowns(result) {
  const fmt = formatEuro;

  if (!result.eligible) {
    return [
      {
        code: 'b',
        label: '3% of pensionable remuneration',
        value: '—',
        formula: 'b = d × (d1 ÷ 100)',
        steps: [{ label: 'Not calculated', value: result.message || 'Scheme not eligible' }],
      },
      {
        code: 'c',
        label: '3.5% of net pensionable remuneration',
        value: '—',
        formula: 'c = e × (e1 ÷ 100)',
        steps: [{ label: 'Not calculated', value: result.message || 'Scheme not eligible' }],
      },
      {
        code: 'a',
        label: 'Total contribution this period',
        value: '—',
        formula: 'a = b + c',
        total: true,
        steps: [{ label: 'Not calculated', value: result.message || 'Scheme not eligible' }],
      },
    ];
  }

  return [
    {
      code: 'b',
      label: '3% of pensionable remuneration',
      value: fmt(result.b),
      formula: 'b = d × (d1 ÷ 100)',
      steps: [
        { label: 'd', value: fmt(result.d) },
        { label: 'd1', value: `${result.d1}%` },
        { label: 'd1 ÷ 100', value: String(result.d1 / 100) },
        { label: 'b = d × (d1 ÷ 100)', value: fmt(result.b) },
      ],
    },
    {
      code: 'c',
      label: '3.5% of net pensionable remuneration',
      value: fmt(result.c),
      formula: 'c = e × (e1 ÷ 100)',
      steps: [
        { label: 'e', value: fmt(result.e) },
        { label: 'e1', value: `${result.e1}%` },
        { label: 'e1 ÷ 100', value: String(result.e1 / 100) },
        { label: 'c = e × (e1 ÷ 100)', value: fmt(result.c) },
      ],
    },
    {
      code: 'a',
      label: 'Total contribution this period',
      value: fmt(result.a),
      formula: 'a = b + c',
      total: true,
      steps: [
        { label: 'b', value: fmt(result.b) },
        { label: 'c', value: fmt(result.c) },
        { label: 'a = b + c', value: fmt(result.a) },
      ],
    },
  ];
}