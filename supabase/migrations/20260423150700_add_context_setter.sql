-- Context Setter RPC
-- Sets the 'app.user_email' setting for the current session

create or replace function public.set_user_context(p_email text)
returns void
language plpgsql
security definer
as $$
begin
  perform set_config('app.user_email', p_email, false);
end;
$$;
