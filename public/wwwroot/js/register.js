document.addEventListener('DOMContentLoaded', () => {
    const passwordEl = document.getElementById('password');
    const confirmPasswordEl = document.getElementById('confirmPassword');
    const formEl = document.getElementById('registerForm');

    if (passwordEl && confirmPasswordEl) {
        passwordEl.addEventListener('blur', validatePasswords);
        confirmPasswordEl.addEventListener('blur', validatePasswords);
    }

    if (formEl) {
        formEl.addEventListener('submit', (e) => {
            e.preventDefault();
            registerUser();
        });
    }
});

function validatePasswords() {
    const password = document.getElementById('password')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';

    if (password !== '' && confirmPassword !== '' && password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
    }
}

async function registerUser() {
    const firstName = document.getElementById('firstName')?.value || '';
    const lastName = document.getElementById('lastName')?.value || '';
    const email = document.getElementById('email')?.value || '';
    const password = document.getElementById('password')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';

    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    try {
        const response = await fetch('/api/user/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, password })
        });

        let result = {};
        try {
            result = await response.json();
        } catch (err) {
            throw new Error('Unexpected server response');
        }

        if (response.ok && result.success) {
            showToast('Registration successful!', 'success');
            setTimeout(() => { window.location.href = '/login'; }, 700);
        } else {
            showToast(result.error || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast(error.message || 'Registration failed', 'error');
    }
}