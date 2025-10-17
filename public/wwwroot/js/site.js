// Burger menu toggle for fullscreen mobile navbar
document.addEventListener('DOMContentLoaded', function () {
	const burger = document.getElementById('navbar-burger');
	const mobileNav = document.getElementById('mobile-navbar');
	const desktopNav = document.getElementById('navbar-links');

	if (burger && mobileNav) {
		burger.addEventListener('click', function () {
			burger.classList.toggle('active');
			mobileNav.classList.toggle('active');
			burger.setAttribute('aria-expanded', burger.classList.contains('active'));
		});

		// Hide mobile nav when a link is clicked
		mobileNav.querySelectorAll('a').forEach(link => {
			link.addEventListener('click', function () {
				burger.classList.remove('active');
				mobileNav.classList.remove('active');
				burger.setAttribute('aria-expanded', 'false');
			});
		});

		// Hide mobile nav when close button is clicked
		const closeBtn = document.getElementById('mobile-navbar-close');
		if (closeBtn) {
			closeBtn.addEventListener('click', function () {
				burger.classList.remove('active');
				mobileNav.classList.remove('active');
				burger.setAttribute('aria-expanded', 'false');
			});
		}
	}

	// Hide mobile nav if resizing to desktop
	window.addEventListener('resize', function () {
		if (window.innerWidth > 600) {
			burger.classList.remove('active');
			if (mobileNav) mobileNav.classList.remove('active');
			burger.setAttribute('aria-expanded', 'false');
		}
	});
});

function showAlert() {
	showToast('Hello from the frontend!', 'info');
}

function addPasswordToggles() {
	const eyeSVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" 
		stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/>
		<circle cx="12" cy="12" r="3"/></svg>`;
	const eyeOffSVG = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" 
		stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
		<path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a21.86 21.86 0 0 1 5.06-5.94"/>
		<path d="M1 1l22 22"/>
		<path d="M9.53 9.53a3.5 3.5 0 0 0 4.95 4.95"/>
		<path d="M12 5a7 7 0 0 1 7 7c0 1.1-.22 2.15-.61 3.09"/>
		</svg>`;

	document.querySelectorAll('input[type="password"]').forEach(function(input) {
		if (input.parentElement.classList.contains('password-toggle-wrapper')) return;

		const wrapper = document.createElement('div');
		wrapper.style.position = 'relative';
		wrapper.className = 'password-toggle-wrapper';
		input.parentNode.insertBefore(wrapper, input);
		wrapper.appendChild(input);

		input.style.paddingRight = '36px';

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.setAttribute('aria-label', 'Show password');
		btn.className = 'password-toggle-btn';
		btn.innerHTML = eyeSVG;

		btn.style.position = 'absolute';
		btn.style.top = '50%';
		btn.style.right = '8px';
		btn.style.transform = 'translateY(-50%)';
		btn.style.background = 'none';
		btn.style.border = 'none';
		btn.style.padding = '0';
		btn.style.margin = '0';
		btn.style.cursor = 'pointer';
		btn.style.color = 'var(--color-accent)';
		btn.style.display = 'flex';
		btn.style.alignItems = 'center';

		btn.addEventListener('click', function() {
			if (input.type === 'password') {
			input.type = 'text';
			btn.innerHTML = eyeOffSVG;
			btn.setAttribute('aria-label', 'Hide password');
			} else {
			input.type = 'password';
			btn.innerHTML = eyeSVG;
			btn.setAttribute('aria-label', 'Show password');
			}
		});

	wrapper.appendChild(btn);
	});
}

document.addEventListener('DOMContentLoaded', addPasswordToggles);