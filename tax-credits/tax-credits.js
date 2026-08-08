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

    const row = document.createElement("label");
    row.className = "credit-row";
    if (credit.indent === 1) row.classList.add("is-indent");
    if (credit.indent === 2) row.classList.add("is-indent-2");
    if (selectedIds.has(credit.id)) row.classList.add("is-checked");

    const checked = selectedIds.has(credit.id) ? " checked" : "";
    const badge = credit.badge
      ? `<span class="credit-badge">${credit.badge}</span>`
      : "";

    row.innerHTML = `
      <input type="checkbox" data-credit-id="${credit.id}" aria-label="${escapeAttr(credit.label)}"${checked}>
      <span class="credit-label">${escapeHtml(credit.label)}${badge}</span>
      <span class="credit-amount">${formatEuro(credit.amount)}</span>
    `;

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
      // re-sync checked classes after exclusive group changes
      syncRowCheckedState();
      updateFormula();
    });

    body.appendChild(row);
  });
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
