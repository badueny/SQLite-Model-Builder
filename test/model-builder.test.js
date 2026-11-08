const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { initDB, Model } = require('../index');

const drivers = ['sqlite3', 'node:sqlite'];
const [major, minor] = process.versions.node.split('.').map(Number);
const hasNodeSQLite = major > 22 || (major === 22 && minor >= 13);
for (const driver of drivers) {
  const options = { skip: driver === 'node:sqlite' && !hasNodeSQLite };
  test(`${driver}: model CRUD, bindings and transactions`, options, async () => {
    const db = await initDB({ memory: true, driver });
    try {
      await db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT UNIQUE, age INTEGER, data BLOB)');
      const users = Model('users');
      assert.deepEqual(await users.insert({ name: 'Alice', age: 25 }), { id: 1, changes: 1 });
      assert.equal((await users.where('name', 'Alice').first()).age, 25);
      assert.equal((await users.where('name', 'missing').first()), undefined);
      assert.equal(await users.count(), 1);
      assert.equal((await users.where('name', 'Alice').update({ age: 26 })).changes, 1);
      assert.deepEqual(await db.get('SELECT age FROM users WHERE name = ?', 'Alice'), { age: 26 });
      assert.deepEqual(await db.all('SELECT name FROM users WHERE age > ?', [20]), [{ name: 'Alice' }]);
      assert.deepEqual(await db.get('SELECT name FROM users WHERE name = $name', { $name: 'Alice' }), { name: 'Alice' });
      await db.run('UPDATE users SET data = ? WHERE name = ?', Buffer.from('hi'), 'Alice');
      assert.deepEqual((await db.get('SELECT data FROM users WHERE name = ?', 'Alice')).data, Buffer.from('hi'));
      await db.transaction(async (trx) => {
        await trx.run('INSERT INTO users (name, age) VALUES (?, ?)', ['Bob', 21]);
      });
      await assert.rejects(db.transaction(async (trx) => {
        await trx.run('INSERT INTO users (name) VALUES (?)', 'Rollback');
        throw new Error('rollback');
      }), /rollback/);
      assert.equal(await users.count(), 2);
      assert.equal((await users.where('name', 'Bob').delete()).changes, 1);
      await assert.rejects(db.run('INSERT INTO users (name) VALUES (?)', 'Alice'));
    } finally {
      await db.close();
    }
  });

  test(`${driver}: persists files and enforces readonly`, options, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sqlite-builder-'));
    const filename = path.join(dir, 'nested', 'db.sqlite');
    let db;
    try {
      db = await initDB({ filename, driver });
      await db.exec('CREATE TABLE records (id INTEGER)');
      await db.run('INSERT INTO records VALUES (?)', 42);
      await db.close();
      db = await initDB({ filename, driver, readonly: true });
      assert.deepEqual(await db.get('SELECT id FROM records'), { id: 42 });
      await assert.rejects(db.run('INSERT INTO records VALUES (?)', 43));
    } finally {
      if (db) await db.close();
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
}

test('rejects unknown driver', async () => {
  await assert.rejects(initDB({ memory: true, driver: 'invalid' }), /Unsupported SQLite driver/);
});
