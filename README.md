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
      status TEXT DEFAULT 'active',
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
    .where('status','active')
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

### 📦 Instalasi

```bash
npm install github:badueny/sqlite-model-builder sqlite sqlite3
```

---

### 🧠 Lisensi
MIT © 2025 bitdev.id
Author: Awenk

[![license](https://img.shields.io/github/license/badueny/sqlite-model-builder.svg?style=flat-square)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square)](https://nodejs.org/)
