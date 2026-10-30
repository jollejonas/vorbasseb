const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function fixture() {
  let role = 'ADMIN', listArgs, reads = 0;
  const page = { has_more: true, data: [
    { id: 'cs_free', mode: 'payment', discounts: [{ promotion_code: 'promo_test' }], metadata: { orderId: 'pending' }, payment_status: 'no_payment_required', amount_total: 0, currency: 'dkk', customer_details: { name: 'Test Customer', email: 'test@example.com' } },
    { id: 'cs_other', mode: 'payment', discounts: [{ promotion_code: 'promo_other' }], metadata: {} },
    { id: 'cs_done', mode: 'payment', discounts: [{ promotion_code: { id: 'promo_test' } }], metadata: { orderId: 'done' }, amount_total: 0 },
  ] };
  const mocks = {
    '@/auth': { auth: async () => ({ user: { role } }) },
    '@/lib/prisma': { prisma: { order: { findMany: async () => [
      { id: 'pending', status: 'PENDING', orderNumber: null, stripeSessionId: 'cs_free', items: [{ quantity: 1, sku: { size: 'XL', product: { name: 'Julesweater' } } }] },
      { id: 'done', status: 'PAID', orderNumber: 71, stripeSessionId: 'cs_done', items: [] },
    ] } } },
    stripe: class { promotionCodes = { retrieve: async () => ({ code: 'TEST100', times_redeemed: 4, created: 123 }) }; checkout = { sessions: { list: async args => { reads++; listArgs = args; return page; } } }; },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/admin/promo-codes/[id]/orders/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { exports, process, require: n => mocks[n] ?? require(n) });
  const call = (cursor = '') => exports.GET({ nextUrl: new URL(`https://shop.example/api${cursor ? `?cursor=${cursor}` : ''}`) }, { params: Promise.resolve({ id: 'promo_test' }) });
  return { call, setRole: value => role = value, page, getArgs: () => listArgs, reads: () => reads };
}
test('shows completed zero-total redemptions and distinguishes missing processing from confirmed order', async () => {
  const f = fixture();
  const response = await f.call();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.orders.length, 2);
  assert.equal(data.redeemed, 4);
  assert.equal(data.orders[0].total, 0);
  assert.equal(data.orders[0].name, 'Test Customer');
  assert.equal(data.orders[0].items[0].size, 'XL');
  assert.equal(data.orders[0].status, 'NEEDS_PROCESSING');
  assert.equal(data.orders[1].status, 'CONFIRMED');
  assert.equal(data.nextCursor, 'cs_done');
  assert.match(response.headers.get('cache-control'), /no-store/);
});
test('pagination continues even when a scanned page has no matching redemptions', async () => {
  const f = fixture();
  f.page.data = [{ id: 'cs_old', mode: 'payment', discounts: [] }];
  const data = await (await f.call('cs_previous')).json();
  assert.equal(data.orders.length, 0);
  assert.equal(data.nextCursor, 'cs_old');
  assert.equal(f.getArgs().starting_after, 'cs_previous');
});
test('customer and invalid cursor requests never access Stripe', async () => {
  const f = fixture(); f.setRole('CUSTOMER');
  assert.equal((await f.call()).status, 403);
  f.setRole('ADMIN');
  assert.equal((await f.call('invalid')).status, 400);
  assert.equal(f.reads(), 0);
});
