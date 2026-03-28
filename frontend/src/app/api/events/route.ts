export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_SERVICE_URL;

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get('limit') || '50';
  const res = await fetch(`${API_URL}/api/events?limit=${limit}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const res = await fetch(`${API_URL}/api/events/${id}`, { method: 'DELETE' });
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ error: 'Delete failed' }, { status: res.status });
}
