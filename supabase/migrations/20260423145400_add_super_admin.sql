-- Super Admin Access Migration
-- Grant global access to specifically designated administrative emails

-- We can create a simple table for superadmins for future scalability
create table if not exists public.rk_superadmins (
    email text primary key
);

-- Register the specified super admin
insert into public.rk_superadmins (email) 
values ('cbienaime@rukisha.co.rw')
on conflict (email) do nothing;

-- Function to check if a user is a super admin
create or replace function public.is_superadmin(user_email text)
returns boolean as $$
begin
  return exists (
    select 1 from public.rk_superadmins 
    where email = user_email
  );
end;
$$ language plpgsql security definer;

-- Update rk_project policy
drop policy if exists "rk_project_isolation" on public.rk_project;
create policy "rk_project_isolation" 
on public.rk_project for all 
using (
  is_superadmin(current_setting('app.user_email', true))
  or exists (
    select 1 from rk_team 
    where rk_team.project_id = id 
    and rk_team.email = current_setting('app.user_email', true)
  )
);

-- Update rk_sections policy
drop policy if exists "rk_sections_isolation" on public.rk_sections;
create policy "rk_sections_isolation" 
on public.rk_sections for all 
using (
  is_superadmin(current_setting('app.user_email', true))
  or exists (
    select 1 from rk_team 
    where rk_team.project_id = rk_sections.project_id 
    and rk_team.email = current_setting('app.user_email', true)
  )
);

-- Update rk_tasks policy
drop policy if exists "rk_tasks_isolation" on public.rk_tasks;
create policy "rk_tasks_isolation" 
on public.rk_tasks for all 
using (
  is_superadmin(current_setting('app.user_email', true))
  or exists (
    select 1 from rk_team 
    where rk_team.project_id = rk_tasks.project_id 
    and rk_team.email = current_setting('app.user_email', true)
  )
);

-- Update rk_stakeholders policy
drop policy if exists "rk_stakeholders_isolation" on public.rk_stakeholders;
create policy "rk_stakeholders_isolation" 
on public.rk_stakeholders for all 
using (
  is_superadmin(current_setting('app.user_email', true))
  or exists (
    select 1 from rk_team 
    where rk_team.project_id = rk_stakeholders.project_id 
    and rk_team.email = current_setting('app.user_email', true)
  )
);

-- Update rk_team policy
drop policy if exists "rk_team_isolation" on public.rk_team;
create policy "rk_team_isolation" 
on public.rk_team for all 
using (
  is_superadmin(current_setting('app.user_email', true))
  or exists (
    select 1 from rk_team as internal 
    where internal.project_id = rk_team.project_id 
    and internal.email = current_setting('app.user_email', true)
  )
);
