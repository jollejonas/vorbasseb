const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/purchase-summary.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsForTest });
const { purchaseLines, summarizePurchases, purchaseCsv, purchaseClipboard } = exportsForTest;
const sku = (size, name = 'Julesweater') => ({ id: `${name}-${size}`, size, itemNumber: `VBK-${size}`, product: { name } });
const item = (size, quantity = 1, extra = {}) => ({ id: size, sku: sku(size), quantity, colorName: 'Blå', customName: null, customNumber: null, optionSelections: [], ...extra });
const order = (number, items, extra = {}) => ({ orderNumber: number, status: 'PAID', refunded: false, createdAt: new Date('2026-10-30T23:30:00Z'), total: 0, items, ...extra });
test('zero-price orders count, matching sizes aggregate, cancelled/refunded/pending orders do not', () => {
  const rows = summarizePurchases(purchaseLines([
    order(72, [item('XL')]), order(73, [item('XL')]), order(71, [item('XL')], { total: 27500 }),
    order(74, [item('XXL')]), order(75, [item('M')]),
    order(76, [item('XL')], { status: 'CANCELLED' }), order(77, [item('XL')], { refunded: true }),
    order(null, [item('XL')], { status: 'PENDING' }),
  ]));
  assert.equal(rows.length, 3);
  assert.equal(rows.reduce((sum, r) => sum + r.quantity, 0), 5);
  assert.equal(rows.find(r => r.size === 'XL').quantity, 3);
  assert.equal(rows[0].size, 'M');
  assert.equal(rows[0].date, '2026-10-31');
});
test('bundle components multiply by bundle count and prints stay separate', () => {
  const lines = purchaseLines([
    order(1, [item('M', 2, { sku: null, optionSelections: { isPakketilbud: true, items: [{ skuId: 'Julesweater-M', productName: 'Julesweater', size: 'M', colorName: 'Blå' }, { skuId: 'Shorts-M', productName: 'Shorts', size: 'M' }] } })]),
    order(2, [item('M', 1, { customName: 'Anne' }), item('M', 1, { customName: 'Bo' })]),
  ], [sku('M'), sku('M', 'Shorts')]);
  const rows = summarizePurchases(lines);
  assert.equal(rows.length, 4);
  assert.equal(rows.reduce((sum, r) => sum + r.quantity, 0), 6);
  assert.ok(rows.some(r => r.print === 'Navn: Anne' && r.quantity === 1));
  assert.ok(rows.some(r => r.product === 'Shorts' && r.itemNumber === 'VBK-M' && r.quantity === 2));
});
test('CSV preserves Danish characters, quotes and item numbers, and neutralizes formulas for copy/export', () => {
  const rows = summarizePurchases(purchaseLines([order(1, [item('M', 1, { sku: { ...sku('M'), itemNumber: '00042', product: { name: '=HYPERLINK("bad")' } }, customName: 'Søren' })])]));
  const csv = purchaseCsv(rows);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  assert.match(csv, /Søren/);
  assert.match(csv, /"00042"/);
  assert.match(csv, /'\=HYPERLINK\(""bad""\)/);
  assert.match(purchaseClipboard(rows), /'\=HYPERLINK/);
});
