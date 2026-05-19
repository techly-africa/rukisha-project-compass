-- RPC for subtask updates to avoid CORS PATCH restrictions on rk_subtasks.
-- Uses POST (RPC) instead of PATCH (direct table update), matching the
-- update_task_secure pattern used for task updates.
create or replace function public.update_subtask_secure(
  p_id uuid,
  p_title text,
  p_assignee text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update rk_subtasks
  set
    title    = p_title,
    assignee = p_assignee
  where id = p_id;
end;
$$;

grant execute on function public.update_subtask_secure(uuid, text, text) to anon, authenticated;
