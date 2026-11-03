const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, console, process, require(name) {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/lib/')) return load(name.replace('@/', '') + '.ts', mocks);
    return require(name);
  } });
  return exports;
}

function fixture({ delivery = null } = {}) {
  const records = new Map(['one', 'two'].map(id => [id, { id, status: 'PENDING', stripeSessionId: `cs-${id}`, orderNumber: null, total: 100, items: [] }]));
  const emails = [];
  const addresses = [];
  let counter = 68;
  const db = {
    orderDelivery: { findUnique: async () => delivery },
    address: { create: async ({ data }) => { addresses.push(data); return { id: "customer-address" }; } },
    $queryRaw: async () => [{ counter: "OrderNumberCounter", legacy: false }],
    order: { aggregate: async () => ({ _max: { orderNumber: 68 } }),
      findUnique: async ({ where }) => ({ ...records.get(where.id) }),
      updateMany: async ({ where }) => {
        const row = records.get(where.id);
        if (row.status !== 'PENDING' || (row.stripeSessionId && row.stripeSessionId !== where.OR[0].stripeSessionId)) return { count: 0 };
        row.status = 'PAID'; return { count: 1 };
      },
      update: async ({ where, data }) => Object.assign(records.get(where.id), data),
    },
    orderNumberCounter: { upsert: async () => ({ value: ++counter }) },
    $transaction: async fn => fn(db),
  };
  const { fulfillOrder } = load('lib/fulfillOrder.ts', {
    '@/lib/prisma': { prisma: db },
    '@/lib/email': { sendOrderConfirmation: async args => emails.push(args), sendLowStockAlert: async () => {} },
  });
  if (delivery) records.get("one").deliveryMethod = "SHIPPING";
  const session = id => ({ id: `cs-${id}`, mode: 'payment', status: 'complete', payment_status: 'paid', metadata: { orderId: id }, customer_details: { email: 'test@example.com' } });
  return { fulfillOrder, records, emails, addresses, session, counter: () => counter };
}

test('open, expired and unpaid checkouts consume no order number', async () => {
  const f = fixture();
  for (const state of [{ status: 'open' }, { status: 'expired' }, { payment_status: 'unpaid' }, { mode: 'subscription' }]) {
    assert.equal(await f.fulfillOrder({ ...f.session('one'), ...state }), false);
  }
  assert.equal(f.counter(), 68);
  assert.equal(f.records.get('one').orderNumber, null);
  assert.equal(f.emails.length, 0);
});

test('payment confirmation assigns a number once despite concurrent delivery and retries', async () => {
  const f = fixture();
  const results = await Promise.all([f.fulfillOrder(f.session('one')), f.fulfillOrder(f.session('one'))]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await f.fulfillOrder(f.session('one')), false);
  assert.equal(f.records.get('one').orderNumber, 69);
  assert.equal(f.counter(), 69);
  assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].orderNumber, 69);
});

test('two completed orders receive consecutive numbers, including a free Stripe checkout', async () => {
  const f = fixture();
  await Promise.all([f.fulfillOrder(f.session('one')), f.fulfillOrder({ ...f.session('two'), payment_status: 'no_payment_required' })]);
  assert.deepEqual([...f.records.values()].map(o => o.orderNumber).sort(), [69, 70]);
});

test('a different Stripe session cannot confirm an existing checkout', async () => {
  const f = fixture();
  assert.equal(await f.fulfillOrder({ ...f.session('one'), id: 'wrong-session' }), false);
  assert.equal(f.counter(), 68);
});

test('a fully granted free order gets a number and a verifiable confirmation link', async () => {
  let created;
  const db = {
    $queryRaw: async () => [{ counter: "OrderNumberCounter", legacy: false }],
    sKU: { findMany: async () => [{ id: 'sku', productId: 'product', stock: 2, product: { price: 10000, optionGroups: [] } }], update: async () => {} },
    siteSetting: { findMany: async () => [] },
    subscription: { findUnique: async () => null },
    trainerGrant: { findMany: async () => [{ id: 'grant', productId: 'product' }], updateMany: async () => ({ count: 1 }) },
    orderNumberCounter: { upsert: async () => ({ value: 69 }) },
    order: { aggregate: async () => ({ _max: { orderNumber: 68 } }), create: async ({ data }) => { created = data; return { id: 'free-order' }; } },
    $transaction: async fn => fn(db),
  };
  const { POST } = load('app/api/checkout/route.ts', {
    '@/auth': { auth: async () => ({ user: { id: 'user' } }) },
    '@/lib/prisma': { prisma: db },
    stripe: class {},
  });
  const response = await POST({ json: async () => ({ deliveryMethod: 'PICKUP', items: [{ skuId: 'sku', productId: 'product', productName: 'Shirt', size: 'M', quantity: 1 }] }) });
  assert.equal(response.status, 200);
  assert.equal(created.status, 'PAID');
  assert.equal(created.orderNumber, 69);
  assert.equal((await response.json()).redirect, '/ordre-bekraeftelse?order_id=free-order');
});


test('service point order preserves snapshot and stores customer billing separately, once on webhook retries', async () => {
  const delivery = { carrier: 'dao', productCode: 'DAO_STS', pointId: '41384', name: 'SuperBrugsen', address: 'Vestergade 11', postcode: '6623', city: 'Vorbasse', country: 'DK' };
  const f = fixture({ delivery });
  const session = { ...f.session('one'), metadata: { orderId: 'one', servicePointId: '41384' }, customer_details: { name: 'Test Kunde', email: 'test@example.com', phone: '+4512345678', address: { line1: 'Kundevej 1', city: 'Billund', postal_code: '7190', country: 'DK' } } };
  assert.equal(await f.fulfillOrder(session), true);
  assert.equal(await f.fulfillOrder(session), false);
  assert.equal(f.addresses.length, 1);
  assert.equal(f.addresses[0].line1, 'Kundevej 1');
  assert.equal(f.records.get('one').addressId, 'customer-address');
  assert.equal(f.emails.length, 1);
  assert.equal(f.emails[0].delivery.pointId, '41384');
  assert.equal(f.emails[0].delivery.address, 'Vestergade 11');
});
