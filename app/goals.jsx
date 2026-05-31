// goals.jsx — Goals: Who → Goal → Task(25-min bricks)
const { useState: useStateG } = React;

function Bricks({ done, target, color, onSet }) {
  const items = [];
  for (let i = 0; i < target; i++) {
    const filled = i < done;
    items.push(
      <button
        key={i}
        className={"brick" + (filled ? " is-filled" : "")}
        style={filled ? { background: color, borderColor: color } : null}
        title={filled ? "25 min done — click to undo" : "Mark 25 min done"}
        onClick={() => onSet(i + 1 === done ? i : i + 1)}
      />
    );
  }
  return <div className="bricks">{items}</div>;
}

function TaskRow({ goal, task, color, onAdjust, onRemove, onFocus }) {
  const complete = task.done >= task.target;
  return (
    <div className={"task-row" + (complete ? " is-complete" : "")}>
      <div className="task-top">
        <div className="task-name">
          {complete && <span className="task-check" style={{ color }}><Icon name="check" size={14} /></span>}
          {task.name}
        </div>
        <div className="task-meta">
          <span className="task-count">{task.done}<span className="task-of">/{task.target}</span></span>
          <button className="task-focus" onClick={() => onFocus(goal.id, task.id)} title="Focus toward this now">
            Focus <Icon name="arrow" size={14} />
          </button>
          <button className="task-del" onClick={() => onRemove(goal.id, task.id)} title="Remove task"><Icon name="close" size={13} /></button>
        </div>
      </div>
      <Bricks done={task.done} target={task.target} color={color} onSet={(v) => onAdjust(goal.id, task.id, v)} />
    </div>
  );
}

function AddTask({ goalId, onAdd }) {
  const [open, setOpen] = useStateG(false);
  const [name, setName] = useStateG("");
  const [target, setTarget] = useStateG(3);
  const submit = () => { if (name.trim()) onAdd(goalId, name.trim(), target); setName(""); setTarget(3); setOpen(false); };
  if (!open) return <button className="add-task" onClick={() => setOpen(true)}><Icon name="plus" size={14} /> Add a task</button>;
  return (
    <div className="add-task-form">
      <input autoFocus className="at-name" placeholder="e.g. Read together" value={name}
        onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }} />
      <div className="at-target">
        <button onClick={() => setTarget((t) => Math.max(1, t - 1))} aria-label="fewer">−</button>
        <span>{target} × 25m</span>
        <button onClick={() => setTarget((t) => Math.min(20, t + 1))} aria-label="more">+</button>
      </div>
      <button className="at-save" onClick={submit}>Add</button>
    </div>
  );
}

function GoalCard({ goal, onAddTask, onRemoveTask, onAdjustTask, onRemoveGoal, onFocusTask }) {
  const color = areaColor(goal.who);
  const totDone = goal.tasks.reduce((m, t) => m + t.done, 0);
  const totTarget = goal.tasks.reduce((m, t) => m + t.target, 0);
  const pct = totTarget ? Math.round((totDone / totTarget) * 100) : 0;
  const complete = totTarget > 0 && totDone >= totTarget;
  return (
    <section className="goal-card" style={{ "--gc": color }}>
      <header className="goal-head">
        <h3 className="goal-title">{goal.title}</h3>
        <button className="goal-del" onClick={() => onRemoveGoal(goal.id)} title="Remove goal"><Icon name="trash" size={15} /></button>
      </header>
      <div className="goal-progress">
        <div className="goal-bar"><div className="goal-bar-fill" style={{ width: pct + "%", background: color }} /></div>
        <span className="goal-pct" style={complete ? { color } : null}>{complete ? "Complete ✦" : pct + "%"}</span>
      </div>
      <div className="goal-tasks">
        {goal.tasks.map((t) => (
          <TaskRow key={t.id} goal={goal} task={t} color={color} onAdjust={onAdjustTask} onRemove={onRemoveTask} onFocus={onFocusTask} />
        ))}
        {goal.tasks.length === 0 && <p className="goal-empty">Break it into small 25-minute tasks.</p>}
      </div>
      <AddTask goalId={goal.id} onAdd={onAddTask} />
    </section>
  );
}

function NewGoal({ defaultWho, onCreate }) {
  const [open, setOpen] = useStateG(false);
  const [title, setTitle] = useStateG("");
  const submit = () => { if (title.trim()) onCreate(title.trim(), defaultWho); setTitle(""); setOpen(false); };
  if (!open) return (
    <button className="new-goal" onClick={() => setOpen(true)}>
      <span className="ng-plus"><Icon name="plus" size={16} /></span>
      Set a goal
    </button>
  );
  return (
    <div className="new-goal-form">
      <input autoFocus className="ng-title" placeholder="What are you building toward?" value={title}
        onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }} />
      <div className="ng-actions">
        <button className="ng-cancel" onClick={() => setOpen(false)}>Cancel</button>
        <button className="ng-create" onClick={submit}>Create</button>
      </div>
    </div>
  );
}

function GoalsView({ goals, onCreate, onRemoveGoal, onAddTask, onRemoveTask, onAdjustTask, onFocusTask }) {
  const totalBricks = goals.reduce((m, g) => m + g.tasks.reduce((n, t) => n + t.done, 0), 0);
  // group goals by who, preserving LIFE_AREAS order
  const sections = LIFE_AREAS.map((a) => ({ area: a, goals: goals.filter((g) => g.who === a.id) })).filter((s) => s.goals.length > 0);
  // areas with no goals yet still get an "add" affordance at the end
  const emptyAreas = LIFE_AREAS.filter((a) => !goals.some((g) => g.who === a.id));

  return (
    <div className="screen goals-screen">
      <header className="screen-head">
        <div>
          <h1 className="screen-title">What you're building</h1>
          <p className="screen-sub">Sorted by who it's for · big things made of small 25-minute steps · {totalBricks} bricks laid</p>
        </div>
      </header>

      {sections.map((s) => (
        <section className="who-section" key={s.area.id} style={{ "--who": s.area.color }}>
          <div className="who-head">
            <span className="who-dot" style={{ background: s.area.color }} />
            <h2 className="who-label">{s.area.label}</h2>
            <span className="who-line" />
          </div>
          <div className="goal-grid">
            {s.goals.map((g) => (
              <GoalCard key={g.id} goal={g}
                onAddTask={onAddTask} onRemoveTask={onRemoveTask} onAdjustTask={onAdjustTask}
                onRemoveGoal={onRemoveGoal} onFocusTask={onFocusTask} />
            ))}
            <NewGoal defaultWho={s.area.id} onCreate={onCreate} />
          </div>
        </section>
      ))}

      {emptyAreas.length > 0 && (
        <section className="who-section who-empty">
          <div className="who-head">
            <span className="who-dot is-ghost" />
            <h2 className="who-label muted">Start something new</h2>
            <span className="who-line" />
          </div>
          <div className="goal-grid">
            {emptyAreas.map((a) => (
              <div className="new-area-card" key={a.id} style={{ "--who": a.color }}>
                <span className="who-dot" style={{ background: a.color }} />
                <span className="na-label">{a.label}</span>
                <NewGoal defaultWho={a.id} onCreate={onCreate} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

Object.assign(window, { GoalsView });
