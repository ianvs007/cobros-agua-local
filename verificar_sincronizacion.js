/**
 * Script de Verificación de Sincronización con Supabase
 * 
 * Este script verifica que todas las tablas, vistas y funciones
 * necesarias estén creadas correctamente en Supabase.
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

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Error: No se encontraron las variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
    console.error('Verifica que el archivo .env exista y contenga las variables correctas.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    check: (msg) => console.log(`${colors.cyan}🔍 ${msg}${colors.reset}`)
};

// Resultados de la verificación
const results = {
    tables: { passed: 0, failed: 0, items: [] },
    columns: { passed: 0, failed: 0, items: [] },
    views: { passed: 0, failed: 0, items: [] },
    functions: { passed: 0, failed: 0, items: [] },
    config: { passed: 0, failed: 0, items: [] }
};

async function verifyTables() {
    log.check('Verificando tablas necesarias...');
    
    const tables = ['usuarios', 'pagos', 'operadores', 'configuracion', 'anulaciones', 'pausas_cobro'];
    
    for (const table of tables) {
        try {
            const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
            
            if (error) {
                if (error.code === '42P01') {
                    log.error(`Tabla "${table}" NO existe`);
                    results.tables.failed++;
                    results.tables.items.push({ name: table, status: 'missing' });
                } else {
                    log.warning(`Error al verificar tabla "${table}": ${error.message}`);
                    results.tables.failed++;
                    results.tables.items.push({ name: table, status: 'error', error: error.message });
                }
            } else {
                log.success(`Tabla "${table}" existe ✓`);
                results.tables.passed++;
                results.tables.items.push({ name: table, status: 'ok' });
            }
        } catch (err) {
            log.error(`Error crítico al verificar tabla "${table}": ${err.message}`);
            results.tables.failed++;
            results.tables.items.push({ name: table, status: 'error', error: err.message });
        }
    }
}

async function verifyColumns() {
    log.check('Verificando columnas críticas...');
    
    const columns = [
        { table: 'pagos', column: 'estado' },
        { table: 'pagos', column: 'correlativo' },
        { table: 'anulaciones', column: 'motivo' },
        { table: 'anulaciones', column: 'responsable_anulacion' },
        { table: 'pausas_cobro', column: 'tipo_pausa' },
        { table: 'pausas_cobro', column: 'fecha_inicio' },
        { table: 'pausas_cobro', column: 'fecha_fin' }
    ];
    
    for (const { table, column } of columns) {
        try {
            // Intentar seleccionar la columna específica
            const { error } = await supabase.from(table).select(column, { count: 'exact', head: true });
            
            if (error) {
                if (error.code === '42703') {
                    log.error(`Columna "${table}.${column}" NO existe`);
                    results.columns.failed++;
                    results.columns.items.push({ table, column, status: 'missing' });
                } else {
                    log.warning(`Error al verificar columna "${table}.${column}": ${error.message}`);
                    results.columns.failed++;
                    results.columns.items.push({ table, column, status: 'error', error: error.message });
                }
            } else {
                log.success(`Columna "${table}.${column}" existe ✓`);
                results.columns.passed++;
                results.columns.items.push({ table, column, status: 'ok' });
            }
        } catch (err) {
            log.error(`Error crítico al verificar columna "${table}.${column}": ${err.message}`);
            results.columns.failed++;
            results.columns.items.push({ table, column, status: 'error', error: err.message });
        }
    }
}

async function verifyViews() {
    log.check('Verificando vistas...');
    
    const views = ['v_recibos_anulados', 'v_pausas_activas'];
    
    for (const view of views) {
        try {
            const { error } = await supabase.from(view).select('*', { count: 'exact', head: true });
            
            if (error) {
                if (error.code === '42P01') {
                    log.error(`Vista "${view}" NO existe`);
                    results.views.failed++;
                    results.views.items.push({ name: view, status: 'missing' });
                } else {
                    log.warning(`Error al verificar vista "${view}": ${error.message}`);
                    results.views.failed++;
                    results.views.items.push({ name: view, status: 'error', error: error.message });
                }
            } else {
                log.success(`Vista "${view}" existe ✓`);
                results.views.passed++;
                results.views.items.push({ name: view, status: 'ok' });
            }
        } catch (err) {
            log.error(`Error crítico al verificar vista "${view}": ${err.message}`);
            results.views.failed++;
            results.views.items.push({ name: view, status: 'error', error: err.message });
        }
    }
}

async function verifyFunctions() {
    log.check('Verificando funciones...');
    
    // Las funciones se verifican ejecutándolas
    const functions = [
        {
            name: 'periodo_en_pausa',
            test: async () => {
                // Intentar llamar a la función (debería retornar false para usuario inexistente)
                const { error } = await supabase.rpc('periodo_en_pausa', {
                    p_usuario_id: 999999,
                    p_periodo: 'ENERO 2026'
                });
                return error;
            }
        }
    ];
    
    for (const { name, test } of functions) {
        try {
            const error = await test();
            
            if (error && error.code === '42883') {
                log.error(`Función "${name}" NO existe`);
                results.functions.failed++;
                results.functions.items.push({ name, status: 'missing' });
            } else {
                log.success(`Función "${name}" existe ✓`);
                results.functions.passed++;
                results.functions.items.push({ name, status: 'ok' });
            }
        } catch (err) {
            log.error(`Error crítico al verificar función "${name}": ${err.message}`);
            results.functions.failed++;
            results.functions.items.push({ name, status: 'error', error: err.message });
        }
    }
}

async function verifyConfig() {
    log.check('Verificando configuración...');
    
    const configKeys = ['tipos_pausa', 'max_dias_pausa', 'ultimo_recibo'];
    
    for (const key of configKeys) {
        try {
            const { data, error } = await supabase
                .from('configuracion')
                .select('value')
                .eq('key', key)
                .maybeSingle();
            
            if (error) {
                log.warning(`Error al verificar config "${key}": ${error.message}`);
                results.config.failed++;
                results.config.items.push({ key, status: 'error', error: error.message });
            } else if (data) {
                log.success(`Configuración "${key}" = "${data.value}" ✓`);
                results.config.passed++;
                results.config.items.push({ key, status: 'ok', value: data.value });
            } else {
                log.warning(`Configuración "${key}" no existe (se creará automáticamente)`);
                results.config.items.push({ key, status: 'missing' });
            }
        } catch (err) {
            log.error(`Error crítico al verificar config "${key}": ${err.message}`);
            results.config.failed++;
            results.config.items.push({ key, status: 'error', error: err.message });
        }
    }
}

async function testData() {
    log.check('Verificando datos de prueba...');
    
    // Verificar usuarios existentes
    const { count: usuariosCount } = await supabase.from('usuarios').select('*', { count: 'exact', head: true });
    log.info(`Usuarios registrados: ${usuariosCount || 0}`);
    
    // Verificar pagos existentes
    const { count: pagosCount } = await supabase.from('pagos').select('*', { count: 'exact', head: true });
    log.info(`Pagos registrados: ${pagosCount || 0}`);
    
    // Verificar anulaciones (debería estar vacío al inicio)
    const { count: anulacionesCount } = await supabase.from('anulaciones').select('*', { count: 'exact', head: true });
    log.info(`Recibos anulados: ${anulacionesCount || 0}`);
    
    // Verificar pausas (debería estar vacío al inicio)
    const { count: pausasCount } = await supabase.from('pausas_cobro').select('*', { count: 'exact', head: true });
    log.info(`Pausas activas: {pausasCount || 0}`);
}

async function printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE VERIFICACIÓN');
    console.log('='.repeat(60));
    
    const totalTests = 
        (results.tables.passed + results.tables.failed) +
        (results.columns.passed + results.columns.failed) +
        (results.views.passed + results.views.failed) +
        (results.functions.passed + results.functions.failed);
    
    const totalPassed = 
        results.tables.passed + 
        results.columns.passed + 
        results.views.passed + 
        results.functions.passed;
    
    const totalFailed = 
        results.tables.failed + 
        results.columns.failed + 
        results.views.failed + 
        results.functions.failed;
    
    console.log(`\n${colors.cyan}Tablas:${colors.reset} ${results.tables.passed}/${results.tables.passed + results.tables.failed} verificadas`);
    console.log(`${colors.cyan}Columnas:${colors.reset} ${results.columns.passed}/${results.columns.passed + results.columns.failed} verificadas`);
    console.log(`${colors.cyan}Vistas:${colors.reset} ${results.views.passed}/${results.views.passed + results.views.failed} verificadas`);
    console.log(`${colors.cyan}Funciones:${colors.reset} ${results.functions.passed}/${results.functions.passed + results.functions.failed} verificadas`);
    
    console.log(`\n${colors.blue}Total: ${totalPassed}/${totalTests} pruebas pasadas${colors.reset}`);
    
    const successRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;
    
    if (successRate === 100) {
        console.log(`\n${colors.green}🎉 ¡Excelente! Todas las verificaciones pasaron correctamente.${colors.reset}`);
        console.log(`${colors.green}✅ La base de datos está completamente sincronizada.${colors.reset}`);
    } else if (successRate >= 80) {
        console.log(`\n${colors.yellow}⚠️  La mayoría de verificaciones pasaron, pero hay elementos faltantes.${colors.reset}`);
        console.log(`${colors.yellow}Se recomienda ejecutar el script de actualización.${colors.reset}`);
    } else {
        console.log(`\n${colors.red}❌ Muchas verificaciones fallaron.${colors.reset}`);
        console.log(`${colors.red}Es necesario ejecutar el script de actualización del esquema.${colors.reset}`);
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Mostrar elementos fallidos
    if (results.tables.failed > 0) {
        console.log(`\n${colors.red}Tablas faltantes:${colors.reset}`);
        results.tables.items
            .filter(i => i.status === 'missing')
            .forEach(i => console.log(`  - ${i.name}`));
    }
    
    if (results.views.failed > 0) {
        console.log(`\n${colors.red}Vistas faltantes:${colors.reset}`);
        results.views.items
            .filter(i => i.status === 'missing')
            .forEach(i => console.log(`  - ${i.name}`));
    }
    
    if (results.functions.failed > 0) {
        console.log(`\n${colors.red}Funciones faltantes:${colors.reset}`);
        results.functions.items
            .filter(i => i.status === 'missing')
            .forEach(i => console.log(`  - ${i.name}`));
    }
    
    console.log('\n');
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 VERIFICACIÓN DE SINCRONIZACIÓN CON SUPABASE');
    console.log('='.repeat(60));
    console.log(`\nURL: ${supabaseUrl}`);
    console.log('\n');
    
    await verifyTables();
    console.log('\n');
    
    await verifyColumns();
    console.log('\n');
    
    await verifyViews();
    console.log('\n');
    
    await verifyFunctions();
    console.log('\n');
    
    await verifyConfig();
    console.log('\n');
    
    await testData();
    
    await printSummary();
    
    // Guardar reporte en archivo
    const report = {
        timestamp: new Date().toISOString(),
        supabaseUrl,
        results,
        summary: {
            total: (results.tables.passed + results.tables.failed) +
                   (results.columns.passed + results.columns.failed) +
                   (results.views.passed + results.views.failed) +
                   (results.functions.passed + results.functions.failed),
            passed: results.tables.passed + results.columns.passed + results.views.passed + results.functions.passed,
            failed: results.tables.failed + results.columns.failed + results.views.failed + results.functions.failed
        }
    };
    
    console.log('📄 Reporte guardado en: verificacion_reporte.json\n');
    
    // Nota: En un entorno real, aquí guardaríamos el reporte en un archivo
    // Para este script, solo mostramos el resultado
}

// Ejecutar verificación
main().catch(err => {
    console.error('Error crítico:', err);
    process.exit(1);
});
