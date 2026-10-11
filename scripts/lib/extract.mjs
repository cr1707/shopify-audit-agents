// In-page extraction scripts (run inside the browser with Page.eval). They return plain JSON only.

// Installed before any page script runs: records when overlays (pop-ups, banners, drawers) become visible.
export const OVERLAY_WATCH = `(() => {
  if (window.__saaOverlays) return;
  window.__saaOverlays = []; const t0 = performance.now(); const seen = new WeakSet();
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const check = () => {
    if (!document.body) return;
    const W = innerWidth, H = innerHeight;
    for (const el of document.body.querySelectorAll('*')) {
      if (seen.has(el)) continue;
      const s = getComputedStyle(el);
      const isDialog = el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true' || el.tagName === 'DIALOG';
      if (s.position !== 'fixed' && !isDialog) continue;
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.1) continue;
      const r = el.getBoundingClientRect();
      const area = Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
      const share = area / (W * H);
      const txt = norm(el.innerText);
      if (share < 0.04 || txt.length < 3) continue;
      if (!isDialog && r.top <= 5 && r.height < 160 && share < 0.25) continue; // header or announcement bar, not a pop-up
      // keep the outermost overlay only
      let p = el.parentElement, inner = false; while (p && p !== document.body) { if (seen.has(p)) { inner = true; break; } p = p.parentElement; }
      seen.add(el); if (inner) continue;
      window.__saaOverlays.push({ atMs: Math.round(performance.now() - t0), share: +share.toFixed(2), top: Math.round(r.top), height: Math.round(r.height),
        role: el.getAttribute('role') || el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 80), id: el.id || null, text: txt.slice(0, 300),
        buttons: [...el.querySelectorAll('button,a,[role=button],input[type=submit]')].map((b) => norm(b.innerText || b.value || b.getAttribute('aria-label'))).filter(Boolean).slice(0, 8) });
    }
  };
  const iv = setInterval(check, 500); setTimeout(() => clearInterval(iv), 60000);
})()`;

export const OVERLAYS_NOW = `(window.__saaOverlays || [])`;

// Scrolls the whole page in steps so lazy content loads; returns height in screens.
export const AUTOSCROLL = `(async () => {
  const H = innerHeight; let y = 0; let last = -1;
  for (let i = 0; i < 80; i++) {
    y += Math.round(H * 0.85); scrollTo(0, y); await new Promise((r) => setTimeout(r, 220));
    const ph = document.documentElement.scrollHeight;
    if (y + H >= ph) { if (last === ph) break; last = ph; }
  }
  await new Promise((r) => setTimeout(r, 500)); scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400));
  return { height: document.documentElement.scrollHeight, screens: +(document.documentElement.scrollHeight / H).toFixed(1) };
})()`;

// The main page read: SEO tags, headings, CTAs, key-element positions, images, links, forms and layout.
export const READ_PAGE = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  // Phone emulation zooms out to fit wide content, so measure against the device screen, not innerWidth.
  const W = Math.min(innerWidth, window.screen.width || innerWidth), H = innerHeight;
  const vis = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let x = e; x && x !== document.documentElement; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) return false; } return true; };
  const docY = (e) => Math.round(e.getBoundingClientRect().top + scrollY);
  const screen = (e) => +(docY(e) / H + 1).toFixed(1);
  const fixedAnc = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return p; } return null; };
  const q = (s) => [...document.querySelectorAll(s)];
  const meta = (n) => (document.querySelector('meta[name="' + n + '"],meta[property="' + n + '"]') || {}).content || null;
  const ld = q('script[type="application/ld+json"]').map((s) => { try { return JSON.parse(s.textContent); } catch (e) { return { __invalid: true, raw: s.textContent.slice(0, 200) }; } });
  const flat = []; const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o['@type']) flat.push(o); if (o['@graph']) walk(o['@graph']); } }; walk(ld);
  const product = flat.find((o) => /Product/i.test([].concat(o['@type']).join(',')));
  const offers = product && [].concat(product.offers || []).flatMap((o) => o.offers ? [].concat(o.offers) : [o]);

  // First visible occurrence (in document order of screens) of key commerce elements, found by text or selector.
  const findFirst = (re, sel) => {
    const els = q(sel || 'body *').filter((e) => e.children.length < 6 && re.test(norm(e.innerText || e.value || e.getAttribute('aria-label'))) && vis(e) && !fixedAnc(e));
    els.sort((a, b) => docY(a) - docY(b));
    const e = els[0]; return e ? { screen: screen(e), text: norm(e.innerText || e.value).slice(0, 120) } : null;
  };
  const ATC = /^(add to (cart|bag|basket)|aggiungi al carrello|ajouter au panier|in den warenkorb|añadir al carrito|toevoegen aan winkelwagen|pre-?order)/i;
  const atcEls = q('button,a,input[type=submit],[role=button]').filter((e) => ATC.test(norm(e.innerText || e.value || e.getAttribute('aria-label'))));
  const atcVis = atcEls.filter(vis);
  const SOLD = /^(sold out|unavailable|out of stock|esaurito|non disponibile|épuisé|ausverkauft|agotado)/i;
  const soldOutEls = q('button,input[type=submit]').filter((e) => SOLD.test(norm(e.innerText || e.value)) && vis(e));
  const buyNowEls = q('button,a,[role=button],shopify-buy-it-now-button,.shopify-payment-button').filter((e) => /buy it now|buy now|more payment options|shop pay/i.test(norm(e.innerText || e.getAttribute('aria-label'))) && vis(e) && !e.querySelector('button'));
  const keyPos = {
    h1: (() => { const h = q('h1').find(vis); return h ? { screen: screen(h), text: norm(h.innerText).slice(0, 120) } : null; })(),
    price: findFirst(/^[^a-z]{0,6}(\\$|€|£|¥|CHF|kr|zł|R\\$|A\\$|C\\$)\\s?\\d|\\d[\\d.,]*\\s?(€|\\$|£|CHF|kr|zł)$/i, 'span,div,p,strong,b,s,del,ins,small,dd'),
    addToCart: atcVis.length ? (() => { const s = atcVis.filter((e) => !fixedAnc(e)).sort((a, b) => docY(a) - docY(b))[0] || atcVis[0]; return { screen: screen(s), text: norm(s.innerText || s.value).slice(0, 60), sticky: !!fixedAnc(s) }; })() : null,
    reviews: findFirst(/(\\d(\\.\\d)?\\s?(\\/\\s?5|out of 5|stars?))|(\\(?\\d[\\d,.]*\\)?\\s?(reviews?|recensioni|avis|bewertungen|reseñas))/i, 'span,div,p,a,small'),
    shipping: findFirst(/free (shipping|delivery)|ships? (in|within)|delivery (in|within|by)|spedizione|livraison|versand|envío/i, 'span,div,p,li,small,strong'),
    returns: findFirst(/(\\d+)[- ]day(s)? (return|refund|money|guarantee|trial)|free returns|money[- ]back|resi gratuiti|rimborso/i, 'span,div,p,li,small,strong'),
  };

  const imgs = q('img');
  const images = imgs.map((i) => ({ src: (i.currentSrc || i.src || '').slice(0, 300), alt: i.getAttribute('alt'), w: i.naturalWidth, h: i.naturalHeight, rw: Math.round(i.getBoundingClientRect().width), rh: Math.round(i.getBoundingClientRect().height), broken: i.complete && i.naturalWidth === 0 && !!(i.currentSrc || i.src), lazy: i.loading || null, visible: vis(i) }));
  const links = q('a[href]').map((a) => ({ href: a.href, text: norm(a.innerText || a.getAttribute('aria-label') || (a.querySelector('img') || {}).alt).slice(0, 80), target: a.target || null, rel: a.rel || null, visible: vis(a) })).filter((l) => /^https?:/.test(l.href));
  const forms = q('form').map((f) => ({ action: f.getAttribute('action'), method: (f.method || 'get').toLowerCase(), id: f.id || null, fields: [...f.elements].filter((e) => e.name && e.type !== 'hidden').map((e) => ({ name: e.name, type: e.type, required: e.required, label: norm((e.labels && e.labels[0] && e.labels[0].innerText) || e.placeholder || e.getAttribute('aria-label')).slice(0, 60) })), visible: vis(f) }));

  // Layout problems (most relevant on phone)
  const overflowX = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0) - W;
  const wide = overflowX > 2 ? q('body *').filter((e) => { const r = e.getBoundingClientRect(); return r.right > W + 2 && r.width > 0 && vis(e) && getComputedStyle(e).position !== 'fixed'; }).slice(0, 8).map((e) => ({ tag: e.tagName.toLowerCase(), cls: String(e.className || '').slice(0, 60), right: Math.round(e.getBoundingClientRect().right), text: norm(e.innerText).slice(0, 60) })) : [];
  const tappables = q('a,button,input,select,textarea,[role=button]').filter(vis);
  const smallTaps = tappables.filter((e) => { const r = e.getBoundingClientRect(); return (r.width < 24 || r.height < 24) && norm(e.innerText || e.getAttribute('aria-label')).length > 0; });
  const tinyText = q('p,span,li,a,small,label,td').filter((e) => e.children.length === 0 && norm(e.innerText).length > 15 && parseFloat(getComputedStyle(e).fontSize) < 12 && vis(e));
  const fixedBars = q('body *').filter((e) => { const s = getComputedStyle(e); if (s.position !== 'fixed' && s.position !== 'sticky') return false; const r = e.getBoundingClientRect(); return r.width > W * 0.6 && r.height > 20 && r.top < H && r.bottom > 0 && vis(e); })
    .filter((e, i, a) => !a.some((o) => o !== e && o.contains(e))).map((e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), height: Math.round(r.height), text: norm(e.innerText).slice(0, 100) }; });
  const ctas = q('a,button,input[type=submit]').filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { text: norm(e.innerText || e.value || e.getAttribute('aria-label')).slice(0, 60), screen: screen(e), w: Math.round(r.width), h: Math.round(r.height), fixed: !!fixedAnc(e), href: e.getAttribute('href') }; })
    .filter((c) => c.text && c.w * c.h > 1800 && c.screen <= 2.0);

  return {
    url: location.href, title: document.title, lang: document.documentElement.lang || null,
    seo: { description: meta('description'), canonical: (document.querySelector('link[rel=canonical]') || {}).href || null, robots: meta('robots'),
      ogTitle: meta('og:title'), ogImage: meta('og:image'), h1Count: q('h1').length, hreflang: q('link[rel=alternate][hreflang]').length,
      structuredData: flat.map((o) => [].concat(o['@type']).join(',')), ldInvalid: ld.filter((x) => x && x.__invalid).length },
    product: product ? { name: product.name, sku: product.sku || null, brand: product.brand && (product.brand.name || product.brand),
      rating: product.aggregateRating || null, reviewCount: product.aggregateRating ? product.aggregateRating.reviewCount || product.aggregateRating.ratingCount : null,
      offers: (offers || []).slice(0, 10).map((o) => ({ price: o.price, currency: o.priceCurrency, availability: o.availability, url: o.url })) } : null,
    shopify: { isShopify: !!(window.Shopify && window.Shopify.shop), shop: window.Shopify && window.Shopify.shop, theme: window.Shopify && window.Shopify.theme && { name: window.Shopify.theme.name, id: window.Shopify.theme.id, schema: window.Shopify.theme.schema_name, version: window.Shopify.theme.schema_version },
      currency: window.Shopify && window.Shopify.currency && window.Shopify.currency.active, locale: window.Shopify && window.Shopify.locale,
      pageType: window.ShopifyAnalytics && ShopifyAnalytics.meta && ShopifyAnalytics.meta.page && ShopifyAnalytics.meta.page.pageType,
      productId: window.ShopifyAnalytics && ShopifyAnalytics.meta && ShopifyAnalytics.meta.product && ShopifyAnalytics.meta.product.id },
    headings: q('h1,h2,h3').filter(vis).slice(0, 60).map((h) => ({ tag: h.tagName.toLowerCase(), text: norm(h.innerText).slice(0, 120), screen: screen(h) })),
    keyPositions: keyPos,
    addToCartButtons: { total: atcEls.length, visible: atcVis.length, texts: [...new Set(atcVis.map((e) => norm(e.innerText || e.value)))].slice(0, 6),
      soldOutButtons: soldOutEls.length, soldOutText: soldOutEls[0] ? norm(soldOutEls[0].innerText || soldOutEls[0].value) : null, buyNowButtons: buyNowEls.length },
    ctasFirstScreens: ctas.slice(0, 25),
    images: { total: images.length, missingAlt: images.filter((i) => i.alt === null).length, emptyAlt: images.filter((i) => i.alt === '').length, broken: images.filter((i) => i.broken).slice(0, 10),
      oversized: images.filter((i) => i.rw > 0 && i.w > i.rw * 3 && i.w > 1200).slice(0, 10).map((i) => ({ src: i.src, natural: i.w + 'x' + i.h, shown: i.rw + 'x' + i.rh })),
      sample: images.filter((i) => i.visible).slice(0, 40) },
    links: { total: links.length, list: links.slice(0, 400) },
    forms,
    layout: { viewport: W + 'x' + H, pageHeight: document.documentElement.scrollHeight, screens: +(document.documentElement.scrollHeight / H).toFixed(1), horizontalOverflowPx: Math.max(0, overflowX), wideElements: wide,
      smallTapTargets: smallTaps.length, smallTapExamples: smallTaps.slice(0, 8).map((e) => ({ text: norm(e.innerText || e.getAttribute('aria-label')).slice(0, 40), size: Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) })),
      tinyTextCount: tinyText.length, tinyTextExamples: tinyText.slice(0, 5).map((e) => ({ text: norm(e.innerText).slice(0, 60), px: parseFloat(getComputedStyle(e).fontSize) })),
      fixedBars, fixedBarsTotalHeight: fixedBars.reduce((s, b) => s + b.height, 0) },
    text: norm(document.body.innerText.replace(/\\n{2,}/g, '\\n')).length ? document.body.innerText.replace(/[ \\t]+/g, ' ').replace(/\\n\\s*\\n+/g, '\\n').trim().slice(0, 80000) : '',
  };
})()`;

// Cookie / consent banner: find it and its buttons.
export const FIND_CONSENT = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false; const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.05; };
  const RE = /cookie|consent|privacy preferences|we use (cookies|tracking)|gdpr|ccpa|tracciamento|utilizziamo i cookie|nous utilisons|wir verwenden/i;
  const boxes = [...document.querySelectorAll('body *')].filter((e) => { const s = getComputedStyle(e); return (s.position === 'fixed' || s.position === 'sticky' || e.getAttribute('role') === 'dialog' || /cookie|consent|gdpr|privacy/i.test(e.id + ' ' + e.className)) && vis(e) && RE.test(norm(e.innerText)) && norm(e.innerText).length < 2000; });
  const box = boxes.filter((b) => !boxes.some((o) => o !== b && b.contains(o)))[0] || null;
  if (!box) return { found: false };
  const btns = [...box.querySelectorAll('button,a,[role=button],input[type=button],input[type=submit]')].filter(vis).map((b, i) => { b.dataset.saaConsent = String(i); return { i, text: norm(b.innerText || b.value || b.getAttribute('aria-label')).slice(0, 60) }; });
  const pick = (re) => (btns.find((b) => re.test(b.text)) || null);
  return { found: true, text: norm(box.innerText).slice(0, 600), buttons: btns,
    accept: pick(/^(accept|allow|agree|ok|got it|accetta|accepter|akzeptieren|aceptar)/i),
    decline: pick(/(decline|reject|refuse|deny|only (necessary|essential)|necessary only|rifiuta|refuser|ablehnen|rechazar|no,? thanks)/i),
    settings: pick(/(settings|preferences|customi[sz]e|manage|options|impostazioni|personnaliser|einstellungen)/i) };
})()`;

// Detect the theme's add-to-cart buttons as the shopper sees them; tags each with data-saa-atc.
export const SCAN_ATC = `(() => {
  const RE = /^(add to (cart|bag|basket)|aggiungi al carrello|ajouter au panier|in den warenkorb|añadir al carrito|toevoegen aan winkelwagen|pre-?order)/i;
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const W = innerWidth, H = innerHeight;
  let c = [...document.querySelectorAll('a,button,input[type=submit],[role=button]')].filter((e) => RE.test(norm(e.innerText || e.value || e.getAttribute('aria-label'))));
  c = c.filter((el) => !c.some((o) => o !== el && el.contains(o)));
  window.__saaN = window.__saaN || 0;
  for (const el of c) if (!el.dataset.saaAtc) el.dataset.saaAtc = String(window.__saaN++);
  const fixedAnc = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return p; } return null; };
  const state = (el) => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return 'zero-size';
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none') return 'hidden'; if (s.visibility === 'hidden') return 'hidden'; if (parseFloat(s.opacity) < 0.05) return 'hidden'; }
    if (r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) return 'off-viewport'; return 'visible'; };
  return { scrollY: Math.round(scrollY), vh: H, ph: document.documentElement.scrollHeight,
    list: c.map((el) => { const r = el.getBoundingClientRect(); return { idx: +el.dataset.saaAtc, state: state(el), top: Math.round(r.top), fixed: fixedAnc(el) }; }) };
})()`;

// Describes each tagged add-to-cart button: its form, variant id and the text around it.
export const DESCRIBE_ATC = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const heads = [...document.querySelectorAll('h1,h2,h3,h4')];
  return [...document.querySelectorAll('[data-saa-atc]')].map((el) => {
    const form = el.form || el.closest('form');
    let vid = null; if (form) { let f = form.elements && form.elements.namedItem('id'); if (f && !f.tagName && f.length) f = f[0]; if (!f) f = form.querySelector('[name="id"]'); if (f) vid = f.value; }
    const h = heads.filter((x) => x.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
    let ctx = ''; const own = norm(el.innerText || el.value);
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const t = norm(e.innerText); if (t.length > own.length + 20) { ctx = t.replace(own, '[BUTTON]').slice(0, 220); break; } }
    return { idx: +el.dataset.saaAtc, tag: el.tagName.toLowerCase(), text: own.slice(0, 60), disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true',
      section: (el.closest('[id^="shopify-section"]') || {}).id || null, formAction: form ? form.getAttribute('action') : null, variantId: vid,
      headingAbove: h ? norm(h.innerText).slice(0, 100) : null, context: ctx };
  });
})()`;

// Cart lines as rendered on /cart (no cart API call): product handles and titles in the cart form.
export const READ_CART_PAGE = `(() => {
  const norm = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const roots = [...document.querySelectorAll('form[action$="/cart"], form[action*="/cart?"], #cart, cart-items, .cart-items, [data-cart-items], main')];
  const seen = new Map();
  for (const a of roots.flatMap((r) => [...r.querySelectorAll('a[href*="/products/"]')])) {
    if (a.closest('[class*="recommend"], [class*="upsell"], [class*="cross-sell"], .product-recommendations')) continue;
    const m = a.getAttribute('href').match(/\\/products\\/([^/?#]+)(?:\\?[^#]*variant=(\\d+))?/); if (!m) continue;
    const k = m[1] + '|' + (m[2] || ''); if (!seen.has(k)) seen.set(k, { handle: m[1], variant: m[2] || null, title: norm(a.innerText).slice(0, 80) });
  }
  const empty = /your cart is empty|cart is currently empty|il carrello è vuoto|votre panier est vide|warenkorb ist leer/i.test(norm(document.body.innerText));
  return { lines: [...seen.values()], empty, countBadge: norm((document.querySelector('.cart-count-bubble,[data-cart-count],.cart-count') || {}).innerText) || null };
})()`;

// Installed before page scripts: collects Core Web Vitals style metrics for the local lab run.
export const PERF_WATCH = `(() => {
  const m = window.__saaPerf = { lcp: null, lcpEl: null, cls: 0, longTasks: [], fcp: null };
  const po = (type, fn) => { try { new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({ type, buffered: true }); } catch (e) {} };
  po('paint', (e) => { if (e.name === 'first-contentful-paint') m.fcp = e.startTime; });
  po('largest-contentful-paint', (e) => { m.lcp = e.startTime; const el = e.element; m.lcpEl = el ? (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') + (e.url ? ' ' + e.url.slice(0, 160) : '')) : (e.url || null); });
  po('layout-shift', (e) => { if (!e.hadRecentInput) m.cls += e.value; });
  po('longtask', (e) => { m.longTasks.push([e.startTime, e.duration]); });
})()`;
