/**
 * Tax Credit Calculator — Ireland (2026)
 * Rates: Revenue tax credits / dedicated guidance.
 * Structure: IPAS-style personal list + PAYE training extras (rent, naval, dogs, MITC, other RPN).
 */

/**
 * @typedef {Object} CreditItem
 * @property {string} id
 * @property {string} label
 * @property {string} [shortLabel]
 * @property {number} amount - list / max / unit tax-credit value (€)
 * @property {string} [group] - exclusive radio-style group
 * @property {string[]} [exclusiveWith] - ids that cannot be selected together
 * @property {0|1|2} [indent]
 * @property {string} [badge]
 * @property {string} [section] - section heading key
 * @property {'fixed'|'max'|'calc'|'qty'} [mode]
 *  - fixed: use amount as-is
 *  - max: editable amount 0…amount (defaults to max when first ticked)
 *  - calc: editable amount 0…amount (defaults to 0 — user must enter calculated figure)
 *  - qty: amount × quantity (e.g. incapacitated child)
 * @property {number} [allowance] - qualifying allowance when amount is the tax credit (dogs)
 */

const TAX_CREDIT_RATES = {
  2026: {
    label: "2026",
    note: "Current rates",
    /** @type {CreditItem[]} */
    credits: [
      // —— Personal status ——
      {
        id: "personal_single",
        label: "Single / Widowed Person or Surviving Civil Partner Tax Credit",
        shortLabel: "Personal (single)",
        amount: 2000,
        group: "personal_base",
        section: "personal",
      },
      {
        id: "personal_married",
        label: "Married Person or Civil Partner Tax Credit",
        shortLabel: "Personal (married)",
        amount: 4000,
        group: "personal_base",
        exclusiveWith: [
          "widowed_y1",
          "widowed_y2",
          "widowed_y3",
          "widowed_y4",
          "widowed_y5",
          "widowed_add_no_child",
        ],
        section: "personal",
      },
      {
        id: "widowed_bereavement_year",
        label: "Widowed Person or Surviving Civil Partner in year of bereavement",
        shortLabel: "Widowed (bereavement year)",
        amount: 4000,
        group: "personal_base",
        section: "personal",
      },
      {
        id: "widowed_no_child_total",
        label: "Widowed / Surviving Civil Partner without qualifying child (subsequent years) — total personal credit",
        shortLabel: "Widowed no child (total)",
        amount: 2540,
        group: "personal_base",
        badge: "€2,000 + €540",
        section: "personal",
      },
      {
        id: "widowed_add_no_child",
        label: "Additional widowed amount only — no qualifying child (add to personal single €2,000)",
        shortLabel: "Widowed add. €540",
        amount: 540,
        indent: 1,
        group: "widowed_extra",
        exclusiveWith: ["personal_married"],
        section: "personal",
      },
      {
        id: "widowed_y1",
        label: "With qualifying child — First year after year of bereavement",
        shortLabel: "Widowed Y1 (with child)",
        amount: 3600,
        indent: 2,
        group: "widowed_extra",
        exclusiveWith: ["personal_married"],
        section: "personal",
      },
      {
        id: "widowed_y2",
        label: "With qualifying child — Second year after year of bereavement",
        shortLabel: "Widowed Y2 (with child)",
        amount: 3150,
        indent: 2,
        group: "widowed_extra",
        exclusiveWith: ["personal_married"],
        section: "personal",
      },
      {
        id: "widowed_y3",
        label: "With qualifying child — Third year after year of bereavement",
        shortLabel: "Widowed Y3 (with child)",
        amount: 2700,
        indent: 2,
        group: "widowed_extra",
        exclusiveWith: ["personal_married"],
        section: "personal",
      },
      {
        id: "widowed_y4",
        label: "With qualifying child — Fourth year after year of bereavement",
        shortLabel: "Widowed Y4 (with child)",
        amount: 2250,
        indent: 2,
        group: "widowed_extra",
        exclusiveWith: ["personal_married"],
        section: "personal",
      },
      {
        id: "widowed_y5",
        label: "With qualifying child — Fifth year after year of bereavement",
        shortLabel: "Widowed Y5 (with child)",
        amount: 1800,
        indent: 2,
        group: "widowed_extra",
        exclusiveWith: ["personal_married"],
        section: "personal",
      },
      {
        id: "spccc",
        label: "Single Person Child Carer Tax Credit",
        shortLabel: "SPCCC",
        amount: 1900,
        section: "personal",
      },
      {
        id: "employee_paye",
        label: "Employee (PAYE) Tax Credit",
        shortLabel: "Employee / PAYE",
        amount: 2000,
        mode: "max",
        badge: "max",
        section: "personal",
      },
      {
        id: "home_carer",
        label: "Home Carer Tax Credit",
        shortLabel: "Home Carer",
        amount: 1950,
        mode: "max",
        badge: "max / tapered",
        section: "personal",
      },
      {
        id: "age_single",
        label: "Age Tax Credit — Single / Widowed Person or Surviving Civil Partner",
        shortLabel: "Age (single)",
        amount: 245,
        group: "age",
        section: "personal",
      },
      {
        id: "age_married",
        label: "Age Tax Credit — Married Couple or Civil Partnership",
        shortLabel: "Age (married)",
        amount: 490,
        group: "age",
        section: "personal",
      },
      {
        id: "blind_single",
        label: "Blind Person Tax Credit — Single person, or one Spouse or Civil Partner blind",
        shortLabel: "Blind (single / one)",
        amount: 1950,
        group: "blind",
        section: "personal",
      },
      {
        id: "blind_both",
        label: "Blind Person Tax Credit — Married or Civil Partnership — both Spouses or Civil Partners blind",
        shortLabel: "Blind (both)",
        amount: 3900,
        group: "blind",
        section: "personal",
      },
      {
        id: "incapacitated_child",
        label: "Incapacitated Child Tax Credit (per qualifying child)",
        shortLabel: "Incapacitated Child",
        amount: 3800,
        mode: "qty",
        badge: "per child",
        section: "personal",
      },
      {
        id: "dependent_relative",
        label: "Dependent Relative Tax Credit",
        shortLabel: "Dependent Relative",
        amount: 305,
        section: "personal",
      },
      {
        id: "earned_income",
        label: "Earned Income Tax Credit",
        shortLabel: "Earned Income",
        amount: 2000,
        mode: "max",
        badge: "max",
        section: "personal",
      },
      {
        id: "fisher",
        label: "Fisher Tax Credit",
        shortLabel: "Fisher",
        amount: 1270,
        exclusiveWith: ["naval"],
        section: "personal",
      },
      {
        id: "naval",
        label: "Sea-going Naval Personnel Tax Credit",
        shortLabel: "Naval (sea-going)",
        amount: 1500,
        exclusiveWith: ["fisher"],
        section: "personal",
      },

      // —— Housing / other PAYE-relevant ——
      {
        id: "rent_single",
        label: "Rent Tax Credit — single person (max)",
        shortLabel: "Rent (single)",
        amount: 1000,
        mode: "max",
        badge: "max",
        group: "rent",
        section: "housing",
      },
      {
        id: "rent_joint",
        label: "Rent Tax Credit — jointly assessed couple (max)",
        shortLabel: "Rent (joint)",
        amount: 2000,
        mode: "max",
        badge: "max",
        group: "rent",
        section: "housing",
      },
      {
        id: "mortgage_interest",
        label: "Mortgage Interest Tax Credit (2026 max per qualifying residence)",
        shortLabel: "Mortgage Interest",
        amount: 625,
        mode: "calc",
        badge: "calc · max €625",
        section: "housing",
      },

      // —— Dog allowances (tax credit = allowance × 20%) ——
      {
        id: "guide_dog",
        label: "Guide Dog Allowance — tax credit (qualifying allowance €825 @ 20%)",
        shortLabel: "Guide Dog credit",
        amount: 165,
        allowance: 825,
        badge: "allowance €825",
        section: "dogs",
      },
      {
        id: "assistance_dog",
        label: "Assistance Dog Allowance — tax credit (qualifying allowance €825 @ 20%)",
        shortLabel: "Assistance Dog credit",
        amount: 165,
        allowance: 825,
        badge: "allowance €825",
        section: "dogs",
      },
    ],
  },
};

const SECTION_TITLES = {
  personal: "Personal Tax Credits",
  housing: "Housing & other PAYE credits",
  dogs: "Dog allowances (standard-rate relief)",
};

/**
 * When-to-apply help — Revenue.ie & Citizens Information (2025–2026).
 * @type {Record<string, { title: string, when: string, notes?: string, revenue?: string, citizens?: string }>}
 */
const CREDIT_HELP = {
  personal_single: {
    title: "Personal tax credit (single / widowed / surviving civil partner)",
    when:
      "Apply if you are taxed as a single person, or as a widowed person / surviving civil partner using the €2,000 personal base (e.g. with dependent children after bereavement year, together with SPCCC / widowed parent credits).",
    notes:
      "Mutually exclusive with married personal, bereavement-year personal, and the combined €2,540 widowed-no-child total. Widowed without dependent children after the bereavement year: use the €2,540 combined option, or personal €2,000 + additional €540.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/marital-and-civil-status/personal-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/introduction-to-income-tax-credits-and-reliefs/",
  },
  personal_married: {
    title: "Personal tax credit (married / civil partnership)",
    when:
      "Apply if married or in a civil partnership and assessed as a couple (€4,000 for 2026). Credits may be allocated between spouses — one employee’s RPN may not show the full €4,000.",
    notes:
      "Mutually exclusive with single / bereavement / widowed-no-child personal options, and with Widowed Parent years 1–5 (and the €540 widowed additional amount).",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/marital-and-civil-status/personal-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax/taxation-of-married-people/",
  },
  widowed_bereavement_year: {
    title: "Widowed / surviving civil partner — year of bereavement",
    when:
      "Apply for the tax year in which your spouse or civil partner dies. You generally get the married-level personal credit (€4,000).",
    notes: "SPCCC is not available in the year of bereavement. Later years use personal + widowed parent / no-child amounts.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/marital-and-civil-status/widowed-person-or-surviving-civil-partner/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_no_child_total: {
    title: "Widowed without qualifying child — total €2,540",
    when:
      "Subsequent years after bereavement if you have no qualifying dependent child. Revenue’s chart shows €2,540 (personal €2,000 + additional €540).",
    notes: "Prefer this single line for training. Do not also tick personal single + €540 additional.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-relief-charts/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_add_no_child: {
    title: "Additional widowed amount €540 only",
    when:
      "Textbook split: personal single €2,000 + this €540 = €2,540 when there is no qualifying child after the bereavement year.",
    notes: "Prefer the combined €2,540 option unless teaching the two-line breakdown. Exclusive with the 5-year widowed parent bands.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-relief-charts/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_y1: {
    title: "Widowed Parent Tax Credit — year 1 after bereavement",
    when:
      "First tax year after the year of death if you have a qualifying child, have not remarried by year start, and are not cohabiting.",
    notes: "€3,600 (2026). Dedicated Revenue guidance confirms €2,700 for year 3 (not the chart typo €2,270).",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/widowed-parent-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_y2: {
    title: "Widowed Parent Tax Credit — year 2",
    when: "Second tax year after the year of death if widowed parent conditions still apply.",
    notes: "€3,150 (2026).",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/widowed-parent-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_y3: {
    title: "Widowed Parent Tax Credit — year 3",
    when: "Third tax year after the year of death if conditions still apply.",
    notes: "€2,700 (2026) — dedicated Widowed Parent guidance, not the €2,270 chart typo.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/widowed-parent-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_y4: {
    title: "Widowed Parent Tax Credit — year 4",
    when: "Fourth tax year after the year of death if conditions still apply.",
    notes: "€2,250 (2026).",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/widowed-parent-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_y5: {
    title: "Widowed Parent Tax Credit — year 5",
    when: "Fifth (final) tax year after the year of death if conditions still apply.",
    notes: "€1,800 (2026).",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/widowed-parent-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  spccc: {
    title: "Single Person Child Carer Credit (SPCCC)",
    when:
      "You care for a qualifying child on your own; primary claimant has the child living with them more than 6 months. Not jointly assessed as married/civil partners; not cohabiting. Not available in the year of bereavement.",
    notes: "Also increases the standard-rate band. One SPCCC per primary claimant.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/single-person-child-carer-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/single-person-child-carer-tax-credit/",
  },
  employee_paye: {
    title: "Employee (PAYE) Tax Credit",
    when:
      "PAYE income: salary, BIK, occupational pension, many taxable DSP payments. Full €2,000 if PAYE income ≥ €10,000; if lower, limited to 20% of that PAYE income.",
    notes:
      "Not transferable. Proprietary directors use Earned Income instead. Employee + Earned Income for the same individual cannot exceed €2,000 combined — this calculator caps that automatically.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/income-and-employment/employee-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/employment-tax-credits-and-reliefs/",
  },
  home_carer: {
    title: "Home Carer Tax Credit",
    when:
      "Married/civil partners, jointly assessed; one partner cares for a dependent (Child Benefit child, person 65+, or permanently incapacitated) — not the spouse/partner.",
    notes:
      "Full credit if carer income < €7,200; tapers above; nil at €11,100+ (2026). Enter the tapered amount if reduced. Cannot claim with the increased dual-earner standard-rate band.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/home-carer-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/home-carers-tax-credit/",
  },
  age_single: {
    title: "Age Tax Credit — single / widowed",
    when: "Aged 65 or over; single / widowed / surviving civil partner status.",
    notes: "€245. Separate age exemption limits may also apply.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/age-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/older-peoples-tax-credits-and-reliefs/",
  },
  age_married: {
    title: "Age Tax Credit — married / civil partnership",
    when: "Married/civil partners and either partner is 65+.",
    notes: "€490. Exclusive with single age credit.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/age-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/older-peoples-tax-credits-and-reliefs/",
  },
  blind_single: {
    title: "Blind Person Tax Credit — one qualifying person",
    when: "You are blind (Revenue criteria), or married/civil partners and one partner is blind.",
    notes: "€1,950 (2026). May combine with Guide Dog / Assistance Dog allowance credit.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/blind-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/tax-credits-and-reliefs-for-people-with-disabilities/tax-reliefs-for-people-with-a-visual-impairment/",
  },
  blind_both: {
    title: "Blind Person Tax Credit — both partners",
    when: "Married/civil partners and both are blind.",
    notes: "€3,900 (2026).",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/blind-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/tax-credits-and-reliefs-for-people-with-disabilities/tax-reliefs-for-people-with-a-visual-impairment/",
  },
  incapacitated_child: {
    title: "Incapacitated Child Tax Credit",
    when:
      "Parent/guardian of a child who is permanently incapacitated and whom you maintain. Can be claimed for each qualifying child — use the quantity control.",
    notes: "€3,800 per child (2026). Not with Dependent Relative for the same child.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/incapacitated-child-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/tax-credits-and-reliefs-for-people-with-disabilities/incapacitated-child-tax-credit/",
  },
  dependent_relative: {
    title: "Dependent Relative Tax Credit",
    when:
      "You maintain a relative with income under the limit (€18,028 for 2026).",
    notes: "€305. Not for the same person as Incapacitated Child credit.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/dependant-relative-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/tax-credits-and-reliefs-for-people-with-disabilities/dependent-relative-tax-credit/",
  },
  earned_income: {
    title: "Earned Income Tax Credit",
    when:
      "Self-employed Case I/II and proprietary director pay — not ordinary PAYE employment already fully covered by the Employee credit. Lower of €2,000 or 20% of qualifying earned income.",
    notes:
      "Not for rent/deposit interest. Combined with Employee PAYE credit cannot exceed €2,000 for the same individual (auto-capped here).",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/income-and-employment/earned-income-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/employment-tax-credits-and-reliefs/",
  },
  fisher: {
    title: "Fisher Tax Credit",
    when:
      "Fisher at sea with at least 80 days actively fishing on an EU/UK-registered vessel in the year. Up to €1,270.",
    notes:
      "Cannot be claimed in the same year as Sea-going Naval Personnel Tax Credit or Seafarers’ Allowance.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/income-and-employment/seafarers-allowance-fisher-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/employment-tax-credits-and-reliefs/",
  },
  naval: {
    title: "Sea-going Naval Personnel Tax Credit",
    when:
      "Permanent Irish Naval Service member who spent at least 80 days at sea on an Irish naval vessel in the year before the claim year. €1,500 for years 2021–2029.",
    notes:
      "Cannot be combined with Fisher Tax Credit or Seafarers’ Allowance in the same year. Available through 2029.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/income-and-employment/seafarers-allowance-fisher-tax-credit/sea-going-naval-personnel-tax-credit.aspx",
  },
  rent_single: {
    title: "Rent Tax Credit — single",
    when:
      "Qualifying private rented accommodation (not social housing / certain exclusions). Single / non-joint assessment max €1,000 for 2026. Can be claimed in-year via myAccount and may appear on the RPN.",
    notes: "Enter the amount granted (up to €1,000). Exclusive with joint rent credit.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/land-and-property/rent-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/housing-taxes-and-reliefs/rent-tax-credit/",
  },
  rent_joint: {
    title: "Rent Tax Credit — jointly assessed couple",
    when: "Jointly assessed married couple / civil partners — max €2,000 for 2026.",
    notes: "Enter amount granted (up to €2,000). Exclusive with single rent credit.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/land-and-property/rent-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/housing-taxes-and-reliefs/rent-tax-credit/",
  },
  mortgage_interest: {
    title: "Mortgage Interest Tax Credit (2026)",
    when:
      "Qualifying principal private residence interest increase vs 2022. Formula: (2026 interest − 2022 interest) × 50% × 20%, max €625 per qualifying residence for tax year 2026.",
    notes:
      "Dedicated Revenue MITC guidance: max €625 for 2026 (not the €1,250 on the general rates chart). Not automatic — enter the calculated credit when known (often end of year). Defaults to €0 until you enter a figure.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/land-and-property/mortgage/index.aspx",
  },
  guide_dog: {
    title: "Guide Dog Allowance → tax credit €165",
    when:
      "Blind / visually impaired person who maintains a registered guide dog. Qualifying allowance €825 relieved at standard rate 20% → tax credit €165.",
    notes: "List column shows the tax credit (€165), not the €825 allowance. Separate from Assistance Dog.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/guide-dog-allowance/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/tax-credits-and-reliefs-for-people-with-disabilities/tax-reliefs-for-people-with-a-visual-impairment/",
  },
  assistance_dog: {
    title: "Assistance Dog Allowance → tax credit €165",
    when:
      "You maintain a registered assistance dog meeting Revenue conditions. Same structure as Guide Dog: allowance €825 @ 20% = €165 tax credit.",
    notes: "Listed separately from Guide Dog Allowance.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/assistance-dogs/index.aspx",
  },
};

const AVAILABLE_YEARS = [2024, 2025, 2026];
const DEFAULT_YEAR = 2026;

/** @type {number} */
let selectedYear = DEFAULT_YEAR;

/** @type {Set<string>} */
const selectedIds = new Set();

/** Editable amounts for max/calc modes (tax credit €) */
/** @type {Map<string, number>} */
const amountOverrides = new Map();

/** Quantity for qty-mode credits */
/** @type {Map<string, number>} */
const qtyOverrides = new Map();

/** Other annual credits from RPN not in the checklist */
let otherRpnCredits = 0;

/** @type {string|null} */
let openInfoId = null;

function formatEuro(value) {
  const n = Number(value) || 0;
  return (
    "€" +
    n.toLocaleString("en-IE", {
      minimumFractionDigits: n % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })
  );
}

function getYearConfig(year) {
  return TAX_CREDIT_RATES[year] || null;
}

function getCreditById(id) {
  const cfg = getYearConfig(selectedYear);
  return cfg ? cfg.credits.find((c) => c.id === id) : null;
}

/**
 * Effective tax-credit value for a selected credit (before Employee+Earned cap).
 */
function rawCreditValue(credit) {
  const mode = credit.mode || "fixed";
  if (mode === "qty") {
    const q = Math.max(1, Math.floor(qtyOverrides.get(credit.id) || 1));
    return roundMoney(credit.amount * q);
  }
  if (mode === "max" || mode === "calc") {
    const max = credit.amount;
    let v =
      amountOverrides.has(credit.id)
        ? amountOverrides.get(credit.id)
        : mode === "calc"
          ? 0
          : max;
    v = Math.min(max, Math.max(0, Number(v) || 0));
    return roundMoney(v);
  }
  return roundMoney(credit.amount);
}

function roundMoney(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Apply combination rules (Employee + Earned ≤ €2,000).
 * Returns { lines: {credit, value, note?}[], warnings: string[], total }
 */
function buildEffectiveSelection() {
  const selected = getSelectedCredits();
  const warnings = [];
  /** @type {{ credit: CreditItem, value: number, note?: string }[]} */
  const lines = selected.map((credit) => ({
    credit,
    value: rawCreditValue(credit),
  }));

  const empIdx = lines.findIndex((l) => l.credit.id === "employee_paye");
  const earnedIdx = lines.findIndex((l) => l.credit.id === "earned_income");
  if (empIdx >= 0 && earnedIdx >= 0) {
    const combined = lines[empIdx].value + lines[earnedIdx].value;
    if (combined > 2000) {
      // Prefer keeping employee, reduce earned; if still over, cap employee
      let emp = lines[empIdx].value;
      let earned = lines[earnedIdx].value;
      if (emp >= 2000) {
        earned = 0;
        emp = 2000;
      } else {
        earned = Math.min(earned, 2000 - emp);
      }
      lines[empIdx].value = roundMoney(emp);
      lines[earnedIdx].value = roundMoney(earned);
      lines[empIdx].note = "capped with Earned";
      lines[earnedIdx].note = "capped with Employee";
      warnings.push(
        "Employee (PAYE) + Earned Income credits cannot exceed €2,000 for the same individual — amounts have been capped."
      );
    }
  }

  if (selectedIds.has("fisher") && selectedIds.has("naval")) {
    warnings.push("Fisher and Sea-going Naval Personnel credits cannot both apply — deselect one.");
  }

  if (selectedIds.has("widowed_no_child_total") && selectedIds.has("widowed_add_no_child")) {
    warnings.push(
      "You selected both the combined €2,540 widowed-no-child total and the €540 additional line — use one approach only."
    );
  }
  if (
    selectedIds.has("widowed_no_child_total") &&
    selectedIds.has("personal_single")
  ) {
    warnings.push(
      "Combined widowed-no-child €2,540 already includes personal credit — do not also tick personal single."
    );
  }

  if (selectedIds.has("mortgage_interest")) {
    const v = rawCreditValue(getCreditById("mortgage_interest"));
    if (v === 0) {
      warnings.push(
        "Mortgage Interest Tax Credit is ticked but amount is €0 — enter the calculated 2026 credit (max €625), not an automatic figure."
      );
    }
  }

  let total = lines.reduce((s, l) => s + l.value, 0);
  if (otherRpnCredits > 0) {
    total += otherRpnCredits;
  }

  return { lines, warnings, total: roundMoney(total), otherRpnCredits };
}

function renderYearSidebar() {
  const list = document.getElementById("yearList");
  if (!list) return;
  list.innerHTML = "";

  AVAILABLE_YEARS.forEach((year) => {
    const cfg = getYearConfig(year);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "year-button";
    btn.dataset.year = String(year);

    const hasRates = Boolean(cfg);
    if (!hasRates) {
      btn.classList.add("disabled");
      btn.disabled = true;
      btn.title = `${year} rates coming soon`;
    }
    if (year === selectedYear && hasRates) btn.classList.add("active");

    btn.innerHTML =
      `<span class="year-label">${year}</span>` +
      (year === DEFAULT_YEAR && hasRates
        ? `<span class="year-note">Current Rates</span>`
        : !hasRates
          ? `<span class="year-note">Coming soon</span>`
          : "");

    if (hasRates) btn.addEventListener("click", () => selectYear(year));
    list.appendChild(btn);
  });
}

function applyExclusiveGroup(creditId, group) {
  if (!group) return;
  const cfg = getYearConfig(selectedYear);
  if (!cfg) return;
  cfg.credits.forEach((c) => {
    if (c.group === group && c.id !== creditId) {
      deselectCredit(c.id);
    }
  });
}

function applyExclusiveWith(credit) {
  const others = credit.exclusiveWith || [];
  others.forEach((id) => deselectCredit(id));
}

function deselectCredit(id) {
  selectedIds.delete(id);
  const input = document.querySelector(`input[data-credit-id="${id}"]`);
  if (input) input.checked = false;
  const row = input && input.closest(".credit-row");
  if (row) row.classList.remove("is-checked");
  toggleRowExtras(id, false);
}

function toggleRowExtras(id, on) {
  const row = document.querySelector(`.credit-row[data-credit-id="${id}"]`);
  if (!row) return;
  const extras = row.querySelector(".credit-extras");
  if (extras) extras.hidden = !on;
}

function renderCreditList() {
  const body = document.getElementById("creditListBody");
  const yearBadge = document.getElementById("taxYearBadge");
  const cfg = getYearConfig(selectedYear);

  if (yearBadge) yearBadge.textContent = cfg ? `Tax year ${selectedYear}` : "—";
  if (!body) return;
  body.innerHTML = "";

  if (!cfg) {
    body.innerHTML =
      '<p class="formula-empty" style="padding: 12px;">Rates for this year are not available yet.</p>';
    return;
  }

  let lastSection = null;

  cfg.credits.forEach((credit) => {
    const section = credit.section || "personal";
    if (section !== lastSection) {
      lastSection = section;
      const title = document.createElement("div");
      title.className = "credit-section-title";
      title.textContent = SECTION_TITLES[section] || section;
      body.appendChild(title);
    }

    body.appendChild(buildCreditRow(credit));
  });

  // Other RPN block
  body.appendChild(buildOtherRpnBlock());
}

/**
 * Select or deselect a credit and run exclusivity / amount defaults.
 * @param {CreditItem} credit
 * @param {boolean} on
 */
function setCreditSelected(credit, on) {
  const mode = credit.mode || "fixed";
  const row = document.querySelector(`.credit-row[data-credit-id="${credit.id}"]`);
  const input = row && row.querySelector('input[type="checkbox"]');
  const extras = row && row.querySelector(".credit-extras");

  if (on) {
    selectedIds.add(credit.id);
    applyExclusiveGroup(credit.id, credit.group);
    applyExclusiveWith(credit);
    const cfg = getYearConfig(selectedYear);
    if (cfg) {
      cfg.credits.forEach((c) => {
        if ((c.exclusiveWith || []).includes(credit.id)) deselectCredit(c.id);
      });
    }
    if (credit.id === "widowed_no_child_total") deselectCredit("widowed_add_no_child");
    if (credit.id === "widowed_add_no_child") deselectCredit("widowed_no_child_total");

    if (mode === "max" && !amountOverrides.has(credit.id)) {
      amountOverrides.set(credit.id, credit.amount);
      const ain = row && row.querySelector(".amount-input");
      if (ain) ain.value = String(credit.amount);
    }
    if (mode === "calc" && !amountOverrides.has(credit.id)) {
      amountOverrides.set(credit.id, 0);
    }
    if (mode === "qty" && !qtyOverrides.has(credit.id)) {
      qtyOverrides.set(credit.id, 1);
    }
    if (input) input.checked = true;
    if (row) row.classList.add("is-checked");
    if (extras && (mode !== "fixed" || credit.allowance)) extras.hidden = false;
  } else {
    selectedIds.delete(credit.id);
    if (input) input.checked = false;
    if (row) row.classList.remove("is-checked");
    if (extras) extras.hidden = true;
  }

  syncRowCheckedState();
  updateFormula();
}

function hasTextSelection() {
  const sel = window.getSelection && window.getSelection();
  if (!sel || sel.isCollapsed || !sel.toString()) return false;
  return sel.toString().trim().length > 0;
}

function buildCreditRow(credit) {
  const row = document.createElement("div");
  row.className = "credit-row";
  row.dataset.creditId = credit.id;
  row.setAttribute("role", "checkbox");
  row.setAttribute("aria-checked", selectedIds.has(credit.id) ? "true" : "false");
  row.tabIndex = 0;
  if (credit.indent === 1) row.classList.add("is-indent");
  if (credit.indent === 2) row.classList.add("is-indent-2");
  if (selectedIds.has(credit.id)) row.classList.add("is-checked");

  const checked = selectedIds.has(credit.id) ? " checked" : "";
  const badge = credit.badge
    ? `<span class="credit-badge">${escapeHtml(credit.badge)}</span>`
    : "";
  const help = CREDIT_HELP[credit.id];
  const listAmount = formatEuro(credit.amount);

  row.innerHTML = `
    <span class="credit-check">
      <input type="checkbox" data-credit-id="${credit.id}" aria-label="${escapeAttr(credit.label)}"${checked}>
    </span>
    <div class="credit-main">
      <span class="credit-label">${escapeHtml(credit.label)}${badge}</span>
      <div class="credit-extras" data-extras-for="${credit.id}" hidden></div>
    </div>
    <button type="button" class="info-btn" data-info-id="${credit.id}" aria-label="When to apply: ${escapeAttr(credit.shortLabel || credit.label)}" title="When to apply">i</button>
    <span class="credit-amount" data-amount-for="${credit.id}">${listAmount}</span>
  `;

  const extras = row.querySelector(".credit-extras");
  const mode = credit.mode || "fixed";

  if (mode === "max" || mode === "calc") {
    const defaultVal =
      mode === "calc"
        ? amountOverrides.has(credit.id)
          ? amountOverrides.get(credit.id)
          : 0
        : amountOverrides.has(credit.id)
          ? amountOverrides.get(credit.id)
          : credit.amount;
    extras.innerHTML = `
      <label class="extra-field">
        <span>${mode === "calc" ? "Calculated credit €" : "Amount € (max " + credit.amount.toLocaleString("en-IE") + ")"}</span>
        <input type="number" class="amount-input" data-amount-id="${credit.id}" min="0" max="${credit.amount}" step="0.01" value="${defaultVal}">
      </label>
    `;
    const ain = extras.querySelector(".amount-input");
    ain.addEventListener("input", () => {
      let v = parseFloat(ain.value);
      if (Number.isNaN(v)) v = 0;
      v = Math.min(credit.amount, Math.max(0, v));
      amountOverrides.set(credit.id, v);
      updateFormula();
    });
    ain.addEventListener("click", (e) => e.stopPropagation());
    ain.addEventListener("mousedown", (e) => e.stopPropagation());
  } else if (mode === "qty") {
    const q = qtyOverrides.get(credit.id) || 1;
    extras.innerHTML = `
      <label class="extra-field">
        <span>Qualifying children</span>
        <input type="number" class="qty-input" data-qty-id="${credit.id}" min="1" max="20" step="1" value="${q}">
      </label>
    `;
    const qin = extras.querySelector(".qty-input");
    qin.addEventListener("input", () => {
      let v = parseInt(qin.value, 10);
      if (Number.isNaN(v) || v < 1) v = 1;
      qtyOverrides.set(credit.id, v);
      const amtEl = row.querySelector(`[data-amount-for="${credit.id}"]`);
      if (amtEl) amtEl.textContent = formatEuro(credit.amount * v);
      updateFormula();
    });
    qin.addEventListener("click", (e) => e.stopPropagation());
    qin.addEventListener("mousedown", (e) => e.stopPropagation());
    if (selectedIds.has(credit.id)) {
      const amtEl = row.querySelector(`[data-amount-for="${credit.id}"]`);
      if (amtEl) amtEl.textContent = formatEuro(credit.amount * q);
    }
  }

  if (credit.allowance) {
    const note = document.createElement("div");
    note.className = "credit-allowance-note";
    note.textContent = `Tax credit ${formatEuro(credit.amount)} = allowance ${formatEuro(credit.allowance)} × 20%`;
    extras.appendChild(note);
  }

  if (selectedIds.has(credit.id) && (mode !== "fixed" || credit.allowance)) {
    extras.hidden = false;
  }

  if (!help) {
    const btn = row.querySelector(".info-btn");
    if (btn) btn.hidden = true;
  }

  const input = row.querySelector('input[type="checkbox"]');
  input.addEventListener("click", (e) => e.stopPropagation());
  input.addEventListener("change", () => {
    setCreditSelected(credit, input.checked);
    row.setAttribute("aria-checked", input.checked ? "true" : "false");
  });

  // Click anywhere on the row toggles (unless selecting text / using controls)
  row.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest(".info-btn")) return;
    if (t.closest("input")) return;
    if (t.closest(".extra-field")) return;
    if (hasTextSelection()) return;
    const next = !selectedIds.has(credit.id);
    setCreditSelected(credit, next);
    row.setAttribute("aria-checked", next ? "true" : "false");
  });

  row.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const next = !selectedIds.has(credit.id);
      setCreditSelected(credit, next);
      row.setAttribute("aria-checked", next ? "true" : "false");
    }
  });

  const infoBtn = row.querySelector(".info-btn");
  if (infoBtn && help) {
    infoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openInfoPanel(credit.id, infoBtn);
    });
  }

  return row;
}

function buildOtherRpnBlock() {
  const wrap = document.createElement("div");
  wrap.className = "other-rpn-block";
  wrap.innerHTML = `
    <div class="credit-section-title">Other credits on RPN</div>
    <div class="other-rpn-row">
      <label for="otherRpnCredits">
        Other annual tax credits from RPN (€)
        <button type="button" class="info-btn" id="otherRpnInfo" title="When to use">i</button>
      </label>
      <input type="number" id="otherRpnCredits" min="0" step="0.01" value="${otherRpnCredits || 0}">
    </div>
    <p class="other-rpn-hint">
      Use this for any RPN total (or residual) not covered by the checklist — e.g. flat-rate expenses converted to a credit,
      remote working, health expenses already granted, etc. For real payroll, the <strong>employee’s RPN total is authoritative</strong>.
    </p>
  `;
  const input = wrap.querySelector("#otherRpnCredits");
  input.addEventListener("input", () => {
    otherRpnCredits = Math.max(0, parseFloat(input.value) || 0);
    updateFormula();
  });
  wrap.querySelector("#otherRpnInfo").addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openGenericInfo(
      e.currentTarget,
      "Other annual tax credits from RPN",
      "Enter annual tax credits that appear on the employee’s Revenue Payroll Notification (or Tax Credit Certificate) but are not listed above.",
      "Variable reliefs (health expenses, tuition fees, flat-rate expenses, remote working, nursing home, employing a carer, pension contributions, Seafarers’ Allowance, etc.) are not fixed checklist items. For practice PAYE, use the checklist + this field; for live payroll always use the RPN total."
    );
  });
  return wrap;
}

function ensureInfoPanel() {
  let panel = document.getElementById("creditInfoPanel");
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = "creditInfoPanel";
  panel.className = "credit-info-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.innerHTML = `
    <div class="credit-info-header">
      <h3 id="creditInfoTitle"></h3>
      <button type="button" class="credit-info-close" id="creditInfoClose" aria-label="Close">×</button>
    </div>
    <div class="credit-info-body">
      <p class="credit-info-label">When to apply</p>
      <p id="creditInfoWhen"></p>
      <p class="credit-info-label" id="creditInfoNotesLabel">Notes</p>
      <p id="creditInfoNotes"></p>
      <p class="credit-info-sources" id="creditInfoSources"></p>
      <p class="credit-info-disclaimer">Summary only — confirm on Revenue or Citizens Information. For payroll, RPN is authoritative.</p>
    </div>
  `;
  document.body.appendChild(panel);

  document.getElementById("creditInfoClose").addEventListener("click", closeInfoPanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeInfoPanel();
  });
  document.addEventListener("click", (e) => {
    if (panel.hidden) return;
    const t = e.target;
    if (panel.contains(t) || (t instanceof Element && t.closest(".info-btn"))) return;
    closeInfoPanel();
  });
  return panel;
}

function closeInfoPanel() {
  const panel = document.getElementById("creditInfoPanel");
  if (panel) {
    panel.hidden = true;
    panel.classList.remove("is-open");
  }
  openInfoId = null;
  document.querySelectorAll(".info-btn.is-active").forEach((b) => b.classList.remove("is-active"));
}

function openGenericInfo(anchor, title, when, notes) {
  const panel = ensureInfoPanel();
  document.querySelectorAll(".info-btn.is-active").forEach((b) => b.classList.remove("is-active"));
  if (anchor) anchor.classList.add("is-active");
  document.getElementById("creditInfoTitle").textContent = title;
  document.getElementById("creditInfoWhen").textContent = when;
  const notesEl = document.getElementById("creditInfoNotes");
  const notesLabel = document.getElementById("creditInfoNotesLabel");
  notesEl.textContent = notes || "";
  notesEl.hidden = !notes;
  notesLabel.hidden = !notes;
  document.getElementById("creditInfoSources").innerHTML = "";
  panel.hidden = false;
  panel.classList.add("is-open");
  openInfoId = "__generic__";
  positionInfoPanel(panel, anchor);
}

function openInfoPanel(creditId, anchorBtn) {
  const help = CREDIT_HELP[creditId];
  if (!help) return;
  const panel = ensureInfoPanel();

  if (openInfoId === creditId && !panel.hidden) {
    closeInfoPanel();
    return;
  }

  document.querySelectorAll(".info-btn.is-active").forEach((b) => b.classList.remove("is-active"));
  if (anchorBtn) anchorBtn.classList.add("is-active");

  document.getElementById("creditInfoTitle").textContent = help.title;
  document.getElementById("creditInfoWhen").textContent = help.when;

  const notesEl = document.getElementById("creditInfoNotes");
  const notesLabel = document.getElementById("creditInfoNotesLabel");
  if (help.notes) {
    notesEl.textContent = help.notes;
    notesEl.hidden = false;
    notesLabel.hidden = false;
  } else {
    notesEl.textContent = "";
    notesEl.hidden = true;
    notesLabel.hidden = true;
  }

  const sources = document.getElementById("creditInfoSources");
  const links = [];
  if (help.revenue) {
    links.push(
      `<a href="${escapeAttr(help.revenue)}" target="_blank" rel="noopener noreferrer">Revenue.ie</a>`
    );
  }
  if (help.citizens) {
    links.push(
      `<a href="${escapeAttr(help.citizens)}" target="_blank" rel="noopener noreferrer">Citizens Information</a>`
    );
  }
  sources.innerHTML = links.length ? `Sources: ${links.join(" · ")}` : "";

  panel.hidden = false;
  panel.classList.add("is-open");
  openInfoId = creditId;
  positionInfoPanel(panel, anchorBtn);
}

function positionInfoPanel(panel, anchorBtn) {
  if (!anchorBtn) {
    panel.style.top = "80px";
    panel.style.left = "50%";
    panel.style.transform = "translateX(-50%)";
    return;
  }
  panel.style.transform = "none";
  const rect = anchorBtn.getBoundingClientRect();
  const panelWidth = Math.min(380, window.innerWidth - 24);
  panel.style.width = panelWidth + "px";
  const ph = panel.offsetHeight || 280;
  let top = rect.bottom + 8 + window.scrollY;
  let left = rect.left + window.scrollX - panelWidth + rect.width;
  if (left < 12 + window.scrollX) left = 12 + window.scrollX;
  if (left + panelWidth > window.scrollX + window.innerWidth - 12) {
    left = window.scrollX + window.innerWidth - panelWidth - 12;
  }
  if (rect.bottom + ph + 16 > window.innerHeight && rect.top > ph + 16) {
    top = rect.top + window.scrollY - ph - 8;
  }
  panel.style.top = `${Math.max(8, top)}px`;
  panel.style.left = `${left}px`;
}

function syncRowCheckedState() {
  document.querySelectorAll(".credit-row input[data-credit-id]").forEach((input) => {
    const id = input.getAttribute("data-credit-id");
    const row = input.closest(".credit-row");
    const on = selectedIds.has(id);
    input.checked = on;
    if (row) {
      row.classList.toggle("is-checked", on);
      const extras = row.querySelector(".credit-extras");
      const credit = getCreditById(id);
      if (extras && credit) {
        const show = on && ((credit.mode && credit.mode !== "fixed") || credit.allowance);
        extras.hidden = !show;
      }
    }
  });
}

function getSelectedCredits() {
  const cfg = getYearConfig(selectedYear);
  if (!cfg) return [];
  return cfg.credits.filter((c) => selectedIds.has(c.id));
}

function setSummary(count, creditTotal, taxValue) {
  const countEl = document.getElementById("metaCount");
  const creditsEl = document.getElementById("metaCredits");
  const totalEl = document.getElementById("metaTotal");
  const totalValueEl = document.getElementById("formulaTotalValue");
  const useInTakeHome = document.getElementById("useInTakeHome");
  if (countEl) countEl.textContent = String(count);
  if (creditsEl) creditsEl.textContent = formatEuro(creditTotal);
  if (totalEl) totalEl.textContent = formatEuro(taxValue);
  if (totalValueEl) totalValueEl.textContent = formatEuro(taxValue);
  if (useInTakeHome) {
    const credits = Number.isFinite(taxValue) ? Math.round(taxValue * 100) / 100 : 0;
    useInTakeHome.href = "/?status=manual&credits=" + encodeURIComponent(String(credits));
  }
}

function setWarnings(warnings) {
  const box = document.getElementById("formulaWarnings");
  if (!box) return;
  if (!warnings.length) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.innerHTML =
    "<ul>" + warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("") + "</ul>";
}

function resetFormulaPanel() {
  const container = document.getElementById("formulaExpression");
  const empty = document.getElementById("formulaEmpty");
  const eqRow = document.getElementById("formulaEqRow");

  if (container) {
    container.innerHTML = "";
    container.classList.add("is-empty");
  }
  if (empty) empty.hidden = false;
  if (eqRow) {
    eqRow.classList.add("is-empty");
    eqRow.setAttribute("aria-hidden", "true");
  }
  setSummary(0, 0, 0);
  setWarnings([]);
}

function updateFormula() {
  const container = document.getElementById("formulaExpression");
  const empty = document.getElementById("formulaEmpty");
  const eqRow = document.getElementById("formulaEqRow");
  const { lines, warnings, total, otherRpnCredits: other } = buildEffectiveSelection();

  if (!container) return;

  if (lines.length === 0 && other <= 0) {
    resetFormulaPanel();
    // still show warnings if any odd state
    setWarnings(warnings);
    return;
  }

  if (empty) empty.hidden = true;
  container.classList.remove("is-empty");
  if (eqRow) {
    eqRow.classList.remove("is-empty");
    eqRow.setAttribute("aria-hidden", "false");
  }

  const parts = [];
  lines.forEach((line, index) => {
    if (index > 0) parts.push('<div class="formula-op" aria-hidden="true">+</div>');
    const name = escapeHtml(line.credit.shortLabel || line.credit.label);
    const note = line.note ? ` (${line.note})` : "";
    const title = line.credit.allowance
      ? `${line.credit.label} — allowance ${formatEuro(line.credit.allowance)} @ 20%`
      : line.credit.label;
    parts.push(
      `<div class="formula-term" title="${escapeAttr(title)}">` +
        `<span class="term-name">${name}${note ? `<em>${escapeHtml(note)}</em>` : ""}</span>` +
        `<span class="term-value">${formatEuro(line.value)}</span>` +
        `</div>`
    );
  });

  if (other > 0) {
    if (lines.length) parts.push('<div class="formula-op" aria-hidden="true">+</div>');
    parts.push(
      `<div class="formula-term" title="Other annual tax credits from RPN">` +
        `<span class="term-name">Other RPN</span>` +
        `<span class="term-value">${formatEuro(other)}</span>` +
        `</div>`
    );
  }

  container.innerHTML = parts.join("");

  const itemCount = lines.length + (other > 0 ? 1 : 0);
  setSummary(itemCount, total, total);
  setWarnings(warnings);
}

function selectYear(year) {
  if (!getYearConfig(year)) return;
  selectedYear = year;
  const valid = new Set(getYearConfig(year).credits.map((c) => c.id));
  [...selectedIds].forEach((id) => {
    if (!valid.has(id)) selectedIds.delete(id);
  });
  renderYearSidebar();
  renderCreditList();
  updateFormula();
}

function clearAll(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  selectedIds.clear();
  amountOverrides.clear();
  qtyOverrides.clear();
  otherRpnCredits = 0;

  document.querySelectorAll(".credit-row input[data-credit-id]").forEach((input) => {
    input.checked = false;
    const row = input.closest(".credit-row");
    if (row) {
      row.classList.remove("is-checked");
      const extras = row.querySelector(".credit-extras");
      if (extras) extras.hidden = true;
    }
  });

  const otherInput = document.getElementById("otherRpnCredits");
  if (otherInput) otherInput.value = "0";

  resetFormulaPanel();
}

function selectCommonSingle() {
  selectedIds.clear();
  amountOverrides.clear();
  qtyOverrides.clear();
  selectedIds.add("personal_single");
  selectedIds.add("employee_paye");
  amountOverrides.set("employee_paye", 2000);
  otherRpnCredits = 0;
  const otherInput = document.getElementById("otherRpnCredits");
  if (otherInput) otherInput.value = "0";
  renderCreditList();
  updateFormula();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

function init() {
  renderYearSidebar();
  renderCreditList();
  resetFormulaPanel();

  const clearTop = document.getElementById("clearSelectionTop");
  const clearSide = document.getElementById("clearSelection");
  if (clearTop) clearTop.addEventListener("click", clearAll);
  if (clearSide) clearSide.addEventListener("click", clearAll);

  const commonBtn = document.getElementById("selectCommonSingle");
  if (commonBtn) commonBtn.addEventListener("click", selectCommonSingle);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
