'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fail, text } from '@/lib/forms';

function credentials(fd: FormData) {
  const email = text(fd, 'email');
  const password = String(fd.get('password') ?? '');
  if (!email || password.length < 6) fail('/login', 'Enter an email and a password of at least 6 characters.');
  return { email, password };
}

export async function signInAction(fd: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials(fd));
  if (error) fail('/login', 'Wrong email or password.');
  redirect('/');
}

export async function signUpAction(fd: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const { data, error } = await supabase.auth.signUp({
    ...credentials(fd),
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) fail('/login', error.message);
  // With email confirmation on (the Supabase cloud default) there is no session until the link is clicked.
  if (!data.session) redirect('/login?notice=check-email');
  redirect('/');
}
