'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { logActivity, transcribeAudio, getEvents, type EventRow } from '@/lib/api';
import EventFeed from './EventFeed';

export default function LogTab() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    getEvents().then(setEvents).catch(console.error);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      await logActivity(input.trim());
      setInput('');
      const updated = await getEvents();
      setEvents(updated);
    } catch {
      setError(t('errors.submit_failed'));
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size === 0) { setError(t('errors.no_speech')); return; }
        setLoading(true);
        try {
          const transcript = await transcribeAudio(blob);
          setInput(transcript);
        } catch {
          setError(t('mic.error_network'));
        } finally {
          setLoading(false);
        }
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
    } catch {
      setError(t('mic.error_permission'));
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRecording(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Event feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        <EventFeed events={events} />
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 16px', background: '#fff3f3', color: '#c0392b', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 16px',
          background: '#fff',
          borderTop: '1px solid #e0e0e0',
          flexShrink: 0,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('input.placeholder')}
          disabled={loading || recording}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 24,
            border: '1px solid #ddd',
            fontSize: 15,
            outline: 'none',
          }}
        />
        {/* Mic button */}
        <button
          type="button"
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerLeave={stopRecording}
          disabled={loading}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: 'none',
            background: recording ? '#ff6b6b' : '#f0f0f0',
            fontSize: 20,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          title={recording ? t('mic.recording') : t('mic.start')}
        >
          🎤
        </button>
        {/* Send button */}
        <button
          type="submit"
          disabled={!input.trim() || loading}
          style={{
            padding: '0 18px',
            height: 44,
            borderRadius: 24,
            border: 'none',
            background: input.trim() && !loading ? '#ff6b6b' : '#ddd',
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: input.trim() && !loading ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {loading ? '…' : t('input.submit')}
        </button>
      </form>
    </div>
  );
}
