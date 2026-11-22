import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, '..', 'shiftmanager.db');

export const db = new DatabaseSync(DB_PATH);

// Automatically load .env file if present
import fs from 'node:fs';
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const eqIdx = trimmed.indexOf('=');
        const k = trimmed.substring(0, eqIdx).trim();
        const v = trimmed.substring(eqIdx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
} catch (e) {}

// Optional Turso Cloud SQLite Sync (for 100% free permanent cloud hosting on Render)
let turso = null;
if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) {
  try {
    turso = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });
    console.log('🔗 Turso Cloud client initialized for:', process.env.TURSO_DATABASE_URL);
  } catch (err) {
    console.warn('⚠️ Could not initialize Turso client:', err.message);
  }
}

// Enable WAL mode and foreign keys for high performance and integrity
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// Create Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    theme TEXT DEFAULT 'blue',
    openHour REAL DEFAULT 7,
    closeHour REAL DEFAULT 25,
    minWorkers INTEGER DEFAULT 2
  );

  CREATE TABLE IF NOT EXISTS workers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    defaultHours REAL DEFAULT 8,
    primaryLoc TEXT,
    role TEXT DEFAULT 'Radnik',
    phone TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS weeks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    startDateISO TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shifts (
    id TEXT PRIMARY KEY,
    weekId TEXT NOT NULL,
    workerId TEXT NOT NULL,
    dayIndex INTEGER NOT NULL,
    locationId TEXT NOT NULL,
    start REAL NOT NULL,
    end REAL NOT NULL,
    note TEXT DEFAULT '',
    FOREIGN KEY(weekId) REFERENCES weeks(id) ON DELETE CASCADE,
    FOREIGN KEY(workerId) REFERENCES workers(id) ON DELETE CASCADE,
    FOREIGN KEY(locationId) REFERENCES locations(id) ON DELETE CASCADE
  );
`);

// Clean up historic seed duplicate if present before unique index
try {
  db.prepare("UPDATE shifts SET workerId = 'w_erol' WHERE id = 's_68' AND workerId = 'w_nehat'").run();
  db.prepare("DELETE FROM statuses WHERE weekId = 'week_crisis_2' AND workerId = 'w_erol' AND dayIndex = 2 AND status = 'free'").run();
} catch (e) {
  // Ignore if already clean
}

db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_worker_day ON shifts(weekId, workerId, dayIndex);

  CREATE TABLE IF NOT EXISTS statuses (
    id TEXT PRIMARY KEY,
    weekId TEXT NOT NULL,
    workerId TEXT NOT NULL,
    dayIndex INTEGER NOT NULL,
    status TEXT NOT NULL,
    note TEXT DEFAULT '',
    FOREIGN KEY(weekId) REFERENCES weeks(id) ON DELETE CASCADE,
    FOREIGN KEY(workerId) REFERENCES workers(id) ON DELETE CASCADE,
    UNIQUE(weekId, workerId, dayIndex)
  );

  CREATE TABLE IF NOT EXISTS sick_backup (
    id TEXT PRIMARY KEY,
    weekId TEXT NOT NULL,
    workerId TEXT NOT NULL,
    dayIndex INTEGER NOT NULL,
    locationId TEXT NOT NULL,
    start REAL NOT NULL,
    end REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    dataJSON TEXT NOT NULL
  );
`);

// Seed Database if empty
function seedDatabase() {
  const locCount = db.prepare('SELECT COUNT(*) as count FROM locations').get().count;
  if (locCount > 0) return; // already seeded

  console.log('🌱 Seeding initial database with locations, workers and crisis schedule...');

  // 1. Locations
  const insertLoc = db.prepare('INSERT INTO locations (id, name, theme, openHour, closeHour, minWorkers) VALUES (?, ?, ?, ?, ?, ?)');
  insertLoc.run('loc_trubarjeva', 'Trubarjeva', 'blue', 7, 25, 2);
  insertLoc.run('loc_bavarski', 'Bavarski Dvor', 'emerald', 9, 25, 2);

  // 2. Workers
  const insertWorker = db.prepare('INSERT INTO workers (id, name, defaultHours, primaryLoc, role, phone) VALUES (?, ?, ?, ?, ?, ?)');
  const initialWorkers = [
    { id: 'w_elvisa', name: 'Elvisa', defaultHours: 8, primaryLoc: 'loc_trubarjeva', role: 'Jutro', phone: '' },
    { id: 'w_aysun', name: 'Aysun', defaultHours: 8, primaryLoc: 'loc_trubarjeva', role: 'Jutro', phone: '' },
    { id: 'w_zehra', name: 'Zehra', defaultHours: 8, primaryLoc: 'loc_trubarjeva', role: 'Jutro / Međusmjena', phone: '' },
    { id: 'w_rahman', name: 'Rahman', defaultHours: 8, primaryLoc: 'loc_trubarjeva', role: 'Džoker', phone: '' },
    { id: 'w_erol', name: 'Erol', defaultHours: 10, primaryLoc: 'loc_trubarjeva', role: '10h Ispomoć', phone: '' },
    { id: 'w_nehat', name: 'Nehat', defaultHours: 10, primaryLoc: 'loc_trubarjeva', role: '10h Noćna', phone: '' },
    { id: 'w_murat', name: 'Murat', defaultHours: 10, primaryLoc: 'loc_trubarjeva', role: '10h Zatvaranje', phone: '' },
    { id: 'w_rubel', name: 'Rubel', defaultHours: 8, primaryLoc: 'loc_bavarski', role: 'Bavarski Jutro', phone: '' },
    { id: 'w_gazmend', name: 'Gazmend', defaultHours: 8, primaryLoc: 'loc_bavarski', role: 'Bavarski Noć', phone: '' }
  ];
  for (const w of initialWorkers) {
    insertWorker.run(w.id, w.name, w.defaultHours, w.primaryLoc, w.role, w.phone);
  }

  // 3. Weeks
  const insertWeek = db.prepare('INSERT INTO weeks (id, title, startDateISO, createdAt) VALUES (?, ?, ?, ?)');
  insertWeek.run('week_crisis_1', '23.11. - 29.11.2026.', '2026-11-23T00:00:00.000Z', new Date().toISOString());
  insertWeek.run('week_crisis_2', '30.11. - 06.12.2026.', '2026-11-30T00:00:00.000Z', new Date().toISOString());

  // 4. Shifts and Statuses
  const insertShift = db.prepare('INSERT INTO shifts (id, weekId, workerId, dayIndex, locationId, start, end, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertStatus = db.prepare('INSERT OR REPLACE INTO statuses (id, weekId, workerId, dayIndex, status, note) VALUES (?, ?, ?, ?, ?, ?)');

  let sCount = 1;
  const addS = (wId, wIdk, dIdx, locId, start, end) => {
    insertShift.run(`s_${sCount++}`, wId, wIdk, dIdx, locId, start, end, '');
  };
  const addSt = (wId, wIdk, dIdx, status) => {
    insertStatus.run(`st_${wId}_${wIdk}_${dIdx}`, wId, wIdk, dIdx, status, '');
  };

  // Week 1 shifts:
  // Pon 23.11 (d=0)
  addS('week_crisis_1', 'w_elvisa', 0, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_zehra', 0, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_rahman', 0, 'loc_trubarjeva', 10, 20);
  addS('week_crisis_1', 'w_nehat', 0, 'loc_trubarjeva', 14, 24);
  addS('week_crisis_1', 'w_murat', 0, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_1', 'w_gazmend', 0, 'loc_bavarski', 7, 17);
  addS('week_crisis_1', 'w_erol', 0, 'loc_bavarski', 15, 25);
  addSt('week_crisis_1', 'w_aysun', 0, 'free');
  addSt('week_crisis_1', 'w_rubel', 0, 'free');

  // Uto 24.11 (d=1)
  addS('week_crisis_1', 'w_elvisa', 1, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_aysun', 1, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_rahman', 1, 'loc_trubarjeva', 10, 20);
  addS('week_crisis_1', 'w_erol', 1, 'loc_trubarjeva', 14, 24);
  addS('week_crisis_1', 'w_murat', 1, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_1', 'w_gazmend', 1, 'loc_bavarski', 7, 17);
  addS('week_crisis_1', 'w_rubel', 1, 'loc_bavarski', 15, 25);
  addSt('week_crisis_1', 'w_zehra', 1, 'free');
  addSt('week_crisis_1', 'w_nehat', 1, 'free');

  // Sri 25.11 (d=2)
  addS('week_crisis_1', 'w_elvisa', 2, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_aysun', 2, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_zehra', 2, 'loc_trubarjeva', 10, 18);
  addS('week_crisis_1', 'w_rahman', 2, 'loc_trubarjeva', 14, 24);
  addS('week_crisis_1', 'w_murat', 2, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_1', 'w_gazmend', 2, 'loc_bavarski', 7, 17);
  addS('week_crisis_1', 'w_rubel', 2, 'loc_bavarski', 15, 25);
  addSt('week_crisis_1', 'w_erol', 2, 'free');
  addSt('week_crisis_1', 'w_nehat', 2, 'free');

  // Cet 26.11 (d=3)
  addS('week_crisis_1', 'w_elvisa', 3, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_aysun', 3, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_zehra', 3, 'loc_trubarjeva', 10, 18);
  addS('week_crisis_1', 'w_rahman', 3, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_1', 'w_nehat', 3, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_1', 'w_gazmend', 3, 'loc_bavarski', 7, 17);
  addS('week_crisis_1', 'w_rubel', 3, 'loc_bavarski', 15, 25);
  addSt('week_crisis_1', 'w_erol', 3, 'free');
  addSt('week_crisis_1', 'w_murat', 3, 'free');

  // Pet 27.11 (d=4)
  addS('week_crisis_1', 'w_elvisa', 4, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_aysun', 4, 'loc_trubarjeva', 8, 16);
  addS('week_crisis_1', 'w_zehra', 4, 'loc_trubarjeva', 10, 18);
  addS('week_crisis_1', 'w_nehat', 4, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_1', 'w_murat', 4, 'loc_trubarjeva', 16, 26);
  addS('week_crisis_1', 'w_gazmend', 4, 'loc_bavarski', 7, 17);
  addS('week_crisis_1', 'w_erol', 4, 'loc_bavarski', 15, 25);
  addSt('week_crisis_1', 'w_rahman', 4, 'free');
  addSt('week_crisis_1', 'w_rubel', 4, 'sick');

  // Sub 28.11 (d=5)
  addS('week_crisis_1', 'w_aysun', 5, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_zehra', 5, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_nehat', 5, 'loc_trubarjeva', 11, 21);
  addS('week_crisis_1', 'w_rahman', 5, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_1', 'w_murat', 5, 'loc_trubarjeva', 16, 26);
  addS('week_crisis_1', 'w_gazmend', 5, 'loc_bavarski', 7, 17);
  addS('week_crisis_1', 'w_erol', 5, 'loc_bavarski', 15, 25);
  addSt('week_crisis_1', 'w_elvisa', 5, 'free');
  addSt('week_crisis_1', 'w_rubel', 5, 'sick');

  // Ned 29.11 (d=6)
  addS('week_crisis_1', 'w_aysun', 6, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_zehra', 6, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_1', 'w_nehat', 6, 'loc_trubarjeva', 10, 20);
  addS('week_crisis_1', 'w_rahman', 6, 'loc_trubarjeva', 14, 24);
  addS('week_crisis_1', 'w_murat', 6, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_1', 'w_erol', 6, 'loc_bavarski', 9, 25);
  addSt('week_crisis_1', 'w_elvisa', 6, 'free');
  addSt('week_crisis_1', 'w_rubel', 6, 'sick');
  addSt('week_crisis_1', 'w_gazmend', 6, 'free');

  // Week 2 shifts:
  // Pon 30.11 (d=0)
  addS('week_crisis_2', 'w_elvisa', 0, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_zehra', 0, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_rahman', 0, 'loc_trubarjeva', 10, 20);
  addS('week_crisis_2', 'w_nehat', 0, 'loc_trubarjeva', 14, 24);
  addS('week_crisis_2', 'w_murat', 0, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_2', 'w_gazmend', 0, 'loc_bavarski', 7, 17);
  addS('week_crisis_2', 'w_erol', 0, 'loc_bavarski', 15, 25);
  addSt('week_crisis_2', 'w_aysun', 0, 'free');
  addSt('week_crisis_2', 'w_rubel', 0, 'sick');

  // Uto 01.12 (d=1)
  addS('week_crisis_2', 'w_elvisa', 1, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_aysun', 1, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_rahman', 1, 'loc_trubarjeva', 10, 20);
  addS('week_crisis_2', 'w_nehat', 1, 'loc_trubarjeva', 14, 24);
  addS('week_crisis_2', 'w_murat', 1, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_2', 'w_gazmend', 1, 'loc_bavarski', 7, 17);
  addS('week_crisis_2', 'w_erol', 1, 'loc_bavarski', 15, 25);
  addSt('week_crisis_2', 'w_zehra', 1, 'sick');
  addSt('week_crisis_2', 'w_rubel', 1, 'sick');

  // Sri 02.12 (d=2)
  addS('week_crisis_2', 'w_elvisa', 2, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_aysun', 2, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_rahman', 2, 'loc_trubarjeva', 14, 24);
  addS('week_crisis_2', 'w_nehat', 2, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_2', 'w_gazmend', 2, 'loc_bavarski', 7, 17);
  addS('week_crisis_2', 'w_erol', 2, 'loc_bavarski', 15, 25);
  addSt('week_crisis_2', 'w_zehra', 2, 'sick');
  addSt('week_crisis_2', 'w_murat', 2, 'free');
  addSt('week_crisis_2', 'w_rubel', 2, 'sick');

  // Cet 03.12 (d=3)
  addS('week_crisis_2', 'w_elvisa', 3, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_aysun', 3, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_rahman', 3, 'loc_trubarjeva', 14, 24);
  addS('week_crisis_2', 'w_murat', 3, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_2', 'w_gazmend', 3, 'loc_bavarski', 7, 17);
  addS('week_crisis_2', 'w_erol', 3, 'loc_bavarski', 15, 25);
  addSt('week_crisis_2', 'w_zehra', 3, 'sick');
  addSt('week_crisis_2', 'w_nehat', 3, 'free');
  addSt('week_crisis_2', 'w_rubel', 3, 'sick');

  // Pet 04.12 (d=4)
  addS('week_crisis_2', 'w_elvisa', 4, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_aysun', 4, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_rahman', 4, 'loc_trubarjeva', 10, 20);
  addS('week_crisis_2', 'w_nehat', 4, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_2', 'w_murat', 4, 'loc_trubarjeva', 16, 26);
  addS('week_crisis_2', 'w_gazmend', 4, 'loc_bavarski', 7, 17);
  addS('week_crisis_2', 'w_erol', 4, 'loc_bavarski', 15, 25);
  addSt('week_crisis_2', 'w_zehra', 4, 'sick');
  addSt('week_crisis_2', 'w_rubel', 4, 'sick');

  // Sub 05.12 (d=5)
  addS('week_crisis_2', 'w_aysun', 5, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_elvisa', 5, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_rahman', 5, 'loc_trubarjeva', 10, 20);
  addS('week_crisis_2', 'w_nehat', 5, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_2', 'w_murat', 5, 'loc_trubarjeva', 16, 26);
  addS('week_crisis_2', 'w_gazmend', 5, 'loc_bavarski', 7, 17);
  addS('week_crisis_2', 'w_erol', 5, 'loc_bavarski', 15, 25);
  addSt('week_crisis_2', 'w_zehra', 5, 'sick');
  addSt('week_crisis_2', 'w_rubel', 5, 'sick');

  // Ned 06.12 (d=6)
  addS('week_crisis_2', 'w_aysun', 6, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_rahman', 6, 'loc_trubarjeva', 7, 15);
  addS('week_crisis_2', 'w_nehat', 6, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_2', 'w_murat', 6, 'loc_trubarjeva', 15, 25);
  addS('week_crisis_2', 'w_erol', 6, 'loc_bavarski', 7, 17);
  addS('week_crisis_2', 'w_rubel', 6, 'loc_bavarski', 15, 25);
  addSt('week_crisis_2', 'w_elvisa', 6, 'free');
  addSt('week_crisis_2', 'w_zehra', 6, 'sick');
  addSt('week_crisis_2', 'w_gazmend', 6, 'free');

  console.log('✅ Initial seed data successfully inserted into SQLite database!');
}

seedDatabase();

// --- DATA ACCESS METHODS ---

export function getFullData() {
  const locations = db.prepare(`
    SELECT * FROM locations 
    ORDER BY 
      CASE 
        WHEN id = 'loc_trubarjeva' OR name LIKE '%Trubarjeva%' THEN 1 
        WHEN id = 'loc_bavarski' OR name LIKE '%Bavarski%' THEN 2 
        ELSE 3 
      END, 
      name ASC
  `).all();
  const workers = db.prepare('SELECT * FROM workers ORDER BY name ASC').all();
  const weeks = db.prepare('SELECT * FROM weeks ORDER BY startDateISO ASC').all();
  const shifts = db.prepare('SELECT * FROM shifts').all();
  const statuses = db.prepare('SELECT * FROM statuses').all();
  const sickBackup = db.prepare('SELECT * FROM sick_backup').all();

  // Format into weeks structure
  const formattedWeeks = weeks.map(w => {
    const weekShifts = shifts.filter(s => s.weekId === w.id);
    const weekStatusesObj = {};
    statuses.filter(st => st.weekId === w.id).forEach(st => {
      weekStatusesObj[`${st.workerId}-${st.dayIndex}`] = st.status;
    });
    const weekSickBackup = sickBackup.filter(sb => sb.weekId === w.id);

    return {
      id: w.id,
      title: w.title,
      startDateISO: w.startDateISO,
      createdAt: w.createdAt,
      shifts: weekShifts,
      statuses: weekStatusesObj,
      sickBackup: weekSickBackup
    };
  });

  return {
    locations,
    workers,
    weeks: formattedWeeks
  };
}

// Worker Methods
export function addWorker({ id, name, defaultHours, primaryLoc, role, phone }) {
  const workerId = id || `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare('INSERT INTO workers (id, name, defaultHours, primaryLoc, role, phone) VALUES (?, ?, ?, ?, ?, ?)')
    .run(workerId, name, defaultHours || 8, primaryLoc || null, role || 'Radnik', phone || '');
  return db.prepare('SELECT * FROM workers WHERE id = ?').get(workerId);
}

export function updateWorker(id, { name, defaultHours, primaryLoc, role, phone }) {
  db.prepare('UPDATE workers SET name = ?, defaultHours = ?, primaryLoc = ?, role = ?, phone = ? WHERE id = ?')
    .run(name, defaultHours, primaryLoc, role, phone, id);
  return db.prepare('SELECT * FROM workers WHERE id = ?').get(id);
}

export function deleteWorker(id) {
  db.prepare('DELETE FROM workers WHERE id = ?').run(id);
  return { success: true, id };
}

// Location Methods
export function addLocation({ id, name, theme, openHour, closeHour, minWorkers }) {
  const locId = id || `loc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.prepare('INSERT INTO locations (id, name, theme, openHour, closeHour, minWorkers) VALUES (?, ?, ?, ?, ?, ?)')
    .run(locId, name, theme || 'blue', openHour || 7, closeHour || 25, minWorkers || 2);
  return db.prepare('SELECT * FROM locations WHERE id = ?').get(locId);
}

export function updateLocation(id, { name, theme, openHour, closeHour, minWorkers }) {
  db.prepare('UPDATE locations SET name = ?, theme = ?, openHour = ?, closeHour = ?, minWorkers = ? WHERE id = ?')
    .run(name, theme, openHour, closeHour, minWorkers, id);
  return db.prepare('SELECT * FROM locations WHERE id = ?').get(id);
}

export function deleteLocation(id) {
  db.prepare('DELETE FROM locations WHERE id = ?').run(id);
  return { success: true, id };
}

// Week Methods
export function addWeek({ id, title, startDateISO, copyFromWeekId }) {
  const weekId = id || `week_${Date.now()}`;
  const now = new Date().toISOString();
  db.prepare('INSERT INTO weeks (id, title, startDateISO, createdAt) VALUES (?, ?, ?, ?)').run(weekId, title, startDateISO, now);

  if (copyFromWeekId) {
    // Copy shifts from target week
    const srcShifts = db.prepare('SELECT * FROM shifts WHERE weekId = ?').all(copyFromWeekId);
    const insertShift = db.prepare('INSERT INTO shifts (id, weekId, workerId, dayIndex, locationId, start, end, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const s of srcShifts) {
      const newShiftId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      insertShift.run(newShiftId, weekId, s.workerId, s.dayIndex, s.locationId, s.start, s.end, s.note || '');
    }

    // Copy statuses
    const srcStatuses = db.prepare('SELECT * FROM statuses WHERE weekId = ?').all(copyFromWeekId);
    const insertStatus = db.prepare('INSERT INTO statuses (id, weekId, workerId, dayIndex, status, note) VALUES (?, ?, ?, ?, ?, ?)');
    for (const st of srcStatuses) {
      const newStatusId = `st_${weekId}_${st.workerId}_${st.dayIndex}`;
      insertStatus.run(newStatusId, weekId, st.workerId, st.dayIndex, st.status, st.note || '');
    }
  }

  return getFullData().weeks.find(w => w.id === weekId);
}

export function updateWeek(id, { title, startDateISO }) {
  db.prepare('UPDATE weeks SET title = ?, startDateISO = ? WHERE id = ?').run(title, startDateISO, id);
  return db.prepare('SELECT * FROM weeks WHERE id = ?').get(id);
}

export function deleteWeek(id) {
  db.prepare('DELETE FROM weeks WHERE id = ?').run(id);
  return { success: true, id };
}

// Shift Methods
export function addShift({ id, weekId, workerId, dayIndex, locationId, start, end, note }) {
  const dIdx = Number(dayIndex);
  // Strict prevention: Worker cannot have more than one shift on the same day across ALL locations
  const existing = db.prepare('SELECT id, locationId, start, end FROM shifts WHERE weekId = ? AND workerId = ? AND dayIndex = ?')
    .get(weekId, workerId, dIdx);
  if (existing) {
    throw new Error(`Radnik već ima smjenu na ovaj dan (${existing.start}:00 - ${existing.end}:00)! Jedan radnik ne može biti dodan 2x u istom danu niti raditi u 2 lokala istovremeno.`);
  }

  const shiftId = id || `s_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  db.prepare('INSERT INTO shifts (id, weekId, workerId, dayIndex, locationId, start, end, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(shiftId, weekId, workerId, dIdx, locationId, start, end, note || '');

  // If worker was marked free, remove the free status
  db.prepare('DELETE FROM statuses WHERE weekId = ? AND workerId = ? AND dayIndex = ? AND status = ?')
    .run(weekId, workerId, dIdx, 'free');

  return db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId);
}

export function updateShift(id, { locationId, dayIndex, start, end, note }) {
  const current = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
  if (!current) throw new Error('Shift not found');

  const newLoc = locationId !== undefined ? locationId : current.locationId;
  const newDay = dayIndex !== undefined ? Number(dayIndex) : current.dayIndex;
  const newStart = start !== undefined ? Number(start) : current.start;
  const newEnd = end !== undefined ? Number(end) : current.end;
  const newNote = note !== undefined ? note : current.note;

  // Strict prevention: If changing day, ensure worker has no existing shift on destination day
  if (newDay !== current.dayIndex) {
    const existing = db.prepare('SELECT id FROM shifts WHERE weekId = ? AND workerId = ? AND dayIndex = ? AND id != ?')
      .get(current.weekId, current.workerId, newDay, id);
    if (existing) {
      throw new Error(`Radnik već ima smjenu na dan ${newDay}! Jedan radnik ne može raditi 2x u istom danu niti u više lokala istovremeno.`);
    }
  }

  db.prepare('UPDATE shifts SET locationId = ?, dayIndex = ?, start = ?, end = ?, note = ? WHERE id = ?')
    .run(newLoc, newDay, newStart, newEnd, newNote, id);

  return db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
}

export function deleteShift(id) {
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(id);
  if (shift) {
    db.prepare('DELETE FROM shifts WHERE id = ?').run(id);
    // If worker has no remaining shifts on this day, mark them free
    const remaining = db.prepare('SELECT COUNT(*) as count FROM shifts WHERE weekId = ? AND workerId = ? AND dayIndex = ?')
      .get(shift.weekId, shift.workerId, shift.dayIndex).count;
    if (remaining === 0) {
      const statusId = `st_${shift.weekId}_${shift.workerId}_${shift.dayIndex}`;
      db.prepare('INSERT OR REPLACE INTO statuses (id, weekId, workerId, dayIndex, status, note) VALUES (?, ?, ?, ?, ?, ?)')
        .run(statusId, shift.weekId, shift.workerId, shift.dayIndex, 'free', '');
    }
  }
  return { success: true, id };
}

// Status Methods (Absence, Sick, Free)
export function setWorkerStatus({ weekId, workerId, fromDay, toDay, status, note }) {
  const insertStatus = db.prepare('INSERT OR REPLACE INTO statuses (id, weekId, workerId, dayIndex, status, note) VALUES (?, ?, ?, ?, ?, ?)');

  for (let d = fromDay; d <= toDay; d++) {
    const statusId = `st_${weekId}_${workerId}_${d}`;
    insertStatus.run(statusId, weekId, workerId, d, status, note || '');

    // If sick, backup their shifts for those days and remove them from active shifts
    if (status === 'sick') {
      const currentShifts = db.prepare('SELECT * FROM shifts WHERE weekId = ? AND workerId = ? AND dayIndex = ?').all(weekId, workerId, d);
      const backupInsert = db.prepare('INSERT INTO sick_backup (id, weekId, workerId, dayIndex, locationId, start, end) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const cs of currentShifts) {
        backupInsert.run(`sb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, weekId, workerId, d, cs.locationId, cs.start, cs.end);
      }
      db.prepare('DELETE FROM shifts WHERE weekId = ? AND workerId = ? AND dayIndex = ?').run(weekId, workerId, d);
    } else if (status === 'free') {
      db.prepare('DELETE FROM shifts WHERE weekId = ? AND workerId = ? AND dayIndex = ?').run(weekId, workerId, d);
    }
  }
  return { success: true };
}

export function clearWorkerSick({ weekId, workerId, fromDay, restoreShifts }) {
  for (let d = fromDay; d < 7; d++) {
    const current = db.prepare('SELECT * FROM statuses WHERE weekId = ? AND workerId = ? AND dayIndex = ?').get(weekId, workerId, d);
    if (current && current.status === 'sick') {
      db.prepare('DELETE FROM statuses WHERE weekId = ? AND workerId = ? AND dayIndex = ?').run(weekId, workerId, d);
      
      if (restoreShifts) {
        const saved = db.prepare('SELECT * FROM sick_backup WHERE weekId = ? AND workerId = ? AND dayIndex = ?').all(weekId, workerId, d);
        const insertShift = db.prepare('INSERT INTO shifts (id, weekId, workerId, dayIndex, locationId, start, end, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const s of saved) {
          const shiftId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          insertShift.run(shiftId, weekId, workerId, d, s.locationId, s.start, s.end, '');
        }
      } else {
        const statusId = `st_${weekId}_${workerId}_${d}`;
        db.prepare('INSERT OR REPLACE INTO statuses (id, weekId, workerId, dayIndex, status, note) VALUES (?, ?, ?, ?, ?, ?)')
          .run(statusId, weekId, workerId, d, 'free', '');
      }
      db.prepare('DELETE FROM sick_backup WHERE weekId = ? AND workerId = ? AND dayIndex = ?').run(weekId, workerId, d);
    }
  }
  return { success: true };
}

export function copyDayShifts({ weekId, sourceDay, targetDays }) {
  const srcShifts = db.prepare('SELECT * FROM shifts WHERE weekId = ? AND dayIndex = ?').all(weekId, sourceDay);
  const insertShift = db.prepare('INSERT INTO shifts (id, weekId, workerId, dayIndex, locationId, start, end, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

  for (const targetDay of targetDays) {
    // Delete existing shifts on targetDay
    db.prepare('DELETE FROM shifts WHERE weekId = ? AND dayIndex = ?').run(weekId, targetDay);
    // Insert copied shifts
    for (const s of srcShifts) {
      const shiftId = `s_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      insertShift.run(shiftId, weekId, s.workerId, targetDay, s.locationId, s.start, s.end, s.note || '');
    }
    // Copy statuses
    const srcStatuses = db.prepare('SELECT * FROM statuses WHERE weekId = ? AND dayIndex = ?').all(weekId, sourceDay);
    db.prepare('DELETE FROM statuses WHERE weekId = ? AND dayIndex = ?').run(weekId, targetDay);
    const insertStatus = db.prepare('INSERT INTO statuses (id, weekId, workerId, dayIndex, status, note) VALUES (?, ?, ?, ?, ?, ?)');
    for (const st of srcStatuses) {
      const statusId = `st_${weekId}_${st.workerId}_${targetDay}`;
      insertStatus.run(statusId, weekId, st.workerId, targetDay, st.status, st.note || '');
    }
  }
  return { success: true };
}

// Reset Database to Crisis Weeks
export function resetToCrisis() {
  db.exec(`
    DELETE FROM sick_backup;
    DELETE FROM statuses;
    DELETE FROM shifts;
    DELETE FROM weeks;
    DELETE FROM workers;
    DELETE FROM locations;
  `);
  seedDatabase();
  return getFullData();
}

// Full import from JSON backup
export function importFullBackup(data) {
  if (!data || !data.locations || !data.workers || !data.weeks) {
    throw new Error('Invalid backup file format');
  }

  db.exec(`
    DELETE FROM sick_backup;
    DELETE FROM statuses;
    DELETE FROM shifts;
    DELETE FROM weeks;
    DELETE FROM workers;
    DELETE FROM locations;
  `);

  const insertLoc = db.prepare('INSERT INTO locations (id, name, theme, openHour, closeHour, minWorkers) VALUES (?, ?, ?, ?, ?, ?)');
  for (const l of data.locations) {
    insertLoc.run(l.id, l.name, l.theme || 'blue', l.openHour || 7, l.closeHour || 25, l.minWorkers || 2);
  }

  const insertWorker = db.prepare('INSERT INTO workers (id, name, defaultHours, primaryLoc, role, phone) VALUES (?, ?, ?, ?, ?, ?)');
  for (const w of data.workers) {
    insertWorker.run(w.id, w.name, w.defaultHours || 8, w.primaryLoc || null, w.role || 'Radnik', w.phone || '');
  }

  const insertWeek = db.prepare('INSERT INTO weeks (id, title, startDateISO, createdAt) VALUES (?, ?, ?, ?)');
  const insertShift = db.prepare('INSERT INTO shifts (id, weekId, workerId, dayIndex, locationId, start, end, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertStatus = db.prepare('INSERT INTO statuses (id, weekId, workerId, dayIndex, status, note) VALUES (?, ?, ?, ?, ?, ?)');

  for (const wk of data.weeks) {
    insertWeek.run(wk.id, wk.title, wk.startDateISO || new Date().toISOString(), wk.createdAt || new Date().toISOString());
    if (wk.shifts && Array.isArray(wk.shifts)) {
      for (const s of wk.shifts) {
        insertShift.run(s.id || `s_${Date.now()}_${Math.random().toString(36).substring(2,6)}`, wk.id, s.workerId, s.dayIndex, s.locationId, s.start, s.end, s.note || '');
      }
    }
    if (wk.statuses && typeof wk.statuses === 'object') {
      for (const [key, val] of Object.entries(wk.statuses)) {
        const [workerId, dayIndexStr] = key.split('-');
        const dayIndex = parseInt(dayIndexStr, 10);
        if (workerId && !isNaN(dayIndex)) {
          insertStatus.run(`st_${wk.id}_${workerId}_${dayIndex}`, wk.id, workerId, dayIndex, val, '');
        }
      }
    }
  }

  return getFullData();
}

// Snapshot / Checkpoint Methods for Safe Reset & Explicit Save
db.exec(`
  CREATE TABLE IF NOT EXISTS saved_checkpoints (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    dataJSON TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function setDirty(val) {
  try {
    const v = val ? '1' : '0';
    db.prepare('INSERT OR REPLACE INTO app_meta (key, value) VALUES (\'is_dirty\', ?)').run(v);
  } catch (e) {}
}

export function isDirty() {
  try {
    const row = db.prepare('SELECT value FROM app_meta WHERE key = \'is_dirty\'').get();
    return row?.value === '1';
  } catch (e) {
    return false;
  }
}

export async function saveCurrentState() {
  const data = getFullData();
  const now = new Date().toISOString();
  const dataJSON = JSON.stringify(data);
  // Store the active last_saved checkpoint locally
  db.prepare('INSERT OR REPLACE INTO saved_checkpoints (id, createdAt, dataJSON) VALUES (\'last_saved\', ?, ?)')
    .run(now, dataJSON);
  // Also keep historical log of saves
  db.prepare('INSERT OR REPLACE INTO saved_checkpoints (id, createdAt, dataJSON) VALUES (?, ?, ?)')
    .run(`save_${Date.now()}`, now, dataJSON);
  try {
    db.exec(`
      DELETE FROM saved_checkpoints WHERE id NOT IN (
        'last_saved',
        (SELECT id FROM saved_checkpoints WHERE id != 'last_saved' ORDER BY createdAt DESC LIMIT 20)
      )
    `);
  } catch (e) {}
  setDirty(false);

  // If Turso Cloud is configured, sync snapshot permanently to Turso
  if (turso) {
    try {
      await turso.execute({
        sql: "INSERT OR REPLACE INTO saved_checkpoints (id, createdAt, dataJSON) VALUES ('last_saved', ?, ?)",
        args: [now, dataJSON]
      });
      console.log('☁️ Successfully synced save to Turso Cloud!');
    } catch (err) {
      console.error('⚠️ Failed to sync save to Turso Cloud:', err.message);
    }
  }

  return { success: true, savedAt: now };
}

export async function revertToLastSaved() {
  // If Turso Cloud is configured, attempt to fetch latest from Turso first
  if (turso) {
    try {
      const result = await turso.execute("SELECT dataJSON, createdAt FROM saved_checkpoints WHERE id = 'last_saved'");
      if (result.rows && result.rows.length > 0 && result.rows[0].dataJSON) {
        const cloudData = JSON.parse(result.rows[0].dataJSON);
        const restored = importFullBackup(cloudData);
        setDirty(false);
        return { success: true, data: restored, savedAt: result.rows[0].createdAt };
      }
    } catch (err) {
      console.warn('⚠️ Could not fetch from Turso, falling back to local:', err.message);
    }
  }

  const saved = db.prepare('SELECT * FROM saved_checkpoints WHERE id = \'last_saved\'').get();
  if (!saved || !saved.dataJSON) {
    throw new Error('Nema prethodno spremljenog stanja za vraćanje!');
  }
  const restored = importFullBackup(JSON.parse(saved.dataJSON));
  setDirty(false);
  return { success: true, data: restored, savedAt: saved.createdAt };
}

export async function initTursoSync() {
  if (!turso) {
    console.log('ℹ️ Turso credentials not provided. Running on local SQLite database.');
    return;
  }
  console.log('🔄 Connecting to Turso Cloud SQLite...');
  try {
    await turso.execute(`
      CREATE TABLE IF NOT EXISTS saved_checkpoints (
        id TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL,
        dataJSON TEXT NOT NULL
      );
    `);
    const result = await turso.execute("SELECT dataJSON, createdAt FROM saved_checkpoints WHERE id = 'last_saved'");
    if (result.rows && result.rows.length > 0 && result.rows[0].dataJSON) {
      const cloudData = JSON.parse(result.rows[0].dataJSON);
      console.log(`☁️ Restoring database from Turso Cloud (Saved at: ${result.rows[0].createdAt})...`);
      importFullBackup(cloudData);
      console.log('✅ Successfully restored database from Turso Cloud!');
    } else {
      console.log('☁️ Turso is empty. Pushing initial database to Turso Cloud...');
      const localData = getFullData();
      const now = new Date().toISOString();
      await turso.execute({
        sql: "INSERT OR REPLACE INTO saved_checkpoints (id, createdAt, dataJSON) VALUES ('last_saved', ?, ?)",
        args: [now, JSON.stringify(localData)]
      });
      console.log('✅ Initial database synced to Turso Cloud!');
    }
  } catch (err) {
    console.error('⚠️ Turso sync error:', err.message);
  }
}

export function getLastSavedInfo() {
  try {
    const row = db.prepare('SELECT createdAt FROM saved_checkpoints WHERE id = \'last_saved\'').get();
    return {
      savedAt: row?.createdAt || null,
      isDirty: isDirty()
    };
  } catch (e) {
    return { savedAt: null, isDirty: false };
  }
}

export function saveCheckpoint(checkpointId = null) {
  const data = getFullData();
  const now = new Date().toISOString();
  const id = checkpointId || `snap_${Date.now()}`;
  db.prepare('INSERT OR REPLACE INTO snapshots (id, createdAt, dataJSON) VALUES (?, ?, ?)')
    .run(id, now, JSON.stringify(data));
  try {
    db.exec(`
      DELETE FROM snapshots WHERE id NOT IN (
        SELECT id FROM snapshots ORDER BY createdAt DESC LIMIT 30
      )
    `);
  } catch (e) {}
  return { success: true, checkpointId: id, createdAt: now };
}

export function saveCheckpointBeforeMutation() {
  setDirty(true);
}

export function revertToPreviousSnapshot() {
  return revertToLastSaved();
}

// Initialize default save checkpoint if none exists
try {
  const existingSave = db.prepare('SELECT id FROM saved_checkpoints WHERE id = \'last_saved\'').get();
  if (!existingSave) {
    saveCurrentState();
  }
} catch (e) {}

