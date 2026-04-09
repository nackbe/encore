import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';

const intlMiddleware = createIntlMiddleware({
  locales: ['es', 'en'],
  defaultLocale: 'es',
  localePrefix: 'always',
});

export async function middleware(request: NextRequest) {
  // Collect Supabase auth cookies that need to be set/removed
  const supabaseCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          supabaseCookies.push({ name, value, options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          supabaseCookies.push({ name, value: '', options });
        },
      },
    }
  );

  // Refresh the session — use getUser() not getSession() for security.
  // getUser() validates the JWT with Supabase server, getSession() only reads local cookie.
  // This ensures expired/tampered tokens are caught.
  await supabase.auth.getUser();

  // Run intl middleware with refreshed cookies
  const response = intlMiddleware(request);

  // Apply Supabase cookie changes to the response so the browser gets fresh tokens
  for (const cookie of supabaseCookies) {
    response.cookies.set({
      name: cookie.name,
      value: cookie.value,
      ...cookie.options,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
