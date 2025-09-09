(function() {
    function groupFormFields() {
        document.querySelectorAll('.modal .input-form').forEach(form => {
            if (form.dataset.grouped === "true") return;
            const kids = Array.from(form.children);
            let i = 0;
            while (i < kids.length) {
                const label = kids[i];
                const next = kids[i+1];

                if (label && label.tagName === 'LABEL' && next && /^(INPUT|TEXTARE|SELECT)$/.test(next.tagName)) {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'form-group';
                    form.insertBefore(wrapper, label);
                    wrapper.appendChild(label);
                    wrapper.appendChild(next);
                    i += 2;
                } else {
                    i++;
                }
            }
            form.dataset.grouped = "true";
        });
    }

    function setFormColumns() {
        document.querySelectorAll('.modal .input-form').forEach(form => {
            const groups = form.querySelectorAll('.form-group').length;
            form.classList.remove('two-cols', 'three-cols');
            if (groups > 8) form.classList.add('three-cols');
            else if (groups > 4) form.classList.add('two-cols');
        });
    }

    function prepareModalForms() {
        groupFormFields();
        setFormColumns();
    }

    const Modal = {
        open(id, onOpen) {
            const modal = document.getElementById(id);
            if (!modal) return;
            prepareModalForms();
            modal.classList.remove('d-none');
            document.body.style.overflow = 'hidden';
            if (typeof onOpen === 'function') onOpen(modal);
            const firstInput = modal.querySelector('input:not([type="hidden"]), textarea, select');
            if (firstInput) firstInput.focus();
        },
        close(id, onClose) {
            const modal = document.getElementById(id);
            if (!modal) return;
            modal.classList.add('d-none');
            document.body.style.overflow = '';
            if (typeof onClose === 'function') onClose(modal);
            const form = modal.querySelector('form');
            if (form) form.reset();
            modal.querySelectorAll('.alert, [id*="error"]').forEach(div => div.style.display = 'none');
        },
        bind(id, opts = {}) {
            const modal = document.getElementById(id);
            if (!modal) return;
            const closeBtn = modal.querySelector('.modal-close');
            const backdrop = modal.querySelector('.modal-backdrop');
            const cancelBtn = modal.querySelector('.btn[id^="cancel"], .btn.cancel');
            if (closeBtn) closeBtn.addEventListener('click', () => Modal.close(id, opts.onClose));
            if (backdrop && opts.closeOnBackdrop !== false) backdrop.addEventListener('click', () => Modal.close(id, opts.onClose));
            if (cancelBtn) cancelBtn.addEventListener('click', () => Modal.close(id, opts.onClose));
            document.addEventListener('keydown', function (e) {
                if (modal.classList.contains('d-none')) return;
                if (e.key === 'Escape' && opts.closeOnEscape !== false) Modal.close(id, opts.onClose);
            });
        },
        bindOpen(id, selector, onOpen) {
            document.querySelectorAll(selector).forEach(btn => {
                btn.addEventListener('click', e => {
                    e.preventDefault();
                    Modal.open(id, onOpen);
                });
            });
        },
        setupFormModal({modalId, title, submitText, fields = {}, errorDivId, resetForm = true}) {
            const modal = document.getElementById(modalId);
            if (!modal) return;
            if (title) {
                const titleElem = modal.querySelector('#modalTitle');
                if (titleElem) titleElem.textContent = title;
            }
            if (submitText) {
                const submitBtn = modal.querySelector('#modalSubmitBtn');
                if (submitBtn) submitBtn.textContent = submitText;
            }
            const form = modal.querySelector('form');
            if (form && resetForm) form.reset();
            if (fields && form) {
                Object.entries(fields).forEach(([k, v]) => {
                    const input = form.elements[k];
                    if (input) input.value = v;
                });
            }
            if (errorDivId) {
                const err = document.getElementById(errorDivId);
                if (err) err.style.display = 'none';
            }
        },
        toast(message, type = 'info') {
            if (typeof showToast === "function") showToast(message, type);
        },
        bindFormSubmit(formId, getSubmitOptions, onSuccess, errorDivId) {
            const form = document.getElementById(formId);
            if (!form) return;
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                const { url, method, data } = getSubmitOptions(form);
                const errorDiv = errorDivId ? document.getElementById(errorDivId) : null;
                if (errorDiv) errorDiv.style.display = 'none';
                try {
                    const res = await fetch(url, {
                        method,
                        headers: { 'Conent-Type': 'application/jsoon' },
                        body: JSON.stringify(data)
                    });
                    const json = await res.json();
                    if (res.ok && (json.success || json.id)) {
                        if (typeof onSuccess === 'function') onSuccess(json);
                        Modal.toast('Action successful!', 'success');
                    } else {
                        if (errorDiv) {
                            errorDiv.textContent = json.error || 'An error occurred.';
                            errorDiv.style.display = '';
                        }
                        Modal.toast(json.error || 'An error occurred.', 'error');
                    }
                } catch (err) {
                    if (errorDiv) {
                        errorDiv.textContent = 'An error occurred.';
                        errorDiv.style.display = '';
                    }
                    Modal.toast('An error occurred.', 'error');
                }
            });
        }
    };

    window.Modal = Modal;

    document.addEventListener('DOMContentLoaded', prepareModalForms);
})();