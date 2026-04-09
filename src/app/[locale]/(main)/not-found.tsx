import Link from 'next/link';
import { Music } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Music className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-bold">404</h2>
      <p className="text-sm text-muted-foreground">
        Esta página no existe o fue eliminada.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-white transition-colors hover:bg-primary/90"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
