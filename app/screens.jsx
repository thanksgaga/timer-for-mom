// screens.jsx — Timer, History, Dashboard
const { useState: useStateS, useMemo, useEffect: useEffectS } = React;

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
function mins(m) { return m >= 60 ? Math.round(m / 60 * 10) / 10 + "h" : m + "m"; }

// ======================= TIMER =======================
function TimerView(props) {
  const {
    mode, status, secondsLeft, totalSeconds,
    tasks, selectedKey, selectedTask, encouragement,
    onStart, onPause, onResume, onReset, onSelectTask, onManage,
  } = props;

  const isBreak = mode === "break";
  const progress = totalSeconds ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const color = isBreak ? "var(--sage)" : (selectedTask ? selectedTask.color : "var(--clay)");
  const track = isBreak ? "var(--sage-track)" : "var(--clay-track)";
  const running = status === "running";
  const idle = status === "idle";

  return (
    <div className={"screen timer-screen" + (isBreak ? " is-break" : "")} style={!isBreak && selectedTask ? { "--clay": selectedTask.color } : null}>
      <div className="timer-head">
        <span className="mode-tag">{isBreak ? "Break" : "Focus session"}</span>
        <h1 className="timer-title">{isBreak ? "Time to soften" : (idle ? "Ready when you are" : "You're focusing")}</h1>
      </div>

      {!isBreak && (
        <div className="subject-block">
          <div className="subject-label">What are you putting 25 minutes toward?</div>
          <TaskPicker tasks={tasks} selectedKey={selectedKey} onSelect={onSelectTask} onManage={onManage} />
        </div>
      )}

      <ProgressRing progress={progress} color={color} track={track} size={336} stroke={11}>
        <div className="ring-time">{fmt(secondsLeft)}</div>
        <div className="ring-sub">
          {isBreak ? "until you return" : (selectedTask ? selectedTask.name : "pick a task")}
        </div>
      </ProgressRing>

      <div className="controls">
        {idle && (
          <button className="btn btn-primary" onClick={onStart} disabled={!isBreak && !selectedTask}>
            <Icon name="play" size={18} /> Begin
          </button>
        )}
        {running && <button className="btn btn-primary" onClick={onPause}><Icon name="pause" size={18} /> Pause</button>}
        {status === "paused" && <button className="btn btn-primary" onClick={onResume}><Icon name="play" size={18} /> Resume</button>}
        {!idle && <button className="btn btn-ghost" onClick={onReset}><Icon name="reset" size={17} /> Reset</button>}
      </div>

      <p className="encourage">{encouragement}</p>
    </div>
  );
}

// ======================= HISTORY =======================
function HistoryView({ reloadKey }) {
  const [range, setRange] = useStateS("week");
  const [whoFilter, setWhoFilter] = useStateS("all");
  const [sessions, setSessions] = useStateS(() => DB.getSessions());
  useEffectS(() => { setSessions(DB.getSessions()); }, [reloadKey]);

  const remove = (id) => setSessions(DB.removeSession(id));

  const present = LIFE_AREAS.filter((a) => sessions.some((s) => s.who === a.id));

  const filtered = useMemo(() => {
    const now = new Date();
    let from = null;
    if (range === "week") { from = new Date(now); from.setDate(now.getDate() - ((now.getDay() + 6) % 7)); from.setHours(0,0,0,0); }
    if (range === "month") { from = new Date(now.getFullYear(), now.getMonth(), 1); }
    return sessions.filter((s) => {
      if (whoFilter !== "all" && s.who !== whoFilter) return false;
      if (from && new Date(s.created_at) < from) return false;
      return true;
    });
  }, [sessions, range, whoFilter]);

  const groups = useMemo(() => {
    const map = {};
    filtered.forEach((s) => { const key = new Date(s.created_at).toDateString(); (map[key] = map[key] || []).push(s); });
    return Object.entries(map).sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .map(([k, items]) => ({ key: k, items: items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) }));
  }, [filtered]);

  const totalMin = filtered.reduce((m, s) => m + s.duration, 0);
  const dayLabel = (key) => {
    const d = new Date(key); const today = new Date(); today.setHours(0,0,0,0);
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yest.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  };
  const timeLabel = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className="screen history-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">Your sessions</h1>
          <p className="screen-sub">{filtered.length} sessions · {Math.round(totalMin/60*10)/10}h of gentle focus</p>
        </div>
      </header>

      <div className="filters">
        <div className="seg">
          {[["week","This week"],["month","This month"],["all","All time"]].map(([v,l]) => (
            <button key={v} className={"seg-btn" + (range===v?" is-active":"")} onClick={() => setRange(v)}>{l}</button>
          ))}
        </div>
        <div className="filter-chips">
          <button className={"fchip" + (whoFilter==="all"?" is-active":"")} onClick={() => setWhoFilter("all")}>All</button>
          {present.map((a) => (
            <button key={a.id} className={"fchip" + (whoFilter===a.id?" is-active":"")} onClick={() => setWhoFilter(a.id)}>
              <span className="hbar-dot" style={{ background: a.color }} />{a.label}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <div className="empty-mark"><Icon name="leaf" size={26} /></div>
          <p>No sessions here yet.<br />When you focus, they'll gather here — gently.</p>
        </div>
      ) : (
        <div className="day-groups">
          {groups.map((g) => (
            <section className="day-group" key={g.key}>
              <div className="day-head">
                <span className="day-name">{dayLabel(g.key)}</span>
                <span className="day-count">{g.items.length} · {g.items.reduce((m,s)=>m+s.duration,0)} min</span>
              </div>
              <ul className="session-list">
                {g.items.map((s) => (
                  <li className="session-row" key={s.id}>
                    <span className="srow-dot" style={{ background: areaColor(s.who) }} />
                    <span className="srow-main">
                      <span className="srow-task">{s.task_name}</span>
                      <span className="srow-goal">{areaLabel(s.who)} · {s.goal_title}</span>
                    </span>
                    <span className="srow-dur">{s.duration} min</span>
                    <span className="srow-time">{timeLabel(s.created_at)}</span>
                    <button className="srow-del" onClick={() => remove(s.id)} title="Delete session"><Icon name="trash" size={16} /></button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ======================= DASHBOARD =======================
function DashboardView({ reloadKey }) {
  const [sessions, setSessions] = useStateS(() => DB.getSessions());
  useEffectS(() => { setSessions(DB.getSessions()); }, [reloadKey]);
  const stats = useMemo(() => computeStats(sessions), [sessions]);

  const todayIdx = (new Date().getDay() + 6) % 7;
  const weekData = WEEKDAYS.map((d, i) => ({ label: d, value: stats.by_weekday[d], highlight: i === todayIdx }));
  const areaData = stats.by_area.map((a) => ({ label: a.label, value: a.minutes, display: mins(a.minutes), color: a.color }));
  const goalData = stats.by_goal.map((g) => ({ label: g.title, value: g.minutes, display: mins(g.minutes), color: g.color }));

  return (
    <div className="screen dash-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">How you've been</h1>
          <p className="screen-sub">A quiet look at where your focus goes — no pressure, just patterns.</p>
        </div>
      </header>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-icon"><Icon name="sprout" size={20} /></div>
          <div className="stat-num">{stats.streak}<span className="stat-unit"> days</span></div>
          <div className="stat-label">Current streak</div>
          <div className="stat-note">{stats.streak >= 3 ? "You keep coming back. That's strength." : "Every day is a fresh start."}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icon name="timer" size={20} /></div>
          <div className="stat-num">{stats.total_hours}<span className="stat-unit"> h</span></div>
          <div className="stat-label">Total focus time</div>
          <div className="stat-note">All the small moments, added up.</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon"><Icon name="check" size={20} /></div>
          <div className="stat-num">{stats.sessions_this_week}</div>
          <div className="stat-label">Sessions this week</div>
          <div className="stat-note">Look what you made room for.</div>
        </div>
      </div>

      <div className="chart-grid">
        <section className="panel">
          <h2 className="panel-title">Who your time was for</h2>
          {areaData.length ? <HBarChart data={areaData} /> : <p className="muted">No data yet.</p>}
        </section>
        <section className="panel">
          <h2 className="panel-title">This week's rhythm</h2>
          <VBarChart data={weekData} color="var(--clay)" />
          <p className="panel-foot">Minutes focused, Monday to Sunday</p>
        </section>
      </div>

      <section className="panel panel-wide">
        <h2 className="panel-title">Focus by goal</h2>
        {goalData.length ? <HBarChart data={goalData} /> : <p className="muted">No data yet.</p>}
      </section>
    </div>
  );
}

Object.assign(window, { TimerView, HistoryView, DashboardView, fmt });
