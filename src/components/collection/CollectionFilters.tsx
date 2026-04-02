'use client';

import * as React from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EventType } from '@/types';

interface CollectionFiltersState {
  year: string | null;
  city: string | null;
  artistId: string | null;
  eventType: EventType | null;
  genre: string | null;
  memorableOnly: boolean;
}

interface CollectionFiltersProps {
  filters: CollectionFiltersState;
  years: string[];
  cities: string[];
  artists: Array<{ id: string; name: string }>;
  genres: string[];
  onChange: (filters: CollectionFiltersState) => void;
}

const EVENT_TYPES: Array<{ value: EventType; label: string }> = [
  { value: 'concert', label: 'Concert' },
  { value: 'festival', label: 'Festival' },
  { value: 'club_show', label: 'Club Show' },
  { value: 'theater', label: 'Theater' },
  { value: 'special', label: 'Special' },
];

export function CollectionFilters({
  filters,
  years,
  cities,
  artists,
  genres,
  onChange,
}: CollectionFiltersProps) {
  function updateFilter<K extends keyof CollectionFiltersState>(
    key: K,
    value: CollectionFiltersState[K]
  ) {
    onChange({ ...filters, [key]: value });
  }

  const activeCount = [
    filters.year,
    filters.city,
    filters.artistId,
    filters.eventType,
    filters.genre,
    filters.memorableOnly || null,
  ].filter(Boolean).length;

  function clearAll() {
    onChange({
      year: null,
      city: null,
      artistId: null,
      eventType: null,
      genre: null,
      memorableOnly: false,
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Year */}
        <Select
          value={filters.year ?? 'all'}
          onValueChange={(val) =>
            updateFilter('year', val === 'all' ? null : val)
          }
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* City */}
        <Select
          value={filters.city ?? 'all'}
          onValueChange={(val) =>
            updateFilter('city', val === 'all' ? null : val)
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cities</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Artist */}
        <Select
          value={filters.artistId ?? 'all'}
          onValueChange={(val) =>
            updateFilter('artistId', val === 'all' ? null : val)
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Artist" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All artists</SelectItem>
            {artists.map((artist) => (
              <SelectItem key={artist.id} value={artist.id}>
                {artist.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Event type */}
        <Select
          value={filters.eventType ?? 'all'}
          onValueChange={(val) =>
            updateFilter(
              'eventType',
              val === 'all' ? null : (val as EventType)
            )
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Genre */}
        <Select
          value={filters.genre ?? 'all'}
          onValueChange={(val) =>
            updateFilter('genre', val === 'all' ? null : val)
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Genre" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All genres</SelectItem>
            {genres.map((genre) => (
              <SelectItem key={genre} value={genre}>
                {genre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Memorable only */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="memorable-only"
            checked={filters.memorableOnly}
            onCheckedChange={(checked) =>
              updateFilter('memorableOnly', checked === true)
            }
          />
          <Label htmlFor="memorable-only" className="text-sm cursor-pointer">
            Memorable only
          </Label>
        </div>
      </div>

      {/* Active filter badges */}
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filters.year && (
            <Badge variant="secondary" className="gap-1">
              {filters.year}
              <button type="button" onClick={() => updateFilter('year', null)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.city && (
            <Badge variant="secondary" className="gap-1">
              {filters.city}
              <button type="button" onClick={() => updateFilter('city', null)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.eventType && (
            <Badge variant="secondary" className="gap-1">
              {EVENT_TYPES.find((t) => t.value === filters.eventType)?.label}
              <button
                type="button"
                onClick={() => updateFilter('eventType', null)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.genre && (
            <Badge variant="secondary" className="gap-1">
              {filters.genre}
              <button type="button" onClick={() => updateFilter('genre', null)}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.memorableOnly && (
            <Badge variant="gold" className="gap-1">
              Memorable
              <button
                type="button"
                onClick={() => updateFilter('memorableOnly', false)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-xs text-muted-foreground"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
