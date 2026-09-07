require('dotenv').config();

const path = require('path');
const express = require('express');

const { db } = require('./db');
const { estimateMacros } = require('./anthropic');
const { LIFT_EXERCISES, todayStr, getOrCreateDay, buildDashboard } = require('./dashboard');

const app = express();
const PORT = process.env.PORT || 5050;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    '\n⚠️  ANTHROPIC_API_KEY is not set — food logging will fail until you add it to .env\n' +
      '   Copy .env.example to .env and add your key: cp .env.example .env\n'
  );
}

// GET /api/dashboard?date=YYYY-MM-DD  (defaults to today)
app.get('/api/dashboard', (req, res) => {
  const date = req.query.date || todayStr();
  res.json(buildDashboard(date));
});

// PUT /api/dashboard/:date  — partial update of day-scoped fields
app.put('/api/dashboard/:date', (req, res) => {
  const { date } = req.params;
  getOrCreateDay(date);

  const { dayType, training, sleep, supplements, note } = req.body || {};
  const updates = [];
  const values = [];

  if (dayType === 'normal' || dayType === 'shift') {
    updates.push('day_type = ?');
    values.push(dayType);
  }
  if (Array.isArray(training) && training.length === 5) {
    updates.push('training = ?');
    values.push(JSON.stringify(training.map(Boolean)));
  }
  if (sleep && typeof sleep === 'object') {
    if (sleep.hours !== undefined) {
      updates.push('sleep_hours = ?');
      values.push(sleep.hours === null || sleep.hours === '' ? null : Number(sleep.hours));
    }
    if (sleep.eyeMask !== undefined) {
      updates.push('sleep_eye_mask = ?');
      values.push(sleep.eyeMask ? 1 : 0);
    }
    if (sleep.earPlugs !== undefined) {
      updates.push('sleep_ear_plugs = ?');
      values.push(sleep.earPlugs ? 1 : 0);
    }
    if (sleep.windDown !== undefined) {
      updates.push('sleep_wind_down = ?');
      values.push(sleep.windDown ? 1 : 0);
    }
  }
  if (supplements && typeof supplements === 'object') {
    if (supplements.creatine !== undefined) {
      updates.push('supp_creatine = ?');
      values.push(supplements.creatine ? 1 : 0);
    }
    if (supplements.proteinPowder !== undefined) {
      updates.push('supp_protein = ?');
      values.push(supplements.proteinPowder ? 1 : 0);
    }
    if (supplements.vitaminD !== undefined) {
      updates.push('supp_vitamin_d = ?');
      values.push(supplements.vitaminD ? 1 : 0);
    }
    if (supplements.omega3 !== undefined) {
      updates.push('supp_omega3 = ?');
      values.push(supplements.omega3 ? 1 : 0);
    }
  }
  if (note !== undefined) {
    updates.push('note = ?');
    values.push(String(note));
  }

  if (updates.length) {
    values.push(date);
    db.prepare(`UPDATE days SET ${updates.join(', ')} WHERE date = ?`).run(...values);
  }

  res.json(buildDashboard(date));
});

function isValidMacros(m) {
  return (
    m &&
    typeof m === 'object' &&
    ['kcal', 'protein', 'carbs', 'fat'].every((k) => Number.isFinite(Number(m[k])))
  );
}

function normalizeMacros(m) {
  const toNumber = (v) => Math.max(0, Math.round(Number(v) || 0));
  return {
    kcal: toNumber(m.kcal),
    protein: toNumber(m.protein),
    carbs: toNumber(m.carbs),
    fat: toNumber(m.fat),
  };
}

// POST /api/dashboard/:date/food  { text, macros? }
// If macros are provided (e.g. logging a saved favorite), they're used as-is —
// no Claude call needed since the values are already known. Otherwise the
// text is sent to Claude for estimation, same as before.
app.post('/api/dashboard/:date/food', async (req, res) => {
  const { date } = req.params;
  const text = (req.body && req.body.text ? String(req.body.text) : '').trim();
  const providedMacros = req.body && req.body.macros;

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  getOrCreateDay(date);

  try {
    const macros = isValidMacros(providedMacros)
      ? normalizeMacros(providedMacros)
      : await estimateMacros(text);
    db.prepare(
      `INSERT INTO food_log (date, text, kcal, protein, carbs, fat, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(date, text, macros.kcal, macros.protein, macros.carbs, macros.fat, new Date().toISOString());

    res.json(buildDashboard(date));
  } catch (err) {
    console.error('Macro estimation failed:', err.message);
    res.status(502).json({ error: err.message || 'Failed to estimate macros' });
  }
});

// DELETE /api/food/:id
app.delete('/api/food/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT date FROM food_log WHERE id = ?').get(id);
  db.prepare('DELETE FROM food_log WHERE id = ?').run(id);
  res.json(buildDashboard(row ? row.date : todayStr()));
});

// PUT /api/lifts/:exercise  { weight, reps }
app.put('/api/lifts/:exercise', (req, res) => {
  const { exercise } = req.params;
  if (!LIFT_EXERCISES.includes(exercise)) {
    return res.status(400).json({ error: 'Unknown exercise' });
  }
  const weight = Number(req.body?.weight) || 0;
  const reps = Number(req.body?.reps) || 0;

  db.prepare('UPDATE lifts SET weight = ?, reps = ? WHERE exercise = ?').run(weight, reps, exercise);

  const date = String(req.query.date || todayStr());
  res.json(buildDashboard(date));
});

app.listen(PORT, () => {
  console.log(`\n🏋️  Health dashboard running at http://localhost:${PORT}\n`);
});
