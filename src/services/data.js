/**
 * Servicio de datos centralizado - Lee directamente de Supabase (nube).
 * Reemplaza todas las lecturas de Dexie (IndexedDB local) para que
 * todos los equipos vean los mismos datos en tiempo real.
 */
import { supabase } from '../supabase';

// ── USUARIOS ──

export const getUsuarios = async () => {
    const { data, error } = await supabase.from('usuarios').select('*');
    if (error) throw error;
    return data || [];
};

export const searchUsuarios = async (term) => {
    const upperTerm = term.toUpperCase();
    const { data, error } = await supabase.from('usuarios')
        .select('*')
        .or(`nombre.ilike.%${upperTerm}%,ci.ilike.%${upperTerm}%,codigo.ilike.%${upperTerm}%`);
    if (error) throw error;
    return data || [];
};

export const getUsuario = async (id) => {
    const { data, error } = await supabase.from('usuarios')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) throw error;
    return data;
};

// ── PAGOS ──

export const getPagos = async () => {
    const { data, error } = await supabase.from('pagos').select('*');
    if (error) throw error;
    return data || [];
};

export const getPagosByUsuario = async (usuarioId) => {
    const { data, error } = await supabase.from('pagos')
        .select('*')
        .eq('usuario_id', usuarioId);
    if (error) throw error;
    return data || [];
};

export const getPagosByUsuarios = async (userIds) => {
    if (!userIds || userIds.length === 0) return [];
    const { data, error } = await supabase.from('pagos')
        .select('*')
        .in('usuario_id', userIds);
    if (error) throw error;
    return data || [];
};

// ── PAUSAS ──

export const getPausas = async () => {
    const { data, error } = await supabase.from('pausas_cobro').select('*');
    if (error) throw error;
    return data || [];
};

export const getPausasByUsuario = async (usuarioId) => {
    const { data, error } = await supabase.from('pausas_cobro')
        .select('*')
        .eq('usuario_id', usuarioId);
    if (error) throw error;
    return data || [];
};

export const getPausasByUsuarios = async (userIds) => {
    if (!userIds || userIds.length === 0) return [];
    const { data, error } = await supabase.from('pausas_cobro')
        .select('*')
        .in('usuario_id', userIds);
    if (error) throw error;
    return data || [];
};

// ── CONDONACIONES ──

export const getCondonaciones = async () => {
    const { data, error } = await supabase.from('condonaciones').select('*');
    if (error) throw error;
    return data || [];
};

export const getCondonacionesByUsuario = async (usuarioId) => {
    const { data, error } = await supabase.from('condonaciones')
        .select('*')
        .eq('usuario_id', usuarioId);
    if (error) throw error;
    return data || [];
};

export const getCondonacionesByUsuarios = async (userIds) => {
    if (!userIds || userIds.length === 0) return [];
    const { data, error } = await supabase.from('condonaciones')
        .select('*')
        .in('usuario_id', userIds);
    if (error) throw error;
    return data || [];
};

// ── ANULACIONES ──

export const getAnulaciones = async () => {
    const { data, error } = await supabase.from('anulaciones').select('*');
    if (error) throw error;
    return data || [];
};

export const getAnulacionesByUsuario = async (usuarioId) => {
    const { data, error } = await supabase.from('anulaciones')
        .select('*')
        .eq('usuario_id', usuarioId);
    if (error) throw error;
    return data || [];
};

// ── CONFIGURACION ──

export const getConfiguracion = async () => {
    const { data, error } = await supabase.from('configuracion').select('*');
    if (error) throw error;
    return data || [];
};

// ── OPERADORES ──

export const getOperadores = async () => {
    const { data, error } = await supabase.from('operadores')
        .select('*')
        .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
};
