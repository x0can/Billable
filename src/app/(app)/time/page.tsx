import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
import { formatHours } from '@/lib/format';
import { Card, EmptyState, PageHeader, Table, secondaryButtonClass, tdClass } from '@/components/ui';

export default async function TimePage() {
  const { supabase } = await requireUser();
  const { data: entries } = await supabase
    .from('time_entries')
    .select('id, entry_date, hours, description, billable, invoice_id, projects(id, name, clients(name)), invoices(number)')
    .order('entry_date', { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader
        title="Time"
        subtitle="Your 200 most recent entries. Log hours from a project page."
        actions={
          // A plain <a> so the browser downloads the file instead of client-side navigating.
          <a href="/export/time-entries" className={secondaryButtonClass} download>
            Export CSV
          </a>
        }
      />
      <Card>
        {!entries?.length ? (
          <EmptyState>No hours logged yet.</EmptyState>
        ) : (
          <Table head={['Date', 'Project', 'Client', 'Hours', 'Description', 'Billable', 'Invoice']}>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className={tdClass}>{e.entry_date}</td>
                <td className={tdClass}>
                  <Link href={`/projects/${e.projects?.id}`} className="text-indigo-700 hover:underline">
                    {e.projects?.name}
                  </Link>
                </td>
                <td className={tdClass}>{e.projects?.clients?.name}</td>
                <td className={`${tdClass} tabular-nums`}>{formatHours(e.hours)}</td>
                <td className={tdClass}>{e.description}</td>
                <td className={tdClass}>{e.billable ? 'Yes' : 'No'}</td>
                <td className={tdClass}>{e.invoices?.number ?? '—'}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </>
  );
}
