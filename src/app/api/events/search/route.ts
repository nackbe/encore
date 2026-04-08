import { NextRequest, NextResponse } from 'next/server';
import { unifiedEventSearch } from '@/lib/api/unified-search';

// Ensure this route is always dynamic (never cached by Next.js)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();

  if (!query || query.length < 4) {
    return NextResponse.json({ results: [], errors: [] });
  }

  try {
    const { results, errors } = await unifiedEventSearch(query);
    return NextResponse.json({ results, errors });
  } catch (err) {
    console.error('[events/search] Unhandled error:', err);
    return NextResponse.json(
      { results: [], errors: [{ source: 'server', message: 'Internal search error' }] },
      { status: 200 } // 200 so the client still gets a valid response
    );
  }
}
