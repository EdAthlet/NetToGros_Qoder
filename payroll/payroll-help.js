// payroll/payroll-help.js — Help tab content

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

        form.addEventListener('submit', function(e) {
            e.preventDefault();
            setContactFormStatus('', 'info');

            if (isLocalDev()) {
                setContactFormStatus(
                    'Feedback form is active on the live Netlify site. Deploy to test, or email us from the address shown after you submit on production.',
                    'info'
                );
                return;
            }

            var submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(new FormData(form)).toString()
            })
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error('Submit failed');
                    }
                    form.reset();
                    setContactFormStatus('Thank you — your message was sent. We will reply if you left your email address.', 'success');
                })
                .catch(function() {
                    setContactFormStatus('Sorry, the message could not be sent. Please try again later.', 'error');
                })
                .finally(function() {
                    if (submitBtn) submitBtn.disabled = false;
                });
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

        html += '<section class="help-section help-contact-section" id="help-contact-section">';
        html += '<h3>Contact &amp; feedback</h3>';
        html += '<p>Found a bug, have a suggestion, or need help with the payroll app? Send us a message. Do not include real employee PPS numbers or payroll data in your message. The same form is used across the <a href="/contact.html?from=payroll">calculator</a>, <a href="/contact.html?from=batch">batch tool</a>, and payroll app.</p>';
        html += '<form id="help-contact-form" class="help-contact-form" name="contact" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="/">';
        html += '<input type="hidden" name="form-name" value="contact" />';
        html += '<input type="hidden" name="source-page" value="payroll" />';
        html += '<input type="hidden" name="tool" value="payroll" />';
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
        html += '<input type="text" id="help-contact-subject" name="subject" required maxlength="200" value="Payroll app feedback" />';
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