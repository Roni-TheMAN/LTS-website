// backend/db.js
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const ROOT = process.cwd();
const DB_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DB_DIR, "lts.sqlite");
const SCHEMA_PATH = path.join(ROOT, "schema.sql");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(SCHEMA_PATH)) {
    throw new Error(`schema.sql not found at: ${SCHEMA_PATH}`);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

const schemaSQL = fs.readFileSync(SCHEMA_PATH, "utf8");
db.transaction(() => db.exec(schemaSQL))();

const { ensureFts } = require("./data/fts");

// Rebuild only when needed (version mismatch) or if you force it.
ensureFts(db, { rebuild: process.env.REBUILD_FTS === "1" });

function query(sql, params = []) {
    return db.prepare(sql).all(params);
}
function get(sql, params = []) {
    return db.prepare(sql).get(params);
}
function run(sql, params = []) {
    return db.prepare(sql).run(params);
}

module.exports = { db, query, get, run, DB_PATH };
