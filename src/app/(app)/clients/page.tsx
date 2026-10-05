import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
import { Card, EmptyState, ErrorBanner, Field, PageHeader, Table, tdClass } from '@/components/ui';
import { SubmitButton } from '@/components/buttons';
import { createClientAction } from '../actions';

export default async function ClientsPage({ searchParams }: PageProps<'/clients'>) {
  const { error } = await searchParams;
  const { supabase } = await requireUser();
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, projects(count)')
    .order('name');

  return (
    <>
      <PageHeader title="Clients" />
      <ErrorBanner message={error} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {!clients?.length ? (
            <EmptyState>No clients yet.</EmptyState>
          ) : (
            <Table head={['Name', 'Email', 'Projects']}>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td className={tdClass}>
                    <Link href={`/clients/${c.id}`} className="font-medium text-indigo-700 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className={tdClass}>{c.email}</td>
                  <td className={`${tdClass} tabular-nums`}>{c.projects[0]?.count ?? 0}</td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="New client">
          <form action={createClientAction} className="space-y-4">
            <Field label="Name" name="name" required />
            <Field label="Email" name="email" type="email" />
            <SubmitButton>Add client</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
