/**
 * Control de sesiones activas.
 * Impide que un mismo usuario inicie sesion en dos terminales a la vez.
 * Usa heartbeat cada 15s para detectar sesiones abandonadas (timeout: 45s).
 */
import { supabase } from '../supabase';

const HEARTBEAT_INTERVAL = 15000; // 15 segundos
const SESSION_TIMEOUT = 45; // segundos sin heartbeat = sesion expirada

let heartbeatTimer = null;
let currentSessionId = null;

/**
 * Verifica si el usuario ya tiene una sesion activa en otra terminal.
 * Retorna { ocupado: true/false, mensaje: string }
 */
export const verificarSesion = async (usuario) => {
    // Limpiar sesiones expiradas de este usuario (heartbeat viejo)
    const { error: delError } = await supabase.from('sesiones_activas')
        .delete()
        .eq('usuario', usuario)
        .lt('ultimo_heartbeat', new Date(Date.now() - SESSION_TIMEOUT * 1000).toISOString());

    // Si la tabla no existe o hay error de permisos, permitir login
    if (delError) {
        console.warn('Error limpiando sesiones expiradas:', delError.message);
        return { ocupado: false };
    }

    // Verificar si queda alguna sesion activa
    const { data: sesiones, error: selError } = await supabase.from('sesiones_activas')
        .select('*')
        .eq('usuario', usuario);

    if (selError) {
        console.warn('Error verificando sesiones:', selError.message);
        return { ocupado: false };
    }

    if (sesiones && sesiones.length > 0) {
        const sesion = sesiones[0];
        const hace = Math.round((Date.now() - new Date(sesion.ultimo_heartbeat).getTime()) / 1000);
        return {
            ocupado: true,
            mensaje: `La cuenta "${usuario}" esta en uso en otra terminal${sesion.terminal ? ' (' + sesion.terminal + ')' : ''}. Ultimo latido: hace ${hace}s.`
        };
    }

    return { ocupado: false };
};

/**
 * Registra una nueva sesion activa e inicia el heartbeat.
 */
export const iniciarSesion = async (operador) => {
    const terminal = `${navigator.userAgent.slice(0, 30)}...`;

    const { data, error } = await supabase.from('sesiones_activas')
        .insert({
            operador_id: operador.id,
            usuario: operador.usuario,
            terminal,
            fecha_inicio: new Date().toISOString(),
            ultimo_heartbeat: new Date().toISOString()
        })
        .select()
        .single();

    if (error) throw error;
    currentSessionId = data.id;

    // Iniciar heartbeat periodico
    heartbeatTimer = setInterval(async () => {
        if (!currentSessionId) return;
        try {
            await supabase.from('sesiones_activas')
                .update({ ultimo_heartbeat: new Date().toISOString() })
                .eq('id', currentSessionId);
        } catch (err) {
            console.error('Error en heartbeat:', err);
        }
    }, HEARTBEAT_INTERVAL);

    return data;
};

/**
 * Cierra la sesion activa y detiene el heartbeat.
 */
export const cerrarSesion = async () => {
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }

    if (currentSessionId) {
        try {
            await supabase.from('sesiones_activas')
                .delete()
                .eq('id', currentSessionId);
        } catch (err) {
            console.error('Error al cerrar sesion:', err);
        }
        currentSessionId = null;
    }
};

/**
 * Forzar cierre al cerrar ventana/tab.
 * sendBeacon solo soporta POST, asi que enviamos a una URL con el metodo DELETE
 * simulado via header. Como alternativa, usamos fetch con keepalive.
 */
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        if (currentSessionId) {
            try {
                fetch(`/api/rest/sesiones_activas?id=eq.${currentSessionId}`, {
                    method: 'DELETE',
                    keepalive: true,
                });
            } catch (e) {
                // Best-effort: el timeout limpiara si falla
            }
        }
    });
}
