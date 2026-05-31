// data.jsx — Who → Goal → Task hierarchy, sessions, stats, copy
// All state in localStorage. Goals + sessions are seeded together so bricks
// and history stay consistent.

const STORE_KEYS = {
  goals: "ft.goals.v3",
  sessions: "ft.sessions.v3",
  timer: "ft.timer.v3",
};

// ---- "Who is it for" — the top dimension ----
const LIFE_AREAS = [
  { id: "me",     label: "For me",       color: "oklch(0.66 0.105 35)" },
  { id: "child",  label: "For my child", color: "oklch(0.745 0.10 78)" },
  { id: "family", label: "For family",   color: "oklch(0.66 0.060 158)" },
  { id: "work",   label: "For work",     color: "oklch(0.62 0.080 250)" },
  { id: "other",  label: "Other",        color: "oklch(0.62 0.078 330)" },
];
const AREA_MAP = Object.fromEntries(LIFE_AREAS.map((a) => [a.id, a]));
function areaColor(id) { return (AREA_MAP[id] || AREA_MAP.other).color; }
function areaLabel(id) { return (AREA_MAP[id] || AREA_MAP.other).label; }

function load(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch (e) { return fallback; }
}
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }
function seededRand(n) { const x = Math.sin(n * 99.13 + 7.7) * 10000; return x - Math.floor(x); }

// ---- Seed goals + sessions together (consistent) ----
function goalDefs() {
  return [
    { id: 1, who: "child",  title: "A reading habit", tasks: [
      { id: 1, name: "Read together", target: 12 },
      { id: 2, name: "Pick new books", target: 3 },
    ]},
    { id: 2, who: "me", title: "Write a short story", tasks: [
      { id: 1, name: "Outline the idea", target: 3 },
      { id: 2, name: "Draft the scenes", target: 8 },
      { id: 3, name: "Revise & polish", target: 4 },
    ]},
    { id: 3, who: "me", title: "Move my body", tasks: [
      { id: 1, name: "Stretch & mobility", target: 10 },
      { id: 2, name: "Plan the week's workouts", target: 2 },
    ]},
    { id: 4, who: "family", title: "Plan Mina's birthday", tasks: [
      { id: 1, name: "Guest list & invites", target: 2 },
      { id: 2, name: "Decorations", target: 2 },
      { id: 3, name: "Cake & food", target: 3 },
    ]},
    { id: 5, who: "work", title: "Finish the React course", tasks: [
      { id: 1, name: "State & hooks", target: 4 },
      { id: 2, name: "Routing", target: 3 },
      { id: 3, name: "Build the final project", target: 10 },
    ]},
  ];
}

function seedAll() {
  const goals = goalDefs().map((g) => ({ ...g, created_at: isoDaysAgo(20 - g.id), tasks: g.tasks.map((t) => ({ ...t, done: 0 })) }));
  // flat task pool with weights (some get more love)
  const pool = [];
  goals.forEach((g) => g.tasks.forEach((t) => {
    const weight = (g.who === "me" ? 3 : g.who === "work" ? 3 : g.who === "child" ? 2 : 1);
    for (let w = 0; w < weight; w++) pool.push({ goalId: g.id, taskId: t.id });
  }));

  const sessions = [];
  let id = 1;
  const now = new Date();
  for (let d = 33; d >= 0; d--) {
    const day = new Date(now); day.setDate(now.getDate() - d); day.setHours(0, 0, 0, 0);
    const isRecentStreak = d <= 4;
    const olderGap = (d === 6 || d === 12 || d === 19 || d === 26);
    if (olderGap && !isRecentStreak) continue;
    let n = Math.floor(seededRand(d * 5 + 3) * 3); // 0..2
    if (isRecentStreak) n = Math.max(1, n + 1);
    for (let k = 0; k < n; k++) {
      const choice = pool[Math.floor(seededRand(d * 13 + k * 7 + 1) * pool.length) % pool.length];
      const g = goals.find((x) => x.id === choice.goalId);
      const t = g.tasks.find((x) => x.id === choice.taskId);
      const hour = 7 + Math.floor(seededRand(d + k * 5) * 13);
      const min = Math.floor(seededRand(d * 2 + k * 3) * 60);
      const created = new Date(day); created.setHours(hour, min, 0, 0);
      sessions.push({
        id: id++, goal_id: g.id, goal_title: g.title, task_id: t.id, task_name: t.name,
        who: g.who, duration: 25, created_at: created.toISOString(),
      });
    }
  }
  // derive done counts from sessions (capped at target)
  const cnt = {};
  sessions.forEach((s) => { const k = s.goal_id + ":" + s.task_id; cnt[k] = (cnt[k] || 0) + 1; });
  goals.forEach((g) => g.tasks.forEach((t) => { t.done = Math.min(t.target, cnt[g.id + ":" + t.id] || 0); }));
  return { goals, sessions };
}
function isoDaysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString(); }

function ensureSeed() {
  const g = load(STORE_KEYS.goals, null);
  const s = load(STORE_KEYS.sessions, null);
  if (g && s) return;
  const seeded = seedAll();
  if (!g) save(STORE_KEYS.goals, seeded.goals);
  if (!s) save(STORE_KEYS.sessions, seeded.sessions);
}

// ---- Data API ----
const DB = {
  getGoals() { ensureSeed(); return load(STORE_KEYS.goals, []); },
  setGoals(list) { save(STORE_KEYS.goals, list); return list; },
  addGoal(title, who) {
    const list = DB.getGoals();
    const id = (list.reduce((m, g) => Math.max(m, g.id), 0) || 0) + 1;
    return DB.setGoals([...list, { id, title, who: who || "me", created_at: new Date().toISOString(), tasks: [] }]);
  },
  removeGoal(id) { return DB.setGoals(DB.getGoals().filter((g) => g.id !== id)); },
  addTask(goalId, name, target) {
    return DB.setGoals(DB.getGoals().map((g) => {
      if (g.id !== goalId) return g;
      const tid = (g.tasks.reduce((m, t) => Math.max(m, t.id), 0) || 0) + 1;
      return { ...g, tasks: [...g.tasks, { id: tid, name, target: Math.max(1, target || 1), done: 0 }] };
    }));
  },
  removeTask(goalId, taskId) {
    return DB.setGoals(DB.getGoals().map((g) => g.id !== goalId ? g : { ...g, tasks: g.tasks.filter((t) => t.id !== taskId) }));
  },
  setTaskDone(goalId, taskId, done) {
    return DB.setGoals(DB.getGoals().map((g) => {
      if (g.id !== goalId) return g;
      return { ...g, tasks: g.tasks.map((t) => t.id !== taskId ? t : { ...t, done: Math.max(0, Math.min(t.target, done)) }) };
    }));
  },
  advanceTask(goalId, taskId, delta) {
    const g = DB.getGoals().find((x) => x.id === goalId);
    const t = g && g.tasks.find((x) => x.id === taskId);
    if (!t) return DB.getGoals();
    return DB.setTaskDone(goalId, taskId, t.done + (delta || 1));
  },

  getSessions() { ensureSeed(); return load(STORE_KEYS.sessions, []); },
  addSession({ goal_id, task_id, duration }) {
    const list = DB.getSessions();
    const g = DB.getGoals().find((x) => x.id === goal_id);
    const t = g && g.tasks.find((x) => x.id === task_id);
    const id = (list.reduce((m, x) => Math.max(m, x.id), 0) || 0) + 1;
    const row = {
      id, goal_id, goal_title: g ? g.title : "Focus", task_id, task_name: t ? t.name : "Focus",
      who: g ? g.who : "other", duration, created_at: new Date().toISOString(),
    };
    save(STORE_KEYS.sessions, [row, ...list]); return row;
  },
  removeSession(id) { const next = DB.getSessions().filter((s) => s.id !== id); save(STORE_KEYS.sessions, next); return next; },
};

// flatten all tasks for the timer picker
function allTasks(goals) {
  const out = [];
  (goals || DB.getGoals()).forEach((g) => g.tasks.forEach((t) => {
    out.push({ key: g.id + ":" + t.id, goalId: g.id, taskId: t.id, name: t.name, target: t.target, done: t.done, who: g.who, goalTitle: g.title, color: areaColor(g.who) });
  }));
  return out;
}

// ---- Stats ----
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function startOfWeek(date) { const d = new Date(date); d.setHours(0,0,0,0); const day = (d.getDay()+6)%7; d.setDate(d.getDate()-day); return d; }

function computeStats(sessions) {
  const now = new Date();
  const totalMinutes = sessions.reduce((m, s) => m + s.duration, 0);
  const daySet = new Set(sessions.map((s) => { const d = new Date(s.created_at); d.setHours(0,0,0,0); return d.getTime(); }));
  let streak = 0; const cursor = new Date(now); cursor.setHours(0,0,0,0);
  if (!daySet.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
  while (daySet.has(cursor.getTime())) { streak++; cursor.setDate(cursor.getDate() - 1); }

  const weekStart = startOfWeek(now);
  const sessionsThisWeek = sessions.filter((s) => new Date(s.created_at) >= weekStart).length;

  const areaMap = {}; sessions.forEach((s) => { const a = s.who || "other"; areaMap[a] = (areaMap[a] || 0) + s.duration; });
  const by_area = LIFE_AREAS.map((a) => ({ id: a.id, label: a.label, color: a.color, minutes: areaMap[a.id] || 0 })).filter((a) => a.minutes > 0).sort((a, b) => b.minutes - a.minutes);

  const goalMap = {}; sessions.forEach((s) => { const k = s.goal_title; goalMap[k] = goalMap[k] || { minutes: 0, who: s.who }; goalMap[k].minutes += s.duration; });
  const by_goal = Object.entries(goalMap).map(([title, v]) => ({ title, minutes: v.minutes, color: areaColor(v.who) })).sort((a, b) => b.minutes - a.minutes);

  const taskMap = {}; sessions.forEach((s) => { taskMap[s.task_name] = taskMap[s.task_name] || { minutes: 0, who: s.who }; taskMap[s.task_name].minutes += s.duration; });
  const by_task = Object.entries(taskMap).map(([name, v]) => ({ name, minutes: v.minutes, color: areaColor(v.who) })).sort((a, b) => b.minutes - a.minutes);

  const by_weekday = { Mon:0,Tue:0,Wed:0,Thu:0,Fri:0,Sat:0,Sun:0 };
  sessions.filter((s) => new Date(s.created_at) >= weekStart).forEach((s) => {
    const wd = WEEKDAYS[(new Date(s.created_at).getDay()+6)%7]; by_weekday[wd] += s.duration;
  });

  return { streak, total_hours: Math.round((totalMinutes/60)*10)/10, sessions_this_week: sessionsThisWeek, by_area, by_goal, by_task, by_weekday };
}

// ---- Encouragement copy ----
const ENCOURAGEMENTS = [
  "You showed up. That already counts.",
  "Rest is part of the work, not a reward for it.",
  "One gentle session at a time.",
  "You're allowed to go slowly today.",
  "Caring for yourself is caring for them too.",
  "Small focus, real progress.",
  "Be as kind to yourself as you'd be to your child.",
  "This time is yours. Take it.",
];
const COMPLETE_MESSAGES = ["Beautifully done. Now, breathe.", "That was enough. You did enough.", "Proud of you. Stretch a little.", "Lovely focus. Sip some water."];
const BREAK_MESSAGES = ["Five minutes, just for you.", "Look away, roll your shoulders, soften.", "Stand up, stretch tall. You earned this.", "A small pause. Let yourself land."];
function pick(arr, salt) { const i = Math.floor(seededRand((salt || Date.now()) % 100000) * arr.length) % arr.length; return arr[i]; }

Object.assign(window, {
  DB, allTasks, computeStats, areaColor, areaLabel, LIFE_AREAS, AREA_MAP,
  WEEKDAYS, STORE_KEYS, ENCOURAGEMENTS, COMPLETE_MESSAGES, BREAK_MESSAGES, pick,
});
