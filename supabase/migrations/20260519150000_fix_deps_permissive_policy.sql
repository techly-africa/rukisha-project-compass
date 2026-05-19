-- rk_task_dependencies was created without the permissive fallback policy that every
-- other table in this schema has (e.g. rk_tasks_all: using (true) with check (true)).
-- The isolation policy alone blocks all operations because app.user_email is never set
-- via set_user_context before direct table access — only the RPCs set it.
-- Adding the same permissive fallback makes the table behave consistently.
create policy "rk_task_dependencies_all" on public.rk_task_dependencies
  for all
  using (true)
  with check (true);
