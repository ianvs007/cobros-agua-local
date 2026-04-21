-- ====================================
-- ACTUALIZACIÓN COMPLETA - COBROS AGUA
-- ====================================
-- Script único para ejecutar en Supabase SQL Editor
-- https://goxjlpchrtedorxnsqqs.supabase.co/project/goxjlpchrtedorxnsqqs/database/sql/new
-- ====================================

-- ====================================
-- 1. AGREGAR COLUMNA ESTADO A PAGOS
-- ====================================
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'PAGADO';
COMMENT ON COLUMN pagos.estado IS 'Estado del pago: PAGADO, ANULADO';
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);

-- ====================================
-- 2. CREAR TABLA DE ANULACIONES
-- ====================================
CREATE TABLE IF NOT EXISTS anulaciones (
    id BIGSERIAL PRIMARY KEY,
    pago_id BIGINT NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    correlativo BIGINT NOT NULL,
    periodo TEXT NOT NULL,
    monto_anulado DECIMAL NOT NULL,
    motivo TEXT NOT NULL,
    responsable_anulacion TEXT NOT NULL,
    fecha_anulacion TIMESTAMPTZ DEFAULT NOW(),
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anulaciones_pago_id ON anulaciones(pago_id);
CREATE INDEX IF NOT EXISTS idx_anulaciones_usuario_id ON anulaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_anulaciones_correlativo ON anulaciones(correlativo);
CREATE INDEX IF NOT EXISTS idx_anulaciones_fecha ON anulaciones(fecha_anulacion);

ALTER TABLE anulaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anulaciones: permitir lectura pública" ON anulaciones;
CREATE POLICY "Anulaciones: permitir lectura pública" ON anulaciones FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anulaciones: permitir inserción pública" ON anulaciones;
CREATE POLICY "Anulaciones: permitir inserción pública" ON anulaciones FOR INSERT WITH CHECK (true);

-- ====================================
-- 3. CREAR TABLA DE PAUSAS_COBRO
-- ====================================
CREATE TABLE IF NOT EXISTS pausas_cobro (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    motivo TEXT NOT NULL,
    tipo_pausa TEXT NOT NULL CHECK (tipo_pausa IN ('VIAJE', 'SALUD', 'SIN_AGUA', 'OTRO')),
    responsable_autoriza TEXT NOT NULL,
    fecha_autorizacion TIMESTAMPTZ DEFAULT NOW(),
    estado TEXT DEFAULT 'ACTIVA',
    observaciones TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_fechas_pausa CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_pausas_usuario_id ON pausas_cobro(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pausas_estado ON pausas_cobro(estado);
CREATE INDEX IF NOT EXISTS idx_pausas_fechas ON pausas_cobro(fecha_inicio, fecha_fin);

ALTER TABLE pausas_cobro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Pausas: permitir lectura pública" ON pausas_cobro;
CREATE POLICY "Pausas: permitir lectura pública" ON pausas_cobro FOR SELECT USING (true);
DROP POLICY IF EXISTS "Pausas: permitir inserción pública" ON pausas_cobro;
CREATE POLICY "Pausas: permitir inserción pública" ON pausas_cobro FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Pausas: permitir actualización pública" ON pausas_cobro;
CREATE POLICY "Pausas: permitir actualización pública" ON pausas_cobro FOR UPDATE USING (true);

-- ====================================
-- 4. CREAR VISTAS
-- ====================================
CREATE OR REPLACE VIEW v_recibos_anulados AS
SELECT 
    a.id, a.correlativo,
    u.nombre as usuario_nombre, u.codigo as usuario_codigo,
    a.periodo, a.monto_anulado, a.motivo,
    a.responsable_anulacion, a.fecha_anulacion, a.observaciones
FROM anulaciones a
JOIN usuarios u ON a.usuario_id = u.id
ORDER BY a.fecha_anulacion DESC;

CREATE OR REPLACE VIEW v_pausas_activas AS
SELECT 
    p.id,
    u.nombre as usuario_nombre, u.codigo as usuario_codigo,
    p.fecha_inicio, p.fecha_fin, p.motivo, p.tipo_pausa,
    p.responsable_autoriza, p.observaciones,
    CURRENT_DATE as fecha_actual,
    (p.fecha_fin - CURRENT_DATE) as dias_restantes
FROM pausas_cobro p
JOIN usuarios u ON p.usuario_id = u.id
WHERE p.estado = 'ACTIVA' 
  AND CURRENT_DATE BETWEEN p.fecha_inicio AND p.fecha_fin
ORDER BY p.fecha_fin ASC;

-- ====================================
-- 5. CREAR FUNCIÓN
-- ====================================
CREATE OR REPLACE FUNCTION periodo_en_pausa(
    p_usuario_id BIGINT, 
    p_periodo TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_fecha_periodo DATE;
    v_en_pausa BOOLEAN;
BEGIN
    v_fecha_periodo := TO_DATE(p_periodo, 'MONTH YYYY');
    SELECT EXISTS (
        SELECT 1 FROM pausas_cobro p
        WHERE p.usuario_id = p_usuario_id
          AND p.estado = 'ACTIVA'
          AND v_fecha_periodo BETWEEN p.fecha_inicio AND p.fecha_fin
    ) INTO v_en_pausa;
    RETURN v_en_pausa;
END;
$$ LANGUAGE plpgsql STABLE;

-- ====================================
-- 6. ACTUALIZAR PAGOS EXISTENTES
-- ====================================
UPDATE pagos SET estado = 'PAGADO' WHERE estado IS NULL;

-- ====================================
-- 7. INSERTAR CONFIGURACIONES
-- ====================================
INSERT INTO configuracion (key, value)
VALUES 
    ('tipos_pausa', 'VIAJE,SALUD,SIN_AGUA,OTRO'),
    ('max_dias_pausa', '180')
ON CONFLICT (key) DO NOTHING;

-- ====================================
-- 8. VERIFICACIÓN FINAL
-- ====================================
-- Verificar columna estado
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'pagos' AND column_name = 'estado';

-- Contar registros
SELECT 'usuarios' as tabla, count(*) as registros FROM usuarios
UNION ALL SELECT 'pagos', count(*) FROM pagos
UNION ALL SELECT 'anulaciones', count(*) FROM anulaciones
UNION ALL SELECT 'pausas_cobro', count(*) FROM pausas_cobro;
