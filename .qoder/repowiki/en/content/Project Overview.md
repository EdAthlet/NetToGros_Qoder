# Project Overview

<cite>
**Referenced Files in This Document**   
- [index.html](file://index.html) - *Updated with dynamic year display and HTTPS redirection*
- [manifest.json](file://manifest.json) - *PWA metadata configuration*
- [sw.js](file://sw.js) - *Service worker for offline functionality*
- [netlify.toml](file://netlify.toml) - *Deployment configuration for Netlify*
- [robots.txt](file://robots.txt) - *SEO configuration for crawler access*
- [sitemap.xml](file://sitemap.xml) - *Updated with current site structure*
</cite>

## Update Summary
**Changes Made**   
- Removed outdated reference to `about.html` as the file has been deleted
- Updated documentation to reflect removal of the "About" section from the application
- Added documentation for HTTPS redirection logic in `index.html`
- Updated SEO metadata details based on enhanced structured data in HTML head
- Corrected sitemap information to reflect current domain and structure
- Removed all references to non-existent `about.html` file
- Updated tax year display behavior to reflect dynamic updates in the UI
- Revised project structure description to exclude deleted documentation page

## Table of Contents
1. [Project Structure](#project-structure)
2. [Core Components](#core-components)
3. [Architecture Overview](#architecture-overview)
4. [Detailed Component Analysis](#detailed-component-analysis)
5. [Dependency Analysis](#dependency-analysis)
6. [Performance Considerations](#performance-considerations)
7. [Troubleshooting Guide](#troubleshooting-guide)

## Project Structure

The NetToGros_Qoder project is a minimalistic yet fully functional Progressive Web App (PWA) designed for calculating Irish payroll taxes. It consists of six core files that work together to deliver a reliable, installable web experience:

- **index.html**: The main entry point containing the complete user interface, styling, and embedded JavaScript logic with comprehensive tax calculation capabilities.
- **manifest.json**: The PWA manifest file that defines metadata such as app name, icons, theme colors, and display mode.
- **sw.js**: The service worker script that enables offline functionality through caching.
- **netlify.toml**: Deployment configuration file for Netlify hosting platform, ensuring proper caching behavior for service worker.
- **robots.txt**: SEO configuration file that instructs web crawlers on which pages to index.
- **sitemap.xml**: XML sitemap that provides search engines with information about the site's structure and content.

This structure follows a monolithic single-page application (SPA) pattern where all logic and presentation are contained within a single HTML file, making it lightweight and easy to deploy.

```
graph TB
A[index.html] --> B[manifest.json]
A --> C[sw.js]
A --> D[netlify.toml]
A --> E[robots.txt]
A --> F[sitemap.xml]
B --> H[App Metadata]
C --> I[Offline Caching]
D --> J[Deployment Configuration]
E --> K[Search Engine Indexing Rules]
F --> L[Site Structure for Search Engines]
A --> N[UI & Logic]
style A fill:#2c5530,color:white
style B fill:#1565c0,color:white
style C fill:#7b1fa2,color:white
style D fill:#ff9800,color:white
style E fill:#4caf50,color:white
style F fill:#9c27b0,color:white
```

**Diagram sources**
- [index.html](file://index.html#L1-L2665)
- [manifest.json](file://manifest.json#L1-L43)
- [sw.js](file://sw.js#L1-L170)
- [netlify.toml](file://netlify.toml#L1-L15)
- [robots.txt](file://robots.txt#L1-L4)
- [sitemap.xml](file://sitemap.xml#L1-L16)

## Core Components

The application is built around five primary components that enable its functionality as a PWA:

1. **User Interface (index.html)**: Contains the complete UI with responsive design, input forms, tabs for different calculation periods, and dynamic result display with detailed tax breakdowns.
2. **PWA Configuration (manifest.json)**: Defines the app's identity, appearance when installed, and shortcut capabilities.
3. **Service Worker (sw.js)**: Implements caching strategy to ensure the app works offline and provides update notifications.
4. **Deployment Configuration (netlify.toml)**: Specifies build settings and header configurations for optimal deployment on Netlify, particularly ensuring the service worker is not cached.
5. **SEO Infrastructure (robots.txt and sitemap.xml)**: Provides search engine optimization through crawler directives and site structure mapping.

The core business logic for payroll calculations is embedded directly within index.html, using native JavaScript to perform net-to-gross and gross-to-net conversions based on Irish tax regulations. The application now dynamically updates the displayed tax year and includes automatic HTTP to HTTPS redirection in production environments.

**Section sources**
- [index.html](file://index.html#L1-L2665)
- [manifest.json](file://manifest.json#L1-L43)
- [sw.js](file://sw.js#L1-L170)
- [netlify.toml](file://netlify.toml#L1-L15)
- [robots.txt](file://robots.txt#L1-L4)
- [sitemap.xml](file://sitemap.xml#L1-L16)

## Architecture Overview

The NetToGros_Qoder application follows a monolithic single-page application architecture with embedded JavaScript, CSS, and HTML in a single index.html file. This design choice eliminates external dependencies and ensures the app can function with minimal network requests.

The architecture leverages modern web platform features to deliver a native-like experience:

- **Progressive Web App capabilities** via manifest.json and service worker
- **Offline functionality** through cache-first service worker strategy
- **Installability** with home screen shortcuts and full-screen display
- **Responsive design** that works across mobile and desktop devices
- **Deployment optimization** through Netlify configuration to prevent service worker caching issues
- **Search Engine Optimization** through robots.txt and sitemap.xml configuration
- **Automatic HTTPS redirection** for production environments to ensure secure connections

```
graph TD
subgraph "Client-Side Application"
UI[User Interface<br>HTML/CSS/JS]
SW[Service Worker<br>sw.js]
Cache[(Cache Storage)]
end
subgraph "PWA Metadata"
Manifest[manifest.json]
end
subgraph "Deployment Configuration"
Netlify[netlify.toml]
end
subgraph "SEO Infrastructure"
Robots[robots.txt]
Sitemap[sitemap.xml]
end
UI --> SW
SW --> Cache
UI --> Manifest
Manifest --> UI
Netlify --> SW
UI --> Robots
UI --> Sitemap
style UI fill:#2c5530,color:white
style SW fill:#7b1fa2,color:white
style Manifest fill:#1565c0,color:white
style Netlify fill:#ff9800,color:white
style Robots fill:#4caf50,color:white
style Sitemap fill:#9c27b0,color:white
```

**Diagram sources**
- [index.html](file://index.html#L1-L2665)
- [manifest.json](file://manifest.json#L1-L43)
- [sw.js](file://sw.js#L1-L170)
- [netlify.toml](file://netlify.toml#L1-L15)
- [robots.txt](file://robots.txt#L1-L4)
- [sitemap.xml](file://sitemap.xml#L1-L16)

## Detailed Component Analysis

### User Interface and Calculation Logic

The index.html file contains the complete user interface and all calculation logic for the payroll calculator. The UI supports two primary calculation types:

- **Net to Gross**: Calculate gross salary from desired net amount
- **Gross to Net**: Calculate net salary from gross amount

The interface supports multiple time periods (Annual, Monthly, Fortnightly, Weekly) and tax statuses (Single, Married, Single Parent, Manual Input).

#### Tax Calculation Pipeline

The application implements a comprehensive tax calculation pipeline that computes Irish payroll deductions including PAYE, USC, and PRSI.

```
flowchart TD
Start([Input Parameters]) --> Validate["Validate Input"]
Validate --> Status{"Tax Status?"}
Status --> |Standard| UseStandard["Use Predefined Rates"]
Status --> |Manual| UseManual["Use Custom Values"]
UseStandard --> SelectYear["Select Tax Year"]
UseManual --> SelectYear
SelectYear --> Convert["Convert to Annual Amount"]
Convert --> CalculatePAYE["Calculate PAYE Tax"]
CalculatePAYE --> CalculateUSC["Calculate USC"]
CalculateUSC --> CalculatePRSI["Calculate PRSI"]
CalculatePRSI --> ApplyCredits["Apply Tax Credits"]
ApplyCredits --> ComputeNet["Compute Net Income"]
ComputeNet --> ConvertBack["Convert to Selected Period"]
ConvertBack --> Display["Display Results"]
style Start fill:#2c5530,color:white
style Display fill:#2c5530,color:white
```

**Diagram sources**
- [index.html](file://index.html#L882-L1300)

**Section sources**
- [index.html](file://index.html#L1-L2665)

#### Enhanced PRSI Tapered Rate Calculation

The application provides a comprehensive breakdown of PRSI calculations, particularly focusing on the tapered credit system in the AX band. When a user's earnings fall within the credit band (AX), the app displays a step-by-step calculation of the tapered credit.

The PRSI calculation follows a band-based system:
- **A0**: No PRSI due below threshold
- **AX**: Tapered credit band with 4.1% employee rate
- **AL**: Standard rate above credit band
- **A1**: High earner band

For the AX band, the credit is calculated using the formula:
```
Credit = MAX(0, MIN(maxCredit, maxCredit - ((pay - threshold) / 6)))
```

This means the credit reduces by €1 for every €6 earned above the minimum threshold of the credit band.

**Section sources**
- [index.html](file://index.html#L1047-L1144)
- [index.html](file://index.html#L1680-L1900)

### PWA Configuration Analysis

The manifest.json file defines the application's PWA metadata, enabling it to be installed on user devices and function like a native app.

**Key Configuration Properties:**
- **name**: "Irish Payroll Calculator"
- **short_name**: "Payroll IE"
- **description**: "Calculate net-to-gross and gross-to-net salary with Irish tax rates (PAYE, USC, PRSI)"
- **start_url**: "/"
- **display**: "standalone" (full-screen mode)
- **theme_color**: "#2c5530" (dark green)
- **background_color**: "#f5f7fa" (light gray)
- **orientation**: "portrait-primary"
- **lang**: "en-IE" (Irish English)
- **scope**: "/"
- **categories**: ["finance", "business", "productivity"]

The manifest also defines app shortcuts for quick access to annual and monthly calculators, using URL parameters to pre-select the appropriate tab.

```
classDiagram
class Manifest {
+string name
+string short_name
+string description
+string start_url
+string display
+string background_color
+string theme_color
+string orientation
+array categories
+string lang
+string scope
+array icons
+array shortcuts
}
Manifest --> Icon : "has"
Manifest --> Shortcut : "has"
class Icon {
+string src
+string sizes
+string type
+string purpose
}
class Shortcut {
+string name
+string short_name
+string description
+string url
+array icons
}
```

**Diagram sources**
- [manifest.json](file://manifest.json#L1-L43)

**Section sources**
- [manifest.json](file://manifest.json#L1-L43)

### Service Worker Implementation

The sw.js file implements a service worker that enables offline functionality and app updates. It follows a network-first strategy for HTML files and cache-first for assets.

#### Caching Strategy

The service worker implements a comprehensive caching strategy:

```
sequenceDiagram
participant Browser
participant ServiceWorker
participant Cache
participant Network
Browser->>ServiceWorker : fetch(request)
ServiceWorker->>Cache : match(request)
alt Cache Hit
Cache-->>ServiceWorker : cached response
ServiceWorker-->>Browser : cached response
else Cache Miss
ServiceWorker->>Network : fetch(request)
alt Network Success
Network-->>ServiceWorker : response
ServiceWorker->>Cache : put(request, response.clone())
ServiceWorker-->>Browser : response
else Network Failure
ServiceWorker-->>Browser : offline fallback response
end
end
```

The service worker also handles activation by cleaning up old caches and supports future features like background sync and push notifications. The netlify.toml configuration ensures the service worker itself is not cached, preventing update issues.

**Section sources**
- [sw.js](file://sw.js#L1-L170)
- [netlify.toml](file://netlify.toml#L5-L9)

### Deployment Configuration

The netlify.toml file provides deployment configuration for the Netlify hosting platform. It specifies the build settings and HTTP headers to ensure optimal performance and reliability.

**Key Configuration:**
- **publish**: "." - Deploy all files from the root directory
- **Cache-Control for sw.js**: "no-cache, no-store, must-revalidate" - Ensures the service worker is always fetched fresh to prevent update issues

This configuration is critical for PWA functionality, as cached service workers can prevent users from receiving app updates.

**Section sources**
- [netlify.toml](file://netlify.toml#L1-L15)

### SEO Infrastructure

The project includes two SEO infrastructure files that were recently added to improve search engine visibility:

**robots.txt Configuration:**
- **User-agent**: * - Applies to all web crawlers
- **Allow**: / - Allows indexing of all pages
- **Sitemap**: Specifies the location of the XML sitemap

**sitemap.xml Configuration:**
- Contains the main site URL with metadata including:
  - **loc**: The URL of the page
  - **lastmod**: Last modification date
  - **changefreq**: Expected change frequency
  - **priority**: Priority of the page relative to other pages

These files work together to ensure the application is properly indexed by search engines while maintaining the PWA's offline capabilities.

**Section sources**
- [robots.txt](file://robots.txt#L1-L4)
- [sitemap.xml](file://sitemap.xml#L1-L16)

## Dependency Analysis

The NetToGros_Qoder application has no external dependencies, relying entirely on native browser APIs and features:

- **No external libraries or frameworks**
- **No build tools or package managers**
- **No server-side components**

All functionality is implemented using vanilla JavaScript, HTML, and CSS.

```
graph TD
A[NetToGros_Qoder] --> B[Browser APIs]
A --> C[Native JavaScript]
A --> D[HTML5]
A --> E[CSS3]
B --> F[Service Worker API]
B --> G[Cache API]
B --> H[Web App Manifest]
B --> I[Notifications API]
B --> J[Background Sync]
style A fill:#2c5530,color:white
```

**Diagram sources**
- [index.html](file://index.html#L1-L2665)
- [sw.js](file://sw.js#L1-L170)

**Section sources**
- [index.html](file://index.html#L1-L2665)
- [sw.js](file://sw.js#L1-L170)

## Performance Considerations

The application is optimized for performance through several key design decisions:

- **Single file delivery**: All content is in index.html, minimizing HTTP requests
- **Efficient caching**: Service worker caches core assets for offline use
- **Minimal JavaScript**: Only necessary calculation logic is included
- **Responsive design**: Works well on both mobile and desktop devices
- **Deployment optimization**: Netlify configuration prevents service worker caching issues
- **SEO optimization**: robots.txt and sitemap.xml ensure proper search engine indexing
- **Security enhancement**: Automatic HTTP to HTTPS redirection in production environments

The calculation algorithms are optimized for speed with O(n) complexity for tax band processing, where n is the number of tax bands (a small constant). The PRSI breakdown display is optimized to only show detailed calculations for the relevant band (AX), reducing visual complexity for other cases.

## Troubleshooting Guide

Common issues and their solutions:

1. **App not installing**: Ensure the site is served over HTTPS and the manifest.json is correctly configured.
2. **Offline functionality not working**: Clear site data and reload to force service worker re-registration.
3. **Calculation discrepancies**: Verify the selected tax year and status match the intended scenario.
4. **Service worker not updating**: Force refresh or clear site storage to trigger update. The netlify.toml configuration helps prevent this by ensuring the service worker is not cached.
5. **PRSI credit calculation confusion**: Refer to the detailed AX band breakdown which shows the step-by-step tapered credit calculation.
6. **SEO indexing issues**: Verify robots.txt allows indexing and sitemap.xml is correctly formatted with current URLs.
7. **HTTPS redirection issues**: The application automatically redirects from HTTP to HTTPS in production, except on localhost for development.

The application includes built-in error handling for invalid inputs and provides user feedback through error messages and detailed calculation breakdowns.

**Section sources**
- [index.html](file://index.html#L1400-L1500)
- [sw.js](file://sw.js#L1-L170)
- [netlify.toml](file://netlify.toml#L1-L15)
- [robots.txt](file://robots.txt#L1-L4)
- [sitemap.xml](file://sitemap.xml#L1-L16)