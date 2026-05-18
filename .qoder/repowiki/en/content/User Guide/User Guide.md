# User Guide

<cite>
**Referenced Files in This Document**
- [index.html](file://index.html)
- [manifest.json](file://manifest.json)
- [sw.js](file://sw.js)
- [README.md](file://README.md)
</cite>

## Update Summary
**Changes Made**
- Updated **Switching Between Tax Years** section to include 2026 as the current tax year
- Enhanced **Meta Tags and Descriptions** to reflect expanded tax year support (2024, 2025, 2026)
- Updated **FAQ Content** to reflect support for 2026 tax year calculations
- Enhanced **Year-Specific Features** documentation to include 2026 PRSI rate changes (4.2% to 4.35%)
- Updated **Installation Instructions** to reflect PWA capabilities with offline support

## Table of Contents
1. [Introduction](#introduction)
2. [Step-by-Step Usage Guide](#step-by-step-usage-guide)
3. [Understanding Gross vs Net Income](#understanding-gross-vs-net-income)
4. [Explanation of Irish Tax Components](#explanation-of-irish-tax-components)
5. [Switching Between Tax Years](#switching-between-tax-years)
6. [Interpreting the Results Breakdown](#interpreting-the-results-breakdown)
7. [Installing the PWA Application](#installing-the-pwa-application)
8. [Common User Mistakes and Troubleshooting](#common-user-mistakes-and-troubleshooting)
9. [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)

## Introduction
The **Irish Payroll Calculator - Net to Gross** is a Progressive Web Application (PWA) designed to help users calculate salary conversions between gross and net amounts using current Irish tax rules. It supports both **Net to Gross** (finding the gross salary needed to achieve a desired net income) and **Gross to Net** (calculating take-home pay from a gross salary). The calculator accounts for all major Irish deductions: PAYE, USC, and PRSI.

This guide provides comprehensive instructions for using the application, explains key tax concepts in plain language, and details how to install the app for offline access.

**Section sources**
- [index.html](file://index.html#L1-L2028)

## Step-by-Step Usage Guide

### Selecting Calculation Type
At the top of the form, you will find a dropdown labeled **Calculation Type**:
- **Net to Gross**: Use this if you want to determine the gross salary required to achieve a specific net (take-home) amount.
- **Gross to Net**: Use this if you know your gross salary and want to calculate your net income after taxes.

When you change this selection, the input label automatically updates to reflect your choice.

**Section sources**
- [index.html](file://index.html#L975-L979)

### Entering Salary Amount
Enter your desired salary amount in the **Desired Net Annual Salary (€)** or **Gross Annual Salary (€)** field, depending on your selected calculation type.

**Important Notes:**
- Enter only numbers (e.g., `50000`, not `50,000` or `€50,000`)
- The amount must be positive and cannot exceed €1,000,000
- The calculator accepts decimal values (e.g., `45000.50`)

After entering the value, click the **Calculate** button to process the results.

**Section sources**
- [index.html](file://index.html#L982-L994)

### Choosing Family Status
The **Family Status** dropdown allows you to select your personal tax situation:
- **Single Person**: Standard tax credits and thresholds apply
- **Married (Both Working)**: Adjusted tax credits for married couples where both partners work
- **Married (One Spouse Working)**: Special tax credits for married couples where only one spouse is employed
- **Single Parent**: Includes additional single parent tax credit
- **Manual Input**: Allows custom configuration of tax credits and PAYE cut-off point

When you select **Married (One Spouse Working)**, the calculator applies:
- **PAYE Cut-off Point**: €53,000 (2026), €51,000 (2024), €53,000 (2025)
- **Tax Credits**: €4,000 (2026), €3,750 (2024), €4,000 (2025) plus employee credit

When you select **Manual Input**, additional fields appear where you can enter:
- **Annual Tax Credits (€)**: Total tax credits (default: €4,000 for 2026, €4,000 for 2025, €3,750 for 2024)
- **PAYE Cut-off Point (€)**: Income threshold for the 20% tax rate (default: €44,000 for 2026, €44,000 for 2025, €42,000 for 2024)

**Note:** USC and PRSI rates remain fixed according to Irish law and cannot be customized.

**Section sources**
- [index.html](file://index.html#L996-L1003)
- [index.html](file://index.html#L1024-L1060)

### Selecting Time Period
Use the tab buttons at the top of the calculator to switch between different time periods:
- **Annual**
- **Monthly**
- **Fortnightly**
- **Weekly**

The calculator automatically converts your input to annual amounts for processing, then displays results in your selected frequency. All labels and results update to reflect the current period.

**Section sources**
- [index.html](file://index.html#L964-L970)

## Understanding Gross vs Net Income

### Gross Income
**Gross income** is your total salary before any deductions are applied. This is the amount stated in your employment contract.

*Example:* If your annual salary is €60,000, this is your gross income.

### Net Income
**Net income** (also called "take-home pay") is the amount you actually receive after all taxes and deductions have been subtracted from your gross salary.

*Example:* From a €60,000 gross salary, after PAYE, USC, and PRSI deductions, you might receive €42,500 net annually.

The difference between gross and net represents your total tax burden, which typically ranges from 25% to 40% for most Irish workers, depending on income level and personal circumstances.

```
flowchart TD
A[Gross Income] --> B[Subtract PAYE]
B --> C[Subtract USC]
C --> D[Subtract PRSI]
D --> E[Net Income]
```

**Diagram sources**
- [index.html](file://index.html#L1258-L1334)

## Explanation of Irish Tax Components

### PAYE (Pay As You Earn)
**PAYE** is the main income tax collected by employers on behalf of Revenue. It's calculated at two rates:
- **20%** on income up to the standard rate cut-off point
- **40%** on income above the cut-off point

*Example:* For a single person with a €50,000 gross salary:
- First €44,000 taxed at 20% = €8,800
- Remaining €6,000 taxed at 40% = €2,400
- Total PAYE before credits = €11,200
- Less tax credits (€4,000)
- **Net PAYE = €7,200**

**Section sources**
- [index.html](file://index.html#L1343-L1367)

### USC (Universal Social Charge)
**USC** is a tax on gross income used to fund public services. It's calculated on a sliding scale across multiple income bands. For 2026:
- **0.5%** on income €0–€12,012 (exempt for most employees)
- **2%** on income €12,012–€27,382
- **3%** on income €27,382–€70,044
- **8%** on income over €70,044

*Example:* For a €50,000 salary:
- €15,370 @ 2% = €307.40
- €22,618 @ 3% = €678.54
- **Total USC = €985.94**

**Section sources**
- [index.html](file://index.html#L1369-L1386)

### PRSI (Pay Related Social Insurance)
**PRSI** funds social welfare benefits and pensions. The employee contribution rate varies by tax year and calculation period:

**2026 Rates:**
- **January–September 2026**: PRSI rate is 4.2%
- **October–December 2026**: PRSI rate increases to 4.35%

The calculator includes an automatic PRSI date selector that determines the appropriate rate based on the current date. For example, if you're calculating in October 2026, it will automatically select the 4.35% rate.

The PRSI calculation uses tiered bands with tapered credits:
- **A0 Band**: No PRSI if earnings are below threshold
- **AX Band**: Rate with tapered credit (reduced deduction)
- **AL/A1 Bands**: Full rate with no credit

*Example:* For a monthly salary of €4,000 in 2026:
- Above AX band threshold
- **PRSI = €4,000 × 4.2% = €168 per month** (for Jan–Sep 2026)
- **PRSI = €4,000 × 4.35% = €174 per month** (for Oct–Dec 2026)

The calculator handles the complex PRSI credit calculations automatically based on your selected time period and tax year.

**Section sources**
- [index.html](file://index.html#L1428-L1583)

## Switching Between Tax Years

The calculator supports multiple tax years, allowing you to view historical or projected tax calculations.

### Available Years
Currently, the following years are available:
- **2024**: Previous tax rates
- **2025**: Previous tax rates  
- **2026**: Current tax rates (default)

The **2023** option is currently disabled ("Coming Soon").

### How to Switch Years
1. Locate the **Tax Year** sidebar on the left side of the calculator
2. Click on your desired year (e.g., "2024", "2025", "2026")
3. The calculator automatically updates all tax rates and thresholds
4. The header updates to show the selected year
5. Any existing results are cleared

When you switch years, the calculator uses the appropriate tax parameters for that year, including:
- PAYE cut-off points
- Tax credit amounts
- USC rates and bands
- PRSI thresholds and credit bands

### Enhanced 2026 Year Selection Interface
The 2026 tax year features enhanced visual styling:
- **Active Year Highlight**: The 2026 button has a blue background (#1565c0) instead of green
- **Visual Distinction**: Different styling helps users quickly identify the current tax year
- **Automatic Selection**: The 2026 year is pre-selected as the default

### PRSI Date Selector for 2026
The 2026 PRSI date selector provides period-specific rate selection:
- **Automatic Date Detection**: The calculator automatically selects the appropriate rate based on the current date
- **Manual Override**: Users can manually select the calculation period if needed
- **Visual Styling**: The 2026 selector has blue styling to match the year selection

**Available 2026 PRSI Options:**
- **January–September 2026**: PRSI 4.2% rate
- **October–December 2026**: PRSI 4.35% rate

The calculator automatically detects the current date and selects the appropriate period. For example, if you're calculating in October 2026, it will automatically select the 4.35% rate for October–December.

**Section sources**
- [index.html](file://index.html#L880-L894)
- [index.html](file://index.html#L940-L960)
- [index.html](file://index.html#L1957-L2023)
- [index.html](file://index.html#L2044-L2051)

## Interpreting the Results Breakdown

### Salary Summary
After calculation, the **Salary Summary** card displays:
- **Gross Annual**: Your total pre-tax salary
- **Net Annual**: Your take-home pay after all deductions
- **Take-Home %**: Percentage of gross income you keep
- **Breakdown by Period**: Monthly, fortnightly, and weekly equivalents

### Tax Breakdown Table
The detailed breakdown shows each deduction:
- **PAYE**: Income tax after tax credits
- **USC**: Universal Social Charge
- **PRSI**: Social insurance contribution
- **Total Deductions**: Sum of all taxes
- **Tax Credits**: Total annual tax credits applied

Each tax component can be expanded to see detailed calculations by income band.

### Understanding the Calculations
The calculator provides transparent breakdowns:
- **USC Breakdown**: Shows how each income band is taxed
- **PRSI Breakdown**: Details which PRSI band applies and how credits are calculated
- **PAYE Breakdown**: Explains gross tax calculation and credit application

For example, the PAYE breakdown clearly shows:
1. Gross income in each tax band
2. Tax calculated at 20% and 40% rates
3. Application of tax credits
4. Final net PAYE amount

The PRSI breakdown has been enhanced to show:
- **Tapered Credit Formula**: Detailed step-by-step calculation for AX band
- **Credit Bands Summary**: Complete table of PRSI bands for the selected year
- **Year-Specific Notes**: Important information about PRSI changes

**Section sources**
- [index.html](file://index.html#L2197-L2224)

## Installing the PWA Application

### What is a PWA?
A **Progressive Web App (PWA)** combines the best features of websites and native mobile apps. Once installed, it works like a regular app on your device.

### Benefits of Installation
- **Offline Access**: Use the calculator without internet connection
- **Home Screen Icon**: Launch like any other app
- **Fast Loading**: Cached for instant startup
- **No App Store Required**: Direct installation from browser

### Installation Process

#### On Mobile Devices (iOS/Android)
1. Open the calculator in your browser (Safari or Chrome)
2. When prompted, tap **Install** on the banner that appears
3. Alternatively, use the browser's sharing menu:
   - iOS: Tap Share → Add to Home Screen
   - Android: Tap Menu → Install App or Add to Home Screen
4. Confirm installation
5. The app icon will appear on your home screen

#### On Desktop (Windows/Mac)
1. Open the calculator in Chrome or Edge
2. Click the **Install** button when prompted
3. Or click the address bar's install icon (a small "+" or app icon)
4. Confirm installation
5. The app will appear in your applications menu

### PWA Configuration
The installation capability is enabled by:
- **manifest.json**: Defines app name, icons, and behavior
- **sw.js**: Service worker that enables offline functionality
- **PWA Meta Tags**: In index.html, configure display and theme

```
graph TB
A[Web Browser] --> B{PWA Capable?}
B --> |Yes| C[Show Install Prompt]
B --> |No| D[Run in Browser]
C --> E[User Clicks Install]
E --> F[Add to Home Screen]
F --> G[Offline Access Enabled]
G --> H[App-Like Experience]
```

**Diagram sources**
- [manifest.json](file://manifest.json#L1-L43)
- [sw.js](file://sw.js#L1-L170)

**Section sources**
- [manifest.json](file://manifest.json#L1-L43)
- [sw.js](file://sw.js#L1-L170)

## Common User Mistakes and Troubleshooting

### Input Errors
**Problem:** "Please enter a valid positive number" error
**Solution:** 
- Enter only numeric values (no commas, euro symbols, or spaces)
- Use decimal points (.) not commas (,) for cents
- Example: `45000.50` not `45,000.50` or `€45000`

**Problem:** Amount field not accepting input
**Solution:** Ensure you're not entering text characters or special symbols

### Misunderstanding Tax Credits
**Common Mistake:** Thinking manual tax credits affect USC or PRSI
**Clarification:** Only PAYE tax credits and cut-off points can be customized. USC and PRSI rates are fixed by law.

### Calculation Issues
**Problem:** Results seem incorrect
**Solution:**
1. Verify you've selected the correct tax year
2. Check that your family status matches your situation
3. Confirm you're using the right calculation type (Net to Gross vs Gross to Net)
4. Ensure you're interpreting annual vs periodic amounts correctly
5. For 2024 calculations, verify you've selected the correct PRSI period (Jan–Sep vs Oct–Dec)
6. For 2026 calculations, check that the automatic PRSI date selector is using the correct rate

### Installation Problems
**Problem:** No install prompt appears
**Solution:**
- Ensure you're using a PWA-compatible browser (Chrome, Edge, Safari)
- Check that you're accessing via HTTPS (required for service workers)
- Refresh the page to trigger the install prompt
- Look for the install icon in your browser's address bar

### General Troubleshooting
- **Clear results**: Change any input field to reset calculations
- **Update the app**: If a new version is available, you'll be prompted to reload
- **Offline mode**: When offline, a message will appear, but cached data allows continued use

**Section sources**
- [index.html](file://index.html#L2147-L2156)
- [sw.js](file://sw.js#L1-L170)

## Frequently Asked Questions (FAQ)
The application now includes a **Frequently Asked Questions (FAQ)** section at the bottom of the main page, providing quick answers to common user inquiries.

### FAQ Features
The FAQ section provides:
- Answers to common questions about calculating net pay in Ireland
- Information about reverse calculations from net to gross
- Details about supported pay frequencies
- Guidance on using the calculator effectively

### Content Structure
The FAQ section is organized as a collapsible panel with questions and answers:
- **How do I calculate net pay in Ireland?**: Explains entering gross pay to calculate take-home pay
- **Can I reverse from net to gross?**: Confirms the Net→Gross functionality
- **Does it support weekly, fortnightly and monthly?**: Confirms support for all three pay frequencies

### Integration with Main Application
The FAQ section is fully integrated with the main calculator:
- Uses the same styling and design language
- Located at the bottom of the main page for easy access
- Provides immediate answers without navigating away
- Responsive design works on all device sizes

**Section sources**
- [index.html](file://index.html#L659-L681)