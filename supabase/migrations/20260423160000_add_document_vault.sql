-- 20260423160000_add_document_vault.sql
-- Create the documents metadata table
CREATE TABLE IF NOT EXISTS public.rk_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.rk_project(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    content_type TEXT,
    size_bytes BIGINT,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT -- Email of the uploader
);

-- Helper wrapper to simplify RLS policies
create or replace function public.check_project_access(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_project_access(p_id, current_setting('app.user_email', true));
$$;

-- Enable RLS
ALTER TABLE public.rk_documents ENABLE ROW LEVEL SECURITY;

-- Policies for Document Metadata
CREATE POLICY "Enable access to documents for project members" ON public.rk_documents
    FOR ALL
    TO anon, authenticated
    USING (
        public.check_project_access(project_id)
    )
    WITH CHECK (
        public.check_project_access(project_id)
    );

-- Storage Setup (Supabase Storage)
-- We assume the storage schema exists. We'll insert the bucket if it doesn't.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project_vault', 'project_vault', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- 1. Allow project members to upload to their project's folder
-- Folder structure: project_vault/{project_id}/{filename}

CREATE POLICY "Allow members to upload documents" ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        bucket_id = 'project_vault' AND
        public.check_project_access((storage.foldername(name))[1]::uuid)
    );

CREATE POLICY "Allow members to view documents" ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (
        bucket_id = 'project_vault' AND
        public.check_project_access((storage.foldername(name))[1]::uuid)
    );

CREATE POLICY "Allow members to delete documents" ON storage.objects
    FOR DELETE
    TO anon, authenticated
    USING (
        bucket_id = 'project_vault' AND
        public.check_project_access((storage.foldername(name))[1]::uuid)
    );
