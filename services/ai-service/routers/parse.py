"""Parse natural language baby activity input using Claude."""

import json
import logging
import os
from datetime import datetime, timezone

import anthropic
import openai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

SYSTEM_PROMPT = """You are a baby activity log parser. Extract structured data from natural language input in Chinese or English.

Return ONLY valid JSON — no prose, no markdown, no explanation.

Schema:
{
  "event_type": "feed" | "diaper" | "sleep" | "outdoor" | "bath" | "unknown",
  "started_at": "ISO8601 datetime string or null",
  "ended_at": "ISO8601 datetime string or null",
  "duration_minutes": integer or null,
  "notes": "string or null",
  "detected_language": "zh" | "en",
  "feed_details": { "method": "breast" | "bottle" | "solid", "amount_ml": integer } or null,
  "diaper_details": { "diaper_type": "wet" | "soiled" | "mixed", "color": "string or null" } or null
}

Rules:
- current_time is provided in UTC. The user is in Pacific Time (UTC-7 or UTC-8, use UTC-7 for now).
- If times are relative (e.g. "just now", "刚才"), use current_time as reference.
- If the user says "last night" or "昨晚", the date is yesterday (Pacific Time). Morning times (e.g. "9am") are today.
- For sleep with both start and end: set started_at, ended_at, and compute duration_minutes = (ended_at - started_at) in minutes.
- If only start is given, set started_at only. If only end is given, set ended_at only.
- If only duration is given (e.g. "slept 2 hours"), set duration_minutes only.
- IMPORTANT: If last_open_sleep_started_at is provided in context AND the input describes waking up or sleep ending, set started_at = last_open_sleep_started_at and compute duration_minutes = (wake_time - last_open_sleep_started_at) in minutes. Do NOT guess a start time.
- For all times, convert to UTC ISO8601 (e.g. "11pm PT last night" = yesterday 06:00 UTC).
- If input is unclear, set event_type to "unknown" and put best guess in notes.
- For diapers: default diaper_type to "wet" unless poo/soiled/stinky is explicitly mentioned, then use "soiled". Use "mixed" only if both are mentioned.
- detect_language from the dominant language in the input.
"""


class ParseRequest(BaseModel):
    input: str
    last_open_sleep_started_at: str | None = None


class FeedDetails(BaseModel):
    method: str | None = None
    amount_ml: int | None = None


class DiaperDetails(BaseModel):
    diaper_type: str | None = None
    color: str | None = None


class ParseResponse(BaseModel):
    event_type: str
    started_at: str | None = None
    ended_at: str | None = None
    duration_minutes: int | None = None
    notes: str | None = None
    detected_language: str
    feed_details: FeedDetails | None = None
    diaper_details: DiaperDetails | None = None



async def _parse_with_openai(input_text: str, current_time: str) -> ParseResponse:
    """Fallback parser using OpenAI GPT-4o-mini."""
    client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=512,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"current_time: {current_time}\n\ninput: {input_text}"},
        ],
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content.strip()
    data = json.loads(raw)
    return ParseResponse(**data)


@router.post("/parse", response_model=ParseResponse)
async def parse_activity(request: ParseRequest) -> ParseResponse:
    """Parse natural language input into structured baby activity data."""
    if not request.input.strip():
        raise HTTPException(status_code=400, detail="Input cannot be empty")

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    current_time = datetime.now(timezone.utc).isoformat()

    try:
        message = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=512,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": f"current_time: {current_time}\nlast_open_sleep_started_at: {request.last_open_sleep_started_at or 'none'}\n\ninput: {request.input}",
                }
            ],
        )
        raw = message.content[0].text.strip()
        data = json.loads(raw)
        return ParseResponse(**data)
    except Exception as e:
        logger.warning("Claude failed (%s), falling back to OpenAI: %s", type(e).__name__, e)
        try:
            result = await _parse_with_openai(request.input, current_time)
            logger.info("OpenAI fallback succeeded")
            return result
        except Exception as fe:
            logger.error("OpenAI fallback also failed: %s", fe)
            raise HTTPException(status_code=502, detail="AI service unavailable") from fe
