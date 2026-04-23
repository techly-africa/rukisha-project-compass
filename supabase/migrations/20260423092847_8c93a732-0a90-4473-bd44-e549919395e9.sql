
-- Project (single shared project for now)
create table public.rk_project (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Rukisha Launch',
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

-- Seed default project + sections + tasks
do $$
declare
  pid uuid;
  s1 uuid; s2 uuid; s3 uuid;
begin
  insert into public.rk_project (name) values ('Rukisha Launch') returning id into pid;
  insert into public.rk_sections (project_id, name, color, position) values (pid, 'Legal & Business', '#1A3C5E', 0) returning id into s1;
  insert into public.rk_sections (project_id, name, color, position) values (pid, 'Compliance', '#2E75B6', 1) returning id into s2;
  insert into public.rk_sections (project_id, name, color, position) values (pid, 'Technical', '#C9A227', 2) returning id into s3;

  insert into public.rk_tasks (project_id, section_id, activity, owner, plan_start, plan_duration, actual_start, actual_duration, percent_complete, position) values
    (pid, s1, 'Register company', 'Alice Mwangi', current_date - 20, 5, current_date - 20, 5, 100, 0),
    (pid, s1, 'Open business bank account', 'Brian Otieno', current_date - 14, 7, current_date - 13, 8, 100, 1),
    (pid, s1, 'Draft shareholder agreement', 'Cynthia Wambui', current_date - 7, 10, current_date - 6, 8, 60, 2),
    (pid, s2, 'Data Protection registration', 'David Kimani', current_date - 5, 8, current_date - 3, 6, 40, 3),
    (pid, s2, 'AML/KYC policy', 'Esther Njoroge', current_date - 2, 12, current_date - 1, 4, 25, 4),
    (pid, s2, 'Regulator submission', 'Frank Owino', current_date + 3, 14, null, 0, 0, 5),
    (pid, s3, 'Architecture design', 'Grace Achieng', current_date - 10, 7, current_date - 10, 7, 100, 6),
    (pid, s3, 'Build core API', 'Henry Mutiso', current_date - 3, 14, current_date - 2, 10, 55, 7),
    (pid, s3, 'Frontend MVP', 'Ivy Kariuki', current_date + 2, 14, null, 0, 0, 8),
    (pid, s3, 'Security audit', 'Joel Wafula', current_date + 14, 7, null, 0, 0, 9);
end $$;
