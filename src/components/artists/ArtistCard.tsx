import * as React from 'react';
import Image from 'next/image';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

interface ArtistCardProps {
  artist: {
    id: string;
    name: string;
    imageUrl: string | null;
    genres: string[];
  };
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (id: string) => void;
}

export function ArtistCard({
  artist,
  selectable = false,
  selected = false,
  onToggle,
}: ArtistCardProps) {
  function handleClick() {
    if (selectable && onToggle) {
      onToggle(artist.id);
    }
  }

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all',
        selectable && 'cursor-pointer hover:shadow-md',
        selected && 'ring-2 ring-primary'
      )}
      onClick={handleClick}
    >
      {/* Selection indicator */}
      {selectable && (
        <div className="absolute right-2 top-2 z-10">
          <div
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded border-2 transition-colors',
              selected
                ? 'border-primary bg-primary'
                : 'border-white/60 bg-white/20'
            )}
          >
            {selected && <Check className="h-3 w-3 text-white" />}
          </div>
        </div>
      )}

      {/* Photo */}
      <div className="relative aspect-square overflow-hidden bg-encore-navy">
        {artist.imageUrl ? (
          <Image
            src={artist.imageUrl}
            alt={artist.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-white/20">
            &#9835;
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="line-clamp-2 text-sm font-semibold" title={artist.name}>{artist.name}</h4>
        {artist.genres.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {artist.genres.slice(0, 2).map((genre) => (
              <Badge key={genre} variant="outline" className="text-[10px]">
                {genre}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
