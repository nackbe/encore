'use client';

import * as React from 'react';
import { Search } from 'lucide-react';

import { normalizeText } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArtistCard } from '@/components/artists/ArtistCard';

interface ArtistData {
  id: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
}

interface ArtistGridProps {
  artists: ArtistData[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
  onDeselectAll?: (ids: string[]) => void;
  selectable?: boolean;
  selectAllLabel?: string;
  deselectAllLabel?: string;
  filterPlaceholder?: string;
  selectedCountLabel?: (count: number) => string;
}

export function ArtistGrid({
  artists,
  selectedIds,
  onToggle,
  onSelectAll,
  onDeselectAll,
  selectable = false,
  selectAllLabel = 'Select all',
  deselectAllLabel = 'Deselect all',
  filterPlaceholder = 'Filter artists...',
  selectedCountLabel,
}: ArtistGridProps) {
  const [filter, setFilter] = React.useState('');

  const filteredArtists = React.useMemo(() => {
    if (!filter.trim()) return artists;
    const normalized = normalizeText(filter);
    return artists.filter((a) => normalizeText(a.name).includes(normalized));
  }, [artists, filter]);

  function handleSelectAll() {
    const allIds = filteredArtists.map((a) => a.id);
    const allSelected = allIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      if (onDeselectAll) {
        onDeselectAll(allIds);
      } else {
        allIds.forEach((id) => {
          if (selectedIds.includes(id)) onToggle(id);
        });
      }
    } else {
      if (onSelectAll) {
        onSelectAll(allIds);
      } else {
        allIds.forEach((id) => {
          if (!selectedIds.includes(id)) onToggle(id);
        });
      }
    }
  }

  const allVisibleSelected =
    filteredArtists.length > 0 &&
    filteredArtists.every((a) => selectedIds.includes(a.id));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={filterPlaceholder}
            className="pl-10"
          />
        </div>
        {selectable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
          >
            {allVisibleSelected ? deselectAllLabel : selectAllLabel}
          </Button>
        )}
      </div>

      {/* Selected count */}
      {selectable && selectedIds.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {selectedCountLabel
            ? selectedCountLabel(selectedIds.length)
            : `${selectedIds.length} artist${selectedIds.length !== 1 ? 's' : ''} selected`}
        </p>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filteredArtists.map((artist) => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            selectable={selectable}
            selected={selectedIds.includes(artist.id)}
            onToggle={onToggle}
          />
        ))}
      </div>

      {filteredArtists.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No artists found.
        </p>
      )}
    </div>
  );
}
