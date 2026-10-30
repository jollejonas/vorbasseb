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
    '@/lib/prisma': { prisma: { product: { findUnique: async ({ where }) => missingProduct ? null : { id: where.id, name: 'Julesweater' } } } },
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

test('all-products code remains unrestricted', async () => {
  const f = fixture(); await f.call({ ...valid, type: 'percent', amount: 10 });
  assert.equal(f.coupons[0].applies_to, undefined);
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
  assert.equal(sessions[0].line_items[2].price_data.product, undefined);
  assert.equal(sessions[0].line_items[2].price_data.product_data.name, 'Fragt (Danmark)');
  assert.equal(sessions[0].allow_promotion_codes, true);
});
