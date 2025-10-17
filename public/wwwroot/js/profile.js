async function populateProfile() {
	try {
		const res = await fetch('/api/user/profile');
		if (!res.ok) throw new Error('Could not fetch user info');
		const user = await res.json();
		document.getElementById('profileFirstName').value = user.firstName || '';
		document.getElementById('profileLastName').value = user.lastName || '';
		document.getElementById('profileEmail').value = user.email || '';
		render2FAStatus(user.two_factor_enabled);
	} catch (error) {
		showToast('Unable to load profile.', 'error');
	}
}

function render2FAStatus(twoFAEnabled) {
	const statusDiv = document.getElementById('2fa-status');
	statusDiv.innerHTML = '';
	if (twoFAEnabled) {
		statusDiv.innerHTML = `
			<p>2FA is <strong>enabled</strong> on your account.</p>
			<button type="button" class="btn" id="disable2FA">Disable 2FA</button>
		`;
	} else {
		statusDiv.innerHTML = `
			<p>2FA is currently <strong>disabled</strong> on your account.</p>
			<button type="button" class="btn" id="enable2FA">Enable 2FA</button>
		`;
	}

	document.getElementById('enable2FA')?.addEventListener('click', enable2FA);
	document.getElementById('disable2FA')?.addEventListener('click', disable2FA);
}

document.getElementById('profileInfoForm').addEventListener('submit', async function(e) {
	e.preventDefault();

	const data = {
		firstName: this.firstName.value.trim(),
		lastName: this.lastName.value.trim()
	};

	try {
		const res = await fetch('/api/user/profile', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});
		const json = await res.json();
		if(json.success) {
			showToast('Profile updated!', 'success');
		} else {
			showToast(json.error || 'Could not update profile.', 'error');
		}
	} catch (error) {
		showToast('Could not update profile.', 'error');
	}
});

function showPasswordCodeModal(newPassword) {
	const modal = document.getElementById('password2FAModal');
	modal.classList.remove('d-none');
	document.body.style.overflow = 'hidden';
	document.getElementById('password2FACode').value = '';
	document.getElementById('password2FA-error').classList.add('d-none');
	modal.dataset.newPassword = newPassword;
}

function hidePasswordCodeModal() {
	document.getElementById('password2FAModal').classList.add('d-none');
	document.body.style.overflow = '';
}

document.getElementById('closePassword2FAModal').onclick =
document.getElementById('cancelPassword2FA').onclick = hidePasswordCodeModal;
document.querySelector('#password2FAModal .modal-backdrop').onclick = hidePasswordCodeModal;
document.addEventListener('keydown', function(e) {
    if (!document.getElementById('password2FAModal').classList.contains('d-none') && e.key === 'Escape') hidePasswordCodeModal();
});

document.getElementById('password2FAForm').addEventListener('submit', async function(e) {
	e.preventDefault();
	document.getElementById('password2FALoading').classList.remove('d-none');
	document.getElementById('password2FA-error').classList.add('d-none');

	const code = document.getElementById('password2FACode').value.trim();
	const newPassword = document.getElementById('password2FAModal').dataset.newPassword;

	try {
		const res = await fetch('/api/user/profile/password', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ code, newPassword })
	});

	const json = await res.json();
	document.getElementById('password2FALoading').classList.add('d-none');
	if(json.success) {
		showToast('Password updated!', 'success');
		document.getElementById('profilePasswordForm').reset();
		hidePasswordCodeModal();
	} else {
		document.getElementById('password2FA-error').textContent = json.error || 'Could not change password.';
		document.getElementById('password2FA-error').classList.remove('d-none');
		showToast(json.error || 'Could not change password.', 'error');
	}
	} catch (error) {
		document.getElementById('password2FALoading').classList.add('d-none');
		document.getElementById('password2FA-error').textContent = 'Could not change password.';
		document.getElementById('password2FA-error').classList.remove('d-none');
		showToast('Could not change password.', 'error');
	}
});

document.getElementById('profilePasswordForm').addEventListener('submit', async function(e) {
	e.preventDefault();

	const newPassword = this.newPassword.value;
	const confirmNewPassword = this.confirmNewPassword.value;

	if (newPassword !== confirmNewPassword) {
		showToast('New passwords do not match.', 'error');
		return;
	}

	try {
		const reqRes = await fetch('/api/user/profile/password/request', { method: 'POST' });
		const reqJson = await reqRes.json();
		if(!reqJson.success) {
			showToast(reqJson.error || 'Could not start password reset. ' + reqJson.error, 'error');
			return;
		}
		showToast('Check your email for the verification code.', 'info');
		showPasswordCodeModal(newPassword);
	} catch (error) {
		showToast('Could not start password reset. - ' + error.stack, 'error');
	}
});

async function verifyPasswordChange(code, newPassword) {
	try {
		const res = await fetch('/api/user/profile/password', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ code, newPassword })
		});
		const json = await res.json();
		if(json.success) {
			showToast('Password updated!', 'success');
			document.getElementById('profilePasswordForm').reset();
			hidePasswordCodeModal();
		} else {
			showToast(json.error || 'Could not change password.', 'error');
		}
	} catch (error) {
		showToast('Could not change password.', 'error');
	}
}

async function enable2FA() {
	try {
		const res = await fetch('/api/user/profile/2fa', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled: true })
		});
		const json = await res.json();
		if(json.success) {
			showToast('2FA enabled! (Further setup may be required)', 'success');
			render2FAStatus(true);
		} else {
			showToast(json.error || 'Could not enable 2FA.', 'error');
		}
	} catch (error) {
		showToast('Could not enable 2FA.', 'error');
	}
}

async function disable2FA() {
	try {
		const res = await fetch('/api/user/profile/2fa', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled: false })
		});
		const json = await res.json();
		if(json.success) {
			showToast('2FA disabled.', 'success');
			render2FAStatus(false);
		} else {
			showToast(json.error || 'Could not disable 2FA.', 'error');
		}
	} catch (error) {
		showToast('Could not disable 2FA.', 'error');
	}
}

async function signOut() {
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

document.addEventListener('DOMContentLoaded', populateProfile);