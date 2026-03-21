# 啵儿啵儿 (Mira) — Baby Tracker

A conversational baby activity tracker. Type or speak naturally in Chinese or English — the app understands and logs it.

## Architecture

```
Browser
  ↓
[Next.js frontend] (Vercel / localhost:3000)
  ↓ server-side proxy (Next.js API routes)
[api service] (Cloud Run / localhost:8000)  ←→  [Neon Postgres DB]
  ↓ internal HTTP
[ai-service] (Cloud Run / localhost:8001)   ←→  Claude API
                                            ←→  Whisper API
```

## Repo Structure

```
/frontend               → Next.js app
/services
  /api                  → Core API (FastAPI) — CRUD, DB, orchestration
  /ai-service           → AI/NLP service (FastAPI) — Claude + Whisper, stateless
.pre-commit-config.yaml
README.md
```

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- [ngrok](https://ngrok.com) or [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- A [Neon](https://neon.tech) account (free tier)

### 1. Clone and set up pre-commit

```bash
git clone <repo>
cd mira
pip install pre-commit
pre-commit install
```

### 2. Set up ai-service

```bash
cd services/ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and OPENAI_API_KEY
uvicorn main:app --reload --port 8001
```

### 3. Set up api service

```bash
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in DATABASE_URL and AI_SERVICE_URL=http://localhost:8001
uvicorn main:app --reload --port 8000
```

### 4. Apply DB schema

In Neon SQL editor or via psql, run `scripts/schema.sql`.
Then run `scripts/seed.sql` to insert the Mira baby record.

### 5. Set up frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# API_SERVICE_URL=http://localhost:8000
npm run dev
```

### 6. Tunnel for phone testing

```bash
ngrok http 3000
# or: cloudflared tunnel --url http://localhost:3000
```

Open the tunnel URL on your phone.

## Environment Variables

| Service | Variable | Description |
|---------|----------|-------------|
| api | `DATABASE_URL` | Neon Postgres connection string |
| api | `AI_SERVICE_URL` | URL of ai-service (http://localhost:8001 locally) |
| api | `BABY_ID` | Hardcoded baby UUID (from seed) |
| ai-service | `ANTHROPIC_API_KEY` | Claude API key |
| ai-service | `OPENAI_API_KEY` | Whisper API key |
| frontend | `API_SERVICE_URL` | URL of api service (server-side only) |
