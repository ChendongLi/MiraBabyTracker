"""POST /api/transcribe — forward audio to ai-service Whisper."""

import logging
import os

import httpx
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024  # 25MB


class TranscribeResponse(BaseModel):
    transcript: str


@router.post("/api/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(file: UploadFile) -> TranscribeResponse:
    """Forward audio file to ai-service for Whisper transcription."""
    audio_bytes = await file.read()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")

    ai_url = os.environ["AI_SERVICE_URL"]

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                f"{ai_url}/transcribe",
                files={"file": (file.filename or "audio.webm", audio_bytes, file.content_type or "audio/webm")},
            )
            resp.raise_for_status()
        except httpx.TimeoutException as e:
            logger.error("ai-service transcribe timeout: %s", e)
            raise HTTPException(status_code=504, detail="Transcription timed out") from e
        except httpx.HTTPStatusError as e:
            logger.error("ai-service transcribe error %s: %s", e.response.status_code, e)
            raise HTTPException(status_code=502, detail="Transcription service error") from e

    return TranscribeResponse(transcript=resp.json()["transcript"])
