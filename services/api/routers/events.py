"""GET /api/events and /api/summary — read event history."""

import logging
import os
from datetime import date, datetime, timezone

import psycopg2.extras
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db import get_conn, release_conn

logger = logging.getLogger(__name__)
router = APIRouter()

BABY_ID = os.environ.get("BABY_ID", "")


class EventRow(BaseModel):
    id: str
    event_type: str
    started_at: datetime | None
    ended_at: datetime | None
    duration_minutes: int | None
    raw_input: str | None
    notes: str | None
    created_at: datetime
    feed_method: str | None = None
    feed_amount_ml: int | None = None
    diaper_type: str | None = None
    diaper_color: str | None = None


class SummaryResponse(BaseModel):
    date: str
    total_sleep_minutes: int
    feed_count: int
    total_feed_ml: int
    diaper_count: int
    last_feed_at: datetime | None
    last_sleep_end_at: datetime | None
    last_diaper_at: datetime | None


@router.get("/api/events", response_model=list[EventRow])
async def get_events(limit: int = Query(default=50, le=200)) -> list[EventRow]:
    """Return most recent events for the baby."""
    conn = get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT
                e.id, e.event_type, e.started_at, e.ended_at,
                e.duration_minutes, e.raw_input, e.notes, e.created_at,
                fd.method AS feed_method, fd.amount_ml AS feed_amount_ml,
                dd.diaper_type, dd.color AS diaper_color
            FROM events e
            LEFT JOIN feed_details fd ON fd.event_id = e.id
            LEFT JOIN diaper_details dd ON dd.event_id = e.id
            WHERE e.baby_id = %s
            ORDER BY e.created_at DESC
            LIMIT %s
            """,
            (BABY_ID, limit),
        )
        rows = cur.fetchall()
        return [EventRow(id=str(r["id"]), **{k: v for k, v in r.items() if k != "id"}) for r in rows]
    finally:
        release_conn(conn)


@router.get("/api/summary", response_model=SummaryResponse)
async def get_summary(date_str: str = Query(default=None, alias="date")) -> SummaryResponse:
    """Return daily aggregates for charts."""
    target_date = date_str or date.today().isoformat()

    conn = get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT
                COALESCE(SUM(CASE WHEN event_type = 'sleep' THEN duration_minutes ELSE 0 END), 0) AS total_sleep_minutes,
                COUNT(CASE WHEN event_type = 'feed' THEN 1 END) AS feed_count,
                COALESCE(SUM(CASE WHEN event_type = 'feed' THEN fd.amount_ml ELSE 0 END), 0) AS total_feed_ml,
                COUNT(CASE WHEN event_type = 'diaper' THEN 1 END) AS diaper_count,
                MAX(CASE WHEN event_type = 'feed' THEN e.created_at END) AS last_feed_at,
                MAX(CASE WHEN event_type = 'sleep' THEN e.ended_at END) AS last_sleep_end_at,
                MAX(CASE WHEN event_type = 'diaper' THEN e.created_at END) AS last_diaper_at
            FROM events e
            LEFT JOIN feed_details fd ON fd.event_id = e.id
            WHERE e.baby_id = %s
              AND DATE(e.created_at) = %s::date
            """,
            (BABY_ID, target_date),
        )
        row = cur.fetchone()
        return SummaryResponse(date=target_date, **row)
    finally:
        release_conn(conn)


@router.get("/api/events/week", response_model=list[EventRow])
async def get_week_events() -> list[EventRow]:
    """Return last 7 days of events for chart rendering."""
    conn = get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT
                e.id, e.event_type, e.started_at, e.ended_at,
                e.duration_minutes, e.raw_input, e.notes, e.created_at,
                fd.method AS feed_method, fd.amount_ml AS feed_amount_ml,
                dd.diaper_type, dd.color AS diaper_color
            FROM events e
            LEFT JOIN feed_details fd ON fd.event_id = e.id
            LEFT JOIN diaper_details dd ON dd.event_id = e.id
            WHERE e.baby_id = %s
              AND e.created_at >= NOW() - INTERVAL '7 days'
            ORDER BY e.created_at DESC
            """,
            (BABY_ID,),
        )
        rows = cur.fetchall()
        return [EventRow(id=str(r["id"]), **{k: v for k, v in r.items() if k != "id"}) for r in rows]
    finally:
        release_conn(conn)
