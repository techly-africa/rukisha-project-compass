-- Add archiving capability to missions
ALTER TABLE public.rk_project ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Policy adjustment: ensure archived projects still follow the same access rules
-- (The existing policies already check has_project_access for ALL operations, 
-- including select/update on archived flags)
