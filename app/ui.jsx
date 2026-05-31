// ui.jsx — shared presentational components
const { useState, useRef, useEffect } = React;

// ---------- tiny inline icons (stroke, 1.6) ----------
function Icon({ name, size = 20, style }) {
  const s = { width: size, height: size, display: "block", ...style };
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" };
  const paths = {
    timer: <g {...common}><circle cx="12" cy="13" r="8" /><path d="M12 13V9M12 5V3M9 3h6" /></g>,
    history: <g {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 4v4h4M12 8v4l3 2" /></g>,
    dashboard: <g {...common}><path d="M4 13v6M10 8v11M16 11v8M21 5v14" /></g>,
    play: <g {...common}><path d="M7 5l11 7-11 7z" fill="currentColor" stroke="none" /></g>,
    pause: <g {...common}><rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" /><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none" /></g>,
    reset: <g {...common}><path d="M4 9a8 8 0 1 1-1.5 5" /><path d="M3 4v5h5" /></g>,
    plus: <g {...common}><path d="M12 5v14M5 12h14" /></g>,
    trash: <g {...common}><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></g>,
    leaf: <g {...common}><path d="M5 19c0-8 6-13 14-14 0 8-5 14-14 14z" /><path d="M5 19c3-5 6-7 10-9" /></g>,
    check: <g {...common}><path d="M5 12.5l4.5 4.5L19 6.5" /></g>,
    close: <g {...common}><path d="M6 6l12 12M18 6L6 18" /></g>,
    goal: <g {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /><path d="M12 4V2M20 12h2M12 20v2M4 12H2" /></g>,
    arrow: <g {...common}><path d="M5 12h13M13 6l6 6-6 6" /></g>,
    sprout: <g {...common}><path d="M12 20v-7" /><path d="M12 13c0-3-2-5-6-5 0 3 2 5 6 5z" /><path d="M12 11c0-3 2-5 5-5 0 3-2 5-5 5z" /></g>,
  };
  return <svg viewBox="0 0 24 24" style={s} aria-hidden="true">{paths[name]}</svg>;
}

// ---------- Sidebar nav ----------
function Sidebar({ view, onNav, streak }) {
  const items = [
    { id: "timer", label: "Timer", icon: "timer" },
    { id: "goals", label: "Goals", icon: "goal" },
    { id: "history", label: "History", icon: "history" },
    { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  ];
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Icon name="leaf" size={18} /></div>
        <div className="brand-text">
          <div className="brand-name">Stillpoint</div>
          <div className="brand-tag">focus, gently</div>
        </div>
      </div>
      <nav className="nav">
        {items.map((it) => (
          <button
            key={it.id}
            className={"nav-item" + (view === it.id ? " is-active" : "")}
            onClick={() => onNav(it.id)}
          >
            <Icon name={it.icon} size={19} />
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="streak-pill">
          <span className="streak-dot" />
          <span><b>{streak}</b>-day streak</span>
        </div>
        <p className="foot-quote">Love yourself first,<br />before you help others.</p>
      </div>
    </aside>
  );
}

// ---------- Progress ring (SVG) ----------
function ProgressRing({ progress, size = 320, stroke = 10, color, track, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="ring-svg">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.4s linear, stroke 0.5s ease" }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

// ---------- Task picker (Who tabs → Task chips) ----------
function TaskPicker({ tasks, selectedKey, onSelect, onManage }) {
  const sel0 = tasks.find((t) => t.key === selectedKey);
  const [who, setWho] = useState(sel0 ? sel0.who : "all");
  const present = LIFE_AREAS.filter((a) => tasks.some((t) => t.who === a.id));
  const list = who === "all" ? tasks : tasks.filter((t) => t.who === who);
  const sel = tasks.find((t) => t.key === selectedKey);

  return (
    <div className="picker">
      <div className="who-tabs">
        <button className={"who-tab" + (who === "all" ? " is-active" : "")} onClick={() => setWho("all")}>All</button>
        {present.map((a) => (
          <button key={a.id} className={"who-tab" + (who === a.id ? " is-active" : "")} onClick={() => setWho(a.id)}>
            <span className="wt-dot" style={{ background: a.color }} />{a.label}
          </button>
        ))}
      </div>
      <div className="chips">
        {list.map((t) => {
          const active = t.key === selectedKey;
          const complete = t.done >= t.target;
          return (
            <button key={t.key} className={"chip task-chip" + (active ? " is-active" : "")} style={{ "--chip": t.color }}
              onClick={() => onSelect(t.goalId, t.taskId)} title={t.goalTitle}>
              <span className="chip-dot" style={{ background: t.color }} />
              <span className="chip-name">{t.name}</span>
              <span className="chip-prog">{t.done}/{t.target}{complete ? " ✓" : ""}</span>
            </button>
          );
        })}
        {list.length === 0 && <span className="picker-empty">No tasks here yet.</span>}
        <button className="chip chip-add" onClick={onManage} title="Add in Goals"><Icon name="plus" size={14} /></button>
      </div>
      {sel && (
        <div className="picker-context">
          <span className="pc-dot" style={{ background: sel.color }} />
          {areaLabel(sel.who)} <span className="pc-sep">›</span> {sel.goalTitle}
        </div>
      )}
    </div>
  );
}

// ---------- Life-area legend ----------
function AreaLegend({ areas }) {
  return (
    <div className="legend">
      {(areas || LIFE_AREAS).map((a) => (
        <span className="legend-item" key={a.id}>
          <span className="legend-dot" style={{ background: a.color }} />
          {a.label}
        </span>
      ))}
    </div>
  );
}

// ---------- Bar charts (div-based, on-brand) ----------
function HBarChart({ data, max, unit }) {
  const top = max || Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="hbars">
      {data.map((d, i) => (
        <div className="hbar-row" key={i}>
          <div className="hbar-label">
            <span className="hbar-dot" style={{ background: d.color }} />
            {d.label}
          </div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: (d.value / top) * 100 + "%", background: d.color }} />
          </div>
          <div className="hbar-val">{d.display != null ? d.display : d.value}{unit}</div>
        </div>
      ))}
    </div>
  );
}

function VBarChart({ data, color }) {
  const top = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="vbars">
      {data.map((d, i) => (
        <div className="vbar-col" key={i}>
          <div className="vbar-track">
            <div
              className="vbar-fill"
              style={{ height: (d.value / top) * 100 + "%", background: d.highlight ? color : "var(--surface-3)" }}
              title={d.value + " min"}
            />
          </div>
          <div className={"vbar-label" + (d.highlight ? " is-today" : "")}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { Icon, Sidebar, ProgressRing, TaskPicker, AreaLegend, HBarChart, VBarChart });
