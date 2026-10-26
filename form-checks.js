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
  // Every number is sent with its country code (+44 7400 123456), so the team's WhatsApp
  // button opens the right chat. UK numbers can be typed the usual way (07400 123456); a
  // number from anywhere else needs its code — and when the number itself shows which
  // country it is from, the message offers it ready to use. Uses libphonenumber
  // (/vendor/libphonenumber-max.js); if that didn't load, only the old length rules apply.
  const LIKELY = ['GB', 'GM', 'SN', 'GN', 'SL', 'ML', 'GW', 'MR', 'MA', 'BD'];
  const lib = () => window.libphonenumber;
  const firstNumber = (v) => String(v || '').replace(/[,;|]/g, '/').split('/')[0].trim();
  const hasCode = (v) => /^\s*\(?\s*(\+|00)/.test(v);   // "+220…", "00220…", "(+44) …"
  const parse = (v, country) => {
    try { return lib().parsePhoneNumberFromString(hasCode(v) ? v.trim().replace(/^\(?\s*00/, '+') : v, country); } catch (_) { return undefined; }
  };
  const isMobile = (p) => !!p && p.isValid() && ['MOBILE', 'FIXED_LINE_OR_MOBILE'].includes(p.getType());
  let names;
  function countryName(code) {
    try { names = names || new Intl.DisplayNames(['en'], { type: 'region' }); return code === 'GB' ? 'UK' : names.of(code); } catch (_) { return code; }
  }
  // "Guinea (Conakry)" / "United Kingdom" → "GN" / "GB" (for routes); '' when unknown.
  function countryCode(name) {
    const want = String(name || '').replace(/\(.*\)/, '').trim().toLowerCase();
    if (!want || !lib()) return '';
    if (want === 'uk' || want === 'united kingdom') return 'GB';
    try {
      names = names || new Intl.DisplayNames(['en'], { type: 'region' });
      return lib().getCountries().find((c) => names.of(c).toLowerCase() === want) || '';
    } catch (_) { return ''; }
  }
  // Countries a number written without its code could be from, most likely first.
  function phoneCountries(v, hints = []) {
    if (!lib() || hasCode(v)) return [];
    const order = [...new Set([...hints.filter(Boolean), ...LIKELY])];
    return order.filter((c) => c !== 'GB' && isMobile(parse(v, c)));
  }
  // Without a code, only what a UK customer gives us counts as UK: a mobile, or a landline
  // written with its 0 (a US "201 555 0123" is also a valid London number otherwise).
  const isUkNumber = (p, typed) => !!p && p.isValid() && (p.getType() === 'MOBILE' || (p.getType() === 'FIXED_LINE' && /^\D*0/.test(typed)));
  // The number as written, when we can tell for sure: with its code, or a UK number.
  // ("220 771 2345" without the + could also be a US number, so that one gets asked about.)
  function readNumber(one) {
    if (hasCode(one)) { const p = parse(one); return p && p.isValid() ? p : undefined; }
    const uk = parse(one, 'GB');
    return isUkNumber(uk, one) ? uk : undefined;
  }
  // "+44 7400 123456" — or the number as typed when it can't be read.
  function toIntl(v) {
    const p = lib() && readNumber(firstNumber(v));
    return p ? p.formatInternational() : String(v || '').trim();
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
    // When we can offer the corrected number, the message is a String with .fixes
    // ([{ label, value }]) and setError shows them as buttons.
    phone(v, { required = true, hints = [] } = {}) {
      v = String(v || '').trim();
      if (!v) return required ? 'Please enter a phone number we can WhatsApp or call.' : '';
      if (/\p{L}/u.test(v)) return 'A phone number can only have numbers, spaces and + — no letters.';
      const n = normPhone(v).length;
      if (n < 7) return 'This number looks too short. Please enter the full number, e.g. 07400 123456 or +220 771 2345.';
      if (n > 15) return 'This number looks too long. Please enter just one phone number.';
      if (!lib()) return '';
      const one = firstNumber(v);
      if (readNumber(one)) return '';
      if (hasCode(one)) {
        const p = parse(one);
        return p && p.country
          ? `This doesn’t look like a ${countryName(p.country)} number (+${p.countryCallingCode}). Please check it.`
          : 'Please check the country code at the start — it should look like +220 771 2345.';
      }
      const fits = phoneCountries(one, hints).slice(0, 3);
      if (!fits.length) {
        return /^0?7/.test(one.replace(/\D/g, ''))
          ? 'This doesn’t look like a UK mobile number — it should have 11 digits, like 07400 123456. If it’s from another country, add its code at the start, e.g. +220.'
          : 'Please add your country code at the start, e.g. +220 771 2345 for Gambia or +44 7400 123456 for the UK.';
      }
      const fixes = fits.map((c) => {
        const value = parse(one, c).formatInternational();
        return { label: fits.length === 1 ? `Use ${value}` : `${countryName(c)}: ${value}`, value };
      });
      const typedTheCode = fits.length === 1 && parse(one, fits[0]).number.slice(1) === one.replace(/\D/g, '');
      const msg = typedTheCode ? 'Please put a + in front of your country code.'
        : fits.length === 1 ? `Please add your country code at the start. Is this a ${countryName(fits[0])} number?`
        : 'Please add your country code at the start. Which one is it?';
      return Object.assign(new String(msg), { fixes });
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
    if (msg) {
      p.textContent = msg;
      // e.g. "Use +880 1718-074878": one tap puts the number right.
      for (const fix of msg.fixes || []) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'form-fix';
        b.textContent = fix.label;
        b.addEventListener('click', () => {
          el.value = fix.value;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          setError(el, '');
          el.focus();
        });
        p.append(' ', b);
      }
    }
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

  // Tracking: the number as typed, as +44…, and with the likely country code — bookings
  // saved before country codes were asked for still match the number as typed.
  function phoneVariants(v, hints = []) {
    const one = firstNumber(v);
    const all = [String(v || '').trim(), toIntl(v), ...phoneCountries(one, hints).slice(0, 2).map((c) => parse(one, c).formatInternational())];
    const seen = new Set();
    return all.filter((x) => x && !seen.has(normPhone(x)) && seen.add(normPhone(x)));
  }

  window.JTForm = { checks, normPhone, formatPostcode, setError, send, waLink, afterPress, toIntl, countryCode, phoneVariants };
})();
