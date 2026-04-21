/**
 * Inicializa la base de datos SQLite local para cobros_agua.
 * Ejecutar: node server/init-db.js
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'cobros_agua.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Inicializando base de datos en:', DB_PATH);

db.exec(`
-- ====================================
-- TABLA DE USUARIOS
-- ====================================
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    ci TEXT NOT NULL,
    codigo TEXT NOT NULL UNIQUE,
    tanque TEXT NOT NULL,
    tarifa REAL DEFAULT 10,
    inicio_cobro TEXT DEFAULT '2026-01',
    fecha_ingreso TEXT,
    estado TEXT DEFAULT 'ACTIVO',
    motivo_estado TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_usuarios_codigo ON usuarios(codigo);
CREATE INDEX IF NOT EXISTS idx_usuarios_nombre ON usuarios(nombre);
CREATE INDEX IF NOT EXISTS idx_usuarios_ci ON usuarios(ci);
CREATE INDEX IF NOT EXISTS idx_usuarios_estado ON usuarios(estado);

-- ====================================
-- TABLA DE PAGOS
-- ====================================
CREATE TABLE IF NOT EXISTS pagos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    monto REAL NOT NULL,
    periodo TEXT NOT NULL,
    tipo TEXT DEFAULT 'MENSUAL',
    responsable TEXT,
    fecha TEXT DEFAULT (datetime('now')),
    correlativo INTEGER,
    lectura_anterior REAL,
    lectura_actual REAL,
    cuota_ingreso REAL,
    conexion REAL,
    consumo_agua REAL,
    proteccion REAL,
    multa REAL,
    asambleas REAL,
    observaciones TEXT,
    estado TEXT DEFAULT 'PAGADO'
);

CREATE INDEX IF NOT EXISTS idx_pagos_usuario_id ON pagos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_correlativo ON pagos(correlativo);
CREATE INDEX IF NOT EXISTS idx_pagos_periodo ON pagos(periodo);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);

-- ====================================
-- TABLA DE OPERADORES
-- ====================================
CREATE TABLE IF NOT EXISTS operadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    nombre_completo TEXT,
    rol TEXT DEFAULT 'OPERADOR',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_operadores_usuario ON operadores(usuario);

-- ====================================
-- TABLA DE ANULACIONES
-- ====================================
CREATE TABLE IF NOT EXISTS anulaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pago_id INTEGER NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    correlativo INTEGER NOT NULL,
    periodo TEXT NOT NULL,
    monto_anulado REAL NOT NULL,
    motivo TEXT NOT NULL,
    responsable_anulacion TEXT NOT NULL,
    fecha_anulacion TEXT DEFAULT (datetime('now')),
    observaciones TEXT,
    tipo_anulacion TEXT DEFAULT 'ERROR_DIGITACION',
    reintegro REAL DEFAULT 0,
    recibo_reintegro TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anulaciones_pago_id ON anulaciones(pago_id);
CREATE INDEX IF NOT EXISTS idx_anulaciones_usuario_id ON anulaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_anulaciones_correlativo ON anulaciones(correlativo);
CREATE INDEX IF NOT EXISTS idx_anulaciones_fecha ON anulaciones(fecha_anulacion);
CREATE INDEX IF NOT EXISTS idx_anulaciones_tipo ON anulaciones(tipo_anulacion);

-- ====================================
-- TABLA DE PAUSAS_COBRO
-- ====================================
CREATE TABLE IF NOT EXISTS pausas_cobro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_inicio TEXT NOT NULL,
    fecha_fin TEXT NOT NULL,
    motivo TEXT NOT NULL,
    tipo_pausa TEXT NOT NULL,
    responsable_autoriza TEXT NOT NULL,
    fecha_autorizacion TEXT DEFAULT (datetime('now')),
    estado TEXT DEFAULT 'ACTIVA',
    observaciones TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pausas_usuario_id ON pausas_cobro(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pausas_estado ON pausas_cobro(estado);

-- ====================================
-- TABLA DE CONDONACIONES
-- ====================================
CREATE TABLE IF NOT EXISTS condonaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    periodo TEXT NOT NULL,
    monto_condonado REAL NOT NULL,
    motivo TEXT NOT NULL,
    tipo_condonacion TEXT NOT NULL,
    responsable_condonacion TEXT NOT NULL,
    fecha_condonacion TEXT DEFAULT (datetime('now')),
    observaciones TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_condonaciones_usuario_id ON condonaciones(usuario_id);

-- ====================================
-- TABLA DE CONFIGURACION
-- ====================================
CREATE TABLE IF NOT EXISTS configuracion (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ====================================
-- TABLA DE SESIONES ACTIVAS
-- ====================================
CREATE TABLE IF NOT EXISTS sesiones_activas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operador_id INTEGER,
    usuario TEXT,
    terminal TEXT,
    fecha_inicio TEXT,
    ultimo_heartbeat TEXT
);
`);

// ====================================
// DATOS INICIALES
// ====================================

// Operador admin por defecto
const existeAdmin = db.prepare("SELECT id FROM operadores WHERE usuario = 'admin'").get();
if (!existeAdmin) {
    db.prepare("INSERT INTO operadores (usuario, password, nombre_completo, rol) VALUES ('admin', '123', 'ADMINISTRADOR DEL SISTEMA', 'ADMINISTRADOR')").run();
    console.log('Operador admin creado (password: 123)');
}

// Configuraciones por defecto
const upsertConfig = db.prepare("INSERT OR IGNORE INTO configuracion (key, value) VALUES (?, ?)");
upsertConfig.run('tipos_pausa', 'VIAJE,SALUD,SIN_AGUA,OTRO');
upsertConfig.run('max_dias_pausa', '180');
upsertConfig.run('ultimo_recibo', '0');

db.close();
console.log('Base de datos inicializada correctamente.');
