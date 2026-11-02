const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, console, require(name) {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/lib/')) return load(name.replace('@/', '') + '.ts', mocks);
    return require(name);
  } });
  return exports;
}
const { exportPeriod, bookkeepingCsv, isConfirmedOrder } = load('lib/bookkeeping-export.ts');
const order = { id: 'order-1', orderNumber: 42, createdAt: new Date('2026-11-01T23:30:00Z'), status: 'PAID', refunded: false, customerName: 'Test', total: 32400, discountApplied: 12500, shippingFee: 4900, stripePaymentId: 'pi_1', stripeSessionId: 'cs_1', groupOrderHoldUntil: null, items: [{ quantity: 1, optionSelections: [], sku: { size: 'M', product: { name: 'Julesweater' } } }] };

test('Danish calendar ranges include whole dates and respect spring/autumn DST', () => {
  for (const [day, start, end] of [
    ['2026-11-02', '2026-11-01T23:00:00.000Z', '2026-11-02T23:00:00.000Z'],
    ['2026-03-29', '2026-03-28T23:00:00.000Z', '2026-03-29T22:00:00.000Z'],
    ['2026-10-25', '2026-10-24T22:00:00.000Z', '2026-10-25T23:00:00.000Z'],
  ]) {
    const range = exportPeriod(day, day);
    assert.equal(range.gte.toISOString(), start); assert.equal(range.lt.toISOString(), end);
  }
  for (const [from, to] of [['', ''], ['2026-02-30', '2026-03-01'], ['2026-11-02', '2026-11-01'], ['2024-01-01', '2026-01-01'], ['2026-11-02\r\n', '2026-11-02']]) assert.throws(() => exportPeriod(from, to));
});

test('confirmed, free and refunded orders are retained; abandoned and unpaid cancelled orders are excluded', () => {
  for (const status of ['PAID', 'SHIPPED', 'AWAITING_PICKUP', 'PICKUP_READY', 'DELIVERED', 'REFUNDED']) assert.equal(isConfirmedOrder({ ...order, status }), true);
  assert.equal(isConfirmedOrder({ ...order, total: 0, stripePaymentId: null }), true);
  assert.equal(isConfirmedOrder({ ...order, status: 'CANCELLED' }), true);
  for (const change of [{ status: 'PENDING' }, { orderNumber: null }, { status: 'CANCELLED', stripePaymentId: null }]) assert.equal(isConfirmedOrder({ ...order, ...change }), false);
});

test('CSV preserves totals without subtracting discount twice and guards formulas/quotes', () => {
  const csv = bookkeepingCsv([{ ...order, customerName: ' =HYPERLINK("bad")\nTest' }, { ...order, orderNumber: 43, status: 'REFUNDED', refunded: true }, { ...order, orderNumber: 44, status: 'PENDING' }]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /"324,00";"125,00";"49,00"/);
  assert.match(csv, /"' =HYPERLINK\(""bad""\) Test"/);
  assert.match(csv, /02\.11\.2026/);
  assert.match(csv, /VBK-43/); assert.doesNotMatch(csv, /VBK-44/);
  assert.match(csv, /Ja – beløb og dato hentes i Stripe/);
  assert.equal(csv.split('\r\n').length, 4);
});

test('bundle names and deleted product fallbacks remain visible', () => {
  const csv = bookkeepingCsv([{ ...order, items: [{ quantity: 2, sku: null, optionSelections: { pakketilbudName: 'Trænerpakke' } }, { quantity: 1, sku: null, optionSelections: [] }] }]);
  assert.match(csv, /2 × Trænerpakke/); assert.match(csv, /Slettet\/ukendt produkt/);
});

test('download requires admin access, validates dates and uses an uncacheable CSV attachment', async () => {
  let role = 'CUSTOMER', calls = 0, args;
  const { GET } = load('app/api/admin/bookkeeping-export/route.ts', {
    '@/auth': { auth: async () => ({ user: { role } }) },
    '@/lib/prisma': { prisma: { order: { findMany: async input => { calls++; args = input; return [order]; } } } },
  });
  const req = (from, to) => ({ nextUrl: new URL(`https://example.test/api?from=${from}&to=${to}`) });
  assert.equal((await GET(req('2026-11-02', '2026-11-02'))).status, 403); assert.equal(calls, 0);
  role = 'ADMIN';
  assert.equal((await GET(req('bad', 'bad'))).status, 400); assert.equal(calls, 0);
  const response = await GET(req('2026-11-02', '2026-11-02'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('content-disposition'), /VBK-bogfoering-2026-11-02-2026-11-02.csv/);
  assert.equal(args.where.NOT.status, 'PENDING');
  assert.equal(args.where.createdAt.gte.toISOString(), '2026-11-01T23:00:00.000Z');
  assert.match(await response.text(), /VBK-42/);
});

test('empty and oversized periods return useful errors instead of partial files', async () => {
  for (const [rows, status] of [[[], 404], [Array(10001).fill(order), 400]]) {
    const { GET } = load('app/api/admin/bookkeeping-export/route.ts', {
      '@/auth': { auth: async () => ({ user: { role: 'ADMIN' } }) },
      '@/lib/prisma': { prisma: { order: { findMany: async () => rows } } },
    });
    const response = await GET({ nextUrl: new URL('https://example.test/?from=2026-11-02&to=2026-11-02') });
    assert.equal(response.status, status);
  }
});
