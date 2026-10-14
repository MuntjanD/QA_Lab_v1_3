const { test, expect } = require('@playwright/test');
const A = '/api/v1';
test.beforeEach(async ({ request }) => { await request.post(`${A}/test/reset`); });
const login = async (request, email = 'qa@buggythreads.com', password = 'Passw0rd!') =>
  ({ headers: { Authorization: 'Bearer ' + (await (await request.post(`${A}/auth/login`, { data: { email, password } })).json()).token } });
const add = (request, auth, productId, qty) => request.post(`${A}/cart/items`, { ...auth, data: { productId, qty } });

test.describe('Products', () => {
  test('lists products with count', async ({ request }) => {
    const r = await request.get(`${A}/products`); expect(r.status()).toBe(200);
    const j = await r.json(); expect(j.count).toBe(j.items.length); expect(j.items[0]).toHaveProperty('price');
  });
  test('category filter', async ({ request }) => {
    const j = await (await request.get(`${A}/products?category=electronics`)).json();
    expect(j.items.length).toBeGreaterThan(0); for (const i of j.items) expect(i.category).toBe('electronics');
  });
  test('API-03 maxPrice returns only items <= max', async ({ request }) => {
    test.fail(true, 'API-03 inverted maxPrice filter');
    const j = await (await request.get(`${A}/products?maxPrice=50`)).json();
    for (const i of j.items) expect(i.price).toBeLessThanOrEqual(50);
  });
  test('API-04 unknown product returns 404', async ({ request }) => {
    test.fail(true, 'API-04 returns 200 {}');
    expect((await request.get(`${A}/products/nope`)).status()).toBe(404);
  });
});

test.describe('Auth', () => {
  test('valid login returns token', async ({ request }) => { expect((await login(request)).headers.Authorization.length).toBeGreaterThan(10); });
  test('wrong password rejected', async ({ request }) => {
    expect((await request.post(`${A}/auth/login`, { data: { email: 'qa@buggythreads.com', password: 'bad' } })).status()).toBe(401);
  });
  test('API-02 admin user needs correct password', async ({ request }) => {
    test.fail(true, 'API-02 admin bypass');
    expect((await request.post(`${A}/auth/login`, { data: { email: 'admin@x.com', password: 'wrong' } })).status()).toBe(401);
  });
  test('API-01 weak password rejected on register', async ({ request }) => {
    test.fail(true, 'API-01 accepts "123"');
    expect((await request.post(`${A}/auth/register`, { data: { email: 'n@x.com', password: '123' } })).status()).toBe(400);
  });
  test('API-10 register returns 201', async ({ request }) => {
    test.fail(true, 'API-10 returns 200');
    expect((await request.post(`${A}/auth/register`, { data: { email: 'ok@x.com', password: 'Str0ng!Pass' } })).status()).toBe(201);
  });
});

test.describe('Cart & orders', () => {
  test('cart requires auth', async ({ request }) => { expect((await request.get(`${A}/cart`)).status()).toBe(401); });
  test('add item and compute subtotal', async ({ request }) => {
    const a = await login(request); const r = await add(request, a, 'prod-04', 2);
    expect(r.status()).toBe(201); expect((await r.json()).subtotal).toBe(30);
  });
  test('API-05a negative quantity rejected', async ({ request }) => {
    test.fail(true, 'API-05 accepts qty -5');
    expect((await add(request, await login(request), 'prod-04', -5)).status()).toBe(400);
  });
  test('API-05b out-of-stock item rejected', async ({ request }) => {
    test.fail(true, 'API-05 accepts stock 0 item');
    expect((await add(request, await login(request), 'prod-03', 1)).status()).toBe(409);
  });
  test('API-06 coupon applies once only', async ({ request }) => {
    test.fail(true, 'API-06 coupon stacks');
    const a = await login(request); await add(request, a, 'prod-08', 1);
    await request.post(`${A}/cart/coupon`, { ...a, data: { code: 'FREE100' } });
    const j = await (await request.post(`${A}/cart/coupon`, { ...a, data: { code: 'FREE100' } })).json();
    expect(j.discount).toBe(100);
  });
  test('API-07a empty cart cannot be ordered', async ({ request }) => {
    test.fail(true, 'API-07 empty order accepted');
    expect((await request.post(`${A}/orders`, await login(request))).status()).toBe(400);
  });
  test('order is created from cart', async ({ request }) => {
    const a = await login(request); await add(request, a, 'prod-10', 1);
    const o = await (await request.post(`${A}/orders`, a)).json(); expect(o.total).toBe(39.99);
  });
  test('API-07b stock decreases after order', async ({ request }) => {
    test.fail(true, 'API-07 stock never decremented');
    const a = await login(request); await add(request, a, 'prod-10', 1); await request.post(`${A}/orders`, a);
    expect((await (await request.get(`${A}/products/prod-10`)).json()).stock).toBe(24);
  });
  test('API-08 user cannot read another user order', async ({ request }) => {
    test.fail(true, 'API-08 IDOR');
    const a = await login(request); await add(request, a, 'prod-10', 1);
    const o = await (await request.post(`${A}/orders`, a)).json();
    const other = await login(request, 'admin@evil.com', 'x');                       // other session
    expect([403, 404]).toContain((await request.get(`${A}/orders/${o.id}`, other)).status());
  });
  test('API-11 order list requires auth', async ({ request }) => {
    test.fail(true, 'API-11 open order list');
    expect((await request.get(`${A}/orders`)).status()).toBe(401);
  });
  test('API-09 order tracking returns 200/404, never 500', async ({ request }) => {
    test.fail(true, 'API-09 always 500');
    expect((await request.get(`${A}/order-tracking/1001`)).status()).toBeLessThan(500);
  });
});
