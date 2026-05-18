# Payroll Management System

<cite>
**Referenced Files in This Document**
- [index.html](file://index.html)
- [payroll/index.html](file://payroll/index.html)
- [js/calculator-core.js](file://js/calculator-core.js)
- [payroll/payroll.js](file://payroll/payroll.js)
- [payroll/employees.js](file://payroll/employees.js)
- [payroll/storage.js](file://payroll/storage.js)
- [README.md](file://README.md)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Core Components](#core-components)
4. [Payroll Application](#payroll-application)
5. [Employee Management](#employee-management)
6. [Tax Calculation Engine](#tax-calculation-engine)
7. [Data Storage System](#data-storage-system)
8. [User Interface Components](#user-interface-components)
9. [Backup and Export Functionality](#backup-and-export-functionality)
10. [Integration Patterns](#integration-patterns)
11. [Performance Considerations](#performance-considerations)
12. [Security Considerations](#security-considerations)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Conclusion](#conclusion)

## Introduction

The Payroll Management System is a comprehensive Irish payroll calculation and management solution designed for small businesses and payroll professionals. This system provides accurate tax calculations for PAYE (Pay Related Income Tax), USC (Universal Social Charge), and PRSI (Pay Related Social Insurance) with support for multiple tax years (2024-2026) and various pay frequencies (weekly, fortnightly, monthly, annual).

The system consists of two primary interfaces: a public-facing salary calculator for individuals and a comprehensive payroll management application for businesses. Both systems share a common tax calculation engine while providing distinct user experiences tailored to their respective audiences.

## System Architecture

The Payroll Management System follows a modular architecture with clear separation of concerns between presentation, business logic, and data persistence layers.

```mermaid
graph TB
subgraph "User Interface Layer"
A[index.html - Main Calculator]
B[payroll/index.html - Payroll App]
C[CSS Stylesheets]
end
subgraph "Business Logic Layer"
D[calculator-core.js - Tax Engine]
E[payroll.js - Payroll Orchestration]
F[employees.js - Employee Management]
end
subgraph "Data Persistence Layer"
G[storage.js - Local Storage Manager]
H[localStorage - Browser Storage]
end
subgraph "External Dependencies"
I[JavaScript Internationalization API]
J[File API]
K[Service Worker]
end
A --> D
B --> E
B --> F
E --> D
E --> G
F --> G
G --> H
A --> C
B --> C
B --> I
B --> J
B --> K
```

**Diagram sources**
- [index.html:1-800](file://index.html#L1-L800)
- [payroll/index.html:1-182](file://payroll/index.html#L1-L182)
- [js/calculator-core.js:1-597](file://js/calculator-core.js#L1-L597)
- [payroll/payroll.js:1-800](file://payroll/payroll.js#L1-L800)
- [payroll/employees.js:1-800](file://payroll/employees.js#L1-L800)
- [payroll/storage.js:1-534](file://payroll/storage.js#L1-L534)

## Core Components

### Tax Calculation Engine

The tax calculation engine serves as the foundation for all payroll computations, providing accurate calculations for Irish tax components with support for multiple tax years and scenarios.

```mermaid
classDiagram
class TaxEngine {
+calculatePAYE(grossIncome, status) number
+calculateUSC(grossIncome) number
+calculatePRSI(grossIncome) number
+calculateNetFromGross(grossIncome, status) object
+calculateGrossFromNet(targetNet, status) object
+updateTaxRatesForYear(year) void
+calculatePAYEWithBreakdown(grossIncome, status) object
+calculateUSCWithBreakdown(grossIncome) object
+calculatePRSIWithBreakdown(grossIncome) object
}
class TaxRates {
+PAYE_RATES object
+USC_RATES array
+PRSI_RATES object
+TAX_CREDITS object
+PRSI_CREDIT_BANDS object
}
class CalculationResult {
+grossIncome number
+paye number
+usc number
+prsi number
+totalDeductions number
+netIncome number
+takeHomePercentage number
+payeBreakdown object
+uscBreakdown object
+prsiBreakdown object
}
TaxEngine --> TaxRates : "uses"
TaxEngine --> CalculationResult : "returns"
```

**Diagram sources**
- [js/calculator-core.js:151-542](file://js/calculator-core.js#L151-L542)

**Section sources**
- [js/calculator-core.js:8-118](file://js/calculator-core.js#L8-L118)
- [js/calculator-core.js:123-129](file://js/calculator-core.js#L123-L129)
- [js/calculator-core.js:514-542](file://js/calculator-core.js#L514-L542)

### Multi-Year Tax Rate Management

The system maintains comprehensive tax rate configurations for multiple Irish tax years, ensuring accurate calculations across different legislative periods.

```mermaid
flowchart TD
A[Tax Year Selection] --> B{Year 2024?}
B --> |Yes| C[Load 2024 Rates]
B --> |No| D{Year 2025?}
D --> |Yes| E[Load 2025 Rates]
D --> |No| F[Load 2026 Rates]
C --> G[Update Global Rates]
E --> G
F --> G
G --> H[Apply to Calculations]
H --> I[Generate Results]
style C fill:#e1f5fe
style E fill:#e8f5e8
style F fill:#fff3e0
```

**Diagram sources**
- [js/calculator-core.js:9-118](file://js/calculator-core.js#L9-L118)
- [js/calculator-core.js:123-129](file://js/calculator-core.js#L123-L129)

**Section sources**
- [js/calculator-core.js:9-118](file://js/calculator-core.js#L9-L118)

## Payroll Application

The payroll application provides a comprehensive interface for managing multiple companies, employees, and payroll runs with advanced features for business payroll management.

### Company Management System

The application supports multi-company functionality with separate workspaces for different business entities, each maintaining their own employee lists and payroll history.

```mermaid
sequenceDiagram
participant User as User Interface
participant App as PayrollApp
participant Storage as PayrollStorage
participant Employees as PayrollEmployees
User->>App : Enter Company Workspace
App->>Storage : getActiveCompanyId()
Storage-->>App : Company ID
App->>Storage : getCompany(companyId)
Storage-->>App : Company Data
App->>App : Update Selected Year & Period
App->>Employees : init(companyId)
Employees->>Storage : loadEmployees(companyId)
Storage-->>Employees : Employee List
Employees-->>App : Employee Data
App->>App : Render Dashboard
App-->>User : Company Workspace Displayed
```

**Diagram sources**
- [payroll/payroll.js:237-282](file://payroll/payroll.js#L237-L282)
- [payroll/employees.js:86-89](file://payroll/employees.js#L86-L89)

**Section sources**
- [payroll/payroll.js:78-132](file://payroll/payroll.js#L78-L132)
- [payroll/payroll.js:237-282](file://payroll/payroll.js#L237-L282)

### Payroll Run Management

The payroll run system enables comprehensive payroll processing with real-time calculations, validation, and detailed reporting capabilities.

```mermaid
flowchart TD
A[Start Payroll Run] --> B[Collect Timesheet Data]
B --> C[Calculate Preview]
C --> D{Validation Passes?}
D --> |No| E[Show Validation Errors]
D --> |Yes| F[Display Preview]
F --> G[User Confirms]
G --> H[Commit to Payroll]
H --> I[Generate Payslips]
I --> J[Update History]
J --> K[Complete Run]
E --> L[Fix Issues]
L --> C
style H fill:#e8f5e8
style K fill:#c8e6c9
```

**Diagram sources**
- [payroll/payroll.js:326-472](file://payroll/payroll.js#L326-L472)
- [payroll/payroll.js:814-921](file://payroll/payroll.js#L814-L921)

**Section sources**
- [payroll/payroll.js:508-567](file://payroll/payroll.js#L508-L567)
- [payroll/payroll.js:814-921](file://payroll/payroll.js#L814-L921)

### Payslip Generation System

The system generates detailed payslips with comprehensive calculation breakdowns, supporting both hourly and salaried employees with full transparency of tax deductions.

```mermaid
classDiagram
class PayslipGenerator {
+showPayslip(runId, employeeId) void
+generatePayeBreakdownHtml(result, paye, divisor) string
+generateUscBreakdownHtml(result, usc, divisor) string
+generatePrsiBreakdownHtml(result, gross, prsi, divisor) string
+printPayslip() void
+exportPayslipCSV(entry, run) void
}
class PayslipTemplate {
+payslip-document div
+payslip-layout div
+payslip-main div
+payslip-calc-breakdown div
+payslip-actions div
}
class CalculationBreakdown {
+earnings table
+deductions table
+calculation-steps div
+step-equations div
}
PayslipGenerator --> PayslipTemplate : "renders"
PayslipGenerator --> CalculationBreakdown : "generates"
```

**Diagram sources**
- [payroll/payroll.js:1054-1390](file://payroll/payroll.js#L1054-L1390)

**Section sources**
- [payroll/payroll.js:1054-1390](file://payroll/payroll.js#L1054-L1390)

## Employee Management

The employee management module provides comprehensive functionality for maintaining employee records, including personal information, tax status, pay type, and payroll history tracking.

### Employee Data Model

Each employee record maintains extensive information for accurate payroll calculations and compliance reporting.

```mermaid
erDiagram
EMPLOYEE {
string id PK
string firstName
string lastName
string ppsNumber
string familyStatus
string payType
string payFrequency
number annualGross
number hourlyRate
number overtimeMultiplier
string prsiClass
string taxCreditsMode
number manualTaxCredits
number manualCutOffPoint
string startDate
boolean isActive
}
RPN_SNAPSHOT {
string employeeId FK
number taxCredits
number cutOffPoint
string prsiClass
string uscStatus
string employerPrsiClass
number previousPay
number previousTax
number previousUSC
number bik
number pensionPct
number avc
}
EMPLOYEE ||--|| RPN_SNAPSHOT : "has"
```

**Diagram sources**
- [payroll/employees.js:149-626](file://payroll/employees.js#L149-L626)

**Section sources**
- [payroll/employees.js:149-626](file://payroll/employees.js#L149-L626)

### Tax Credits and Cut-Off Points Tracking

The system tracks tax credits and cut-off points on a cumulative basis across payroll periods, ensuring compliance with Irish Revenue requirements.

```mermaid
flowchart LR
A[Employee Record] --> B[Annual Tax Credits]
A --> C[Annual Cut-Off Points]
B --> D[Period Distribution]
C --> D
D --> E[Period Usage Tracking]
E --> F[Remaining Balance Calculation]
G[Payroll Run] --> H[TC Application]
H --> I[Update Usage]
I --> J[Recalculate Remaining]
style D fill:#e3f2fd
style F fill:#e8f5e8
```

**Diagram sources**
- [payroll/payroll.js:1515-1622](file://payroll/payroll.js#L1515-L1622)

**Section sources**
- [payroll/payroll.js:1515-1622](file://payroll/payroll.js#L1515-L1622)

## Tax Calculation Engine

The tax calculation engine provides precise calculations for Irish tax components with detailed breakdowns and support for multiple calculation scenarios.

### PAYE Calculation Logic

The PAYE calculation engine implements the standard and higher rate tax bands with appropriate cut-off points for different family statuses.

```mermaid
flowchart TD
A[Gross Income Input] --> B{Tax Status}
B --> C[Single]
B --> D[Married Joint]
B --> E[Married One Working]
B --> F[Single Parent]
B --> G[Manual Override]
C --> H[Standard: €44,000 @ 20%]
D --> I[Standard: €88,000 @ 20%]
E --> J[Standard: €53,000 @ 20%]
F --> K[Standard: €48,000 @ 20%]
G --> L[Custom Cut-Off Point]
H --> M[Higher: >€44,000 @ 40%]
I --> N[Higher: >€88,000 @ 40%]
J --> O[Higher: >€53,000 @ 40%]
K --> P[Higher: >€48,000 @ 40%]
L --> Q[Higher: >Custom @ 40%]
M --> R[Calculate Tax]
N --> R
O --> R
P --> R
Q --> R
R --> S[Deduct Tax Credits]
S --> T[Final PAYE Amount]
style H fill:#e1f5fe
style K fill:#e8f5e8
style L fill:#fff3e0
```

**Diagram sources**
- [js/calculator-core.js:151-178](file://js/calculator-core.js#L151-L178)
- [js/calculator-core.js:396-492](file://js/calculator-core.js#L396-L492)

**Section sources**
- [js/calculator-core.js:151-178](file://js/calculator-core.js#L151-L178)
- [js/calculator-core.js:396-492](file://js/calculator-core.js#L396-L492)

### USC Calculation Implementation

The USC calculation follows the multi-tier band structure with specific rates for different income brackets.

```mermaid
flowchart TD
A[Gross Income] --> B{Income < €13,000?}
B --> |Yes| C[Exempt from USC]
B --> |No| D[Apply Band Rates]
D --> E[Band 1: €0-€12,012 @ 0.5%]
E --> F[Band 2: €12,012-€25,760 @ 2%]
F --> G[Band 3: €25,760-€70,044 @ 4%]
G --> H[Above €70,044 @ 8%]
H --> I[Sum All Band Amounts]
I --> J[Total USC Amount]
style C fill:#e8f5e8
style J fill:#ffebee
```

**Diagram sources**
- [js/calculator-core.js:180-197](file://js/calculator-core.js#L180-L197)
- [js/calculator-core.js:199-237](file://js/calculator-core.js#L199-L237)

**Section sources**
- [js/calculator-core.js:180-197](file://js/calculator-core.js#L180-L197)
- [js/calculator-core.js:199-237](file://js/calculator-core.js#L199-L237)

### PRSI Calculation with Credit System

The PRSI calculation incorporates a sophisticated credit system with different bands and tapering mechanisms.

```mermaid
flowchart TD
A[Period Gross Income] --> B{Below A0 Threshold?}
B --> |Yes| C[No Employee PRSI]
B --> |No| D{Within AX Band?}
D --> |Yes| E[Apply Tapered Credit Formula]
D --> |No| F{Within AL Band?}
F --> |Yes| G[Standard Rate PRSI]
F --> |No| H[Standard Rate PRSI (A1)]
E --> I[Calculate Net PRSI]
G --> I
H --> I
I --> J[Apply Period Multiplier]
J --> K[Annualized PRSI]
style C fill:#e8f5e8
style I fill:#fff3e0
style K fill:#ffebee
```

**Diagram sources**
- [js/calculator-core.js:244-394](file://js/calculator-core.js#L244-L394)

**Section sources**
- [js/calculator-core.js:244-394](file://js/calculator-core.js#L244-L394)

## Data Storage System

The data storage system utilizes browser localStorage for persistent data management across multiple companies and payroll runs.

### Multi-Company Data Architecture

The storage system supports up to three companies with separate data isolation and unified backup functionality.

```mermaid
classDiagram
class PayrollStorage {
+initDefaults() void
+loadCompanies() array
+saveCompanies(list) boolean
+getCompany(id) object
+updateCompany(id, data) boolean
+getActiveCompanyId() string
+setActiveCompanyId(id) boolean
+saveEmployees(companyId, list) boolean
+loadEmployees(companyId) array
+savePayrollRun(companyId, run) boolean
+loadPayrollRuns(companyId) array
+deletePayrollRun(companyId, id) boolean
+exportBackup() void
+importBackup(file) Promise
+clearAllData() boolean
+generateId() string
}
class CompanyData {
+string id
+string name
+string address
+string eircode
+string payFrequency
+string taxYear
+string taxPeriod
+string createdAt
+string updatedAt
}
class EmployeeData {
+string id
+string firstName
+string lastName
+string ppsNumber
+array rpn
+string payType
+string payFrequency
+number annualGross
+number hourlyRate
+number overtimeMultiplier
+string prsiClass
+string taxCreditsMode
+number manualTaxCredits
+number manualCutOffPoint
+string startDate
+boolean isActive
}
class PayrollRun {
+string id
+string runDate
+string payPeriodLabel
+string taxYear
+string taxPeriod
+string frequency
+number periodNumber
+number weekNumber
+array entries
}
PayrollStorage --> CompanyData : "manages"
PayrollStorage --> EmployeeData : "manages"
PayrollStorage --> PayrollRun : "manages"
```

**Diagram sources**
- [payroll/storage.js:6-534](file://payroll/storage.js#L6-L534)

**Section sources**
- [payroll/storage.js:6-534](file://payroll/storage.js#L6-L534)

### Backup and Restore Functionality

The system provides comprehensive backup and restore capabilities for data portability and disaster recovery.

```mermaid
sequenceDiagram
participant User as User Interface
participant Storage as PayrollStorage
participant FileSystem as File System
participant Browser as Browser Storage
User->>Storage : Export Backup
Storage->>Browser : Retrieve Companies
Storage->>Browser : Retrieve Employees
Storage->>Browser : Retrieve Payroll Runs
Storage->>Storage : Package Data
Storage->>FileSystem : Create JSON File
FileSystem-->>User : Download Backup
User->>Storage : Import Backup
Storage->>FileSystem : Read File
Storage->>Storage : Parse JSON
Storage->>Browser : Clear Existing Data
Storage->>Browser : Write Companies
Storage->>Browser : Write Employees
Storage->>Browser : Write Payroll Runs
Storage-->>User : Import Complete
```

**Diagram sources**
- [payroll/storage.js:348-500](file://payroll/storage.js#L348-L500)

**Section sources**
- [payroll/storage.js:348-500](file://payroll/storage.js#L348-L500)

## User Interface Components

The user interface provides intuitive, responsive design with tabbed navigation and comprehensive form controls for payroll management.

### Tabbed Interface Architecture

The application uses a tabbed interface pattern for organizing different functional areas within the payroll workspace.

```mermaid
graph TB
subgraph "Navigation Tabs"
A[Employees Tab]
B[Tax Credits & COP Tab]
C[Run Payroll Tab]
D[History Tab]
end
subgraph "Content Areas"
E[Employee Management Panel]
F[Tax Credits Tracker Panel]
G[Payroll Processing Panel]
H[Payroll History Panel]
end
subgraph "Workspace Header"
I[Company Name Display]
J[Back to Companies Link]
end
A --> E
B --> F
C --> G
D --> H
I --> A
J --> A
style A fill:#e3f2fd
style B fill:#e8f5e8
style C fill:#fff3e0
style D fill:#fce4ec
```

**Diagram sources**
- [payroll/index.html:28-33](file://payroll/index.html#L28-L33)
- [payroll/index.html:54-58](file://payroll/index.html#L54-L58)

**Section sources**
- [payroll/index.html:28-33](file://payroll/index.html#L28-L33)
- [payroll/index.html:54-58](file://payroll/index.html#L54-L58)

### Form Validation and Error Handling

The system implements comprehensive form validation with real-time feedback and error messaging.

```mermaid
flowchart TD
A[Form Submission] --> B[Validate Required Fields]
B --> C{All Required Fields OK?}
C --> |No| D[Show Validation Errors]
C --> |Yes| E[Validate Data Types]
E --> F{Data Valid?}
F --> |No| G[Show Type Errors]
F --> |Yes| H[Validate Business Rules]
H --> I{Rules Pass?}
I --> |No| J[Show Rule Errors]
I --> |Yes| K[Submit Data]
D --> L[User Correction]
G --> L
J --> L
L --> A
K --> M[Success Message]
style D fill:#ffebee
style G fill:#ffebee
style J fill:#ffebee
style M fill:#e8f5e8
```

**Diagram sources**
- [payroll/employees.js:629-711](file://payroll/employees.js#L629-L711)

**Section sources**
- [payroll/employees.js:629-711](file://payroll/employees.js#L629-L711)

## Backup and Export Functionality

The system provides robust backup and export capabilities for data portability and compliance requirements.

### Export Formats

The system supports multiple export formats including CSV, Excel, and JSON for different use cases and integration needs.

```mermaid
flowchart LR
A[Payroll Data] --> B{Export Type}
B --> C[CSV Export]
B --> D[Excel Export]
B --> E[JSON Backup]
C --> F[Comma-Separated Values]
D --> G[Spreadsheet Format]
E --> H[Full System Backup]
F --> I[Import into Spreadsheet]
G --> J[Professional Reporting]
H --> K[System Migration]
style F fill:#e3f2fd
style G fill:#e8f5e8
style H fill:#fff3e0
```

**Diagram sources**
- [payroll/payroll.js:1397-1481](file://payroll/payroll.js#L1397-L1481)
- [payroll/storage.js:348-382](file://payroll/storage.js#L348-L382)

**Section sources**
- [payroll/payroll.js:1397-1481](file://payroll/payroll.js#L1397-L1481)
- [payroll/storage.js:348-382](file://payroll/storage.js#L348-L382)

## Integration Patterns

The system employs several integration patterns to maintain clean separation of concerns and enable extensibility.

### Module Pattern Implementation

Each major component follows the module pattern for encapsulation and dependency management.

```mermaid
graph TB
subgraph "Module Pattern Structure"
A[PayrollApp Module]
B[PayrollEmployees Module]
C[PayrollStorage Module]
D[Calculator Core Module]
end
subgraph "Dependencies"
E[Global Variables]
F[DOM Manipulation]
G[Event Handling]
H[Storage Access]
end
A --> B
A --> C
A --> D
B --> C
D --> E
A --> F
B --> F
C --> H
D --> E
style A fill:#e3f2fd
style B fill:#e8f5e8
style C fill:#fff3e0
style D fill:#ffebee
```

**Diagram sources**
- [payroll/payroll.js:4-1931](file://payroll/payroll.js#L4-L1931)
- [payroll/employees.js:4-800](file://payroll/employees.js#L4-L800)
- [payroll/storage.js:6-534](file://payroll/storage.js#L6-L534)

**Section sources**
- [payroll/payroll.js:4-1931](file://payroll/payroll.js#L4-L1931)
- [payroll/employees.js:4-800](file://payroll/employees.js#L4-L800)
- [payroll/storage.js:6-534](file://payroll/storage.js#L6-L534)

## Performance Considerations

The system is optimized for performance through efficient data structures, lazy loading, and minimal DOM manipulation.

### Calculation Performance

Tax calculations are optimized for speed while maintaining accuracy through efficient algorithmic approaches.

### Memory Management

The system implements proper memory management with event listener cleanup and DOM element removal to prevent memory leaks.

### Storage Optimization

Data is stored efficiently using JSON serialization and organized key structures to minimize storage overhead and improve access times.

## Security Considerations

The system implements several security measures to protect sensitive payroll data.

### Data Validation

All user inputs are validated both on the client-side and server-side to prevent injection attacks and ensure data integrity.

### Secure Data Handling

Payroll data is stored locally in the browser using secure storage mechanisms and is not transmitted to external servers.

### Privacy Protection

The system does not collect personal data beyond what is necessary for payroll calculations and provides users with full control over their data.

## Troubleshooting Guide

Common issues and their solutions for the Payroll Management System.

### Data Import/Export Issues

**Problem**: Backup import fails with validation errors
**Solution**: Verify the backup file format matches the expected schema and check for corrupted data

**Problem**: Exported CSV files not opening properly
**Solution**: Ensure the file has the correct .csv extension and try opening with a spreadsheet application

### Calculation Errors

**Problem**: Incorrect tax calculations for specific scenarios
**Solution**: Verify the selected tax year and family status match the employee's circumstances

**Problem**: Payslip generation fails for certain employees
**Solution**: Check employee data completeness and ensure all required fields are populated

### Performance Issues

**Problem**: Slow response times with large datasets
**Solution**: Clear browser cache, reduce the number of active employees, or consider upgrading device hardware

### Browser Compatibility

**Problem**: Features not working in older browsers
**Solution**: Use supported browsers or update to the latest version of your current browser

## Conclusion

The Payroll Management System provides a comprehensive, accurate, and user-friendly solution for Irish payroll calculations and management. The system's modular architecture, robust data persistence, and comprehensive feature set make it suitable for both individual use and small business payroll management.

Key strengths of the system include its accurate tax calculations aligned with current Irish Revenue requirements, comprehensive payslip generation with detailed breakdowns, multi-company support, and robust backup and export functionality. The clean separation of concerns and well-structured codebase facilitate maintenance and future enhancements.

The system successfully balances functionality with usability, providing both automated calculations for quick results and detailed breakdowns for educational and professional use. Its compliance with Irish tax regulations and support for multiple calculation scenarios make it a reliable tool for payroll professionals and individuals alike.