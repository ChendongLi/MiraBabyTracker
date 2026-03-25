export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const API_URL = process.env.API_SERVICE_URL;

export async function GET() {
  const res = await fetch(`${API_URL}/api/events/week`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
