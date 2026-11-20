// Tidewell: small enhancements only. The page works without JavaScript too.

// Mobile menu
const toggle = document.querySelector('.nav-toggle');
const nav = document.getElementById('site-nav');
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!open));
  nav.classList.toggle('open', !open);
});
nav.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    toggle.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  }
});

// Header border once you scroll
const header = document.querySelector('.site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Contact form: send to Formspree without leaving the page
const form = document.querySelector('.contact-form');
const statusEl = form.querySelector('.form-status');
const CONTACT_EMAIL = 'rachellafave1211@gmail.com';

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  statusEl.className = 'form-status';

  // Simple validation with friendly messages
  let firstInvalid = null;
  form.querySelectorAll('input[required], input[type="url"], input[type="email"]').forEach((el) => {
    const bad = !el.checkValidity();
    el.setAttribute('aria-invalid', bad ? 'true' : 'false');
    if (bad && !firstInvalid) firstInvalid = el;
  });
  if (firstInvalid) {
    statusEl.textContent = 'Please fill in your name, a valid email and your property location. Listing links should start with https://';
    statusEl.classList.add('error');
    firstInvalid.focus();
    return;
  }

  if (form.action.includes('YOUR_FORM_ID')) {
    statusEl.innerHTML = `The form isn't connected yet. Please email <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.`;
    statusEl.classList.add('error');
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Sending…';

  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      // Show Formspree's own reason (e.g. form not confirmed yet) when it gives one
      const data = await res.json().catch(() => ({}));
      const reason = (data.errors || []).map((err) => err.message).filter(Boolean).join(' ');
      throw new Error(reason || 'Request failed');
    }
    form.reset();
    form.classList.add('sent');
    statusEl.textContent = "Thank you! We'll review your listing and reply within one business day.";
    statusEl.classList.add('success');
  } catch (err) {
    const detail = err.message && err.message !== 'Request failed' && err.message !== 'Failed to fetch' ? ` (${err.message})` : '';
    statusEl.textContent = `Something went wrong${detail}. Please try again or email `;
    const link = document.createElement('a');
    link.href = `mailto:${CONTACT_EMAIL}`;
    link.textContent = CONTACT_EMAIL;
    statusEl.append(link, '.');
    statusEl.classList.add('error');
    button.disabled = false;
    button.textContent = 'Request my free review';
  }
});
