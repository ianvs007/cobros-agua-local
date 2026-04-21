/**
 * Script para agregar la columna 'estado' a la tabla 'pagos' si no existe
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Leer archivo .env manualmente
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envContent = readFileSync(join(__dirname, '.env'), 'utf-8');

// Parsear variables de entorno
const envVars = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        envVars[key.trim()] = value.trim();
    }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function addEstadoColumn() {
    console.log('🔍 Verificando columna "estado" en tabla "pagos"...');
    
    // Intentar seleccionar la columna estado
    const { error } = await supabase.from('pagos').select('estado', { count: 'exact', head: true });
    
    if (error) {
        console.log('⚠️  La columna "estado" no existe. Creándola...');
        
        // Nota: No podemos ejecutar ALTER TABLE directamente desde el cliente
        // Necesitamos usar la API de administración o SQL Editor
        console.log('\n❌ No se puede agregar la columna desde el cliente.');
        console.log('\n📋 Debes ejecutar manualmente este SQL en Supabase SQL Editor:\n');
        console.log('='.repeat(60));
        console.log('ALTER TABLE pagos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT \'PAGADO\';');
        console.log('COMMENT ON COLUMN pagos.estado IS \'Estado del pago: PAGADO, ANULADO\';');
        console.log('CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);');
        console.log('='.repeat(60));
        return false;
    } else {
        console.log('✅ La columna "estado" ya existe.');
        
        // Verificar valores existentes
        const { data } = await supabase.from('pagos').select('estado').limit(10);
        if (data && data.length > 0) {
            const estados = [...new Set(data.map(p => p.estado))];
            console.log(`   Valores encontrados: ${estados.join(', ') || 'NULL'}`);
        }
        return true;
    }
}

async function verifyPagosStructure() {
    console.log('\n📊 Estructura actual de la tabla "pagos":\n');
    
    // Obtener un pago de ejemplo
    const { data: ejemplo } = await supabase.from('pagos').select('*').single();
    
    if (ejemplo) {
        console.log('Campos disponibles:');
        Object.keys(ejemplo).forEach(key => {
            console.log(`  - ${key}`);
        });
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('🔧 VERIFICACIÓN DE COLUMNA "ESTADO"');
    console.log('='.repeat(60));
    console.log(`\nURL: ${supabaseUrl}\n`);
    
    const exists = await addEstadoColumn();
    
    if (!exists) {
        await verifyPagosStructure();
    }
    
    console.log('\n');
}

main().catch(err => {
    console.error('Error crítico:', err);
    process.exit(1);
});
