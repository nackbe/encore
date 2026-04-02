'use server';

import { revalidatePath } from 'next/cache';

export async function revalidateCollection() {
  revalidatePath('/[locale]/(main)/collection', 'page');
  revalidatePath('/[locale]/(main)/stats', 'page');
}
