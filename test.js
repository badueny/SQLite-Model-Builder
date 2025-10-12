// test.js
const { initDB, Model } = require('@awenk/sqlite-model-builder');

let db = null;

// 🔹 Helper untuk inisialisasi koneksi SQLite sekali saja
async function getDB() {
  if (!db) {
    // 1️⃣ Mode default (baca/tulis file, auto-create folder)
    db = await initDB({ filename: './data/app.sqlite', verbose: true });

    // 2️⃣ Mode readonly
    // db = await initDB({ filename: './data/app.sqlite', readonly: true });

    // 3️⃣ Mode in-memory
    // db = await initDB({ memory: true, verbose: true });
  }
  return db;
}

(async () => {
  await getDB(); // Init connection sekali saja

  // Buat tabel contoh (kalau belum ada)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      age INTEGER DEFAULT 18,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT
    );
  `);

  // 🧩 Insert data
  await Model('users').insert({ name: 'Andi', email: 'a@a.com' });
  await Model('posts').insert({ user_id: 1, title: 'TEST POSTS' });

  // 🧩 Update data
  await Model('users').where('id',1).update({ name: 'Update Name' });

  // 🧩 Delete data
  await Model('users').where('id',2).delete();

  // 🧩 Ambil semua user
  const users = await Model('users').orderBy('id', 'DESC').get();
  console.log('Users:', users);

  // 🧩 Filter + Like
  const active = await Model('users')
    .where('status','active') //singe condition | .where({status: 'active', role: 'admin' })   // multiple condition otomatis    
    .whereOp('age','<', 20)
    .whereLike('name', 'andi')
    .get();
  console.log('Filtered:', active);

  // 🧩 Aggregate
  const total = await Model('users').count();
  console.log('Total users:', total);

  const sum = await Model('orders').sum('amount');
  console.log('Sum amount:', sum);

  // 🧩 Pagination
  const paged = await Model('users').paginate(2, 10);
  console.log('Paged:', paged);

  // 🧩 Exist
  const usersExist = await Model('users').where('status', 'active').exists();
  console.log('Ada user aktif?', usersExist); // true/false

  // 🧩 Select Satu Kolom
  const emails = await Model('users').where('status', 'active').pluck('email');
  console.log(emails); // ['a@a.com', 'b@b.com', ...]

  // 🧩 JOIN
  const resultJoin = await Model('posts')
    .select(['posts.id', 'posts.title', 'users.name AS author'])
    .join('users', 'posts.user_id', '=', 'users.id')
    .get();
  console.log(resultJoin);

 // 🧩 LEFT JOIN
  const resultLeftJoin = await Model('posts')
    .select(['posts.id', 'posts.title', 'users.name AS author'])
    .leftJoin('users', 'posts.user_id', '=', 'users.id')
    .get();
 console.log(resultLeftJoin);

  // 🧩 Min Max
  const minAge = await Model('users').where('status', 'active').min('age');
  const maxAge = await Model('users').where('status', 'active').max('age');
  console.log({ minAge, maxAge });
})();
````
```js
/*multiple Database*/
const { initDB, ModelClass } = require('@awenk/sqlite-model-builder');

(async () => {
  const dbA = await initDB({ filename: './data/a.sqlite' });
  const dbB = await initDB({ filename: './data/b.sqlite' });

  // Pakai koneksi A
  const modelA = new ModelClass(dbA, 'users');
  const usersA = await modelA.select('*').get();
  console.log(usersA);

  // Pakai koneksi B
  const modelB = new ModelClass(dbB, 'users');
  const usersB = await modelB.select('*').get();
  console.log(usersB);
})();
