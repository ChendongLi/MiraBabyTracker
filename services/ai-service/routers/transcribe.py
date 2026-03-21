"""Transcribe audio to text using OpenAI Whisper."""

import logging
import os

import openai
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024  # 25MB — Whisper API limit


class TranscribeResponse(BaseModel):
    transcript: str


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(file: UploadFile) -> TranscribeResponse:
    """Transcribe audio file to text. Supports Mandarin, English, and mixed."""
    audio_bytes = await file.read()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")

    client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    try:
        # Use a tuple to pass filename + bytes to Whisper
        audio_file = (file.filename or "audio.webm", audio_bytes, file.content_type or "audio/webm")
        result = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            # No language param — let Whisper auto-detect (handles zh/en code-switching)
        )
        transcript = result.text.strip()

        if not transcript:
            raise HTTPException(status_code=422, detail="No speech detected in audio")

        return TranscribeResponse(transcript=transcript)

    except openai.APITimeoutError as e:
        logger.error("Whisper API timeout: %s", e)
        raise HTTPException(status_code=504, detail="Transcription timed out") from e
    except openai.APIError as e:
        logger.error("Whisper API error: %s", e)
        raise HTTPException(status_code=502, detail="Transcription service unavailable") from e
