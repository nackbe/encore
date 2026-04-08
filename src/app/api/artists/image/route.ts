import { NextRequest, NextResponse } from 'next/server';
import { findArtistImage } from '@/lib/api/image-cascade';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name')?.trim();
  const mbid = request.nextUrl.searchParams.get('mbid')?.trim() || undefined;

  if (!name) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  const result = await findArtistImage(name, mbid);
  return NextResponse.json({ imageUrl: result.imageUrl, genres: result.genres });
}
