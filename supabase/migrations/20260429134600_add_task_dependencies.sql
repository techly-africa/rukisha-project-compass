-- Create table for task dependencies
create table if not exists public.rk_task_dependencies (
  id uuid default gen_random_uuid() primary key,
  task_id uuid not null references public.rk_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.rk_tasks(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(task_id, depends_on_task_id)
);

-- Enable RLS
alter table public.rk_task_dependencies enable row level security;

-- Create policies
create policy "Users can view dependencies of their projects" on public.rk_task_dependencies
  for select
  using (
    exists (
      select 1 from public.rk_tasks t
      join public.rk_team m on m.project_id = t.project_id
      where t.id = rk_task_dependencies.task_id
      and m.email = auth.jwt() ->> 'email'
    )
    or
    exists (
      select 1 from public.rk_superadmins
      where email = auth.jwt() ->> 'email'
    )
  );

create policy "Users can manage dependencies of their projects" on public.rk_task_dependencies
  for all
  using (
    exists (
      select 1 from public.rk_tasks t
      join public.rk_team m on m.project_id = t.project_id
      where t.id = rk_task_dependencies.task_id
      and m.email = auth.jwt() ->> 'email'
      and m.role in ('PM', 'Admin')
    )
    or
    exists (
      select 1 from public.rk_superadmins
      where email = auth.jwt() ->> 'email'
    )
  );
