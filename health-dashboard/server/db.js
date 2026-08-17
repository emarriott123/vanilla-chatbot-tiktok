const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'health.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS days (
    date            TEXT PRIMARY KEY,
    day_type        TEXT NOT NULL DEFAULT 'normal',
    training        TEXT NOT NULL DEFAULT '[false,false,false,false,false]',
    sleep_hours     REAL,
    sleep_eye_mask  INTEGER NOT NULL DEFAULT 0,
    sleep_ear_plugs INTEGER NOT NULL DEFAULT 0,
    sleep_wind_down INTEGER NOT NULL DEFAULT 0,
    supp_creatine   INTEGER NOT NULL DEFAULT 0,
    supp_protein    INTEGER NOT NULL DEFAULT 0,
    supp_vitamin_d  INTEGER NOT NULL DEFAULT 0,
    supp_omega3     INTEGER NOT NULL DEFAULT 0,
    note            TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS food_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    date       TEXT NOT NULL,
    text       TEXT NOT NULL,
    kcal       REAL NOT NULL,
    protein    REAL NOT NULL,
    carbs      REAL NOT NULL,
    fat        REAL NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_food_log_date ON food_log(date);

  CREATE TABLE IF NOT EXISTS lifts (
    exercise TEXT PRIMARY KEY,
    weight   REAL NOT NULL DEFAULT 0,
    reps     INTEGER NOT NULL DEFAULT 0
  );
`);

// Lift log is a single running record per exercise (persists across days).
const LIFT_EXERCISES = ['bench_press', 'squat', 'overhead_press', 'row_pullup'];
const insertLiftIfMissing = db.prepare(
  'INSERT OR IGNORE INTO lifts (exercise, weight, reps) VALUES (?, 0, 0)'
);
for (const exercise of LIFT_EXERCISES) insertLiftIfMissing.run(exercise);

module.exports = { db, LIFT_EXERCISES };
