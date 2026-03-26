'use client';

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
}

export default function EventFeed({ events }: Props) {
  const { t } = useTranslation();

  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#aaa', marginTop: 48, fontSize: 26 }}>
        {t('summary.no_data')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {events.map((ev) => (
        <div
          key={ev.id}
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <span style={{ fontSize: 31, lineHeight: 1 }}>{EVENT_EMOJI[ev.event_type] ?? '📝'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 26 }}>
              {t(`events.${ev.event_type}`)}
              {ev.event_type === 'feed' && ev.feed_amount_ml ? ` · ${ev.feed_amount_ml}ml` : ''}
              {ev.event_type === 'sleep' && ev.duration_minutes
                ? ` · ${Math.floor(ev.duration_minutes / 60)}h ${ev.duration_minutes % 60}m`
                : ''}
            </div>
            {ev.raw_input && (
              <div style={{ fontSize: 17, color: '#888', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ev.raw_input}
              </div>
            )}
          </div>
          <div style={{ fontSize: 16, color: '#bbb', flexShrink: 0, paddingTop: 2 }}>
            {format(new Date(ev.created_at), 'h:mm a', { timeZone: 'America/Los_Angeles' })}
          </div>
        </div>
      ))}
    </div>
  );
}
