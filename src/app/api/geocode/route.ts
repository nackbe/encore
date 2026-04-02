import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const lat = params.get('lat');
  const lng = params.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=en`,
      {
        headers: {
          'User-Agent': 'Encore-App/1.0 (concert-tracker)',
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Nominatim returned ${res.status}` }, { status: 502 });
    }

    const data = await res.json();

    const city =
      data.address?.city ??
      data.address?.town ??
      data.address?.municipality ??
      data.address?.state ??
      '';
    const country = data.address?.country ?? '';
    const countryCode = (data.address?.country_code ?? '').toUpperCase();

    return NextResponse.json({ city, country, countryCode });
  } catch {
    return NextResponse.json({ error: 'Geocode request failed' }, { status: 502 });
  }
}
