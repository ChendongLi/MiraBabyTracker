"""Parse natural language baby activity input using Claude."""

import json
import logging
import os
import time
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

    max_retries = 3
    last_error: Exception | None = None

    for attempt in range(max_retries):
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
            logger.error("Claude returned invalid JSON (attempt %d): %s", attempt + 1, e)
            last_error = e
            # Don't retry JSON decode errors — bad output won't improve on retry
            raise HTTPException(status_code=502, detail="AI service returned invalid response") from e
        except anthropic.InternalServerError as e:
            logger.warning("Claude internal server error (attempt %d/%d): %s", attempt + 1, max_retries, e)
            last_error = e
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # exponential backoff: 1s, 2s
                continue
        except anthropic.APIStatusError as e:
            if e.status_code in (529, 503, 502) and attempt < max_retries - 1:
                logger.warning("Claude API status %d (attempt %d/%d), retrying...", e.status_code, attempt + 1, max_retries)
                last_error = e
                time.sleep(2 ** attempt)
                continue
            logger.error("Claude API error: %s", e)
            raise HTTPException(status_code=502, detail="AI service unavailable") from e
        except anthropic.AuthenticationError as e:
            logger.error("Claude auth error, falling back to OpenAI: %s", e)
            try:
                return await _parse_with_openai(request.input, current_time)
            except Exception as fe:
                logger.error("OpenAI fallback also failed: %s", fe)
                raise HTTPException(status_code=502, detail="AI service unavailable") from fe
        except anthropic.APIError as e:
            logger.error("Claude API error: %s", e)
            raise HTTPException(status_code=502, detail="AI service unavailable") from e

    logger.warning("Claude failed after %d attempts, falling back to OpenAI: %s", max_retries, last_error)
    try:
        result = await _parse_with_openai(request.input, current_time)
        logger.info("OpenAI fallback succeeded")
        return result
    except Exception as e:
        logger.error("OpenAI fallback also failed: %s", e)
        raise HTTPException(status_code=502, detail="AI service unavailable") from e
