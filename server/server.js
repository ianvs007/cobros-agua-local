/**
 * Servidor Express + SQLite para cobros_agua (versión local).
 * Reemplaza Supabase con una API REST compatible.
 */
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, 'cobros_agua.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ====================================
// UTILIDADES
// ====================================

function parseFilters(query) {
    const where = [];
    const params = [];
    for (const [key, val] of Object.entries(query)) {
        if (['select', 'order', 'limit', 'offset', 'or'].includes(key)) continue;
        // eq filter: field=eq.value
        if (typeof val === 'string' && val.startsWith('eq.')) {
            where.push(`${key} = ?`);
            params.push(val.slice(3));
        }
        // neq filter: field=neq.value
        else if (typeof val === 'string' && val.startsWith('neq.')) {
            where.push(`${key} != ?`);
            params.push(val.slice(4));
        }
        // gt filter: field=gt.value
        else if (typeof val === 'string' && val.startsWith('gt.')) {
            where.push(`${key} > ?`);
            params.push(val.slice(3));
        }
        // lt filter: field=lt.value
        else if (typeof val === 'string' && val.startsWith('lt.')) {
            where.push(`${key} < ?`);
            params.push(val.slice(3));
        }
        // in filter: field=in.(val1,val2)
        else if (typeof val === 'string' && val.startsWith('in.(')) {
            const values = val.slice(4, -1).split(',');
            where.push(`${key} IN (${values.map(() => '?').join(',')})`);
            params.push(...values);
        }
        // not.is.null filter: field=not.is.null
        else if (typeof val === 'string' && val === 'not.is.null') {
            where.push(`${key} IS NOT NULL`);
        }
        // is.null filter: field=is.null
        else if (typeof val === 'string' && val === 'is.null') {
            where.push(`${key} IS NULL`);
        }
    }

    // Handle OR filters: or=(nombre.ilike.%X%,ci.ilike.%X%)
    if (query.or) {
        const orStr = query.or.replace(/^\(/, '').replace(/\)$/, '');
        const orParts = [];
        // Parse each condition: field.op.value
        for (const part of orStr.split(',')) {
            const match = part.match(/^(\w+)\.(ilike|eq|neq|like)\.(.+)$/i);
            if (match) {
                const [, field, op, value] = match;
                if (op.toLowerCase() === 'ilike' || op.toLowerCase() === 'like') {
                    orParts.push(`${field} LIKE ? COLLATE NOCASE`);
                    params.push(value);
                } else if (op === 'eq') {
                    orParts.push(`${field} = ?`);
                    params.push(value);
                } else if (op === 'neq') {
                    orParts.push(`${field} != ?`);
                    params.push(value);
                }
            }
        }
        if (orParts.length > 0) {
            where.push(`(${orParts.join(' OR ')})`);
        }
    }

    return { where, params };
}

function parseOrder(orderStr) {
    if (!orderStr) return '';
    // Format: "field.asc" or "field.desc"
    const parts = orderStr.split('.');
    const field = parts[0];
    const dir = parts[1]?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    return ` ORDER BY ${field} ${dir}`;
}

// ====================================
// RUTAS API REST
// ====================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', local: true });
});

// Heartbeat (mantiene el servidor activo)
app.get('/api/heartbeat', (req, res) => {
    lastHeartbeat = Date.now();
    res.send('ok');
});

// Shutdown
app.get('/api/shutdown', (req, res) => {
    res.send('Cerrando servidor...');
    setTimeout(() => process.exit(0), 500);
});

// ── SELECT (GET) ──
app.get('/api/rest/:table', (req, res) => {
    try {
        const { table } = req.params;
        const { where, params } = parseFilters(req.query);
        const columns = req.query.select || '*';

        let sql = `SELECT ${columns} FROM ${table}`;
        if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;
        sql += parseOrder(req.query.order);
        if (req.query.limit) sql += ` LIMIT ${parseInt(req.query.limit)}`;

        const rows = db.prepare(sql).all(...params);
        res.json(rows);
    } catch (err) {
        console.error('GET error:', err.message);
        res.status(400).json({ message: err.message, code: 'SQLITE_ERROR' });
    }
});

// ── INSERT (POST) ──
app.post('/api/rest/:table', (req, res) => {
    try {
        const { table } = req.params;
        const rows = Array.isArray(req.body) ? req.body : [req.body];
        const results = [];

        const insertMany = db.transaction((rows) => {
            for (const row of rows) {
                const keys = Object.keys(row);
                const vals = Object.values(row);
                const placeholders = keys.map(() => '?').join(',');
                const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})`;
                const info = db.prepare(sql).run(...vals);
                // Fetch the inserted row with the generated ID
                const inserted = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
                results.push(inserted);
            }
        });

        insertMany(rows);
        res.status(201).json(results);
    } catch (err) {
        console.error('POST error:', err.message);
        res.status(400).json({ message: err.message, code: err.code || 'SQLITE_ERROR' });
    }
});

// ── UPDATE (PATCH) ──
app.patch('/api/rest/:table', (req, res) => {
    try {
        const { table } = req.params;
        const { where, params: filterParams } = parseFilters(req.query);
        const data = req.body;
        const setClauses = [];
        const setParams = [];

        for (const [key, val] of Object.entries(data)) {
            setClauses.push(`${key} = ?`);
            setParams.push(val);
        }

        let sql = `UPDATE ${table} SET ${setClauses.join(', ')}`;
        if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;

        const allParams = [...setParams, ...filterParams];
        db.prepare(sql).run(...allParams);

        // Return updated rows
        let selectSql = `SELECT * FROM ${table}`;
        if (where.length > 0) selectSql += ` WHERE ${where.join(' AND ')}`;
        const rows = db.prepare(selectSql).all(...filterParams);
        res.json(rows);
    } catch (err) {
        console.error('PATCH error:', err.message);
        res.status(400).json({ message: err.message, code: 'SQLITE_ERROR' });
    }
});

// ── DELETE ──
app.delete('/api/rest/:table', (req, res) => {
    try {
        const { table } = req.params;
        const { where, params } = parseFilters(req.query);

        let sql = `DELETE FROM ${table}`;
        if (where.length > 0) sql += ` WHERE ${where.join(' AND ')}`;

        db.prepare(sql).run(...params);
        res.json([]);
    } catch (err) {
        console.error('DELETE error:', err.message);
        res.status(400).json({ message: err.message, code: 'SQLITE_ERROR' });
    }
});

// ── UPSERT (PUT) ── para configuracion
app.put('/api/rest/:table', (req, res) => {
    try {
        const { table } = req.params;
        const rows = Array.isArray(req.body) ? req.body : [req.body];
        const results = [];

        for (const row of rows) {
            const keys = Object.keys(row);
            const vals = Object.values(row);
            const placeholders = keys.map(() => '?').join(',');
            const updateClauses = keys.map(k => `${k} = excluded.${k}`).join(', ');
            const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders}) ON CONFLICT(${keys[0]}) DO UPDATE SET ${updateClauses}`;
            db.prepare(sql).run(...vals);
            results.push(row);
        }

        res.json(results);
    } catch (err) {
        console.error('PUT error:', err.message);
        res.status(400).json({ message: err.message, code: 'SQLITE_ERROR' });
    }
});

// ====================================
// HEARTBEAT + AUTO-SHUTDOWN
// ====================================
let lastHeartbeat = Date.now();
const START_TIME = Date.now();
const INACTIVITY_TIMEOUT = 30000;
const GRACE_PERIOD = 60000;

setInterval(() => {
    const now = Date.now();
    if (now - START_TIME < GRACE_PERIOD) return;
    if (now - lastHeartbeat > INACTIVITY_TIMEOUT) {
        console.log('\n[SERVIDOR] No se detecta actividad del navegador. Cerrando...');
        db.close();
        process.exit(0);
    }
}, 5000);

// Cerrar DB limpiamente al salir
process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`[SERVIDOR LOCAL] API corriendo en http://localhost:${PORT}`);
    console.log(`[SERVIDOR LOCAL] Base de datos: ${DB_PATH}`);
});
