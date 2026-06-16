// payroll/payroll-help.js — Help tab content

var PayrollHelp = (function() {
    'use strict';

    function renderHelp() {
        const el = document.getElementById('help-content');
        if (!el) return;

        const showDashboardBack = !PayrollContext.currentCompanyId;
        let html = '<div class="help-page">';
        html += '<h2>Help</h2>';
        html += '<p class="help-intro">A quick guide to the main areas of the app. This is introductory help only — not tax advice. Check Revenue guidance for official rules.</p>';

        if (showDashboardBack) {
            html += '<p class="help-back-row"><a href="#" id="help-back-dashboard" class="help-back-link">&#8592; Back to Companies</a></p>';
        }

        html += '<section class="help-section"><h3>Quick start</h3>';
        html += '<ol class="help-steps">';
        html += '<li>Open or create a company on the Companies screen.</li>';
        html += '<li>Add employees (up to 10 per company).</li>';
        html += '<li>Choose <strong>Local</strong> or <strong>Cloud</strong> mode for that company.</li>';
        html += '<li>Run payroll, review the preview, then commit the run.</li>';
        html += '<li>Submit the period when ready (Cloud mode) and check History.</li>';
        html += '</ol></section>';

        html += '<section class="help-section"><h3>Companies</h3>';
        html += '<p>Your home screen lists up to three company slots. Click a company name to open it. Use <strong>Edit</strong> to change company details. Use <strong>Load Sandbox Ltd</strong> or <strong>Load Cloud Sandbox</strong> to practice with preset sample data.</p></section>';

        html += '<section class="help-section"><h3>Local vs Cloud mode</h3>';
        html += '<p><strong>Local mode</strong> — enter tax credits and cut-off points manually. Good for learning and offline practice. RPN and Revenue submission tabs are hidden.</p>';
        html += '<p><strong>Cloud mode</strong> — retrieve RPN data from the practice Revenue server, then generate and submit payroll. Requires the fake Revenue API on port 3001 for local development.</p></section>';

        html += '<section class="help-section"><h3>Employees</h3>';
        html += '<p>Add and edit staff records: name, PPS, pay type, frequency, PRSI class, and tax settings. Use <strong>Show Employee List</strong> for a printable summary. Click an employee card to edit or delete.</p></section>';

        html += '<section class="help-section"><h3>Tax Credits &amp; COP</h3>';
        html += '<p>Overview table of annual tax credits and cut-off points per employee. Sort columns and click a row to open that employee. <strong>Last updated</strong> shows when payroll with tax credits was last submitted.</p></section>';

        html += '<section class="help-section"><h3>RPN <span class="help-badge">Cloud</span></h3>';
        html += '<p>View Revenue Payroll Notification (RPN) fields for all employees. Retrieve RPN from the practice server before running payroll in Cloud mode.</p></section>';

        html += '<section class="help-section"><h3>Run Payroll</h3>';
        html += '<p>Enter hours or confirm salaried pay for the period. Preview PAYE, USC, and PRSI, then <strong>commit</strong> the run. You can roll back the last commit if you need to fix something before submitting.</p></section>';

        html += '<section class="help-section"><h3>Submission <span class="help-badge">Cloud</span></h3>';
        html += '<p>Generate a submission payload from committed runs and send it to the practice Revenue server. Use this after payroll is committed for the period.</p></section>';

        html += '<section class="help-section"><h3>History</h3>';
        html += '<p>Past payroll runs for the company. Expand a run to see details, export CSV/Excel, open payslips, or delete a run.</p></section>';

        html += '<section class="help-section"><h3>Backup &amp; privacy</h3>';
        html += '<p>Data is stored in this browser. Use <strong>Export Backup</strong> to save a JSON file and <strong>Import Backup</strong> to restore. Keep backup files private — they contain employee and payroll data.</p></section>';

        html += '<p class="help-disclaimer">This software is for practice and learning. Always verify figures with Revenue and professional advice before using results for real payroll.</p>';
        html += '</div>';

        el.innerHTML = html;

        const backLink = document.getElementById('help-back-dashboard');
        if (backLink) {
            backLink.addEventListener('click', function(e) {
                e.preventDefault();
                document.querySelectorAll('.tab-panel').forEach(function(panel) {
                    panel.classList.toggle('active', panel.id === 'panel-dashboard');
                });
            });
        }
    }

    return {
        renderHelp: renderHelp
    };
})();