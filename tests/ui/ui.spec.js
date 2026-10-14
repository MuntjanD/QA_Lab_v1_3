const { test, expect } = require('@playwright/test');
test.beforeEach(async ({ page }) => { await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload(); });
const cards = page => page.locator('#product-grid > div');
const addToCart = async (page, name, qty = '1') => {
  await cards(page).filter({ hasText: name }).getByRole('button', { name: 'Quick View' }).click();
  await page.locator('#modal-qty').fill(qty); await page.locator('#modal-add-btn').click();
};

test('loads 40 products and 0/26 bugs', async ({ page }) => {
  await expect(cards(page)).toHaveCount(40); await expect(page.locator('#found-bugs-badge')).toHaveText('0/26');
});
test('category filter + search combine', async ({ page }) => {
  await page.locator('#category-select').selectOption('electronics'); await expect(cards(page)).toHaveCount(11);
  await page.locator('#search-input').fill('watch'); await page.locator('#search-input').press('Enter');
  await expect(cards(page)).toHaveCount(1);                                   // only the electronics watch
});
test('add to cart updates counter and subtotal', async ({ page }) => {
  await addToCart(page, 'Smart Wi-Fi Plug', '2'); await expect(page.locator('#cart-counter')).toHaveText('2');
  await page.getByRole('button', { name: /toggle cart/i }).click(); await expect(page.locator('#cart-subtotal')).toHaveText('$39.98');
});
test('Escape closes quick view', async ({ page }) => {
  await cards(page).first().getByRole('button', { name: 'Quick View' }).click();
  await page.keyboard.press('Escape'); await expect(page.locator('#product-modal')).toBeHidden();
});
test('reset database clears found bugs', async ({ page }) => {
  await page.getByText('Order Tracking').click(); await expect(page.locator('#found-bugs-badge')).not.toHaveText('0/26');
  await page.getByText('Reset Database').click(); await expect(page.locator('#found-bugs-badge')).toHaveText('0/26');
});
test('BUG-FUN-04 price slider shows only items <= max', async ({ page }) => {
  test.fail(true, 'BUG-FUN-04 planted: inverted filter');
  await page.locator('#price-range').fill('50');
  for (const t of await page.locator('#product-grid span.font-black').allTextContents()) expect(parseFloat(t.slice(1))).toBeLessThanOrEqual(50);
});
test('BUG-FUN-06 out-of-stock item cannot be added', async ({ page }) => {
  test.fail(true, 'BUG-FUN-06 planted');
  await addToCart(page, 'Minimalist Leather Wrist Watch'); await expect(page.locator('#cart-counter')).toHaveText('0');
});
test('BUG-FUN-02 coupon applies once', async ({ page }) => {
  test.fail(true, 'BUG-FUN-02 planted: stacks');
  await addToCart(page, 'Wireless Noise-Canceling Headphones'); await page.getByRole('button', { name: /toggle cart/i }).click();
  for (let i = 0; i < 2; i++) { await page.locator('#coupon-code').fill('FREE100'); await page.getByRole('button', { name: 'Apply' }).click(); }
  await expect(page.locator('#cart-discount')).toHaveText('-$100.00');
});
test('BUG-SEC-02 double click creates exactly one order', async ({ page }) => {
  test.fail(true, 'BUG-SEC-02 planted');
  await addToCart(page, 'Smart Wi-Fi Plug'); await page.getByRole('button', { name: /toggle cart/i }).click();
  await page.getByRole('button', { name: 'Proceed to Checkout' }).click();
  await page.locator('#cust-name').fill('Test'); await page.locator('#cust-email').fill('t@t.com');
  await page.locator('#checkout-submit-btn').dblclick(); await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__orders.length)).toBe(1);
});
test('BUG-CON-02 order tracking hits the real API and gets 500', async ({ page }) => {
  const resp = page.waitForResponse(r => r.url().includes('/api/v1/order-tracking'));
  await page.getByText('Order Tracking').click(); expect((await resp).status()).toBe(500);
});

test.describe('QA Control Center tabs', () => {
  test.beforeEach(async ({ page }) => { await page.getByRole('button', { name: /QA Control Center/ }).click(); });
  test('Jira board: create ticket and move it', async ({ page }) => {
    await page.locator('#tab-btn-jira').click();
    await page.locator('#jira-new-title').fill('Cart total wrong with coupon'); await page.locator('#jira-add').click();
    await expect(page.locator('#jira-col-todo .jira-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Move right' }).click();
    await expect(page.locator('#jira-col-prog .jira-card')).toHaveCount(1);
  });
  test('found bug appears on Jira board', async ({ page }) => {
    await page.getByText('Order Tracking').click({ force: true }); await page.locator('#tab-btn-jira').click();
    await expect(page.locator('#jira-board')).toContainText('BUG-CON-02');
  });
  test('API tab: run all checks and send failures to Jira', async ({ page }) => {
    await page.locator('#tab-btn-api').click(); await page.locator('#api-run-all').click();
    await expect(page.locator('#api-results li')).toHaveCount(10);
    await expect(page.locator('#api-summary')).toContainText('failed');
    await page.getByRole('button', { name: '→ Jira' }).first().click();
    await page.locator('#tab-btn-jira').click(); await expect(page.locator('#jira-board')).toContainText('API-');
  });
  test('API tab: manual login request returns token', async ({ page }) => {
    await page.locator('#tab-btn-api').click(); await page.getByRole('button', { name: 'Login' }).click(); await page.locator('#api-send').click();
    await expect(page.locator('#api-resp')).toContainText('200'); await expect(page.locator('#api-token')).not.toHaveText('none');
  });
});
