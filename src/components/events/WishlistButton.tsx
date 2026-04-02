'use client';

import { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';

interface WishlistButtonProps {
  globalEventId: string;
  initialWishlisted?: boolean;
  variant?: 'default' | 'overlay' | 'icon';
  onToggle?: (wishlisted: boolean) => void;
}

export function WishlistButton({
  globalEventId,
  initialWishlisted = false,
  variant = 'default',
  onToggle,
}: WishlistButtonProps) {
  const supabase = useSupabase();
  const { user } = useUser();
  const t = useTranslations('event');
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [busy, setBusy] = useState(false);

  // Sync internal state when parent updates (e.g. after DB re-fetch on back-navigation)
  useEffect(() => {
    setWishlisted(initialWishlisted);
  }, [initialWishlisted]);

  async function handleToggle() {
    if (!user || busy) return;

    const next = !wishlisted;
    setWishlisted(next);
    onToggle?.(next);
    setBusy(true);

    try {
      if (next) {
        // Use plain insert; ignore duplicate key error (23505) since
        // it means the row already exists — treat as success.
        // We avoid upsert because it requires an UPDATE RLS policy.
        const { error } = await supabase
          .from('user_wishlist')
          .insert({ user_id: user.id, global_event_id: globalEventId });

        if (error && error.code !== '23505') {
          console.error('Wishlist insert failed:', error.message);
          setWishlisted(!next);
          onToggle?.(!next);
        }
      } else {
        const { error } = await supabase
          .from('user_wishlist')
          .delete()
          .eq('user_id', user.id)
          .eq('global_event_id', globalEventId);

        if (error) {
          console.error('Wishlist delete failed:', error.message);
          setWishlisted(!next);
          onToggle?.(!next);
        }
      }
    } catch (err) {
      console.error('Wishlist toggle error:', err);
      setWishlisted(!next);
      onToggle?.(!next);
    } finally {
      setBusy(false);
    }
  }

  // Don't render if no user session
  if (!user) return null;

  if (variant === 'icon') {
    return (
      <button
        type="button"
        aria-label={wishlisted ? t('saved') : t('wantToGo')}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleToggle();
        }}
        className="p-1 transition-colors hover:text-primary"
      >
        <Bookmark
          className={cn(
            'h-4 w-4 transition-colors',
            wishlisted ? 'fill-primary text-primary' : 'text-muted-foreground'
          )}
        />
      </button>
    );
  }

  if (variant === 'overlay') {
    return (
      <button
        type="button"
        aria-label={wishlisted ? t('saved') : t('wantToGo')}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleToggle();
        }}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm transition-all hover:bg-black/70"
      >
        <Bookmark
          className={cn(
            'h-4 w-4 transition-colors',
            wishlisted ? 'fill-primary text-primary' : 'text-white'
          )}
        />
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant={wishlisted ? 'default' : 'outline'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleToggle();
      }}
      className="gap-2"
    >
      <Bookmark
        className={cn(
          'h-4 w-4',
          wishlisted && 'fill-current'
        )}
      />
      {wishlisted ? t('saved') : t('wantToGo')}
    </Button>
  );
}
