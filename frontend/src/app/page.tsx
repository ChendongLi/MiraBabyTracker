export const dynamic = 'force-dynamic';

import ClientApp from '@/components/ClientApp';
import type { EventRow } from '@/lib/api';

async function getInitialEvents(): Promise<EventRow[]> {
  try {
    const apiUrl = process.env.API_SERVICE_URL;
    if (!apiUrl) return [];
    const res = await fetch(`${apiUrl}/api/events?limit=50`, {
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const initialEvents = await getInitialEvents();
  return <ClientApp initialEvents={initialEvents} />;
}
