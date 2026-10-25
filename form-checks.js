// Form checks shared by the booking page and the shop: a clear message under the
// box that needs fixing, the same rules the server uses, and plain words (plus a
// WhatsApp way out) when the connection fails.
(function () {
  'use strict';
  const WHATSAPP = '447831005961';

  // Same as the server (private.norm_phone): first number only, digits only,
  // 00… drops the 00, 07… / 7… (UK mobile) becomes 44…; it needs 7–15 digits.
  function normPhone(v) {
    let d = String(v || '').replace(/[,;|]/g, '/').split('/')[0].replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    else if (d.length === 11 && d.startsWith('07')) d = '44' + d.slice(1);
    else if (d.length === 10 && d.startsWith('7')) d = '44' + d;
    return d;
  }
  const letterCount = (v) => (String(v).match(/\p{L}/gu) || []).length;
  const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;
  const compact = (v) => String(v || '').trim().toUpperCase().replace(/\s+/g, '');

  // Each check returns '' when fine, otherwise the message to show.
  const checks = {
    name(v, { required = true, what = 'your full name' } = {}) {
      v = String(v || '').trim();
      if (!v) return required ? `Please enter ${what}.` : '';
      if (/\d/.test(v)) return 'A name can’t have numbers in it — please check it.';
      if (letterCount(v) < 2) return `Please enter ${what}, e.g. Fatou Jallow.`;
      return '';
    },
    phone(v, { required = true } = {}) {
      v = String(v || '').trim();
      if (!v) return required ? 'Please enter a phone number we can WhatsApp or call.' : '';
      if (/\p{L}/u.test(v)) return 'A phone number can only have numbers, spaces and + — no letters.';
      const n = normPhone(v).length;
      if (n < 7) return 'This number looks too short. Please enter the full number, e.g. 07400 123456 or +220 771 2345.';
      if (n > 15) return 'This number looks too long. Please enter just one phone number.';
      return '';
    },
    email(v) {
      v = String(v || '').trim();
      if (!v) return '';
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'This email doesn’t look right. It should look like name@example.com.';
    },
    town(v, { required = true, what = 'your town or city' } = {}) {
      v = String(v || '').trim();
      if (!v) return required ? `Please enter ${what}.` : '';
      if (letterCount(v) < 2) return `Please enter ${what} in words, e.g. Birmingham.`;
      return '';
    },
    address(v, { required = true } = {}) {
      v = String(v || '').trim();
      if (!v) return required ? 'Please enter your address (house number and street).' : '';
      if (v.length < 4 || letterCount(v) < 2) return 'Please enter the full address — house number and street name.';
      return '';
    },
    ukPostcode(v, { required = true } = {}) {
      const s = compact(v);
      if (!s) return required ? 'Please enter your postcode, e.g. B12 0HF.' : '';
      return UK_POSTCODE.test(s) ? '' : 'That doesn’t look like a UK postcode. It should look like B12 0HF.';
    },
  };

  // "b120hf" → "B12 0HF" (left as typed if it isn't a UK postcode).
  function formatPostcode(v) {
    const s = compact(v);
    return UK_POSTCODE.test(s) ? `${s.slice(0, -3)} ${s.slice(-3)}` : String(v || '').trim().toUpperCase();
  }

  // Show (or clear) the message under a box and colour the box red.
  function setError(el, msg) {
    if (typeof el === 'string') el = document.getElementById(el);
    if (!el) return !msg;
    let p = el.parentElement.querySelector(':scope > .form-error');
    if (!p) {
      p = document.createElement('p');
      p.className = 'form-error';
      el.insertAdjacentElement('afterend', p);
    }
    if (!p.id) p.id = `${el.id}-msg`;
    if (msg) p.textContent = msg;
    el.classList.toggle('error', !!msg);
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    el.setAttribute('aria-describedby', p.id);
    return !msg;
  }

  // fetch() itself failing (offline, blocked, server unreachable) → words people understand.
  async function send(url, init, what) {
    try {
      return await fetch(url, init);
    } catch (_) {
      const e = new Error(`We couldn’t reach our ${what} system. Please check your internet connection and try again. If it still doesn’t work, send it to us on WhatsApp and we’ll do it for you.`);
      e.network = true;
      throw e;
    }
  }

  const waLink = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

  // A message appearing under a box moves the buttons below it. If that happens between
  // pressing and releasing the mouse on "Continue", the click is lost — so while a press
  // is going on, the check waits until just after the click.
  let pressing = false;
  let queued = [];
  addEventListener('pointerdown', () => { pressing = true; }, true);
  const release = () => {
    pressing = false;
    const run = queued;
    queued = [];
    if (run.length) setTimeout(() => run.forEach((fn) => fn()), 0);
  };
  addEventListener('pointerup', release, true);
  addEventListener('pointercancel', release, true);
  const afterPress = (fn) => { if (pressing) queued.push(fn); else fn(); };

  window.JTForm = { checks, normPhone, formatPostcode, setError, send, waLink, afterPress };
})();
