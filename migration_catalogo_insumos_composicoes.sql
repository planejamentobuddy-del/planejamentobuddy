-- =============================================================================
-- MIGRAÇÃO: Catálogo Geral de Insumos e Composições Compartilhado em Tempo Real
-- Data: 2026-10-23
-- Descrição: Cria as tabelas catalog_insumos, catalog_composicoes e catalog_metadata
--            com RLS e suporte a Realtime para que todos os usuários vejam as
--            mesmas composições e insumos e suas alterações em tempo real.
-- =============================================================================

-- 1. TABELA DE INSUMOS DO CATÁLOGO
CREATE TABLE IF NOT EXISTS public.catalog_insumos (
    id                      TEXT        PRIMARY KEY,
    code                    TEXT        NOT NULL,
    "group"                 TEXT        NOT NULL,
    description             TEXT        NOT NULL,
    unit                    TEXT        NOT NULL,
    type                    TEXT        NOT NULL,
    base                    TEXT        NOT NULL,
    unit_cost               NUMERIC     NOT NULL DEFAULT 0,
    salario                 NUMERIC,
    encargos_percent        NUMERIC,
    beneficios              NUMERIC,
    status                  TEXT        NOT NULL DEFAULT 'active',
    notes                   TEXT,
    files                   JSONB       DEFAULT '[]'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. TABELA DE COMPOSIÇÕES DO CATÁLOGO
CREATE TABLE IF NOT EXISTS public.catalog_composicoes (
    id                      TEXT        PRIMARY KEY,
    code                    TEXT        NOT NULL,
    description             TEXT        NOT NULL,
    unit                    TEXT        NOT NULL,
    type                    TEXT        NOT NULL,
    base                    TEXT        NOT NULL,
    status                  TEXT        NOT NULL DEFAULT 'active',
    items                   JSONB       DEFAULT '[]'::jsonb,
    cost_material           NUMERIC     NOT NULL DEFAULT 0,
    cost_labor              NUMERIC     NOT NULL DEFAULT 0,
    cost_equipment          NUMERIC     NOT NULL DEFAULT 0,
    cost_other              NUMERIC     NOT NULL DEFAULT 0,
    cost_total              NUMERIC     NOT NULL DEFAULT 0,
    detailed_description    TEXT,
    bdi                     NUMERIC     DEFAULT 0,
    selling_price           NUMERIC     DEFAULT 0,
    notes                   TEXT,
    files                   JSONB       DEFAULT '[]'::jsonb,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABELA DE METADADOS COMPARTILHADOS (Unidades, Tipos e Bases Customizadas)
CREATE TABLE IF NOT EXISTS public.catalog_metadata (
    id                      TEXT        PRIMARY KEY, -- 'custom_units', 'custom_types', 'custom_bases'
    values                  JSONB       DEFAULT '[]'::jsonb,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_catalog_insumos_code        ON public.catalog_insumos(code);
CREATE INDEX IF NOT EXISTS idx_catalog_insumos_group       ON public.catalog_insumos("group");
CREATE INDEX IF NOT EXISTS idx_catalog_insumos_type        ON public.catalog_insumos(type);
CREATE INDEX IF NOT EXISTS idx_catalog_composicoes_code    ON public.catalog_composicoes(code);
CREATE INDEX IF NOT EXISTS idx_catalog_composicoes_type    ON public.catalog_composicoes(type);

-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.catalog_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_composicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_metadata ENABLE ROW LEVEL SECURITY;

-- 6. POLÍTICAS DE ACESSO PARA USUÁRIOS AUTENTICADOS E ANON
DROP POLICY IF EXISTS "catalog_insumos_all_policy" ON public.catalog_insumos;
CREATE POLICY "catalog_insumos_all_policy" ON public.catalog_insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "catalog_insumos_anon_policy" ON public.catalog_insumos;
CREATE POLICY "catalog_insumos_anon_policy" ON public.catalog_insumos FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "catalog_composicoes_all_policy" ON public.catalog_composicoes;
CREATE POLICY "catalog_composicoes_all_policy" ON public.catalog_composicoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "catalog_composicoes_anon_policy" ON public.catalog_composicoes;
CREATE POLICY "catalog_composicoes_anon_policy" ON public.catalog_composicoes FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "catalog_metadata_all_policy" ON public.catalog_metadata;
CREATE POLICY "catalog_metadata_all_policy" ON public.catalog_metadata FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "catalog_metadata_anon_policy" ON public.catalog_metadata;
CREATE POLICY "catalog_metadata_anon_policy" ON public.catalog_metadata FOR ALL TO anon USING (true) WITH CHECK (true);

-- 7. HABILITAR REALTIME (Para sincronização instantânea em tela)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'catalog_insumos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_insumos;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'catalog_composicoes'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_composicoes;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'catalog_metadata'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.catalog_metadata;
    END IF;
END $$;
