/**
 * Tax Credit Calculator — Ireland
 * Rates sourced from Revenue tax credits charts (2026).
 * Structure mirrors IPAS personal tax credits table layout.
 */

/** @typedef {{ id: string, label: string, amount: number, group?: string, indent?: 0|1|2, badge?: string, taxValue?: number, shortLabel?: string }} CreditItem */

/**
 * Annual tax credit rates by year.
 * Only 2026 is fully populated for now (user request).
 * amounts are € annual tax credits unless taxValue is set (for reliefs).
 */
const TAX_CREDIT_RATES = {
  2026: {
    label: "2026",
    note: "Current rates",
    /**
     * Personal tax credits list — order matches the IPAS / textbook table style.
     * @type {CreditItem[]}
     */
    credits: [
      {
        id: "personal_single",
        label: "Single / Widowed Person or Surviving Civil Partner Tax Credit",
        shortLabel: "Personal (single)",
        amount: 2000,
        group: "personal_base",
      },
      {
        id: "personal_married",
        label: "Married Person or Civil Partner Tax Credit",
        shortLabel: "Personal (married)",
        amount: 4000,
        group: "personal_base",
      },
      {
        id: "widowed_bereavement_year",
        label: "Widowed Person or Surviving Civil Partner in year of bereavement",
        shortLabel: "Widowed (bereavement year)",
        amount: 4000,
        group: "personal_base",
      },
      {
        id: "widowed_add_no_child",
        label: "Widowed Person or Surviving Civil Partner — Additional relief: No qualifying child — subsequent years after year of bereavement",
        shortLabel: "Widowed add. (no child)",
        amount: 540,
        indent: 1,
        group: "widowed_additional",
      },
      {
        id: "widowed_y1",
        label: "With qualifying child — First year after year of bereavement",
        shortLabel: "Widowed Y1 (with child)",
        amount: 3600,
        indent: 2,
        group: "widowed_additional",
      },
      {
        id: "widowed_y2",
        label: "With qualifying child — Second year after year of bereavement",
        shortLabel: "Widowed Y2 (with child)",
        amount: 3150,
        indent: 2,
        group: "widowed_additional",
      },
      {
        id: "widowed_y3",
        label: "With qualifying child — Third year after year of bereavement",
        shortLabel: "Widowed Y3 (with child)",
        amount: 2700,
        indent: 2,
        group: "widowed_additional",
      },
      {
        id: "widowed_y4",
        label: "With qualifying child — Fourth year after year of bereavement",
        shortLabel: "Widowed Y4 (with child)",
        amount: 2250,
        indent: 2,
        group: "widowed_additional",
      },
      {
        id: "widowed_y5",
        label: "With qualifying child — Fifth year after year of bereavement",
        shortLabel: "Widowed Y5 (with child)",
        amount: 1800,
        indent: 2,
        group: "widowed_additional",
      },
      {
        id: "spccc",
        label: "Single Person Child Carer Tax Credit",
        shortLabel: "SPCCC",
        amount: 1900,
      },
      {
        id: "employee_paye",
        label: "Employee (PAYE) Tax Credit",
        shortLabel: "Employee / PAYE",
        amount: 2000,
      },
      {
        id: "home_carer",
        label: "Home Carer Tax Credit",
        shortLabel: "Home Carer",
        amount: 1950,
      },
      {
        id: "age_single",
        label: "Age Tax Credit — Single / Widowed Person or Surviving Civil Partner",
        shortLabel: "Age (single)",
        amount: 245,
        group: "age",
      },
      {
        id: "age_married",
        label: "Age Tax Credit — Married Couple or Civil Partnership",
        shortLabel: "Age (married)",
        amount: 490,
        group: "age",
      },
      {
        id: "blind_single",
        label: "Blind Person Tax Credit — Single person, or one Spouse or Civil Partner blind",
        shortLabel: "Blind (single / one)",
        amount: 1950,
        group: "blind",
      },
      {
        id: "blind_both",
        label: "Blind Person Tax Credit — Married or Civil Partnership — both Spouses or Civil Partners blind",
        shortLabel: "Blind (both)",
        amount: 3900,
        group: "blind",
      },
      {
        id: "incapacitated_child",
        label: "Incapacitated Child Tax Credit",
        shortLabel: "Incapacitated Child",
        amount: 3800,
      },
      {
        id: "dependent_relative",
        label: "Dependent Relative Tax Credit",
        shortLabel: "Dependent Relative",
        amount: 305,
      },
      {
        id: "earned_income",
        label: "Earned Income Tax Credit",
        shortLabel: "Earned Income",
        amount: 2000,
      },
      {
        id: "fisher",
        label: "Fisher Tax Credit",
        shortLabel: "Fisher",
        amount: 1270,
      },
      {
        id: "guide_dog",
        label: "Registered Guide Dog owner — tax relief available at standard rate on",
        shortLabel: "Guide Dog relief",
        amount: 825,
        badge: "relief @ 20%",
        /** Tax benefit at standard rate (allowance × 20%) */
        taxValue: 165,
      },
    ],
  },
};

/**
 * When-to-apply help for each credit.
 * Summarised from Revenue.ie and Citizens Information (2025–2026 guidance).
 * @type {Record<string, { title: string, when: string, notes?: string, revenue?: string, citizens?: string }>}
 */
const CREDIT_HELP = {
  personal_single: {
    title: "Personal tax credit (single / widowed / surviving civil partner)",
    when:
      "Apply if you are taxed as a single person, or as a widowed person / surviving civil partner with a dependent child after the year of bereavement (personal base of €2,000). Everyone is entitled to a personal tax credit; the amount depends on marital / civil status.",
    notes:
      "Do not also tick the married personal credit. Widowed people without dependent children normally use personal €2,000 plus the €540 additional amount (total €2,540) after the year of bereavement.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/marital-and-civil-status/personal-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/introduction-to-income-tax-credits-and-reliefs/",
  },
  personal_married: {
    title: "Personal tax credit (married / civil partnership)",
    when:
      "Apply if you are married or in a civil partnership and assessed as a couple for the year (joint / separate assessment). The married personal credit is €4,000 for 2026 (twice the single personal credit).",
    notes:
      "Usually one personal credit for the couple under joint assessment — not both single and married personal lines.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/marital-and-civil-status/personal-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax/taxation-of-married-people/",
  },
  widowed_bereavement_year: {
    title: "Widowed / surviving civil partner — year of bereavement",
    when:
      "Apply for the tax year in which your spouse or civil partner dies. In that year you generally get the married-level personal credit (€4,000), not the later widowed rates.",
    notes:
      "After the year of bereavement, switch to the personal single/widowed base plus either the €540 (no dependent children) or the 5-year widowed parent amounts (with qualifying children). SPCCC is not available in the year of bereavement.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/marital-and-civil-status/widowed-person-or-surviving-civil-partner/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_add_no_child: {
    title: "Widowed additional amount — no qualifying child",
    when:
      "Apply in years after the year of bereavement if you are widowed / a surviving civil partner and do not have a qualifying dependent child. This €540 tops up the personal credit so the total is €2,540 (2026).",
    notes:
      "Tick together with the single/widowed personal credit (€2,000), not instead of it. Do not use this if you claim the 5-year widowed parent credits for dependent children.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-relief-charts/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_y1: {
    title: "Widowed Parent Tax Credit — 1st year after bereavement",
    when:
      "Apply for the first tax year after the year of death if you have a qualifying child living with you for some part of the year, have not remarried by the start of the year, and are not cohabiting.",
    notes:
      "Usually combined with personal credit (€2,000) and, if eligible, SPCCC (€1,900). Only one of the five year-bands applies in a given year.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/widowed-parent-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_y2: {
    title: "Widowed Parent Tax Credit — 2nd year after bereavement",
    when:
      "Apply for the second tax year after the year of death if you still meet widowed parent conditions (qualifying child, not remarried at year start, not cohabiting).",
    notes: "Amount for this year: €3,150 (2026). Choose only the year-band that matches how many years after bereavement you are in.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/widowed-parent-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_y3: {
    title: "Widowed Parent Tax Credit — 3rd year after bereavement",
    when:
      "Apply for the third tax year after the year of death if you still meet widowed parent conditions.",
    notes: "Amount for this year: €2,700 (2026).",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/widowed-parent-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_y4: {
    title: "Widowed Parent Tax Credit — 4th year after bereavement",
    when:
      "Apply for the fourth tax year after the year of death if you still meet widowed parent conditions.",
    notes: "Amount for this year: €2,250 (2026).",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/widowed-parent-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  widowed_y5: {
    title: "Widowed Parent Tax Credit — 5th year after bereavement",
    when:
      "Apply for the fifth (final) tax year after the year of death if you still meet widowed parent conditions. There is no sixth-year parent credit.",
    notes: "Amount for this year: €1,800 (2026).",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/widowed-parent-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/income-tax-credits-and-reliefs-following-a-death/",
  },
  spccc: {
    title: "Single Person Child Carer Credit (SPCCC)",
    when:
      "Apply if you care for a qualifying child on your own. The primary claimant is the person the child lives with for more than 6 months of the year. You must not be jointly assessed as married/civil partners, must not be married or in a civil partnership (unless separated), and must not be cohabiting.",
    notes:
      "Not available in the year of bereavement. Also increases the standard-rate tax band (by €4,000). Only one SPCCC per primary claimant regardless of how many children. A secondary claimant may get it if the primary surrenders and the child lives with them for 100+ days.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/single-person-child-carer-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/single-person-child-carer-tax-credit/",
  },
  employee_paye: {
    title: "Employee (PAYE) Tax Credit",
    when:
      "Apply if you receive income taxed under PAYE — salary, BIK, occupational pension, or many taxable Department of Social Protection payments. Also for certain EU social security pensions or foreign wages taxed under a PAYE-type system if you are Irish-resident.",
    notes:
      "Full €2,000 if PAYE income is €10,000+; if lower, credit is capped at 20% of that PAYE income. Cannot be transferred to a spouse/civil partner. Not for proprietary directors on that directorship income (they use Earned Income Credit instead). Combined Employee + Earned Income credits cannot exceed €2,000 for the same person.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/income-and-employment/employee-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/employment-tax-credits-and-reliefs/",
  },
  home_carer: {
    title: "Home Carer Tax Credit",
    when:
      "Apply if you are married or in a civil partnership, jointly assessed, and one partner cares for a dependent person in the home. The dependent must be a child for whom Child Benefit is paid, a person aged 65+, or someone permanently incapacitated — not your spouse/civil partner.",
    notes:
      "Full credit if the carer’s income is under €7,200 (Carer’s Allowance/Benefit ignored). Tapers above that; no credit if carer income is €11,100+ (2026). Only one credit regardless of how many dependants. You cannot claim Home Carer and the increased dual-income standard-rate band at the same time.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/home-carer-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/home-carers-tax-credit/",
  },
  age_single: {
    title: "Age Tax Credit — single / widowed / surviving civil partner",
    when:
      "Apply if you (or, where relevant for status, you as a single/widowed person) are aged 65 or over during the tax year.",
    notes:
      "€245 for single/widowed/surviving civil partner status. There are also age exemption limits that can wipe out tax liability for lower incomes over 65 — separate from this credit.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/age-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/older-peoples-tax-credits-and-reliefs/",
  },
  age_married: {
    title: "Age Tax Credit — married / civil partnership",
    when:
      "Apply if you are married or in a civil partnership and either spouse/civil partner is aged 65 or over (credit is €490 — double the single age credit).",
    notes: "Choose either single or married age credit, not both.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/age-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/older-peoples-tax-credits-and-reliefs/",
  },
  blind_single: {
    title: "Blind Person Tax Credit — single or one partner blind",
    when:
      "Apply if you are blind (or meet Revenue’s visual impairment criteria), or if you are married/civil partners and one of you is blind. Amount is €1,950 (2026).",
    notes:
      "Medical confirmation is usually required. Can be claimed with Guide Dog allowance if you have a registered guide dog.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/blind-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/tax-credits-and-reliefs-for-people-with-disabilities/tax-reliefs-for-people-with-a-visual-impairment/",
  },
  blind_both: {
    title: "Blind Person Tax Credit — both partners blind",
    when:
      "Apply if you are married or in a civil partnership and both spouses/civil partners are blind. Amount is €3,900 (2026).",
    notes: "Do not also tick the single/one-partner blind credit.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/blind-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/tax-credits-and-reliefs-for-people-with-disabilities/tax-reliefs-for-people-with-a-visual-impairment/",
  },
  incapacitated_child: {
    title: "Incapacitated Child Tax Credit",
    when:
      "Apply if you are a parent or guardian of a child who is permanently incapacitated (cannot maintain themselves) and you maintain them (pay day-to-day living costs). Also available if you have custody and maintain a child who is not your own.",
    notes:
      "You cannot claim both Incapacitated Child and Dependent Relative credit for the same child. Claim via myAccount with medical evidence where required.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/children/incapacitated-child-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/tax-credits-and-reliefs-for-people-with-disabilities/incapacitated-child-tax-credit/",
  },
  dependent_relative: {
    title: "Dependent Relative Tax Credit",
    when:
      "Apply if you maintain a relative (or a relative of your spouse/civil partner) who has low income. The relative’s income must not exceed the income limit (€18,028 for 2026). Commonly claimed for elderly or incapacitated relatives living with you or supported by you.",
    notes:
      "Cannot be claimed for the same person as Incapacitated Child credit. Credit is €305 (2026).",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/dependant-relative-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/tax-credits-and-reliefs-for-people-with-disabilities/dependent-relative-tax-credit/",
  },
  earned_income: {
    title: "Earned Income Tax Credit",
    when:
      "Apply if you have qualifying earned income that is not covered by the Employee (PAYE) credit — mainly self-employed trading/professional income (Case I/II) and pay of proprietary directors. It is the self-employed counterpart of the Employee Tax Credit.",
    notes:
      "Maximum €2,000 or 20% of qualifying earned income, whichever is lower. Not for passive income (rent, deposit interest). If you also have PAYE income, Employee + Earned Income together cannot exceed €2,000. Ordinary PAYE employees who already get the full Employee credit do not also get Earned Income on that same employment.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/income-and-employment/earned-income-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/employment-tax-credits-and-reliefs/",
  },
  fisher: {
    title: "Fisher Tax Credit",
    when:
      "Apply if you work as a full-time or part-time fisher at sea and spend at least 80 days in the year actively fishing on an EU or UK-registered fishing vessel.",
    notes:
      "Worth up to €1,270 (often described as €20 per qualifying sea day, capped). You cannot claim both Fisher Tax Credit and Seafarer’s Allowance in the same year.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/income-and-employment/seafarers-allowance-fisher-tax-credit/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/income-tax-credits-and-reliefs/employment-tax-credits-and-reliefs/",
  },
  guide_dog: {
    title: "Guide Dog allowance (standard-rate relief)",
    when:
      "Apply if you are blind or visually impaired and maintain a registered guide dog. This is an allowance (tax relief at the standard 20% rate) on €825, not a full tax credit of €825.",
    notes:
      "Tax saving shown here is €825 × 20% = €165. Often claimed alongside the Blind Person Tax Credit. Register/claim through Revenue myAccount with guide dog registration details.",
    revenue:
      "https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/guide-dog-allowance/index.aspx",
    citizens:
      "https://www.citizensinformation.ie/en/money-and-tax/tax/tax-credits-and-reliefs-for-people-with-disabilities/tax-reliefs-for-people-with-a-visual-impairment/",
  },
};

const AVAILABLE_YEARS = [2024, 2025, 2026];
const DEFAULT_YEAR = 2026;

/** @type {number} */
let selectedYear = DEFAULT_YEAR;

/** @type {Set<string>} */
const selectedIds = new Set();

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

function creditTaxValue(credit) {
  if (typeof credit.taxValue === "number") return credit.taxValue;
  return credit.amount;
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
    if (year === selectedYear && hasRates) {
      btn.classList.add("active");
    }

    btn.innerHTML =
      `<span class="year-label">${year}</span>` +
      (year === DEFAULT_YEAR && hasRates
        ? `<span class="year-note">Current Rates</span>`
        : !hasRates
          ? `<span class="year-note">Coming soon</span>`
          : "");

    if (hasRates) {
      btn.addEventListener("click", () => selectYear(year));
    }
    list.appendChild(btn);
  });
}

/**
 * Exclusive groups: selecting one option unchecks others in the same group.
 * personal_base, age, blind, widowed_additional are mutually exclusive sets.
 */
function applyExclusiveGroup(creditId, group) {
  if (!group) return;
  const cfg = getYearConfig(selectedYear);
  if (!cfg) return;
  cfg.credits.forEach((c) => {
    if (c.group === group && c.id !== creditId) {
      selectedIds.delete(c.id);
      const input = document.querySelector(`input[data-credit-id="${c.id}"]`);
      if (input) input.checked = false;
      const row = input && input.closest(".credit-row");
      if (row) row.classList.remove("is-checked");
    }
  });
}

function renderCreditList() {
  const body = document.getElementById("creditListBody");
  const yearBadge = document.getElementById("taxYearBadge");
  const cfg = getYearConfig(selectedYear);

  if (yearBadge) {
    yearBadge.textContent = cfg ? `Tax year ${selectedYear}` : "—";
  }

  if (!body) return;
  body.innerHTML = "";

  if (!cfg) {
    body.innerHTML =
      '<p class="formula-empty" style="padding: 20px 22px;">Rates for this year are not available yet.</p>';
    return;
  }

  // Section: Personal Tax Credits
  const personalTitle = document.createElement("div");
  personalTitle.className = "credit-section-title";
  personalTitle.textContent = "Personal Tax Credits";
  body.appendChild(personalTitle);

  let reliefStarted = false;

  cfg.credits.forEach((credit) => {
    if (credit.id === "guide_dog" && !reliefStarted) {
      reliefStarted = true;
      const reliefTitle = document.createElement("div");
      reliefTitle.className = "credit-section-title";
      reliefTitle.textContent = "Additional Tax Relief";
      body.appendChild(reliefTitle);
    }

    const row = document.createElement("div");
    row.className = "credit-row";
    if (credit.indent === 1) row.classList.add("is-indent");
    if (credit.indent === 2) row.classList.add("is-indent-2");
    if (selectedIds.has(credit.id)) row.classList.add("is-checked");

    const checked = selectedIds.has(credit.id) ? " checked" : "";
    const badge = credit.badge
      ? `<span class="credit-badge">${credit.badge}</span>`
      : "";
    const help = CREDIT_HELP[credit.id];

    row.innerHTML = `
      <label class="credit-check">
        <input type="checkbox" data-credit-id="${credit.id}" aria-label="${escapeAttr(credit.label)}"${checked}>
      </label>
      <span class="credit-label">${escapeHtml(credit.label)}${badge}</span>
      <button type="button" class="info-btn" data-info-id="${credit.id}" aria-label="When to apply: ${escapeAttr(credit.shortLabel || credit.label)}" title="When to apply">i</button>
      <span class="credit-amount">${formatEuro(credit.amount)}</span>
    `;

    if (!help) {
      const btn = row.querySelector(".info-btn");
      if (btn) btn.hidden = true;
    }

    const input = row.querySelector("input");
    input.addEventListener("change", () => {
      if (input.checked) {
        selectedIds.add(credit.id);
        applyExclusiveGroup(credit.id, credit.group);
        row.classList.add("is-checked");
      } else {
        selectedIds.delete(credit.id);
        row.classList.remove("is-checked");
      }
      syncRowCheckedState();
      updateFormula();
    });

    const infoBtn = row.querySelector(".info-btn");
    if (infoBtn && help) {
      infoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openInfoPanel(credit.id, infoBtn);
      });
    }

    body.appendChild(row);
  });
}

/** @type {string|null} */
let openInfoId = null;

function ensureInfoPanel() {
  let panel = document.getElementById("creditInfoPanel");
  if (panel) return panel;

  panel = document.createElement("div");
  panel.id = "creditInfoPanel";
  panel.className = "credit-info-panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.innerHTML = `
    <div class="credit-info-header">
      <h3 id="creditInfoTitle"></h3>
      <button type="button" class="credit-info-close" id="creditInfoClose" aria-label="Close information">×</button>
    </div>
    <div class="credit-info-body">
      <p class="credit-info-label">When to apply</p>
      <p id="creditInfoWhen"></p>
      <p class="credit-info-label" id="creditInfoNotesLabel">Notes</p>
      <p id="creditInfoNotes"></p>
      <p class="credit-info-sources" id="creditInfoSources"></p>
      <p class="credit-info-disclaimer">Summary only — confirm entitlement on Revenue or Citizens Information.</p>
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

function openInfoPanel(creditId, anchorBtn) {
  const help = CREDIT_HELP[creditId];
  if (!help) return;

  const panel = ensureInfoPanel();

  // Toggle closed if same button clicked again
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
  sources.innerHTML = links.length
    ? `Sources: ${links.join(" · ")}`
    : "";

  panel.hidden = false;
  panel.classList.add("is-open");
  openInfoId = creditId;

  // Position near the button
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
  const panelWidth = Math.min(360, window.innerWidth - 24);
  panel.style.width = panelWidth + "px";

  // Measure after width set
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
    if (row) row.classList.toggle("is-checked", on);
  });
}

function getSelectedCredits() {
  const cfg = getYearConfig(selectedYear);
  if (!cfg) return [];
  return cfg.credits.filter((c) => selectedIds.has(c.id));
}

/** Always write summary figures (never leave previous totals on screen). */
function setSummary(count, creditTotal, taxValue) {
  const countEl = document.getElementById("metaCount");
  const creditsEl = document.getElementById("metaCredits");
  const totalEl = document.getElementById("metaTotal");
  const totalValueEl = document.getElementById("formulaTotalValue");
  if (countEl) countEl.textContent = String(count);
  if (creditsEl) creditsEl.textContent = formatEuro(creditTotal);
  if (totalEl) totalEl.textContent = formatEuro(taxValue);
  if (totalValueEl) totalValueEl.textContent = formatEuro(taxValue);
}

/** Full UI wipe used by Clear all and empty selection. */
function resetFormulaPanel() {
  const container = document.getElementById("formulaExpression");
  const empty = document.getElementById("formulaEmpty");
  const eqRow = document.getElementById("formulaEqRow");

  if (container) {
    container.innerHTML = "";
    container.classList.add("is-empty");
  }
  if (empty) {
    empty.hidden = false;
    empty.classList.remove("is-hidden");
  }
  if (eqRow) {
    eqRow.classList.add("is-empty");
    eqRow.setAttribute("aria-hidden", "true");
  }
  setSummary(0, 0, 0);
}

function updateFormula() {
  const container = document.getElementById("formulaExpression");
  const empty = document.getElementById("formulaEmpty");
  const eqRow = document.getElementById("formulaEqRow");
  const selected = getSelectedCredits();

  if (!container) return;

  if (selected.length === 0) {
    resetFormulaPanel();
    return;
  }

  if (empty) {
    empty.hidden = true;
  }
  container.classList.remove("is-empty");
  if (eqRow) {
    eqRow.classList.remove("is-empty");
    eqRow.setAttribute("aria-hidden", "false");
  }

  let total = 0;
  let creditTotal = 0;
  let reliefTaxValue = 0;
  const parts = [];

  selected.forEach((credit, index) => {
    const value = creditTaxValue(credit);
    total += value;
    if (credit.taxValue != null) {
      reliefTaxValue += credit.taxValue;
    } else {
      creditTotal += credit.amount;
    }

    if (index > 0) {
      parts.push('<div class="formula-op" aria-hidden="true">+</div>');
    }

    const displayAmount =
      credit.taxValue != null
        ? formatEuro(credit.taxValue)
        : formatEuro(credit.amount);

    const name = escapeHtml(credit.shortLabel || credit.label);
    const title =
      credit.taxValue != null
        ? `${credit.label} (allowance ${formatEuro(credit.amount)} × 20%)`
        : credit.label;

    parts.push(
      `<div class="formula-term" title="${escapeAttr(title)}">` +
        `<span class="term-name">${name}</span>` +
        `<span class="term-value">${displayAmount}</span>` +
        `</div>`
    );
  });

  container.innerHTML = parts.join("");

  const taxValue = creditTotal + reliefTaxValue;
  setSummary(selected.length, creditTotal, taxValue);
}

function selectYear(year) {
  if (!getYearConfig(year)) return;
  selectedYear = year;
  // Keep selections that still exist; drop unknown ids
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

  // Force every checkbox / row off (do not rely only on Set + sync)
  document.querySelectorAll(".credit-row input[data-credit-id]").forEach((input) => {
    input.checked = false;
    const row = input.closest(".credit-row");
    if (row) row.classList.remove("is-checked");
  });

  resetFormulaPanel();
}

function selectCommonSingle() {
  // Common single employee: personal + employee PAYE
  selectedIds.clear();
  selectedIds.add("personal_single");
  selectedIds.add("employee_paye");
  syncRowCheckedState();
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
