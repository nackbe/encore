const FANART_API_BASE = 'https://webservice.fanart.tv/v3';

function getApiKey(): string {
  const key = process.env.FANART_API_KEY;
  if (!key) throw new Error('Missing FANART_API_KEY environment variable');
  return key;
}

export interface FanartArtistResponse {
  artistthumb?: Array<{ id: string; url: string; likes: string }>;
  hdmusiclogo?: Array<{ id: string; url: string; likes: string }>;
  artistbackground?: Array<{ id: string; url: string; likes: string }>;
}

/** Get artist images by MusicBrainz ID */
export async function getArtistImages(mbid: string): Promise<FanartArtistResponse | null> {
  try {
    const res = await fetch(`${FANART_API_BASE}/music/${mbid}?api_key=${getApiKey()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as FanartArtistResponse;
  } catch {
    return null;
  }
}

/** Get the best artist thumb URL from fanart.tv */
export async function getArtistThumb(mbid: string): Promise<string | null> {
  const data = await getArtistImages(mbid);
  if (!data?.artistthumb?.length) return null;
  // Sort by likes descending, return best
  const sorted = [...data.artistthumb].sort((a, b) => Number(b.likes) - Number(a.likes));
  return sorted[0].url;
}
