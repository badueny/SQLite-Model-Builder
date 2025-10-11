// conn.js
const path = require('path');
const { initDB, setConnection } = require('@awenk/sqlite-model-builder');

let dbInstance = null;

const db = async function getDB() {
  if (dbInstance) return dbInstance;
  dbInstance = await initDB({
    filename: path.join(__dirname, `./${process.env.DB_NAME || 'data.sqlite'}`),
    verbose: true,
  });
  setConnection(dbInstance); // <--- ini biar global Model() langsung jalan
  console.log('SQLite connected');
  return dbInstance;
}

module.exports = db;
