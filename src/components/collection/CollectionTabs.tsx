'use client';

import { useState } from 'react';
import { Library, Bookmark } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface CollectionTabsProps {
  eventsContent: React.ReactNode;
  wishlistContent: React.ReactNode;
  wishlistCount: number;
}

export function CollectionTabs({
  eventsContent,
  wishlistContent,
  wishlistCount,
}: CollectionTabsProps) {
  const t = useTranslations('collection');
  const [activeTab, setActiveTab] = useState<'events' | 'wishlist'>('events');

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'events'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Library className="h-4 w-4" />
          {t('tabMyEvents')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('wishlist')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            activeTab === 'wishlist'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Bookmark className="h-4 w-4" />
          {t('tabWantToGo')}
          {wishlistCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[11px] font-bold text-primary">
              {wishlistCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === 'events' ? eventsContent : wishlistContent}
      </div>
    </div>
  );
}
