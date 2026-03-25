export interface LogResponse {
  confirmation: string;
  event_id: string;
  event_type: string;
}

export interface EventRow {
  id: string;
  event_type: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  raw_input: string | null;
  notes: string | null;
  created_at: string;
  feed_method: string | null;
  feed_amount_ml: number | null;
  diaper_type: string | null;
  diaper_color: string | null;
}

export interface SummaryResponse {
  date: string;
  total_sleep_minutes: number;
  sleep_count: number;
  feed_count: number;
  total_feed_ml: number;
  diaper_count: number;
  last_feed_at: string | null;
  last_sleep_at: string | null;
  last_sleep_end_at: string | null;
  last_diaper_at: string | null;
}

export async function logActivity(input: string): Promise<LogResponse> {
  const res = await fetch('/api/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`Log failed: ${res.status}`);
  return res.json();
}

export async function transcribeAudio(blob: Blob, filename = 'audio.webm'): Promise<string> {
  const form = new FormData();
  form.append('file', blob, filename);
  const res = await fetch('/api/transcribe', { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Transcribe failed: ${res.status}`);
  const data = await res.json();
  return data.transcript;
}

export async function getEvents(limit = 50): Promise<EventRow[]> {
  const res = await fetch(`/api/events?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function getSummary(date?: string): Promise<SummaryResponse> {
  const params = date ? `?date=${date}` : '';
  const res = await fetch(`/api/summary${params}`);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function getWeekEvents(): Promise<EventRow[]> {
  const res = await fetch('/api/events/week');
  if (!res.ok) throw new Error('Failed to fetch week events');
  return res.json();
}
