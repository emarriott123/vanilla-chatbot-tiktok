(function () {
  const TRAINING_ITEMS = [
    { title: 'Upper (push)', detail: 'Bench press, overhead press, incline dumbbell press, triceps' },
    { title: 'Lower', detail: 'Squat, Romanian deadlift / leg press, calves' },
    { title: 'Rest / active recovery', detail: '' },
    { title: 'Upper (pull)', detail: 'Rows, pull-ups, rear delts, biceps' },
    { title: 'Lower / full body', detail: 'Squat variation, lunges, core' },
  ];

  const SUPPLEMENT_ITEMS = [
    { key: 'creatine', title: 'Creatine', detail: '3–5g' },
    { key: 'proteinPowder', title: 'Protein powder', detail: '' },
    { key: 'vitaminD', title: 'Vitamin D', detail: '' },
    { key: 'omega3', title: 'Omega-3', detail: '' },
  ];

  const LIFT_ITEMS = [
    { key: 'bench_press', title: 'Bench Press' },
    { key: 'squat', title: 'Squat' },
    { key: 'overhead_press', title: 'Overhead Press' },
    { key: 'row_pullup', title: 'Row / Pull-up' },
  ];

  const DAY_LABELS = { normal: 'Normal day', shift: '12-hour Shift day' };

  const FAVORITES_KEY = 'healthBoard.favorites';
  const FAVORITES_SEEDED_KEY = 'healthBoard.favoritesSeeded';

  // Pre-loaded quick-tap meals. Seeded into localStorage once, on first load
  // only — after that, users manage the list themselves (add/edit/delete),
  // and a deleted default never comes back.
  const DEFAULT_FAVORITES = [
    { text: '4 eggs scrambled + toast + kiwi', kcal: 460, protein: 30, carbs: 45, fat: 18 },
    { text: 'Chicken breast + rice + veg', kcal: 560, protein: 50, carbs: 55, fat: 14 },
    { text: 'Greek yogurt + blueberries', kcal: 220, protein: 20, carbs: 20, fat: 6 },
    { text: 'Salmon + potatoes + salad', kcal: 600, protein: 40, carbs: 40, fat: 28 },
    { text: 'Protein shake', kcal: 150, protein: 25, carbs: 8, fat: 2 },
    { text: 'Turkey/beef mince + rice + veg', kcal: 550, protein: 48, carbs: 50, fat: 15 },
    { text: 'Cottage cheese + kiwi', kcal: 230, protein: 25, carbs: 15, fat: 8 },
    { text: 'Steak + potatoes + salad', kcal: 650, protein: 48, carbs: 45, fat: 30 },
    { text: 'Tuna + rice + veg', kcal: 500, protein: 40, carbs: 50, fat: 10 },
    { text: 'Chicken thigh + potatoes + salad', kcal: 600, protein: 45, carbs: 48, fat: 22 },
  ];

  const els = {
    body: document.body,
    boardDate: document.getElementById('board-date'),
    dayToggle: document.getElementById('day-toggle'),
    targetKcal: document.getElementById('target-kcal'),
    targetProtein: document.getElementById('target-protein'),

    foodForm: document.getElementById('food-form'),
    foodInput: document.getElementById('food-input'),
    foodSubmit: document.getElementById('food-submit'),
    foodStatus: document.getElementById('food-status'),
    foodList: document.getElementById('food-list'),

    totalKcal: document.getElementById('total-kcal'),
    totalProtein: document.getElementById('total-protein'),
    totalCarbs: document.getElementById('total-carbs'),
    totalFat: document.getElementById('total-fat'),

    progressProteinText: document.getElementById('progress-protein-text'),
    progressProteinFill: document.getElementById('progress-protein-fill'),
    progressKcalText: document.getElementById('progress-kcal-text'),
    progressKcalFill: document.getElementById('progress-kcal-fill'),
    feedbackBox: document.getElementById('feedback-box'),

    streakCount: document.getElementById('streak-count'),
    streakStrip: document.getElementById('streak-strip'),

    trainingList: document.getElementById('training-list'),
    supplementsList: document.getElementById('supplements-list'),

    sleepHours: document.getElementById('sleep-hours'),
    sleepChips: document.getElementById('sleep-chips'),

    liftTableBody: document.getElementById('lift-table-body'),

    noteInput: document.getElementById('note-input'),

    favoritesRow: document.getElementById('favorites-row'),
    favoriteAddBtn: document.getElementById('favorite-add-btn'),
    favoriteModal: document.getElementById('favorite-modal'),
    favoriteModalTitle: document.getElementById('favorite-modal-title'),
    favoriteForm: document.getElementById('favorite-form'),
    favText: document.getElementById('fav-text'),
    favKcal: document.getElementById('fav-kcal'),
    favProtein: document.getElementById('fav-protein'),
    favCarbs: document.getElementById('fav-carbs'),
    favFat: document.getElementById('fav-fat'),
    favoriteDeleteBtn: document.getElementById('favorite-delete-btn'),
    favoriteCancelBtn: document.getElementById('favorite-cancel-btn'),
  };

  let state = null;
  let noteDebounce = null;
  let favorites = [];
  let editingFavoriteId = null;

  async function api(path, options) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  function fmtDate(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  // ---------- favorites (localStorage) ----------

  function makeId() {
    return 'fav_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function loadFavorites() {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persistFavorites() {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (err) {
      console.warn('Could not save favorites to localStorage', err);
    }
  }

  // Runs once ever, on the very first load. After that FAVORITES_SEEDED_KEY
  // is set, so returning users who deleted a default never see it re-added.
  function seedFavoritesIfNeeded() {
    try {
      if (localStorage.getItem(FAVORITES_SEEDED_KEY)) return;
      const existing = loadFavorites();
      const seeded = DEFAULT_FAVORITES.map((fav) => ({ id: makeId(), ...fav }));
      favorites = existing.concat(seeded);
      persistFavorites();
      localStorage.setItem(FAVORITES_SEEDED_KEY, '1');
    } catch (err) {
      console.warn('Could not seed default favorites', err);
    }
  }

  function renderFavorites() {
    els.favoritesRow.innerHTML = '';
    favorites.forEach((fav) => {
      const chip = document.createElement('div');
      chip.className = 'favorite-chip';
      chip.innerHTML = `
        <button type="button" class="favorite-tap">
          <span class="favorite-name">${escapeHtml(fav.text)}</span>
          <span class="favorite-macro mono">${fav.kcal} kcal · P${fav.protein}</span>
        </button>
        <button type="button" class="favorite-edit" aria-label="Edit ${escapeHtml(fav.text)}">✎</button>
      `;
      chip.querySelector('.favorite-tap').addEventListener('click', () => logFavorite(fav));
      chip.querySelector('.favorite-edit').addEventListener('click', () => openFavoriteModal(fav));
      els.favoritesRow.appendChild(chip);
    });
  }

  async function logFavorite(fav) {
    setFoodStatus(`Logging "${fav.text}"…`, false);
    try {
      state = await api(`/api/dashboard/${state.date}/food`, {
        method: 'POST',
        body: JSON.stringify({
          text: fav.text,
          macros: { kcal: fav.kcal, protein: fav.protein, carbs: fav.carbs, fat: fav.fat },
        }),
      });
      setFoodStatus('', false);
      render();
    } catch (err) {
      setFoodStatus(err.message, true);
    }
  }

  function openFavoriteModal(fav) {
    editingFavoriteId = fav ? fav.id : null;
    els.favoriteModalTitle.textContent = fav ? 'Edit favorite' : 'Add favorite';
    els.favText.value = fav ? fav.text : '';
    els.favKcal.value = fav ? fav.kcal : '';
    els.favProtein.value = fav ? fav.protein : '';
    els.favCarbs.value = fav ? fav.carbs : '';
    els.favFat.value = fav ? fav.fat : '';
    els.favoriteDeleteBtn.hidden = !fav;
    els.favoriteModal.hidden = false;
    els.favText.focus();
  }

  function closeFavoriteModal() {
    els.favoriteModal.hidden = true;
    editingFavoriteId = null;
    els.favoriteForm.reset();
  }

  function saveFavoriteFromForm() {
    const text = els.favText.value.trim();
    if (!text) return;

    const clampInt = (v) => Math.max(0, Math.round(Number(v) || 0));
    const entry = {
      id: editingFavoriteId || makeId(),
      text,
      kcal: clampInt(els.favKcal.value),
      protein: clampInt(els.favProtein.value),
      carbs: clampInt(els.favCarbs.value),
      fat: clampInt(els.favFat.value),
    };

    if (editingFavoriteId) {
      favorites = favorites.map((f) => (f.id === editingFavoriteId ? entry : f));
    } else {
      favorites = favorites.concat(entry);
    }
    persistFavorites();
    renderFavorites();
    closeFavoriteModal();
  }

  function deleteEditingFavorite() {
    if (!editingFavoriteId) return;
    favorites = favorites.filter((f) => f.id !== editingFavoriteId);
    persistFavorites();
    renderFavorites();
    closeFavoriteModal();
  }

  function render() {
    if (!state) return;

    els.body.setAttribute('data-day-type', state.dayType);
    els.boardDate.textContent = fmtDate(state.date);
    els.targetKcal.textContent = state.targets.kcal;
    els.targetProtein.textContent = `${state.targets.protein}g`;

    els.dayToggle.querySelectorAll('.day-toggle-btn').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.dayType === state.dayType);
    });

    renderFoodLog();
    renderTotals();
    renderTraining();
    renderSleep();
    renderSupplements();
    renderLifts();
    renderStreak();

    if (document.activeElement !== els.noteInput) {
      els.noteInput.value = state.note || '';
    }
  }

  function renderFoodLog() {
    els.foodList.innerHTML = '';
    if (!state.foodLog.length) {
      const li = document.createElement('li');
      li.className = 'food-empty';
      li.textContent = 'Nothing logged yet today.';
      els.foodList.appendChild(li);
      return;
    }
    for (const entry of state.foodLog) {
      const li = document.createElement('li');
      li.className = 'food-item';
      li.innerHTML = `
        <span class="food-item-text">${escapeHtml(entry.text)}</span>
        <span class="food-item-macros mono">${entry.kcal} kcal · P${entry.protein} C${entry.carbs} F${entry.fat}</span>
        <button class="food-item-delete" type="button" aria-label="Delete entry" data-id="${entry.id}">×</button>
      `;
      li.querySelector('.food-item-delete').addEventListener('click', () => deleteFood(entry.id));
      els.foodList.appendChild(li);
    }
  }

  function renderTotals() {
    const { totals, targets } = state;
    els.totalKcal.textContent = Math.round(totals.kcal);
    els.totalProtein.textContent = `${Math.round(totals.protein)}g`;
    els.totalCarbs.textContent = `${Math.round(totals.carbs)}g`;
    els.totalFat.textContent = `${Math.round(totals.fat)}g`;

    const proteinPct = clampPct((totals.protein / targets.protein) * 100);
    els.progressProteinText.textContent = `${Math.round(totals.protein)} / ${targets.protein} g`;
    els.progressProteinFill.style.width = `${proteinPct}%`;
    els.progressProteinFill.classList.toggle('is-over', totals.protein > targets.protein * 1.15);

    const kcalPct = clampPct((totals.kcal / targets.kcal) * 100);
    els.progressKcalText.textContent = `${Math.round(totals.kcal)} / ${targets.kcal}`;
    els.progressKcalFill.style.width = `${kcalPct}%`;
    els.progressKcalFill.classList.toggle('is-over', totals.kcal > targets.kcal);

    els.feedbackBox.textContent = state.feedback;
  }

  function clampPct(n) {
    return Math.max(0, Math.min(100, n));
  }

  function renderTraining() {
    els.trainingList.innerHTML = '';
    TRAINING_ITEMS.forEach((item, i) => {
      const checked = !!state.training[i];
      const li = document.createElement('li');
      li.className = 'checklist-item' + (checked ? ' is-checked' : '');
      li.innerHTML = `
        <input type="checkbox" ${checked ? 'checked' : ''} id="training-${i}" />
        <label class="checklist-item-text" for="training-${i}">
          <span class="item-title">${escapeHtml(item.title)}</span>
          ${item.detail ? `<span class="item-detail">${escapeHtml(item.detail)}</span>` : ''}
        </label>
      `;
      const checkbox = li.querySelector('input');
      checkbox.addEventListener('change', () => toggleTraining(i, checkbox.checked));
      els.trainingList.appendChild(li);
    });
  }

  function renderSupplements() {
    els.supplementsList.innerHTML = '';
    SUPPLEMENT_ITEMS.forEach((item) => {
      const checked = !!state.supplements[item.key];
      const li = document.createElement('li');
      li.className = 'checklist-item' + (checked ? ' is-checked' : '');
      li.innerHTML = `
        <input type="checkbox" ${checked ? 'checked' : ''} id="supp-${item.key}" />
        <label class="checklist-item-text" for="supp-${item.key}">
          <span class="item-title">${escapeHtml(item.title)}</span>
          ${item.detail ? `<span class="item-detail">${escapeHtml(item.detail)}</span>` : ''}
        </label>
      `;
      const checkbox = li.querySelector('input');
      checkbox.addEventListener('change', () => toggleSupplement(item.key, checkbox.checked));
      els.supplementsList.appendChild(li);
    });
  }

  function renderSleep() {
    if (document.activeElement !== els.sleepHours) {
      els.sleepHours.value = state.sleep.hours ?? '';
    }
    els.sleepChips.querySelectorAll('.chip').forEach((chip) => {
      const key = chip.dataset.key;
      chip.classList.toggle('is-active', !!state.sleep[key]);
    });
  }

  function renderLifts() {
    els.liftTableBody.innerHTML = '';
    LIFT_ITEMS.forEach((item) => {
      const lift = state.lifts[item.key] || { weight: 0, reps: 0 };
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.title)}</td>
        <td><input type="number" class="mono lift-weight" min="0" step="0.5" value="${lift.weight}" /> kg</td>
        <td><input type="number" class="mono lift-reps" min="0" step="1" value="${lift.reps}" /></td>
      `;
      const weightInput = tr.querySelector('.lift-weight');
      const repsInput = tr.querySelector('.lift-reps');
      const commit = () => updateLift(item.key, weightInput.value, repsInput.value);
      weightInput.addEventListener('change', commit);
      repsInput.addEventListener('change', commit);
      els.liftTableBody.appendChild(tr);
    });
  }

  function renderStreak() {
    els.streakCount.textContent = state.streakCount;
    els.streakStrip.innerHTML = '';
    state.streakStrip.forEach((day) => {
      const div = document.createElement('div');
      div.className = 'streak-day' + (day.hit ? ' is-hit' : '');
      const d = new Date(`${day.date}T00:00:00`);
      div.textContent = d.toLocaleDateString(undefined, { weekday: 'narrow' });
      div.title = day.date;
      els.streakStrip.appendChild(div);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- actions ----------

  async function loadDashboard() {
    state = await api('/api/dashboard');
    render();
  }

  async function setDayType(dayType) {
    if (!state || state.dayType === dayType) return;
    state.dayType = dayType;
    render(); // optimistic — instant accent swap
    state = await api(`/api/dashboard/${state.date}`, {
      method: 'PUT',
      body: JSON.stringify({ dayType }),
    });
    render();
  }

  async function submitFood(text) {
    setFoodStatus('Estimating macros…', false);
    els.foodSubmit.disabled = true;
    try {
      state = await api(`/api/dashboard/${state.date}/food`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      setFoodStatus('', false);
      els.foodInput.value = '';
      render();
    } catch (err) {
      setFoodStatus(err.message, true);
    } finally {
      els.foodSubmit.disabled = false;
    }
  }

  function setFoodStatus(msg, isError) {
    els.foodStatus.hidden = !msg;
    els.foodStatus.textContent = msg;
    els.foodStatus.classList.toggle('is-error', !!isError);
  }

  async function deleteFood(id) {
    state = await api(`/api/food/${id}`, { method: 'DELETE' });
    render();
  }

  async function toggleTraining(index, checked) {
    const training = state.training.slice();
    training[index] = checked;
    state.training = training;
    render();
    state = await api(`/api/dashboard/${state.date}`, {
      method: 'PUT',
      body: JSON.stringify({ training }),
    });
    render();
  }

  async function toggleSupplement(key, checked) {
    state.supplements = { ...state.supplements, [key]: checked };
    render();
    state = await api(`/api/dashboard/${state.date}`, {
      method: 'PUT',
      body: JSON.stringify({ supplements: { [key]: checked } }),
    });
    render();
  }

  async function updateSleepHours(value) {
    const hours = value === '' ? null : Number(value);
    state = await api(`/api/dashboard/${state.date}`, {
      method: 'PUT',
      body: JSON.stringify({ sleep: { hours } }),
    });
    render();
  }

  async function toggleSleepChip(key) {
    const next = !state.sleep[key];
    state.sleep = { ...state.sleep, [key]: next };
    render();
    state = await api(`/api/dashboard/${state.date}`, {
      method: 'PUT',
      body: JSON.stringify({ sleep: { [key]: next } }),
    });
    render();
  }

  async function updateLift(exercise, weight, reps) {
    state = await api(`/api/lifts/${exercise}?date=${state.date}`, {
      method: 'PUT',
      body: JSON.stringify({ weight: Number(weight) || 0, reps: Number(reps) || 0 }),
    });
    render();
  }

  function scheduleNoteSave(value) {
    clearTimeout(noteDebounce);
    noteDebounce = setTimeout(async () => {
      state = await api(`/api/dashboard/${state.date}`, {
        method: 'PUT',
        body: JSON.stringify({ note: value }),
      });
      // don't re-render — keep focus/cursor in textarea untouched
      state.note = value;
    }, 500);
  }

  // ---------- wiring ----------

  els.dayToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.day-toggle-btn');
    if (btn) setDayType(btn.dataset.dayType);
  });

  els.foodForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = els.foodInput.value.trim();
    if (text) submitFood(text);
  });

  els.sleepHours.addEventListener('change', (e) => updateSleepHours(e.target.value));

  els.sleepChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) toggleSleepChip(chip.dataset.key);
  });

  els.noteInput.addEventListener('input', (e) => scheduleNoteSave(e.target.value));

  els.favoriteAddBtn.addEventListener('click', () => openFavoriteModal(null));
  els.favoriteCancelBtn.addEventListener('click', closeFavoriteModal);
  els.favoriteDeleteBtn.addEventListener('click', deleteEditingFavorite);
  els.favoriteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveFavoriteFromForm();
  });
  els.favoriteModal.addEventListener('click', (e) => {
    if (e.target === els.favoriteModal) closeFavoriteModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.favoriteModal.hidden) closeFavoriteModal();
  });

  // Favorites live in localStorage, independent of the day's dashboard data —
  // seed/load/render them regardless of whether the API call below succeeds.
  seedFavoritesIfNeeded();
  favorites = loadFavorites();
  renderFavorites();

  loadDashboard().catch((err) => {
    console.error(err);
    els.boardDate.textContent = 'Failed to load — is the server running?';
  });
})();
