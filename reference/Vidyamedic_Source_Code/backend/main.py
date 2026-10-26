"""VIDYAMEDIC demo REST API. All vital readings are SYNTHETIC; no clinical diagnosis."""
from __future__ import annotations

import csv
import io
import math
import os
import random
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE = Path(__file__).resolve().parent
WEB = BASE.parent / "web"
DB_PATH = Path(os.environ.get("VIDYAMEDIC_DB", str(BASE / "vidyamedic-demo.sqlite3")))
TZ = timezone(timedelta(hours=7))
DEMO_DATE = datetime(2026, 10, 25, 0, 0, tzinfo=TZ)
SAFETY = "Data sintetis. Bukan diagnosis atau pengganti tenaga kesehatan."

app = FastAPI(title="Vidyamedic Demo API", version="1.0.0", description=SAFETY)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"], allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

@contextmanager
def db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        con.execute("CREATE TABLE IF NOT EXISTS checkins (id INTEGER PRIMARY KEY, event_id TEXT NOT NULL, context TEXT NOT NULL, symptoms TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL)")
        con.execute("CREATE TABLE IF NOT EXISTS actions (action_id TEXT PRIMARY KEY, status TEXT NOT NULL, updated_at TEXT NOT NULL)")
        con.commit()
        yield con
    finally:
        con.close()

def latest_context():
    with db() as con:
        row = con.execute("SELECT context, symptoms, note, created_at FROM checkins WHERE event_id='evt-1425' ORDER BY id DESC LIMIT 1").fetchone()
        return dict(row) if row else None

class Checkin(BaseModel):
    event_id: Literal["evt-1425"] = "evt-1425"
    context: Literal["Istirahat / duduk tenang", "Baru selesai berjalan / naik tangga", "Sedang fokus / stres mental", "Aktivitas rumah tangga", "Konteks belum dapat dipastikan"]
    symptoms: Literal["Tidak ada", "Ada keluhan", "Tidak tahu"] = "Tidak tahu"
    note: str = Field(default="", max_length=240)

class Question(BaseModel):
    message: str = Field(min_length=1, max_length=500)

class Action(BaseModel):
    status: Literal["done"] = "done"

# Deterministic, synthetic time-series independent of patient data.
def generate_series():
    rng = random.Random(2106)
    rows = []
    for m in range(0, 24 * 60, 10):
        h = m // 60
        baseline = 70 + (7 if 8 <= h < 12 else 0) + (15 if 12 <= h < 13 else 0) + (5 if 17 <= h < 20 else 0)
        spike = 31 * math.exp(-0.5 * ((m - 865) / 17) ** 2)
        hr = round(baseline + 3 * math.sin(m / 55) + spike + rng.uniform(-2.5, 2.5))
        rmssd = max(18, round(47 - (hr - 65) * .45 + rng.uniform(-4, 4)))
        activity = "Berjalan" if (8 <= h < 9 or 12 <= h < 13) else "Duduk / istirahat" if h < 8 or h >= 20 else "Aktivitas ringan / bekerja"
        rows.append({"timestamp": (DEMO_DATE + timedelta(minutes=m)).isoformat(), "label": f"{h:02d}:{m % 60:02d}", "hr": hr, "expected": baseline, "rmssd": rmssd, "activity": activity, "quality": 0.97, "origin": "SYNTHETIC_DEMO"})
    rows.append({"timestamp": (DEMO_DATE + timedelta(minutes=865)).isoformat(), "label": "14:25", "hr": 110, "expected": 75, "rmssd": 26, "activity": "Konteks belum diklarifikasi", "quality": 0.96, "origin": "SYNTHETIC_DEMO"})
    rows.sort(key=lambda item: item["timestamp"])
    return rows

SERIES = generate_series()

@app.get("/api/health")
def health():
    return {"service": "vidyamedic-api", "ok": True, "mode": "SYNTHETIC_DEMO", "version": "1.0.0"}

@app.get("/api/dashboard")
def dashboard():
    context = latest_context()
    contextual_ranges = {
        "Istirahat / duduk tenang": "68–82",
        "Baru selesai berjalan / naik tangga": "92–117",
        "Sedang fokus / stres mental": "76–98",
        "Aktivitas rumah tangga": "tidak cukup bukti",
        "Konteks belum dapat dipastikan": "tidak cukup bukti",
    }
    return {
        "demo": True, "as_of": "2026-10-25T09:20:00+07:00", "subject": "Alya Putri (profil fiktif)",
        "vitals": {"hr_bpm": 76, "rmssd_ms": 39, "rr_ms": 789, "steps": 6240, "data_quality_pct": 97},
        "summary": {"episodes": 2, "unresolved": 0 if context else 1, "recovery_episodes": 1, "monitoring_days": 14},
        "last_event": {"id": "evt-1425", "time": "14:25", "observed_hr_bpm": 110, "resting_expected_bpm": "68–82", "status": "context_reviewed" if context else "needs_context", "context": context["context"] if context else "Istirahat (belum diverifikasi)", "expected_for_reported_context": contextual_ranges.get(context["context"], "tidak ditetapkan") if context else None, "provisional_assessment": "reported_activity_may_explain_hr_requires_review" if context and context["context"] == "Baru selesai berjalan / naik tangga" else "insufficient_evidence_for_clinical_status"},
        "series": SERIES,
        "disclaimer": SAFETY,
    }

@app.get("/api/profile")
def profile():
    return {"id": "VM-DEMO-0001", "name": "Alya Putri", "synthetic": True, "age": 40, "consent": "demonstration_only", "baseline_maturity": "illustrative_not_validated", "baseline": [
        {"context": "Istirahat / duduk", "hr_min": 68, "hr_max": 82, "rmssd_min": 32, "rmssd_max": 48, "evidence": "simulasi"},
        {"context": "Berjalan", "hr_min": 92, "hr_max": 117, "rmssd_min": 22, "rmssd_max": 35, "evidence": "simulasi"},
        {"context": "Fokus / kerja", "hr_min": 76, "hr_max": 98, "rmssd_min": 25, "rmssd_max": 40, "evidence": "terbatas"},
        {"context": "Setelah aktivitas", "hr_min": 75, "hr_max": 102, "rmssd_min": 28, "rmssd_max": 44, "evidence": "terbatas"},
    ], "goals": ["Mengenal pola fisiologis", "Pemantauan recovery"], "disclaimer": SAFETY}

@app.get("/api/monitoring")
def monitoring():
    return {"series": SERIES, "quality": {"valid_pct": 97, "missing_pct": 3, "has_ibi": True}, "context": latest_context(), "disclaimer": SAFETY}

@app.get("/api/bi")
def bi(days: int = 7):
    if days not in (7, 30, 90):
        raise HTTPException(422, "days harus 7, 30, atau 90")
    rng = random.Random(1000 + days)
    trends = []
    for n in range(min(days, 30)):
        trends.append({"index": n + 1, "mean_hr": rng.randint(72, 84), "recovery_minutes": rng.randint(9, 21), "quality_pct": rng.randint(93, 99)})
    return {"period_days": days, "trends": trends, "metrics": {"average_hr": round(sum(x["mean_hr"] for x in trends) / len(trends), 1), "episodes": 2 if days <= 7 else 7 if days <= 30 else 19, "average_recovery_minutes": round(sum(x["recovery_minutes"] for x in trends) / len(trends), 1), "quality_pct": 97}, "activity_distribution": [{"context": "Istirahat / duduk", "percent": 48}, {"context": "Bekerja / fokus", "percent": 29}, {"context": "Berjalan", "percent": 16}, {"context": "Lainnya", "percent": 7}], "disclaimer": SAFETY}

@app.get("/api/ai/insights")
def insights():
    context = latest_context()
    verified = bool(context)
    return {"engine": "explainable_rules_demo_v1", "is_llm": False, "observed": "HR mencapai 110 bpm sekitar 14:25 dalam data simulasi.", "interpretation": "Konteks telah dilaporkan; signifikansi fisiologis belum terverifikasi." if verified else "Kandidat deviasi terhadap label awal istirahat; konteks belum dikonfirmasi.", "context": context["context"] if verified else "belum diketahui", "confidence": "insufficient_clinical_evidence", "recovery": "Belum dapat menetapkan pemulihan penuh hanya dari episode ilustratif.", "recommendations": ["Verifikasi konteks aktivitas dan gejala", "Periksa kualitas sensor", "Tinjau tren setelah aktivitas"], "disclaimer": SAFETY}

@app.get("/api/recommendations")
def recommendations():
    with db() as con:
        actions = {r["action_id"]: r["status"] for r in con.execute("SELECT action_id, status FROM actions")}
    return {"items": [
        {"id": "verify-context", "title": "Konfirmasi aktivitas saat episode 14:25", "description": "Tinjau aktivitas sebelumnya dan laporan gejala.", "status": "done" if latest_context() else "pending", "priority": "review"},
        {"id": "review-recovery", "title": "Periksa tren setelah istirahat", "description": "Tinjau apakah pengukuran kembali sesuai rentang personal.", "status": actions.get("review-recovery", "pending"), "priority": "routine"},
        {"id": "sensor-quality", "title": "Validasi kualitas data wearable", "description": "Periksa RR/IBI, sinkronisasi, dan kelengkapan data.", "status": actions.get("sensor-quality", "pending"), "priority": "routine"},
    ], "disclaimer": SAFETY}

@app.post("/api/checkins", status_code=201)
def checkin(payload: Checkin):
    with db() as con:
        cur = con.execute("INSERT INTO checkins(event_id,context,symptoms,note,created_at) VALUES(?,?,?,?,?)", (payload.event_id, payload.context, payload.symptoms, payload.note, datetime.now(TZ).isoformat()))
        con.commit()
    return {"saved": True, "id": cur.lastrowid, "interpretation": "context_updated_review_required", "message": "Konteks tercatat. Interpretasi memerlukan evaluasi ulang; bukan diagnosis."}

@app.post("/api/recommendations/{action_id}/complete")
def complete(action_id: str, payload: Action):
    if action_id not in {"review-recovery", "sensor-quality"}:
        raise HTTPException(404, "Tindakan tidak ditemukan atau memerlukan check-in")
    with db() as con:
        con.execute("INSERT INTO actions(action_id,status,updated_at) VALUES(?,?,?) ON CONFLICT(action_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at", (action_id, payload.status, datetime.now(TZ).isoformat()))
        con.commit()
    return {"saved": True, "action_id": action_id, "status": payload.status}

@app.post("/api/ai/chat")
def chat(payload: Question):
    q = payload.message.lower()
    if any(w in q for w in ("nyeri dada", "sesak berat", "pingsan", "tidak sadar")):
        answer = "Jika ada nyeri dada, sesak berat, pingsan, atau gejala berat lain, segera cari pertolongan medis darurat. Jangan menunggu evaluasi wearable."
    elif any(w in q for w in ("pulih", "recovery", "sembuh")):
        answer = "Pada data sintetis ini, status pemulihan penuh belum dapat dipastikan. Diperlukan lintasan setelah episode, kualitas sensor memadai, dan konteks terverifikasi."
    elif any(w in q for w in ("mengapa", "kenapa", "hr", "naik", "penyebab")):
        answer = "Dalam contoh sintetis, HR sempat mencapai 110 bpm dengan label awal 'istirahat'. Aktivitas sebelumnya, stres, atau artefak sensor mungkin memengaruhi hasil. Konfirmasi konteks diperlukan sebelum penafsiran lebih lanjut."
    elif any(w in q for w in ("lakukan", "saran", "rekomendasi", "tindakan")):
        answer = "Periksa pemasangan perangkat, isi klarifikasi aktivitas dan gejala, lalu tinjau pola berikutnya. Konsultasikan perubahan menetap atau berulang kepada tenaga kesehatan."
    else:
        answer = "Saya adalah demo penjelasan berbasis aturan, bukan model bahasa atau diagnosis medis. Tanyakan tentang perubahan HR, konteks, pemulihan, dan tindakan pemantauan."
    return {"answer": answer, "engine": "rule_based_demo_not_llm", "sources": ["synthetic-demo-profile", "synthetic-demo-time-series"], "disclaimer": SAFETY}

@app.get("/api/admin/status")
def admin():
    return {"device": "simulated-wearable", "connected": True, "provider": "synthetic_data_generator", "consent": "demo-only", "audit_enabled": False, "authentication_enabled": False, "model": "rule_based_demo_v1", "security_warning": "Tidak untuk data pasien/produksi. Belum ada autentikasi, otorisasi, enkripsi aplikasi, atau audit medis."}

@app.get("/api/reports/export.csv")
def export_csv():
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(SERIES[0].keys()))
    writer.writeheader()
    writer.writerows(SERIES)
    return StreamingResponse(iter([out.getvalue()]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": 'attachment; filename="Vidyamedic_Synthetic_Wearable.csv"'})

if WEB.exists():
    app.mount("/", StaticFiles(directory=str(WEB), html=True), name="web")
