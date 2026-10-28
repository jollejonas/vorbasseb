const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, mocks = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, console, process, URL, require(name) {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/lib/')) return load(name.replace('@/', '') + '.ts', mocks);
    return require(name);
  } });
  return exports;
}

const availability = load('lib/availability.ts');
const product = { id: 'product-1', name: 'Julesweater', slug: 'julesweater', isGroupOrder: true, price: 20000, images: [], description: '', groupOrderDeadline: new Date('2026-11-10T22:59:00Z') };
const sku = { id: 'sku-1', productId: product.id, size: 'M', stock: 0, optionValues: [{ optionValueId: 'medium' }] };

test('preorders can be purchased with zero or negative legacy stock, but require a valid SKU and quantity', () => {
  assert.equal(availability.canPurchaseSku(product, sku, 4), true);
  assert.equal(availability.canPurchaseSku(product, { stock: -2 }), true);
  assert.equal(availability.canPurchaseSku(product, null), false);
  for (const quantity of [0, -1, 1.5, NaN]) assert.equal(availability.canPurchaseSku(product, sku, quantity), false);
  assert.equal(availability.canPurchaseSku({ isGroupOrder: false }, sku), false);
  assert.equal(availability.canPurchaseSku({ isGroupOrder: false }, { stock: 3 }, 4), false);
  assert.equal(availability.canPurchaseSku({ isGroupOrder: false }, { stock: 3 }, 3), true);
});

test('actual size selector enables zero-stock preorders and still disables regular sold-out sizes', () => {
  const { ProductOptionsSection } = load('components/shop/ProductOptionsSection.tsx', {
    './CartProvider': { useCart: () => ({ addItem() {} }) },
    './GroupOrderConfirmDialog': { GroupOrderConfirmDialog: () => null },
    '@/lib/sanitizeHtml': { sanitizeHtml: s => s },
  });
  const props = { product, skus: [sku], optionGroups: [{ id: 'sizes', type: 'SIZE', label: 'Størrelse', values: [{ id: 'medium', label: 'M' }] }] };
  const preorder = renderToStaticMarkup(React.createElement(ProductOptionsSection, props));
  assert.match(preorder, /Forudbestil/);
  assert.doesNotMatch(preorder.match(/<button[^>]*>M<\/button>/)[0], /disabled/);
  const regular = renderToStaticMarkup(React.createElement(ProductOptionsSection, { ...props, product: { ...product, isGroupOrder: false } }));
  assert.match(regular.match(/<button[^>]*>M<\/button>/)[0], /disabled/);
});

function checkoutFixture(isGroupOrder, stock = 0) {
  const stripeCalls = [];
  const orders = [];
  const persisted = { ...sku, stock, product: { ...product, isGroupOrder, optionGroups: [] } };
  const { POST } = load('app/api/checkout/route.ts', {
    '@/auth': { auth: async () => null },
    '@/lib/prisma': { prisma: {
      sKU: { findMany: async () => [persisted] },
      siteSetting: { findMany: async () => [] },
      order: { create: async args => { orders.push(args); return { id: 'order-1' }; }, update: async () => {} },
    } },
    stripe: class { checkout = { sessions: { create: async args => { stripeCalls.push(args); return { id: 'session-1', url: 'https://checkout.example/test' }; } } }; },
  });
  return { stripeCalls, orders, call: items => POST({ json: async () => ({ items, deliveryMethod: 'PICKUP' }) }) };
}

const cartItem = { skuId: sku.id, productId: product.id, productName: product.name, size: 'M', quantity: 1, price: product.price };
test('checkout accepts a persisted preorder at stock zero and retains its hold deadline', async () => {
  const f = checkoutFixture(true);
  const response = await f.call([cartItem]);
  assert.equal(response.status, 200);
  assert.equal(f.stripeCalls.length, 1);
  assert.equal(f.orders[0].data.groupOrderHoldUntil.toISOString(), product.groupOrderDeadline.toISOString());
});

test('checkout rejects a spoofed preorder flag for an ordinary sold-out product', async () => {
  const f = checkoutFixture(false);
  assert.equal((await f.call([{ ...cartItem, isGroupOrder: true }])).status, 400);
  assert.equal(f.stripeCalls.length, 0);
});

test('checkout sums quantities across cart lines and rejects missing SKUs', async () => {
  const f = checkoutFixture(false, 1);
  assert.equal((await f.call([cartItem, cartItem])).status, 400);
  assert.equal((await f.call([{ ...cartItem, skuId: 'missing' }])).status, 400);
  assert.equal(f.stripeCalls.length, 0);
});

test('fulfillment leaves preorder stock at zero and sends no low-stock alert', async () => {
  for (const isGroupOrder of [true, false]) {
    const updates = []; const alerts = [];
    const storedSku = { ...sku, product: { ...product, isGroupOrder } };
    const db = {
      order: { findUnique: async () => ({ id: 'order-1', status: 'PENDING', total: 20000, items: [{ skuId: sku.id, sku: storedSku, quantity: 1, priceAtPurchase: 20000 }] }), update: async () => {} },
      sKU: { update: async args => updates.push(args), findUnique: async () => storedSku },
      $transaction: async fn => fn(db),
    };
    const { fulfillOrder } = load('lib/fulfillOrder.ts', {
      '@/lib/prisma': { prisma: db },
      '@/lib/email': { sendOrderConfirmation: async () => {}, sendLowStockAlert: async (...args) => alerts.push(args) },
    });
    assert.equal(await fulfillOrder({ mode: 'payment', id: 'session-1', metadata: { orderId: 'order-1' } }), true);
    assert.equal(updates.length, isGroupOrder ? 0 : 1);
    assert.equal(alerts.length, isGroupOrder ? 0 : 1);
  }
});
