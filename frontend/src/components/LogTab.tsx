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
  const [confirmation, setConfirmation] = useState<string | null>(null);
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
      const result = await logActivity(input.trim());
      setInput('');
      setConfirmation(result.confirmation || '✅ 已记录');
      setTimeout(() => setConfirmation(null), 3000);
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
      // iOS Safari only supports audio/mp4; fall back gracefully
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        if (blob.size === 0) { setError(t('errors.no_speech')); return; }
        setLoading(true);
        try {
          const transcript = await transcribeAudio(blob, `audio.${ext}`);
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

      {/* Confirmation */}
      {confirmation && (
        <div style={{ padding: '10px 16px', background: '#f0fff4', color: '#27ae60', fontSize: 15, fontWeight: 500, textAlign: 'center' }}>
          {confirmation}
        </div>
      )}

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          padding: '14px 16px 20px',
          background: '#fff',
          borderTop: '1px solid #e0e0e0',
          flexShrink: 0,
        }}
      >
        {/* Textarea — large, multiline */}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
          placeholder={t('input.placeholder')}
          disabled={loading || recording}
          rows={3}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 16,
            border: '1.5px solid #ddd',
            fontSize: 16,
            lineHeight: 1.5,
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit',
            background: loading || recording ? '#fafafa' : '#fff',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#ff6b6b')}
          onBlur={(e) => (e.target.style.borderColor = '#ddd')}
        />

        {/* Button row */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Mic button */}
          <button
            type="button"
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            disabled={loading}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              border: 'none',
              background: recording ? '#ff6b6b' : '#f0f0f0',
              fontSize: 22,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.15s',
              boxShadow: recording ? '0 0 0 4px rgba(255,107,107,0.25)' : 'none',
            }}
            title={recording ? t('mic.recording') : t('mic.start')}
          >
            🎤
          </button>

          {/* Send button — fills remaining space */}
          <button
            type="submit"
            disabled={!input.trim() || loading}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 16,
              border: 'none',
              background: input.trim() && !loading ? '#ff6b6b' : '#e0e0e0',
              color: '#fff',
              fontSize: 17,
              fontWeight: 600,
              cursor: input.trim() && !loading ? 'pointer' : 'default',
              transition: 'background 0.15s',
              letterSpacing: 0.3,
            }}
          >
            {loading ? '…' : t('input.submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
