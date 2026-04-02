'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Star, Check, Lock } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { revalidateCollection } from '@/app/actions';
import type { EventType } from '@/types';

const EVENT_TYPES: { value: EventType; labelKey: string }[] = [
  { value: 'concert', labelKey: 'concert' },
  { value: 'festival', labelKey: 'festival' },
  { value: 'club_show', labelKey: 'club_show' },
  { value: 'theater', labelKey: 'theater' },
  { value: 'special', labelKey: 'special' },
];

const MOODS = ['epic', 'intimate', 'euphoric', 'nostalgic', 'transcendent', 'rainy'] as const;

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string; locale: string }>();
  const locale = useLocale();
  const t = useTranslations('editEvent');
  const tTypes = useTranslations('eventTypes');
  const tMoods = useTranslations('moods');
  const supabase = useSupabase();
  const { user, isLoading: userLoading } = useUser();
  const queryClient = useQueryClient();

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  // Whether this event is linked to a global event (locks metadata)
  const [isGlobalEvent, setIsGlobalEvent] = React.useState(false);

  // Metadata fields (read-only for global events)
  const [eventName, setEventName] = React.useState('');
  const [eventDate, setEventDate] = React.useState('');
  const [eventCity, setEventCity] = React.useState('');
  const [eventType, setEventType] = React.useState<EventType>('concert');

  // Personal experience fields (always editable)
  const [rating, setRating] = React.useState<number | null>(null);
  const [mood, setMood] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState('');
  const [isMemorable, setIsMemorable] = React.useState(false);
  const [memorableReason, setMemorableReason] = React.useState('');
  const [ticketPrice, setTicketPrice] = React.useState('');

  // Load event data
  React.useEffect(() => {
    if (userLoading || !user) return;

    async function loadEvent() {
      const { data: event } = await supabase
        .from('user_events')
        .select(`
          *,
          global_events:global_event_id (name, date, city, event_type)
        `)
        .eq('id', params.id)
        .eq('user_id', user!.id)
        .single() as unknown as {
          data: {
            id: string;
            global_event_id: string | null;
            custom_event_name: string | null;
            custom_event_date: string | null;
            custom_event_city: string | null;
            event_type: string;
            rating: number | null;
            mood: string | null;
            notes: string | null;
            is_memorable: boolean;
            memorable_reason: string | null;
            ticket_price: number | null;
            global_events: { name: string; date: string; city: string | null; event_type: string } | null;
          } | null;
        };

      if (!event) {
        router.replace(`/${locale}/collection`);
        return;
      }

      const ge = event.global_events;
      const hasGlobal = !!event.global_event_id && !!ge;
      setIsGlobalEvent(hasGlobal);

      setEventName(hasGlobal ? ge!.name : (event.custom_event_name ?? ''));
      setEventDate(hasGlobal ? ge!.date : (event.custom_event_date ?? ''));
      setEventCity(hasGlobal ? (ge!.city ?? '') : (event.custom_event_city ?? ''));
      setEventType((hasGlobal ? ge!.event_type : event.event_type) as EventType);
      setRating(event.rating);
      setMood(event.mood);
      setNotes(event.notes ?? '');
      setIsMemorable(event.is_memorable);
      setMemorableReason(event.memorable_reason ?? '');
      setTicketPrice(event.ticket_price != null ? String(event.ticket_price) : '');
      setLoading(false);
    }

    loadEvent();
  }, [user, userLoading, params.id, locale, router, supabase]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);

    try {
      // Only update personal experience fields + metadata if custom event
      const updateData: Record<string, unknown> = {
        rating: rating,
        mood: mood,
        notes: notes || null,
        is_memorable: isMemorable,
        memorable_reason: isMemorable ? (memorableReason || null) : null,
        ticket_price: ticketPrice ? parseFloat(ticketPrice) : null,
      };

      // Only allow metadata changes for custom events
      if (!isGlobalEvent) {
        updateData.custom_event_name = eventName || null;
        updateData.custom_event_date = eventDate || null;
        updateData.custom_event_city = eventCity || null;
        updateData.event_type = eventType;
      }

      const { error } = await supabase
        .from('user_events')
        .update(updateData)
        .eq('id', params.id)
        .eq('user_id', user.id);

      if (!error) {
        setSaved(true);
        await revalidateCollection();
        queryClient.invalidateQueries({ queryKey: ['user-stats'] });
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (err) {
      console.error('Error updating event:', err);
    } finally {
      setSaving(false);
    }
  }

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Back button */}
      <Link
        href={`/${locale}/event/${params.id}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('backToEvent')}
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>

      <div className="mt-6 space-y-6">
        {/* Event metadata — locked for global events */}
        <div className="space-y-4">
          {isGlobalEvent && (
            <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              {t('lockedFields')}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="eventName">{t('eventName')}</Label>
            <Input
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              disabled={isGlobalEvent}
              className={cn(isGlobalEvent && 'opacity-60')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="eventDate">{t('eventDate')}</Label>
              <Input
                id="eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                disabled={isGlobalEvent}
                className={cn(isGlobalEvent && 'opacity-60')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eventCity">{t('eventCity')}</Label>
              <Input
                id="eventCity"
                value={eventCity}
                onChange={(e) => setEventCity(e.target.value)}
                disabled={isGlobalEvent}
                className={cn(isGlobalEvent && 'opacity-60')}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('eventType')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_TYPES.map(({ value, labelKey }) => (
                <button
                  key={value}
                  type="button"
                  disabled={isGlobalEvent}
                  onClick={() => !isGlobalEvent && setEventType(value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    eventType === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                    isGlobalEvent && 'opacity-60 cursor-not-allowed'
                  )}
                >
                  {tTypes(labelKey)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Personal experience — always editable */}
        <hr className="border-border" />

        {/* Rating */}
        <div className="space-y-2">
          <Label>{t('rating')}</Label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(rating === star ? null : star)}
                className="p-1"
              >
                <Star
                  className={cn(
                    'h-6 w-6 transition-colors',
                    rating !== null && star <= rating
                      ? 'fill-secondary text-secondary'
                      : 'text-muted-foreground'
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Mood */}
        <div className="space-y-2">
          <Label>{t('mood')}</Label>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(mood === m ? null : m)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  mood === m
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50'
                )}
              >
                {tMoods(m)}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">{t('notes')}</Label>
          <Input
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Memorable */}
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isMemorable}
              onChange={(e) => setIsMemorable(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium">{t('memorable')}</span>
          </label>
          {isMemorable && (
            <Input
              value={memorableReason}
              onChange={(e) => setMemorableReason(e.target.value)}
              placeholder={t('memorableReason')}
            />
          )}
        </div>

        {/* Ticket price */}
        <div className="space-y-2">
          <Label htmlFor="ticketPrice">{t('ticketPrice')}</Label>
          <Input
            id="ticketPrice"
            type="number"
            value={ticketPrice}
            onChange={(e) => setTicketPrice(e.target.value)}
            min="0"
            step="0.01"
          />
        </div>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                {t('saving')}
              </>
            ) : saved ? (
              <>
                <Check className="mr-2 h-4 w-4" />
                {t('saved')}
              </>
            ) : (
              t('save')
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
