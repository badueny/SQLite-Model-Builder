# SQLite-Model-Builder
> Dynamic Query Builder & Mini ORM for Node.js + SQLite  

---

### 🚀 Overview
`SQLite-Model-Builder` adalah query builder ringan dan fleksibel untuk **SQLite** di Node.js.  
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
const { Model } = require('@awenk/sqlite-model-builder');

// Inisialisasi koneksi database
const User = new Model('users', { file: './data/app.db' });

(async () => {
  // Auto-create tabel (opsional)
  await User.createTableIfNotExists({
    id: 'INTEGER PRIMARY KEY AUTOINCREMENT',
    name: 'TEXT',
    email: 'TEXT UNIQUE',
    age: 'INTEGER',
    created_at: 'TEXT'
  });

  // Insert data
  await User.insert({
    name: 'Alice',
    email: 'alice@example.com',
    age: 25,
    created_at: new Date().toISOString()
  });

  // Ambil semua data
  const allUsers = await User.select('*').get();
  console.log(allUsers);

  // Ambil satu user
  const user = await User.where('email', 'alice@example.com').first();
  console.log(user);

  // Update user
  await User.where('id', user.id).update({ age: 26 });

  // Hapus user
  await User.where('id', user.id).delete();
})();
```

### 📦 Instalasi

```bash
npm install @awenk/sqlite-model-builder sqlite sqlite3
```

---

### 🧠 Lisensi
MIT © 2025 bitdev.id
Author: Awenk

[![npm version](https://img.shields.io/npm/v/@awenk/sqlite-model-builder.svg?style=flat-square)](https://www.npmjs.com/package/@awenk/sqlite-model-builder)
[![license](https://img.shields.io/github/license/badueny/sqlite-model-builder.svg?style=flat-square)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-green?style=flat-square)](https://nodejs.org/)
