-- 1. Ensure rk_team exists with correct columns
create table if not exists public.rk_team (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.rk_project(id) on delete cascade,
  email text not null,
  name text not null default '',
  added_at timestamptz not null default now()
);

-- 2. Ensure indexes exist
do $$ 
begin
  if not exists (select 1 from pg_indexes where indexname = 'rk_team_project_id_idx') then
    create index rk_team_project_id_idx on public.rk_team(project_id);
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'rk_team_email_idx') then
    create index rk_team_email_idx on public.rk_team(email);
  end if;
end $$;

-- 3. Enable RLS and ensure policies exist
alter table public.rk_team enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'rk_team_all' and tablename = 'rk_team') then
    create policy "rk_team_all" on public.rk_team for all using (true) with check (true);
  end if;
end $$;

-- 4. Ensure Realtime is enabled
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'rk_team') then
    alter publication supabase_realtime add table public.rk_team;
  end if;
end $$;

alter table public.rk_project replica identity full;
alter table public.rk_sections replica identity full;
alter table public.rk_tasks replica identity full;
alter table public.rk_team replica identity full;
