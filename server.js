// BuggyThreads mock backend: zero dependencies, in-memory state, deliberate API bugs (see README).
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3100;
const PRODUCTS = [
  { id: 'prod-01', name: 'Denim Jacket', category: 'men', price: 89.99, stock: 12 },
  { id: 'prod-03', name: 'Leather Wrist Watch', category: 'accessories', price: 120, stock: 0 },
  { id: 'prod-04', name: 'Fleece Hoodie', category: 'men', price: 15, stock: 20 },
  { id: 'prod-08', name: 'Noise-Canceling Headphones', category: 'electronics', price: 249.99, stock: 10 },
  { id: 'prod-10', name: 'Power Bank 10000mAh', category: 'electronics', price: 39.99, stock: 25 },
  { id: 'prod-15', name: 'Silk Wrap Dress', category: 'women', price: 125, stock: 5 },
  { id: 'prod-35', name: 'Smart Wi-Fi Plug', category: 'electronics', price: 19.99, stock: 50 },
];
let S;
const reset = () => { S = { products: PRODUCTS.map(p => ({ ...p })), users: { 'qa@buggythreads.com': 'Passw0rd!' }, tokens: {}, carts: {}, discounts: {}, orders: [], nextOrder: 1001 }; };
reset();
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;
  if (!p.startsWith('/api/')) {
    const f = path.join(__dirname, 'public', p === '/' ? 'index.html' : p);
    if (!f.startsWith(path.join(__dirname, 'public')) || !fs.existsSync(f)) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); return fs.createReadStream(f).pipe(res);
  }
  let raw = ''; req.on('data', c => raw += c); req.on('end', () => {
    let b = {}; try { b = raw ? JSON.parse(raw) : {}; } catch { return send(res, 400, { error: 'Invalid JSON' }); }
    const user = S.tokens[(req.headers.authorization || '').replace('Bearer ', '')];
    const m = (method, re) => req.method === method && (m.r = p.match(re));
    const cart = () => (S.carts[user] = S.carts[user] || []);
    const total = () => { const sub = cart().reduce((s, i) => s + i.price * i.qty, 0), d = S.discounts[user] || 0; return { subtotal: +sub.toFixed(2), discount: d, total: +(sub - d).toFixed(2) }; };

    if (m('GET', /^\/api\/v1\/health$/)) return send(res, 200, { status: 'ok' });
    if (m('POST', /^\/api\/v1\/test\/reset$/)) { reset(); return send(res, 200, { reset: true }); }

    if (m('GET', /^\/api\/v1\/products$/)) {
      let r = S.products; const q = url.searchParams;
      if (q.get('category')) r = r.filter(x => x.category === q.get('category'));
      if (q.get('maxPrice')) r = r.filter(x => x.price >= +q.get('maxPrice'));                       // API-03 inverted filter
      if (q.get('q')) r = r.filter(x => x.name.toLowerCase().includes(q.get('q').toLowerCase()));
      return send(res, 200, { count: r.length, items: r });
    }
    if (m('GET', /^\/api\/v1\/products\/([\w-]+)$/)) return send(res, 200, S.products.find(x => x.id === m.r[1]) || {}); // API-04 should be 404

    if (m('POST', /^\/api\/v1\/auth\/register$/)) {
      if (!b.email || !b.password) return send(res, 400, { error: 'email and password required' });
      if (S.users[b.email]) return send(res, 409, { error: 'exists' });
      S.users[b.email] = b.password;                                                                  // API-01 no password policy
      return send(res, 200, { email: b.email });                                                      // API-10 should be 201
    }
    if (m('POST', /^\/api\/v1\/auth\/login$/)) {
      const ok = S.users[b.email] === b.password || String(b.email || '').includes('admin');          // API-02 admin bypass
      if (!ok) return send(res, 401, { error: 'Invalid credentials' });
      const t = 'tok_' + Math.random().toString(36).slice(2); S.tokens[t] = b.email; return send(res, 200, { token: t });
    }

    if (m('GET', /^\/api\/v1\/cart$/)) return user ? send(res, 200, { items: cart(), ...total() }) : send(res, 401, { error: 'auth required' });
    if (m('POST', /^\/api\/v1\/cart\/items$/)) {
      if (!user) return send(res, 401, { error: 'auth required' });
      const pr = S.products.find(x => x.id === b.productId); if (!pr) return send(res, 404, { error: 'unknown product' });
      cart().push({ productId: pr.id, name: pr.name, price: pr.price, qty: b.qty });                  // API-05 no qty / stock validation
      return send(res, 201, { items: cart(), ...total() });
    }
    if (m('POST', /^\/api\/v1\/cart\/coupon$/)) {
      if (!user) return send(res, 401, { error: 'auth required' });
      if (String(b.code).toUpperCase() !== 'FREE100') return send(res, 400, { error: 'Invalid coupon' });
      S.discounts[user] = (S.discounts[user] || 0) + 100; return send(res, 200, total());              // API-06 stacks
    }

    if (m('POST', /^\/api\/v1\/orders$/)) {
      if (!user) return send(res, 401, { error: 'auth required' });
      const o = { id: S.nextOrder++, owner: user, items: [...cart()], ...total() };                   // API-07 empty cart ok, no idempotency, stock untouched
      S.orders.push(o); S.carts[user] = []; S.discounts[user] = 0; return send(res, 201, o);
    }
    if (m('GET', /^\/api\/v1\/orders$/)) return send(res, 200, { orders: S.orders });                 // API-11 no auth required
    if (m('GET', /^\/api\/v1\/orders\/(\d+)$/)) {
      const o = S.orders.find(x => x.id === +m.r[1]);                                                 // API-08 IDOR: no owner check
      return o ? send(res, 200, o) : send(res, 404, { error: 'not found' });
    }
    if (m('GET', /^\/api\/v1\/order-tracking\/(\d+)$/)) return send(res, 500, { error: 'Internal Server Error' }); // API-09
    send(res, 404, { error: 'no such route' });
  });
}).listen(PORT, () => console.log('BuggyThreads on http://localhost:' + PORT));
