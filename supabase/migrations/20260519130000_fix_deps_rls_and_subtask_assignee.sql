-- Fix rk_task_dependencies RLS policies.
-- The original migration used auth.jwt() ->> 'email' which is wrong for this app's
-- email-based auth. All other tables use current_setting('app.user_email', true).
-- Also grant table-level access to anon/authenticated: required for Supabase REST API
-- when the table was created via raw SQL (not the dashboard).

grant select, insert, update, delete on public.rk_task_dependencies to anon, authenticated;

-- Drop all known policy names on this table to start clean.
drop policy if exists "Users can view dependencies of their projects" on public.rk_task_dependencies;
drop policy if exists "Users can manage dependencies of their projects" on public.rk_task_dependencies;
drop policy if exists "rk_task_dependencies_isolation" on public.rk_task_dependencies;

create policy "rk_task_dependencies_isolation" on public.rk_task_dependencies
  for all
  using (
    exists (
      select 1 from public.rk_tasks t
      where t.id = rk_task_dependencies.task_id
        and public.has_project_access(t.project_id, current_setting('app.user_email', true))
    )
  );

-- Add assignee column to rk_subtasks for per-subtask team member assignment.
alter table public.rk_subtasks add column if not exists assignee text not null default '';
