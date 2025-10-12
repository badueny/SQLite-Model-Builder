const { initDB, Model } = require('../index');

describe('SQLite Model Builder', () => {
  let db;

  beforeAll(async () => {
    db = await initDB({ memory: true });
    await db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        age INTEGER
      );
    `);
  });

  afterAll(async () => {
    if (db && db.close) await db.close();
  });

  test('can insert and fetch a record', async () => {
    const User = Model('users');
    await User.insert({ name: 'Alice', age: 25 });
    const result = await User.select('*').get();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Alice');
  });

  test('can update record', async () => {
    const User = Model('users');
    const { lastID } = await User.insert({ name: 'Bob', age: 30 });
    const updated = await User.where('id', lastID).update({ age: 31 });
    expect(updated).toBeGreaterThanOrEqual(1);
    const bob = await User.where('id', lastID).first();
    expect(bob.age).toBe(31);
  });

  test('can delete record', async () => {
    const User = Model('users');
    const { lastID } = await User.insert({ name: 'Charlie', age: 40 });
    const del = await User.where('id', lastID).delete();
    expect(del).toBeGreaterThanOrEqual(1);
    const charlie = await User.where('id', lastID).first();
    expect(charlie).toBeUndefined();
  });
});
