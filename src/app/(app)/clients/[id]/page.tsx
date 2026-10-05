import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { invoiceLines } from '@/lib/billing';
import { formatHours, formatMoney } from '@/lib/format';
import { Card, EmptyState, ErrorBanner, Field, PageHeader, StatusBadge, Table, tdClass } from '@/components/ui';
import { ConfirmButton, SubmitButton } from '@/components/buttons';
import { ProjectForm } from '@/components/project-form';
import { createProjectAction, deleteClientAction, generateInvoiceAction, updateClientAction } from '../../actions';

export default async function ClientPage({ params, searchParams }: PageProps<'/clients/[id]'>) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireUser();

  const [clientRes, unbilledRes, invoicesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, email, projects(id, name, status, hourly_rate)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('time_entries')
      .select('hours, billable, project_id, projects!inner(name, hourly_rate, client_id)')
      .eq('projects.client_id', id)
      .eq('billable', true)
      .is('invoice_id', null),
    supabase.from('invoices').select('id, number, status, issued_on, total').eq('client_id', id).order('issued_on', { ascending: false }),
  ]);

  // RLS returns no row for another user's client, so this is also the "not yours" path.
  const client = clientRes.data;
  if (!client) notFound();

  const lines = invoiceLines(
    (unbilledRes.data ?? []).map((e) => ({
      hours: e.hours,
      billable: e.billable,
      projectId: e.project_id,
      projectName: e.projects.name,
      rate: e.projects.hourly_rate,
    })),
  );
  const unbilledSubtotal = lines.reduce((sum, l) => sum + l.amount, 0);

  return (
    <>
      <PageHeader title={client.name} subtitle={client.email ?? 'No email on file'} />
      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Projects">
            {!client.projects.length ? (
              <EmptyState>No projects for this client yet.</EmptyState>
            ) : (
              <Table head={['Project', 'Status', 'Rate']}>
                {client.projects.map((p) => (
                  <tr key={p.id}>
                    <td className={tdClass}>
                      <Link href={`/projects/${p.id}`} className="font-medium text-indigo-700 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={p.status} />
                    </td>
                    <td className={`${tdClass} tabular-nums`}>{formatMoney(p.hourly_rate)}/h</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card title="Unbilled billable hours">
            {!lines.length ? (
              <EmptyState>Nothing to invoice. Log billable hours on a project first.</EmptyState>
            ) : (
              <>
                <Table head={['Project', 'Hours', 'Rate', 'Amount']}>
                  {lines.map((l) => (
                    <tr key={l.projectId}>
                      <td className={tdClass}>{l.projectName}</td>
                      <td className={`${tdClass} tabular-nums`}>{formatHours(l.hours)}</td>
                      <td className={`${tdClass} tabular-nums`}>{formatMoney(l.rate)}</td>
                      <td className={`${tdClass} tabular-nums`}>{formatMoney(l.amount)}</td>
                    </tr>
                  ))}
                </Table>
                <form action={generateInvoiceAction.bind(null, client.id)} className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
                  <div className="w-32">
                    <Field label="Tax rate (%)" name="tax_rate" type="number" min={0} max={100} step="0.01" defaultValue={0} />
                  </div>
                  <div className="w-44">
                    <Field label="Due date" name="due_on" type="date" />
                  </div>
                  <SubmitButton>Generate invoice ({formatMoney(unbilledSubtotal)} + tax)</SubmitButton>
                </form>
              </>
            )}
          </Card>

          <Card title="Invoices">
            {!invoicesRes.data?.length ? (
              <EmptyState>No invoices yet.</EmptyState>
            ) : (
              <Table head={['Number', 'Issued', 'Status', 'Total']}>
                {invoicesRes.data.map((inv) => (
                  <tr key={inv.id}>
                    <td className={tdClass}>
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-indigo-700 hover:underline">
                        {inv.number}
                      </Link>
                    </td>
                    <td className={tdClass}>{inv.issued_on}</td>
                    <td className={tdClass}>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className={`${tdClass} tabular-nums`}>{formatMoney(inv.total)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="New project">
            <form action={createProjectAction} className="space-y-4">
              <input type="hidden" name="client_id" value={client.id} />
              <input type="hidden" name="return_to" value={`/clients/${client.id}`} />
              <ProjectForm />
              <SubmitButton>Add project</SubmitButton>
            </form>
          </Card>

          <Card title="Edit client">
            <form action={updateClientAction.bind(null, client.id)} className="space-y-4">
              <Field label="Name" name="name" defaultValue={client.name} required />
              <Field label="Email" name="email" type="email" defaultValue={client.email ?? ''} />
              <SubmitButton>Save</SubmitButton>
            </form>
            <form action={deleteClientAction.bind(null, client.id)} className="mt-4 border-t border-slate-100 pt-4">
              <ConfirmButton message={`Delete ${client.name}? This also deletes its projects, hours and invoices.`}>
                Delete client
              </ConfirmButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
