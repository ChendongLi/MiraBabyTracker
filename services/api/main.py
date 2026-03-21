"""api service: Core API — CRUD, database, orchestration.

Responsibilities:
- Receive log/transcribe requests from Next.js proxy
- Call ai-service for NLP parsing and audio transcription
- Persist events to Neon Postgres
- Serve event history and summary data
"""

import logging

from fastapi import FastAPI

from routers import events, log, transcribe

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="api", version="0.1.0")

app.include_router(log.router)
app.include_router(transcribe.router)
app.include_router(events.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "api"}
