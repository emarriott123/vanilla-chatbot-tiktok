const { db, LIFT_EXERCISES } = require('./db');

const DAY_TARGETS = {
  normal: { protein: 180, kcal: 2600 },
  shift: { protein: 160, kcal: 2900 },
};

function targetsFor(dayType) {
  return DAY_TARGETS[dayType] || DAY_TARGETS.normal;
}

function todayStr() {
  const d = new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function addDays(dateStr, delta) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function getDayRow(date) {
  return db.prepare('SELECT * FROM days WHERE date = ?').get(date);
}

function getOrCreateDay(date) {
  let row = getDayRow(date);
  if (!row) {
    db.prepare('INSERT INTO days (date) VALUES (?)').run(date);
    row = getDayRow(date);
  }
  return row;
}

function foodLogFor(date) {
  return db.prepare('SELECT * FROM food_log WHERE date = ? ORDER BY id ASC').all(date);
}

function totalsFor(entries) {
  return entries.reduce(
    (acc, e) => ({
      kcal: acc.kcal + e.kcal,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function proteinTotalForDate(date) {
  return db.prepare('SELECT COALESCE(SUM(protein), 0) AS p FROM food_log WHERE date = ?').get(date).p;
}

function proteinHitForDate(date) {
  const row = getDayRow(date);
  const dayType = row ? row.day_type : 'normal';
  const targets = targetsFor(dayType);
  return proteinTotalForDate(date) >= targets.protein;
}

function trainingLoggedForDate(date) {
  const row = getDayRow(date);
  if (!row) return false;
  try {
    const arr = JSON.parse(row.training);
    return Array.isArray(arr) && arr.some(Boolean);
  } catch {
    return false;
  }
}

function streakStrip(date, days = 7) {
  const strip = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(date, -i);
    strip.push({ date: d, hit: proteinHitForDate(d) });
  }
  return strip;
}

function streakCount(date) {
  let count = 0;
  let d = date;
  for (let i = 0; i < 3650; i++) {
    if (proteinHitForDate(d) || trainingLoggedForDate(d)) {
      count += 1;
      d = addDays(d, -1);
    } else {
      break;
    }
  }
  return count;
}

function buildFeedback(totals, targets) {
  const proteinGap = Math.round(targets.protein - totals.protein);
  const kcalOver = Math.round(totals.kcal - targets.kcal);

  if (kcalOver > 0 && proteinGap > 15) {
    return `You're already ${kcalOver} kcal over target and still ${proteinGap}g short on protein. Skip extra food — if you do eat, make it lean protein (e.g. white fish or a protein shake) rather than anything else.`;
  }
  if (kcalOver > 0) {
    return `You're ${kcalOver} kcal over target for today — no more food needed. Protein is on track.`;
  }
  if (proteinGap > 15) {
    const shakes = Math.max(1, Math.ceil(proteinGap / 25));
    const chickenG = Math.round(proteinGap / 0.31);
    return `You're ${proteinGap}g short on protein. Add ${shakes > 1 ? `${shakes} protein shakes` : 'a protein shake'} or about ${chickenG}g chicken breast to close the gap.`;
  }
  if (proteinGap > 0) {
    return `Almost there — just ${proteinGap}g protein short. A couple of eggs or a small scoop of Greek yogurt will close it.`;
  }
  return `Nice work — protein and calorie targets are basically met for today.`;
}

function liftsMap() {
  const rows = db.prepare('SELECT * FROM lifts').all();
  const map = {};
  for (const row of rows) {
    map[row.exercise] = { weight: row.weight, reps: row.reps };
  }
  return map;
}

function buildDashboard(date) {
  const day = getOrCreateDay(date);
  const targets = targetsFor(day.day_type);
  const entries = foodLogFor(date);
  const totals = totalsFor(entries);

  return {
    date,
    dayType: day.day_type,
    targets,
    foodLog: entries.map((e) => ({
      id: e.id,
      text: e.text,
      kcal: e.kcal,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
    })),
    totals,
    feedback: buildFeedback(totals, targets),
    training: JSON.parse(day.training),
    sleep: {
      hours: day.sleep_hours,
      eyeMask: !!day.sleep_eye_mask,
      earPlugs: !!day.sleep_ear_plugs,
      windDown: !!day.sleep_wind_down,
    },
    supplements: {
      creatine: !!day.supp_creatine,
      proteinPowder: !!day.supp_protein,
      vitaminD: !!day.supp_vitamin_d,
      omega3: !!day.supp_omega3,
    },
    note: day.note,
    lifts: liftsMap(),
    streakStrip: streakStrip(date),
    streakCount: streakCount(date),
  };
}

module.exports = {
  DAY_TARGETS,
  LIFT_EXERCISES,
  todayStr,
  getOrCreateDay,
  buildDashboard,
};
