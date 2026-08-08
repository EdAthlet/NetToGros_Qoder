# Practice 1 automated test plan

Target: `https://nettogross-eire.com/tools/annualised-paye/`

## What is covered

| Area | Automated assertion |
| --- | --- |
| Initial state | Practice 1 opens with 8 rows, 96 editable cells and zero score |
| Validation | Checking a blank row marks all 12 answer cells wrong |
| Clear | Clear removes answers and previous right/wrong marks |
| Low pay | Taxable pay below COP; Applied TC is capped by gross PAYE; net tax is zero |
| High pay | Pay above period COP is split across 20% and 40% bands |
| Mid-year start | Opening remaining TC is annual TC minus prior periods × rounded flat TC |
| Roll-forward | Next row opening TC equals previous opening TC minus previous Applied TC |
| Frequency/setup | Fortnightly and monthly schedules, start period and row count regenerate correctly |
| Formula builder | Every tested answer is built by selecting operands and pressing Paste, not by writing into internal page state |
| Independent oracle | Expected PAYE values are calculated by the test, not read from the page answer key |

## Run in the repository

Copy this directory to:

`C:\Users\flyin\Desktop\NetToGros_Qoder\tools\annualised-paye-tests`

Then run in PowerShell:

```powershell
cd C:\Users\flyin\Desktop\NetToGros_Qoder\tools\annualised-paye-tests
npm install
npx playwright install chromium
npm test
```

For a local development server, override the target:

```powershell
$env:PAYE_LAB_URL = "http://localhost:8888/tools/annualised-paye/"
npm test
```

The HTML report is written to `playwright-report`. Failure traces, screenshots and videos are written to `test-results`.

## Suggested repository integration

Add `playwright-report/` and `test-results/` to `.gitignore`. Run these tests before each Netlify production deployment. In CI, install Chromium and execute `npm test` from this directory.
