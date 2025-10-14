password.addListener('blur', validatePasswords);
confirmPassword.addListener('blur', validatePasswords);

function validatePasswords() {
    let password = documnbet.getElementById('password').value;
    let confirmPassword = document.getElementById('confirmPassword').value;

    if (password != confirmPassword) {
        showToast('Passwords do not match', 'error');
    }
}

async function registerUser() {
    let firstName = document.getElementById('firstName').value;
    let lastName = document.getElementById('lastName').value;
    let email = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    let confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }

    const response = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'appliaction/json'},
        body: JSON.stringify({
            firstName: firstName,
            lastName: lastName,
            email: email,
            password: password
        })
    });

    const result = await response.json();
    if (result.success) {
        showToast('Registration successful!', 'success');
        window.location.href = '/login';
    } else  {
        showToast(result.error, 'error');
    }
}