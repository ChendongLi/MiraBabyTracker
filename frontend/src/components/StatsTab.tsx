'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSummary, getWeekEvents, type SummaryResponse, type EventRow } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { format, subDays } from 'date-fns';

export default function StatsTab() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [weekEvents, setWeekEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [s, w] = await Promise.all([getSummary(), getWeekEvents()]);
      setSummary(s);
      setWeekEvents(w);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Build 7-day sleep chart data
  const sleepChartData = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), 'MM-dd');
    const dateStr = format(subDays(new Date(), 6 - i), 'yyyy-MM-dd');
    const totalMins = weekEvents
      .filter((e) => e.event_type === 'sleep' && e.created_at.startsWith(dateStr))
      .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);
    return { date: d, hours: +(totalMins / 60).toFixed(1) };
  });

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: 48, color: '#aaa' }}>…</div>;
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '16px' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        {[
          { label: t('summary.last_feed'), value: summary?.last_feed_at },
          { label: t('summary.last_sleep'), value: summary?.last_sleep_end_at },
          { label: t('summary.last_diaper'), value: summary?.last_diaper_at },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: value ? '#1a1a1a' : '#ccc' }}>
              {value
                ? formatDistanceToNow(new Date(value), { addSuffix: true })
                : t('summary.no_data')}
            </div>
          </div>
        ))}
      </div>

      {/* Today totals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        {[
          { label: '💤 睡眠', value: summary ? `${(summary.total_sleep_minutes / 60).toFixed(1)}h` : '--' },
          { label: '🍼 总奶量', value: summary ? `${summary.total_feed_ml}ml` : '--' },
          { label: '💧 换尿布', value: summary ? `${summary.diaper_count}次` : '--' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Sleep chart */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>😴 近7天睡眠（小时）</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={sleepChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [`${v}h`, '睡眠']} />
            <Bar dataKey="hours" fill="#6c8ebf" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
