-- ==========================================
-- SCRIPT DE UNIFICACIÓN DE ESQUEMA FINAL
-- ==========================================
-- Ejecuta esto en el SQL Editor de Supabase para asegurar consistencia total.

-- 1. Asegurar columnas en tabla USUARIOS
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS motivo_estado TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'ACTIVO';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS inicio_cobro TEXT DEFAULT '2026-01';
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS tarifa DECIMAL DEFAULT 10;

-- 2. Asegurar columnas en tabla PAGOS
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS cuota_ingreso DECIMAL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS conexion DECIMAL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS proteccion DECIMAL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS multa DECIMAL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS asambleas DECIMAL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS consumo_agua DECIMAL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS lectura_anterior DECIMAL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS lectura_actual DECIMAL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS correlativo BIGINT;

-- 3. Asegurar columnas en tabla OPERADORES
ALTER TABLE operadores ADD COLUMN IF NOT EXISTS nombre_completo TEXT;
ALTER TABLE operadores ADD COLUMN IF NOT EXISTS password TEXT NOT NULL DEFAULT '123';
ALTER TABLE operadores ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'OPERADOR';

-- 4. Índices de rendimiento (opcional pero recomendado)
CREATE INDEX IF NOT EXISTS idx_usuarios_codigo ON usuarios(codigo);
CREATE INDEX IF NOT EXISTS idx_pagos_usuario_id ON pagos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_correlativo ON pagos(correlativo);
