// app.jsx — root: routing, timer engine, goal completion, break flow, tweaks
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "terracotta",
  "focusLen": 25,
  "breakLen": 5,
  "speed": "real",
  "sound": true,
  "encourage": true
}/*EDITMODE-END*/;

const ACCENTS = {
  terracotta: { clay: "oklch(0.66 0.11 42)", track: "oklch(0.93 0.028 52)" },
  rose:       { clay: "oklch(0.65 0.105 14)", track: "oklch(0.93 0.028 14)" },
  amber:      { clay: "oklch(0.74 0.10 75)", track: "oklch(0.94 0.03 82)" },
  plum:       { clay: "oklch(0.58 0.105 330)", track: "oklch(0.92 0.03 330)" },
};
const SPEEDS = { real: 1, demo: 20, sprint: 120 };

function playChime(kind) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx(); const now = ctx.currentTime;
    const notes = kind === "break" ? [523.25, 659.25] : [659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t = now + i * 0.16;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9); o.start(t); o.stop(t + 1.0);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch (e) {}
}
function loadLS(k, f) { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch (e) { return f; } }
function saveLS(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = useStateA("timer");
  const [goals, setGoals] = useStateA(() => DB.getGoals());
  const [reloadKey, setReloadKey] = useStateA(0);
  const tasks = allTasks(goals);

  const persisted = useRefA(loadLS(STORE_KEYS.timer, null)).current;
  const focusTotal = Math.round((t.focusLen || 25) * 60);
  const breakTotal = Math.round((t.breakLen || 5) * 60);

  // pick a sensible default task
  const firstTask = tasks[0];
  const [selGoal, setSelGoal] = useStateA(persisted?.selGoal || (firstTask ? firstTask.goalId : null));
  const [selTask, setSelTask] = useStateA(persisted?.selTask || (firstTask ? firstTask.taskId : null));
  const selectedKey = selGoal != null && selTask != null ? selGoal + ":" + selTask : null;
  const selectedTask = tasks.find((x) => x.key === selectedKey) || null;

  const [mode, setMode] = useStateA(persisted?.mode || "focus");
  const [status, setStatus] = useStateA(persisted?.status === "running" ? "running" : (persisted?.status || "idle"));
  const [secondsLeft, setSecondsLeft] = useStateA(() => {
    if (persisted && persisted.secondsLeft != null) {
      if (persisted.status === "running" && persisted.deadline) {
        return Math.max(0, (persisted.deadline - Date.now()) / 1000 * (SPEEDS[persisted.speed] || 1));
      }
      return persisted.secondsLeft;
    }
    return focusTotal;
  });
  const [encouragement, setEncouragement] = useStateA(() => pick(ENCOURAGEMENTS, 1));
  const [toast, setToast] = useStateA(null);

  const deadlineRef = useRefA(persisted?.status === "running" ? persisted.deadline : null);
  const speed = SPEEDS[t.speed] || 1;
  const totalSeconds = mode === "break" ? breakTotal : focusTotal;

  useEffectA(() => {
    saveLS(STORE_KEYS.timer, { mode, status, secondsLeft, selGoal, selTask, speed: t.speed, deadline: deadlineRef.current });
  }, [mode, status, secondsLeft, selGoal, selTask, t.speed]);

  useEffectA(() => { if (status === "idle") setSecondsLeft(mode === "break" ? breakTotal : focusTotal); }, [focusTotal, breakTotal, mode, status]);
  useEffectA(() => { if (status === "running") deadlineRef.current = Date.now() + (secondsLeft / speed) * 1000; /* eslint-disable-next-line */ }, [t.speed]);

  const completeRef = useRefA(false);
  const handleComplete = useCallback(() => {
    if (completeRef.current) return;
    completeRef.current = true;
    if (mode === "focus") {
      if (selGoal != null && selTask != null) {
        DB.addSession({ goal_id: selGoal, task_id: selTask, duration: Math.round(focusTotal / 60) });
        DB.advanceTask(selGoal, selTask, 1);
        setGoals(DB.getGoals());
      }
      setReloadKey((k) => k + 1);
      if (t.sound) playChime("focus");
      setToast({ kind: "focus", title: pick(COMPLETE_MESSAGES, Date.now()), msg: selectedTask ? `+1 brick · ${selectedTask.name} (${selectedTask.goalTitle})` : "Session saved" });
      setMode("break"); setSecondsLeft(breakTotal);
      deadlineRef.current = Date.now() + (breakTotal / speed) * 1000; setStatus("running");
      setEncouragement(pick(BREAK_MESSAGES, Date.now() + 3));
    } else {
      if (t.sound) playChime("break");
      setToast({ kind: "break", title: "Welcome back", msg: "Whenever you're ready, begin again." });
      setMode("focus"); setSecondsLeft(focusTotal); setStatus("idle"); deadlineRef.current = null;
      setEncouragement(pick(ENCOURAGEMENTS, Date.now() + 9));
    }
    setTimeout(() => { completeRef.current = false; }, 600);
    setTimeout(() => setToast(null), 5200);
  }, [mode, selGoal, selTask, focusTotal, breakTotal, speed, selectedTask, t.sound]);

  useEffectA(() => {
    if (status !== "running") return;
    const iv = setInterval(() => {
      if (deadlineRef.current == null) return;
      const left = (deadlineRef.current - Date.now()) / 1000 * speed;
      if (left <= 0) { setSecondsLeft(0); handleComplete(); } else setSecondsLeft(left);
    }, 100);
    return () => clearInterval(iv);
  }, [status, speed, handleComplete]);

  // controls
  const start = () => { deadlineRef.current = Date.now() + (secondsLeft / speed) * 1000; setStatus("running"); };
  const pause = () => { deadlineRef.current = null; setStatus("paused"); };
  const resume = () => { deadlineRef.current = Date.now() + (secondsLeft / speed) * 1000; setStatus("running"); };
  const reset = () => { deadlineRef.current = null; setStatus("idle"); setSecondsLeft(mode === "break" ? breakTotal : focusTotal); setEncouragement(pick(ENCOURAGEMENTS, Date.now())); };

  const selectTask = (goalId, taskId) => { if (status === "running") return; setSelGoal(goalId); setSelTask(taskId); };
  const focusTask = (goalId, taskId) => { setSelGoal(goalId); setSelTask(taskId); setMode("focus"); setStatus("idle"); deadlineRef.current = null; setSecondsLeft(focusTotal); setView("timer"); };

  // goal handlers
  const createGoal = (title, who) => setGoals(DB.addGoal(title, who));
  const removeGoal = (id) => { const next = DB.removeGoal(id); setGoals(next); if (selGoal === id) { const f = allTasks(next)[0]; setSelGoal(f ? f.goalId : null); setSelTask(f ? f.taskId : null); } };
  const addTask = (goalId, name, target) => setGoals(DB.addTask(goalId, name, target));
  const removeTask = (goalId, taskId) => { const next = DB.removeTask(goalId, taskId); setGoals(next); if (selGoal === goalId && selTask === taskId) { const f = allTasks(next)[0]; setSelGoal(f ? f.goalId : null); setSelTask(f ? f.taskId : null); } };
  const adjustTask = (goalId, taskId, done) => { setGoals(DB.setTaskDone(goalId, taskId, done)); };

  const stats = computeStats(DB.getSessions());
  const accent = ACCENTS[t.accent] || ACCENTS.terracotta;
  const rootStyle = { "--clay": accent.clay, "--clay-track": accent.track };

  return (
    <div className="app" style={rootStyle} data-mode={mode}>
      <Sidebar view={view} onNav={setView} streak={stats.streak} />
      <main className="stage">
        {view === "timer" && (
          <TimerView
            mode={mode} status={status} secondsLeft={Math.ceil(secondsLeft)} totalSeconds={totalSeconds}
            tasks={tasks} selectedKey={selectedKey} selectedTask={selectedTask}
            encouragement={t.encourage ? encouragement : ""}
            onStart={start} onPause={pause} onResume={resume} onReset={reset}
            onSelectTask={selectTask} onManage={() => setView("goals")} />
        )}
        {view === "goals" && (
          <GoalsView goals={goals} onCreate={createGoal} onRemoveGoal={removeGoal}
            onAddTask={addTask} onRemoveTask={removeTask} onAdjustTask={adjustTask} onFocusTask={focusTask} />
        )}
        {view === "history" && <HistoryView reloadKey={reloadKey} />}
        {view === "dashboard" && <DashboardView reloadKey={reloadKey} />}
      </main>

      {toast && (
        <div className={"toast toast-" + toast.kind} onClick={() => setToast(null)}>
          <div className="toast-mark"><Icon name={toast.kind === "break" ? "leaf" : "check"} size={20} /></div>
          <div className="toast-body">
            <div className="toast-title">{toast.title}</div>
            <div className="toast-msg">{toast.msg}</div>
          </div>
        </div>
      )}

      <TweaksPanel>
        <TweakSection label="Mood" />
        <TweakColor label="Brand accent" value={ACCENTS[t.accent].clay}
          options={Object.values(ACCENTS).map((a) => a.clay)}
          onChange={(v) => { const key = Object.keys(ACCENTS).find((k) => ACCENTS[k].clay === v) || "terracotta"; setTweak("accent", key); }} />
        <TweakToggle label="Encouraging words" value={t.encourage} onChange={(v) => setTweak("encourage", v)} />
        <TweakToggle label="Gentle chime" value={t.sound} onChange={(v) => setTweak("sound", v)} />
        <TweakSection label="Timing" />
        <TweakSlider label="Focus length" value={t.focusLen} min={5} max={50} step={5} unit=" min" onChange={(v) => setTweak("focusLen", v)} />
        <TweakSlider label="Break length" value={t.breakLen} min={1} max={15} step={1} unit=" min" onChange={(v) => setTweak("breakLen", v)} />
        <TweakRadio label="Demo speed" value={t.speed} options={["real", "demo", "sprint"]} onChange={(v) => setTweak("speed", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
