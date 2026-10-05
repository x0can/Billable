import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { nextProjectStatus, projectHealth, type ProjectStatus } from '@/lib/billing';
import { formatHours, formatMoney } from '@/lib/format';
import { Card, EmptyState, ErrorBanner, Field, PageHeader, StatusBadge, Table, secondaryButtonClass, tdClass } from '@/components/ui';
import { ConfirmButton, SubmitButton } from '@/components/buttons';
import { ProjectForm } from '@/components/project-form';
import { BurnBar, ForecastFlag } from '@/components/burn';
import {
  advanceProjectAction,
  deleteProjectAction,
  deleteTimeEntryAction,
  logTimeAction,
  updateProjectAction,
} from '../../actions';

export default async function ProjectPage({ params, searchParams }: PageProps<'/projects/[id]'>) {
  const { id } = await params;
  const { error } = await searchParams;
  const { supabase } = await requireUser();

  const { data: project } = await supabase
    .from('projects')
    .select(
      'id, name, status, hourly_rate, budget_hours, start_date, end_date, clients(id, name), time_entries(id, entry_date, hours, description, billable, invoice_id, invoices(number))',
    )
    .eq('id', id)
    .order('entry_date', { referencedTable: 'time_entries', ascending: false })
    .maybeSingle();
  if (!project) notFound();

  const status = project.status as ProjectStatus;
  const next = nextProjectStatus(status);
  const health = projectHealth(project, project.time_entries);

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={
          <>
            <Link href={`/clients/${project.clients?.id}`} className="text-indigo-700 hover:underline">
              {project.clients?.name}
            </Link>{' '}
            · {formatMoney(project.hourly_rate)}/h · <StatusBadge status={status} />
          </>
        }
        actions={
          next && (
            <form action={advanceProjectAction.bind(null, project.id, status)}>
              <SubmitButton className={secondaryButtonClass}>Mark {next}</SubmitButton>
            </form>
          )
        }
      />
      <ErrorBanner message={error} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Hours logged</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatHours(health.hoursUsed)}
            {project.budget_hours != null && <span className="text-base text-slate-400"> / {formatHours(project.budget_hours)}</span>}
          </p>
        </Card>
        <Card>
          <p className="mb-2 text-sm text-slate-500">Budget burn</p>
          <BurnBar pct={health.burnPct} />
        </Card>
        <Card>
          <p className="mb-2 text-sm text-slate-500">Forecast</p>
          <ForecastFlag forecast={health.forecast} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Time entries" className="lg:col-span-2">
          {!project.time_entries.length ? (
            <EmptyState>No hours logged yet.</EmptyState>
          ) : (
            <Table head={['Date', 'Hours', 'Description', 'Billable', 'Invoice', '']}>
              {project.time_entries.map((e) => (
                <tr key={e.id}>
                  <td className={tdClass}>{e.entry_date}</td>
                  <td className={`${tdClass} tabular-nums`}>{formatHours(e.hours)}</td>
                  <td className={tdClass}>{e.description}</td>
                  <td className={tdClass}>{e.billable ? 'Yes' : 'No'}</td>
                  <td className={tdClass}>
                    {e.invoice_id ? (
                      <Link href={`/invoices/${e.invoice_id}`} className="text-indigo-700 hover:underline" title="Locked to this invoice">
                        🔒 {e.invoices?.number}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    {!e.invoice_id && (
                      <form action={deleteTimeEntryAction.bind(null, e.id, project.id)}>
                        <ConfirmButton message="Delete this time entry?">Delete</ConfirmButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Log time">
            <form action={logTimeAction.bind(null, project.id)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hours" name="hours" type="number" min={0.25} max={24} step="0.25" required />
                <Field label="Date" name="entry_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <Field label="Description" name="description" />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="billable" defaultChecked className="h-4 w-4 rounded border-slate-300" />
                Billable
              </label>
              <SubmitButton>Log hours</SubmitButton>
            </form>
          </Card>

          <Card title="Edit project">
            <form action={updateProjectAction.bind(null, project.id)} className="space-y-4">
              <ProjectForm project={project} />
              <SubmitButton>Save</SubmitButton>
            </form>
            <form action={deleteProjectAction.bind(null, project.id)} className="mt-4 border-t border-slate-100 pt-4">
              <ConfirmButton message={`Delete ${project.name} and all of its time entries?`}>Delete project</ConfirmButton>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
