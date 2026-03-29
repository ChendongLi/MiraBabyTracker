'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns-tz';
import type { EventRow } from '@/lib/api';

const EVENT_EMOJI: Record<string, string> = {
  feed: '🍼',
  diaper: '💧',
  sleep: '😴',
  outdoor: '🌳',
  bath: '🛁',
  unknown: '📝',
};

interface Props {
  events: EventRow[];
  onDelete?: (id: string) => Promise<void>;
}

export default function EventFeed({ events, onDelete }: Props) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#aaa', marginTop: 48, fontSize: 26 }}>
        {t('summary.no_data')}
      </div>
    );
  }

  async function handleDelete(id: string) {
    if (!onDelete) return;
    setDeletingId(id);
    try {
      await onDelete(id);
      setExpandedId(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {events.map((ev) => {
        const isExpanded = expandedId === ev.id;
        const isDeleting = deletingId === ev.id;

        return (
          <div
            key={ev.id}
            onClick={() => setExpandedId(isExpanded ? null : ev.id)}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '12px 14px',
              boxShadow: isExpanded
                ? '0 2px 12px rgba(0,0,0,0.10)'
                : '0 1px 3px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              transition: 'box-shadow 0.15s',
              border: isExpanded ? '1.5px solid #ff6b6b' : '1.5px solid transparent',
            }}
          >
            {/* Summary row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{ fontSize: 31, lineHeight: 1 }}>{EVENT_EMOJI[ev.event_type] ?? '📝'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 26 }}>
                  {t(`events.${ev.event_type}`)}
                  {ev.event_type === 'feed' && ev.feed_amount_ml ? ` · ${ev.feed_amount_ml}毫升` : ''}
                  {ev.event_type === 'sleep' && ev.duration_minutes
                    ? ` · ${Math.floor(ev.duration_minutes / 60)}h ${ev.duration_minutes % 60}m`
                    : ''}
                </div>
                {ev.raw_input && (
                  <div style={{
                    fontSize: 17, color: '#888', marginTop: 2,
                    overflow: isExpanded ? 'visible' : 'hidden',
                    textOverflow: isExpanded ? 'unset' : 'ellipsis',
                    whiteSpace: isExpanded ? 'normal' : 'nowrap',
                  }}>
                    {ev.raw_input}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 16, color: '#bbb', flexShrink: 0, paddingTop: 2 }}>
                {format(new Date(ev.started_at ?? ev.created_at), 'M月d日 HH:mm', { timeZone: 'America/Los_Angeles' })}
              </div>
            </div>

            {/* Expanded: delete button */}
            {isExpanded && (
              <div
                style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => handleDelete(ev.id)}
                  disabled={isDeleting}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 10,
                    border: 'none',
                    background: isDeleting ? '#e0e0e0' : '#ff4444',
                    color: '#fff',
                    fontSize: 18,
                    fontWeight: 600,
                    cursor: isDeleting ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {isDeleting ? '删除中…' : '🗑️ 删除'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
