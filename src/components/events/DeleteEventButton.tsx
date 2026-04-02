'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabase } from '@/hooks/useSupabase';
import { revalidateCollection } from '@/app/actions';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface DeleteEventButtonProps {
  eventId: string;
  eventName: string;
}

export function DeleteEventButton({ eventId, eventName }: DeleteEventButtonProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const t = useTranslations('collection');
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);

    const { error } = await supabase
      .from('user_events')
      .delete()
      .eq('id', eventId);

    if (error) {
      console.error('Delete event error:', error.message);
      setDeleting(false);
      return;
    }

    await revalidateCollection();
    queryClient.invalidateQueries({ queryKey: ['user-stats'] });

    router.replace(`/${locale}/collection`);
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-red-500 border-red-500/30 hover:bg-red-500/10 hover:text-red-400">
          <Trash2 className="h-4 w-4" />
          {t('deleteConfirm')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteDescription', { name: eventName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('deleteCancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleting ? t('deleting') : t('deleteConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
