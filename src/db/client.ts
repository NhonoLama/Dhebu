import * as SQLite from "expo-sqlite";

const DB_NAME = "dhebu.db";

let dbInstance: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Returns a singleton SQLite connection, running migrations on first open.
 * Safe to call from multiple places — subsequent calls reuse the same instance.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (!initPromise) {
    initPromise = initDb();
  }
  return initPromise;
}

async function initDb(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await runMigrations(db);
  await seedDefaults(db);
  dbInstance = db;
  return db;
}

const CURRENT_VERSION = 8;

async function runMigrations(db: SQLite.SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version;",
  );
  const version = result?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('cash','bank','wallet','other')),
        initial_balance REAL NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'NPR',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income','expense')),
        icon TEXT,
        color TEXT
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        type TEXT NOT NULL CHECK (type IN ('income','expense')),
        amount REAL NOT NULL CHECK (amount > 0),
        note TEXT,
        date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
      CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    `);
  }

  if (version < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS calendar_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        note TEXT NOT NULL,
        remind INTEGER NOT NULL DEFAULT 0,
        remind_time TEXT,
        notification_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_calendar_notes_date ON calendar_notes(date);
    `);
  }

  if (version < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS leave_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        days_per_month REAL NOT NULL,
        start_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS leave_days (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_leave_days_date ON leave_days(date);
    `);
  }

  if (version < 4) {
    await db.execAsync(`
      ALTER TABLE leave_days ADD COLUMN amount REAL NOT NULL DEFAULT 1;
    `);
  }

  if (version < 5) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS notification_apps (
        package_name TEXT PRIMARY KEY,
        app_label TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS pending_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_title TEXT,
        raw_text TEXT NOT NULL,
        source_package TEXT NOT NULL,
        detected_amount REAL,
        detected_type TEXT CHECK (detected_type IN ('income','expense') OR detected_type IS NULL),
        detected_category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        remarks TEXT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','dismissed')),
        notification_posted_at INTEGER,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pending_status ON pending_transactions(status);
    `);
  }

  if (version < 6) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'NPR',
        avatar_emoji TEXT NOT NULL DEFAULT '🙂',
        created_at TEXT NOT NULL
      );
    `);
  }

  if (version < 7) {
    await db.execAsync(`
    ALTER TABLE user_profile
    ADD COLUMN avatar_id TEXT NOT NULL DEFAULT 'avatar_01';
  `);
  }

  if (version < 8) {
    await db.execAsync(`
    ALTER TABLE pending_transactions
    ADD COLUMN notification_posted_at INTEGER;
  `);
  }

  // Future migrations: `if (version < 9) { ... }` etc.

  await db.execAsync(`PRAGMA user_version = ${CURRENT_VERSION};`);
}

async function seedDefaults(db: SQLite.SQLiteDatabase) {
  const accountCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM accounts;",
  );
  if ((accountCount?.count ?? 0) === 0) {
    await db.runAsync(
      `INSERT INTO accounts (name, type, initial_balance, currency, created_at)
       VALUES (?, ?, ?, ?, ?);`,
      ["Cash", "cash", 0, "NPR", new Date().toISOString()],
    );
  }

  const categoryCount = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM categories;",
  );
  if ((categoryCount?.count ?? 0) === 0) {
    const defaults: Array<[string, "income" | "expense", string, string]> = [
      ["Salary", "income", "wallet", "#22C55E"],
      ["Business", "income", "briefcase", "#0EA5E9"],
      ["Other Income", "income", "plus-circle", "#8B5CF6"],
      ["Food", "expense", "utensils", "#F97316"],
      ["Transport", "expense", "car", "#F59E0B"],
      ["Rent", "expense", "home", "#EF4444"],
      ["Utilities", "expense", "zap", "#EAB308"],
      ["Shopping", "expense", "shopping-bag", "#EC4899"],
      ["Health", "expense", "heart", "#F43F5E"],
      ["Other", "expense", "more-horizontal", "#6B7280"],
    ];
    for (const [name, type, icon, color] of defaults) {
      await db.runAsync(
        `INSERT INTO categories (name, type, icon, color) VALUES (?, ?, ?, ?);`,
        [name, type, icon, color],
      );
    }
  }
}

/** Only for dev/testing — wipes all data and re-seeds. */
export async function resetDb() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM transactions;
    DELETE FROM categories;
    DELETE FROM accounts;
  `);
  await seedDefaults(db);
}
