import * as React from 'react';
import Link from 'next/link';

import { Separator } from '@/components/ui/separator';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-encore-navy text-white/60">
      <div className="container flex flex-col items-center gap-4 px-4 py-8 md:flex-row md:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary">ENCORE</span>
          <Separator orientation="vertical" className="h-4 bg-white/20" />
          <span className="text-sm">
            &copy; {currentYear} Encore. All rights reserved.
          </span>
        </div>

        <nav className="flex items-center gap-6 text-sm">
          <Link href="/about" className="hover:text-white transition-colors">
            About
          </Link>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms
          </Link>
          <Link href="/contact" className="hover:text-white transition-colors">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
