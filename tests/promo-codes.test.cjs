const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, { exports, console: { error() {} }, process: { env: { STRIPE_SECRET_KEY: 'test-placeholder' } }, URL, require(name) {
    if (name in mocks) return mocks[name];
    if (name.startsWith('@/lib/')) return load(name.replace('@/', '') + '.ts', mocks);
    return require(name);
  } });
  return exports;
}

const { promoCodeSchema, promoExpiry } = load('lib/promo-codes.ts');
const valid = { code: 'TRAENERJULESWEATER2026', type: 'fixed', amount: 275 };

test('rejects Danish letters and invalid discount input before contacting Stripe', () => {
  for (const change of [{ code: 'TRÆNER' }, { amount: NaN }, { amount: -1 }, { amount: 0 }, { type: 'percent', amount: 101 }, { maxUses: 1.5 }]) {
    assert.equal(promoCodeSchema.safeParse({ ...valid, ...change }).success, false);
  }
  assert.equal(promoCodeSchema.parse({ ...valid, code: ' test2026 ' }).code, 'TEST2026');
});

test('expiry includes the selected Danish day in both winter and summer', () => {
  assert.equal(new Date(promoExpiry('2030-11-02') * 1000).toISOString(), '2030-11-02T22:59:59.000Z');
  assert.equal(new Date(promoExpiry('2030-07-02') * 1000).toISOString(), '2030-07-02T21:59:59.000Z');
  assert.throws(() => promoExpiry('2030-02-31'));
});

function fixture({ role = 'ADMIN', failPromotion = false, missingProduct = false } = {}) {
  const coupons = []; const promotions = []; const deleted = []; const retrieved = [];
  const { POST } = load('app/api/admin/promo-codes/route.ts', {
    '@/auth': { auth: async () => ({ user: { role } }) },
    '@/lib/prisma': { prisma: { product: { findUnique: async ({ where }) => missingProduct ? null : { id: where.id, name: 'Julesweater' }, findMany: async () => [{ id: 'sweater', name: 'Julesweater' }, { id: 'shorts', name: 'Shorts' }] }, pakketilbud: { findMany: async () => [{ id: 'kit', name: 'Pakke' }] } } },
    stripe: class {
      products = { retrieve: async id => { retrieved.push(id); return { id }; } };
      coupons = { create: async args => { coupons.push(args); return { id: 'coupon-1' }; }, del: async id => deleted.push(id) };
      promotionCodes = { create: async args => { if (failPromotion) throw { type: 'StripeInvalidRequestError', param: 'code' }; promotions.push(args); return { id: 'promo-1', code: args.code }; } };
    },
  });
  return { coupons, promotions, retrieved, deleted, call: data => POST({ json: async () => data }) };
}

test('selected product restricts the Stripe coupon to its stable product identity', async () => {
  const f = fixture();
  assert.equal((await f.call({ ...valid, productId: 'sweater', maxUses: 3, expiryDate: '2030-11-02' })).status, 200);
  assert.equal(f.coupons[0].applies_to.products.join(','), 'vbk_sweater');
  assert.equal(f.coupons[0].amount_off, 27500);
  assert.equal(f.promotions[0].metadata.shopProductName, 'Julesweater');
  assert.equal(f.promotions[0].max_redemptions, 3);
  assert.equal(f.promotions[0].expires_at, f.coupons[0].redeem_by);
});

test('all-current-products code explicitly scopes products and bundles, excluding shipping', async () => {
  const f = fixture(); await f.call({ ...valid, type: 'percent', amount: 10 });
  assert.equal(f.coupons[0].applies_to.products.join(','), 'vbk_sweater,vbk_shorts,vbk_bundle_kit');
  assert.equal(f.coupons[0].percent_off, 10);
});

test('unauthorized, invalid, expired and deleted-product requests create no coupon', async () => {
  for (const [options, body, status] of [
    [{ role: 'CUSTOMER' }, valid, 401],
    [{}, { ...valid, code: 'TRÆNER' }, 400],
    [{}, { ...valid, expiryDate: '2020-01-01' }, 400],
    [{ missingProduct: true }, { ...valid, productId: 'deleted' }, 400],
  ]) {
    const f = fixture(options); assert.equal((await f.call(body)).status, status); assert.equal(f.coupons.length, 0);
  }
});

test('duplicate code returns a useful error and cleans up the unused coupon', async () => {
  const f = fixture({ failPromotion: true }); const result = await f.call(valid);
  assert.equal(result.status, 400); assert.match((await result.json()).error, /allerede i brug/);
  assert.equal(f.deleted.join(','), 'coupon-1');
});

test('product mapping is stable for coupons and checkout and handles simultaneous creation', async () => {
  const { ensureStripeProduct } = load('lib/stripe-products.ts');
  let attempts = 0;
  const stripe = { products: {
    retrieve: async id => { if (++attempts === 1) throw { code: 'resource_missing' }; return { id }; },
    create: async () => { throw { code: 'resource_already_exists' }; },
  } };
  assert.equal(await ensureStripeProduct(stripe, { id: 'sweater', name: 'Julesweater' }), 'vbk_sweater');
  assert.equal(attempts, 2);
});

test('mixed checkout uses distinct server product IDs; shipping has no eligible product ID', async () => {
  const sessions = [];
  const products = ['sweater', 'shorts'].map(id => ({
    id: `sku-${id}`, productId: id, stock: 10,
    product: { name: id, price: 10000, optionGroups: [], isGroupOrder: id === 'sweater' },
  }));
  const { POST } = load('app/api/checkout/route.ts', {
    '@/auth': { auth: async () => null },
    '@/lib/prisma': { prisma: {
      sKU: { findMany: async () => products }, siteSetting: { findMany: async () => [] },
      order: { create: async () => ({ id: 'order-mixed' }), update: async () => {} },
    } },
    stripe: class {
      products = { retrieve: async id => ({ id }) };
      checkout = { sessions: { create: async args => { sessions.push(args); return { id: 'cs-1', url: 'https://checkout.example/test' }; } } };
    },
  });
  const result = await POST({ json: async () => ({ items: products.map(sku => ({
    skuId: sku.id, productId: 'forged-client-id', productName: sku.product.name, size: 'M', quantity: 1,
  })) }) });
  assert.equal(result.status, 200);
  assert.equal(sessions[0].line_items[0].price_data.product, 'vbk_sweater');
  assert.equal(sessions[0].line_items[1].price_data.product, 'vbk_shorts');
  assert.equal(sessions[0].line_items.length, 2);
  assert.equal(sessions[0].shipping_options[0].shipping_rate_data.fixed_amount.amount, 4900);
  assert.equal(sessions[0].allow_promotion_codes, undefined);
});

test('sale replacement is opt-in and persisted on the Stripe code', async () => {
  const f = fixture();
  await f.call({ ...valid, productId: 'sweater', replacesSale: true });
  assert.equal(f.promotions[0].metadata.replacesSale, 'true');
  assert.equal(promoCodeSchema.parse(valid).replacesSale, false);
  assert.equal(promoCodeSchema.safeParse({ ...valid, replacesSale: 'true' }).success, false);
});

function saleFixture({ replacesSale = false, fixed, scoped = ['vbk_sweater'], member = false, grants = [], promoOverrides = {}, couponOverrides = {} } = {}) {
  const sessions = [], orders = [];
  const products = ['sweater', 'shorts'].map(id => ({
    id: `sku-${id}`, productId: id, stock: 100,
    product: { name: id, price: 32000, salePrice: id === 'sweater' ? 22000 : null,
      salePriceStart: new Date('2020-01-01'), salePriceEnd: new Date('2099-01-01'), optionGroups: [] },
  }));
  const promo = { id: 'promo-original', code: 'TEST', active: true, expires_at: null, max_redemptions: 5, times_redeemed: 0,
    restrictions: {}, metadata: { replacesSale: String(replacesSale) },
    promotion: { coupon: { id: 'coupon-original', valid: true, amount_off: fixed ?? null, percent_off: fixed === undefined ? 25 : null, currency: 'dkk', ...(scoped ? { applies_to: { products: scoped } } : {}), ...couponOverrides } }, ...promoOverrides };
  const { POST } = load('app/api/checkout/route.ts', {
    '@/auth': { auth: async () => member || grants.length ? { user: { id: 'user-1' } } : null },
    '@/lib/prisma': { prisma: {
      sKU: { findMany: async () => products }, siteSetting: { findMany: async () => [] },
      subscription: { findUnique: async () => ({ status: member ? 'ACTIVE' : 'INACTIVE' }) },
      trainerGrant: { findMany: async () => grants },
      order: { create: async args => { orders.push(args); return { id: 'order-sale' }; }, update: async () => {} },
    } },
    stripe: class {
      products = { retrieve: async id => ({ id }) };
      promotionCodes = { list: async () => ({ data: [promo] }) };
      checkout = { sessions: { create: async args => { sessions.push(args); return { id: 'cs-sale', url: 'https://checkout.example/test' }; } } };
    },
  });
  const items = products.map(sku => ({ skuId: sku.id, productId: 'forged', productName: sku.product.name, size: 'M', quantity: 1, price: 1, isOnSale: false, replacesSale: true }));
  return { sessions, orders, items, call: (changes = {}) => POST({ json: async () => ({ items, deliveryMethod: 'PICKUP', promoCode: 'TEST', ...changes }) }) };
}

test('replacement uses authoritative normal price, only for the selected product', async () => {
  const f = saleFixture({ replacesSale: true });
  const preview = await f.call({ preview: true });
  assert.equal(preview.status, 200);
  const quote = await preview.json();
  assert.equal(quote.subtotal, 80000); // normal 400 kr incl VAT + shorts 400 kr
  assert.equal(quote.discount, 10000); // 25% of sweater normal price
  assert.equal(quote.total, 70000);
  assert.equal(quote.lines[0].replacesSale, true);
  assert.equal(f.orders.length, 0); // applying a code never creates an order
  assert.equal(f.sessions.length, 0);
  assert.equal((await f.call()).status, 200);
  assert.equal(f.sessions[0].line_items[0].price_data.unit_amount, 40000);
  assert.equal(f.sessions[0].line_items[0].price_data.product, 'vbk_sweater');
  assert.equal(f.sessions[0].line_items[1].price_data.product, undefined);
  assert.equal(f.sessions[0].discounts[0].promotion_code, 'promo-original');
  assert.equal(f.sessions[0].allow_promotion_codes, undefined);
  assert.equal(f.orders[0].data.total, quote.total);
  assert.equal(f.orders[0].data.items.create[0].priceAtPurchase, 32000);
});

test('unchecked code leaves sale prices intact and discounts other eligible lines', async () => {
  const f = saleFixture({ scoped: ['vbk_sweater', 'vbk_shorts'] });
  const quote = await (await f.call({ preview: true })).json();
  assert.equal(quote.subtotal, 67500);
  assert.equal(quote.discount, 10000);
  assert.equal(quote.total, 57500);
  await f.call();
  assert.equal(f.sessions[0].line_items[0].price_data.unit_amount, 27500);
  assert.equal(f.sessions[0].line_items[0].price_data.product, undefined); // excluded from native coupon
  assert.equal(f.sessions[0].line_items[1].price_data.product, 'vbk_shorts');
});

test('fixed code is capped to eligible normal-price items, never other goods or shipping', async () => {
  const f = saleFixture({ replacesSale: true, fixed: 99900 });
  const quote = await (await f.call({ preview: true })).json();
  assert.equal(quote.discount, 40000);
  assert.equal(quote.total, 40000);
  const one = await (await f.call({ items: [f.items[0]], preview: true, deliveryMethod: 'SHIPPING' })).json();
  assert.equal(one.total, 4900);
  await f.call({ items: [f.items[0]], deliveryMethod: 'SHIPPING' });
  assert.equal(f.sessions[0].shipping_options[0].shipping_rate_data.fixed_amount.amount, 4900);
});

test('no applicable lines and legacy unscoped codes fail before creating an order', async () => {
  for (const options of [{}, { scoped: null }, { scoped: ['vbk_other'], replacesSale: true }]) {
    const f = saleFixture(options);
    const result = await f.call({ items: [f.items[0]] });
    assert.equal(result.status, 400);
    assert.equal(f.orders.length, 0);
  }
});

test('invalid, expired, exhausted and minimum-amount codes are rejected', async () => {
  for (const promoOverrides of [{ active: false }, { expires_at: 1 }, { times_redeemed: 5 }, { restrictions: { minimum_amount: 100000, minimum_amount_currency: 'dkk' } }]) {
    const f = saleFixture({ replacesSale: true, promoOverrides });
    assert.equal((await f.call()).status, 400);
    assert.equal(f.orders.length, 0);
  }
});

test('code replaces membership discount and rejects a combination with grants', async () => {
  const f = saleFixture({ replacesSale: true, member: true });
  const quote = await (await f.call({ preview: true })).json();
  assert.equal(quote.discount, 10000);
  const g = saleFixture({ replacesSale: true, grants: [{ id: 'grant-1', productId: 'sweater' }] });
  assert.equal((await g.call()).status, 400);
  assert.equal(g.orders.length, 0);
});

test('fixed discount is once per order even with multiple sizes/quantities', async () => {
  const f = saleFixture({ replacesSale: true, fixed: 27500 });
  const quote = await (await f.call({ preview: true, items: [{ ...f.items[0], quantity: 2 }] })).json();
  assert.equal(quote.subtotal, 80000);
  assert.equal(quote.discount, 27500);
  assert.equal(quote.total, 52500);
});

test('275 kr code replaces a 275 kr sale using the 400 kr normal price; removing it restores sale', async () => {
  const f = saleFixture({ replacesSale: true, fixed: 27500 });
  const quote = await (await f.call({ preview: true, items: [f.items[0]] })).json();
  assert.equal(quote.total, 12500);
  const removed = await (await f.call({ preview: true, items: [f.items[0]], promoCode: '' })).json();
  assert.equal(removed.total, 27500);
  assert.equal(removed.discount, 0);
  assert.equal(removed.lines[0].replacesSale, false);
  assert.equal(f.orders.length, 0);
});
