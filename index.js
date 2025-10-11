// index.js
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

class Model {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this._select = '*';
    this._where = '';
    this._order = '';
    this._limit = '';
    this._params = [];
  }

  select(columns = '*') {
    this._select = Array.isArray(columns) ? columns.join(', ') : columns;
    return this;
  }

  where(column, operator, value) {
    if (value === undefined) {
      value = operator;
      operator = '=';
    }
    this._where = `WHERE ${column} ${operator} ?`;
    this._params.push(value);
    return this;
  }

  orderBy(column, direction = 'ASC') {
    this._order = `ORDER BY ${column} ${direction}`;
    return this;
  }

  limit(count) {
    this._limit = `LIMIT ${count}`;
    return this;
  }

  async get() {
    const sql = `SELECT ${this._select} FROM ${this.table} ${this._where} ${this._order} ${this._limit}`;
    return this.db.all(sql, this._params);
  }

  async first() {
    const sql = `SELECT ${this._select} FROM ${this.table} ${this._where} ${this._order} LIMIT 1`;
    return this.db.get(sql, this._params);
  }

  async insert(data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(',');
    const sql = `INSERT INTO ${this.table} (${keys.join(',')}) VALUES (${placeholders})`;
    await this.db.run(sql, Object.values(data));
    return { success: true };
  }

  async update(data) {
    const sets = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const sql = `UPDATE ${this.table} SET ${sets} ${this._where}`;
    const params = [...Object.values(data), ...this._params];
    await this.db.run(sql, params);
    return { success: true };
  }

  async delete() {
    const sql = `DELETE FROM ${this.table} ${this._where}`;
    await this.db.run(sql, this._params);
    return { success: true };
  }

  static for(db, table) {
    return new Model(db, table);
  }
}

async function initDB(options = {}) {
  const dbFile = options.filename || path.join(process.cwd(), 'data', 'app.db');
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });

  // Auto-create __migrations table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS __migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log(`✅ SQLite connected → ${dbFile}`);
  return db;
}

module.exports = {
  initDB,
  Model
};
