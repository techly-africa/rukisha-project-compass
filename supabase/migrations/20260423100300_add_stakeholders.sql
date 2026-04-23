-- Create rk_stakeholders table
CREATE TABLE IF NOT EXISTS public.rk_stakeholders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.rk_project(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rk_stakeholders ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public stakeholders are viewable by everyone" ON public.rk_stakeholders
    FOR SELECT USING (true);

CREATE POLICY "Stakeholders are insertable by everyone" ON public.rk_stakeholders
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Stakeholders are updatable by everyone" ON public.rk_stakeholders
    FOR UPDATE USING (true);

CREATE POLICY "Stakeholders are deletable by everyone" ON public.rk_stakeholders
    FOR DELETE USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE rk_stakeholders;
