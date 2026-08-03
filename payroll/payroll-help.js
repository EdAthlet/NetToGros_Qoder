// payroll/payroll-help.js — Help tab content (keep in sync with current Free Payroll Software)

var PayrollHelp = (function() {
    'use strict';

    var deps = {};

    function init(dependencies) {
        deps = dependencies || {};
    }

    function callDep(name) {
        var fn = deps[name];
        if (typeof fn === 'function') {
            return fn.apply(null, Array.prototype.slice.call(arguments, 1));
        }
    }

    function isLocalDev() {
        var host = window.location.hostname;
        return host === 'localhost' || host === '127.0.0.1';
    }

    function setContactFormStatus(message, type) {
        var status = document.getElementById('help-contact-status');
        if (!status) return;
        status.textContent = message;
        status.className = 'help-contact-status help-contact-status--' + (type || 'info');
        status.hidden = !message;
    }

    function bindContactForm() {
        var form = document.getElementById('help-contact-form');
        if (!form || form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';

        if (!isLocalDev()) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            setContactFormStatus(
                'Feedback form works on the live Netlify site. Use Support in the top nav or deploy to test.',
                'info'
            );
        });
    }

    function scrollToContactSection() {
        var section = document.getElementById('help-contact-section');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function openContactForm() {
        callDep('switchTab', 'help');
        window.setTimeout(scrollToContactSection, 60);
    }

    function renderHelp() {
        const el = document.getElementById('help-content');
        if (!el) return;

        const showDashboardBack = !PayrollContext.currentCompanyId;
        let html = '<div class="help-page">';
        html += '<h2>Help — Free Payroll Software</h2>';
        html += '<p class="help-intro">Guide to the current app. This is introductory help only — not tax advice. Check Revenue guidance for official rules.</p>';

        if (showDashboardBack) {
            html += '<p class="help-back-row"><a href="#" id="help-back-dashboard" class="help-back-link">&#8592; Back to Companies</a></p>';
        }

        html += '<section class="help-section"><h3>Quick start</h3>';
        html += '<ol class="help-steps">';
        html += '<li>On <strong>Your Companies</strong>, open a slot or load a sandbox (warm cream = Local, cool blue = Cloud).</li>';
        html += '<li>Add or review employees (up to 10 per company).</li>';
        html += '<li>Confirm <strong>Local</strong> or <strong>Cloud</strong> mode (page colours match the mode).</li>';
        html += '<li><strong>Cloud:</strong> open RPN → <strong>Retrieve RPN</strong> from the practice API.</li>';
        html += '<li><strong>Run Payroll</strong> → Calculate Preview → Commit. Roll back if needed before submit.</li>';
        html += '<li><strong>Cloud:</strong> Submission tab → Generate Submission → Submit to Revenue (practice API).</li>';
        html += '<li>Save a copy when needed: footer <strong>File backup</strong> (Local) or <strong>Cloud sync / Neon</strong> (multi-device).</li>';
        html += '</ol></section>';

        html += '<section class="help-section"><h3>Companies</h3>';
        html += '<p>Three fixed slots: typically Local practice, Cloud practice, and Live Payroll. Click a <strong>name</strong> to open the workspace. <strong>Edit</strong> changes company details. <strong>Load Sandbox Ltd</strong> / <strong>Load Cloud Sandbox</strong> replace that slot with sample employees.</p>';
        html += '<p><strong>Colours:</strong> cream frames = Local mode; blue frames = Cloud mode. The same warm/cool palette appears after you open a company.</p></section>';

        html += '<section class="help-section"><h3>Local vs Cloud mode</h3>';
        html += '<p><strong>Local</strong> — manual tax credits and cut-off points. RPN and Submission tabs are hidden. Prefer <strong>File backup</strong> in the footer.</p>';
        html += '<p><strong>Cloud</strong> — practice RPN + payroll submission against the hosted fake Revenue API on this site (<code>/api/rpn</code>, <code>/api/psr</code>). Prefer <strong>Cloud sync (Neon)</strong> for multi-device. Optional API tester: <a href="/tools/fake-revenue/">/tools/fake-revenue/</a>.</p>';
        html += '<p>For local development only: <code>npm run revenue:start</code> (port 3001) when testing RPN against localhost.</p></section>';

        html += '<section class="help-section"><h3>Employees</h3>';
        html += '<p>Add and edit staff: name, PPS, pay type, frequency, PRSI class, and tax settings. Use <strong>Show Employee List</strong> for a printable summary. In Cloud mode, RPN fields are shown on the card after retrieve; BIK/pension may still be editable.</p></section>';

        html += '<section class="help-section"><h3>Tax Credits &amp; COP</h3>';
        html += '<p>Overview of annual tax credits and cut-off points. Local mode uses your ledgers/manual values; Cloud mode reflects RPN-driven credits after retrieve and payroll. Sort columns and click a row to open that employee.</p></section>';

        html += '<section class="help-section"><h3>RPN <span class="help-badge">Cloud</span></h3>';
        html += '<p>Revenue Payroll Notification fields for practice. Click <strong>Retrieve RPN</strong> to call the live practice API (same server as <code>/api/rpn</code>). PPSN profiles on the fake server can return standard/high/low COP or an error (e.g. PPSN ending in 0). RPN is practice only — not real ROS.</p>';
        html += '<p>Used tax credits after payroll are tracked in the <strong>app ledger</strong>, not on the fake Revenue server. Each retrieve regenerates a full RPN profile; it does not store your cumulative used credits.</p></section>';

        html += '<section class="help-section"><h3>Run Payroll</h3>';
        html += '<p>Enter hours or confirm salaried pay, <strong>Calculate Preview</strong>, then <strong>commit</strong>. You can roll back the last commit before the period is submitted. Day-to-day figures stay in this browser until you export or push to cloud.</p>';
        html += '<p><strong>Test period mode</strong> jumps to any payday in the year without running every period — see Week 53 below.</p></section>';

        html += '<section class="help-section"><h3>How to test Week 53</h3>';
        html += '<p>Week 53 applies when there are <strong>53 weekly paydays</strong> in a calendar year (e.g. Thursday pay in 2026). The 53rd payday uses extra TC/COP on a forced Week 1 basis.</p>';
        html += '<ol class="help-steps">';
        html += '<li>Use a company pay day that yields 53 paydays (Thursday in 2026).</li>';
        html += '<li>Run Payroll → enable <strong>Test period mode</strong>.</li>';
        html += '<li>Jump with <strong>First</strong>, <strong>Last</strong>, <strong>Week 53</strong>, the period dropdown, or Pay Date.</li>';
        html += '<li><strong>Calculate Preview</strong> — expect Week 53 banner and tax treatment for weekly/fortnightly staff.</li>';
        html += '</ol>';
        html += '<p class="help-note">Mid-year pay-day change (e.g. Friday → Thursday) normally blocks manufactured Week 53. Test period mode can bypass that for preview only.</p>';
        html += '<p class="help-note">Test period mode is session-only (clears when you close the tab).</p></section>';

        html += '<section class="help-section"><h3>Submission <span class="help-badge">Cloud</span></h3>';
        html += '<p>After commit: <strong>Generate Submission</strong>, then <strong>Submit to Revenue</strong> posts a practice PSR to <code>/api/psr</code>. Accepted responses update local submission records and advance the period. Not a real Revenue filing.</p></section>';

        html += '<section class="help-section"><h3>History</h3>';
        html += '<p>Past runs for the company. Expand for detail, export CSV/Excel, open payslips, or delete a run (with confirm).</p></section>';

        html += '<section class="help-section"><h3>Save &amp; restore (footer)</h3>';
        html += '<p>Two panels (same colours as Local / Cloud):</p>';
        html += '<ul class="help-steps">';
        html += '<li><strong>File backup</strong> — Export/Import a JSON file of <em>all</em> company slots in this browser. Recommended in Local mode.</li>';
        html += '<li><strong>Cloud sync (Neon)</strong> — Create/paste a workspace key, then <strong>Push</strong> (browser → Neon) or <strong>Pull</strong> (Neon → browser). Recommended in Cloud mode for multi-device. Not the same as RPN.</li>';
        html += '</ul>';
        html += '<p>In Cloud mode, file buttons are off unless you enable the override. In Local mode, cloud buttons are off unless you enable that override. Neon stores one full snapshot JSON per workspace key (not separate employee tables).</p>';
        html += '<p class="help-note">Running payroll alone does not update Neon — you must click <strong>Push to cloud</strong>.</p></section>';

        html += '<section class="help-section"><h3>Site links</h3>';
        html += '<p>Top-right and footer: <strong>Take Home Pay</strong>, <strong>Bulk Calculator</strong>, <strong>Free Payroll Software</strong>, <strong>Pensions</strong>, <strong>Support</strong>. Help (this page) is also in the Free Payroll Software header.</p></section>';

        html += '<section class="help-section help-contact-section" id="help-contact-section">';
        html += '<h3>Contact &amp; feedback</h3>';
        html += '<p>Bug reports and suggestions welcome. Do not include real PPS numbers or payroll data. You can also use <a href="/contact.html?from=payroll">Support</a> on the site.</p>';
        html += '<form id="help-contact-form" class="help-contact-form" name="contact" method="POST" data-netlify="true" netlify netlify-honeypot="bot-field" action="/contact-success.html">';
        html += '<input type="hidden" name="form-name" value="contact" />';
        html += '<input type="hidden" name="source-page" value="payroll" />';
        html += '<input type="hidden" name="tool" value="Free Payroll Software" />';
        html += '<p class="help-contact-honeypot" aria-hidden="true">';
        html += '<label>Don\'t fill this out: <input name="bot-field" tabindex="-1" autocomplete="off" /></label>';
        html += '</p>';
        html += '<div class="help-contact-field">';
        html += '<label for="help-contact-name">Your name</label>';
        html += '<input type="text" id="help-contact-name" name="name" required maxlength="120" autocomplete="name" />';
        html += '</div>';
        html += '<div class="help-contact-field">';
        html += '<label for="help-contact-email">Your email <span class="help-contact-optional">(optional, for a reply)</span></label>';
        html += '<input type="email" id="help-contact-email" name="email" maxlength="200" autocomplete="email" />';
        html += '</div>';
        html += '<div class="help-contact-field">';
        html += '<label for="help-contact-subject">Subject</label>';
        html += '<input type="text" id="help-contact-subject" name="subject" required maxlength="200" value="Free Payroll Software feedback" />';
        html += '</div>';
        html += '<div class="help-contact-field">';
        html += '<label for="help-contact-message">Message</label>';
        html += '<textarea id="help-contact-message" name="message" required rows="5" maxlength="4000" placeholder="What were you doing? What happened? What did you expect?"></textarea>';
        html += '</div>';
        html += '<div class="help-contact-actions">';
        html += '<button type="submit" class="btn btn-primary">Send message</button>';
        html += '</div>';
        html += '<p id="help-contact-status" class="help-contact-status" hidden></p>';
        html += '</form>';
        html += '</section>';

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
                if (typeof PayrollApp !== 'undefined' && PayrollApp.setDataStorageSectionVisible) {
                    PayrollApp.setDataStorageSectionVisible(true);
                }
            });
        }

        bindContactForm();
    }

    return {
        init: init,
        renderHelp: renderHelp,
        openContactForm: openContactForm
    };
})();
