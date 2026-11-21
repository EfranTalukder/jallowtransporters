// ─────────────────────────────────────────────────────────────────────────────
// Website adverts — set in the admin app (page "Website adverts"). When someone opens the website, the current
// adverts pop up: the photo, a button to the page the team picked, and × to close. The database only sends
// adverts whose days have come and whose expiry date hasn't passed (UK time), so an expired advert never shows.
// Once per visit; an advert someone closed stays away for a day. Not on invoices or tracking links.
// ─────────────────────────────────────────────────────────────────────────────
(() => {
  const SUPABASE_URL = 'https://efzmisktbzjjpwzfloka.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_uBiVOnVTOGhE-nZBM4P7ig_YtnbWHVw';
  const PHOTOS = `${SUPABASE_URL}/storage/v1/object/public/advert-photos/`;
  const CLOSED_FOR = 24 * 60 * 60 * 1000;
  const OWN_PAGE = /^\/([^/\\\s<>"'][^\s<>"'\\]*)?$/;

  const norm = (p) => (p.replace(/\.html$/, '').replace(/\/+$/, '') || '/');
  const here = norm(location.pathname);
  const params = new URLSearchParams(location.search);
  if (here === '/invoice' || here === '/track' || params.get('tab') === 'track' || params.has('ref') || params.has('k')) return;

  const store = (kind) => { try { return window[kind]; } catch (_) { return null; } };
  const ss = store('sessionStorage');
  const ls = store('localStorage');
  const get = (s, k) => { try { return s ? s.getItem(k) : null; } catch (_) { return null; } };
  const put = (s, k, v) => { try { if (s) s.setItem(k, v); } catch (_) { /* private mode */ } };
  if (get(ss, 'jt_ad_seen')) return;
  const closed = (() => { try { return JSON.parse(get(ls, 'jt_ad_closed') || '{}') || {}; } catch (_) { return {}; } })();
  const now = Date.now();
  for (const id of Object.keys(closed)) if (!(now - closed[id] < CLOSED_FOR)) delete closed[id];

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ARROW = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
  const CROSS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
  const CHEV = (d) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  const CSS = `
  .jt-ad { position: fixed; inset: 0; z-index: 9990; display: flex; align-items: center; justify-content: center;
    padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); }
  .jt-ad-backdrop { position: absolute; inset: 0; opacity: 0; transition: opacity 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    background: radial-gradient(circle at 20% 15%, rgba(0, 161, 92, 0.22), transparent 55%), rgba(4, 16, 46, 0.66);
    -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
  .jt-ad.open .jt-ad-backdrop { opacity: 1; }
  .jt-ad-card { position: relative; width: min(420px, 100%); max-width: 100%; background: #FFFFFF; border-radius: 18px; overflow: hidden;
    box-shadow: 0 40px 90px -30px rgba(4, 16, 46, 0.75), 0 18px 40px -18px rgba(0, 161, 92, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.06);
    opacity: 0; transform: translateY(28px) scale(0.94);
    transition: transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
  .jt-ad.open .jt-ad-card { opacity: 1; transform: none; }
  .jt-ad.closing .jt-ad-card { opacity: 0; transform: translateY(16px) scale(0.97); transition-duration: 0.22s; }
  .jt-ad.closing .jt-ad-backdrop { opacity: 0; transition-duration: 0.22s; }
  .jt-ad-slides { position: relative; background: #0A1E4A; touch-action: pan-y; }
  .jt-ad-slide { display: none; }
  .jt-ad-slide.on { display: block; animation: jt-ad-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes jt-ad-in { from { opacity: 0; } to { opacity: 1; } }
  .jt-ad-media { display: block; overflow: hidden; outline: none; }
  .jt-ad-media img { display: block; width: 100%; height: auto; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1); -webkit-user-drag: none; user-select: none; }
  .jt-ad-media:hover img { transform: scale(1.025); }
  .jt-ad-media:focus-visible { box-shadow: inset 0 0 0 3px #22C77E; }
  .jt-ad-close { position: absolute; top: 10px; right: 10px; z-index: 3; width: 40px; height: 40px; border-radius: 999px; border: 0; cursor: pointer;
    display: flex; align-items: center; justify-content: center; color: #0A1E4A; background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 6px 18px -6px rgba(4, 16, 46, 0.55), 0 0 0 1px rgba(10, 30, 74, 0.06);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease; }
  .jt-ad-close:hover { transform: scale(1.08); background: #FFFFFF; }
  .jt-ad-close:active { transform: scale(0.94); }
  .jt-ad-close:focus-visible { outline: 3px solid #22C77E; outline-offset: 2px; }
  .jt-ad-nav { width: 34px; height: 34px; flex-shrink: 0; border-radius: 999px; border: 1px solid #E3E7EE; cursor: pointer;
    display: flex; align-items: center; justify-content: center; color: #0A1E4A; background: #FFFFFF;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease, border-color 0.2s ease; }
  .jt-ad-nav:hover { transform: scale(1.08); background: #F2F5FB; border-color: #C9D1DF; }
  .jt-ad-nav:active { transform: scale(0.94); }
  .jt-ad-nav:focus-visible { outline: 3px solid #22C77E; outline-offset: 2px; }
  .jt-ad-foot { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
  .jt-ad-pager { display: flex; align-items: center; justify-content: center; gap: 14px; }
  .jt-ad-dots { display: flex; justify-content: center; gap: 7px; }
  .jt-ad-card:focus { outline: none; }
  .jt-ad-card.side { display: flex; align-items: stretch; }
  .jt-ad-card.side .jt-ad-slides { flex: 1 1 auto; min-width: 0; }
  .jt-ad-card.side .jt-ad-foot { flex: 0 0 210px; justify-content: center; padding: 14px; }  .jt-ad-dot { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 999px; background: #D9DEE8; cursor: pointer;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.2s ease; }
  .jt-ad-dot:hover { transform: scale(1.25); }
  .jt-ad-dot.on { background: #00A15C; transform: scale(1.25); }
  .jt-ad-dot:focus-visible { outline: 2px solid #00A15C; outline-offset: 3px; }
  .jt-ad-btn { display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%; min-height: 50px; padding: 0.8rem 1.25rem;
    border-radius: 0.6rem; background: #00A15C; color: #FFFFFF; text-decoration: none; text-align: center; line-height: 1.25;
    font-family: 'Manrope', system-ui, sans-serif; font-weight: 700; font-size: 0.98rem; letter-spacing: 0.01em;
    box-shadow: 0 6px 18px -6px rgba(0, 161, 92, 0.6);
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.25s ease; }
  .jt-ad-btn:hover { background: #007A46; transform: translateY(-2px); box-shadow: 0 12px 26px -8px rgba(0, 161, 92, 0.6); }
  .jt-ad-btn:active { background: #065C37; transform: translateY(1px) scale(0.985); }
  .jt-ad-btn:focus-visible { outline: 3px solid #00A15C; outline-offset: 3px; }
  .jt-ad-btn svg { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); flex-shrink: 0; }
  .jt-ad-btn:hover svg { transform: translateX(4px); }
  @media (prefers-reduced-motion: reduce) {
    .jt-ad-card, .jt-ad-backdrop, .jt-ad-media img { transition-duration: 0.01s !important; }
    .jt-ad-card { transform: none !important; }
    .jt-ad-slide.on { animation: none; }
  }`;

  /** The page an advert opens, or null when it isn't one of ours (or is the page they're already on). */
  function target(link) {
    if (typeof link !== 'string' || !OWN_PAGE.test(link)) return null;
    const u = new URL(link, location.origin);
    if (u.origin !== location.origin) return null;
    if (norm(u.pathname) === here && !u.hash) return null;
    return u.pathname + u.search + u.hash;
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // Not while someone is typing in a form, reading the WhatsApp chat or using the phone menu.
  const busy = () => {
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true;
    return !!document.querySelector('.wa-popup.open, .mobile-menu.open, [role="dialog"].open:not(.jt-ad), body.panel-open');
  };

  function show(ads) {
    if (!document.getElementById('jt-ad-css')) {
      const st = document.createElement('style');
      st.id = 'jt-ad-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    put(ss, 'jt_ad_seen', '1');
    const many = ads.length > 1;
    const root = document.createElement('div');
    root.className = 'jt-ad';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', many ? 'Our offers' : ads[0].title || 'Our offer');
    root.innerHTML = `
      <div class="jt-ad-backdrop" data-close></div>
      <div class="jt-ad-card" tabindex="-1">
        <button type="button" class="jt-ad-close" data-close aria-label="Close">${CROSS}</button>
        <div class="jt-ad-slides">
          ${ads.map((a, i) => `<div class="jt-ad-slide${i ? '' : ' on'}" data-i="${i}">
            <a class="jt-ad-media" href="${esc(a.href)}" data-go="${i}"><img src="${esc(a.img.src)}" alt="${esc(a.title)}" width="${a.img.naturalWidth}" height="${a.img.naturalHeight}" draggable="false"></a>
          </div>`).join('')}
        </div>
        <div class="jt-ad-foot">
          ${many ? `<div class="jt-ad-pager">
            <button type="button" class="jt-ad-nav prev" data-step="-1" aria-label="Previous offer">${CHEV('M15 18l-6-6 6-6')}</button>
            <div class="jt-ad-dots">${ads.map((a, i) => `<button type="button" class="jt-ad-dot${i ? '' : ' on'}" data-dot="${i}" aria-label="Offer ${i + 1} of ${ads.length}"></button>`).join('')}</div>
            <button type="button" class="jt-ad-nav next" data-step="1" aria-label="Next offer">${CHEV('M9 18l6-6-6-6')}</button>
          </div>` : ''}
          <a class="jt-ad-btn" href="${esc(ads[0].href)}" data-go="btn"><span>${esc(ads[0].button)}</span>${ARROW}</a>
        </div>
      </div>`;
    document.body.appendChild(root);

    const card = root.querySelector('.jt-ad-card');
    const btn = root.querySelector('.jt-ad-btn');
    const foot = root.querySelector('.jt-ad-foot');
    let cur = 0;

    // The card fits the screen: as wide as the photo allows without being taller than the screen.
    // A phone held sideways (short, wide screen): the button goes beside the photo instead of under it.
    const SIDE_FOOT = 210;
    const fit = () => {
      const a = ads[cur];
      const ratio = a.img.naturalWidth / a.img.naturalHeight;
      const W = window.innerWidth - 32, H = window.innerHeight - 32;
      const side = H < 500 && W > H * 1.3;
      card.classList.toggle('side', side);
      if (side) {
        const imgW = Math.min(H * ratio, W - SIDE_FOOT, ratio > 1.15 ? 560 : 420);
        card.style.width = `${Math.floor(imgW + SIDE_FOOT)}px`;
        return;
      }
      const maxW = ratio > 1.15 ? 680 : 480;
      const w = Math.min(maxW, W, (H - foot.offsetHeight) * ratio);
      card.style.width = `${Math.floor(Math.max(160, w))}px`;
    };
    const go = (i) => {
      cur = (i + ads.length) % ads.length;
      root.querySelectorAll('.jt-ad-slide').forEach((s, n) => s.classList.toggle('on', n === cur));
      root.querySelectorAll('.jt-ad-dot').forEach((d, n) => { d.classList.toggle('on', n === cur); d.setAttribute('aria-current', n === cur ? 'true' : 'false'); });
      btn.href = ads[cur].href;
      btn.querySelector('span').textContent = ads[cur].button;
      fit();
    };

    const prevFocus = document.activeElement;
    const html = document.documentElement;
    const before = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    let done = false;
    const finish = (how) => {
      if (done) return;
      done = true;
      if (how === 'closed') {
        ads.forEach((a) => { closed[a.id] = Date.now(); });
        put(ls, 'jt_ad_closed', JSON.stringify(closed));
      }
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', fit);
      html.style.overflow = before.html;
      document.body.style.overflow = before.body;
      root.classList.add('closing');
      root.classList.remove('open');
      setTimeout(() => root.remove(), 260);
      if (how === 'closed' && prevFocus && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch (_) { /* ignore */ } }
    };

    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish('closed'); return; }
      if (many && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !/^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName || '')) { go(cur + (e.key === 'ArrowRight' ? 1 : -1)); return; }
      if (e.key === 'Tab') {   // keep the keyboard inside the advert
        const f = [...root.querySelectorAll('button, a[href]')].filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        const a = document.activeElement;
        if (!root.contains(a) || a === card) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
        else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', fit);

    root.addEventListener('click', (e) => {
      const t = e.target.closest('[data-close], [data-step], [data-dot], [data-go]');
      if (!t) return;
      if (t.hasAttribute('data-close')) { e.preventDefault(); finish('closed'); }
      else if (t.hasAttribute('data-step')) go(cur + Number(t.getAttribute('data-step')));
      else if (t.hasAttribute('data-dot')) go(Number(t.getAttribute('data-dot')));
      else if (t.hasAttribute('data-go')) {
        if (swiped) { e.preventDefault(); return; }
        finish('opened');   // the link itself takes them to the page
      }
    });

    // Swipe between offers on phones.
    let sx = null, sy = 0, swiped = false;
    const slides = root.querySelector('.jt-ad-slides');
    slides.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; swiped = false; });
    slides.addEventListener('pointerup', (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (many && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) { swiped = true; go(cur + (dx < 0 ? 1 : -1)); setTimeout(() => { swiped = false; }, 60); }
    });

    fit();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.add('open');
      try { card.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    }));
  }

  async function start() {
    let list;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_adverts`, {
        method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!res.ok) return;
      list = await res.json();
    } catch (_) { return; }
    if (!Array.isArray(list)) return;
    const wanted = list
      .filter((a) => a && a.id && typeof a.photo === 'string' && /^adverts\/[A-Za-z0-9._-]+$/.test(a.photo) && !closed[a.id])
      .map((a) => ({ id: String(a.id), title: String(a.title || ''), href: target(a.link), button: String(a.button || 'Find out more'), photo: a.photo }))
      .filter((a) => a.href);
    if (!wanted.length) return;
    // Only adverts whose photo loads; shown together once the page has settled.
    const imgs = await Promise.all(wanted.map((a) => loadImage(PHOTOS + a.photo.split('/').map(encodeURIComponent).join('/'))));
    const ads = wanted.map((a, i) => ({ ...a, img: imgs[i] })).filter((a) => a.img);
    if (!ads.length) return;
    let tries = 0;
    const attempt = () => {
      if (get(ss, 'jt_ad_seen')) return;
      if (busy()) { if (++tries < 15) setTimeout(attempt, 2000); return; }
      show(ads);
    };
    setTimeout(attempt, 1400);
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
