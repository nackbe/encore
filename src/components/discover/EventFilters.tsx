'use client';

import * as React from 'react';
import { Filter, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EventType } from '@/types';

interface EventFiltersState {
  eventType: EventType | null;
  genre: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  priceMin: number | null;
  priceMax: number | null;
}

interface EventFiltersProps {
  filters: EventFiltersState;
  genres: string[];
  onChange: (filters: EventFiltersState) => void;
  onReset: () => void;
}

const EVENT_TYPES: Array<{ value: EventType; label: string }> = [
  { value: 'concert', label: 'Concert' },
  { value: 'festival', label: 'Festival' },
  { value: 'club_show', label: 'Club Show' },
  { value: 'theater', label: 'Theater' },
  { value: 'special', label: 'Special' },
];

export function EventFilters({
  filters,
  genres,
  onChange,
  onReset,
}: EventFiltersProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const activeCount = [
    filters.eventType,
    filters.genre,
    filters.dateFrom,
    filters.dateTo,
    filters.priceMin,
    filters.priceMax,
  ].filter(Boolean).length;

  function updateFilter<K extends keyof EventFiltersState>(
    key: K,
    value: EventFiltersState[K]
  ) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="space-y-3">
      {/* Toggle button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <Filter className="h-4 w-4" />
        Filters
        {activeCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">
            {activeCount}
          </span>
        )}
      </Button>

      {/* Filter panel */}
      {isOpen && (
        <div className="rounded-lg border bg-card p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Event type */}
            <div className="space-y-2">
              <Label>Event type</Label>
              <Select
                value={filters.eventType ?? 'all'}
                onValueChange={(val) =>
                  updateFilter(
                    'eventType',
                    val === 'all' ? null : (val as EventType)
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
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
            </div>

            {/* Genre */}
            <div className="space-y-2">
              <Label>Genre</Label>
              <Select
                value={filters.genre ?? 'all'}
                onValueChange={(val) =>
                  updateFilter('genre', val === 'all' ? null : val)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All genres" />
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
            </div>

            {/* Date range */}
            <div className="space-y-2">
              <Label>Date from</Label>
              <Input
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(e) =>
                  updateFilter('dateFrom', e.target.value || null)
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Date to</Label>
              <Input
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(e) =>
                  updateFilter('dateTo', e.target.value || null)
                }
              />
            </div>

            {/* Price range */}
            <div className="space-y-2">
              <Label>Min price</Label>
              <Input
                type="number"
                min={0}
                value={filters.priceMin ?? ''}
                onChange={(e) =>
                  updateFilter(
                    'priceMin',
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label>Max price</Label>
              <Input
                type="number"
                min={0}
                value={filters.priceMax ?? ''}
                onChange={(e) =>
                  updateFilter(
                    'priceMax',
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                placeholder="No limit"
              />
            </div>
          </div>

          {/* Reset */}
          {activeCount > 0 && (
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onReset}
                className="gap-1 text-muted-foreground"
              >
                <X className="h-3 w-3" />
                Clear filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
