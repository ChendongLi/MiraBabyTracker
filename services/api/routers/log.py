"""POST /api/log — parse natural language input and store event."""

import logging
import os
from contextlib import contextmanager

import httpx
import psycopg2.extras
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import get_conn, release_conn

logger = logging.getLogger(__name__)
router = APIRouter()

BABY_ID = os.environ.get("BABY_ID", "")


@contextmanager
def db_conn():
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        release_conn(conn)


class LogRequest(BaseModel):
    input: str


class LogResponse(BaseModel):
    confirmation: str
    event_id: str
    event_type: str


CONFIRMATIONS = {
    "zh": {
        "feed": "✅ 已记录喂奶",
        "diaper": "✅ 已记录换尿布",
        "sleep": "✅ 已记录睡眠",
        "outdoor": "✅ 已记录户外活动",
        "bath": "✅ 已记录洗澡",
        "unknown": "⚠️ 未能识别活动，已保存备注",
    },
    "en": {
        "feed": "✅ Feed logged",
        "diaper": "✅ Diaper change logged",
        "sleep": "✅ Sleep logged",
        "outdoor": "✅ Outdoor activity logged",
        "bath": "✅ Bath logged",
        "unknown": "⚠️ Activity unclear, saved as note",
    },
}


@router.post("/api/log", response_model=LogResponse)
async def log_activity(request: LogRequest) -> LogResponse:
    """Parse natural language input and store as structured event."""
    if not request.input.strip():
        raise HTTPException(status_code=400, detail="Input cannot be empty")

    ai_url = os.environ["AI_SERVICE_URL"]

    # Load all of today's events as context for the AI
    today_events = []
    with db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT event_type, started_at, ended_at, duration_minutes, notes, raw_input, created_at
            FROM events
            WHERE baby_id = %s
              AND (created_at AT TIME ZONE 'America/Los_Angeles')::date = CURRENT_DATE AT TIME ZONE 'America/Los_Angeles'
            ORDER BY created_at ASC
            """,
            (BABY_ID,),
        )
        for row in cur.fetchall():
            today_events.append({
                "event_type": row["event_type"],
                "started_at": row["started_at"].isoformat() if row["started_at"] else None,
                "ended_at": row["ended_at"].isoformat() if row["ended_at"] else None,
                "duration_minutes": row["duration_minutes"],
                "notes": row["notes"],
                "raw_input": row["raw_input"],
                "created_at": row["created_at"].isoformat(),
            })

    # Call ai-service to parse input
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                f"{ai_url}/parse",
                json={"input": request.input, "today_events": today_events},
            )
            resp.raise_for_status()
        except httpx.TimeoutException as e:
            logger.error("ai-service timeout: %s", e)
            raise HTTPException(status_code=504, detail="AI service timed out") from e
        except httpx.HTTPStatusError as e:
            logger.error("ai-service error %s: %s", e.response.status_code, e)
            raise HTTPException(status_code=502, detail="AI service error") from e

    parsed = resp.json()
    event_type = parsed.get("event_type", "unknown")
    lang = parsed.get("detected_language", "zh")

    # Insert into DB
    with db_conn() as conn:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        cur.execute(
            """
            INSERT INTO events
                (baby_id, event_type, started_at, ended_at, duration_minutes, raw_input, notes)
            VALUES
                (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                BABY_ID,
                event_type,
                parsed.get("started_at"),
                parsed.get("ended_at"),
                parsed.get("duration_minutes"),
                request.input,
                parsed.get("notes"),
            ),
        )
        event_id = str(cur.fetchone()["id"])

        # Insert detail records if present
        if event_type == "feed" and parsed.get("feed_details"):
            fd = parsed["feed_details"]
            cur.execute(
                "INSERT INTO feed_details (event_id, method, amount_ml) VALUES (%s, %s, %s)",
                (event_id, fd.get("method"), fd.get("amount_ml")),
            )

        if event_type == "diaper" and parsed.get("diaper_details"):
            dd = parsed["diaper_details"]
            cur.execute(
                "INSERT INTO diaper_details (event_id, diaper_type, color) VALUES (%s, %s, %s)",
                (event_id, dd.get("diaper_type"), dd.get("color")),
            )

    confirmation = CONFIRMATIONS.get(lang, CONFIRMATIONS["zh"]).get(
        event_type, CONFIRMATIONS["zh"]["unknown"]
    )

    # Append duration/amount detail to confirmation if available
    if event_type == "sleep" and parsed.get("duration_minutes"):
        hrs, mins = divmod(parsed["duration_minutes"], 60)
        detail = f"{hrs}小时{mins}分钟" if lang == "zh" else f"{hrs}h {mins}m"
        confirmation += f" ({detail})"

    if event_type == "feed" and parsed.get("feed_details", {}) and parsed["feed_details"].get("amount_ml"):
        ml = parsed["feed_details"]["amount_ml"]
        confirmation += f" ({ml}ml)"

    logger.info("Logged event %s type=%s baby=%s", event_id, event_type, BABY_ID)

    return LogResponse(confirmation=confirmation, event_id=event_id, event_type=event_type)
