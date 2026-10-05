import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
import { projectHealth } from '@/lib/billing';
import { formatHours, formatMoney } from '@/lib/format';
import { Card, EmptyState, ErrorBanner, PageHeader, SelectField, StatusBadge, Table, tdClass } from '@/components/ui';
import { SubmitButton } from '@/components/buttons';
import { ProjectForm } from '@/components/project-form';
import { BurnBar, ForecastFlag } from '@/components/burn';
import { createProjectAction } from '../actions';

export default async function ProjectsPage({ searchParams }: PageProps<'/projects'>) {
  const { error } = await searchParams;
  const { supabase } = await requireUser();
  const [projectsRes, clientsRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id, name, status, hourly_rate, budget_hours, start_date, end_date, clients(id, name), time_entries(hours)')
      .order('created_at', { ascending: false }),
    supabase.from('clients').select('id, name').order('name'),
  ]);
  const projects = (projectsRes.data ?? []).map((p) => ({ ...p, health: projectHealth(p, p.time_entries) }));
  const clients = clientsRes.data ?? [];

  return (
    <>
      <PageHeader title="Projects" />
      <ErrorBanner message={error} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {!projects.length ? (
            <EmptyState>No projects yet.</EmptyState>
          ) : (
            <Table head={['Project', 'Client', 'Status', 'Rate', 'Hours', 'Burn', 'Forecast']}>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td className={tdClass}>
                    <Link href={`/projects/${p.id}`} className="font-medium text-indigo-700 hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className={tdClass}>{p.clients?.name}</td>
                  <td className={tdClass}>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className={`${tdClass} tabular-nums`}>{formatMoney(p.hourly_rate)}</td>
                  <td className={`${tdClass} tabular-nums`}>{formatHours(p.health.hoursUsed)}</td>
                  <td className={`${tdClass} w-40`}>
                    <BurnBar pct={p.health.burnPct} />
                  </td>
                  <td className={tdClass}>
                    <ForecastFlag forecast={p.health.forecast} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <Card title="New project">
          {!clients.length ? (
            <EmptyState>
              <Link href="/clients" className="text-indigo-600 underline">
                Add a client
              </Link>{' '}
              first.
            </EmptyState>
          ) : (
            <form action={createProjectAction} className="space-y-4">
              <SelectField label="Client" name="client_id" required>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
              <ProjectForm />
              <SubmitButton>Add project</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
