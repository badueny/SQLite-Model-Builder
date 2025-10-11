// config/db.js
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

let connection;

async function getDB() {
  if (!connection) {
    connection = await open({
      filename: './data/database.sqlite',
      driver: sqlite3.Database
    });
  }
  return connection;
}

module.exports = {
  async query(sql, params = []) {
    const db = await getDB();
    const lower = sql.trim().toLowerCase();
    if (lower.startsWith('select')) {
      const rows = await db.all(sql, params);
      return [rows];
    } else {
      const res = await db.run(sql, params);
      return [{ changes: res.changes, insertId: res.lastID }];
    }
  },
  getDB
};
