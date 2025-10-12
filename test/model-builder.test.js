const assert = require('assert');
const { initDB, Model } = require('../index');

(async () => {
  const db = await initDB({ memory: true });
  await db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      age INTEGER
    );
  `);

  const User = Model('users');

  // Insert test
  const insertResult = await User.insert({ name: 'Alice', age: 25 });
  assert.ok(insertResult, 'Insert should return result');

  const users = await User.select('*').get();
  assert.ok(users.length > 0, 'Should return at least one record');
  assert.strictEqual(users[0].name, 'Alice');

  console.log('✅ All tests passed!');
  await db.close();
})();
