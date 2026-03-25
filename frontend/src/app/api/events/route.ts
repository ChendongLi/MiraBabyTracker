export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_SERVICE_URL;

export async function GET(req: NextRequest) {
  const limit = req.nextUrl.searchParams.get('limit') || '50';
  const res = await fetch(`${API_URL}/api/events?limit=${limit}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
