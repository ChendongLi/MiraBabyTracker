"""ai-service: Stateless AI/NLP processing service.

Responsibilities:
- Parse natural language baby activity input via Claude
- Transcribe audio via Whisper
No database access. No side effects.
"""

import logging

from fastapi import FastAPI

from routers import parse, transcribe

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="ai-service", version="0.1.0")

app.include_router(parse.router)
app.include_router(transcribe.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "ai-service"}
