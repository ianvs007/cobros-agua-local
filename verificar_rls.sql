-- ====================================
-- VERIFICAR ESTADO DE RLS Y POLÍTICAS
-- ====================================
-- Ejecuta esto en Supabase SQL Editor para ver el estado actual

-- 1. Verificar si RLS está activado en la tabla usuarios
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_activado
FROM pg_tables 
WHERE tablename = 'usuarios';

-- 2. Verificar políticas existentes en la tabla usuarios
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'usuarios';

-- 3. Verificar si la tabla usuarios existe y su estructura
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'usuarios'
ORDER BY ordinal_position;

-- 4. Contar registros actuales
SELECT COUNT(*) as total_usuarios FROM usuarios;

-- 5. Verificar políticas de operadores también
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'operadores';
