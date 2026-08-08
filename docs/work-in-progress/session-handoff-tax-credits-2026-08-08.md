# Session handoff — Tax Credit Calculator (2026-08-08)

## Status: complete and deployed

- Branch: `main` (in sync with `origin/main`)
- HEAD at handoff time: `6c8ba6a` (later commits may exist after this note)
- Live URL: https://nettogross-eire.com/tax-credits/

## What was built this session

### New page: Tax Credit Calculator
| Path | Role |
|------|------|
| `tax-credits/index.html` | Page shell + layout |
| `tax-credits/tax-credits.css` | Soft slate-lavender theme; compact list; sticky right total |
| `tax-credits/tax-credits.js` | 2026 credit rates, checkboxes, exclusive groups, live formula |

### Behaviour
- Left: tax year buttons (2026 active; 2024/2025 “Coming soon”)
- Centre: compact checklist of personal tax credits (IPAS textbook-style list)
- Right: sticky live total — selected amounts add up with total after `=`
- **Clear all** above the list and on the total panel
- **Common: single employee** preset (personal €2,000 + employee/PAYE €2,000)
- Guide dog line: allowance × 20% tax benefit
- Exclusive groups: personal base, age, blind, widowed additional years

### 2026 rates (Revenue-aligned)
Personal single/widowed €2,000 · married €4,000 · bereavement year €4,000 · widowed add. no child €540 · Y1–Y5 with child €3,600/€3,150/€2,700/€2,250/€1,800 · SPCCC €1,900 · employee/PAYE €2,000 · home carer €1,950 · age €245/€490 · blind €1,950/€3,900 · incapacitated child €3,800 · dependent relative €305 · earned income €2,000 · fisher €1,270 · guide dog allowance €825 (benefit €165)

### Site integration
- Top nav + footer links on main pages (Take Home, batch, payroll, Pensions, PAYE Lab, contact, fake-revenue)
- `sitemap.xml` entry for `/tax-credits/`

## Key commits
1. `e0d196c` — Add Tax Credit Calculator page with 2026 rates and site nav links  
2. `28b8b23` — Sticky total beside compact list + Clear all above  

## Possible next steps (not started)
- Enable 2024 / 2025 rate tables on the year sidebar
- Optional: mutually exclusive employee vs earned income credit
- Optional: “widowed without dependents €2,540” single convenience line (currently personal + €540 additional)

## Local leftovers (if any at handoff)
- Unrelated local work may exist under `tools/annualised-paye-tests/` or practice.js — check `git status` before new work
