import type { TicketmasterEvent } from '@/types';

const TM_API_BASE = 'https://app.ticketmaster.com/discovery/v2';

function getApiKey(): string {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing TICKETMASTER_API_KEY environment variable');
  }
  return apiKey;
}

// ─── Response Validation ────────────────────────────────────────

function validateEvent(item: unknown): item is TicketmasterEvent {
  if (typeof item !== 'object' || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.dates === 'object' &&
    obj.dates !== null
  );
}

interface TicketmasterSearchResponse {
  events: TicketmasterEvent[];
  totalElements: number;
  totalPages: number;
  page: number;
}

// ─── API Methods ────────────────────────────────────────────────

export interface SearchEventsParams {
  city?: string;
  country?: string;
  keyword?: string;
  size?: number;
  page?: number;
  classificationName?: string;
  startDateTime?: string;
  endDateTime?: string;
}

export async function searchEvents(
  params: SearchEventsParams
): Promise<TicketmasterSearchResponse> {
  const queryParams = new URLSearchParams({
    apikey: getApiKey(),
    classificationName: params.classificationName ?? 'music',
    size: String(params.size ?? 20),
    page: String(params.page ?? 0),
  });

  if (params.city) queryParams.set('city', params.city);
  if (params.country) queryParams.set('countryCode', params.country);
  if (params.keyword) queryParams.set('keyword', params.keyword);
  if (params.startDateTime) queryParams.set('startDateTime', params.startDateTime);
  if (params.endDateTime) queryParams.set('endDateTime', params.endDateTime);

  const response = await fetch(`${TM_API_BASE}/events.json?${queryParams}`);

  if (!response.ok) {
    throw new Error(`Ticketmaster search failed: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  const obj = data as Record<string, unknown>;
  const embedded = obj._embedded as Record<string, unknown> | undefined;
  const rawEvents = embedded?.events;
  const pageInfo = obj.page as Record<string, unknown> | undefined;

  const events = Array.isArray(rawEvents) ? rawEvents.filter(validateEvent) : [];

  return {
    events,
    totalElements: typeof pageInfo?.totalElements === 'number' ? pageInfo.totalElements : 0,
    totalPages: typeof pageInfo?.totalPages === 'number' ? pageInfo.totalPages : 0,
    page: typeof pageInfo?.number === 'number' ? pageInfo.number : 0,
  };
}

export async function getEvent(eventId: string): Promise<TicketmasterEvent> {
  const params = new URLSearchParams({ apikey: getApiKey() });

  const response = await fetch(`${TM_API_BASE}/events/${eventId}.json?${params}`);

  if (!response.ok) {
    throw new Error(`Ticketmaster get event failed: ${response.status} ${response.statusText}`);
  }

  const data: unknown = await response.json();
  if (!validateEvent(data)) {
    throw new Error('Invalid Ticketmaster event response');
  }

  return data;
}
