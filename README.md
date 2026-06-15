# 🇮🇪 Irish Payroll Calculator

A comprehensive, accurate, and user-friendly Irish payroll calculator that helps you understand your take-home pay with detailed tax breakdowns. Calculate both **Gross to Net** (employee perspective) and **Net to Gross** (employer perspective) with precision. Built with modern web technologies and updated for 2024-2026 Irish tax rates.

## ✨ Features

### 💰 **Comprehensive Tax Calculations**
- **PAYE Tax**: Accurate 20%/40% rate calculations with proper cut-off points
- **USC (Universal Social Charge)**: Multi-band calculations (0.5%, 2%, 4%, 8%)
- **PRSI**: Employee contribution with tapered credit calculations
- **Net Pay**: Instant calculation of your take-home salary

### 📊 **Detailed Breakdowns**
- **PAYE Breakdown**: Step-by-step tax calculation with credit applications
- **USC Breakdown**: Band-by-band analysis with "Highest Rate Used" insights
- **PRSI Breakdown**: Comprehensive credit calculations for all bands (A0, AX, AL, A1)
- **Tax Credits**: Period-specific credit applications and calculations

### 🗓️ **Multi-Period Support**
Calculate your salary across different pay frequencies:
- **Annual** (yearly)
- **Monthly** (12 times per year)
- **Fortnightly** (26 times per year)
- **Weekly** (52 times per year)

### 🎯 **Tax Status Support**
- **Single Person** - Standard individual rates
- **Married (Joint Assessment)** - Combined household assessment
- **Single Parent** - Enhanced credits and cut-off points

### 📅 **Year-Specific Accuracy**
- **2024 Tax Rates** - Complete historical accuracy
- **2025 and 2026 Tax Rates** - Latest configured thresholds and credits
- **Automatic Updates** - Seamless switching between tax years

### ⚙️ **Advanced Features**
- **Manual Input Mode** - Custom tax credits and cut-off points
- **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- **Real-time Calculations** - Instant updates as you type
- **Detailed Documentation** - Comprehensive calculation explanations

## 🚀 Quick Start

### Option 1: Direct Usage (Recommended)
1. **Download** or clone this repository
2. **Open** `index.html` in any modern web browser
3. **Enter** your gross salary
4. **Select** your tax status and year
5. **View** your detailed breakdown instantly!

### Option 2: Local Development Server
```bash
# Clone the repository
git clone https://github.com/yourusername/irish-payroll-calculator.git

# Navigate to the directory
cd irish-payroll-calculator

# Start a local server from the project root (not from payroll/)
npm run serve
# or: python -m http.server 8000

# Open in browser
http://localhost:8000/          # Net/Gross calculator (main app)
http://localhost:8000/payroll/  # Payroll software
http://localhost:8000/batch/    # Batch calculator
```

**Important:** If you start the server inside the `payroll/` folder, `http://localhost:8000/` will show Payroll Software instead of the calculator, and "Back to Calculator" will not work. Always serve from the `NetToGros_Qoder` project root (same layout as production on nettogross-eire.com).

## 💡 How to Use

### 1. **Enter Your Salary**
- Input your gross annual salary in euros
- The calculator accepts any positive number

### 2. **Select Tax Status**
- **Single Person**: Standard individual tax treatment
- **Married (Joint Assessment)**: Combined household with higher cut-off points
- **Single Parent**: Enhanced credits (SPCCC) and increased cut-offs

### 3. **Choose Tax Year**
- **2024**: Historical rates for past calculations
- **2025**: Current rates with updated thresholds
- **2026**: Configured rates, including period-specific PRSI handling

### 4. **Select Calculation Period**
- Choose your preferred pay frequency
- All calculations automatically convert to your selected period

### 5. **Review Results**
Your comprehensive breakdown includes:
- **Salary Summary**: Gross, net, and take-home percentage
- **Tax Breakdown**: PAYE, USC, and PRSI amounts
- **Detailed Breakdowns**: Step-by-step calculations for each tax type

## 🧮 Tax Calculation Examples

### Example 1: Single Person, €50,000 Annual (2025)
- **Gross Annual**: €50,000
- **PAYE**: €4,400 (20% on €44,000 + 40% on €6,000)
- **USC**: €1,200.48 (0.5% + 2% + 4% bands)
- **PRSI**: €1,640 (4.1% with credit)
- **Net Annual**: €42,759.52
- **Take-Home**: 85.5%

### Example 2: Single Parent, €45,000 Annual (2025)
- **Enhanced Cut-off**: €48,000 (€44,000 + €4,000 SPCCC bonus)
- **Reduced PAYE**: Due to higher cut-off point
- **Additional Credit**: €1,900 SPCCC
- **Better Take-Home**: Enhanced net pay due to Single Parent benefits

## 📋 Technical Specifications

### 🎯 **2025 Tax Rates**
- **PAYE**: 20% (up to €44,000), 40% (above €44,000)
- **USC Bands**: 
  - 0.5% (€0 - €12,012)
  - 2.0% (€12,012 - €25,760)
  - 4.0% (€25,760 - €70,044)
  - 8.0% (above €70,044)
- **PRSI**: 4.1% employee contribution with tapered credits

### 🎯 **Tax Credits (2025)**
- **Personal Credit**: €2,000
- **Employee Credit**: €2,000
- **Single Parent Child Carer Credit**: €1,900

### 🎯 **PRSI Bands (Weekly 2025)**
- **A0**: €38-€352 (0% rate)
- **AX**: €352.01-€424 (4.1% with tapered credit up to €12/week)
- **AL**: €424.01-€527 (4.1% rate)
- **A1**: >€527 (4.1% rate)

## 🔧 Customization

### Manual Input Mode
For accountants and payroll professionals:
- **Custom Tax Credits**: Override standard credits
- **Custom Cut-off Points**: Adjust PAYE thresholds
- **Flexible Configuration**: Adapt to unique scenarios

### Payroll Module
The `/payroll/` workspace supports multi-company payroll management, employee records, Revenue Payroll Notification fields, period commits/submissions, payslip generation, payroll history, CSV/Excel export, and JSON backup/import. Payroll data is stored locally in the browser; exported backups contain sensitive employee and payroll data, including PPS numbers.

### Code Structure
```
index.html          # Main application file
├── CSS Styles      # Responsive design and theming
├── JavaScript      # Tax calculation logic
├── Tax Rates       # Year-specific configurations
├── UI Components   # Interactive form elements
└── Result Displays # Detailed breakdown presentations
```

## 📱 Browser Compatibility

**Fully Supported:**
- ✅ Chrome 90+
- ✅ Firefox 90+
- ✅ Safari 14+
- ✅ Edge 90+

**Mobile Optimized:**
- ✅ iOS Safari
- ✅ Chrome Mobile
- ✅ Samsung Internet

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### 🐛 **Bug Reports**
- Use GitHub Issues
- Include browser and version
- Provide reproduction steps
- Share expected vs actual results

### 💡 **Feature Requests**
- Suggest new tax statuses
- Propose calculation improvements
- Request additional breakdowns
- Share usability feedback

### 🔧 **Code Contributions**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📚 Resources

### Official Irish Tax Information
- [Revenue.ie](https://www.revenue.ie) - Official Irish Revenue website
- [Income Tax Rates](https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-relief-charts/index.aspx)
- [PRSI Information](https://www.revenue.ie/en/jobs-and-pensions/employee-prsi/index.aspx)
- [USC Information](https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/usc/universal-social-charge.aspx)

### Tax Year Updates
- **2024 Rates**: [Budget 2024](https://www.revenue.ie/en/corporate/documents/statistics/budget/budget-2024.pdf)
- **2025 Rates**: [Budget 2025](https://www.revenue.ie/en/corporate/documents/statistics/budget/budget-2025.pdf)

## ⚖️ Legal Disclaimer

**Important Notice:**
- This calculator is for **informational purposes only**
- Results are **estimates** based on standard scenarios
- **Actual payroll** may include additional deductions (pension, health insurance, etc.)
- **Always consult** with a qualified accountant or Revenue.ie for official calculations
- **Tax laws** can change; verify current rates with official sources
- **Payroll backups** contain sensitive personal and salary data. Store them securely and remove old copies when no longer needed.

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Irish Revenue Commissioners** - For comprehensive tax documentation
- **Open Source Community** - For inspiration and best practices
- **Beta Testers** - For valuable feedback and testing
- **Contributors** - For ongoing improvements and features

## 📞 Support

**Need Help?**
- 📧 **Email**: [your-email@example.com]
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/irish-payroll-calculator/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/irish-payroll-calculator/discussions)

---

**Made with ❤️ for the Irish community**

*Helping you understand your take-home pay, one calculation at a time!*
