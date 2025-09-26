function showLoading(show = true) {
	const overlay = document.getElementById('loadingOverlay');
	if (overlay) overlay.classList.toggle('d-none', !show);
}

function show2FAModal(email) {
	showLoading(true);
	Modal.setupFormModal({
		modalId: 'twoFAModal',
		title: 'Two-Factor Authentication',
		submitText: 'Verify',
		fields: { twoFACode: '' },
		errorDivId: 'twoFA-error'
	});
	Modal.open('twoFAModal', (modal) => {
		const input = modal.querySelector('#twoFACode');
		if (input) input.focus();
	});
	showLoading(false);
}

function hide2FAModal() {
	Modal.close('twoFAModal');
}

Modal.bind('twoFAModal', { closeOnBackdrop: true, closeOnEscape: true });

async function loginUser() {
	showLoading(true);
	const email = document.getElementById('email').value;
	const password = document.getElementById('password').value;

	const response = await fetch('/api/user/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});

	const result = await response.json();
	showLoading(false);

	if (result.success) {
		showToast('Login successful!', 'success');
		window.location.href = '/profile';
	} else if (result.twoFA) {
		showToast('Two-factor authentication required. Check your email.', 'info');
		show2FAModal(email);
	} else {
		showToast(result.error, 'error');
	}
}

Modal.bindFormSubmit('twoFAForm', (form) => {
	return {
		url: '/api/2fa/verify-2fa',
		method: 'POST',
		data: { code: form.twoFACode.value }
	};
}, (result) => {
	if (result.success) {
		showToast('2FA verified. Login complete.', 'success');
		hide2FAModal();
		window.location.href = '/profile';
	} else {
		const errorDiv = document.getElementById('twoFA-error');
		errorDiv.textContent = result.error || '2FA verification failed.';
		errorDiv.style.display = '';
		showToast(result.error || '2FA verification failed.', 'error');
	}
}, 'twoFA-error');

async function singOut() {
	const response = await fetch('/api/user/logout', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' }
	});
	const result = await response.json();
	if (result.success) {
		showToast('Logged out successfully', 'success');
		window.location.href = '/login';
	} else {
		showToast(result.error, 'error');
	}
}