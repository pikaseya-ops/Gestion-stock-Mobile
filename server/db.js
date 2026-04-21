/**
 * Couche base de données SQLite.
 *
 * Schéma :
 *  - kv                       : stockage clé/valeur pour le module Planning
 *                               (staff[], leaves[], settings, coverage, plannings)
 *  - accounts                 : comptes utilisateurs (admin + members)
 *  - audit_log                : journal d'audit (qui a fait quoi)
 *
 *  - boards                   : tableaux Kanban du module Tâches
 *  - board_columns            : colonnes (statuts) d'un tableau
 *  - tasks                    : tâches (carte Kanban)
 *  - task_assignees           : N:N tâche <-> utilisateur (assignation multiple)
 *  - task_checklist_items     : sous-éléments d'une tâche
 *  - task_comments            : commentaires sur une tâche
 *  - task_recurrences         : règles de récurrence pour les tâches
 *  - task_occurrences         : instances générées d'une tâche récurrente
 *
 *  - transmissions            : notes/transmissions équipe
 *  - transmission_reads       : qui a lu quelle transmission et quand
 *  - transmission_comments    : commentaires sur une transmission
 *
 * Migrations : on utilise PRAGMA user_version pour suivre la version du schéma.
 */
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const SCHEMA_VERSION = 2;

let db = null;

function getDataDir() {
  if (process.env.PHARM_DATA_DIR) return process.env.PHARM_DATA_DIR;
  if (process.env.ELECTRON_USER_DATA) return process.env.ELECTRON_USER_DATA;
  return path.join(__dirname, '..', 'data');
}

function getDbPath() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'pharmacy.db');
}

function initDatabase() {
  const dbPath = getDbPath();
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations();
  console.log(`📁 Base de données : ${dbPath}`);
  return db;
}

function runMigrations() {
  const currentVersion = db.pragma('user_version', { simple: true });

  if (currentVersion < 1) {
    migrateV1();
    db.pragma('user_version = 1');
    console.log('✅ Migration v1 appliquée (tables de base)');
  }
  if (currentVersion < 2) {
    migrateV2();
    db.pragma('user_version = 2');
    console.log('✅ Migration v2 appliquée (tâches + transmissions + comptes étendus)');
  }
}

function migrateV1() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'admin',
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      last_login    INTEGER
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id      INTEGER PRIMARY KEY AUTOINCREMENT,
      ts      INTEGER NOT NULL DEFAULT (unixepoch()),
      action  TEXT NOT NULL,
      entity  TEXT,
      details TEXT
    );
  `);
}

function migrateV2() {
  // Étendre la table accounts avec display_name + staff_id
  const cols = db.prepare("PRAGMA table_info(accounts)").all().map(c => c.name);
  if (!cols.includes('display_name')) {
    db.exec(`ALTER TABLE accounts ADD COLUMN display_name TEXT`);
    // Initialiser display_name = username pour les comptes existants
    db.exec(`UPDATE accounts SET display_name = username WHERE display_name IS NULL`);
  }
  if (!cols.includes('staff_id')) {
    db.exec(`ALTER TABLE accounts ADD COLUMN staff_id TEXT`);
  }

  // Tables Tâches (Kanban)
  db.exec(`
    CREATE TABLE IF NOT EXISTS boards (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      icon        TEXT,
      color       TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      archived    INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      created_by  INTEGER REFERENCES accounts(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS board_columns (
      id          TEXT PRIMARY KEY,
      board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      color       TEXT,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      done_state  INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_columns_board ON board_columns(board_id, sort_order);

    CREATE TABLE IF NOT EXISTS task_recurrences (
      id            TEXT PRIMARY KEY,
      board_id      TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      template_json TEXT NOT NULL,            -- modèle de tâche à cloner (JSON)
      frequency     TEXT NOT NULL,            -- 'daily'|'weekly'|'monthly'
      day_of_week   INTEGER,                  -- 0=Dim..6=Sam (pour weekly)
      day_of_month  INTEGER,                  -- 1..31 (pour monthly)
      time_of_day   TEXT,                     -- 'HH:MM' (heure de génération)
      active        INTEGER NOT NULL DEFAULT 1,
      last_run      INTEGER,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id           TEXT PRIMARY KEY,
      board_id     TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
      column_id    TEXT NOT NULL REFERENCES board_columns(id) ON DELETE CASCADE,
      title        TEXT NOT NULL,
      description  TEXT,
      priority     TEXT,                 -- 'low'|'normal'|'high'|'urgent'
      due_date     TEXT,                 -- 'YYYY-MM-DD'
      labels       TEXT,                 -- JSON array
      sort_order   INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
      created_by   INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      recurrence_id TEXT REFERENCES task_recurrences(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_board   ON tasks(board_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_column  ON tasks(column_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_tasks_due     ON tasks(due_date);

    CREATE TABLE IF NOT EXISTS task_assignees (
      task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, account_id)
    );

    CREATE TABLE IF NOT EXISTS task_checklist_items (
      id          TEXT PRIMARY KEY,
      task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      content     TEXT NOT NULL,
      done        INTEGER NOT NULL DEFAULT 0,
      sort_order  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id         TEXT PRIMARY KEY,
      task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      author_id  INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      content    TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);

  // Tables Transmissions
  db.exec(`
    CREATE TABLE IF NOT EXISTS transmissions (
      id         TEXT PRIMARY KEY,
      title      TEXT,
      content    TEXT NOT NULL,
      author_id  INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      category   TEXT,                       -- libellé/catégorie libre
      pinned     INTEGER NOT NULL DEFAULT 0,
      important  INTEGER NOT NULL DEFAULT 0, -- accusé de lecture obligatoire
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_transmissions_pinned ON transmissions(pinned, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transmissions_created ON transmissions(created_at DESC);

    CREATE TABLE IF NOT EXISTS transmission_reads (
      transmission_id TEXT NOT NULL REFERENCES transmissions(id) ON DELETE CASCADE,
      account_id      INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      read_at         INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (transmission_id, account_id)
    );

    CREATE TABLE IF NOT EXISTS transmission_comments (
      id              TEXT PRIMARY KEY,
      transmission_id TEXT NOT NULL REFERENCES transmissions(id) ON DELETE CASCADE,
      author_id       INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      content         TEXT NOT NULL,
      created_at      INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `);
}

function getDb() {
  if (!db) initDatabase();
  return db;
}

/* ---------- Helpers KV (utilisés par le module Planning) ---------- */

function kvGet(key, fallback = null) {
  const row = getDb().prepare('SELECT value FROM kv WHERE key = ?').get(key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch { return fallback; }
}

function kvSet(key, value) {
  const json = JSON.stringify(value);
  getDb().prepare(`
    INSERT INTO kv (key, value, updated_at) VALUES (?, ?, unixepoch())
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()
  `).run(key, json);
  return value;
}

function kvDelete(key) {
  return getDb().prepare('DELETE FROM kv WHERE key = ?').run(key).changes > 0;
}

function kvAll() {
  const rows = getDb().prepare('SELECT key, value FROM kv').all();
  const out = {};
  rows.forEach(r => {
    try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = null; }
  });
  return out;
}

/* ---------- Audit ---------- */

function logAudit(action, entity = null, details = null) {
  try {
    getDb().prepare(`
      INSERT INTO audit_log (action, entity, details) VALUES (?, ?, ?)
    `).run(action, entity, details ? JSON.stringify(details) : null);
  } catch (e) {
    console.error('Audit log error:', e);
  }
}

function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

module.exports = {
  initDatabase,
  getDb,
  getDataDir,
  getDbPath,
  kvGet,
  kvSet,
  kvDelete,
  kvAll,
  logAudit,
  uuid,
  SCHEMA_VERSION
};
