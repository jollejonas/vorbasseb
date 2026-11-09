const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/order-vat-storage.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsObject });
const { readOrderVatRate, storeOrderVatRate } = exportsObject;

test('unmigrated database uses 25% without querying or writing the missing column', async () => {
  const db = {
    $queryRaw: async strings => { assert.match(strings.join(''), /information_schema.columns/); return [{ installed: false }]; },
    $executeRaw: async () => assert.fail('Must not update a missing column'),
  };
  assert.equal(await readOrderVatRate(db, 'order'), 25);
  await storeOrderVatRate(db, 'order', 25);
});

test('migrated database reads and writes the snapshot with bound parameters', async () => {
  const db = {
    $queryRaw: async (strings, id) => {
      if (strings.join('').includes('information_schema')) return [{ installed: true }];
      assert.equal(id, 'order'); return [{ vatRate: 10 }];
    },
    $executeRaw: async (strings, rate, id) => { assert.match(strings.join(''), /UPDATE "Order"/); assert.equal(rate, 10); assert.equal(id, 'order'); },
  };
  assert.equal(await readOrderVatRate(db, 'order'), 10);
  await storeOrderVatRate(db, 'order', 10);
});

test('Prisma normal order queries no longer expose the optional column', () => {
  const { Prisma } = require('@prisma/client');
  assert.equal(Prisma.OrderScalarFieldEnum.vatRate, undefined);
  assert.equal(Prisma.OrderScalarFieldEnum.total, 'total');
});
