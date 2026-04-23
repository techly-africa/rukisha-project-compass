-- Access Check RPC
-- This allows the front-end to verify access without hitting RLS recursion issues or needing pre-set session variables

create or replace function public.check_access(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. Check super admin
  if exists (select 1 from rk_superadmins where email = p_email) then
    return true;
  end if;
  
  -- 2. Check team member
  return exists (select 1 from rk_team where email = p_email);
end;
$$;
