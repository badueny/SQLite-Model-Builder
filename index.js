const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const projectRoot = process.cwd();

/**
 * Initialize SQLite database connection.
 * Will auto-create DB file (and folder) if missing.
 *
 * @param {object} options
 * @param {string} options.filename - Path to SQLite database file
 * @param {boolean} [options.memory=false] - Use in-memory DB (no file)
 * @param {boolean} [options.readonly=false] - Open DB in readonly mode
 * @param {boolean} [options.verbose=false] - Enable verbose logging
 */

let globalDB = null;

function setConnection(db) {
  globalDB = db;
}

function getConnection() {
  if (!globalDB) throw new Error('Database connection not set. Call setConnection() first.');
  return globalDB;
}

async function initDB(options = {}) {
  const {
    filename = path.join(projectRoot, 'data', 'app.sqlite'),
    memory = false,
    readonly = false,
    verbose = false,
  } = options;

  if (!memory) {
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  const mode = memory
    ? sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    : readonly
    ? sqlite3.OPEN_READONLY
    : sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE;

  if (verbose) {
    console.log(`[sqlite-model-builder] Opening ${memory ? 'in-memory DB' : filename}`);
  }

  const db = await open({
    filename: memory ? ':memory:' : filename,
    driver: sqlite3.Database,
    mode,
  });

  if (verbose) {
    db.on('trace', (sql) => console.log('[TRACE]', sql));
  }

  // Simple transaction helper
  db.transaction = async (callback) => {
    try {
      await db.exec('BEGIN');
      await callback(db);
      await db.exec('COMMIT');
    } catch (err) {
      await db.exec('ROLLBACK');
      throw err;
    }
  };
  setConnection(db);
  return db;
}

class Model {
  constructor(dbOrTable, tableMaybe) {
    // allow flexible usage:
    // new Model(db, 'users') OR new Model('users') -> uses global DB
    if (typeof dbOrTable === 'string') {
      this.db = getConnection();
      this.table = dbOrTable;
    } else {
      this.db = dbOrTable || getConnection();
      this.table = tableMaybe;
    }
    this.reset();
  }

  reset() {
    this._select = '*';
    this._where = [];
    this._joins = [];
    this._order = '';
    this._group = '';
    this._having = '';
    this._limit = '';
    this._offset = '';
    this._params = [];
    return this;
  }

  select(columns = '*') {
    this._select = Array.isArray(columns) ? columns.join(', ') : columns;
    return this;
  }

  where(column, value) {
    if (typeof column === 'object' && !Array.isArray(column)) {
      // Jika object => multiple where otomatis
      for (const [col, val] of Object.entries(column)) {
        this._where.push(`${col} = ?`);
        this._params.push(val);
      }
    } else {
      this._where.push(`${column} = ?`);
      this._params.push(value);
    }
    return this;
  }
  
  whereOp(column, operator, value) {
    if (value === undefined) {
      value = operator;
      operator = '=';
    }
    this._where.push(`${column} ${operator} ?`);
    this._params.push(value);
    return this;
  }

  orWhere(column, operator, value) {
    if (value === undefined) {
      value = operator;
      operator = '=';
    }
    if (this._where.length === 0) {
      this._where.push(`${column} ${operator} ?`);
    } else {
      this._where.push(`OR ${column} ${operator} ?`);
    }
    this._params.push(value);
    return this;
  }

  whereIn(column, values = []) {
    const placeholders = values.map(() => '?').join(', ');
    this._where.push(`${column} IN (${placeholders})`);
    this._params.push(...values);
    return this;
  }

  whereLike(column, pattern) {
    this._where.push(`${column} LIKE ?`);
    this._params.push(`%${pattern}%`);
    return this;
  }

  whereBetween(column, min, max) {
    this._where.push(`${column} BETWEEN ? AND ?`);
    this._params.push(min, max);
    return this;
  }

  join(table, left, operator, right) {
    this._joins.push(`JOIN ${table} ON ${left} ${operator} ${right}`);
    return this;
  }

  leftJoin(table, left, operator, right) {
    this._joins.push(`LEFT JOIN ${table} ON ${left} ${operator} ${right}`);
    return this;
  }

  groupBy(columns) {
    this._group = `GROUP BY ${Array.isArray(columns) ? columns.join(', ') : columns}`;
    return this;
  }

  having(column, operator, value) {
    this._having = `HAVING ${column} ${operator} ?`;
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

  offset(count) {
    this._offset = `OFFSET ${count}`;
    return this;
  }

  async get() {
    try {
      const sql = this._buildSelect();
      const rows = await this.db.all(sql, this._params);
      return rows;
    } finally {
      this.reset();
    }
  }

  async first() {
    try {
      const sql = this._buildSelect(true);
      return await this.db.get(sql, this._params);
    } finally {
      this.reset();
    }
  }

  async count(column = '*') {
    const sql = `SELECT COUNT(${column}) AS total FROM ${this.table} ${this._buildWhere()}`;
    const row = await this.db.get(sql, this._params);
    this.reset();
    return row?.total || 0;
  }

  async sum(column) {
    const sql = `SELECT SUM(${column}) AS total FROM ${this.table} ${this._buildWhere()}`;
    const row = await this.db.get(sql, this._params);
    this.reset();
    return row?.total || 0;
  }

  async avg(column) {
    const sql = `SELECT AVG(${column}) AS avg FROM ${this.table} ${this._buildWhere()}`;
    const row = await this.db.get(sql, this._params);
    this.reset();
    return row?.avg || 0;
  }

  async exists() {
    const sql = `SELECT 1 FROM ${this.table} ${this._buildWhere()} LIMIT 1`;
    const row = await this.db.get(sql, this._params);
    this.reset();
    return !!row;
  }

  async pluck(column) {
    const sql = `SELECT ${column} FROM ${this.table} ${this._buildWhere()}`;
    const rows = await this.db.all(sql, this._params);
    this.reset();
    return rows.map(r => r[column]);
  }

  async min(column) {
    const sql = `SELECT MIN(${column}) AS min FROM ${this.table} ${this._buildWhere()}`;
    const row = await this.db.get(sql, this._params);
    this.reset();
    return row?.min ?? null;
  }

  async max(column) {
    const sql = `SELECT MAX(${column}) AS max FROM ${this.table} ${this._buildWhere()}`;
    const row = await this.db.get(sql, this._params);
    this.reset();
    return row?.max ?? null;
  }

  async insert(data) {
    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders})`;
    const result = await this.db.run(sql, Object.values(data));
    this.reset();
    return { id: result.lastID, changes: result.changes };
  }

  async insertMany(rows = []) {
    if (!Array.isArray(rows) || !rows.length) return { changes: 0 };
    const keys = Object.keys(rows[0]);
    const placeholders = `(${keys.map(() => '?').join(', ')})`;
    const sql = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES ${rows.map(() => placeholders).join(', ')}`;
    const params = rows.flatMap((r) => Object.values(r));
    const result = await this.db.run(sql, params);
    this.reset();
    return { changes: result.changes };
  }

  async update(data) {
    const sets = Object.keys(data).map((k) => `${k} = ?`).join(', ');
    const sql = `UPDATE ${this.table} SET ${sets} ${this._buildWhere()}`;
    const params = [...Object.values(data), ...this._params];
    const result = await this.db.run(sql, params);
    this.reset();
    return { changes: result.changes };
  }

  async delete() {
    const sql = `DELETE FROM ${this.table} ${this._buildWhere()}`;
    const result = await this.db.run(sql, this._params);
    this.reset();
    return { changes: result.changes };
  }

  async paginate(page = 1, perPage = 10) {
    const offset = (page - 1) * perPage;
    this.limit(perPage).offset(offset);
    const data = await this.get();
    const total = await this.count();
    const lastPage = Math.ceil(total / perPage);
    return {
      data,
      total,
      current_page: page,
      per_page: perPage,
      last_page: lastPage,
    };
  }

  async raw(sql, params = []) {
    return this.db.all(sql, params);
  }

  _buildSelect(limitOne = false) {
    let sql = `SELECT ${this._select} FROM ${this.table}`;
    if (this._joins.length) sql += ' ' + this._joins.join(' ');
    if (this._where.length) sql += ' ' + this._buildWhere();
    if (this._group) sql += ' ' + this._group;
    if (this._having) sql += ' ' + this._having;
    if (this._order) sql += ' ' + this._order;
    if (limitOne) sql += ' LIMIT 1';
    else {
      if (this._limit) sql += ' ' + this._limit;
      if (this._offset) sql += ' ' + this._offset;
    }
    return sql.trim();
  }

  _buildWhere() {
    if (!this._where.length) return '';
    return 'WHERE ' + this._where.join(' ');
  }

  static for(db, table) {
    return new Model(db, table);
  }
}

/** Factory export */
function ModelFactory(table) {
  return new Model(table);
}

module.exports = {
  initDB,
  getConnection,
  setConnection,
  Model: ModelFactory,
  ModelClass: Model,
};
