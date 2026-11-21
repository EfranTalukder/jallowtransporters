// ─────────────────────────────────────────────────────────────────────────────
// Runs on every page (before adverts.js).
//
// 1. window.JTSaved — "My shipments": the references this phone booked, ordered or saved (JT-, MG-, INV-),
//    with the phone number they were booked with when this phone knows it. Kept on the phone only:
//    localStorage, and inside the phone app also the app's own storage (Capacitor Preferences), so the
//    list survives the phone clearing website data. Shown on /track (book.html).
//
// 2. Only inside the Jallow Transporters phone app (the "JT customer app" repo, Capacitor): a menu bar at
//    the bottom (Home, Book, Track, Shop), room for the phone's status bar and home bar, white status-bar
//    text over the navy top bar, and the floating buttons moved above the menu. The normal website is
//    unchanged.
// ─────────────────────────────────────────────────────────────────────────────
(() => {
  const KEY = 'jt_my_shipments';
  const MAX = 20;
  const cap = window.Capacitor;
  const inApp = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  const hasNative = (name) => inApp && Array.isArray(cap.PluginHeaders) && cap.PluginHeaders.some((h) => h && h.name === name);
  const native = (plugin, method, opts) => (hasNative(plugin) && typeof cap.nativePromise === 'function'
    ? Promise.resolve().then(() => cap.nativePromise(plugin, method, opts || {}))
    : Promise.reject(new Error('not available')));

  // ─────────────────────────── My shipments ───────────────────────────
  const ls = (() => { try { return window.localStorage; } catch (_) { return null; } })();
  const norm = (r) => String(r == null ? '' : r).trim().toUpperCase();
  const valid = (r) => /^(JT|MG|INV)-[A-Z0-9]{6}$/.test(r);
  const clean = (v) => (Array.isArray(v) ? v : [])
    .filter((x) => x && valid(norm(x.ref)))
    .map((x) => ({ ref: norm(x.ref), phone: x.phone ? String(x.phone).slice(0, 32) : null, at: Number(x.at) || 0 }));
  const parse = (s) => { try { return clean(JSON.parse(s || '[]')); } catch (_) { return []; } };
  // Newest first, one entry per reference (keeping a phone number if either copy has one).
  function merge(...lists) {
    const by = new Map();
    for (const x of lists.flat()) {
      const had = by.get(x.ref);
      by.set(x.ref, had ? { ref: x.ref, phone: had.phone || x.phone, at: Math.max(had.at, x.at) } : { ...x });
    }
    return [...by.values()].sort((a, b) => b.at - a.at).slice(0, MAX);
  }
  const read = () => parse(ls && (() => { try { return ls.getItem(KEY); } catch (_) { return null; } })());
  function write(list) {
    const s = JSON.stringify(merge(list));
    try { if (ls) ls.setItem(KEY, s); } catch (_) { /* private mode */ }
    native('Preferences', 'set', { key: KEY, value: s }).catch(() => {});
  }
  const listeners = new Set();
  const emit = () => { const l = read(); listeners.forEach((fn) => { try { fn(l); } catch (_) { /* a page bug must not break the rest */ } }); };

  // This phone's own last booking and shop order count as saved (they were stored before My shipments existed).
  function legacy() {
    const out = [];
    for (const k of ['jt_last_booking', 'jt_gems_last']) {
      try {
        const v = JSON.parse((ls && ls.getItem(k)) || 'null');
        if (v && valid(norm(v.ref))) out.push({ ref: norm(v.ref), phone: v.phone ? String(v.phone) : null, at: 1 });
      } catch (_) { /* ignore */ }
    }
    return out;
  }

  const ready = (async () => {
    let fromApp = [];
    try { const r = await native('Preferences', 'get', { key: KEY }); fromApp = parse(r && r.value); } catch (_) { /* not in the app */ }
    let imported = false;
    try { imported = !!(ls && ls.getItem('jt_my_imported')); } catch (_) { /* ignore */ }
    const list = merge(read(), fromApp, imported ? [] : legacy());
    write(list);
    try { if (ls) ls.setItem('jt_my_imported', '1'); } catch (_) { /* ignore */ }
    return list;
  })();

  window.JTSaved = {
    inApp,
    ready,
    list: read,
    has: (ref) => read().some((x) => x.ref === norm(ref)),
    valid: (ref) => valid(norm(ref)),
    add(ref, phone) {
      ref = norm(ref);
      if (!valid(ref)) return false;
      const list = read();
      const had = list.find((x) => x.ref === ref);
      if (had) { if (phone && !had.phone) had.phone = String(phone).slice(0, 32); }
      else list.unshift({ ref, phone: phone ? String(phone).slice(0, 32) : null, at: Date.now() });
      write(list); emit();
      return true;
    },
    // Put back exactly as it was (Undo after removing).
    restore(item) { if (item && valid(norm(item.ref))) { write([...read(), clean([item])[0]]); emit(); } },
    remove(ref) {
      ref = norm(ref);
      const list = read();
      const gone = list.find((x) => x.ref === ref) || null;
      if (gone) { write(list.filter((x) => x.ref !== ref)); emit(); }
      return gone;
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };

  if (!inApp) return;

  // ─────────────────────────── Phone app only ───────────────────────────
  const root = document.documentElement;
  root.classList.add('jt-app');
  // Let the page run edge to edge so env(safe-area-inset-*) is filled in; the CSS below keeps clear of the
  // status bar, the notch and the home bar.
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp && !/viewport-fit/.test(vp.content)) vp.content += ', viewport-fit=cover';
  native('SystemBars', 'setStyle', { style: 'DARK' }).catch(() => {});   // white status-bar text on the navy top

  const css = `
  :root.jt-app {
    --jt-st: max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px));
    --jt-sb: max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px));
    --jt-bar: 60px;
  }
  .jt-app body { padding-top: var(--jt-st); padding-bottom: calc(var(--jt-bar) + var(--jt-sb)); }
  .jt-app .nav-bar { top: var(--jt-st); }
  .jt-status { position: fixed; top: 0; left: 0; right: 0; height: var(--jt-st); background: #0A1E4A; z-index: 9996; pointer-events: none; }
  .jt-app .mobile-menu { padding-top: calc(1.5rem + var(--jt-st)); padding-bottom: calc(var(--jt-bar) + var(--jt-sb)); }
  /* The bottom menu already has Home, Book, Track and Shop, so the ☰ menu keeps the other pages. */
  .jt-app #mobile-menu .gap-6 > a[href="/"], .jt-app #mobile-menu .gap-6 > a[href="/book.html"],
  .jt-app #mobile-menu .gap-6 > a[href="/track"], .jt-app #mobile-menu .gap-6 > a[href="/shop.html"] { display: none; }
  .jt-app .wa-btn { bottom: calc(var(--jt-bar) + var(--jt-sb) + 14px); }
  .jt-app .mobile-menu.open ~ .wa-btn, .jt-app .mobile-menu.open ~ .wa-popup { visibility: hidden; }
  .jt-app .wa-popup { bottom: calc(var(--jt-bar) + var(--jt-sb) + 86px); }
  .jt-app .float-cart { bottom: calc(var(--jt-bar) + var(--jt-sb) + 14px); }
  .jt-app .cart-panel, .jt-app .p-dialog { z-index: 9300; }
  .jt-app .cart-panel { top: var(--jt-st); padding-bottom: var(--jt-sb); }
  .jt-app .p-dialog { max-height: calc(100vh - var(--jt-st) - var(--jt-sb) - 2rem); }
  .jt-tabbar {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 9200;
    height: calc(var(--jt-bar) + var(--jt-sb)); padding: 0 6px var(--jt-sb);
    display: grid; grid-template-columns: repeat(4, 1fr);
    background: rgba(255, 255, 255, 0.97); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
    border-top: 1px solid #ECE6DC;
    box-shadow: 0 -1px 2px rgba(10, 30, 74, 0.04), 0 -10px 28px -14px rgba(10, 30, 74, 0.16);
    font-family: 'Manrope', system-ui, sans-serif;
  }
  .jt-tab {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
    color: #6B7280; text-decoration: none; font-size: 11px; font-weight: 700; letter-spacing: 0.01em;
    -webkit-tap-highlight-color: transparent; border-radius: 12px; margin: 5px 2px;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease;
  }
  .jt-tab svg { width: 23px; height: 23px; }
  .jt-tab[aria-current="page"] { color: #00A15C; }
  .jt-tab[aria-current="page"] .jt-tab-ico { background: #E4F4EC; }
  .jt-tab-ico { display: flex; align-items: center; justify-content: center; width: 52px; height: 28px; border-radius: 999px; }
  .jt-tab:hover { opacity: 0.85; }
  .jt-tab:active { transform: scale(0.92); }
  .jt-tab:focus-visible { outline: 2px solid #00A15C; outline-offset: -2px; }
  `;
  const ICO = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    book: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    track: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    shop: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  };
  const TABS = [
    ['home', 'Home', '/'],
    ['book', 'Book', '/book.html'],
    ['track', 'Track', '/track'],
    ['shop', 'Shop', '/shop.html'],
  ];
  const where = () => {
    const p = location.pathname.replace(/\.html$/, '').replace(/\/+$/, '') || '/';
    const tab = new URLSearchParams(location.search).get('tab');
    if (p === '/' || p === '/index') return 'home';
    if (p === '/track' || (p === '/book' && tab === 'track')) return 'track';
    if (p === '/book') return 'book';
    if (p === '/shop') return 'shop';
    return '';
  };

  function mount() {
    if (document.querySelector('.jt-tabbar')) return;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const status = document.createElement('div');
    status.className = 'jt-status';
    const bar = document.createElement('nav');
    bar.className = 'jt-tabbar';
    bar.setAttribute('aria-label', 'App menu');
    bar.innerHTML = TABS.map(([k, label, href]) => `
      <a class="jt-tab" href="${href}" data-tab="${k}">
        <span class="jt-tab-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg></span>
        <span>${label}</span>
      </a>`).join('');
    document.body.append(status, bar);
    mark();
  }
  function mark() {
    const now = where();
    document.querySelectorAll('.jt-tab').forEach((a) => {
      if (a.dataset.tab === now) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  // book.html switches between Book / Departures / Track without reloading: keep the bar in step.
  for (const fn of ['pushState', 'replaceState']) {
    const orig = history[fn];
    history[fn] = function (...args) { const r = orig.apply(this, args); try { mark(); } catch (_) { /* ignore */ } return r; };
  }
  window.addEventListener('popstate', mark);
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
