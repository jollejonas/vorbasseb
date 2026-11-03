const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, console, URL, AbortSignal, process: { env: { SHIPMONDO_DELIVERY_CHECKOUT_KEY: 'test-only-key' } }, ...globals, require(name) {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/lib/')) return load(name.replace('@/', '') + '.ts', mocks, globals);
    return require(name);
  } });
  return exports;
}
const selection = { carrier: 'gls', postcode: '6623', pointId: '96280' };
const point = { id: '96280', name: 'SuperBrugsen Vorbasse', address: 'Vestergade 11', zipcode: '6623', city: 'Vorbasse', country: 'DK', carrier_code: 'gls', pickup_allowed: true, opening_hours: ['Monday: 08:00-19:45'] };
const snapshot = { carrier: 'gls', productCode: 'GLSDK_SD', pointId: point.id, name: point.name, address: point.address, postcode: point.zipcode, city: point.city, country: 'DK' };

test('selection rejects unknown carriers, malformed postcodes, invalid IDs and extra trusted fields', () => {
  const { parseDeliverySelection } = load('lib/delivery.ts');
  for (const bad of [null, {}, { ...selection, carrier: '__proto__' }, { ...selection, postcode: '6623&x=1' }, { ...selection, pointId: '' }, { ...selection, pointId: '<script>' }]) assert.equal(parseDeliverySelection(bad), null);
  assert.equal(JSON.stringify(parseDeliverySelection({ ...selection, address: 'Forged', productCode: 'Wrong' })), JSON.stringify(selection));
});

test('lookup uses fixed product/country and strips unavailable, foreign and malformed locations', async () => {
  const urls = [];
  const api = load('lib/shipmondo.ts', {}, { fetch: async url => {
    urls.push(url);
    return { ok: true, json: async () => [point, { ...point, id: 'closed', pickup_allowed: false }, { ...point, id: 'foreign', country: 'DE' }, { ...point, id: 'wrong', carrier_code: 'dao' }, { ...point, name: null }] };
  } });
  const results = await api.servicePoints('gls', '6623');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, point.id);
  assert.equal(urls[0].searchParams.get('product_code'), 'GLSDK_SD');
  assert.equal(urls[0].searchParams.get('country_code'), 'DK');
  assert.equal(urls[0].searchParams.get('frontend_key'), 'test-only-key');
  await api.servicePoints('gls', '6623');
  assert.equal(urls.length, 1, 'public repeated search uses bounded short-lived cache');
  const trusted = await api.validateDelivery({ ...selection, name: 'Forged', address: 'Fake' });
  assert.equal(trusted.address, point.address);
  assert.equal(urls.length, 2, 'checkout revalidates availability rather than trusting cache');
  assert.equal(await api.validateDelivery({ ...selection, pointId: 'deleted-shop' }), null);
});

test('provider failures and missing key fail closed without leaking key or URL', async () => {
  for (const globals of [
    { fetch: async () => { throw new Error('https://provider?frontend_key=test-only-key'); } },
    { fetch: async () => ({ ok: false, status: 401 }) },
    { fetch: async () => ({ ok: true, json: async () => ({ error: 'bad' }) }) },
    { process: { env: {} }, fetch: async () => { assert.fail('should not fetch without key'); } },
  ]) {
    const api = load('lib/shipmondo.ts', {}, globals);
    await assert.rejects(api.servicePoints('gls', '6623'), e => e instanceof api.ShippingUnavailable && !/test-only-key|https:/.test(e.message));
  }
});

function checkoutFixture({ invalidPoint = false, providerDown = false, dbDown = false } = {}) {
  const events = [], orders = [], sessions = [];
  const item = { skuId: 'sku-1', productId: 'shirt', productName: 'Trøje', size: 'M', quantity: 1 };
  const { POST } = load('app/api/checkout/route.ts', {
    '@/auth': { auth: async () => null },
    '@/lib/shipmondo': { validateDelivery: async () => { events.push('validate'); if (providerDown) throw Error('unavailable'); return invalidPoint ? null : snapshot; } },
    '@/lib/stripe-products': { ensureStripeProduct: async () => 'vbk_shirt' },
    '@/lib/prisma': { prisma: {
      sKU: { findMany: async () => [{ id: 'sku-1', productId: 'shirt', stock: 10, product: { name: 'Trøje', price: 22000, optionGroups: [] } }] },
      siteSetting: { findMany: async () => [] },
      order: { create: async args => { events.push('persist'); if (dbDown) throw Error('missing table'); orders.push(args); return { id: 'order-1' }; }, update: async () => {} },
    } },
    stripe: class { checkout = { sessions: { create: async args => { events.push('stripe'); sessions.push(args); return { id: 'cs-1', url: 'https://checkout.example/test' }; } } }; },
  });
  return { events, orders, sessions, call: changes => POST({ json: async () => ({ items: [item], deliveryMethod: 'SHIPPING', deliverySelection: selection, ...changes }) }) };
}

test('shipping persists trusted point atomically before Stripe and charges exactly 49 kr', async () => {
  const f = checkoutFixture();
  assert.equal((await f.call({})).status, 200);
  assert.deepEqual(f.events, ['validate', 'persist', 'stripe']);
  assert.equal(f.orders[0].data.delivery.create, snapshot);
  assert.equal(f.orders[0].data.shippingFee, 4900);
  assert.equal(f.orders[0].data.total, 27500 + 4900);
  assert.equal(f.sessions[0].shipping_options[0].shipping_rate_data.fixed_amount.amount, 4900);
  assert.equal(f.sessions[0].shipping_options[0].shipping_rate_data.display_name, 'GLS PakkeShop');
  assert.equal(f.sessions[0].metadata.servicePointId, point.id);
  assert.equal(f.sessions[0].shipping_address_collection, undefined);
  assert.equal(f.sessions[0].billing_address_collection, 'required');
});

test('invalid delivery, missing/deleted point and provider/database outage cannot start payment', async () => {
  for (const [opts, request, status] of [
    [{}, { deliveryMethod: 'HACK' }, 400], [{}, { deliverySelection: null }, 400],
    [{ invalidPoint: true }, {}, 400], [{ providerDown: true }, {}, 503], [{ dbDown: true }, {}, 503],
  ]) {
    const f = checkoutFixture(opts);
    assert.equal((await f.call(request)).status, status);
    assert.equal(f.sessions.length, 0);
    assert.equal(f.orders.length, 0);
  }
});

test('club pickup and quote previews need no service point and ignore stale selections', async () => {
  const f = checkoutFixture({ providerDown: true });
  assert.equal((await f.call({ preview: true, deliverySelection: null })).status, 200);
  assert.equal(f.events.length, 0);
  assert.equal((await f.call({ deliveryMethod: 'PICKUP' })).status, 200);
  assert.equal(f.events.includes('validate'), false);
  assert.equal(f.orders[0].data.delivery, undefined);
  assert.equal(f.orders[0].data.shippingFee, 0);
  assert.equal(f.sessions[0].shipping_options, undefined);
});

test('old orders remain readable without delivery migration, while other database failures surface', async () => {
  const missing = load('lib/order-delivery.ts', { '@/lib/prisma': { prisma: { orderDelivery: { findUnique: async () => { throw { code: 'P2021' }; } } } } });
  assert.equal(await missing.loadOrderDelivery('legacy'), null);
  const broken = load('lib/order-delivery.ts', { '@/lib/prisma': { prisma: { orderDelivery: { findUnique: async () => { throw { code: 'P1001' }; } } } } });
  await assert.rejects(broken.loadOrderDelivery('new'));
});

test('confirmation email safely includes exact carrier and point snapshot', async () => {
  let sent;
  const { sendOrderConfirmation } = load('lib/email.ts', {
    resend: { Resend: class {} }, '@/lib/order-email': { sendOrderEmail: async args => { sent = args; } },
    '@/lib/prisma': { prisma: { siteSetting: { findUnique: async () => null } } },
  });
  await sendOrderConfirmation({ to: 'test@example.com', orderId: 'order-1', orderTotal: 32400, deliveryMethod: 'SHIPPING', delivery: { ...snapshot, name: 'Shop <test>' }, items: [] });
  assert.match(sent.html, /GLS PakkeShop/);
  assert.match(sent.html, /Shop &lt;test&gt;/);
  assert.match(sent.html, /Vestergade 11/);
  assert.match(sent.html, /6623 Vorbasse/);
});
