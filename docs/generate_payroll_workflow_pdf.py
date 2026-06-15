"""Generate Payroll Workflow Guide PDF."""
from fpdf import FPDF
from pathlib import Path

OUT = Path(__file__).parent / "Payroll-Workflow-Guide.pdf"


class GuidePDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "NetToGros Payroll - Workflow Guide", align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 9)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")

    def section_title(self, title):
        self.ln(4)
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(20, 60, 100)
        self.multi_cell(0, 8, title)
        self.set_draw_color(20, 60, 100)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(4)
        self.set_font("Helvetica", "", 11)
        self.set_text_color(0, 0, 0)

    def subsection(self, title):
        self.ln(3)
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(40, 40, 40)
        self.multi_cell(0, 7, title)
        self.ln(2)
        self.set_font("Helvetica", "", 11)
        self.set_text_color(0, 0, 0)

    def body(self, text):
        self.set_x(self.l_margin)
        self.multi_cell(0, 6, text)
        self.ln(2)

    def bullet(self, text):
        self.set_x(self.l_margin + 4)
        self.multi_cell(0, 6, f"- {text}")
        self.ln(1)

    def simple_table(self, headers, rows, widths):
        self.set_x(self.l_margin)
        self.set_font("Helvetica", "B", 9)
        self.set_fill_color(230, 240, 250)
        for i, h in enumerate(headers):
            self.cell(widths[i], 8, h, border=1, fill=True)
        self.ln()
        self.set_font("Helvetica", "", 9)
        for row in rows:
            self.set_x(self.l_margin)
            line_h = 7
            # measure row height
            heights = []
            for i, cell in enumerate(row):
                nb = self.multi_cell(widths[i], line_h, str(cell), dry_run=True, split_only=True)
                heights.append(max(1, len(nb)) * line_h)
            row_h = max(heights)
            y0 = self.get_y()
            x0 = self.l_margin
            for i, cell in enumerate(row):
                self.set_xy(x0, y0)
                self.multi_cell(widths[i], line_h, str(cell), border=0)
                self.rect(x0, y0, widths[i], row_h)
                x0 += widths[i]
            self.set_y(y0 + row_h)
        self.ln(4)


def build():
    pdf = GuidePDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(20, 60, 100)
    pdf.multi_cell(0, 12, "Payroll Workflow Guide")
    pdf.ln(2)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "", 12)
    pdf.set_text_color(60, 60, 60)
    pdf.multi_cell(0, 7, "NetToGros Ireland - Local & Cloud Practice Modes")
    pdf.set_x(pdf.l_margin)
    pdf.multi_cell(0, 7, "Document date: 15 June 2026")
    pdf.ln(6)
    pdf.set_text_color(0, 0, 0)
    pdf.set_font("Helvetica", "", 11)
    pdf.body(
        "This guide explains how Run Payroll, Calculate Preview, Commit, and Submit work in the "
        "current NetToGros payroll application. It covers tax credits (TC), cut-off points (COP), "
        "period handling, local vs cloud behaviour, and what is (and is not) supported when multiple "
        "payroll runs are prepared in advance."
    )

    pdf.section_title("1. Project context")
    pdf.subsection("1.1 Two operating modes (per company)")
    pdf.simple_table(
        ["Mode", "Storage", "TC / COP source", "Revenue"],
        [
            ["Local", "localStorage + JSON backup", "Manual from employee card", "None"],
            ["Cloud", "localStorage (DB later)", "RPN from fake server", "Fake server port 3001"],
        ],
        [22, 42, 58, 68],
    )
    pdf.body(
        "Practice companies: Company 1 = Local (Sandbox Ltd), Company 2 = Cloud (Cloud Sandbox), "
        "Company 3 = user chooses mode on first entry."
    )
    pdf.subsection("1.2 Running locally")
    pdf.bullet("Serve from project root: python -m http.server 8000, open http://localhost:8000/payroll/")
    pdf.bullet("If serving only the payroll folder, use js/calculator-core.js fallback.")
    pdf.bullet("Cloud mode also needs the fake Revenue server on port 3001.")

    pdf.section_title("2. Run Payroll workflow overview")
    pdf.body("The payroll cycle has four stages. Each has different effects on periods and tax balances.")
    pdf.simple_table(
        ["Stage", "Action", "Period changes?", "TC/COP consumed?"],
        [
            ["Preview", "Calculate Preview", "No", "No"],
            ["Commit", "Commit to Payroll", "Counters advance", "Yes"],
            ["Submit local", "Submit Period", "Period closes", "Locked in"],
            ["Submit cloud", "Submit to Revenue", "Period closes + RPN refresh", "RPN updated"],
        ],
        [28, 52, 50, 50],
    )
    pdf.body("Recommended flow: Preview (repeat) -> Commit once -> Submit -> next period.")

    pdf.add_page()
    pdf.section_title("3. Calculate Preview")
    pdf.subsection("3.1 What it does")
    pdf.body(
        "Reads timesheet inputs, calculates PAYE/USC/PRSI per employee by frequency, shows preview "
        "tables and enables Commit. Does not save to history or consume TC/COP."
    )
    pdf.subsection("3.2 Safe to repeat")
    pdf.body(
        "Same inputs give the same results. Change hours or employee TC/COP on the card and the "
        "next preview updates - still without consuming credits until commit."
    )
    pdf.subsection("3.3 Technical fix (June 2026)")
    pdf.bullet("Fallback loader for calculator-core.js.")
    pdf.bullet("Event delegation for Calculate Preview and Commit buttons.")
    pdf.bullet("Safe state-machine fallback and clear error messages.")
    pdf.bullet("initOrSyncLedger() before preview for current card/RPN values.")

    pdf.section_title("4. Tax credits and COP by mode")
    pdf.subsection("4.1 Local mode")
    pdf.body(
        "PAYE uses ledger remaining TC and copRemaining COP per periods per year. Before any commit, "
        "remaining equals annual values from the employee card."
    )
    pdf.subsection("4.2 Cloud mode")
    pdf.body(
        "With RPN: uses periodicTaxCredit and periodicStandardRateCutOffPoint. Without RPN: emergency rules."
    )
    pdf.subsection("4.3 Ledger sync on preview")
    pdf.body(
        "initOrSyncLedger refreshes annual TC/COP from card/RPN but keeps taxCreditsUsed and copUsed "
        "from prior commits."
    )

    pdf.section_title("5. Commit to Payroll")
    pdf.bullet("Run saved to history as 'committed'.")
    pdf.bullet("Ledger: taxCreditsUsed and copUsed increase.")
    pdf.bullet("State machine: commitCounter up; run in committedRunIds.")
    pdf.bullet("Week/frequency counters advance.")
    pdf.bullet("UI hides timesheet; shows committed view with Rollback / Submit actions.")

    pdf.add_page()
    pdf.section_title("6. Submit and period closure")
    pdf.subsection("6.1 Local - Submit Period")
    pdf.body(
        "Marks all committedRunIds as submitted, creates submission record, advancePeriod() opens next period."
    )
    pdf.subsection("6.2 Cloud - Revenue submission")
    pdf.body(
        "Generate Submission from latest committed run. Submit to Revenue (POST /psr), then submitPeriod "
        "and refreshCloudTaxValuesAfterSubmit updates employee RPN remaining TC/COP."
    )

    pdf.section_title("7. Multiple previews vs multiple commits")
    pdf.subsection("7.1 Multiple previews - SUPPORTED")
    pdf.body("Preview is a dry run. Period and TC/COP balances unchanged.")
    pdf.subsection("7.2 Multiple commits before submit - NOT SUPPORTED")
    pdf.body(
        "After first commit, Calculate Preview is hidden until Submit or Rollback. Cannot stack "
        "week 26, 27, 28 commits and submit on different due dates."
    )
    pdf.body("Enforced sequence: Preview -> Commit -> Submit -> Preview next week -> ...")
    pdf.subsection("7.3 Data model note")
    pdf.body(
        "committedRunIds can hold multiple runs and performSubmit marks all submitted together, but UI "
        "blocks second commit. Cloud PSR uses latest committed run only."
    )

    pdf.section_title("8. Vacation / assistant scenario")
    pdf.subsection("8.1 Requested use case")
    pdf.body(
        "Commit payrolls in advance; assistant submits each on due date in correct order."
    )
    pdf.subsection("8.2 Current answer: NOT SUPPORTED")
    pdf.bullet("No submission queue with due dates.")
    pdf.bullet("No per-run submit or ordering choice.")
    pdf.bullet("Cannot commit future weeks while earlier commits await submit.")
    pdf.subsection("8.3 Practical guidance today")
    pdf.bullet("Commit only payroll due now; submit before leaving.")
    pdf.bullet("Repeat weekly; do not batch future weeks.")
    pdf.subsection("8.4 Future enhancement (deferred)")
    pdf.body(
        "Queue model: Commit saves run and advances week; Submit per pay date with clear labels in History."
    )

    pdf.section_title("9. Quick reference")
    pdf.simple_table(
        ["Action", "Period on screen", "weekNumber", "TC/COP remaining"],
        [
            ["Preview (repeat)", "No change", "No change", "No change"],
            ["Card edit + Preview", "No change", "No change", "Annual refresh only"],
            ["Commit", "Committed view", "Advances", "Consumed"],
            ["Rollback", "Restored", "Restored", "Reversed"],
            ["Submit", "Next period", "Period reset", "Cloud RPN refreshed"],
        ],
        [40, 45, 40, 45],
    )
    pdf.simple_table(
        ["Location", "Information"],
        [
            ["Committed panel", "Commit count, net total, pay date, periods"],
            ["History", "Date, period label, Committed/Submitted, gross/net"],
            ["Tax Credits tab", "Annual TC/COP, used, remaining, source"],
            ["Submission tab", "PSR records and JSON (cloud)"],
        ],
        [50, 130],
    )

    pdf.section_title("10. Glossary")
    pdf.bullet("TC - Tax Credits.")
    pdf.bullet("COP - Cut-Off Point (standard rate band).")
    pdf.bullet("RPN - Revenue Payroll Notification (cloud, simulated).")
    pdf.bullet("PSR - Payroll Submission Request.")
    pdf.bullet("Open period - Awaiting submit; new preview blocked after commit.")
    pdf.bullet("Ledger - Per-employee annual TC/COP and used/remaining tracking.")

    pdf.ln(4)
    pdf.set_x(pdf.l_margin)
    pdf.set_font("Helvetica", "I", 10)
    pdf.set_text_color(80, 80, 80)
    pdf.multi_cell(
        0,
        6,
        "NetToGros Qoder payroll documentation. Project: Desktop/NetToGros_Qoder/payroll. "
        "Production: https://nettogross-eire.com/payroll/",
    )

    pdf.output(OUT)
    print(f"Created: {OUT}")


if __name__ == "__main__":
    build()