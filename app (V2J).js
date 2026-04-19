import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  enableIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'PASTE_YOUR_FIREBASE_API_KEY',
  authDomain: 'PASTE_YOUR_AUTH_DOMAIN',
  projectId: 'PASTE_YOUR_PROJECT_ID',
  storageBucket: 'PASTE_YOUR_STORAGE_BUCKET',
  messagingSenderId: 'PASTE_YOUR_MESSAGING_SENDER_ID',
  appId: 'PASTE_YOUR_APP_ID'
};

const appState = {
  user: null,
  settings: { theme: 'light' },
  plans: null,
  currentDate: todayISO(),
  currentEntry: null,
  allEntries: [],
  deferredPrompt: null,
};

const contributingFactors = [
  'Fatigue', 'Distraction', 'Avoidance', 'Discouragement', 'Poor planning',
  'Fear', 'Overcommitment', 'Resentment', 'Haste', 'Physical discomfort', 'Unclear priorities', 'Other'
];

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const $ = (id) => document.getElementById(id);
const els = {
  app: $('app'),
  authCard: $('authCard'),
  mainApp: $('mainApp'),
  googleSignInBtn: $('googleSignInBtn'),
  signOutBtn: $('signOutBtn'),
  themeToggle: $('themeToggle'),
  exportBtn: $('exportBtn'),
  installBtn: $('installBtn'),
  welcomeName: $('welcomeName'),
  syncStatus: $('syncStatus'),
  entryDate: $('entryDate'),
  dailyFocus: $('dailyFocus'),
  dailyPersonPrompt: $('dailyPersonPrompt'),
  goalsList: $('goalsList'),
  addGoalBtn: $('addGoalBtn'),
  lockGoalsBtn: $('lockGoalsBtn'),
  goalMeta: $('goalMeta'),
  goalWarnings: $('goalWarnings'),
  linkedPlanSummary: $('linkedPlanSummary'),
  actedWell: $('actedWell'),
  fellShort: $('fellShort'),
  factorChips: $('factorChips'),
  factorNotes: $('factorNotes'),
  doDifferently: $('doDifferently'),
  additionalNotes: $('additionalNotes'),
  exercisePlanGrid: $('exercisePlanGrid'),
  mealBreakfast: $('mealBreakfast'),
  mealLunch: $('mealLunch'),
  mealDinner: $('mealDinner'),
  mealSnacks: $('mealSnacks'),
  recurringGoalsList: $('recurringGoalsList'),
  addRecurringGoalBtn: $('addRecurringGoalBtn'),
  weeklyGoals: $('weeklyGoals'),
  monthlyGoals: $('monthlyGoals'),
  yearlyGoals: $('yearlyGoals'),
  insightsSummary: $('insightsSummary'),
  factorInsightList: $('factorInsightList'),
  exerciseInsightList: $('exerciseInsightList'),
};

let firebaseReady = true;
let appInstance, auth, db;
try {
  appInstance = initializeApp(firebaseConfig);
  auth = getAuth(appInstance);
  db = getFirestore(appInstance);
  enableIndexedDbPersistence(db).catch(() => {});
} catch (err) {
  firebaseReady = false;
  console.warn('Firebase not initialized yet.', err);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function debounce(fn, ms = 600) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function defaultPlans() {
  return {
    exerciseByDay: Object.fromEntries(weekdays.map(day => [day, { title: '', notes: '' }])),
    meals: { breakfast: '', lunch: '', dinner: '', snacks: '' },
    recurringGoals: [],
    longerTerm: { weekly: '', monthly: '', yearly: '' },
    updatedAt: null,
  };
}

function defaultEntry(date) {
  return {
    date,
    dailyFocus: '',
    dailyPersonPrompt: '',
    goalsLocked: false,
    lockTimestamp: null,
    revisionsUsed: 0,
    revisionLog: [],
    goals: [makeGoal(1)],
    evening: {
      actedWell: '',
      fellShort: '',
      factors: [],
      factorNotes: '',
      doDifferently: '',
      additionalNotes: '',
    },
    linkedPlanStatus: {
      exerciseStatus: 'planned',
      mealStatus: 'planned',
      notes: '',
    },
    updatedAt: null,
  };
}

function makeGoal(priority) {
  return {
    id: crypto.randomUUID(),
    priority,
    text: '',
    status: 'not_started',
    importance: priority === 1 ? 'must_do' : 'standard',
    notes: '',
  };
}

function currentWeekday(dateISO) {
  const d = new Date(dateISO + 'T12:00:00');
  return weekdays[(d.getDay() + 6) % 7];
}

function setTheme(theme) {
  appState.settings.theme = theme;
  els.app.classList.toggle('dark', theme === 'dark');
  els.app.classList.toggle('light', theme !== 'dark');
  els.themeToggle.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  localStorage.setItem('journal_theme', theme);
}

function switchTab(target) {
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === target));
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.toggle('active', panel.id === `${target}Tab`));
  if (target === 'insights') renderInsights();
}

function renderFactorChips() {
  els.factorChips.innerHTML = '';
  const factors = appState.currentEntry?.evening?.factors || [];
  contributingFactors.forEach(f => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip ${factors.includes(f) ? 'active' : ''}`;
    btn.textContent = f;
    btn.addEventListener('click', () => {
      const arr = appState.currentEntry.evening.factors;
      if (arr.includes(f)) {
        appState.currentEntry.evening.factors = arr.filter(x => x !== f);
      } else {
        appState.currentEntry.evening.factors = [...arr, f];
      }
      renderFactorChips();
      debouncedSaveEntry();
    });
    els.factorChips.appendChild(btn);
  });
}

function renderGoals() {
  const entry = appState.currentEntry;
  els.goalsList.innerHTML = '';
  const sorted = [...entry.goals].sort((a,b) => a.priority - b.priority);
  sorted.forEach((goal) => {
    const item = document.createElement('div');
    item.className = 'goal-item';
    const lockRestricted = entry.goalsLocked && entry.revisionsUsed >= 2;
    const textEditable = !lockRestricted;
    const selectEditable = !lockRestricted;

    item.innerHTML = `
      <div class="goal-top">
        <label><span>Priority</span><select class="goal-priority"><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option></select></label>
        <label><span>Goal</span><input class="goal-text" type="text" maxlength="180" placeholder="Define one concrete goal" /></label>
        <label><span>Status</span>
          <select class="goal-status">
            <option value="not_started">Not started</option>
            <option value="done">Done</option>
            <option value="partial">Partial</option>
            <option value="deferred">Deferred</option>
            <option value="skipped">Skipped</option>
            <option value="avoided">Avoided</option>
          </select>
        </label>
        <button type="button" class="ghost-btn delete-goal">Delete</button>
      </div>
      <div class="goal-meta">
        <label><span>Weight</span>
          <select class="goal-importance">
            <option value="must_do">Must do</option>
            <option value="standard">Standard</option>
          </select>
        </label>
      </div>
      <label><span>Notes</span><textarea class="goal-notes" rows="2" placeholder="Optional note"></textarea></label>
    `;

    const priorityEl = item.querySelector('.goal-priority');
    const textEl = item.querySelector('.goal-text');
    const statusEl = item.querySelector('.goal-status');
    const importanceEl = item.querySelector('.goal-importance');
    const notesEl = item.querySelector('.goal-notes');
    const delEl = item.querySelector('.delete-goal');

    priorityEl.value = String(goal.priority);
    textEl.value = goal.text;
    statusEl.value = goal.status;
    importanceEl.value = goal.importance;
    notesEl.value = goal.notes || '';

    priorityEl.disabled = !selectEditable;
    textEl.disabled = !textEditable;
    importanceEl.disabled = !selectEditable;
    notesEl.disabled = !textEditable;
    delEl.disabled = !textEditable;

    priorityEl.addEventListener('change', () => updateGoal(goal.id, 'priority', Number(priorityEl.value)));
    textEl.addEventListener('input', () => updateGoal(goal.id, 'text', textEl.value));
    statusEl.addEventListener('change', () => updateGoal(goal.id, 'status', statusEl.value, false));
    importanceEl.addEventListener('change', () => updateGoal(goal.id, 'importance', importanceEl.value));
    notesEl.addEventListener('input', () => updateGoal(goal.id, 'notes', notesEl.value));
    delEl.addEventListener('click', () => deleteGoal(goal.id));

    els.goalsList.appendChild(item);
  });
  renderGoalMeta();
}

function renderGoalMeta() {
  const entry = appState.currentEntry;
  const pills = [];
  pills.push(entry.goalsLocked ? `Locked ${entry.lockTimestamp ? '• ' + new Date(entry.lockTimestamp).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }) : ''}` : 'Not locked');
  pills.push(`Revisions used: ${entry.revisionsUsed}/2`);
  if (entry.revisionLog.length) pills.push(`Change log entries: ${entry.revisionLog.length}`);
  els.goalMeta.innerHTML = pills.map(p => `<span class="meta-pill">${p}</span>`).join('');
}

function renderLinkedPlan() {
  const plans = appState.plans || defaultPlans();
  const weekday = currentWeekday(appState.currentDate);
  const ex = plans.exerciseByDay[weekday] || { title: '', notes: '' };
  const recurring = plans.recurringGoals.filter(g => appliesToday(g.frequency, weekday));
  els.linkedPlanSummary.innerHTML = `
    <div class="linked-block"><strong>${weekday} exercise plan</strong><div>${escapeHtml(ex.title || 'No exercise plan set')}</div><div class="subtle">${escapeHtml(ex.notes || '')}</div></div>
    <div class="linked-block"><strong>Meal plan</strong><div><strong>Breakfast:</strong> ${escapeHtml(plans.meals.breakfast || '—')}</div><div><strong>Lunch:</strong> ${escapeHtml(plans.meals.lunch || '—')}</div><div><strong>Dinner:</strong> ${escapeHtml(plans.meals.dinner || '—')}</div><div><strong>Notes:</strong> ${escapeHtml(plans.meals.snacks || '—')}</div></div>
    <div class="linked-block"><strong>Recurring goals for today</strong><div>${recurring.length ? recurring.map(g => escapeHtml(g.title)).join('<br>') : 'No recurring goals scheduled for today'}</div></div>
  `;
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function appliesToday(freq, weekday) {
  if (freq === 'daily') return true;
  if (freq === 'weekly') return weekday === 'Sunday';
  return freq === weekday;
}

function updateGoal(goalId, field, value, countsAsRevision = true) {
  const entry = appState.currentEntry;
  const goal = entry.goals.find(g => g.id === goalId);
  if (!goal) return;
  const lockedAndFrozen = entry.goalsLocked && entry.revisionsUsed >= 2;
  if (lockedAndFrozen && ['priority', 'text', 'importance', 'notes'].includes(field)) {
    showGoalWarning('Your goals are now frozen for today. Completion status can still be updated, but the goal content can no longer be changed.');
    renderGoals();
    return;
  }
  const oldValue = goal[field];
  goal[field] = value;
  if (countsAsRevision && entry.goalsLocked && oldValue !== value && ['priority', 'text', 'importance', 'notes'].includes(field)) {
    consumeRevision(`Changed goal field: ${field}`);
  }
  normalizeGoalPriorities();
  renderGoals();
  debouncedSaveEntry();
}

function consumeRevision(reason) {
  const entry = appState.currentEntry;
  if (entry.revisionsUsed < 2) {
    entry.revisionsUsed += 1;
    entry.revisionLog.push({ timestamp: new Date().toISOString(), reason });
  }
}

function normalizeGoalPriorities() {
  const used = new Set();
  appState.currentEntry.goals.forEach(goal => {
    while (used.has(goal.priority) || goal.priority < 1 || goal.priority > 5) {
      goal.priority = Math.min(5, goal.priority + 1);
    }
    used.add(goal.priority);
  });
  appState.currentEntry.goals.sort((a,b) => a.priority - b.priority);
  appState.currentEntry.goals.forEach((goal, idx) => {
    goal.priority = idx + 1;
  });
}

function addGoal() {
  const entry = appState.currentEntry;
  if (entry.goals.length >= 5) return showGoalWarning('You can have up to 5 daily goals.');
  if (entry.goalsLocked && entry.revisionsUsed >= 2) return showGoalWarning('Your goals are frozen for today.');
  entry.goals.push(makeGoal(entry.goals.length + 1));
  if (entry.goalsLocked) consumeRevision('Added a goal');
  normalizeGoalPriorities();
  renderGoals();
  debouncedSaveEntry();
}

function deleteGoal(goalId) {
  const entry = appState.currentEntry;
  if (entry.goals.length <= 1) return showGoalWarning('Keep at least one goal slot so the day remains intentional.');
  if (entry.goalsLocked && entry.revisionsUsed >= 2) return showGoalWarning('Your goals are frozen for today.');
  entry.goals = entry.goals.filter(g => g.id !== goalId);
  if (entry.goalsLocked) consumeRevision('Deleted a goal');
  normalizeGoalPriorities();
  renderGoals();
  debouncedSaveEntry();
}

function showGoalWarning(msg) {
  els.goalWarnings.textContent = msg;
  els.goalWarnings.classList.remove('hidden');
  setTimeout(() => els.goalWarnings.classList.add('hidden'), 3000);
}

function lockGoals() {
  const entry = appState.currentEntry;
  if (entry.goalsLocked) {
    showGoalWarning('Goals are already locked. You may still make up to two revisions before they freeze.');
    return;
  }
  entry.goalsLocked = true;
  entry.lockTimestamp = new Date().toISOString();
  entry.revisionLog.push({ timestamp: entry.lockTimestamp, reason: 'Locked goals for the day' });
  renderGoals();
  debouncedSaveEntry();
}

function renderPlans() {
  const plans = appState.plans || defaultPlans();
  els.exercisePlanGrid.innerHTML = '';
  weekdays.forEach(day => {
    const data = plans.exerciseByDay[day] || { title: '', notes: '' };
    const wrap = document.createElement('div');
    wrap.className = 'plan-day';
    wrap.innerHTML = `
      <h4>${day}</h4>
      <label><span>Plan</span><input type="text" data-day-title="${day}" maxlength="160" value="${escapeHtml(data.title)}" /></label>
      <label><span>Notes</span><textarea data-day-notes="${day}" rows="2">${escapeHtml(data.notes)}</textarea></label>
    `;
    els.exercisePlanGrid.appendChild(wrap);
  });
  document.querySelectorAll('[data-day-title]').forEach(input => input.addEventListener('input', e => {
    const day = e.target.dataset.dayTitle;
    appState.plans.exerciseByDay[day].title = e.target.value;
    debouncedSavePlans();
    renderLinkedPlan();
  }));
  document.querySelectorAll('[data-day-notes]').forEach(input => input.addEventListener('input', e => {
    const day = e.target.dataset.dayNotes;
    appState.plans.exerciseByDay[day].notes = e.target.value;
    debouncedSavePlans();
    renderLinkedPlan();
  }));

  els.mealBreakfast.value = plans.meals.breakfast || '';
  els.mealLunch.value = plans.meals.lunch || '';
  els.mealDinner.value = plans.meals.dinner || '';
  els.mealSnacks.value = plans.meals.snacks || '';
  els.weeklyGoals.value = plans.longerTerm.weekly || '';
  els.monthlyGoals.value = plans.longerTerm.monthly || '';
  els.yearlyGoals.value = plans.longerTerm.yearly || '';

  renderRecurringGoals();
}

function renderRecurringGoals() {
  els.recurringGoalsList.innerHTML = '';
  appState.plans.recurringGoals.forEach(goal => {
    const div = document.createElement('div');
    div.className = 'recurring-item';
    div.innerHTML = `
      <div class="recurring-top">
        <label><span>Goal</span><input type="text" data-rtitle="${goal.id}" maxlength="160" value="${escapeHtml(goal.title)}" /></label>
        <label><span>Category</span><input type="text" data-rcat="${goal.id}" maxlength="60" value="${escapeHtml(goal.category || '')}" /></label>
        <label><span>Frequency</span>
          <select data-rfreq="${goal.id}">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            ${weekdays.map(d => `<option value="${d}">${d}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="ghost-btn" data-rdelete="${goal.id}">Delete</button>
      </div>
    `;
    els.recurringGoalsList.appendChild(div);
    div.querySelector(`[data-rfreq="${goal.id}"]`).value = goal.frequency;
  });
  document.querySelectorAll('[data-rtitle]').forEach(el => el.addEventListener('input', e => updateRecurring(e.target.dataset.rtitle, 'title', e.target.value)));
  document.querySelectorAll('[data-rcat]').forEach(el => el.addEventListener('input', e => updateRecurring(e.target.dataset.rcat, 'category', e.target.value)));
  document.querySelectorAll('[data-rfreq]').forEach(el => el.addEventListener('change', e => updateRecurring(e.target.dataset.rfreq, 'frequency', e.target.value)));
  document.querySelectorAll('[data-rdelete]').forEach(el => el.addEventListener('click', e => deleteRecurring(e.target.dataset.rdelete)));
}

function updateRecurring(id, field, value) {
  const item = appState.plans.recurringGoals.find(g => g.id === id);
  if (!item) return;
  item[field] = value;
  debouncedSavePlans();
  renderLinkedPlan();
}

function deleteRecurring(id) {
  appState.plans.recurringGoals = appState.plans.recurringGoals.filter(g => g.id !== id);
  renderRecurringGoals();
  debouncedSavePlans();
  renderLinkedPlan();
}

function addRecurringGoal() {
  appState.plans.recurringGoals.push({ id: crypto.randomUUID(), title: '', category: '', frequency: 'daily' });
  renderRecurringGoals();
  debouncedSavePlans();
}

function populateTodayForm() {
  const e = appState.currentEntry;
  els.entryDate.value = e.date;
  els.dailyFocus.value = e.dailyFocus || '';
  els.dailyPersonPrompt.value = e.dailyPersonPrompt || '';
  els.actedWell.value = e.evening.actedWell || '';
  els.fellShort.value = e.evening.fellShort || '';
  els.factorNotes.value = e.evening.factorNotes || '';
  els.doDifferently.value = e.evening.doDifferently || '';
  els.additionalNotes.value = e.evening.additionalNotes || '';
  renderGoals();
  renderFactorChips();
  renderLinkedPlan();
}

function attachFieldListeners() {
  els.dailyFocus.addEventListener('input', () => { appState.currentEntry.dailyFocus = els.dailyFocus.value; debouncedSaveEntry(); });
  els.dailyPersonPrompt.addEventListener('input', () => { appState.currentEntry.dailyPersonPrompt = els.dailyPersonPrompt.value; debouncedSaveEntry(); });
  els.actedWell.addEventListener('input', () => { appState.currentEntry.evening.actedWell = els.actedWell.value; debouncedSaveEntry(); });
  els.fellShort.addEventListener('input', () => { appState.currentEntry.evening.fellShort = els.fellShort.value; debouncedSaveEntry(); });
  els.factorNotes.addEventListener('input', () => { appState.currentEntry.evening.factorNotes = els.factorNotes.value; debouncedSaveEntry(); });
  els.doDifferently.addEventListener('input', () => { appState.currentEntry.evening.doDifferently = els.doDifferently.value; debouncedSaveEntry(); });
  els.additionalNotes.addEventListener('input', () => { appState.currentEntry.evening.additionalNotes = els.additionalNotes.value; debouncedSaveEntry(); });
  els.entryDate.addEventListener('change', async () => {
    appState.currentDate = els.entryDate.value;
    await loadEntry(appState.currentDate);
    populateTodayForm();
  });
  els.addGoalBtn.addEventListener('click', addGoal);
  els.lockGoalsBtn.addEventListener('click', lockGoals);
  els.addRecurringGoalBtn.addEventListener('click', addRecurringGoal);
  ['mealBreakfast','mealLunch','mealDinner','mealSnacks'].forEach(key => {
    els[key].addEventListener('input', () => {
      const map = { mealBreakfast:'breakfast', mealLunch:'lunch', mealDinner:'dinner', mealSnacks:'snacks' };
      appState.plans.meals[map[key]] = els[key].value;
      debouncedSavePlans();
      renderLinkedPlan();
    });
  });
  ['weeklyGoals','monthlyGoals','yearlyGoals'].forEach(key => {
    els[key].addEventListener('input', () => {
      const map = { weeklyGoals:'weekly', monthlyGoals:'monthly', yearlyGoals:'yearly' };
      appState.plans.longerTerm[map[key]] = els[key].value;
      debouncedSavePlans();
    });
  });
}

async function loadPlans() {
  const ref = doc(db, 'users', appState.user.uid, 'meta', 'plans');
  const snap = await getDoc(ref);
  appState.plans = snap.exists() ? { ...defaultPlans(), ...snap.data() } : defaultPlans();
  renderPlans();
  renderLinkedPlan();
}

async function savePlans() {
  if (!appState.user) return;
  appState.plans.updatedAt = serverTimestamp();
  const ref = doc(db, 'users', appState.user.uid, 'meta', 'plans');
  await setDoc(ref, appState.plans, { merge: true });
  els.syncStatus.textContent = 'Plans synced';
}

async function loadEntry(date) {
  const ref = doc(db, 'users', appState.user.uid, 'entries', date);
  const snap = await getDoc(ref);
  appState.currentEntry = snap.exists() ? { ...defaultEntry(date), ...snap.data() } : defaultEntry(date);
}

async function saveEntry() {
  if (!appState.user) return;
  appState.currentEntry.updatedAt = serverTimestamp();
  const ref = doc(db, 'users', appState.user.uid, 'entries', appState.currentDate);
  await setDoc(ref, appState.currentEntry, { merge: true });
  els.syncStatus.textContent = `Saved ${new Date().toLocaleTimeString([], { hour:'numeric', minute:'2-digit' })}`;
}

async function loadEntriesForInsights() {
  const snapshot = await getDocs(collection(db, 'users', appState.user.uid, 'entries'));
  appState.allEntries = snapshot.docs.map(d => d.data()).filter(Boolean);
}

function renderInsights() {
  const entries = appState.allEntries || [];
  const totalDays = entries.length;
  const topGoalDoneDays = entries.filter(e => (e.goals || []).some(g => g.priority === 1 && g.status === 'done')).length;
  const avgGoalsDone = totalDays ? (entries.reduce((acc, e) => acc + (e.goals || []).filter(g => g.status === 'done').length, 0) / totalDays).toFixed(1) : '0.0';
  const lockedDays = entries.filter(e => e.goalsLocked).length;
  els.insightsSummary.innerHTML = `
    <div class="stat-card"><div class="subtle">Days logged</div><div class="stat-value">${totalDays}</div></div>
    <div class="stat-card"><div class="subtle">Top priority completed</div><div class="stat-value">${totalDays ? Math.round((topGoalDoneDays/totalDays)*100) : 0}%</div></div>
    <div class="stat-card"><div class="subtle">Avg goals done</div><div class="stat-value">${avgGoalsDone}</div></div>
    <div class="stat-card"><div class="subtle">Days with locked goals</div><div class="stat-value">${lockedDays}</div></div>
  `;

  const factorCounts = {};
  entries.forEach(e => (e.evening?.factors || []).forEach(f => factorCounts[f] = (factorCounts[f] || 0) + 1));
  const factorItems = Object.entries(factorCounts).sort((a,b) => b[1]-a[1]);
  els.factorInsightList.innerHTML = factorItems.length
    ? factorItems.map(([label, count]) => `<div class="stats-item"><span>${escapeHtml(label)}</span><strong>${count}</strong></div>`).join('')
    : '<div class="subtle">No factor trends yet.</div>';

  const exByDay = Object.fromEntries(weekdays.map(d => [d, { total: 0, completed: 0 }]));
  entries.forEach(e => {
    const day = currentWeekday(e.date);
    exByDay[day].total += 1;
    if ((e.goals || []).some(g => /exercise|walk|yoga|cardio|strength|stairmaster/i.test(g.text) && ['done','partial'].includes(g.status))) {
      exByDay[day].completed += 1;
    }
  });
  els.exerciseInsightList.innerHTML = weekdays.map(day => {
    const info = exByDay[day];
    const pct = info.total ? Math.round((info.completed / info.total) * 100) : 0;
    return `<div class="stats-item"><span>${day}</span><strong>${pct}%</strong></div>`;
  }).join('');
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    plans: appState.plans,
    currentEntry: appState.currentEntry,
    allEntries: appState.allEntries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `daily-formation-journal-export-${todayISO()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const debouncedSaveEntry = debounce(() => saveEntry().catch(err => els.syncStatus.textContent = `Save failed: ${err.message}`), 700);
const debouncedSavePlans = debounce(() => savePlans().catch(err => els.syncStatus.textContent = `Plan save failed: ${err.message}`), 700);

async function startAuthedApp(user) {
  appState.user = user;
  els.authCard.classList.add('hidden');
  els.mainApp.classList.remove('hidden');
  els.welcomeName.textContent = `Welcome, ${user.displayName?.split(' ')[0] || 'friend'}`;
  els.syncStatus.textContent = 'Loading your journal...';
  await loadPlans();
  await loadEntry(appState.currentDate);
  await loadEntriesForInsights();
  populateTodayForm();
  els.syncStatus.textContent = 'Synced';
}

function showSignedOut() {
  appState.user = null;
  els.mainApp.classList.add('hidden');
  els.authCard.classList.remove('hidden');
}

async function initAuth() {
  if (!firebaseReady) return;
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  els.googleSignInBtn.addEventListener('click', async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      alert(`Sign-in failed: ${err.message}`);
    }
  });
  els.signOutBtn.addEventListener('click', () => signOut(auth));
  onAuthStateChanged(auth, async (user) => {
    if (user) await startAuthedApp(user);
    else showSignedOut();
  });
}

function setupPWA() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    appState.deferredPrompt = e;
    els.installBtn.classList.remove('hidden');
  });
  els.installBtn.addEventListener('click', async () => {
    if (!appState.deferredPrompt) return;
    appState.deferredPrompt.prompt();
    await appState.deferredPrompt.userChoice;
    appState.deferredPrompt = null;
    els.installBtn.classList.add('hidden');
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

function init() {
  setTheme(localStorage.getItem('journal_theme') || 'light');
  els.themeToggle.addEventListener('click', () => setTheme(appState.settings.theme === 'light' ? 'dark' : 'light'));
  document.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  els.exportBtn.addEventListener('click', exportData);
  attachFieldListeners();
  renderFactorChips();
  if (firebaseReady) initAuth();
  else {
    els.googleSignInBtn.disabled = true;
    els.googleSignInBtn.textContent = 'Add Firebase config first';
  }
  setupPWA();
}

init();
