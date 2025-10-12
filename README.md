# SQLite Model Builder
> Dynamic Query Builder & Mini ORM for Node.js + SQLite  

---

### 🚀 Overview
`SQLite Model Builder` adalah query builder ringan dan fleksibel untuk **SQLite** di Node.js.  
Terinspirasi dari Eloquent (Laravel) dan Knex, tapi lebih sederhana — cukup satu file, tanpa ORM berat.  
Mendukung query dinamis, chaining, filter, agregasi, dan auto-create database jika belum ada.

---

### 🧰 Fitur Utama
- ⚙️ Auto-create SQLite DB jika belum ada
- 🔗 Chained query builder mirip Eloquent
- 🧮 Fungsi agregat (count, sum, avg)
- 🔍 Filter fleksibel (where, whereIn, whereLikeAny)
- 🔀 join, orderBy, groupBy, having
- 📄 paginate() dan first()
- 🧾 Support transaksi (beginTransaction, commit, rollback)
- 💾 CRUD sederhana (insert, update, delete)
- 🧠 Tanpa ORM berat — hanya helper modular untuk SQLite

---

### ⚡ Fitur Query Builder
| Fungsi                                         | Deskripsi               |
| ---------------------------------------------- | ----------------------- |
| `.select(fields)`                              | Pilih kolom             |
| `.where(field, value)`                         | Filter                  |
| `.whereIn(field, [values])`                    | Filter array            |
| `.whereLikeAny(field, keyword)`                | Pencarian LIKE otomatis |
| `.join(table, localKey, operator, foreignKey)` | Join tabel              |
| `.orderBy(field, direction)`                   | Urutkan                 |
| `.groupBy(field)`                              | Grouping                |
| `.having(condition)`                           | Kondisi group           |
| `.limit(n)`                                    | Batas hasil             |
| `.paginate(page, perPage)`                     | Pagination otomatis     |
| `.count(field)`                                | Hitung jumlah           |
| `.sum(field)` / `.avg(field)`                  | Agregat                 |
| `.first()`                                     | Ambil 1 record          |
| `.get()`                                       | Ambil semua             |
| `.insert(data)`                                | Tambah data             |
| `.update(data)`                                | Ubah data               |
| `.delete()`                                    | Hapus data              |

---

### 🧩 Transaksi
```js
const trx = await User.beginTransaction();

try {
  await trx.insert({ name: 'Bob', email: 'bob@example.com' });
  await trx.commit();
} catch (err) {
  await trx.rollback();
  console.error('Transaction failed:', err);
}

```

### 📘 Contoh Penggunaan
```js
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
  const result = await Model('posts')
    .select(['posts.id', 'posts.title', 'users.name AS author'])
    .join('users', 'posts.user_id', '=', 'users.id')
    .get();

 // 🧩 LEFT JOIN
  const result = await Model('posts')
    .select(['posts.id', 'posts.title', 'users.name AS author'])
    .leftJoin('users', 'posts.user_id', '=', 'users.id')
    .get();

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

  // Pakai koneksi B
  const modelB = new ModelClass(dbB, 'users');
  const usersB = await modelB.select('*').get();
})();

```

---

### 📦 Instalasi

```bash
npm install github:badueny/sqlite-model-builder sqlite sqlite3
```
OR
```bash
npm install @awenk/sqlite-model-builder sqlite sqlite3
```

---

### 🧠 Lisensi
[MIT](https://github.com/badueny/SQLite-Model-Builder?tab=MIT-1-ov-file) © 2025 [bitdev.id](https://bitdev.id) Author: [Awenk](https://github.com/badueny?tab=repositories)

![Node.js CI](https://github.com/badueny/SQLite-Model-Builder/actions/workflows/node.js.yml/badge.svg)
[![npm version](https://img.shields.io/npm/v/@awenk/sqlite-model-builder.svg)](https://www.npmjs.com/package/@awenk/sqlite-model-builder)
[![license](https://img.shields.io/github/license/badueny/sqlite-model-builder.svg?style=flat-square)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square)](https://nodejs.org/)
