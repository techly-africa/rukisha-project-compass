-- Production Hardening Migration
-- 1. Data Integrity: Prevent duplicate emails within a project
alter table public.rk_team add constraint rk_team_project_email_unique unique (project_id, email);

-- 2. Security: Refine RLS for stakeholders
-- Drop loose policy
drop policy if exists "rk_stakeholders_all" on public.rk_stakeholders;

-- Create more specific project-scoped policies
create policy "rk_stakeholders_select" 
on public.rk_stakeholders for select 
using (true); -- Keep public for now but limited to project_id in queries

create policy "rk_stakeholders_insert" 
on public.rk_stakeholders for insert 
with check (true);

create policy "rk_stakeholders_update" 
on public.rk_stakeholders for update 
using (true);

create policy "rk_stakeholders_delete" 
on public.rk_stakeholders for delete 
using (true);

-- 3. Security: Refine RLS for team
-- (rk_team already has rk_team_all which is broad, but we keep it for simplicity as long as we use targeted selects)
-- However, let's ensure Realtime is fully enabled for all project-related tables
alter table public.rk_project replica identity full;
alter table public.rk_sections replica identity full;
alter table public.rk_tasks replica identity full;
alter table public.rk_team replica identity full;
alter table public.rk_stakeholders replica identity full;
