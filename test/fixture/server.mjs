// A tiny fake Shopify-like store with planted problems, used to regression-test the collector.
// Planted: a second "Add to cart" that adds another product, a disabled builder button, a newsletter pop-up after 2 s, a page wider than a
// phone screen, a dead internal link, a JavaScript error, an image without alt text, a cookie banner, a fake
// discount (compare-at below price), a 30-day vs 14-day returns contradiction, and a page blocked by robots.txt.
import http from 'node:http';

const PRODUCTS = [
  { id: 1001, title: 'Alpha Lamp', handle: 'alpha', body_html: '<p>A warm desk lamp. 30-day returns.</p>', product_type: 'Lamp', vendor: 'Fixture', published_at: '2026-01-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', variants: [{ id: 111, title: 'Default', price: '49.00', compare_at_price: '39.00', available: true, sku: 'ALPHA' }], images: [{ src: '/img/alpha.svg', alt: null }] },
  { id: 1002, title: 'Beta Shade', handle: 'beta', body_html: '<p>A linen shade for the Alpha Lamp.</p>', product_type: 'Shade', vendor: 'Fixture', published_at: '2026-02-01T00:00:00Z', updated_at: '2026-09-02T00:00:00Z', variants: [{ id: 222, title: 'Default', price: '19.00', compare_at_price: null, available: true, sku: '' }], images: [{ src: '/img/beta.svg', alt: 'Beta shade' }] },
];
const byVariant = { 111: PRODUCTS[0], 222: PRODUCTS[1] };

const layout = (title, body, { popup = false, wide = false, error = false, banner = false } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<script>window.Shopify={shop:'fixture.myshopify.com',theme:{name:'Fixture',id:1,schema_name:'Dawn',schema_version:'1.0.0'},currency:{active:'EUR'},locale:'en'};</script>
<style>body{font-family:sans-serif;margin:0}header{padding:12px;border-bottom:1px solid #ddd}main{padding:16px}button{padding:12px 16px}
.pop{position:fixed;inset:20% 8%;background:#fff;border:2px solid #000;padding:24px;z-index:9}.cb{position:fixed;left:0;right:0;bottom:0;background:#eee;padding:16px;z-index:8}</style>
</head><body><header><a href="/">Fixture store</a> · <a href="/collections/all">Shop</a> · <a href="/cart">Cart <span id="count">0</span></a></header>
<main>${body}${wide ? '<div style="width:640px;background:#fcc">A promo strip wider than a phone screen</div>' : ''}</main>
<footer><a href="/policies/refund-policy">Refunds</a> · <a href="/pages/faq">FAQ</a> · <a href="/pages/missing">Old page</a> · <a href="/secret/area">Members</a></footer>
${popup ? `<script>setTimeout(()=>{const d=document.createElement('div');d.className='pop';d.setAttribute('role','dialog');d.innerHTML='<h2>Get 10% off your first order</h2><p>Join the list.</p><form action="/contact" method="post"><input type="email" name="email"><button type="submit">Subscribe</button></form><button onclick="this.parentNode.remove()">No thanks</button>';document.body.appendChild(d)},2000)</script>` : ''}
${banner ? `<div class="cb" id="cookie-banner">We use cookies to improve your experience. <button onclick="document.cookie='consent=yes;path=/';this.parentNode.remove()">Accept</button> <button onclick="document.cookie='consent=no;path=/';this.parentNode.remove()">Decline</button></div>` : ''}
${error ? `<script>setTimeout(()=>{ undefinedFunctionCall(); }, 100)</script>` : ''}
<script>
document.querySelectorAll('form[action="/cart/add"]').forEach((f)=>f.addEventListener('submit',async(e)=>{e.preventDefault();
 const r=await fetch('/cart/add.js',{method:'POST',body:new FormData(f)});const j=await r.json();document.getElementById('count').textContent=String(j.item_count||1);}));
</script></body></html>`;

const atc = (variant, label = 'Add to cart') => `<form action="/cart/add" method="post"><input type="hidden" name="id" value="${variant}"><button type="submit">${label}</button></form>`;

function readCart(req) { const m = (req.headers.cookie || '').match(/cart=([^;]+)/); try { return m ? JSON.parse(decodeURIComponent(m[1])) : []; } catch { return []; } }

export function start(port = 0) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const send = (code, type, body, headers = {}) => { res.writeHead(code, { 'content-type': type, ...headers }); res.end(body); };
    const p = u.pathname;
    if (p === '/robots.txt') return send(200, 'text/plain', 'User-agent: *\nDisallow: /secret\nDisallow: /checkout\n');
    if (p === '/meta.json') return send(200, 'application/json', JSON.stringify({ id: 1, name: 'Fixture store', myshopify_domain: 'fixture.myshopify.com', currency: 'EUR', country: 'IT', ships_to_countries: ['IT', 'FR'] }));
    if (p === '/products.json') return send(200, 'application/json', JSON.stringify({ products: u.searchParams.get('page') > 1 ? [] : PRODUCTS }));
    if (p === '/collections.json') return send(200, 'application/json', JSON.stringify({ collections: [{ id: 1, handle: 'all', title: 'All', products_count: 2 }, { id: 2, handle: 'empty', title: 'Empty', products_count: 0 }] }));
    if (p === '/sitemap.xml') return send(200, 'application/xml', `<?xml version="1.0"?><urlset><url><loc>http://${req.headers.host}/products/alpha</loc></url><url><loc>http://${req.headers.host}/pages/faq</loc></url></urlset>`);
    if (p.startsWith('/img/')) return send(200, 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#c96"/></svg>');
    if (p === '/') return send(200, 'text/html', layout('Fixture store', `<h1>Lamps for slow evenings</h1><img src="/img/alpha.svg" width="200"><p><a href="/products/alpha">Alpha Lamp</a> · <a href="/products/beta">Beta Shade</a></p>`, { popup: true, wide: true, error: true, banner: true }));
    if (p === '/products/alpha') return send(200, 'text/html', layout('Alpha Lamp', `<h1>Alpha Lamp</h1><p><s>€39,00</s> €49,00</p>${atc(111)}<p>Free shipping over €60.</p><section id="shopify-section-related"><h2>Complete the look</h2><p>Beta Shade</p>${atc(222)}</section>
      <script>window.ShopifyAnalytics={meta:{product:{id:1001,variants:[{id:111}]},page:{pageType:'product'}}}</script>`));
    if (p === '/products/beta') return send(200, 'text/html', layout('Beta Shade', `<h1>Beta Shade</h1><p>€19,00</p>${atc(222)}<section id="shopify-section-builder"><h2>Build a set</h2><form action="/cart/add" method="post"><input type="hidden" name="id" value="111"><button type="submit" disabled>Add to cart</button></form></section><script>window.ShopifyAnalytics={meta:{product:{id:1002,variants:[{id:222}]},page:{pageType:'product'}}}</script>`));
    if (p === '/collections/all') return send(200, 'text/html', layout('All', `<h1>All products</h1><a href="/products/alpha">Alpha Lamp</a> <a href="/products/beta">Beta Shade</a>`));
    if (p === '/pages/faq') return send(200, 'text/html', layout('FAQ', `<h1>FAQ</h1><p>Can I return my order? Yes, within 14 days.</p>`));
    if (p === '/policies/refund-policy') return send(200, 'text/html', layout('Refund policy', `<h1>Refund policy</h1><p>You can return any item within 30 days of delivery.</p>`));
    if (p === '/cart') { const lines = readCart(req); return send(200, 'text/html', layout('Cart', `<h1>Your cart</h1><form action="/cart" method="post">${lines.map((l) => `<a href="/products/${byVariant[l].handle}?variant=${l}">${byVariant[l].title}</a>`).join('') || '<p>Your cart is empty</p>'}</form>`)); }
    if (p === '/cart/add.js' && req.method === 'POST') {
      let body = ''; req.on('data', (c) => (body += c)); req.on('end', () => {
        const id = Number((body.match(/name="id"\r\n\r\n(\d+)/) || body.match(/(?:^|&)id=(\d+)/) || [])[1]);
        const prod = byVariant[id]; if (!prod) return send(422, 'application/json', '{"status":422}');
        const lines = [...readCart(req), id];
        send(200, 'application/json', JSON.stringify({ items: [{ product_id: prod.id, handle: prod.handle, product_title: prod.title, variant_id: id, quantity: 1 }], item_count: lines.length }), { 'set-cookie': `cart=${encodeURIComponent(JSON.stringify(lines))}; Path=/` });
      });
      return;
    }
    if (p === '/contact' && req.method === 'POST') { server.formPosts = (server.formPosts || 0) + 1; return send(200, 'text/html', 'thanks'); }
    send(404, 'text/html', layout('404 Not Found', '<h1>Page not found</h1>'));
  });
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) { const s = await start(Number(process.argv[2] || 4173)); console.log(`fixture store on http://127.0.0.1:${s.address().port}`); }
