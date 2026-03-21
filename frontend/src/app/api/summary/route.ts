import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_SERVICE_URL;

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') || '';
  const params = date ? `?date=${date}` : '';
  const res = await fetch(`${API_URL}/api/summary${params}`);
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
