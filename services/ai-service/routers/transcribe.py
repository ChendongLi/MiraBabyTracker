"""Transcribe audio to text using OpenAI Whisper or Deepgram Nova-2."""

import logging
import os

import openai
import httpx
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024  # 25MB


class TranscribeResponse(BaseModel):
    transcript: str


async def _transcribe_whisper(audio_bytes: bytes, filename: str, content_type: str) -> str:
    client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    audio_file = (filename or "audio.webm", audio_bytes, content_type or "audio/webm")
    result = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
    )
    return result.text.strip()


async def _transcribe_deepgram(audio_bytes: bytes, content_type: str) -> str:
    api_key = os.environ.get("DEEPGRAM_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="Deepgram API key not configured")

    # Nova-2 with multi-language detection (Chinese + English)
    url = "https://api.deepgram.com/v1/listen?model=nova-2&detect_language=true&smart_format=true"
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": content_type or "audio/webm",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(url, headers=headers, content=audio_bytes)
        if resp.status_code != 200:
            logger.error("Deepgram error: %s %s", resp.status_code, resp.text)
            raise HTTPException(status_code=502, detail="Deepgram transcription failed")
        data = resp.json()

    try:
        transcript = data["results"]["channels"][0]["alternatives"][0]["transcript"]
        return transcript.strip()
    except (KeyError, IndexError) as e:
        logger.error("Unexpected Deepgram response: %s", data)
        raise HTTPException(status_code=502, detail="Unexpected Deepgram response") from e


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(file: UploadFile, provider: str = "whisper") -> TranscribeResponse:
    """Transcribe audio. provider= 'whisper' | 'deepgram'"""
    audio_bytes = await file.read()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")
    if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")

    content_type = file.content_type or "audio/webm"
    filename = file.filename or "audio.webm"

    if provider == "deepgram":
        try:
            transcript = await _transcribe_deepgram(audio_bytes, content_type)
        except Exception as e:
            logger.warning("Deepgram failed (%s), falling back to Whisper: %s", type(e).__name__, e)
            try:
                transcript = await _transcribe_whisper(audio_bytes, filename, content_type)
            except Exception as fe:
                logger.error("Whisper fallback also failed: %s", fe)
                raise HTTPException(status_code=502, detail="Transcription service unavailable") from fe
    else:
        try:
            transcript = await _transcribe_whisper(audio_bytes, filename, content_type)
        except Exception as e:
            logger.error("Whisper error: %s", e)
            raise HTTPException(status_code=502, detail="Transcription service unavailable") from e

    if not transcript:
        raise HTTPException(status_code=422, detail="No speech detected in audio")

    return TranscribeResponse(transcript=transcript)
