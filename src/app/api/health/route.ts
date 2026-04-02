import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const { allowed, remaining } = rateLimit(ip, { limit: 30, windowSec: 60 });

  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { headers: { 'X-RateLimit-Remaining': String(remaining) } }
  );
}
