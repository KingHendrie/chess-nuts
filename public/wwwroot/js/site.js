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
