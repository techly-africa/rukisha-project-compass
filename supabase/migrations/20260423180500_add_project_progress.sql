-- Add progress calculation to the project discovery RPC
drop function if exists public.get_user_projects(text);

create or replace function public.get_user_projects(p_email text)
returns table (
  id uuid,
  name text,
  go_live_date date,
  updated_at timestamptz,
  is_archived boolean,
  progress numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_super boolean;
begin
  -- Check if super admin
  select exists(select 1 from rk_superadmins where lower(email) = lower(p_email)) into v_is_super;
  
  if v_is_super then
    return query 
    select 
      p.id, 
      p.name, 
      p.go_live_date, 
      p.updated_at, 
      p.is_archived,
      coalesce((select round(avg(percent_complete)) from rk_tasks where project_id = p.id), 0)::numeric as progress
    from rk_project p 
    order by p.updated_at desc;
  else
    return query
    select 
      p.id, 
      p.name, 
      p.go_live_date, 
      p.updated_at, 
      p.is_archived,
      coalesce((select round(avg(percent_complete)) from rk_tasks where project_id = p.id), 0)::numeric as progress
    from rk_project p
    where p.id in (select project_id from rk_team where lower(email) = lower(p_email))
    and p.is_archived = false
    order by p.updated_at desc;
  end if;
end;
$$;
