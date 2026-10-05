import { redirect } from 'next/navigation';

/** Redirects back to `path` with an error message the page renders in an ErrorBanner. */
export function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export function text(fd: FormData, key: string): string | null {
  const value = String(fd.get(key) ?? '').trim();
  return value === '' ? null : value;
}

export function num(fd: FormData, key: string): number | null {
  const raw = text(fd, key);
  if (raw == null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : NaN;
}

/** Turns Postgres/PostgREST errors into messages a user can act on. */
export function friendlyError(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'That already exists.';
  if (error.code === '23503') return 'That record no longer exists or is not yours.';
  if (error.code === '23514') {
    // Our triggers raise check_violation with a readable message; plain check constraints do not.
    return /violates check constraint/.test(error.message) ? 'One of the values is out of range.' : error.message;
  }
  if (error.code === 'P0002') return error.message; // no_data_found from generate_invoice
  if (error.code === '42501') return 'You do not have access to that.';
  return 'Something went wrong. Please try again.';
}
