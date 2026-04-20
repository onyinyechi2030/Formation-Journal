import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBxmdiWs7zpTOOVWtK3fO_uegdrmeFe0jM",
  authDomain: "formation-journal.firebaseapp.com",
  projectId: "formation-journal",
  storageBucket: "formation-journal.firebasestorage.app",
  messagingSenderId: "743059302414",
  appId: "1:743059302414:web:ae4d9ac990c30a2583b45f",
  measurementId: "G-WHC00G16K3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const FACTORS = [
  "Fatigue",
  "Distraction",
  "Poor planning",
  "Avoidance",
  "Discouragement",
  "Fear",
  "Overcommitment",
  "Haste",
  "Resentment",
  "Physical discomfort",
  "Unclear priorities"
];

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

const appEl = document.getElementById("app");
const authCard = document.getElementById("authCard");
const mainApp = document.getElementById("mainApp");
const googleSignInBtn = document.getElementById("googleSignInBtn");
const themeToggle = document.getElementById("themeToggle");
const installBtn = document.getElementById("installBtn");
const welcomeName = document.getElementById("welcomeName");
const syncStatus = document.getElementById("syncStatus");
const signOutBtn = document.getElementById("signOutBtn");
const exportBtn = document.getElementById("exportBtn");

const entryDate = document.getElementById("entryDate");
const dailyFocus = document.getElementById("dailyFocus");
const dailyPersonPrompt = document.getElementById("dailyPersonPrompt");
const addGoalBtn = document.getElementById("addGoalBtn");
const lockGoalsBtn = document.getElementById("lockGoalsBtn");
const goalMeta = document.getElementById("goalMeta");
const goalsList = document.getElementById("goalsList");
const goalWarnings = document.getElementById("goalWarnings");
const linkedPlanSummary = document.getElementById("linkedPlanSummary");

const actedWell = document.getElementById("actedWell");
const fellShort = document.getElementById("fellShort");
const factorChips = document.getElementById("factorChips");
const factorNotes = document.getElementById("factorNotes");
const doDifferently = document.getElementById("doDifferently");
const additionalNotes = document.getElementById("additionalNotes");

const exercisePlanGrid = document.getElementById("exercisePlanGrid");
const mealBreakfast = document.getElementById("mealBreakfast");
const mealLunch = document.getElementById("mealLunch");
const mealDinner = document.getElementById("mealDinner");
const mealSnacks = document.getElementById("mealSnacks");
const addRecurringGoalBtn = document.getElementById("addRecurringGoalBtn");
const recurringGoalsList = document.getElementById("recurringGoalsList");
const weeklyGoals = document.getElementById("weeklyGoals");
const monthlyGoals = document.getElementById("monthlyGoals");
const yearlyGoals = document.getElementById("yearlyGoals");

const insightsSummary = document.getElementById("insightsSummary");
const factorInsightList = document.getElementById("factorInsightList");
const exerciseInsightList = document.getElementById("exerciseInsightList");

let deferredPrompt = null;
let currentUser = null;
let saveTimer = null;
let state = {
  theme: localStorage.getItem("formation-theme") || "light",
  profile: createEmptyProfile(),
  entries: {},
  activeDate: todayString()
};

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyProfile() {
  return {
    exercisePlan: {
      Monday: "",
      Tuesday: "",
      Wednesday: "",
      Thursday: "",
      Friday: "",
      Saturday: "",
      Sunday: ""
    },
    mealPlan: {
      breakfast: "",
      lunch: "",
      dinner: "",
      snacks: ""
    },
    recurringGoals: [],
    longerGoals: {
      weekly: "",
      monthly: "",
      yearly: ""
    }
  };
}

function createEmptyEntry(dateStr) {
  return {
    date: dateStr,
    focus: "",
    personPrompt: "",
    goals: [],
    locked: false,
    lockedAt: null,
    revisionCount: 0,
    revisionLog: [],
    reflection: {
      actedWell: "",
      fellShort: "",
      factors: [],
      factorNotes: "",
      doDifferently: "",
      additionalNotes: ""
    }
  };
}

function getEntry(dateStr = state.activeDate) {
  if (!state.entries[dateStr]) {
    state.entries[dateStr] = createEmptyEntry(dateStr);
  }
  return state.entries[dateStr];
}

function showNotice(message) {
  if (!goalWarnings) return;
  if (!message) {
    goalWarnings.textContent = "";
    goalWarnings.classList.add("hidden");
    return;
  }
  goalWarnings.textContent = message;
  goalWarnings.classList.remove("hidden");
}

function setTheme(theme) {
  state.theme = theme === "dark" ? "dark" : "light";
  localStorage.setItem("formation-theme", state.theme);
  appEl.classList.remove("light", "dark");
  appEl.classList.add(state.theme);
  if (themeToggle) {
    themeToggle.textContent = state.theme === "dark" ? "Light mode" : "Dark mode";
  }
}

function weekdayFromDate(dateStr) {
  const date = new Date(`${dateStr}T12:00:00`);
  return WEEKDAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function scheduleSave(type = "entry") {
  if (!currentUser) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      syncStatus.textContent = "Saving...";
      if (type === "profile") {
        await saveProfile();
      } else {
        await saveEntry();
      }
      syncStatus.textContent = "Synced";
      renderInsights();
    } catch (error) {
      console.error(error);
      syncStatus.textContent = "Save failed";
    }
  }, 500);
}

async function saveProfile() {
  if (!currentUser) return;
  const profileRef = doc(db, `users/${currentUser.uid}/meta/profile`);
  await setDoc(profileRef, state.profile, { merge: true });
}

async function saveEntry() {
  if (!currentUser) return;
  const entry = getEntry(state.activeDate);
  const entryRef = doc(db, `users/${currentUser.uid}/entries/${state.activeDate}`);
  await setDoc(entryRef, entry, { merge: true });
}

async function loadAllUserData(user) {
  const profileRef = doc(db, `users/${user.uid}/meta/profile`);
  const profileSnap = await getDoc(profileRef);
  state.profile = profileSnap.exists()
    ? { ...createEmptyProfile(), ...profileSnap.data() }
    : createEmptyProfile();

  const entriesSnap = await getDocs(collection(db, `users/${user.uid}/entries`));
  state.entries = {};
  entriesSnap.forEach((snap) => {
    state.entries[snap.id] = { ...createEmptyEntry(snap.id), ...snap.data() };
  });

  getEntry(state.activeDate);
}

function renderAuthState() {
  const signedIn = !!currentUser;
  authCard.classList.toggle("hidden", signedIn);
  mainApp.classList.toggle("hidden", !signedIn);

  if (signedIn) {
    welcomeName.textContent = `Welcome${currentUser.displayName ? `, ${currentUser.displayName.split(" ")[0]}` : ""}`;
    syncStatus.textContent = "Synced";
  }
}

function renderEntry() {
  const entry = getEntry(state.activeDate);
  entryDate.value = state.activeDate;
  dailyFocus.value = entry.focus || "";
  dailyPersonPrompt.value = entry.personPrompt || "";
  actedWell.value = entry.reflection.actedWell || "";
  fellShort.value = entry.reflection.fellShort || "";
  factorNotes.value = entry.reflection.factorNotes || "";
  doDifferently.value = entry.reflection.doDifferently || "";
  additionalNotes.value = entry.reflection.additionalNotes || "";

  renderGoalMeta();
  renderGoals();
  renderFactors();
  renderLinkedPlanSummary();
}

function renderGoalMeta() {
  const entry = getEntry(state.activeDate);
  const pills = [];

  pills.push(`<span class="meta-pill">${entry.goals.length}/5 goals</span>`);
  if (entry.locked) {
    pills.push(`<span class="meta-pill">Locked</span>`);
    pills.push(`<span class="meta-pill">Revisions used: ${entry.revisionCount}/2</span>`);
  } else {
    pills.push(`<span class="meta-pill">Unlocked</span>`);
  }

  goalMeta.innerHTML = pills.join("");
  lockGoalsBtn.textContent = entry.locked ? "Goals locked" : "Lock today’s goals";
  lockGoalsBtn.disabled = entry.locked;
}

function consumeRevisionIfNeeded(goalIndex, fieldName, newValue) {
  const entry = getEntry(state.activeDate);
  const goal = entry.goals[goalIndex];
  const oldValue = goal[fieldName];

  if (!entry.locked) return true;
  if (fieldName === "status") return true;
  if (oldValue === newValue) return true;

  if (entry.revisionCount >= 2) {
    showNotice("You have already used your 2 revisions for today. Goal text and priority are locked.");
    return false;
  }

  entry.revisionCount += 1;
  entry.revisionLog.push({
    at: new Date().toISOString(),
    goalIndex,
    field: fieldName,
    from: oldValue,
    to: newValue
  });
  showNotice(`Revision ${entry.revisionCount} of 2 used.`);
  renderGoalMeta();
  return true;
}

function renderGoals() {
  const entry = getEntry(state.activeDate);

  if (!entry.goals.length) {
    goalsList.innerHTML = `<p class="subtle">No goals yet. Add up to 5 ranked goals.</p>`;
    return;
  }

  const sortedGoals = [...entry.goals].sort((a, b) => a.priority - b.priority);

  goalsList.innerHTML = sortedGoals
    .map((goal) => {
      const originalIndex = entry.goals.findIndex((g) => g.id === goal.id);
      return `
        <div class="goal-item">
          <div class="goal-row">
            <label class="goal-priority">
              <span>Priority</span>
              <select data-goal-index="${originalIndex}" data-field="priority">
                ${[1, 2, 3, 4, 5]
                  .map((n) => `<option value="${n}" ${goal.priority === n ? "selected" : ""}>${n}</option>`)
                  .join("")}
              </select>
            </label>
            <label class="goal-text-wrap">
              <span>Goal</span>
              <input
                type="text"
                value="${escapeHtml(goal.text)}"
                data-goal-index="${originalIndex}"
                data-field="text"
                maxlength="180"
                placeholder="Enter a concrete goal"
              />
            </label>
            <label class="goal-status">
              <span>Status</span>
              <select data-goal-index="${originalIndex}" data-field="status">
                <option value="not_started" ${goal.status === "not_started" ? "selected" : ""}>Not started</option>
                <option value="partial" ${goal.status === "partial" ? "selected" : ""}>Partial</option>
                <option value="done" ${goal.status === "done" ? "selected" : ""}>Done</option>
                <option value="deferred" ${goal.status === "deferred" ? "selected" : ""}>Deferred</option>
                <option value="skipped" ${goal.status === "skipped" ? "selected" : ""}>Skipped</option>
              </select>
            </label>
            <button type="button" class="ghost-btn delete-goal-btn" data-delete-goal="${originalIndex}">Delete</button>
          </div>
        </div>
      `;
    })
    .join("");

  goalsList.querySelectorAll("[data-field]").forEach((el) => {
    el.addEventListener("change", (event) => {
      const index = Number(event.target.dataset.goalIndex);
      const field = event.target.dataset.field;
      const entry = getEntry(state.activeDate);
      const goal = entry.goals[index];
      const newValue = field === "priority" ? Number(event.target.value) : event.target.value;

      if (!consumeRevisionIfNeeded(index, field, newValue)) {
        renderGoals();
        return;
      }

      goal[field] = newValue;
      normalizeGoalPriorities(entry);
      renderGoals();
      scheduleSave("entry");
    });

    if (el.tagName === "INPUT") {
      el.addEventListener("input", (event) => {
        const index = Number(event.target.dataset.goalIndex);
        const field = event.target.dataset.field;
        const entry = getEntry(state.activeDate);
        const goal = entry.goals[index];
        const newValue = event.target.value;

        if (entry.locked && goal[field] !== newValue && entry.revisionCount >= 2) {
          showNotice("You have already used your 2 revisions for today.");
          event.target.value = goal[field];
        }
      });
    }
  });

  goalsList.querySelectorAll("[data-delete-goal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.deleteGoal);
      const entry = getEntry(state.activeDate);

      if (entry.locked) {
        showNotice("Locked goals cannot be deleted.");
        return;
      }

      entry.goals.splice(index, 1);
      normalizeGoalPriorities(entry);
      renderGoalMeta();
      renderGoals();
      scheduleSave("entry");
    });
  });
}

function normalizeGoalPriorities(entry) {
  const seen = new Set();
  entry.goals.forEach((goal) => {
    let p = Number(goal.priority) || 1;
    while (seen.has(p) && p <= 5) p += 1;
    if (p > 5) p = 5;
    goal.priority = p;
    seen.add(p);
  });

  entry.goals.sort((a, b) => a.priority - b.priority);
  entry.goals.forEach((goal, idx) => {
    goal.priority = idx + 1;
  });
}

function renderFactors() {
  const entry = getEntry(state.activeDate);
  factorChips.innerHTML = FACTORS.map((factor) => {
    const active = entry.reflection.factors.includes(factor);
    return `<button type="button" class="chip ${active ? "active" : ""}" data-factor="${escapeHtml(factor)}">${escapeHtml(factor)}</button>`;
  }).join("");

  factorChips.querySelectorAll("[data-factor]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const factor = btn.dataset.factor;
      const factors = entry.reflection.factors;
      const exists = factors.includes(factor);
      entry.reflection.factors = exists
        ? factors.filter((f) => f !== factor)
        : [...factors, factor];

      renderFactors();
      scheduleSave("entry");
    });
  });
}

function renderExercisePlan() {
  exercisePlanGrid.innerHTML = WEEKDAYS.map((day) => `
    <label class="plan-day-card">
      <span>${day}</span>
      <textarea rows="2" data-exercise-day="${day}" placeholder="Example: StairMaster + strength">${escapeHtml(state.profile.exercisePlan[day] || "")}</textarea>
    </label>
  `).join("");

  exercisePlanGrid.querySelectorAll("[data-exercise-day]").forEach((el) => {
    el.addEventListener("input", () => {
      state.profile.exercisePlan[el.dataset.exerciseDay] = el.value;
      renderLinkedPlanSummary();
      scheduleSave("profile");
    });
  });
}

function renderRecurringGoals() {
  const goals = state.profile.recurringGoals || [];
  recurringGoalsList.innerHTML = goals.length
    ? goals.map((goal, index) => `
      <div class="goal-item">
        <div class="goal-row">
          <label class="goal-text-wrap">
            <span>Goal</span>
            <input type="text" maxlength="180" value="${escapeHtml(goal.text || "")}" data-recurring-index="${index}" data-recurring-field="text" />
          </label>
          <label class="goal-status">
            <span>Frequency</span>
            <select data-recurring-index="${index}" data-recurring-field="frequency">
              ${["daily", "weekly", "monthly"].map((f) => `<option value="${f}" ${goal.frequency === f ? "selected" : ""}>${f}</option>`).join("")}
            </select>
          </label>
          <button type="button" class="ghost-btn" data-delete-recurring="${index}">Delete</button>
        </div>
      </div>
    `).join("")
    : `<p class="subtle">No recurring goals yet.</p>`;

  recurringGoalsList.querySelectorAll("[data-recurring-field]").forEach((el) => {
    el.addEventListener("change", () => {
      const idx = Number(el.dataset.recurringIndex);
      const field = el.dataset.recurringField;
      state.profile.recurringGoals[idx][field] = el.value;
      scheduleSave("profile");
    });
  });

  recurringGoalsList.querySelectorAll('input[data-recurring-field="text"]').forEach((el) => {
    el.addEventListener("input", () => {
      const idx = Number(el.dataset.recurringIndex);
      state.profile.recurringGoals[idx].text = el.value;
      scheduleSave("profile");
    });
  });

  recurringGoalsList.querySelectorAll("[data-delete-recurring]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.deleteRecurring);
      state.profile.recurringGoals.splice(idx, 1);
      renderRecurringGoals();
      scheduleSave("profile");
    });
  });
}

function renderLinkedPlanSummary() {
  const weekday = weekdayFromDate(state.activeDate);
  const exercise = state.profile.exercisePlan[weekday] || "No exercise plan set.";
  const recurring = (state.profile.recurringGoals || []).filter((g) => g.text?.trim());
  const meal = state.profile.mealPlan;

  linkedPlanSummary.innerHTML = `
    <div class="linked-plan-block">
      <h4>${weekday} exercise plan</h4>
      <p>${escapeHtml(exercise)}</p>
    </div>
    <div class="linked-plan-block">
      <h4>Meal plan</h4>
      <p><strong>Breakfast:</strong> ${escapeHtml(meal.breakfast || "—")}</p>
      <p><strong>Lunch:</strong> ${escapeHtml(meal.lunch || "—")}</p>
      <p><strong>Dinner:</strong> ${escapeHtml(meal.dinner || "—")}</p>
      <p><strong>Notes:</strong> ${escapeHtml(meal.snacks || "—")}</p>
    </div>
    <div class="linked-plan-block">
      <h4>Recurring goals</h4>
      <p>${recurring.length ? recurring.map((g) => escapeHtml(`${g.text} (${g.frequency})`)).join("<br>") : "No recurring goals set."}</p>
    </div>
  `;
}

function renderPlans() {
  renderExercisePlan();
  mealBreakfast.value = state.profile.mealPlan.breakfast || "";
  mealLunch.value = state.profile.mealPlan.lunch || "";
  mealDinner.value = state.profile.mealPlan.dinner || "";
  mealSnacks.value = state.profile.mealPlan.snacks || "";
  weeklyGoals.value = state.profile.longerGoals.weekly || "";
  monthlyGoals.value = state.profile.longerGoals.monthly || "";
  yearlyGoals.value = state.profile.longerGoals.yearly || "";
  renderRecurringGoals();
}

function renderInsights() {
  const entries = Object.values(state.entries);
  if (!entries.length) {
    insightsSummary.innerHTML = `<p class="subtle">Insights will appear once you start using the journal.</p>`;
    factorInsightList.innerHTML = "";
    exerciseInsightList.innerHTML = "";
    return;
  }

  let topPriorityDone = 0;
  let totalTopPriorityDays = 0;
  let totalGoals = 0;
  let completedGoals = 0;
  const factorCounts = {};
  const weekdayExerciseCounts = {};
  const weekdayExerciseDone = {};

  WEEKDAYS.forEach((d) => {
    weekdayExerciseCounts[d] = 0;
    weekdayExerciseDone[d] = 0;
  });

  entries.forEach((entry) => {
    const sortedGoals = [...(entry.goals || [])].sort((a, b) => a.priority - b.priority);
    if (sortedGoals.length) {
      totalTopPriorityDays += 1;
      if (sortedGoals[0].status === "done") topPriorityDone += 1;
    }

    (entry.goals || []).forEach((goal) => {
      totalGoals += 1;
      if (goal.status === "done") completedGoals += 1;
    });

    (entry.reflection?.factors || []).forEach((factor) => {
      factorCounts[factor] = (factorCounts[factor] || 0) + 1;
    });

    const weekday = weekdayFromDate(entry.date);
    const planExists = !!(state.profile.exercisePlan[weekday] || "").trim();
    if (planExists) {
      weekdayExerciseCounts[weekday] += 1;
      const matched = (entry.goals || []).some((g) => g.text.toLowerCase().includes("exercise") || g.text.toLowerCase().includes("walk") || g.text.toLowerCase().includes("yoga") || g.text.toLowerCase().includes("strength") || g.text.toLowerCase().includes("stair"));
      if (matched) weekdayExerciseDone[weekday] += 1;
    }
  });

  const completionRate = totalGoals ? Math.round((completedGoals / totalGoals) * 100) : 0;
  const topPriorityRate = totalTopPriorityDays ? Math.round((topPriorityDone / totalTopPriorityDays) * 100) : 0;

  insightsSummary.innerHTML = `
    <div class="insight-card"><h4>Entry days</h4><p>${entries.length}</p></div>
    <div class="insight-card"><h4>Goal completion</h4><p>${completionRate}%</p></div>
    <div class="insight-card"><h4>#1 goal completion</h4><p>${topPriorityRate}%</p></div>
    <div class="insight-card"><h4>Most common obstacle</h4><p>${Object.entries(factorCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || "—"}</p></div>
  `;

  factorInsightList.innerHTML = Object.entries(factorCounts).length
    ? Object.entries(factorCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([factor, count]) => `<div class="stat-row"><span>${escapeHtml(factor)}</span><strong>${count}</strong></div>`)
        .join("")
    : `<p class="subtle">No factor data yet.</p>`;

  exerciseInsightList.innerHTML = WEEKDAYS.map((day) => {
    const total = weekdayExerciseCounts[day];
    const done = weekdayExerciseDone[day];
    const percent = total ? Math.round((done / total) * 100) : 0;
    return `<div class="stat-row"><span>${day}</span><strong>${total ? `${percent}%` : "—"}</strong></div>`;
  }).join("");
}

function bindGeneralInputs() {
  entryDate.addEventListener("change", async () => {
    state.activeDate = entryDate.value || todayString();
    getEntry(state.activeDate);
    renderEntry();
    renderInsights();
  });

  dailyFocus.addEventListener("input", () => {
    getEntry().focus = dailyFocus.value;
    scheduleSave("entry");
  });

  dailyPersonPrompt.addEventListener("input", () => {
    getEntry().personPrompt = dailyPersonPrompt.value;
    scheduleSave("entry");
  });

  actedWell.addEventListener("input", () => {
    getEntry().reflection.actedWell = actedWell.value;
    scheduleSave("entry");
  });

  fellShort.addEventListener("input", () => {
    getEntry().reflection.fellShort = fellShort.value;
    scheduleSave("entry");
  });

  factorNotes.addEventListener("input", () => {
    getEntry().reflection.factorNotes = factorNotes.value;
    scheduleSave("entry");
  });

  doDifferently.addEventListener("input", () => {
    getEntry().reflection.doDifferently = doDifferently.value;
    scheduleSave("entry");
  });

  additionalNotes.addEventListener("input", () => {
    getEntry().reflection.additionalNotes = additionalNotes.value;
    scheduleSave("entry");
  });

  mealBreakfast.addEventListener("input", () => {
    state.profile.mealPlan.breakfast = mealBreakfast.value;
    renderLinkedPlanSummary();
    scheduleSave("profile");
  });

  mealLunch.addEventListener("input", () => {
    state.profile.mealPlan.lunch = mealLunch.value;
    renderLinkedPlanSummary();
    scheduleSave("profile");
  });

  mealDinner.addEventListener("input", () => {
    state.profile.mealPlan.dinner = mealDinner.value;
    renderLinkedPlanSummary();
    scheduleSave("profile");
  });

  mealSnacks.addEventListener("input", () => {
    state.profile.mealPlan.snacks = mealSnacks.value;
    renderLinkedPlanSummary();
    scheduleSave("profile");
  });

  weeklyGoals.addEventListener("input", () => {
    state.profile.longerGoals.weekly = weeklyGoals.value;
    scheduleSave("profile");
  });

  monthlyGoals.addEventListener("input", () => {
    state.profile.longerGoals.monthly = monthlyGoals.value;
    scheduleSave("profile");
  });

  yearlyGoals.addEventListener("input", () => {
    state.profile.longerGoals.yearly = yearlyGoals.value;
    scheduleSave("profile");
  });

  addGoalBtn.addEventListener("click", () => {
    const entry = getEntry();
    if (entry.goals.length >= 5) {
      showNotice("Limit reached: up to 5 goals.");
      return;
    }
    if (entry.locked) {
      showNotice("Goals are locked for today.");
      return;
    }
    entry.goals.push({
      id: crypto.randomUUID(),
      priority: entry.goals.length + 1,
      text: "",
      status: "not_started"
    });
    renderGoalMeta();
    renderGoals();
    scheduleSave("entry");
  });

  lockGoalsBtn.addEventListener("click", () => {
    const entry = getEntry();
    if (entry.locked) return;
    entry.locked = true;
    entry.lockedAt = new Date().toISOString();
    entry.revisionCount = 0;
    entry.revisionLog = [];
    showNotice("Goals locked. You may revise text/priority up to 2 times today.");
    renderGoalMeta();
    scheduleSave("entry");
  });

  addRecurringGoalBtn.addEventListener("click", () => {
    state.profile.recurringGoals.push({ text: "", frequency: "daily" });
    renderRecurringGoals();
    scheduleSave("profile");
  });

  themeToggle.addEventListener("click", () => {
    setTheme(state.theme === "dark" ? "light" : "dark");
  });

  signOutBtn.addEventListener("click", async () => {
    await signOut(auth);
  });

  exportBtn.addEventListener("click", () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: state.profile,
      entries: state.entries
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `formation-journal-export-${todayString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.querySelectorAll(".tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((btn) => btn.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
      tabBtn.classList.add("active");
      document.getElementById(`${tabBtn.dataset.tab}Tab`).classList.add("active");
    });
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.classList.remove("hidden");
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.classList.add("hidden");
  });
}

googleSignInBtn?.addEventListener("click", async () => {
  try {
    await signInWithRedirect(auth, provider);
  } catch (error) {
    console.error(error);
    alert(error.message || "Sign-in failed.");
  }
});

getRedirectResult(auth).catch((error) => {
  console.error(error);
  alert(error.message || "Redirect sign-in failed.");
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user || null;
  renderAuthState();

  if (!user) return;

  try {
    syncStatus.textContent = "Loading...";
    await loadAllUserData(user);
    renderPlans();
    renderEntry();
    renderInsights();
    syncStatus.textContent = "Synced";
  } catch (error) {
    console.error(error);
    syncStatus.textContent = "Load failed";
    alert(error.message || "Could not load your journal data.");
  }
});

setTheme(state.theme);
bindGeneralInputs();
getEntry(state.activeDate);
renderPlans();
renderEntry();
renderInsights();
