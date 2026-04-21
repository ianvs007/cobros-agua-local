-- ====================================
-- MEJORA DE ANULACIONES - COBROS AGUA
-- ====================================
-- Agrega campos para tipo de anulación y reintegro
-- Ejecutar en: https://goxjlpchrtedorxnsqqs.supabase.co/project/goxjlpchrtedorxnsqqs/database/sql/new
-- ====================================

-- ====================================
-- 1. AGREGAR CAMPOS A TABLA ANULACIONES
-- ====================================

-- Tipo de anulación
ALTER TABLE anulaciones 
ADD COLUMN IF NOT EXISTS tipo_anulacion TEXT DEFAULT 'ERROR_DIGITACION';

-- Restricción CHECK para tipos válidos
ALTER TABLE anulaciones 
DROP CONSTRAINT IF EXISTS chk_tipo_anulacion;

ALTER TABLE anulaciones 
ADD CONSTRAINT chk_tipo_anulacion 
CHECK (tipo_anulacion IN (
    'ERROR_DIGITACION',
    'PAGO_INDEBIDO', 
    'DUPLICADO',
    'SOLICITUD_USUARIO'
));

-- Campo de reintegro (monto devuelto al usuario)
ALTER TABLE anulaciones 
ADD COLUMN IF NOT EXISTS reintegro DECIMAL DEFAULT 0;

-- Campo para número de recibo de reintegro (opcional)
ALTER TABLE anulaciones 
ADD COLUMN IF NOT EXISTS recibo_reintegro TEXT;

-- Índice para filtrar por tipo
CREATE INDEX IF NOT EXISTS idx_anulaciones_tipo ON anulaciones(tipo_anulacion);

-- Índice para filtrar por reintegro
CREATE INDEX IF NOT EXISTS idx_anulaciones_reintegro ON anulaciones(reintegro);

-- Comentarios
COMMENT ON COLUMN anulaciones.tipo_anulacion IS 'Tipo: ERROR_DIGITACION, PAGO_INDEBIDO, DUPLICADO, SOLICITUD_USUARIO';
COMMENT ON COLUMN anulaciones.reintegro IS 'Monto reintegrado al usuario (0 si no aplica)';
COMMENT ON COLUMN anulaciones.recibo_reintegro IS 'Número de recibo del reintegro';

-- ====================================
-- 2. ACTUALIZAR VISTA DE RECIBOS ANULADOS
-- ====================================

-- Eliminar vistas existentes
DROP VIEW IF EXISTS v_recibos_anulados CASCADE;
DROP VIEW IF EXISTS v_reporte_asamblea_anulaciones CASCADE;
DROP VIEW IF EXISTS v_reporte_asamblea_detalle CASCADE;
DROP VIEW IF EXISTS v_reintegros_pendientes CASCADE;

-- Crear vista actualizada
CREATE VIEW v_recibos_anulados AS
SELECT 
    a.id,
    a.correlativo,
    u.nombre as usuario_nombre,
    u.codigo as usuario_codigo,
    u.ci as usuario_ci,
    a.periodo,
    a.monto_anulado,
    a.tipo_anulacion,
    a.reintegro,
    a.recibo_reintegro,
    a.motivo,
    a.responsable_anulacion,
    a.fecha_anulacion,
    a.observaciones
FROM anulaciones a
JOIN usuarios u ON a.usuario_id = u.id
ORDER BY a.fecha_anulacion DESC;

-- ====================================
-- 3. VISTA PARA REPORTE DE ASAMBLEA (Mensual)
-- ====================================

CREATE OR REPLACE VIEW v_reporte_asamblea_anulaciones AS
SELECT 
    TO_CHAR(a.fecha_anulacion, 'YYYY-MM') as mes_anulacion,
    TO_CHAR(a.fecha_anulacion, 'MONTH YYYY') as mes_anulacion_completo,
    COUNT(*) as total_anulaciones,
    COUNT(*) FILTER (WHERE a.tipo_anulacion = 'ERROR_DIGITACION') as error_digitacion,
    COUNT(*) FILTER (WHERE a.tipo_anulacion = 'PAGO_INDEBIDO') as pago_indebido,
    COUNT(*) FILTER (WHERE a.tipo_anulacion = 'DUPLICADO') as duplicado,
    COUNT(*) FILTER (WHERE a.tipo_anulacion = 'SOLICITUD_USUARIO') as solicitud_usuario,
    SUM(a.monto_anulado) as monto_total_anulado,
    SUM(a.reintegro) as monto_total_reintegrado,
    SUM(a.monto_anulado - COALESCE(a.reintegro, 0)) as saldo_no_reintegrado
FROM anulaciones a
GROUP BY TO_CHAR(a.fecha_anulacion, 'YYYY-MM'), TO_CHAR(a.fecha_anulacion, 'MONTH YYYY')
ORDER BY mes_anulacion DESC;

-- ====================================
-- 4. VISTA PARA REPORTE DETALLADO DE ASAMBLEA
-- ====================================

CREATE OR REPLACE VIEW v_reporte_asamblea_detalle AS
SELECT 
    a.id,
    a.correlativo,
    a.fecha_anulacion,
    TO_CHAR(a.fecha_anulacion, 'DD/MM/YYYY') as fecha_formateada,
    TO_CHAR(a.fecha_anulacion, 'YYYY-MM') as mes,
    u.codigo as codigo_socio,
    u.nombre as nombre_socio,
    u.ci as ci_socio,
    a.periodo,
    a.monto_anulado,
    a.tipo_anulacion,
    a.reintegro,
    (a.monto_anulado - COALESCE(a.reintegro, 0)) as saldo_pendiente,
    a.motivo,
    a.responsable_anulacion,
    a.observaciones
FROM anulaciones a
JOIN usuarios u ON a.usuario_id = u.id
ORDER BY a.fecha_anulacion DESC;

-- ====================================
-- 5. VISTA DE REINTEGROS PENDIENTES
-- ====================================

CREATE OR REPLACE VIEW v_reintegros_pendientes AS
SELECT 
    a.id,
    a.correlativo,
    u.codigo as usuario_codigo,
    u.nombre as usuario_nombre,
    u.ci as usuario_ci,
    a.periodo,
    a.monto_anulado,
    a.reintegro,
    (a.monto_anulado - COALESCE(a.reintegro, 0)) as saldo_pendiente,
    a.tipo_anulacion,
    a.motivo,
    a.fecha_anulacion,
    a.responsable_anulacion
FROM anulaciones a
JOIN usuarios u ON a.usuario_id = u.id
WHERE a.reintegro > 0 
  AND (a.recibo_reintegro IS NULL OR a.recibo_reintegro = '')
ORDER BY a.fecha_anulacion DESC;

-- ====================================
-- 6. ACTUALIZAR PAGOS EXISTENTES (Opcional)
-- ====================================
-- Si ya hay anulaciones sin tipo, establecer default
UPDATE anulaciones 
SET tipo_anulacion = 'ERROR_DIGITACION' 
WHERE tipo_anulacion IS NULL;

-- ====================================
-- 7. VERIFICACIÓN
-- ====================================

-- Verificar columnas agregadas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'anulaciones'
ORDER BY ordinal_position;

-- Contar anulaciones por tipo
SELECT 
    tipo_anulacion,
    COUNT(*) as cantidad,
    SUM(monto_anulado) as monto_total,
    SUM(reintegro) as reintegro_total
FROM anulaciones
GROUP BY tipo_anulacion;

-- ====================================
-- 8. MENSAJE DE CONFIRMACIÓN
-- ====================================
DO $$
BEGIN
    RAISE NOTICE ' ';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'MEJORA DE ANULACIONES COMPLETADA';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Nuevos campos en anulaciones:';
    RAISE NOTICE '  - tipo_anulacion (ERROR_DIGITACION, PAGO_INDEBIDO, DUPLICADO, SOLICITUD_USUARIO)';
    RAISE NOTICE '  - reintegro (monto devuelto)';
    RAISE NOTICE '  - recibo_reintegro (numero de recibo)';
    RAISE NOTICE ' ';
    RAISE NOTICE 'Nuevas vistas para reportes:';
    RAISE NOTICE '  - v_recibos_anulados (con tipo y reintegro)';
    RAISE NOTICE '  - v_reporte_asamblea_anulaciones (resumen mensual)';
    RAISE NOTICE '  - v_reporte_asamblea_detalle (detalle completo)';
    RAISE NOTICE '  - v_reintegros_pendientes (por devolver)';
    RAISE NOTICE '====================================';
END $$;
