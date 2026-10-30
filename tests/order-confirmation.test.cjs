const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, process, URL, require(name) { return mocks[name] ?? require(name); } });
  return exports;
}
test('image uses purchased option, legacy colour, then product fallback', () => {
  const { orderImage } = load('lib/order-image.ts');
  const sku = { product: { images: ['base'] }, colorVariant: { images: ['blue'] }, optionValues: [{ optionValue: { images: ['red'] } }] };
  assert.equal(orderImage(sku), 'red');
  assert.equal(orderImage({ ...sku, optionValues: [] }), 'blue');
  assert.equal(orderImage({ product: sku.product }), 'base');
  assert.equal(orderImage(null), undefined);
});
test('confirmation renders safe photos, quantities, pickup and Copenhagen deadline; retains custom templates', async () => {
  let sent;
  let template;
  const { sendOrderConfirmation } = load('lib/email.ts', {
    resend: { Resend: class { emails = { send: async value => { sent = value; } }; } },
    '@/lib/prisma': { prisma: { siteSetting: { findUnique: async ({ where }) => where.key === 'email_order_body' && template ? { value: template } : null } } },
  });
  const data = { to: 'preview@example.com', customerName: 'Test <kunde>', orderNumber: 54, orderTotal: 52500, deliveryMethod: 'PICKUP', groupOrderHoldUntil: new Date('2026-11-10T22:59:00Z'), items: [
    { productName: 'Trøje <blå>', size: 'M', imageUrl: '/product.jpg', quantity: 2, price: 25000 },
    { productName: 'Pakketilbud', photos: [{ url: 'https://example.com/shirt.jpg', name: 'Trøje' }, { url: 'javascript:alert(1)', name: 'Unsafe' }], quantity: 1, price: 2500 },
  ] };
  await sendOrderConfirmation(data);
  assert.match(sent.html, /https:\/\/shop.vorbasseboldklub.dk\/product.jpg/);
  assert.match(sent.html, /shirt.jpg/);
  assert.doesNotMatch(sent.html, /javascript:/);
  assert.match(sent.html, /Trøje &lt;blå&gt;/);
  assert.match(sent.html, /500,00/);
  assert.match(sent.html, /525,00/);
  assert.match(sent.html, /Afhentning ved klubben/);
  assert.match(sent.html, /23[.:]59/);
  assert.match(sent.html, /#54/);
  template = '<h2>Klubbens egen tekst</h2>{{items}} {{total}}';
  await sendOrderConfirmation(data);
  assert.match(sent.html, /Klubbens egen tekst/);
  assert.match(sent.html, /product.jpg/);
});

test('admin print view renders ordinary and package product photos and pickup details', async () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const sku = { id: 'sku', size: 'M', itemNumber: 'VBK-M', product: { name: 'Trøje', images: ['https://example.com/base.jpg'] }, colorVariant: { images: ['https://example.com/blue.jpg'] } };
  const order = { id: 'order', orderNumber: 54, status: 'PAID', deliveryMethod: 'PICKUP', createdAt: new Date(), shippingFee: 0, total: 52500, discountApplied: 0, items: [
    { id: 'a', sku, quantity: 1, priceAtPurchase: 22000, optionSelections: [] },
    { id: 'b', quantity: 1, priceAtPurchase: 20000, optionSelections: { isPakketilbud: true, pakketilbudName: 'Pakke', items: [{ skuId: 'sku', productName: 'Trøje', size: 'M' }] } },
  ] };
  const Page = load('app/(admin)/admin/ordrer/[id]/page.tsx', {
    '@/lib/order-image': load('lib/order-image.ts'),
    '@/auth': { auth: async () => ({ user: { role: 'ADMIN' } }) },
    '@/lib/prisma': { prisma: { order: { findUnique: async () => order }, sKU: { findMany: async () => [sku] } } },
    '@/lib/utils': { formatPrice: n => String(n / 100) },
    'next/link': { default: ({ children }) => children, __esModule: true },
    'next/navigation': {},
    '@/components/admin/AdminOrderActions': { AdminOrderActions: () => null },
    '@/components/admin/PrintPreviewModal': { PrintPreviewModal: () => null },
    '@/components/admin/PrintButton': { PrintButton: () => null },
  }).default;
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: 'order' }) }));
  assert.equal((html.match(/<img /g) || []).length, 2);
  assert.match(html, /blue.jpg/);
  assert.match(html, /Afhentning ved klubben/);
  assert.doesNotMatch(html, /Ingen adresse gemt/);
  assert.match(html, /ekskl. moms/);
});
