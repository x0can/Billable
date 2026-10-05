create table clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  email text,
  created_at timestamptz default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid not null references clients on delete cascade,
  name text not null,
  status text not null default 'proposal' check (status in ('proposal','active','completed')),
  hourly_rate numeric(10,2) not null check (hourly_rate >= 0),
  budget_hours numeric(8,2) check (budget_hours > 0),
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid not null references clients on delete cascade,
  number text not null,
  status text not null default 'draft' check (status in ('draft','sent','paid')),
  issued_on date default current_date,
  due_on date,
  tax_rate numeric(5,2) not null default 0,
  total numeric(12,2) not null default 0,
  unique (owner_id, number)
);

create table time_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references projects on delete cascade,
  invoice_id uuid references invoices on delete set null,
  entry_date date not null default current_date,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  description text,
  billable boolean not null default true
);

-- Row Level Security: each user only ever sees their own rows
do $$ declare t text;
begin
  foreach t in array array['clients','projects','invoices','time_entries'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "owner_all" on %I for all using (owner_id = auth.uid()) with check (owner_id = auth.uid())', t);
  end loop;
end $$;
