import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { invoiceLines, nextInvoiceStatus, roundMoney, type InvoiceStatus } from '@/lib/billing';
import { formatHours, formatMoney } from '@/lib/format';
import { ErrorBanner, StatusBadge, secondaryButtonClass } from '@/components/ui';
import { ConfirmButton, PrintButton, SubmitButton } from '@/components/buttons';
import { advanceInvoiceAction, deleteInvoiceAction } from '../../actions';

export default async function InvoicePage({ params, searchParams }: PageProps<'/invoices/[id]'>) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase, user } = await requireUser();

  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      'id, number, status, issued_on, due_on, tax_rate, total, clients(name, email), time_entries(id, entry_date, hours, description, billable, project_id, projects(name, hourly_rate))',
    )
    .eq('id', id)
    .maybeSingle();
  if (!invoice) notFound();

  const status = invoice.status as InvoiceStatus;
  const next = nextInvoiceStatus(status);
  const lines = invoiceLines(
    invoice.time_entries.map((e) => ({
      hours: e.hours,
      billable: e.billable,
      projectId: e.project_id,
      projectName: e.projects?.name ?? '',
      rate: e.projects?.hourly_rate ?? 0,
    })),
  );
  const subtotal = roundMoney(lines.reduce((sum, l) => sum + l.amount, 0));
  // The stored total was computed in the database when the invoice was generated; it is the amount due.
  const tax = roundMoney(Number(invoice.total) - subtotal);

  return (
    <>
      <div className="no-print">
        <ErrorBanner message={error} />
      </div>
      <div className="no-print mb-6 flex flex-wrap items-center gap-2">
        {next && (
          <form action={advanceInvoiceAction.bind(null, invoice.id, status)}>
            <SubmitButton className={secondaryButtonClass}>Mark as {next}</SubmitButton>
          </form>
        )}
        <PrintButton />
        {status === 'draft' && (
          <form action={deleteInvoiceAction.bind(null, invoice.id)} className="ml-auto">
            <ConfirmButton message={`Delete draft ${invoice.number}? Its hours go back to unbilled.`}>Delete draft</ConfirmButton>
          </form>
        )}
      </div>

      <article className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-10 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Invoice {invoice.number}</h1>
            <p className="mt-1 text-sm text-slate-500">From {user.email}</p>
          </div>
          <StatusBadge status={status} />
        </header>

        <dl className="mt-8 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-slate-500">Bill to</dt>
            <dd className="font-medium text-slate-900">{invoice.clients?.name}</dd>
            <dd className="text-slate-600">{invoice.clients?.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Issued</dt>
            <dd className="text-slate-900">{invoice.issued_on}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Due</dt>
            <dd className="text-slate-900">{invoice.due_on ?? '—'}</dd>
          </div>
        </dl>

        <table className="mt-8 w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-2">Project</th>
              <th className="py-2 text-right">Hours</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.projectId}>
                <td className="py-2">{l.projectName}</td>
                <td className="py-2 text-right tabular-nums">{formatHours(l.hours)}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(l.rate)}</td>
                <td className="py-2 text-right tabular-nums">{formatMoney(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto mt-6 w-64 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="tabular-nums">{formatMoney(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Tax ({Number(invoice.tax_rate)}%)</dt>
            <dd className="tabular-nums">{formatMoney(tax)}</dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular-nums" data-testid="invoice-total">
              {formatMoney(invoice.total)}
            </dd>
          </div>
        </dl>

        <details className="no-print mt-10 text-sm">
          <summary className="cursor-pointer text-slate-500">{invoice.time_entries.length} time entries locked to this invoice</summary>
          <ul className="mt-2 space-y-1 text-slate-600">
            {invoice.time_entries.map((e) => (
              <li key={e.id}>
                {e.entry_date} · {e.projects?.name} · {formatHours(e.hours)} {e.description && `· ${e.description}`}
              </li>
            ))}
          </ul>
        </details>
      </article>
    </>
  );
}
