from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

DB_PATH = "focus_timer.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS subjects (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
            duration   INTEGER NOT NULL DEFAULT 25,
            created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%S', 'now', 'localtime'))
        );
    """)
    if conn.execute("SELECT COUNT(*) FROM subjects").fetchone()[0] == 0:
        for name in ["Work", "Reading", "Exercise", "Study"]:
            conn.execute("INSERT INTO subjects (name) VALUES (?)", (name,))
    conn.commit()
    conn.close()


# ── Subjects ──────────────────────────────────────────────────────────────────

@app.route("/subjects", methods=["GET"])
def get_subjects():
    conn = get_db()
    rows = conn.execute("SELECT id, name FROM subjects ORDER BY name").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/subjects", methods=["POST"])
def create_subject():
    name = (request.json or {}).get("name", "").strip()
    if not name:
        return jsonify({"error": "Name required"}), 400
    conn = get_db()
    try:
        cur = conn.execute("INSERT INTO subjects (name) VALUES (?)", (name,))
        conn.commit()
        row = conn.execute("SELECT id, name FROM subjects WHERE id = ?", (cur.lastrowid,)).fetchone()
        conn.close()
        return jsonify(dict(row)), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Subject already exists"}), 409


@app.route("/subjects/<int:id>", methods=["DELETE"])
def delete_subject(id):
    conn = get_db()
    conn.execute("DELETE FROM subjects WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ── Sessions ──────────────────────────────────────────────────────────────────

@app.route("/sessions", methods=["GET"])
def get_sessions():
    subject_id = request.args.get("subject_id")
    range_ = request.args.get("range", "all")

    conditions, params = [], []

    if subject_id:
        conditions.append("s.subject_id = ?")
        params.append(subject_id)

    now = datetime.now()
    if range_ == "week":
        from_dt = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        conditions.append("s.created_at >= ?")
        params.append(from_dt.strftime("%Y-%m-%dT%H:%M:%S"))
    elif range_ == "month":
        from_dt = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        conditions.append("s.created_at >= ?")
        params.append(from_dt.strftime("%Y-%m-%dT%H:%M:%S"))

    where = "WHERE " + " AND ".join(conditions) if conditions else ""

    conn = get_db()
    rows = conn.execute(f"""
        SELECT s.id, s.subject_id, sub.name AS subject_name, s.duration, s.created_at
        FROM sessions s
        LEFT JOIN subjects sub ON s.subject_id = sub.id
        {where}
        ORDER BY s.created_at DESC
    """, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/sessions", methods=["POST"])
def create_session():
    data = request.json or {}
    subject_id = data.get("subject_id")
    duration = data.get("duration", 25)

    conn = get_db()
    cur = conn.execute(
        "INSERT INTO sessions (subject_id, duration) VALUES (?, ?)",
        (subject_id, duration),
    )
    conn.commit()
    row = conn.execute("""
        SELECT s.id, s.subject_id, sub.name AS subject_name, s.duration, s.created_at
        FROM sessions s
        LEFT JOIN subjects sub ON s.subject_id = sub.id
        WHERE s.id = ?
    """, (cur.lastrowid,)).fetchone()
    conn.close()
    return jsonify(dict(row)), 201


@app.route("/sessions/<int:id>", methods=["DELETE"])
def delete_session(id):
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return jsonify({"success": True})


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.route("/stats", methods=["GET"])
def get_stats():
    conn = get_db()
    rows = conn.execute("""
        SELECT s.*, sub.name AS subject_name
        FROM sessions s
        LEFT JOIN subjects sub ON s.subject_id = sub.id
    """).fetchall()
    conn.close()
    sessions = [dict(r) for r in rows]

    now = datetime.now()

    # Streak: consecutive days with at least one session
    day_set = set()
    for s in sessions:
        try:
            d = datetime.fromisoformat(s["created_at"]).date()
            day_set.add(d)
        except (ValueError, TypeError):
            pass

    streak, cursor = 0, now.date()
    if cursor not in day_set:
        cursor -= timedelta(days=1)
    while cursor in day_set:
        streak += 1
        cursor -= timedelta(days=1)

    # Totals
    total_min = sum(s["duration"] for s in sessions)
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)

    sessions_this_week = sum(
        1 for s in sessions
        if datetime.fromisoformat(s["created_at"]) >= week_start
    )

    # By subject
    sub_map = {}
    for s in sessions:
        name = s["subject_name"] or "Other"
        sub_map[name] = sub_map.get(name, 0) + s["duration"]
    by_subject = sorted(
        [{"name": k, "minutes": v} for k, v in sub_map.items()],
        key=lambda x: -x["minutes"],
    )

    # By weekday (this week only)
    wds = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    by_weekday = {d: 0 for d in wds}
    for s in sessions:
        try:
            dt = datetime.fromisoformat(s["created_at"])
            if dt >= week_start:
                by_weekday[wds[dt.weekday()]] += s["duration"]
        except (ValueError, TypeError):
            pass

    return jsonify({
        "streak": streak,
        "total_hours": round(total_min / 60, 1),
        "sessions_this_week": sessions_this_week,
        "by_subject": by_subject,
        "by_weekday": by_weekday,
    })


if __name__ == "__main__":
    init_db()
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_ENV") != "production")
