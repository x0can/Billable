import { ErrorBanner, Field, secondaryButtonClass } from '@/components/ui';
import { signInAction, signUpAction } from './actions';

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { error, notice } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-semibold text-indigo-700">Billable</h1>
        <p className="mt-2 text-center text-sm text-slate-500">Track time. Send invoices. See overruns coming.</p>

        <form className="mt-8 space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <ErrorBanner message={error} />
          {notice === 'check-email' && (
            <p className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              Check your email for a confirmation link, then sign in.
            </p>
          )}
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field label="Password" name="password" type="password" autoComplete="current-password" minLength={6} required />
          <div className="flex gap-2">
            <button formAction={signInAction} className="flex-1 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              Sign in
            </button>
            <button formAction={signUpAction} className={`flex-1 ${secondaryButtonClass}`}>
              Sign up
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

