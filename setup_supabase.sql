-- ====================================
-- CONFIGURACIÓN DE SUPABASE - COBROS AGUA
-- ====================================
-- Ejecuta este script en el SQL Editor de Supabase:
-- https://goxjlpchrtedorxnsqqs.supabase.co/project/goxjlpchrtedorxnsqqs/database

-- 1. CREAR TABLA DE USUARIOS (Socios)
CREATE TABLE IF NOT EXISTS usuarios (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    ci TEXT NOT NULL,
    codigo TEXT NOT NULL UNIQUE,
    tanque TEXT NOT NULL,
    tarifa DECIMAL DEFAULT 10,
    inicio_cobro TEXT DEFAULT '2026-01',
    fecha_ingreso DATE,
    estado TEXT DEFAULT 'ACTIVO',
    motivo_estado TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREAR TABLA DE PAGOS
CREATE TABLE IF NOT EXISTS pagos (
    id BIGSERIAL PRIMARY KEY,
    usuario_id BIGINT REFERENCES usuarios(id) ON DELETE CASCADE,
    monto DECIMAL NOT NULL,
    periodo TEXT NOT NULL,
    tipo TEXT DEFAULT 'MENSUAL',
    responsable TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    correlativo BIGINT,
    lectura_anterior DECIMAL,
    lectura_actual DECIMAL,
    cuota_ingreso DECIMAL,
    conexion DECIMAL,
    consumo_agua DECIMAL,
    proteccion DECIMAL,
    multa DECIMAL,
    asambleas DECIMAL,
    observaciones TEXT
);

-- 3. CREAR TABLA DE OPERADORES
CREATE TABLE IF NOT EXISTS operadores (
    id BIGSERIAL PRIMARY KEY,
    usuario TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nombre_completo TEXT,
    rol TEXT DEFAULT 'OPERADOR',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. HABILITAR RLS EN TODAS LAS TABLAS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE operadores ENABLE ROW LEVEL SECURITY;

-- ====================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ====================================

-- 5. POLÍTICAS PARA USUARIOS (Socios)
-- Permitir leer todos los usuarios
DROP POLICY IF EXISTS "Usuarios: permitir lectura pública" ON usuarios;
CREATE POLICY "Usuarios: permitir lectura pública" ON usuarios
    FOR SELECT USING (true);

-- Permitir insertar nuevos usuarios
DROP POLICY IF EXISTS "Usuarios: permitir inserción pública" ON usuarios;
CREATE POLICY "Usuarios: permitir inserción pública" ON usuarios
    FOR INSERT WITH CHECK (true);

-- Permitir actualizar usuarios existentes
DROP POLICY IF EXISTS "Usuarios: permitir actualización pública" ON usuarios;
CREATE POLICY "Usuarios: permitir actualización pública" ON usuarios
    FOR UPDATE USING (true);

-- Permitir eliminar usuarios
DROP POLICY IF EXISTS "Usuarios: permitir eliminación pública" ON usuarios;
CREATE POLICY "Usuarios: permitir eliminación pública" ON usuarios
    FOR DELETE USING (true);

-- 6. POLÍTICAS PARA PAGOS
-- Permitir leer todos los pagos
DROP POLICY IF EXISTS "Pagos: permitir lectura pública" ON pagos;
CREATE POLICY "Pagos: permitir lectura pública" ON pagos
    FOR SELECT USING (true);

-- Permitir insertar nuevos pagos
DROP POLICY IF EXISTS "Pagos: permitir inserción pública" ON pagos;
CREATE POLICY "Pagos: permitir inserción pública" ON pagos
    FOR INSERT WITH CHECK (true);

-- Permitir actualizar pagos
DROP POLICY IF EXISTS "Pagos: permitir actualización pública" ON pagos;
CREATE POLICY "Pagos: permitir actualización pública" ON pagos
    FOR UPDATE USING (true);

-- Permitir eliminar pagos
DROP POLICY IF EXISTS "Pagos: permitir eliminación pública" ON pagos;
CREATE POLICY "Pagos: permitir eliminación pública" ON pagos
    FOR DELETE USING (true);

-- 7. POLÍTICAS PARA OPERADORES
-- Permitir leer operadores (para login)
DROP POLICY IF EXISTS "Operadores: permitir lectura pública" ON operadores;
CREATE POLICY "Operadores: permitir lectura pública" ON operadores
    FOR SELECT USING (true);

-- Permitir insertar operadores
DROP POLICY IF EXISTS "Operadores: permitir inserción pública" ON operadores;
CREATE POLICY "Operadores: permitir inserción pública" ON operadores
    FOR INSERT WITH CHECK (true);

-- Permitir actualizar operadores
DROP POLICY IF EXISTS "Operadores: permitir actualización pública" ON operadores;
CREATE POLICY "Operadores: permitir actualización pública" ON operadores
    FOR UPDATE USING (true);

-- ====================================
-- DATOS INICIALES
-- ====================================

-- Insertar operador admin por defecto (si no existe)
INSERT INTO operadores (usuario, password, nombre_completo, rol)
VALUES ('admin', '123', 'ADMINISTRADOR DEL SISTEMA', 'ADMINISTRADOR')
ON CONFLICT (usuario) DO NOTHING;

-- ====================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- ====================================

CREATE INDEX IF NOT EXISTS idx_usuarios_codigo ON usuarios(codigo);
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre ON usuarios(nombre);
CREATE INDEX IF NOT EXISTS idx_usuarios_ci ON usuarios(ci);
CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON usuarios(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_usuario_id ON pagos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_correlativo ON pagos(correlativo);
CREATE INDEX IF NOT EXISTS idx_pagos_periodo ON pagos(periodo);
CREATE INDEX IF NOT EXISTS idx_operadores_usuario ON operadores(usuario);
