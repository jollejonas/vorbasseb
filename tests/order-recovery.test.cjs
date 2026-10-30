const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, { exports, console, process, require: n => mocks[n] ?? require(n) });
  return exports;
}
test('numbering supports legacy schema without touching the missing table', async () => {
  const { allocateOrderNumber } = load('lib/order-number.ts');
  let reads = 0;
  const tx = { $queryRaw: async () => ++reads === 1 ? [{ counter: null, legacy: true }] : [{ value: 71n }] };
  assert.equal(await allocateOrderNumber(tx, 70), 70);
  reads = 0;
  assert.equal(await allocateOrderNumber(tx), 71);
  await assert.rejects(allocateOrderNumber({ $queryRaw: async () => [{ counter: null, legacy: false }] }), /migration/);
});
test('missing counter row is initialized from existing numbers', async () => {
  const { allocateOrderNumber } = load('lib/order-number.ts');
  let args;
  const n = await allocateOrderNumber({ $queryRaw: async () => [{ counter: 'exists', legacy: false }], order: { aggregate: async () => ({ _max: { orderNumber: 80 } }) }, orderNumberCounter: { upsert: async input => { args = input; return { value: input.create.value }; } } });
  assert.equal(n, 81);
  assert.equal(args.update.value.increment, 1);
});
test('recovery authenticates admin, resolves payment to existing checkout and rejects unsafe states', async () => {
  let role = 'CUSTOMER', calls = 0, refunded = 0, status = 'complete';
  const order = { id: 'order', status: 'PENDING', stripeSessionId: 'cs_test' };
  const checkout = () => ({ id: 'cs_test', mode: 'payment', status, payment_status: 'paid', payment_intent: 'pi_test', metadata: { orderId: 'order' } });
  const { POST } = load('app/api/admin/reconcile-order/route.ts', {
    '@/auth': { auth: async () => ({ user: { role } }) },
    '@/lib/prisma': { prisma: { order: { findUnique: async () => order } } },
    '@/lib/fulfillOrder': { fulfillOrder: async () => { calls++; order.status = 'PAID'; order.orderNumber = 71; } },
    stripe: class { checkout = { sessions: { list: async () => ({ data: [checkout()] }) } }; paymentIntents = { retrieve: async () => ({ status: 'succeeded', latest_charge: { amount_refunded: refunded, disputed: false } }) }; },
  });
  const request = { json: async () => ({ reference: 'pi_test' }) };
  assert.equal((await POST(request)).status, 403);
  role = 'ADMIN'; status = 'open';
  assert.equal((await POST(request)).status, 409);
  status = 'complete'; refunded = 100;
  assert.equal((await POST(request)).status, 409);
  assert.equal(calls, 0);
  refunded = 0;
  const response = await POST(request);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).orderNumber, 71);
  assert.equal(calls, 1);
});
