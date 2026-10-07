-- Migration: Add route agent assignments and field-creator agent to micro_stores
ALTER TABLE public.micro_stores
ADD COLUMN IF NOT EXISTS assigned_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS created_by_agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_micro_stores_assigned_agent ON public.micro_stores(tenant_id, assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_micro_stores_created_by_agent ON public.micro_stores(tenant_id, created_by_agent_id);
