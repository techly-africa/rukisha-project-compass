-- Hardening RLS Access Functions to resolve 406 errors
-- Explicitly setting search_path and handling NULLs properly

create or replace function public.has_project_access(p_id uuid, user_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- If email is missing, no access
  if user_email is null or user_email = '' then
    return false;
  end if;

  -- 1. Check if user is a super admin
  if exists (
    select 1 from rk_superadmins 
    where email = user_email
  ) then
    return true;
  end if;
  
  -- 2. Regular check against team members
  return exists (
    select 1 from rk_team 
    where project_id = p_id 
    and email = user_email
  );
end;
$$;

-- Ensure rk_superadmins has RLS but allows the security-definer function to read it
alter table public.rk_superadmins enable row level security;
drop policy if exists "admin_read_own" on public.rk_superadmins;
create policy "admin_read_own" on public.rk_superadmins 
for select using (email = current_setting('app.user_email', true));

-- Final check on policies to ensure they use the correct schema
drop policy if exists "rk_project_isolation" on public.rk_project;
create policy "rk_project_isolation" on public.rk_project for all 
using (public.has_project_access(id, current_setting('app.user_email', true)));

drop policy if exists "rk_sections_isolation" on public.rk_sections;
create policy "rk_sections_isolation" on public.rk_sections for all 
using (public.has_project_access(project_id, current_setting('app.user_email', true)));

drop policy if exists "rk_tasks_isolation" on public.rk_tasks;
create policy "rk_tasks_isolation" on public.rk_tasks for all 
using (public.has_project_access(project_id, current_setting('app.user_email', true)));

drop policy if exists "rk_stakeholders_isolation" on public.rk_stakeholders;
create policy "rk_stakeholders_isolation" on public.rk_stakeholders for all 
using (public.has_project_access(project_id, current_setting('app.user_email', true)));

drop policy if exists "rk_team_isolation" on public.rk_team;
create policy "rk_team_isolation" on public.rk_team for all 
using (public.has_project_access(project_id, current_setting('app.user_email', true)));
