(function () {
  'use strict';

  function send(name, parameters) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', name, parameters || {});
    }
  }

  function safeLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (link) {
      try {
        var destination = new URL(link.href, window.location.href);
        if (destination.origin === window.location.origin) {
          send('site_navigation', {
            destination_path: destination.pathname,
            link_text: safeLabel(link.textContent),
            page_path: window.location.pathname
          });
        }
      } catch (_) {
        // Ignore malformed links.
      }
    }

    var tab = event.target.closest('[data-tab]');
    if (tab) {
      send('tool_tab_view', {
        tab_name: safeLabel(tab.dataset.tab),
        page_path: window.location.pathname
      });
    }

    var action = event.target.closest(
      '.calculate-button, #calculateBtn, #calculate-btn, [data-analytics-action]'
    );
    if (action) {
      send('calculator_use', {
        action_name: safeLabel(action.dataset.analyticsAction || 'calculate'),
        page_path: window.location.pathname
      });
      return;
    }

    var button = event.target.closest('button');
    var label = button && safeLabel(button.textContent).toLowerCase();
    if (label && /^(calculate|generate practice|check answers)/.test(label)) {
      send('calculator_use', {
        action_name: label.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40),
        page_path: window.location.pathname
      });
    }
  });

  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function () {
      sessionStorage.setItem('ntg_contact_pending', '1');
      send('contact_form_submit', { page_path: window.location.pathname });
    });
  }

  if (window.location.pathname === '/contact-success.html' &&
      sessionStorage.getItem('ntg_contact_pending') === '1') {
    sessionStorage.removeItem('ntg_contact_pending');
    send('contact_form_complete', { page_path: window.location.pathname });
  }
})();
