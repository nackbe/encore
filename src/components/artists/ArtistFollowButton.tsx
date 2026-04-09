'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase } from '@/hooks/useSupabase';
import { useUser } from '@/hooks/useUser';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ArtistFollowButtonProps {
  artistId: string;
  initialFollowing: boolean;
}

export function ArtistFollowButton({
  artistId,
  initialFollowing,
}: ArtistFollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations('artist');
  const supabase = useSupabase();
  const { user } = useUser();

  const handleToggle = async () => {
    if (!user) return;

    if (isFollowing) {
      await supabase
        .from('user_followed_artists')
        .delete()
        .eq('user_id', user.id)
        .eq('artist_id', artistId);
      setIsFollowing(false);
    } else {
      await supabase
        .from('user_followed_artists')
        .insert({ user_id: user.id, artist_id: artistId });
      setIsFollowing(true);
    }

    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <Button
      variant={isFollowing ? 'default' : 'outline'}
      size="sm"
      onClick={handleToggle}
      disabled={isPending}
    >
      <Heart
        className={`mr-1.5 h-4 w-4 ${isFollowing ? 'fill-current' : ''}`}
      />
      {isFollowing ? t('following') : t('follow')}
    </Button>
  );
}
