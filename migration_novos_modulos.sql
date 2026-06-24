-- =============================================================================
-- MIGRAÇÃO: Novos Módulos - Buddy Construtora
-- Data: 2026-06-24
-- Descrição: Cria as tabelas supply_packages (Pacotes de Suprimentos) e
--            workforce_entries (Efetivo de Mão de Obra) com RLS e índices.
-- =============================================================================


-- =============================================================================
-- TABELA 1: supply_packages
-- Armazena os pacotes de suprimentos / compras por projeto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS supply_packages (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id              UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_id                 UUID        REFERENCES tasks(id) ON DELETE SET NULL,

    -- Identificação do pacote
    name                    TEXT        NOT NULL,
    supplier                TEXT,
    estimated_value         NUMERIC,
    is_critical             BOOLEAN     NOT NULL DEFAULT false,
    lead_time_days          INTEGER     NOT NULL DEFAULT 30,

    -- Cronograma de compras
    quantitative_done_date  DATE,
    order_deadline          DATE,
    order_date              DATE,
    expected_delivery_date  DATE,
    actual_delivery_date    DATE,

    -- Status do pacote
    -- pending_quantitative → pending_order → ordered → in_production → delivered
    status                  TEXT        NOT NULL DEFAULT 'pending_quantitative'
                                        CHECK (status IN (
                                            'pending_quantitative',
                                            'pending_order',
                                            'ordered',
                                            'in_production',
                                            'delivered',
                                            'cancelled'
                                        )),

    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by              UUID        REFERENCES auth.users(id)
);

-- Habilitar Row Level Security
ALTER TABLE supply_packages ENABLE ROW LEVEL SECURITY;

-- Política: SELECT — usuários autenticados podem visualizar todos os registros
CREATE POLICY "supply_packages_select_policy"
    ON supply_packages
    FOR SELECT
    TO authenticated
    USING (true);

-- Política: INSERT — usuários autenticados podem inserir registros
CREATE POLICY "supply_packages_insert_policy"
    ON supply_packages
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Política: UPDATE — usuários autenticados podem atualizar registros
CREATE POLICY "supply_packages_update_policy"
    ON supply_packages
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Política: DELETE — usuários autenticados podem excluir registros
CREATE POLICY "supply_packages_delete_policy"
    ON supply_packages
    FOR DELETE
    TO authenticated
    USING (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_supply_packages_project_id     ON supply_packages(project_id);
CREATE INDEX IF NOT EXISTS idx_supply_packages_status         ON supply_packages(status);
CREATE INDEX IF NOT EXISTS idx_supply_packages_order_deadline ON supply_packages(order_deadline);


-- =============================================================================
-- TABELA 2: workforce_entries
-- Armazena os dados mensais de efetivo de mão de obra por projeto e fase.
-- =============================================================================

CREATE TABLE IF NOT EXISTS workforce_entries (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Período e identificação
    month                TEXT        NOT NULL,  -- Formato: 'YYYY-MM' (ex: '2024-06')
    phase                TEXT        NOT NULL,  -- Nome da fase (ex: 'Fundações & Subsolo')
    activity             TEXT,                  -- Descrição da atividade específica

    -- Quantitativo de pessoal
    own_workers          INTEGER     NOT NULL DEFAULT 0,  -- Funcionários diretos
    third_party_workers  INTEGER     NOT NULL DEFAULT 0,  -- Terceirizados / subempreiteiros

    notes                TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Garante uma única entrada por fase por mês por projeto
    UNIQUE (project_id, month, phase)
);

-- Habilitar Row Level Security
ALTER TABLE workforce_entries ENABLE ROW LEVEL SECURITY;

-- Política: SELECT — usuários autenticados podem visualizar todos os registros
CREATE POLICY "workforce_entries_select_policy"
    ON workforce_entries
    FOR SELECT
    TO authenticated
    USING (true);

-- Política: INSERT — usuários autenticados podem inserir registros
CREATE POLICY "workforce_entries_insert_policy"
    ON workforce_entries
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Política: UPDATE — usuários autenticados podem atualizar registros
CREATE POLICY "workforce_entries_update_policy"
    ON workforce_entries
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Política: DELETE — usuários autenticados podem excluir registros
CREATE POLICY "workforce_entries_delete_policy"
    ON workforce_entries
    FOR DELETE
    TO authenticated
    USING (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_workforce_entries_project_id ON workforce_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_workforce_entries_month      ON workforce_entries(month);


-- =============================================================================
-- FIM DA MIGRAÇÃO
-- =============================================================================
