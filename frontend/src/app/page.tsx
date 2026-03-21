'use client';

import { useState } from 'react';
import '../lib/i18n';
import { useTranslation } from 'react-i18next';
import LogTab from '@/components/LogTab';
import StatsTab from '@/components/StatsTab';

export default function Home() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'log' | 'stats'>('log');

  return (
    <main style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* Tab bar */}
      <nav style={{
        display: 'flex',
        borderBottom: '1px solid #e0e0e0',
        background: '#fff',
        flexShrink: 0,
      }}>
        {(['log', 'stats'] as const).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              padding: '14px 0',
              border: 'none',
              background: 'none',
              fontSize: 16,
              fontWeight: tab === id ? 600 : 400,
              color: tab === id ? '#ff6b6b' : '#888',
              borderBottom: tab === id ? '2px solid #ff6b6b' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {t(`tabs.${id}`)}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'log' ? <LogTab /> : <StatsTab />}
      </div>
    </main>
  );
}
