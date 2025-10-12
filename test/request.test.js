// test.js
const { initDB, Model } = require('../index');

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
      status TEXT DEFAULT 'active',
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 🧩 Insert data
  await Model('users').insert({ name: 'Andi', email: 'a@a.com' });

  // 🧩 Update data
  await Model('users').where('id',1).update({ name: 'Update Name' });

  // 🧩 Delete data
  await Model('users').where('id',2).delete();

  // 🧩 Ambil semua user
  const users = await Model('users').orderBy('id', 'DESC').get();
  console.log('Users:', users);

  // 🧩 Filter + Like
  const active = await Model('users')
    .where('position','cs') //singe condition
    .where({status: 'active', role: 'admin' })   // multiple condition otomatis
    .whereOp('old','<', 20)
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

  // 🧩 Min Max
  const minAge = await Model('users').where('status', 'active').min('age');
  const maxAge = await Model('users').where('status', 'active').max('age');
  console.log({ minAge, maxAge });
})();
