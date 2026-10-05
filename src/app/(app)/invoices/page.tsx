import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/format';
import { Card, EmptyState, PageHeader, StatusBadge, Table, tdClass } from '@/components/ui';

export default async function InvoicesPage() {
  const { supabase } = await requireUser();
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, number, status, issued_on, due_on, total, clients(name)')
    .order('number', { ascending: false });

  return (
    <>
      <PageHeader title="Invoices" subtitle="Generate an invoice from a client's page." />
      <Card>
        {!invoices?.length ? (
          <EmptyState>
            No invoices yet. Open a{' '}
            <Link href="/clients" className="text-indigo-600 underline">
              client
            </Link>{' '}
            with unbilled hours to create one.
          </EmptyState>
        ) : (
          <Table head={['Number', 'Client', 'Issued', 'Due', 'Status', 'Total']}>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className={tdClass}>
                  <Link href={`/invoices/${inv.id}`} className="font-medium text-indigo-700 hover:underline">
                    {inv.number}
                  </Link>
                </td>
                <td className={tdClass}>{inv.clients?.name}</td>
                <td className={tdClass}>{inv.issued_on}</td>
                <td className={tdClass}>{inv.due_on}</td>
                <td className={tdClass}>
                  <StatusBadge status={inv.status} />
                </td>
                <td className={`${tdClass} tabular-nums`}>{formatMoney(inv.total)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
