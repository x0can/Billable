import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { toCsv } from '@/lib/csv';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { data, error } = await supabase
    .from('time_entries')
    .select('entry_date, hours, description, billable, projects(name, hourly_rate, clients(name)), invoices(number)')
    .order('entry_date', { ascending: false });
  if (error) return new NextResponse('Export failed', { status: 500 });

  const rows = data.map((e) => ({
    date: e.entry_date,
    client: e.projects?.clients?.name ?? '',
    project: e.projects?.name ?? '',
    hours: e.hours,
    rate: e.projects?.hourly_rate ?? 0,
    billable: e.billable ? 'yes' : 'no',
    invoice: e.invoices?.number ?? '',
    description: e.description,
  }));

  const csv = toCsv(rows, ['date', 'client', 'project', 'hours', 'rate', 'billable', 'invoice', 'description']);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="billable-time-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
