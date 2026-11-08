const fs = require('fs');
const path = require('path');
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
 * @param {'sqlite3'|'node:sqlite'} [options.driver='sqlite3'] - SQLite driver
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
    driver = 'sqlite3',
  } = options;

  if (!['sqlite3', 'node:sqlite'].includes(driver)) {
    throw new Error(`Unsupported SQLite driver: ${driver}`);
  }

  if (!memory) {
    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  if (verbose) {
    console.log(`[sqlite-model-builder] Opening ${memory ? 'in-memory DB' : filename}`);
  }

  let db;
  if (driver === 'node:sqlite') {
    db = openNodeSQLite(memory ? ':memory:' : filename, { readonly: !memory && readonly, verbose });
  } else {
    const sqlite3 = require('sqlite3');
    const { open } = require('sqlite');
    const mode = memory
      ? sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
      : readonly
      ? sqlite3.OPEN_READONLY
      : sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE;
    db = await open({ filename: memory ? ':memory:' : filename, driver: sqlite3.Database, mode });
    if (verbose) db.on('trace', (sql) => {
      console.log('[TRACE]', sql.replace(/"(\w+)"/g, '$1'));
    });
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

function openNodeSQLite(filename, { readonly, verbose }) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (error) {
    if (error.code !== 'ERR_UNKNOWN_BUILTIN_MODULE' && error.code !== 'MODULE_NOT_FOUND') throw error;
    throw new Error('The node:sqlite driver requires Node.js 22.13 or newer with node:sqlite available', { cause: error });
  }
  const native = new DatabaseSync(filename, {
    readOnly: readonly,
    enableForeignKeyConstraints: false,
    enableDoubleQuotedStringLiterals: true,
  });
  const log = (sql) => { if (verbose) console.log('[TRACE]', sql); };
  const params = (args) => args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
  const row = (result) => {
    if (!result) return result;
    return Object.fromEntries(Object.entries(result).map(([key, value]) => [
      key, value instanceof Uint8Array ? Buffer.from(value) : value,
    ]));
  };
  return {
    async exec(sql) {
      log(sql);
      native.exec(sql);
    },
    async get(sql, ...args) {
      log(sql);
      return row(native.prepare(sql).get(...params(args)));
    },
    async all(sql, ...args) {
      log(sql);
      return native.prepare(sql).all(...params(args)).map(row);
    },
    async run(sql, ...args) {
      log(sql);
      const result = native.prepare(sql).run(...params(args));
      return { lastID: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async close() {
      native.close();
    },
  };
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

  /*DYNAMIC CONDITIONS*/
  modify(cb) {
    cb(this);
    return this;
  }

  where(column, value) {
    if (typeof column === 'object' && !Array.isArray(column)) {
      // Jika object => multiple where otomatis
      for (const [col, val] of Object.entries(column)) {
        this._where.push(`${col} = ?`);
        this._params.push(val);
      }
      console.log('WHERE: ', this._where);
      console.log('Param: ', this._params);
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

  async upsertMany(rows = [], conflictCols = ['id'], updateCols = []) {
    if (!Array.isArray(rows) || rows.length === 0) return { changes: 0 };

    const cols = Object.keys(rows[0]);
    if (updateCols.length === 0)
      updateCols = cols.filter(c => !conflictCols.includes(c));

    const placeholders = `(${cols.map(() => '?').join(', ')})`;
    const sql = `
      INSERT INTO ${this.table} (${cols.join(', ')})
      VALUES ${rows.map(() => placeholders).join(', ')}
      ON CONFLICT(${conflictCols.join(', ')})
      DO UPDATE SET ${updateCols.map(c => `${c}=excluded.${c}`).join(', ')}
    `;
    const vals = rows.flatMap(r => cols.map(c => r[c]));
    const result = await this.db.run(sql, vals);
    this.reset();
    return { changes: result.changes };
  }

async insertOrIgnore(rows = []) {
  if (!Array.isArray(rows) || !rows.length) return { changes: 0 };
  const keys = Object.keys(rows[0]);
  const placeholders = `(${keys.map(() => '?').join(', ')})`;
  const sql = `INSERT OR IGNORE INTO ${this.table} (${keys.join(', ')}) VALUES ${rows.map(() => placeholders).join(', ')}`;
  const params = rows.flatMap((r) => Object.values(r));
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
      return 'WHERE ' + this._where.join(' AND ');
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
