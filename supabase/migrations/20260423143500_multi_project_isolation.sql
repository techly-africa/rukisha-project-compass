-- Multi-Project Isolation Migration
-- Enable RLS on all relevant tables
alter table public.rk_project enable row level security;
alter table public.rk_sections enable row level security;
alter table public.rk_tasks enable row level security;
alter table public.rk_team enable row level security;
alter table public.rk_stakeholders enable row level security;

-- Function to get the current user's email from request headers or settings
-- Since we are using an EmailGate with localStorage, we'll pass the email via an RPC or set a variable
-- However, for the purpose of this demo/implementation, we'll assume the email is verified via EmailGate.
-- For true RLS with custom email verification, we'll use a setting 'app.user_email'

-- Drop existing broad policies
drop policy if exists "rk_project_all" on public.rk_project;
drop policy if exists "rk_sections_all" on public.rk_sections;
drop policy if exists "rk_tasks_all" on public.rk_tasks;
drop policy if exists "rk_team_all" on public.rk_team;
drop policy if exists "rk_stakeholders_select" on public.rk_stakeholders;
drop policy if exists "rk_stakeholders_insert" on public.rk_stakeholders;
drop policy if exists "rk_stakeholders_update" on public.rk_stakeholders;
drop policy if exists "rk_stakeholders_delete" on public.rk_stakeholders;

-- Helper to check project access
-- Note: This requires the app to call `SET app.user_email = '...'` before queries.
-- For this session, we will stick to query-level isolation (where clauses) and keep RLS simple for the selector.

create policy "rk_project_isolation" 
on public.rk_project for all 
using (
  exists (
    select 1 from rk_team 
    where rk_team.project_id = id 
    and rk_team.email = current_setting('app.user_email', true)
  )
);

create policy "rk_sections_isolation" 
on public.rk_sections for all 
using (
  exists (
    select 1 from rk_team 
    where rk_team.project_id = rk_sections.project_id 
    and rk_team.email = current_setting('app.user_email', true)
  )
);

create policy "rk_tasks_isolation" 
on public.rk_tasks for all 
using (
  exists (
    select 1 from rk_team 
    where rk_team.project_id = rk_tasks.project_id 
    and rk_team.email = current_setting('app.user_email', true)
  )
);

create policy "rk_stakeholders_isolation" 
on public.rk_stakeholders for all 
using (
  exists (
    select 1 from rk_team 
    where rk_team.project_id = rk_stakeholders.project_id 
    and rk_team.email = current_setting('app.user_email', true)
  )
);

create policy "rk_team_isolation" 
on public.rk_team for all 
using (
  exists (
    select 1 from rk_team as internal 
    where internal.project_id = rk_team.project_id 
    and internal.email = current_setting('app.user_email', true)
  )
);
