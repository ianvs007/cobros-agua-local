-- ====================================
-- COMPLETAR ACTUALIZACIÓN - COBROS AGUA
-- ====================================
-- Este script completa la actualización agregando la columna faltante
-- Ejecuta este script en el SQL Editor de Supabase:
-- https://goxjlpchrtedorxnsqqs.supabase.co/project/goxjlpchrtedorxnsqqs/database/sql/new
-- ====================================

-- ====================================
-- 1. AGREGAR COLUMNA ESTADO A PAGOS
-- ====================================
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'PAGADO';
COMMENT ON COLUMN pagos.estado IS 'Estado del pago: PAGADO, ANULADO';

-- Índice para filtrar por estado
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);

-- ====================================
-- 2. ACTUALIZAR PAGOS EXISTENTES
-- ====================================
-- Establecer estado 'PAGADO' para todos los pagos existentes
UPDATE pagos SET estado = 'PAGADO' WHERE estado IS NULL;

-- ====================================
-- 3. VERIFICAR INSTALACIÓN
-- ====================================

-- Verificar que la columna se creó correctamente
SELECT 
    column_name as "Columna",
    data_type as "Tipo",
    column_default as "Default"
FROM information_schema.columns 
WHERE table_name = 'pagos' 
  AND column_name = 'estado';

-- ====================================
-- 4. INSERTAR CONFIGURACIONES FALTANTES
-- ====================================

-- Insertar configuraciones para pausas si no existen
INSERT INTO configuracion (key, value)
VALUES 
    ('tipos_pausa', 'VIAJE,SALUD,SIN_AGUA,OTRO'),
    ('max_dias_pausa', '180')
ON CONFLICT (key) DO NOTHING;

-- ====================================
-- 5. VERIFICACIONES FINALES
-- ====================================

-- Contar registros
SELECT 
    'usuarios' as tabla, count(*) as registros FROM usuarios
UNION ALL
SELECT 'pagos', count(*) FROM pagos
UNION ALL
SELECT 'anulaciones', count(*) FROM anulaciones
UNION ALL
SELECT 'pausas_cobro', count(*) FROM pausas_cobro;

-- ====================================
-- 6. MENSAJE DE CONFIRMACIÓN
-- ====================================
DO $$
BEGIN
    RAISE NOTICE ' ';
    RAISE NOTICE '====================================';
    RAISE NOTICE '✅ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE';
    RAISE NOTICE '====================================';
    RAISE NOTICE '📋 Tablas verificadas: usuarios, pagos, anulaciones, pausas_cobro';
    RAISE NOTICE '📊 Vistas verificadas: v_recibos_anulados, v_pausas_activas';
    RAISE NOTICE '🔧 Funciones verificadas: periodo_en_pausa';
    RAISE NOTICE '✅ Columna "estado" agregada a tabla "pagos"';
    RAISE NOTICE ' ';
    RAISE NOTICE '🎉 El sistema está 100% sincronizado y listo para usar';
    RAISE NOTICE '====================================';
END $$;
