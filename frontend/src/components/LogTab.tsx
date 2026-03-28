'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { logActivity, transcribeAudio, getEvents, type EventRow } from '@/lib/api';
import EventFeed from './EventFeed';

interface Props { initialEvents?: EventRow[]; }

export default function LogTab({ initialEvents = [] }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
          const transcript = await transcribeAudio(blob, `audio.${ext}`, 'deepgram');
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
    <>
      <style>{`@keyframes pulse-ring{0%{transform:scale(1);opacity:0.6}100%{transform:scale(1.7);opacity:0}}`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Event feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        <EventFeed events={events} />
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 16px', background: '#fff3f3', color: '#c0392b', fontSize: 23 }}>
          {error}
        </div>
      )}

      {/* Confirmation */}
      {confirmation && (
        <div style={{ padding: '10px 16px', background: '#f0fff4', color: '#27ae60', fontSize: 20, fontWeight: 500, textAlign: 'center' }}>
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

        {/* Textarea */}
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
            fontSize: 21,
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

        {/* Mic + Send row */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {/* Big mic button */}
          <div style={{ position: 'relative', width: 76, height: 76, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {recording && (
              <span style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(255,107,107,0.35)',
                animation: 'pulse-ring 1.2s ease-out infinite',
              }} />
            )}
            <button
              type="button"
              onPointerDown={startRecording}
              onPointerUp={stopRecording}
              onPointerLeave={stopRecording}
              disabled={loading}
              style={{
                width: 76, height: 76, borderRadius: '50%', border: 'none',
                background: recording
                  ? 'linear-gradient(135deg,#ff6b6b,#ee5a24)'
                  : 'linear-gradient(135deg,#f5f5f5,#e5e5e5)',
                fontSize: 42,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s, transform 0.1s, box-shadow 0.2s',
                boxShadow: recording ? '0 6px 24px rgba(255,107,107,0.5)' : '0 2px 10px rgba(0,0,0,0.13)',
                transform: recording ? 'scale(1.07)' : 'scale(1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
                touchAction: 'none', userSelect: 'none',
              }}
              aria-label={recording ? '停止录音' : '按住录音'}
            >
              {recording ? '⏹' : '🎙'}
            </button>
          </div>

          {/* Right: hint + send */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 17, fontWeight: 500, color: recording ? '#ff6b6b' : '#ccc', transition: 'color 0.2s' }}>
              {recording ? '🔴 录音中… 松开停止' : '按住录音'}
            </span>
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                height: 50, borderRadius: 14, border: 'none',
                background: input.trim() && !loading ? '#ff6b6b' : '#e0e0e0',
                color: '#fff', fontSize: 21, fontWeight: 600,
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                transition: 'background 0.15s', letterSpacing: 0.3,
              }}
            >
              {loading ? '…' : t('input.submit')}
            </button>
          </div>
        </div>
      </form>
    </div>
    </>
  );
}