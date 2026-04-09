'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSupabase } from '@/hooks/useSupabase';
import { signupSchema } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Music, Mail, Loader2 } from 'lucide-react';

export default function SignupPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = useTranslations('auth');
  const supabase = useSupabase();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = signupSchema.safeParse({ email, password, confirmPassword });
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      if (firstError?.path.includes('confirmPassword')) {
        setError(t('passwordMismatch'));
      } else {
        setError(firstError?.message ?? 'Invalid input');
      }
      return;
    }

    setIsLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/${locale}/collection`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setIsLoading(false);
      return;
    }

    window.location.href = `/${locale}/onboarding`;
  }

  async function handleOAuthLogin(provider: 'google' | 'spotify') {
    setError(null);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/${locale}/collection`,
      },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return (
    <div className="space-y-6">
      {/* Branding */}
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Music className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
          Encore
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('signupSubtitle')}
        </p>
      </div>

      {/* OAuth buttons */}
      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => handleOAuthLogin('google')}
          type="button"
        >
          <Mail className="mr-2 h-4 w-4" />
          {t('continueWithGoogle')}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => handleOAuthLogin('spotify')}
          type="button"
        >
          <Music className="mr-2 h-4 w-4" />
          {t('continueWithSpotify')}
        </Button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            {t('orContinueWith')}
          </span>
        </div>
      </div>

      {/* Signup form */}
      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-medium text-foreground"
          >
            {t('email')}
          </label>
          <Input
            id="email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            {t('password')}
          </label>
          <Input
            id="password"
            type="password"
            placeholder="********"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-medium text-foreground"
          >
            {t('confirmPassword')}
          </label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="********"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={6}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('createAccount')}
        </Button>
      </form>

      {/* Login link */}
      <p className="text-center text-sm text-muted-foreground">
        {t('hasAccount')}{' '}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          {t('signIn')}
        </Link>
      </p>
    </div>
  );
}
