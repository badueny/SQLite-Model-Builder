// helpers/ModelSQLite.js
const db = require('../../db');

class ModelSQLite {
  constructor(table) {
    this.table = table;
    this._select = '*';
    this._where = [];
    this._order = '';
    this._limit = '';
    this._group = '';
    this._having = '';
    this._joins = [];
    this._auditTable = 'audit_log';
  }

  // ========== QUERY BUILDER ==========
  select(cols) {
    if (Array.isArray(cols)) this._select = cols.join(', ');
    else this._select = cols;
    return this;
  }

  where(col, op, val) {
    if (val === undefined) { val = op; op = '='; }
    this._where.push({ col, op, val });
    return this;
  }

  whereIn(col, arr) {
    const placeholders = arr.map(() => '?').join(', ');
    this._where.push({ raw: `${col} IN (${placeholders})`, vals: arr });
    return this;
  }

  orderBy(col, dir = 'ASC') {
    this._order = `ORDER BY ${col} ${dir}`;
    return this;
  }

  limit(limit, offset = 0) {
    this._limit = `LIMIT ${limit} OFFSET ${offset}`;
    return this;
  }

  groupBy(col) {
    this._group = `GROUP BY ${col}`;
    return this;
  }

  having(cond) {
    this._having = `HAVING ${cond}`;
    return this;
  }

  leftJoin(table, localKey, foreignKey) {
    this._joins.push(`LEFT JOIN ${table} ON ${localKey} = ${foreignKey}`);
    return this;
  }

  // ========== EXECUTE ==========
  async get() {
    let sql = `SELECT ${this._select} FROM ${this.table}`;
    if (this._joins.length) sql += ' ' + this._joins.join(' ');
    if (this._where.length) sql += ' WHERE ' + this._buildWhere();
    if (this._group) sql += ' ' + this._group;
    if (this._having) sql += ' ' + this._having;
    if (this._order) sql += ' ' + this._order;
    if (this._limit) sql += ' ' + this._limit;
    const [rows] = await db.query(sql, this._collectParams());
    return rows;
  }

  async first() {
    this.limit(1);
    const res = await this.get();
    return res[0] || null;
  }

  async count() {
    const sql = `SELECT COUNT(*) as total FROM ${this.table}` + (this._where.length ? ` WHERE ${this._buildWhere()}` : '');
    const [rows] = await db.query(sql, this._collectParams());
    return rows[0]?.total || 0;
  }

  async sum(col) {
    const sql = `SELECT SUM(${col}) as total FROM ${this.table}` + (this._where.length ? ` WHERE ${this._buildWhere()}` : '');
    const [rows] = await db.query(sql, this._collectParams());
    return rows[0]?.total || 0;
  }

  // ========== CRUD ==========
  async insert(data) {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders})`;
    const [res] = await db.query(sql, vals);
    await this._logAudit('insert', null, data);
    return res.insertId;
  }

  async insertUpdate(data, conflictCols = ['id']) {
    const cols = Object.keys(data);
    const vals = Object.values(data);
    const placeholders = cols.map(() => '?').join(', ');
    const updates = cols.map(c => `${c}=excluded.${c}`).join(', ');
    const conflict = `(${conflictCols.join(',')})`;
    const sql = `
      INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${placeholders})
      ON CONFLICT ${conflict} DO UPDATE SET ${updates}
    `;
    await db.query(sql, vals);
  }

  async update(data) {
    const sets = Object.keys(data).map(c => `${c}=?`).join(', ');
    const vals = Object.values(data);
    const sql = `UPDATE ${this.table} SET ${sets}` + (this._where.length ? ` WHERE ${this._buildWhere()}` : '');
    const params = vals.concat(this._collectParams());
    const [res] = await db.query(sql, params);
    await this._logAudit('update', null, data);
    return res.changes;
  }

  async delete() {
    const sql = `DELETE FROM ${this.table}` + (this._where.length ? ` WHERE ${this._buildWhere()}` : '');
    const [res] = await db.query(sql, this._collectParams());
    await this._logAudit('delete');
    return res.changes;
  }

  async paginate(page = 1, perPage = 10) {
    const total = await this.count();
    const offset = (page - 1) * perPage;
    const data = await this.limit(perPage, offset).get();
    return { total, page, perPage, data };
  }

  // ========== MIGRATION: ensureTable ==========
  async ensureTable(schema) {
    const dbConn = await db.getDB();
    const cols = Object.entries(schema).map(([name, type]) => `${name} ${type}`).join(', ');
    const sql = `CREATE TABLE IF NOT EXISTS ${this.table} (${cols})`;
    await dbConn.run(sql);
    return true;
  }

  // ========== PRIVATE ==========
  _buildWhere() {
    return this._where.map(w => w.raw || `${w.col} ${w.op} ?`).join(' AND ');
  }

  _collectParams() {
    const params = [];
    for (const w of this._where) {
      if (w.val !== undefined) params.push(w.val);
      if (w.vals) params.push(...w.vals);
    }
    return params;
  }

  async _logAudit(action, before = null, after = null, userId = null) {
    const dbConn = await db.getDB();
    await dbConn.run(`
      CREATE TABLE IF NOT EXISTS ${this._auditTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT,
        action TEXT,
        before_data TEXT,
        after_data TEXT,
        user_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    const sql = `INSERT INTO ${this._auditTable} (table_name, action, before_data, after_data, user_id)
                 VALUES (?, ?, ?, ?, ?)`;
    await db.query(sql, [
      this.table,
      action,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null,
      userId
    ]);
  }
}

module.exports = table => new ModelSQLite(table);
