'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSummary, getWeekEvents, type SummaryResponse, type EventRow } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { format, subDays } from 'date-fns';
import { format as formatTZ } from 'date-fns-tz';

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

  // Build today's feed line chart (Pacific Time)
  const TZ = 'America/Los_Angeles';
  const todayPT = formatTZ(new Date(), 'yyyy-MM-dd', { timeZone: TZ });
  const isTodayPT = (utcStr: string) =>
    formatTZ(new Date(utcStr), 'yyyy-MM-dd', { timeZone: TZ }) === todayPT;
  // Today's outdoor/bath activity rows (Pacific Time)
  const activityRows = weekEvents
    .filter((e) => ['outdoor', 'bath', 'unknown'].includes(e.event_type) && isTodayPT(e.created_at))
    .map((e) => ({
      time: formatTZ(new Date(e.created_at), 'HH:mm', { timeZone: TZ }),
      type: e.event_type,
      duration: e.duration_minutes ? `${e.duration_minutes}分钟` : '—',
      notes: e.notes || e.raw_input || '—',
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  const outdoorTotalMins = weekEvents
    .filter((e) => e.event_type === 'outdoor' && isTodayPT(e.created_at))
    .reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0);

  // Today's diaper rows (Pacific Time)
  const diaperRows = weekEvents
    .filter((e) => e.event_type === 'diaper' && isTodayPT(e.created_at))
    .map((e) => ({
      time: formatTZ(new Date(e.created_at), 'HH:mm', { timeZone: TZ }),
      type: e.diaper_type || '—',
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  const  feedChartData = weekEvents
    .filter((e) => e.event_type === 'feed' && e.feed_amount_ml && isTodayPT(e.created_at))
    .map((e) => ({
      time: formatTZ(new Date(e.created_at), 'HH:mm', { timeZone: TZ }),
      ml: Number(e.feed_amount_ml ?? 0),
    }))
    .sort((a, b) => a.time.localeCompare(b.time));

  if (loading) {
    return <div style={{ textAlign: 'center', marginTop: 48, color: '#aaa' }}>…</div>;
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: '16px' }}>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        {[
          { label: t('summary.last_feed'), value: summary?.last_feed_at },
          { label: t('summary.last_sleep'), value: summary?.last_sleep_at ?? summary?.last_sleep_end_at },
          { label: t('summary.last_diaper'), value: summary?.last_diaper_at },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: value ? '#1a1a1a' : '#ccc' }}>
              {value
                ? formatDistanceToNow(new Date(value), { addSuffix: true, locale: zhCN })
                : t('summary.no_data')}
            </div>
          </div>
        ))}
      </div>

      {/* Today totals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        {[
          { label: '💤 睡眠', value: summary
            ? summary.total_sleep_minutes > 0
              ? `${(summary.total_sleep_minutes / 60).toFixed(1)}h`
              : `${summary.sleep_count}次`
            : '--' },
          { label: '🍼 总奶量', value: summary ? `${summary.total_feed_ml}毫升` : '--' },
          { label: '💧 换尿布', value: summary ? `${summary.diaper_count}次` : '--' },
          { label: '🌳 户外', value: outdoorTotalMins > 0 ? `${outdoorTotalMins}分钟` : '--' },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', borderRadius: 12, padding: '12px 10px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 23, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Sleep chart */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 23 }}>😴 近7天睡眠（小时）</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={sleepChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 18 }} />
            <YAxis tick={{ fontSize: 18 }} />
            <Tooltip formatter={(v) => [`${v}小时`, '睡眠']} />
            <Bar dataKey="hours" fill="#6c8ebf" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Today's feed line chart */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 23 }}>🍼 今日喂奶量（毫升）</div>
        {feedChartData.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#ccc', fontSize: 17, padding: '24px 0' }}>暂无喂奶记录</div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={feedChartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 17 }} />
              <YAxis tick={{ fontSize: 15 }} domain={[0, 'auto']} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v} ml`, '奶量']} />
              <Bar dataKey="ml" fill="#ff6b6b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Activity table */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 23 }}>🌳 今日活动记录</div>
        {activityRows.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#ccc', fontSize: 17, padding: '16px 0' }}>暂无活动记录</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 22 }}>
            <thead>
              <tr style={{ color: '#888', borderBottom: '1px solid #f0f0f0' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>时间</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>类型</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>时长</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>备注</th>
              </tr>
            </thead>
            <tbody>
              {activityRows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                  <td style={{ padding: '8px 8px', color: '#555' }}>{row.time}</td>
                  <td style={{ padding: '8px 8px' }}>{row.type === 'outdoor' ? '🌳 出去玩' : row.type === 'bath' ? '🛁 洗澡' : '📝 其他'}</td>
                  <td style={{ padding: '8px 8px', color: '#555' }}>{row.duration}</td>
                  <td style={{ padding: '8px 8px', color: '#888', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Diaper table */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', marginTop: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 23 }}>💧 今日换尿布时间</div>
        {diaperRows.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#ccc', fontSize: 17, padding: '16px 0' }}>暂无换尿布记录</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 22 }}>
            <thead>
              <tr style={{ color: '#888', borderBottom: '1px solid #f0f0f0' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>时间</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 500 }}>类型</th>
              </tr>
            </thead>
            <tbody>
              {diaperRows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f8f8f8' }}>
                  <td style={{ padding: '8px 8px', color: '#555' }}>{row.time}</td>
                  <td style={{ padding: '8px 8px' }}>{row.type === 'wet' ? '💦 湿' : row.type === 'soiled' ? '💩 脏' : row.type === 'mixed' ? '💦💩 混合' : row.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
