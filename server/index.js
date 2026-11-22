import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Track unsaved modifications (dirty flag)
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && 
      !req.path.includes('/save') && 
      !req.path.includes('/reset-to-saved') && 
      !req.path.includes('/revert-previous')) {
    db.setDirty(true);
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: 'sqlite', timestamp: new Date().toISOString() });
});

// 1. Bootstrap: get full state (if previous session left without saving, automatically revert to last saved state)
app.get('/api/bootstrap', (req, res) => {
  try {
    if (db.isDirty() && req.query.fresh === 'true') {
      db.revertToLastSaved();
    }
    const data = db.getFullData();
    res.json({
      ...data,
      isDirty: db.isDirty(),
      lastSavedInfo: db.getLastSavedInfo()
    });
  } catch (err) {
    console.error('Error in /api/bootstrap:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Locations
app.post('/api/locations', (req, res) => {
  try {
    const loc = db.addLocation(req.body);
    res.status(201).json(loc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/locations/:id', (req, res) => {
  try {
    const loc = db.updateLocation(req.params.id, req.body);
    res.json(loc);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/locations/:id', (req, res) => {
  try {
    const result = db.deleteLocation(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Workers
app.post('/api/workers', (req, res) => {
  try {
    const worker = db.addWorker(req.body);
    res.status(201).json(worker);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/workers/:id', (req, res) => {
  try {
    const worker = db.updateWorker(req.params.id, req.body);
    res.json(worker);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/workers/:id', (req, res) => {
  try {
    const result = db.deleteWorker(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Weeks
app.post('/api/weeks', (req, res) => {
  try {
    const week = db.addWeek(req.body);
    res.status(201).json(week);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/weeks/:id', (req, res) => {
  try {
    const week = db.updateWeek(req.params.id, req.body);
    res.json(week);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/weeks/:id', (req, res) => {
  try {
    const result = db.deleteWeek(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Shifts
app.post('/api/shifts', (req, res) => {
  try {
    const shift = db.addShift(req.body);
    res.status(201).json(shift);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/shifts/:id', (req, res) => {
  try {
    const shift = db.updateShift(req.params.id, req.body);
    res.json(shift);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/shifts/:id', (req, res) => {
  try {
    const result = db.deleteShift(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Statuses (Absence, Sick, Free)
app.post('/api/statuses', (req, res) => {
  try {
    const result = db.setWorkerStatus(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/statuses/clear-sick', (req, res) => {
  try {
    const result = db.clearWorkerSick(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/shifts/copy-day', (req, res) => {
  try {
    const result = db.copyDayShifts(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Reset & Explicit Save / Checkpoints
app.post('/api/save', async (req, res) => {
  try {
    const result = await db.saveCurrentState();
    res.json(result);
  } catch (err) {
    console.error('Error in /api/save:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset-to-saved', async (req, res) => {
  try {
    const result = await db.revertToLastSaved();
    res.json(result);
  } catch (err) {
    console.error('Error in /api/reset-to-saved:', err);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/save-status', (req, res) => {
  try {
    res.json(db.getLastSavedInfo());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/revert-previous', (req, res) => {
  try {
    const result = db.revertToLastSaved();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/checkpoint', (req, res) => {
  try {
    const result = db.saveCurrentState();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset-crisis', (req, res) => {
  try {
    const fullData = db.resetToCrisis();
    res.json(fullData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backup/export', (req, res) => {
  try {
    const data = db.getFullData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=seherezada_backup_${Date.now()}.json`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backup/import', (req, res) => {
  try {
    const fullData = db.importFullBackup(req.body);
    res.json(fullData);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Serve frontend static build
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Šeherezada Shift Pro Server je uspješno pokrenut!`);
  console.log(`👉 Pristup u pretraživaču: http://localhost:${PORT}`);
  console.log(`💾 SQLite baza podataka: shiftmanager.db`);
  console.log(`======================================================\n`);

  // Initialize Turso Cloud Sync if credentials are provided
  await db.initTursoSync();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`⚠️ Port ${PORT} je već zauzet. Pokušajte zatvoriti prethodni proces.`);
  } else {
    console.error('Server error:', err);
  }
});
