-- ====================================
-- ACTUALIZACIÓN DE ESQUEMA - COBROS AGUA
-- ====================================
-- Este script agrega:
-- 1. Tabla de ANULACIONES (auditoría completa)
-- 2. Tabla de PAUSAS_COBRO (suspensión temporal de facturación)
-- 3. Campo ESTADO en PAGOS (PAGADO/ANULADO)
-- ====================================

-- ====================================
-- 1. MODIFICAR TABLA PAGOS - Agregar campo estado
-- ====================================
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'PAGADO';
COMMENT ON COLUMN pagos.estado IS 'Estado del pago: PAGADO, ANULADO';

-- Índice para filtrar por estado
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);

-- ====================================
-- 2. CREAR TABLA DE ANULACIONES (Auditoría)
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
    fecha_anulacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_anulaciones_pago_id ON anulaciones(pago_id);
CREATE INDEX IF NOT EXISTS idx_anulaciones_usuario_id ON anulaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_anulaciones_correlativo ON anulaciones(correlativo);
CREATE INDEX IF NOT EXISTS idx_anulaciones_fecha ON anulaciones(fecha_anulacion);

-- Comentarios
COMMENT ON TABLE anulaciones IS 'Registro de anulaciones de recibos - Auditoría completa';
COMMENT ON COLUMN anulaciones.motivo IS 'Motivo de la anulación (obligatorio)';
COMMENT ON COLUMN anulaciones.responsable_anulacion IS 'Usuario que realizó la anulación';

-- ====================================
-- 3. CREAR TABLA DE PAUSAS_COBRO
-- ====================================
CREATE TABLE IF NOT EXISTS pausas_cobro (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    motivo TEXT NOT NULL,
    tipo_pausa TEXT NOT NULL,
    responsable_autoriza TEXT NOT NULL,
    fecha_autorizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    estado TEXT DEFAULT 'ACTIVA',
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT chk_fechas_pausa CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT chk_tipo_pausa CHECK (tipo_pausa IN ('VIAJE', 'SALUD', 'SIN_AGUA', 'OTRO'))
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_pausas_usuario_id ON pausas_cobro(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pausas_estado ON pausas_cobro(estado);
CREATE INDEX IF NOT EXISTS idx_pausas_fechas ON pausas_cobro(fecha_inicio, fecha_fin);

-- Comentarios
COMMENT ON TABLE pausas_cobro IS 'Suspensión temporal de cobros por viaje, salud, falta de agua, etc.';
COMMENT ON COLUMN pausas_cobro.tipo_pausa IS 'Tipo: VIAJE, SALUD, SIN_AGUA, OTRO';
COMMENT ON COLUMN pausas_cobro.estado IS 'Estado: ACTIVA, FINALIZADA, CANCELADA';

-- ====================================
-- 4. POLÍTICAS RLS PARA NUEVAS TABLAS
-- ====================================

-- Anulaciones
ALTER TABLE anulaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anulaciones: permitir lectura pública" ON anulaciones;
CREATE POLICY "Anulaciones: permitir lectura pública" ON anulaciones
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anulaciones: permitir inserción pública" ON anulaciones;
CREATE POLICY "Anulaciones: permitir inserción pública" ON anulaciones
    FOR INSERT WITH CHECK (true);

-- Pausas de cobro
ALTER TABLE pausas_cobro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pausas: permitir lectura pública" ON pausas_cobro;
CREATE POLICY "Pausas: permitir lectura pública" ON pausas_cobro
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Pausas: permitir inserción pública" ON pausas_cobro;
CREATE POLICY "Pausas: permitir inserción pública" ON pausas_cobro
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Pausas: permitir actualización pública" ON pausas_cobro;
CREATE POLICY "Pausas: permitir actualización pública" ON pausas_cobro
    FOR UPDATE USING (true);

-- ====================================
-- 5. VISTAS ÚTILES PARA REPORTES
-- ====================================

-- Vista: Recibos anulados con información completa
CREATE OR REPLACE VIEW v_recibos_anulados AS
SELECT 
    a.id,
    a.correlativo,
    u.nombre as usuario_nombre,
    u.codigo as usuario_codigo,
    a.periodo,
    a.monto_anulado,
    a.motivo,
    a.responsable_anulacion,
    a.fecha_anulacion,
    a.observaciones
FROM anulaciones a
JOIN usuarios u ON a.usuario_id = u.id
ORDER BY a.fecha_anulacion DESC;

-- Vista: Pausas activas actualmente
CREATE OR REPLACE VIEW v_pausas_activas AS
SELECT 
    p.id,
    u.nombre as usuario_nombre,
    u.codigo as usuario_codigo,
    p.fecha_inicio,
    p.fecha_fin,
    p.motivo,
    p.tipo_pausa,
    p.responsable_autoriza,
    p.observaciones,
    CURRENT_DATE as fecha_actual,
    (p.fecha_fin - CURRENT_DATE) as dias_restantes
FROM pausas_cobro p
JOIN usuarios u ON p.usuario_id = u.id
WHERE p.estado = 'ACTIVA' 
  AND CURRENT_DATE BETWEEN p.fecha_inicio AND p.fecha_fin
ORDER BY p.fecha_fin ASC;

-- ====================================
-- 6. FUNCIÓN PARA VERIFICAR SI UN PERIODO ESTÁ EN PAUSA
-- ====================================
CREATE OR REPLACE FUNCTION periodo_en_pausa(
    p_usuario_id BIGINT, 
    p_periodo TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_fecha_periodo DATE;
    v_en_pausa BOOLEAN;
BEGIN
    -- Convertir periodo (ej: "ENERO 2026") a fecha
    v_fecha_periodo := TO_DATE(p_periodo, 'MONTH YYYY');
    
    -- Verificar si existe una pausa activa que cubra este periodo
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
-- 7. FUNCIÓN PARA OBTENER MESES PENDIENTES (EXCLUYENDO PAUSAS)
-- ====================================
CREATE OR REPLACE FUNCTION calcular_mora_con_pausas(
    p_usuario_id BIGINT,
    p_inicio_cobro TEXT,
    p_pagos JSONB
) RETURNS TABLE (
    periodo TEXT,
    en_pausa BOOLEAN
) AS $$
DECLARE
    v_inicio DATE;
    v_actual DATE;
    v_periodo TEXT;
    v_pagado BOOLEAN;
    v_en_pausa BOOLEAN;
BEGIN
    v_inicio := TO_DATE(p_inicio_cobro, 'YYYY-MM');
    v_actual := CURRENT_DATE;
    
    WHILE v_inicio <= v_actual LOOP
        v_periodo := TO_CHAR(v_inicio, 'MONTH YYYY');
        
        -- Verificar si está pagado
        SELECT EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_pagos) AS pago
            WHERE (pago->>'periodo') = v_periodo
              AND (pago->>'estado' IS NULL OR pago->>'estado' = 'PAGADO')
        ) INTO v_pagado;
        
        -- Verificar si está en pausa
        SELECT periodo_en_pausa(p_usuario_id, v_periodo) INTO v_en_pausa;
        
        -- Solo retornar si no está pagado
        IF NOT v_pagado THEN
            periodo := v_periodo;
            en_pausa := v_en_pausa;
            RETURN NEXT;
        END IF;
        
        v_inicio := v_inicio + INTERVAL '1 month';
    END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- ====================================
-- 8. DATOS INICIALES
-- ====================================

-- Insertar tipos de pausa en configuración si no existen
INSERT INTO configuracion (key, value)
VALUES 
    ('tipos_pausa', 'VIAJE,SALUD,SIN_AGUA,OTRO'),
    ('max_dias_pausa', '180')
ON CONFLICT (key) DO NOTHING;

-- ====================================
-- 9. MENSAJE DE CONFIRMACIÓN
-- ====================================
DO $$
BEGIN
    RAISE NOTICE '✅ Esquema actualizado exitosamente';
    RAISE NOTICE '📋 Nuevas tablas creadas: anulaciones, pausas_cobro';
    RAISE NOTICE '📊 Nuevas vistas: v_recibos_anulados, v_pausas_activas';
    RAISE NOTICE '🔧 Nuevas funciones: periodo_en_pausa(), calcular_mora_con_pausas()';
END $$;
