import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'scamshield.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables on startup
db.exec(`
  CREATE TABLE IF NOT EXISTS community_reports (
    id TEXT PRIMARY KEY,
    package_id TEXT,
    app_name TEXT NOT NULL,
    report_type TEXT NOT NULL CHECK(report_type IN ('scam','harassment','fake','data-theft','other')),
    description TEXT,
    created_at TEXT NOT NULL,
    verified_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_reports_package_id ON community_reports(package_id);
  CREATE INDEX IF NOT EXISTS idx_reports_app_name ON community_reports(app_name);
`);

export { db };
export default db;
