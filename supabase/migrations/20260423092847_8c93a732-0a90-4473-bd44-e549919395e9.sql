
-- Project (single shared project for now)
create table public.rk_project (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'New Project',
  go_live_date date not null default (current_date + interval '28 days'),
  updated_at timestamptz not null default now()
);

create table public.rk_sections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rk_project(id) on delete cascade,
  name text not null,
  color text not null default '#2E75B6',
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.rk_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rk_project(id) on delete cascade,
  section_id uuid not null references public.rk_sections(id) on delete cascade,
  activity text not null default 'New task',
  owner text not null default '',
  plan_start date not null default current_date,
  plan_duration int not null default 5,
  actual_start date,
  actual_duration int not null default 0,
  percent_complete int not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index on public.rk_sections(project_id, position);
create index on public.rk_tasks(project_id, position);
create index on public.rk_tasks(section_id);

alter table public.rk_project enable row level security;
alter table public.rk_sections enable row level security;
alter table public.rk_tasks enable row level security;

-- Public collaborative access (no auth in this demo tracker)
create policy "rk_project_all" on public.rk_project for all using (true) with check (true);
create policy "rk_sections_all" on public.rk_sections for all using (true) with check (true);
create policy "rk_tasks_all" on public.rk_tasks for all using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table public.rk_project;
alter publication supabase_realtime add table public.rk_sections;
alter publication supabase_realtime add table public.rk_tasks;
alter table public.rk_project replica identity full;
alter table public.rk_sections replica identity full;
alter table public.rk_tasks replica identity full;

-- End of migration
