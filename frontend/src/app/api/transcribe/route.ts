import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_SERVICE_URL;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const res = await fetch(`${API_URL}/api/transcribe`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
