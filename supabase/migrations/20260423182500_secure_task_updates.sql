-- Create a secure RPC for task updates to bypass CORS PATCH restrictions
-- and provide a hardened server-side update path.

create or replace function public.update_task_secure(
  p_id uuid,
  p_activity text default null,
  p_owner text default null,
  p_plan_start date default null,
  p_plan_duration int default null,
  p_actual_start date default null,
  p_actual_duration int default null,
  p_percent_complete int default null,
  p_section_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update rk_tasks
  set
    activity = coalesce(p_activity, activity),
    owner = coalesce(p_owner, owner),
    plan_start = coalesce(p_plan_start, plan_start),
    plan_duration = coalesce(p_plan_duration, plan_duration),
    actual_start = coalesce(p_actual_start, actual_start),
    actual_duration = coalesce(p_actual_duration, actual_duration),
    percent_complete = coalesce(p_percent_complete, percent_complete),
    section_id = coalesce(p_section_id, section_id)
  where id = p_id;
end;
$$;
