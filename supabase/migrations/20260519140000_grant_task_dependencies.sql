-- Grant table-level access to anon/authenticated roles on rk_task_dependencies.
-- Required for Supabase REST API: tables created via raw SQL migration (not the dashboard)
-- don't automatically get these grants, causing 401 responses from PostgREST.
grant select, insert, update, delete on public.rk_task_dependencies to anon, authenticated;
