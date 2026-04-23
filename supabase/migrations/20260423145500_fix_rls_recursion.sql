-- Fix for RLS Recursion (Resolving 500 Error)
-- Moving team checks into security definer functions to prevent infinite recursion

-- 1. Helper for general project access
create or replace function public.has_project_access(p_id uuid, user_email text)
returns boolean as $$
begin
  -- Super admins have access to everything
  if exists (select 1 from public.rk_superadmins where email = user_email) then
    return true;
  end if;
  
  -- Regular check against team members
  return exists (
    select 1 from public.rk_team 
    where project_id = p_id 
    and email = user_email
  );
end;
$$ language plpgsql security definer;

-- 2. Update policies to use the new helper
-- We also need to cast current_setting to text and handle NULL

-- rk_project
drop policy if exists "rk_project_isolation" on public.rk_project;
create policy "rk_project_isolation" 
on public.rk_project for all 
using (
  public.has_project_access(id, current_setting('app.user_email', true))
);

-- rk_sections
drop policy if exists "rk_sections_isolation" on public.rk_sections;
create policy "rk_sections_isolation" 
on public.rk_sections for all 
using (
  public.has_project_access(project_id, current_setting('app.user_email', true))
);

-- rk_tasks
drop policy if exists "rk_tasks_isolation" on public.rk_tasks;
create policy "rk_tasks_isolation" 
on public.rk_tasks for all 
using (
  public.has_project_access(project_id, current_setting('app.user_email', true))
);

-- rk_stakeholders
drop policy if exists "rk_stakeholders_isolation" on public.rk_stakeholders;
create policy "rk_stakeholders_isolation" 
on public.rk_stakeholders for all 
using (
  public.has_project_access(project_id, current_setting('app.user_email', true))
);

-- rk_team (THE CRITICAL ONE)
drop policy if exists "rk_team_isolation" on public.rk_team;
create policy "rk_team_isolation" 
on public.rk_team for all 
using (
  public.has_project_access(project_id, current_setting('app.user_email', true))
);
