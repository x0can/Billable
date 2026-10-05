'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/supabase/server';
import { fail, friendlyError, num, text } from '@/lib/forms';
import { nextInvoiceStatus, nextProjectStatus, type InvoiceStatus, type ProjectStatus } from '@/lib/billing';

// Every action re-checks the session: server actions are public POST endpoints.
// Ownership is enforced by RLS in the database, not here.

function done(path: string): never {
  revalidatePath('/', 'layout');
  redirect(path);
}

// Clients ----------------------------------------------------------------------------------

export async function createClientAction(fd: FormData) {
  const { supabase } = await requireUser();
  const name = text(fd, 'name');
  if (!name) fail('/clients', 'Client name is required.');
  const { data, error } = await supabase
    .from('clients')
    .insert({ name, email: text(fd, 'email') })
    .select('id')
    .single();
  if (error) fail('/clients', friendlyError(error));
  done(`/clients/${data.id}`);
}

export async function updateClientAction(id: string, fd: FormData) {
  const { supabase } = await requireUser();
  const name = text(fd, 'name');
  if (!name) fail(`/clients/${id}`, 'Client name is required.');
  const { error } = await supabase.from('clients').update({ name, email: text(fd, 'email') }).eq('id', id);
  if (error) fail(`/clients/${id}`, friendlyError(error));
  done(`/clients/${id}`);
}

export async function deleteClientAction(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) fail(`/clients/${id}`, friendlyError(error));
  done('/clients');
}

// Projects ---------------------------------------------------------------------------------

function projectFields(fd: FormData) {
  return {
    name: text(fd, 'name'),
    hourly_rate: num(fd, 'hourly_rate'),
    budget_hours: num(fd, 'budget_hours'),
    start_date: text(fd, 'start_date'),
    end_date: text(fd, 'end_date'),
  };
}

function projectError(p: ReturnType<typeof projectFields>): string | null {
  if (!p.name) return 'Project name is required.';
  if (p.hourly_rate == null || Number.isNaN(p.hourly_rate) || p.hourly_rate < 0) return 'Hourly rate must be 0 or more.';
  if (p.budget_hours != null && !(p.budget_hours > 0)) return 'Budgeted hours must be greater than 0.';
  if (p.start_date && p.end_date && p.end_date < p.start_date) return 'End date must be on or after the start date.';
  return null;
}

export async function createProjectAction(fd: FormData) {
  const { supabase } = await requireUser();
  const back = text(fd, 'return_to') ?? '/projects';
  const clientId = text(fd, 'client_id');
  const fields = projectFields(fd);
  const problem = clientId ? projectError(fields) : 'Choose a client.';
  if (problem) fail(back, problem);
  const { data, error } = await supabase
    .from('projects')
    .insert({ ...fields, name: fields.name!, hourly_rate: fields.hourly_rate!, client_id: clientId! })
    .select('id')
    .single();
  if (error) fail(back, friendlyError(error));
  done(`/projects/${data.id}`);
}

export async function updateProjectAction(id: string, fd: FormData) {
  const { supabase } = await requireUser();
  const fields = projectFields(fd);
  const problem = projectError(fields);
  if (problem) fail(`/projects/${id}`, problem);
  const { error } = await supabase
    .from('projects')
    .update({ ...fields, name: fields.name!, hourly_rate: fields.hourly_rate! })
    .eq('id', id);
  if (error) fail(`/projects/${id}`, friendlyError(error));
  done(`/projects/${id}`);
}

export async function advanceProjectAction(id: string, current: ProjectStatus) {
  const { supabase } = await requireUser();
  const next = nextProjectStatus(current);
  if (!next) fail(`/projects/${id}`, 'This project is already completed.');
  const { error } = await supabase.from('projects').update({ status: next }).eq('id', id).eq('status', current);
  if (error) fail(`/projects/${id}`, friendlyError(error));
  done(`/projects/${id}`);
}

export async function deleteProjectAction(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) fail(`/projects/${id}`, friendlyError(error));
  done('/projects');
}

// Time entries -----------------------------------------------------------------------------

export async function logTimeAction(projectId: string, fd: FormData) {
  const { supabase } = await requireUser();
  const back = `/projects/${projectId}`;
  const hours = num(fd, 'hours');
  if (hours == null || Number.isNaN(hours) || hours <= 0 || hours > 24) fail(back, 'Hours must be between 0 and 24.');
  const { error } = await supabase.from('time_entries').insert({
    project_id: projectId,
    hours,
    entry_date: text(fd, 'entry_date') ?? undefined,
    description: text(fd, 'description'),
    billable: fd.get('billable') === 'on',
  });
  if (error) fail(back, friendlyError(error));
  done(back);
}

export async function deleteTimeEntryAction(id: string, projectId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('time_entries').delete().eq('id', id);
  if (error) fail(`/projects/${projectId}`, friendlyError(error));
  done(`/projects/${projectId}`);
}

// Invoices ---------------------------------------------------------------------------------

export async function generateInvoiceAction(clientId: string, fd: FormData) {
  const { supabase } = await requireUser();
  const back = `/clients/${clientId}`;
  const taxRate = num(fd, 'tax_rate') ?? 0;
  if (Number.isNaN(taxRate) || taxRate < 0 || taxRate > 100) fail(back, 'Tax rate must be between 0 and 100.');
  // generate_invoice numbers the invoice and locks the hours in one transaction (see 0002_hardening.sql).
  const { data: invoiceId, error } = await supabase.rpc('generate_invoice', {
    p_client_id: clientId,
    p_tax_rate: taxRate,
    p_due_on: text(fd, 'due_on') ?? undefined,
  });
  if (error) fail(back, friendlyError(error));
  done(`/invoices/${invoiceId}`);
}

export async function advanceInvoiceAction(id: string, current: InvoiceStatus) {
  const { supabase } = await requireUser();
  const next = nextInvoiceStatus(current);
  if (!next) fail(`/invoices/${id}`, 'This invoice is already paid.');
  const { error } = await supabase.from('invoices').update({ status: next }).eq('id', id).eq('status', current);
  if (error) fail(`/invoices/${id}`, friendlyError(error));
  done(`/invoices/${id}`);
}

export async function deleteInvoiceAction(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) fail(`/invoices/${id}`, friendlyError(error));
  done('/invoices');
}

// Auth -------------------------------------------------------------------------------------

export async function signOutAction() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  done('/login');
}
