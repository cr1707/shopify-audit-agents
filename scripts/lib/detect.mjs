// Detection tables: apps, marketing pixels and technologies, matched against the hosts and URLs a page loads.

export const APPS = [
  ['Klaviyo', /klaviyo\.com/i], ['Omnisend', /omnisend/i], ['Mailchimp', /chimpstatic|list-manage\.com/i], ['Privy', /privy\.com/i],
  ['Attentive', /attn\.tv|attentivemobile/i], ['Postscript', /postscript\.io/i], ['Brevo', /sendinblue|brevo\.com|sibforms/i],
  ['MailerLite', /mailerlite|mlcdn\.com/i], ['Drip', /getdrip\.com/i], ['Seguno', /seguno/i], ['SMSBump/Yotpo SMS', /smsbump/i],
  ['Judge.me', /judge\.me|judgeme/i], ['Yotpo', /yotpo\.com/i], ['Okendo', /okendo\.io/i], ['Loox', /loox\.io/i], ['Stamped', /stamped\.io/i],
  ['Reviews.io', /reviews\.io/i], ['Trustpilot', /trustpilot\.com/i], ['Junip', /junip\.co/i], ['Recharge', /rechargecdn|rechargepayments/i],
  ['Skio', /skio\.com/i], ['Appstle', /appstle/i], ['Seal Subscriptions', /sealsubscriptions/i], ['Loop', /loopsubscriptions/i],
  ['Gorgias', /gorgias/i], ['Zendesk', /zdassets|zendesk\.com/i], ['Tidio', /tidio\.co/i], ['Intercom', /intercom\.io|intercomcdn/i],
  ['Richpanel', /richpanel/i], ['Re:amaze', /reamaze/i], ['Helpdesk/Willdesk', /willdesk|helpdesk\.com/i], ['Shopify Inbox', /shopify-chat|inbox\.shopify/i],
  ['Smile.io', /smile\.io|sweettooth\.io/i], ['LoyaltyLion', /loyaltylion/i], ['Growave', /growave/i], ['Rivo', /rivo\.io/i],
  ['Klarna', /klarna/i], ['Afterpay/Clearpay', /afterpay\.com|clearpay/i], ['Scalapay', /scalapay/i], ['Affirm', /affirm\.com/i],
  ['Rebuy', /rebuyengine/i], ['Nosto', /nosto\.com/i], ['LimeSpot', /limespot/i], ['Searchanise', /searchanise/i], ['Boost', /boostcommerce/i],
  ['Klevu', /klevu/i], ['Doofinder', /doofinder/i], ['Algolia', /algolia/i], ['Weglot', /weglot/i], ['Langify', /langify/i], ['Transcy', /transcy/i],
  ['Back in stock', /restockrocket|backinstock/i], ['Instafeed', /nfcube/i], ['Bundles', /bundler|fastbundle|bundles\.app/i],
  ['Zipify OCU', /zipify/i], ['ReConvert', /reconvert/i], ['AfterSell', /aftersell/i], ['Upsell (other)', /upsell/i],
  ['Visually', /visually\.io/i], ['Intelligems', /intelligems/i], ['Shogun', /getshogun|shogun/i], ['PageFly', /pagefly/i], ['GemPages', /gempages/i],
  ['Hextom', /hextom/i], ['ProveSource', /provesrc|provesource/i], ['Fomo', /fomo\.com/i], ['Essential apps', /essential-?apps|essentialapps/i],
  ['GoAffPro', /goaffpro/i], ['UpPromote', /uppromote/i], ['Refersion', /refersion/i], ['Sufio', /sufio/i], ['Lantern', /lantern/i],
  ['Triple Whale', /triplewhale|triplepixel|config-security\.com/i], ['Elevar', /elevar/i], ['Stape', /stape\.io|stape\.net/i], ['Littledata', /littledata/i],
  ['Cookiebot', /cookiebot/i], ['iubenda', /iubenda/i], ['Consentmo', /consentmo/i], ['Pandectes', /pandectes/i], ['OneTrust', /onetrust|cookielaw/i],
  ['Shopify Customer Privacy banner', /privacy-banner|customer-privacy/i],
];

// Tracking endpoints: a request here means data was sent, not just a script loaded.
export const PIXELS = [
  ['Meta Pixel', /facebook\.com\/tr|connect\.facebook\.net/i, /facebook\.com\/tr/i],
  ['Google Analytics 4', /google-analytics\.com|googletagmanager\.com\/gtag|analytics\.google\.com/i, /\/g\/collect|google-analytics\.com\/(collect|j\/collect)/i],
  ['Google Ads', /googleadservices\.com|googleads\.g\.doubleclick\.net|google\.com\/pagead/i, /pagead\/(conversion|landing|1p-conversion)|viewthroughconversion/i],
  ['Google Tag Manager', /googletagmanager\.com\/gtm\.js/i, null],
  ['TikTok Pixel', /analytics\.tiktok\.com/i, /analytics\.tiktok\.com\/api\/v2\/pixel/i],
  ['Pinterest Tag', /s\.pinimg\.com\/ct|ct\.pinterest\.com/i, /ct\.pinterest\.com\/v3/i],
  ['Snap Pixel', /sc-static\.net|tr\.snapchat\.com/i, /tr\.snapchat\.com/i],
  ['Microsoft UET', /bat\.bing\.com/i, /bat\.bing\.com\/action/i],
  ['Reddit Pixel', /redditstatic\.com\/ads|alb\.reddit\.com/i, /alb\.reddit\.com\/rp/i],
  ['X/Twitter Pixel', /static\.ads-twitter\.com|analytics\.twitter\.com|t\.co\/i\/adsct/i, /adsct|analytics\.twitter\.com/i],
  ['Criteo', /criteo/i, /criteo\.com\/(event|delivery)/i],
  ['Hotjar', /hotjar\.com/i, /in\.hotjar\.com|hotjar\.io/i],
  ['Microsoft Clarity', /clarity\.ms/i, /clarity\.ms\/collect/i],
  ['Klaviyo tracking', /static\.klaviyo\.com|a\.klaviyo\.com/i, /a\.klaviyo\.com\/(api\/track|client\/events)/i],
  ['Shopify analytics', /monorail-edge\.shopifysvc\.com|\/api\/collect|shop\.app\/pay\/session/i, /monorail-edge\.shopifysvc\.com\/(v1|unstable)\/produce/i],
  ['Triple Whale', /triplewhale|config-security\.com|api\.config-security\.com/i, /api\.config-security\.com\/(event|t)/i],
];

export const TECH = [
  ['Google Tag Manager', /googletagmanager\.com\/gtm/i], ['Cloudflare', /cloudflare|cdnjs\.cloudflare/i], ['YouTube embed', /youtube\.com\/embed|ytimg/i],
  ['Vimeo', /vimeo\.com|vimeocdn/i], ['reCAPTCHA', /recaptcha/i], ['hCaptcha', /hcaptcha/i], ['Shop Pay', /shop\.app|shopify-pay|shop-pay/i],
  ['Typekit', /typekit\.net|use\.typekit/i], ['Google Fonts', /fonts\.googleapis|fonts\.gstatic/i], ['jQuery', /jquery/i], ['Swiper', /swiper/i],
  ['Wistia', /wistia/i], ['Sentry', /sentry/i], ['Segment', /segment\.(com|io)|cdn\.segment/i],
];

export function hostOf(u) { try { return new URL(u).hostname; } catch { return ''; } }

export function detectFromRequests(requests, siteHost) {
  const urls = requests.map((r) => r.url);
  // Apps and technologies are matched on code and data requests only: product image file names
  // (for example a "lantern-bag.jpg") must not count as an app.
  const joined = requests.filter((r) => !['Image', 'Media', 'Font'].includes(r.type)).map((r) => r.url).join('\n');
  const apps = APPS.filter(([, re]) => re.test(joined)).map(([n]) => n);
  const tech = TECH.filter(([, re]) => re.test(joined)).map(([n]) => n);
  const pixels = PIXELS.map(([name, load, send]) => {
    const loaded = urls.filter((u) => load.test(u));
    const sent = send ? requests.filter((r) => send.test(r.url) && !r.failed) : [];
    return { name, loaded: loaded.length > 0, hits: sent.length, examples: sent.slice(0, 3).map((r) => r.url.slice(0, 300)) };
  }).filter((p) => p.loaded || p.hits);
  const base = siteHost.replace(/^www\./, '');
  const third = {};
  for (const r of requests) {
    const h = hostOf(r.url); if (!h || h.endsWith(base) || h === 'cdn.shopify.com' || r.url.startsWith('data:')) continue;
    third[h] = third[h] || { host: h, requests: 0, bytes: 0, types: new Set() };
    third[h].requests++; third[h].bytes += r.bytes || 0; third[h].types.add(r.type);
  }
  const thirdParty = Object.values(third).map((t) => ({ ...t, types: [...t.types] })).sort((a, b) => b.bytes - a.bytes);
  return { apps, tech, pixels, thirdParty };
}

// Google consent mode: the gcs parameter on GA/Ads hits says what consent state was sent (G100 = denied).
export function consentSignals(requests) {
  const out = [];
  for (const r of requests) {
    if (!/google-analytics\.com\/g\/collect|analytics\.google\.com\/g\/collect|googleadservices|pagead|doubleclick/i.test(r.url)) continue;
    let gcs = null, gcd = null, en = null;
    try { const u = new URL(r.url); gcs = u.searchParams.get('gcs'); gcd = u.searchParams.get('gcd'); en = u.searchParams.get('en'); } catch {}
    if (!gcs && r.postData) { const m = r.postData.match(/gcs=([^&\s]+)/); if (m) gcs = m[1]; }
    out.push({ host: hostOf(r.url), event: en, gcs, gcd, url: r.url.slice(0, 220) });
  }
  return out;
}
