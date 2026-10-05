import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
import { signOutAction } from './actions';

const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/clients', label: 'Clients' },
  { href: '/projects', label: 'Projects' },
  { href: '/time', label: 'Time' },
  { href: '/invoices', label: 'Invoices' },
];

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const { user } = await requireUser();
  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="text-lg font-semibold text-indigo-700">
            Billable
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-slate-600 hover:text-slate-900">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-slate-500">
            <span data-testid="user-email">{user.email}</span>
            <form action={signOutAction}>
              <button type="submit" className="text-slate-600 underline-offset-2 hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
