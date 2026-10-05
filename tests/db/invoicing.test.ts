// Database-level billing rules: atomic invoice generation, hour locking and the status lifecycle.
import { beforeAll, describe, expect, it } from 'vitest';
import { invoiceTotal } from '@/lib/billing';
import { newUser, type Db } from './helpers';

let db: Db;
let clientId: string;
let projectId: string;

async function seedHours(entries: { hours: number; billable: boolean }[]) {
  const { error } = await db.from('time_entries').insert(entries.map((e) => ({ ...e, project_id: projectId })));
  if (error) throw error;
}

beforeAll(async () => {
  ({ db } = await newUser('invoicing'));
  const client = await db.from('clients').insert({ name: 'Acme' }).select('id').single();
  clientId = client.data!.id;
  const project = await db.from('projects').insert({ client_id: clientId, name: 'Site', hourly_rate: 50 }).select('id').single();
  projectId = project.data!.id;
});

describe('generate_invoice', () => {
  let invoiceId: string;
  const entries = [
    { hours: 2, billable: true },
    { hours: 3, billable: true },
    { hours: 4, billable: false },
  ];

  it('totals billable hours × rate + tax, matching the TypeScript rule', async () => {
    await seedHours(entries);
    const { data, error } = await db.rpc('generate_invoice', { p_client_id: clientId, p_tax_rate: 16 });
    expect(error).toBeNull();
    invoiceId = data!;

    const invoice = await db.from('invoices').select('number, status, total').eq('id', invoiceId).single();
    expect(invoice.data).toEqual({ number: 'INV-0001', status: 'draft', total: invoiceTotal(entries, 50, 16) });
    expect(invoice.data?.total).toBe(290);
  });

  it('locks exactly the billable hours to the invoice', async () => {
    const { data } = await db.from('time_entries').select('hours, billable, invoice_id').order('hours');
    expect(data).toEqual([
      { hours: 2, billable: true, invoice_id: invoiceId },
      { hours: 3, billable: true, invoice_id: invoiceId },
      { hours: 4, billable: false, invoice_id: null },
    ]);
  });

  it('refuses edits and deletes on locked hours', async () => {
    const locked = await db.from('time_entries').select('id').eq('invoice_id', invoiceId).limit(1).single();
    const update = await db.from('time_entries').update({ hours: 10 }).eq('id', locked.data!.id);
    expect(update.error?.message).toMatch(/locked/);
    const del = await db.from('time_entries').delete().eq('id', locked.data!.id);
    expect(del.error?.message).toMatch(/locked/);
  });

  it('refuses a project delete while it has invoiced hours', async () => {
    const { error } = await db.from('projects').delete().eq('id', projectId);
    expect(error?.message).toMatch(/invoiced hours/);
  });

  it('refuses to create an empty invoice and leaves no draft behind', async () => {
    const { error } = await db.rpc('generate_invoice', { p_client_id: clientId });
    expect(error?.message).toMatch(/no unbilled billable hours/);
    const { count } = await db.from('invoices').select('id', { count: 'exact', head: true });
    expect(count).toBe(1);
  });

  it('numbers invoices sequentially per user', async () => {
    await seedHours([{ hours: 1, billable: true }]);
    const { data } = await db.rpc('generate_invoice', { p_client_id: clientId });
    const invoice = await db.from('invoices').select('number, total').eq('id', data!).single();
    expect(invoice.data).toEqual({ number: 'INV-0002', total: 50 });
  });

  it('only moves draft → sent → paid', async () => {
    const skip = await db.from('invoices').update({ status: 'paid' }).eq('id', invoiceId);
    expect(skip.error?.message).toMatch(/invalid invoice status change/);

    expect((await db.from('invoices').update({ status: 'sent' }).eq('id', invoiceId)).error).toBeNull();

    const back = await db.from('invoices').update({ status: 'draft' }).eq('id', invoiceId);
    expect(back.error?.message).toMatch(/invalid invoice status change/);

    const edit = await db.from('invoices').update({ total: 1 }).eq('id', invoiceId);
    expect(edit.error?.message).toMatch(/cannot be edited/);

    expect((await db.from('invoices').update({ status: 'paid' }).eq('id', invoiceId)).error).toBeNull();
  });

  it('refuses to delete a sent or paid invoice', async () => {
    const { error } = await db.from('invoices').delete().eq('id', invoiceId);
    expect(error?.message).toMatch(/only draft invoices/);
  });

  it('releases hours back to unbilled when a draft is deleted', async () => {
    const draft = await db.from('invoices').select('id').eq('number', 'INV-0002').single();
    expect((await db.from('invoices').delete().eq('id', draft.data!.id)).error).toBeNull();
    const { data } = await db.from('time_entries').select('invoice_id').eq('hours', 1).single();
    expect(data?.invoice_id).toBeNull();
  });
});
