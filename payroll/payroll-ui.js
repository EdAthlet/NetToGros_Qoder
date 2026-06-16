// payroll/payroll-ui.js — Toast messages and confirm modals

var PayrollUI = (function() {
    'use strict';

    function showMessage(text, type) {
        const existing = document.querySelector('.payroll-message');
        if (existing) existing.remove();

        const msg = document.createElement('div');
        msg.className = 'payroll-message ' + (type === 'error' ? 'error-message' : 'success-message');
        msg.textContent = text;

        const main = document.querySelector('.payroll-main');
        if (main) {
            main.insertBefore(msg, main.firstChild);
        } else {
            document.body.appendChild(msg);
        }

        setTimeout(function() {
            if (msg.parentNode) msg.parentNode.removeChild(msg);
        }, 4000);
    }

    function showConfirmModal(message, onConfirm, options) {
        options = options || {};
        var title = options.title || 'Confirm';
        var confirmLabel = options.confirmLabel || 'Confirm';
        var cancelLabel = options.cancelLabel || 'Cancel';
        var variant = options.variant || 'primary';

        var modal = document.getElementById('payroll-confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'payroll-confirm-modal';
            modal.className = 'modal-overlay';
            modal.innerHTML =
                '<div class="modal-content modal-dialog" role="dialog" aria-modal="true" aria-labelledby="payroll-modal-title">' +
                    '<div class="modal-accent"></div>' +
                    '<div class="modal-header">' +
                        '<div class="modal-header-main">' +
                            '<span class="modal-icon" aria-hidden="true"></span>' +
                            '<h3 id="payroll-modal-title" class="modal-title">Confirm</h3>' +
                        '</div>' +
                        '<button type="button" class="modal-close-btn" id="modal-close-btn" aria-label="Close">&times;</button>' +
                    '</div>' +
                    '<div class="modal-body"><p class="modal-message"></p></div>' +
                    '<div class="modal-footer">' +
                        '<button type="button" class="btn btn-modal-cancel" id="modal-cancel-btn">Cancel</button>' +
                        '<button type="button" class="btn btn-modal-confirm" id="modal-confirm-btn">Confirm</button>' +
                    '</div>' +
                '</div>';
            document.body.appendChild(modal);

            modal.addEventListener('click', function(event) {
                if (event.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }

        var confirmVariantClass = variant === 'danger' ? 'btn-danger' : (variant === 'warning' ? 'btn-warning' : 'btn-primary');
        modal.querySelector('.modal-title').textContent = title;
        modal.querySelector('.modal-message').textContent = message;
        modal.querySelector('.modal-icon').textContent = variant === 'danger' ? '!' : (variant === 'warning' ? '!' : '?');
        modal.classList.remove('modal-variant-primary', 'modal-variant-danger', 'modal-variant-warning');
        modal.classList.add('modal-variant-' + variant);

        var confirmBtn = modal.querySelector('#modal-confirm-btn');
        var cancelBtn = modal.querySelector('#modal-cancel-btn');
        var closeBtn = modal.querySelector('#modal-close-btn');

        confirmBtn.textContent = confirmLabel;
        confirmBtn.className = 'btn btn-modal-confirm ' + confirmVariantClass;
        cancelBtn.textContent = cancelLabel;

        var newConfirm = confirmBtn.cloneNode(true);
        var newCancel = cancelBtn.cloneNode(true);
        var newClose = closeBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);

        function closeModal() {
            modal.classList.remove('active');
        }

        newConfirm.addEventListener('click', function() {
            closeModal();
            if (typeof onConfirm === 'function') onConfirm();
        });
        newCancel.addEventListener('click', closeModal);
        newClose.addEventListener('click', closeModal);

        modal.classList.add('active');
    }

    return {
        showMessage: showMessage,
        showConfirmModal: showConfirmModal
    };
})();