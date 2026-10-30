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

function fixture() {
  const records = new Map(['one', 'two'].map(id => [id, { id, status: 'PENDING', stripeSessionId: `cs-${id}`, orderNumber: null, total: 100, items: [] }]));
  const emails = [];
  let counter = 68;
  const db = {
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
  const session = id => ({ id: `cs-${id}`, mode: 'payment', status: 'complete', payment_status: 'paid', metadata: { orderId: id }, customer_details: { email: 'test@example.com' } });
  return { fulfillOrder, records, emails, session, counter: () => counter };
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
