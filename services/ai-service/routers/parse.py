"""Parse natural language baby activity input using Claude."""

import json
import logging
import os
from datetime import datetime, timezone

import anthropic
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
- If times are relative (e.g. "just now", "刚才"), use current_time as reference.
- If duration is given without start/end, calculate what you can.
- If input is unclear, set event_type to "unknown" and put best guess in notes.
- detect_language from the dominant language in the input.
"""


class ParseRequest(BaseModel):
    input: str


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
                    "content": f"current_time: {current_time}\n\ninput: {request.input}",
                }
            ],
        )
        raw = message.content[0].text.strip()
        data = json.loads(raw)
        return ParseResponse(**data)
    except json.JSONDecodeError as e:
        logger.error("Claude returned invalid JSON: %s", e)
        raise HTTPException(status_code=502, detail="AI service returned invalid response") from e
    except anthropic.APIError as e:
        logger.error("Claude API error: %s", e)
        raise HTTPException(status_code=502, detail="AI service unavailable") from e
