// test.js
const { initDB, Model } = require('@awenk/sqlite-model-builder');

(async () => {
  const db = await initDB({ filename: './data/myapp.sqlite' });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const User = Model.for(db, 'users');

  // Insert
  await User.insert({ name: 'MyNAME', email: 'mail@mail.test' });

  // Select
  const allUsers = await User.select(['id', 'name']).get();
  console.log(allUsers);

  // Update
  await User.where('id', 1).update({ name: 'MyNAME Updated' });

  // Delete
  await User.where('id', 2).delete();
})();
