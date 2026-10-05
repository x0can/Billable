// Security test: proves Row Level Security isolates tenants at the database layer.
// These run against a real local Supabase (Postgres + PostgREST + Auth), not mocks.
import { beforeAll, describe, expect, it } from 'vitest';
import { anonClient, newUser, type Db } from './helpers';

let alice: { db: Db; id: string };
let bob: { db: Db; id: string };
let aliceClientId: string;
let aliceProjectId: string;

beforeAll(async () => {
  alice = await newUser('alice');
  bob = await newUser('bob');

  const client = await alice.db.from('clients').insert({ name: 'Alice Co', email: 'ap@alice.test' }).select('id').single();
  if (client.error) throw client.error;
  aliceClientId = client.data.id;

  const project = await alice.db
    .from('projects')
    .insert({ client_id: aliceClientId, name: 'Secret project', hourly_rate: 100 })
    .select('id')
    .single();
  if (project.error) throw project.error;
  aliceProjectId = project.data.id;

  const entry = await alice.db.from('time_entries').insert({ project_id: aliceProjectId, hours: 3 });
  if (entry.error) throw entry.error;
});

describe('Row Level Security', () => {
  it("lets a user read their own clients (so the next test isn't vacuous)", async () => {
    const { data, error } = await alice.db.from('clients').select('id, name');
    expect(error).toBeNull();
    expect(data).toEqual([{ id: aliceClientId, name: 'Alice Co' }]);
  });

  it("stops user B reading user A's clients", async () => {
    const all = await bob.db.from('clients').select('id');
    expect(all.error).toBeNull();
    expect(all.data).toEqual([]);

    // Even asking for the exact id returns nothing.
    const byId = await bob.db.from('clients').select('id, name, email').eq('id', aliceClientId);
    expect(byId.data).toEqual([]);
  });

  it("stops user B reading user A's projects and hours", async () => {
    expect((await bob.db.from('projects').select('id')).data).toEqual([]);
    expect((await bob.db.from('time_entries').select('id')).data).toEqual([]);
    expect((await bob.db.from('invoices').select('id')).data).toEqual([]);
  });

  it("stops user B updating or deleting user A's client", async () => {
    const update = await bob.db.from('clients').update({ name: 'pwned' }).eq('id', aliceClientId).select();
    expect(update.data).toEqual([]);

    const del = await bob.db.from('clients').delete().eq('id', aliceClientId).select();
    expect(del.data).toEqual([]);

    const check = await alice.db.from('clients').select('name').eq('id', aliceClientId).single();
    expect(check.data?.name).toBe('Alice Co');
  });

  it('stops user B inserting rows owned by user A', async () => {
    const { error } = await bob.db.from('clients').insert({ name: 'Forged', owner_id: alice.id });
    expect(error?.code).toBe('42501'); // new row violates row-level security policy
  });

  it("stops user B attaching their own rows to user A's client or project", async () => {
    // Foreign-key checks bypass RLS; the composite same-owner keys in 0002_hardening.sql close this gap.
    const project = await bob.db.from('projects').insert({ client_id: aliceClientId, name: 'Hijack', hourly_rate: 1 });
    expect(project.error?.code).toBe('23503');

    const entry = await bob.db.from('time_entries').insert({ project_id: aliceProjectId, hours: 1 });
    expect(entry.error?.code).toBe('23503');
  });

  it("stops user B invoicing user A's client", async () => {
    const { error } = await bob.db.rpc('generate_invoice', { p_client_id: aliceClientId, p_tax_rate: 0 });
    expect(error).not.toBeNull();
    // ...and Alice's hours are still unbilled.
    const entries = await alice.db.from('time_entries').select('invoice_id').eq('project_id', aliceProjectId);
    expect(entries.data).toEqual([{ invoice_id: null }]);
  });

  it('gives a signed-out visitor nothing', async () => {
    const anon = anonClient();
    expect((await anon.from('clients').select('id')).data).toEqual([]);
    const insert = await anon.from('clients').insert({ name: 'Anon' });
    expect(insert.error).not.toBeNull();
    const rpc = await anon.rpc('generate_invoice', { p_client_id: aliceClientId });
    expect(rpc.error).not.toBeNull();
  });
});
