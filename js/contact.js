/**
 * contact.js — Contact form submission.
 * Saves the message through window.api (js/api.js or
 * js/api.supabase.js — same interface either way) and swaps
 * the form out for a confirmation state.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('contactForm');
  const successEl = document.getElementById('contactSuccess');
  if (!form) return;

  if (window.api?.auth?.ready) await api.auth.ready;

  // Prefill name/email if the visitor is signed in.
  const user = window.api ? api.auth.currentUser() : null;
  if (user) {
    form.querySelector('[name="name"]').value = user.fullName || '';
    form.querySelector('[name="email"]').value = user.email || '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name    = form.querySelector('[name="name"]').value.trim();
    const email   = form.querySelector('[name="email"]').value.trim();
    const subject = form.querySelector('[name="subject"]').value.trim();
    const message = form.querySelector('[name="message"]').value.trim();

    if (!name || !email || !message) {
      Toast?.error('Missing information', 'Please fill in your name, email, and message.');
      return;
    }

    const submitBtn = form.querySelector('.contact-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    try {
      if (!window.api) throw new Error('Backend not available.');
      const { ok, error } = await api.contact.send({ name, email, subject, message });
      if (!ok) throw new Error(error || 'Could not send your message.');

      Toast?.success('Message sent!', "We'll get back to you within 1–2 business days.");
      form.classList.add('hidden');
      successEl?.classList.add('show');
    } catch (err) {
      console.error(err);
      Toast?.error('Could not send message', err.message || 'Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
    }
  });
});
