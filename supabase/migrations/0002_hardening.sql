-- Hardening on top of 0001: same-owner references, invoice locking, and atomic invoice generation.

-- 1. Indexes for RLS filters and foreign keys ------------------------------------------------
create index clients_owner_idx on clients (owner_id);
create index projects_owner_idx on projects (owner_id);
create index projects_client_idx on projects (client_id);
create index invoices_owner_idx on invoices (owner_id);
create index invoices_client_idx on invoices (client_id);
create index time_entries_owner_idx on time_entries (owner_id);
create index time_entries_project_idx on time_entries (project_id);
create index time_entries_invoice_idx on time_entries (invoice_id);

-- 2. Same-owner references ------------------------------------------------------------------
-- Foreign-key checks bypass RLS, so without this user B could attach a project to user A's
-- client just by knowing its UUID. Composite keys force every child row to share its parent's owner.
alter table clients add constraint clients_id_owner_key unique (id, owner_id);
alter table projects add constraint projects_id_owner_key unique (id, owner_id);
alter table invoices add constraint invoices_id_owner_key unique (id, owner_id);

alter table projects add constraint projects_client_same_owner
  foreign key (client_id, owner_id) references clients (id, owner_id) on delete cascade;
alter table invoices add constraint invoices_client_same_owner
  foreign key (client_id, owner_id) references clients (id, owner_id) on delete cascade;
alter table time_entries add constraint time_entries_project_same_owner
  foreign key (project_id, owner_id) references projects (id, owner_id) on delete cascade;
alter table time_entries add constraint time_entries_invoice_same_owner
  foreign key (invoice_id, owner_id) references invoices (id, owner_id) on delete set null (invoice_id);

-- The composite keys replace the single-column ones; keeping both would also make PostgREST
-- embeds such as projects(clients(name)) ambiguous.
alter table projects drop constraint projects_client_id_fkey;
alter table invoices drop constraint invoices_client_id_fkey;
alter table time_entries drop constraint time_entries_project_id_fkey;
alter table time_entries drop constraint time_entries_invoice_id_fkey;

alter table projects add constraint projects_dates_ordered
  check (end_date is null or start_date is null or end_date >= start_date);
alter table invoices add constraint invoices_tax_rate_range
  check (tax_rate >= 0 and tax_rate <= 100);

-- 3. Hours locked to an invoice cannot be edited or deleted ------------------------------------
-- pg_trigger_depth() = 1 means a direct statement; cascades from deleting a client or project run deeper.
create function public.guard_locked_time_entry() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.invoice_id is not null and pg_trigger_depth() = 1 then
      raise exception 'time entry is locked to an invoice' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- Unlinking (invoice deleted) is allowed; any other change to a locked row is not.
  if old.invoice_id is not null and new.invoice_id is not null then
    raise exception 'time entry is locked to an invoice' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger time_entries_locked
  before update or delete on time_entries
  for each row execute function public.guard_locked_time_entry();

-- A project with invoiced hours cannot be deleted on its own (its invoices would lose their lines).
-- Deleting the whole client still cascades, because that removes the invoices too.
create function public.guard_project_delete() returns trigger
language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() = 1
     and exists (select 1 from public.time_entries where project_id = old.id and invoice_id is not null) then
    raise exception 'this project has invoiced hours and cannot be deleted' using errcode = 'check_violation';
  end if;
  return old;
end $$;

create trigger projects_guard_delete
  before delete on projects
  for each row execute function public.guard_project_delete();

-- 4. Invoice lifecycle: draft → sent → paid, and only drafts can change or be deleted ---------
create function public.guard_invoice() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and pg_trigger_depth() = 1 then
      raise exception 'only draft invoices can be deleted' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if new.status is distinct from old.status
     and not ((old.status = 'draft' and new.status = 'sent') or (old.status = 'sent' and new.status = 'paid')) then
    raise exception 'invalid invoice status change: % -> %', old.status, new.status using errcode = 'check_violation';
  end if;

  if old.status <> 'draft'
     and (new.number, new.client_id, new.tax_rate, new.total, new.issued_on)
         is distinct from (old.number, old.client_id, old.tax_rate, old.total, old.issued_on) then
    raise exception 'issued invoices cannot be edited' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger invoices_guard
  before update or delete on invoices
  for each row execute function public.guard_invoice();

-- 5. Atomic invoice generation -----------------------------------------------------------------
-- security invoker: runs as the calling user, so RLS still applies to every statement inside.
create function public.generate_invoice(p_client_id uuid, p_tax_rate numeric default 0, p_due_on date default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_invoice uuid;
  v_next int;
  v_subtotal numeric;
begin
  if v_owner is null then
    raise exception 'not authenticated' using errcode = 'insufficient_privilege';
  end if;

  -- Serialise numbering per user so two tabs cannot both take INV-0007.
  perform pg_advisory_xact_lock(hashtext('invoice:' || v_owner::text));

  select coalesce(max(substring(number from '^INV-(\d+)$')::int), 0) + 1
    into v_next
    from public.invoices
   where owner_id = v_owner;

  insert into public.invoices (client_id, number, tax_rate, due_on)
  values (p_client_id, 'INV-' || lpad(v_next::text, 4, '0'), p_tax_rate, coalesce(p_due_on, current_date + 30))
  returning id into v_invoice;

  with locked as (
    update public.time_entries te
       set invoice_id = v_invoice
      from public.projects p
     where te.project_id = p.id
       and p.client_id = p_client_id
       and te.billable
       and te.invoice_id is null
    returning te.hours, p.hourly_rate
  )
  select coalesce(sum(hours * hourly_rate), 0) into v_subtotal from locked;

  if v_subtotal = 0 then
    -- Raising rolls back the invoice insert above.
    raise exception 'no unbilled billable hours for this client' using errcode = 'no_data_found';
  end if;

  update public.invoices
     set total = round(v_subtotal * (1 + p_tax_rate / 100), 2)
   where id = v_invoice;

  return v_invoice;
end $$;

revoke all on function public.generate_invoice(uuid, numeric, date) from public, anon;
grant execute on function public.generate_invoice(uuid, numeric, date) to authenticated;
