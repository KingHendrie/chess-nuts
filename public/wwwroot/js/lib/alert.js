function ensureAlertModal() {
    if (!document.getElementById('modal-alert')) {
        const div = document.createElement('div');
        div.id = 'modal-alert';
        document.body.appendChild(div);
    }
}

function alertModal(message, options = {}) {
    return new Promise(resolve => {
        ensureAlertModal();
        const modal = document.getElementById('modal-alert');
        modal.innerHTML = `
            <div class="alert-modal-overlay">
                <div class="alert-modal-content">
                    <div class="alert-modal-message">${message}</div>
                    <div class="alert-modal-actions">
                        <button class="alert-modal-btn alert-modal-ok">${options.okText || "OK"}</button>
                    </div>
                </div>
            </div>
        `;
        modal.style.display = 'block';
        document.body.classList.add('alert-modal-open');
        modal.querySelector('.alert-modal-ok').onclick = () => {
            modal.style.display = 'none';
            document.body.classList.remove('alert-modal-open');
            resolve();
        };
    });
}

function confirmModal(message, options = {}) {
    return new Promise(resolve => {
        ensureAlertModal();
        const modal = document.getElementById('modal-alert');
        modal.innerHTML = `
            <div class="alert-modal-overlay">
                <div class="alert-modal-content">
                    <div class="alert-modal-message">${message}</div>
                    <div class="alert-modal-actions">
                        <button class="alert-modal-btn alert-modal-cancel">${options.cancelText || "Cancel"}</button>
                        <button class="alert-modal-btn alert-modal-ok">${options.okText || "OK"}</button>
                    </div>
                </div>
            </div>
        `;
        modal.style.display = 'block';
        document.body.classList.add('alert-modal-open');
        modal.querySelector('.alert-modal-ok').onclick = () => {
            modal.style.display = 'none';
            document.body.classList.remove('alert-modal-open');
            resolve(true);
        };
        modal.querySelector('.alert-modal-cancel').onclick = () => {
            modal.style.display = 'none';
            document.body.classList.remove('alert-modal-open');
            resolve(false);
        };
    });
}