'use client';

import { useState } from 'react';
import { Share2, Check, Link as LinkIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

interface ShareCollectionButtonProps {
  userId: string;
}

export function ShareCollectionButton({ userId }: ShareCollectionButtonProps) {
  const [copied, setCopied] = useState(false);
  const locale = useLocale();

  async function handleShare() {
    const url = `${window.location.origin}/${locale}/share/${userId}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Mi colección — Encore', url });
        return;
      } catch {
        // User cancelled or share API failed, fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border transition-colors hover:bg-accent"
      aria-label="Compartir colección"
    >
      {copied ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Share2 className="h-4 w-4" />
      )}
    </button>
  );
}
