const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const bcrypt = require('bcryptjs');

// Exercise the real service with an in-memory database/mail boundary.
function setup() {
  const records = [];
  const sent = [];
  const user = { id: 'user-1', email: 'Member@example.com', passwordHash: 'old-hash' };
  let failMail = false;
  class DatabaseError extends Error { code = 'P2002'; }
  function matches(row, where) {
    return Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object') {
        if ('startsWith' in value) return row[key].startsWith(value.startsWith);
        if ('gt' in value) return row[key] > value.gt;
        if ('lte' in value) return row[key] <= value.lte;
      }
      return row[key] === value;
    });
  }
  const db = {
    verificationToken: {
      async create({ data }) {
        if (records.some(r => r.identifier === data.identifier && r.token === data.token)) throw new DatabaseError();
        records.push({ ...data });
      },
      async deleteMany({ where }) {
        let count = 0;
        for (let i = records.length - 1; i >= 0; i--) if (matches(records[i], where)) { records.splice(i, 1); count++; }
        return { count };
      },
      async findFirst({ where }) { return records.find(r => matches(r, where)) || null; },
    },
    user: {
      async findUnique({ where }) { return where.email === user.email ? user : null; },
      async findMany({ where }) { return where.email.equals.toLowerCase() === user.email.toLowerCase() ? [user] : []; },
      async update({ data }) { Object.assign(user, data); return user; },
    },
    async $transaction(fn) { return fn(db); },
  };
  const source = ts.transpileModule(fs.readFileSync('lib/password-reset.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, URL, Buffer, console,
    process: { env: { NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://club.example', RESEND_API_KEY: 'test', RESEND_FROM_EMAIL: 'club@example.com' } },
    require(name) {
      if (name === '@/lib/prisma') return { prisma: db };
      if (name === '@prisma/client') return { Prisma: { PrismaClientKnownRequestError: DatabaseError } };
      if (name === 'resend') return { Resend: class { emails = { send: async mail => {
        if (failMail) return { error: { message: 'rejected' } };
        sent.push(mail); return { error: null };
      } }; } };
      return require(name);
    },
  });
  return { service: exports, records, sent, user, failMail: () => { failMail = true; }, token: () => new URL(sent.at(-1).text.match(/https:\/\/\S+/)[0]).searchParams.get('token') };
}

test('sends a trusted link and stores only its hash, expiring in 15 minutes', async () => {
  const s = setup(); const before = Date.now();
  await s.service.requestPasswordReset('member@example.com');
  assert.equal(s.sent.length, 1);
  assert.equal(s.sent[0].to, 'Member@example.com');
  const token = s.token(); assert.match(token, /^[a-f0-9]{64}$/);
  const row = s.records.find(r => r.identifier === 'password-reset:user-1');
  assert.equal(row.token, s.service.hashResetToken(token)); assert.notEqual(row.token, token);
  assert.ok(row.expires.getTime() >= before + 900000);
});

test('unknown accounts do not send email', async () => {
  const s = setup(); await s.service.requestPasswordReset('unknown@example.com');
  assert.equal(s.sent.length, 0);
});

test('concurrent requests and changed email casing share a persistent cooldown', async () => {
  const s = setup();
  await Promise.all([s.service.requestPasswordReset('member@example.com'), s.service.requestPasswordReset('Member@example.com')]);
  assert.equal(s.sent.length, 1);
});

test('failed delivery removes the unusable reset token', async () => {
  const s = setup(); s.failMail();
  await assert.rejects(s.service.requestPasswordReset('Member@example.com'));
  assert.equal(s.records.filter(r => r.identifier.startsWith('password-reset:')).length, 0);
});

test('reset changes the password hash and rejects replay', async () => {
  const s = setup(); await s.service.requestPasswordReset('Member@example.com'); const token = s.token();
  assert.equal(await s.service.resetPassword(token, 'my-new-password'), true);
  assert.equal(await bcrypt.compare('my-new-password', s.user.passwordHash), true);
  assert.equal(await bcrypt.compare('old-password', s.user.passwordHash), false);
  assert.equal(await s.service.resetPassword(token, 'another-password'), false);
});

test('expired and altered tokens cannot change the password', async () => {
  const s = setup(); await s.service.requestPasswordReset('Member@example.com'); const token = s.token();
  assert.equal(await s.service.resetPassword('0'.repeat(64), 'my-new-password'), false);
  s.records.find(r => r.identifier === 'password-reset:user-1').expires = new Date(0);
  assert.equal(await s.service.resetPassword(token, 'my-new-password'), false);
  assert.equal(s.user.passwordHash, 'old-hash');
});

test('only one concurrent redemption of the same token succeeds', async () => {
  const s = setup(); await s.service.requestPasswordReset('Member@example.com'); const token = s.token();
  const results = await Promise.all([s.service.resetPassword(token, 'first-password'), s.service.resetPassword(token, 'second-password')]);
  assert.equal(results.filter(Boolean).length, 1);
});

test('reset invalidates other outstanding reset links for the account', async () => {
  const s = setup(); await s.service.requestPasswordReset('Member@example.com'); const first = s.token();
  s.records.find(r => r.identifier.startsWith('password-reset-cooldown:')).expires = new Date(0);
  await s.service.requestPasswordReset('Member@example.com'); const second = s.token();
  assert.equal(await s.service.resetPassword(second, 'new-password'), true);
  assert.equal(await s.service.resetPassword(first, 'older-link-password'), false);
});

test('password change revokes an old session and permits a fresh login', async () => {
  const user = { id: 'user-1', email: 'member@example.com', passwordHash: await bcrypt.hash('old-password', 4), clubRole: 'NONE' };
  let config;
  const source = ts.transpileModule(fs.readFileSync('auth.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports: {},
    require(name) {
      if (name === 'next-auth') return (options) => { config = options; return {}; };
      if (name === 'next-auth/providers/credentials') return options => options;
      if (name === '@/lib/prisma') return { prisma: {
        user: { findUnique: async () => user },
        subscription: { findUnique: async () => null },
      } };
      return require(name);
    },
  });
  const authorize = config.providers[0].authorize;
  const signedIn = await authorize({ email: user.email, password: 'old-password' });
  const token = await config.callbacks.jwt({ token: {}, user: signedIn });
  assert.equal(token.id, user.id);
  user.passwordHash = await bcrypt.hash('new-password', 4);
  assert.equal(await config.callbacks.jwt({ token }), null);
  assert.equal(await authorize({ email: user.email, password: 'old-password' }), null);
  const newUser = await authorize({ email: user.email, password: 'new-password' });
  assert.equal((await config.callbacks.jwt({ token: {}, user: newUser })).id, user.id);
});
