const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, process: { env: { RESEND_FROM_EMAIL: 'Club <shop@example.com>' } }, require(n) { return mocks[n] ?? require(n); } });
  return exports;
}
const input = { orderId: 'order', requestKey: 'request', kind: 'UPDATE', automatic: false, triggeredBy: 'Admin', from: 'shop@example.com', to: 'customer@example.com', subject: 'Opdatering', html: '<p>Præcist indhold</p>' };
function fixture(send) {
  const rows = []; const calls = [];
  const db = { orderEmail: {
    create: async ({ data }) => {
      if (data.requestKey && rows.some(r => r.requestKey === data.requestKey)) throw { code: 'P2002' };
      const row = { id: `mail-${rows.length}`, status: 'PENDING', ...data };
      rows.push(row); return row;
    },
    findUnique: async ({ where }) => rows.find(r => r.requestKey === where.requestKey),
    update: async ({ where, data }) => Object.assign(rows.find(r => r.id === where.id), data),
  } };
  const api = load('lib/order-email.ts', {
    '@/lib/prisma': { prisma: db },
    resend: { Resend: class { emails = { send: async (...args) => { assert.equal(rows.length, 1); calls.push(args); return send(...args); } }; } },
  });
  return { ...api, rows, calls, db };
}
test('stores exact envelope/content before sending; acceptance has provider ID and timestamp', async () => {
  const f = fixture(async () => ({ data: { id: 'provider-id' } }));
  const result = await f.sendOrderEmail(input);
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(result.html, input.html);
  assert.equal(result.triggeredBy, 'Admin');
  assert.equal(result.automatic, false);
  assert.equal(result.providerId, 'provider-id');
  assert.ok(result.sentAt);
  assert.equal(f.calls[0][0].to, input.to);
  assert.equal(f.calls[0][1].idempotencyKey, 'order-email/mail-0');
  await f.sendOrderEmail(input);
  assert.equal(f.calls.length, 1);
});
test('rejection and transport uncertainty are distinct; retries do not send twice', async () => {
  for (const [send, status] of [[async () => ({ error: { message: 'rejected' } }), 'FAILED'], [async () => { throw Error('timeout'); }, 'UNKNOWN']]) {
    const f = fixture(send);
    assert.equal((await f.sendOrderEmail(input)).status, status);
    assert.ok(f.rows[0].error);
    assert.equal(f.rows[0].sentAt, undefined);
    await f.sendOrderEmail(input);
    assert.equal(f.calls.length, 1);
  }
});
test('no unrecorded sends when database logging fails; HTML escapes manual text', async () => {
  const f = fixture(async () => ({ data: { id: 'ok' } }));
  f.db.orderEmail.create = async () => { throw Error('database unavailable'); };
  await assert.rejects(f.sendOrderEmail(input));
  assert.equal(f.calls.length, 0);
  const html = f.manualOrderEmailHtml('<script>alert(1)</script>\nHej & tak', 58);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<br \/>Hej &amp; tak/);
  assert.match(html, /ordre #58/);
});
test('manual endpoint requires admin, validates input and uses stored recipient and actual admin', async () => {
  let session = null; let sent;
  const { POST } = load('app/api/orders/[id]/emails/route.ts', {
    '@/auth': { auth: async () => session },
    '@/lib/prisma': { prisma: { order: { findUnique: async () => ({ id: 'order', orderNumber: 58, guestEmail: 'real@example.com' }) } } },
    '@/lib/order-email': { manualOrderEmailHtml: s => s, sendOrderEmail: async args => { sent = args; return { status: 'ACCEPTED' }; } },
  });
  const request = data => ({ json: async () => data });
  const params = { params: Promise.resolve({ id: 'order' }) };
  assert.equal((await POST(request({}), params)).status, 403);
  session = { user: { role: 'ADMIN', name: 'Test Admin', email: 'admin@example.com' } };
  assert.equal((await POST(request({ subject: 'Hi\nBcc:', message: 'Hi', requestKey: 'invalid' }), params)).status, 400);
  assert.equal((await POST(request({ subject: 'Update', message: 'Ready', requestKey: '9c7ce61f-fde5-4e59-8c09-c856761afaca', to: 'attacker@example.com' }), params)).status, 200);
  assert.equal(sent.to, 'real@example.com');
  assert.equal(sent.automatic, false);
  assert.match(sent.triggeredBy, /admin@example.com/);
});

test('missing history table and other history read failures leave the order readable', async () => {
  for (const error of [{ code: 'P2021' }, { code: 'P1001' }]) {
    const { loadOrderEmailHistory } = load('lib/order-email-history.ts', {
      '@/lib/prisma': { prisma: { orderEmail: { findMany: async () => { throw error; } } } },
    });
    const result = await loadOrderEmailHistory('order');
    assert.equal(result.available, false);
    assert.equal(result.emails.length, 0);
  }
});
test('missing table preserves automatic email delivery but never sends unlogged manual mail', async () => {
  const calls = [];
  let failure = { code: 'P2021', meta: { modelName: 'OrderEmail', table: 'public.OrderEmail' } };
  const { sendOrderEmail } = load('lib/order-email.ts', {
    '@/lib/prisma': { prisma: { orderEmail: { create: async () => { throw failure; } } } },
    resend: { Resend: class { emails = { send: async (...args) => { calls.push(args); return { data: { id: 'accepted' } }; } }; } },
  });
  const result = await sendOrderEmail({ ...input, automatic: true, kind: 'CONFIRMATION' });
  assert.equal(result.status, 'ACCEPTED');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].idempotencyKey, 'order-email-rollout/order/CONFIRMATION');
  await assert.rejects(sendOrderEmail(input));
  failure = { code: 'P1001' };
  await assert.rejects(sendOrderEmail({ ...input, automatic: true }));
  failure = { code: 'P2021', meta: { table: 'public.Unrelated' } };
  await assert.rejects(sendOrderEmail({ ...input, automatic: true }));
  assert.equal(calls.length, 1);
});
