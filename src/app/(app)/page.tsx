import Link from 'next/link';
import { requireUser } from '@/lib/supabase/server';
import { projectHealth, revenueSummary, type InvoiceStatus } from '@/lib/billing';
import { formatHours, formatMoney } from '@/lib/format';
import { Card, EmptyState, PageHeader, StatusBadge, Table, tdClass } from '@/components/ui';
import { BurnBar, ForecastFlag } from '@/components/burn';

export default async function DashboardPage() {
  const { supabase } = await requireUser();

  const [invoicesRes, unbilledRes, projectsRes] = await Promise.all([
    supabase.from('invoices').select('status, total'),
    supabase.from('time_entries').select('hours, projects(hourly_rate)').eq('billable', true).is('invoice_id', null),
    supabase
      .from('projects')
      .select('id, name, status, budget_hours, start_date, end_date, clients(name), time_entries(hours)')
      .neq('status', 'completed')
      .order('created_at', { ascending: false }),
  ]);

  const revenue = revenueSummary(
    (invoicesRes.data ?? []).map((i) => ({ status: i.status as InvoiceStatus, total: i.total })),
    (unbilledRes.data ?? []).map((e) => ({ hours: e.hours, rate: e.projects?.hourly_rate ?? 0 })),
  );

  const projects = (projectsRes.data ?? []).map((p) => ({ ...p, health: projectHealth(p, p.time_entries) }));
  const atRisk = projects.filter((p) => p.health.forecast?.overrun).length;

  const tiles = [
    { label: 'Billed', value: formatMoney(revenue.billed), hint: 'All invoices' },
    { label: 'Paid', value: formatMoney(revenue.paid), hint: `${formatMoney(revenue.outstanding)} outstanding` },
    { label: 'Unbilled', value: formatMoney(revenue.unbilled), hint: 'Billable hours not yet invoiced (pre-tax)' },
    { label: 'Overrun risk', value: String(atRisk), hint: 'Open projects forecast over budget' },
  ];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Billed vs. unbilled revenue and budget health across open projects." />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{t.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900" data-testid={`tile-${t.label.toLowerCase()}`}>
              {t.value}
            </p>
            <p className="mt-1 text-xs text-slate-400">{t.hint}</p>
          </div>
        ))}
      </div>

      <Card title="Budget burn — open projects">
        {projects.length === 0 ? (
          <EmptyState>
            No open projects yet. <Link className="text-indigo-600 underline" href="/clients">Add a client</Link> to get started.
          </EmptyState>
        ) : (
          <Table head={['Project', 'Client', 'Status', 'Hours', 'Burn', 'Forecast']}>
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
                <td className={`${tdClass} tabular-nums`}>
                  {formatHours(p.health.hoursUsed)}
                  {p.budget_hours != null && <span className="text-slate-400"> / {formatHours(p.budget_hours)}</span>}
                </td>
                <td className={`${tdClass} w-48`}>
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
    </>
  );
}
