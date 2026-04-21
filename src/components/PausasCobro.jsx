import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Calendar, Clock, AlertCircle, Search, User, Plus, Check, X as XIcon, History, Download } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../utils/toast';
import { getPausas, getUsuarios, searchUsuarios, getUsuario } from '../services/data';
import { generatePauseCertificatePDF } from '../utils/pdf';
import { monthNames } from '../utils/formatters';

/**
 * ⏸️ PausasCobro - Módulo de pausa temporal de cobros
 * 
 * Características:
 * - Pausa por viaje, salud, falta de agua, u otros motivos
 * - Fechas de inicio y fin definidas
 * - No genera deuda durante el periodo de pausa
 * - Registro de auditoría con responsable
 * - Reanudación automática o manual
 */
export default function PausasCobro() {
    const { success, error, warning, info, ToastContainer } = useToast();
    const [search, setSearch] = useState('');
    const [usuarios, setUsuarios] = useState([]);
    const [selected, setSelected] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [pausasActivas, setPausasActivas] = useState([]);
    const [currentUser, setCurrentUser] = useState('ADMIN');

    const [form, setForm] = useState({
        fecha_inicio: new Date().toISOString().slice(0, 10),
        fecha_fin: '',
        motivo: '',
        tipo_pausa: 'SIN_AGUA',
        observaciones: ''
    });

    const TIPOS_PAUSA = [
        { value: 'SIN_AGUA', label: '🚫 Sin Agua', color: 'bg-blue-50 text-blue-600 border-blue-200' },
        { value: 'VIAJE', label: '✈️ Viaje', color: 'bg-amber-50 text-amber-600 border-amber-200' },
        { value: 'SALUD', label: '🏥 Salud', color: 'bg-red-50 text-red-600 border-red-200' },
        { value: 'OTRO', label: '📝 Otro', color: 'bg-slate-50 text-slate-600 border-slate-200' }
    ];

    // Obtener usuario actual
    useEffect(() => {
        const getUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setCurrentUser(session.user.email?.split('@')[0] || 'ADMIN');
            }
        };
        getUser();
    }, []);

    // Cargar pausas activas
    useEffect(() => {
        loadPausasActivas();
    }, []);

    const loadPausasActivas = async () => {
        try {
            const allPausas = await getPausas();
            const allUsers = await getUsuarios();
            const userMap = allUsers.reduce((acc, u) => ({ ...acc, [String(u.id)]: u }), {});

            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            const activas = [];
            const autoFinalizadas = [];

            for (const p of allPausas) {
                if (p.estado !== 'ACTIVA') continue;

                const fechaFin = new Date(p.fecha_fin + 'T23:59:59');

                // ── AUTO-FINALIZAR pausas cuya fecha_fin ya venció ──
                if (fechaFin < hoy) {
                    const usuario = userMap[String(p.usuario_id)];
                    try {
                        await supabase.from('pausas_cobro')
                            .update({ estado: 'FINALIZADA' })
                            .eq('id', p.id);
                        // Actualizar en memoria para que el check de otras pausas sea correcto
                        p.estado = 'FINALIZADA';

                        // Restaurar usuario a ACTIVO si no tiene otras pausas vigentes
                        const tieneOtrasPausas = allPausas.some(
                            op => op.id !== p.id &&
                                  op.usuario_id === p.usuario_id &&
                                  op.estado === 'ACTIVA' &&
                                  new Date(op.fecha_fin + 'T23:59:59') >= hoy
                        );

                        if (!tieneOtrasPausas) {
                            await supabase.from('usuarios')
                                .update({ estado: 'ACTIVO', motivo_estado: '' })
                                .eq('id', p.usuario_id);
                        }

                        autoFinalizadas.push(usuario?.nombre || 'Socio');
                        console.info(`[AUTO] Pausa ${p.id} finalizada automáticamente (venció ${p.fecha_fin})`);
                    } catch (autoErr) {
                        console.error('Error al auto-finalizar pausa:', autoErr);
                    }
                    continue; // No agregar a la lista de activas
                }

                const usuario = userMap[String(p.usuario_id)];
                activas.push({
                    ...p,
                    nombre: usuario?.nombre || 'Socio Desconocido',
                    codigo: usuario?.codigo || '',
                    estado_usuario: usuario?.estado || 'DESCONOCIDO'
                });
            }

            if (autoFinalizadas.length > 0) {
                info(`${autoFinalizadas.length} pausa(s) finalizada(s) automáticamente: ${autoFinalizadas.join(', ')}`);
            }

            setPausasActivas(activas);
        } catch (err) {
            console.error('Error al cargar pausas localmente:', err);
        }
    };

    // Buscar usuarios
    useEffect(() => {
        const fetchUsuarios = async () => {
            if (search.length < 2) {
                setUsuarios([]);
                return;
            }

            try {
                const term = search.toUpperCase();
                const results = await searchUsuarios(term);

                setUsuarios(results.slice(0, 10));
            } catch (err) {
                console.error('Error al buscar usuarios en local:', err);
            }
        };

        fetchUsuarios();
    }, [search]);

    // Verificar si usuario ya tiene pausa activa
    const tienePausaActiva = (usuarioId) => {
        return pausasActivas.some(p => p.usuario_id === usuarioId);
    };

    const handleCrearPausa = async (e) => {
        e.preventDefault();

        if (!selected) {
            warning('Seleccione un usuario');
            return;
        }

        if (!form.fecha_inicio || !form.fecha_fin) {
            warning('Las fechas son obligatorias');
            return;
        }

        if (!form.motivo.trim()) {
            warning('El motivo es obligatorio');
            return;
        }

        const inicio = new Date(form.fecha_inicio + 'T00:00:00');
        const fin = new Date(form.fecha_fin + 'T23:59:59');

        if (fin < inicio) {
            warning('La fecha de fin debe ser posterior a la de inicio');
            return;
        }

        // Validación: No permitir pausas antes del inicio de cobros del usuario
        if (selected.inicio_cobro) {
            const [y, m] = selected.inicio_cobro.split('-').map(Number);
            const fechaLimiteSocio = new Date(y, m - 1, 1, 0, 0, 0);
            if (inicio < fechaLimiteSocio) {
                warning(`No se puede pausar antes del inicio de cobros (${selected.inicio_cobro})`);
                return;
            }
        }

        // Máximo 180 días
        const dias = (fin - inicio) / (1000 * 60 * 60 * 24);
        if (dias > 180) {
            warning('La pausa no puede exceder los 180 días (6 meses)');
            return;
        }

        try {
            const pausaData = {
                usuario_id: selected.id,
                fecha_inicio: form.fecha_inicio,
                fecha_fin: form.fecha_fin,
                motivo: form.motivo.trim().toUpperCase(),
                tipo_pausa: form.tipo_pausa,
                responsable_autoriza: currentUser,
                observaciones: form.observaciones?.trim().toUpperCase() || '',
                estado: 'ACTIVA',
                fecha_autorizacion: new Date().toISOString()
            };

            const { data: savedPausa, error: insertErr } = await supabase.from('pausas_cobro').insert(pausaData).select();
            if (insertErr) throw insertErr;

            // ── CASCADA: Cambiar estado del usuario a INACTIVO ──
            const tipoLabel = TIPOS_PAUSA.find(t => t.value === form.tipo_pausa)?.label || form.tipo_pausa;
            const motivoPausa = `PAUSA PROGRAMADA: ${tipoLabel} - ${form.motivo.trim().toUpperCase()} (${form.fecha_inicio} AL ${form.fecha_fin})`;

            const { error: updateUserErr } = await supabase.from('usuarios')
                .update({ estado: 'INACTIVO', motivo_estado: motivoPausa })
                .eq('id', selected.id);

            if (updateUserErr) {
                warning('Pausa creada pero no se pudo cambiar el estado del usuario: ' + updateUserErr.message);
            }

            success(`Pausa creada para ${selected.nombre}. Estado cambiado a INACTIVO.`);
            
            // Limpiar y recargar
            setForm({
                fecha_inicio: new Date().toISOString().slice(0, 10),
                fecha_fin: '',
                motivo: '',
                tipo_pausa: 'SIN_AGUA',
                observaciones: ''
            });
            setSelected(null);
            setShowForm(false);
            setSearch('');
            loadPausasActivas();
        } catch (err) {
            console.error('Error al crear pausa:', err);
            error('Error al crear la pausa: ' + (err.message || 'Error desconocido'));
        }
    };

    const handleFinalizarPausa = async (pausa) => {
        const hoy = new Date();
        const hoyStr = hoy.toISOString().slice(0, 10);
        const esAnticipada = hoyStr < pausa.fecha_fin;

        let mensaje;
        if (esAnticipada) {
            // Calcular meses que se suspenderán por pausa (desde inicio hasta hoy)
            const inicio = new Date(pausa.fecha_inicio + 'T00:00:00');
            const mesesSuspendidos = [];
            let cur = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
            const finReal = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
            while (cur <= finReal) {
                mesesSuspendidos.push(`${monthNames[cur.getMonth()]} ${cur.getFullYear()}`);
                cur.setMonth(cur.getMonth() + 1);
            }

            mensaje = `¿Finalizar la pausa de ${pausa.nombre} ANTICIPADAMENTE?\n\n` +
                `Fecha programada: ${pausa.fecha_fin}\n` +
                `Se finalizará hoy: ${hoyStr}\n\n` +
                `Meses suspendidos por pausa: ${mesesSuspendidos.join(', ')}\n\n` +
                `Los meses restantes se cobrarán normalmente.\n` +
                `El estado del usuario volverá a ACTIVO.`;
        } else {
            mensaje = `¿Finalizar la pausa de ${pausa.nombre}?\n\nEl estado del usuario volverá a ACTIVO.`;
        }

        if (!confirm(mensaje)) return;

        try {
            const updateData = { estado: 'FINALIZADA' };
            // Si es anticipada, ajustar fecha_fin a hoy para recalcular meses suspendidos
            if (esAnticipada) {
                updateData.fecha_fin = hoyStr;
            }

            const { error: updateErr } = await supabase
                .from('pausas_cobro')
                .update(updateData)
                .eq('id', pausa.id);

            if (updateErr) throw updateErr;

            // ── CASCADA: Restaurar estado del usuario a ACTIVO ──
            const { data: otrasPausas } = await supabase.from('pausas_cobro')
                .select('id')
                .eq('usuario_id', pausa.usuario_id)
                .eq('estado', 'ACTIVA')
                .neq('id', pausa.id)
                .limit(1);

            if (!otrasPausas || otrasPausas.length === 0) {
                const { error: updateUserErr } = await supabase.from('usuarios')
                    .update({ estado: 'ACTIVO', motivo_estado: '' })
                    .eq('id', pausa.usuario_id);

                if (updateUserErr) {
                    warning('Pausa finalizada pero no se pudo restaurar el estado del usuario.');
                }
            }

            const msgExito = esAnticipada
                ? `Pausa finalizada anticipadamente (hasta ${hoyStr}). Usuario restaurado a ACTIVO.`
                : 'Pausa finalizada. Usuario restaurado a ACTIVO.';
            success(msgExito);
            loadPausasActivas();
        } catch (err) {
            console.error('Error al finalizar pausa:', err);
            error('Error al finalizar la pausa: ' + err.message);
        }
    };

    return (
        <div className="flex flex-col gap-8 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-marine tracking-tight uppercase flex items-center gap-3">
                    <Clock size={32} className="text-amber-500" />
                    Pausa de Cobros
                </h1>
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
                    Suspensión temporal de facturación por viaje, salud, falta de agua
                </p>
            </div>

            {/* Alerta informativa */}
            <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-2xl flex items-start gap-4">
                <AlertCircle size={24} className="text-blue-600 shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-black text-blue-800 text-sm uppercase tracking-wide">
                        ¿Cómo funciona la pausa de cobros?
                    </h3>
                    <ul className="text-blue-700 text-xs mt-2 space-y-1 font-bold">
                        <li>• Al crear una pausa, el usuario pasa a estado <strong>INACTIVO</strong> automáticamente</li>
                        <li>• Durante el periodo de pausa NO se genera deuda ni se permite cobrar</li>
                        <li>• El sistema excluye automáticamente los meses en pausa del cálculo de mora</li>
                        <li>• La pausa tiene fecha de inicio y fin (máximo 180 días)</li>
                        <li>• Al finalizar la pausa, el usuario vuelve a estado <strong>ACTIVO</strong></li>
                        <li>• Queda registrado el motivo y el responsable que autoriza</li>
                    </ul>
                </div>
            </div>

            {/* Pausas Activas */}
            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-900/5">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-marine uppercase tracking-tight flex items-center gap-2">
                        <Clock size={20} className="text-amber-500" />
                        Pausas Activas
                    </h2>
                    <span className="bg-amber-50 text-amber-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-200">
                        {pausasActivas.length} {pausasActivas.length === 1 ? 'Pausa' : 'Pausas'}
                    </span>
                </div>

                {pausasActivas.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pausasActivas.map(p => {
                            const tipoInfo = TIPOS_PAUSA.find(t => t.value === p.tipo_pausa) || TIPOS_PAUSA[3];
                            return (
                                <div key={p.id} className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn("p-2 rounded-lg", tipoInfo.color)}>
                                                <User size={16} />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 text-sm truncate max-w-[150px]">
                                                    {p.nombre}
                                                </p>
                                                <p className="text-[9px] text-slate-400 font-bold uppercase">
                                                    Cod: {p.codigo}
                                                </p>
                                                <span className={cn("text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md mt-1 inline-block",
                                                    p.estado_usuario === 'INACTIVO' ? "bg-orange-100 text-orange-600" :
                                                    p.estado_usuario === 'BAJA' ? "bg-red-100 text-red-600" :
                                                    "bg-emerald-100 text-emerald-600"
                                                )}>
                                                    {p.estado_usuario}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                                            <Calendar size={12} />
                                            <span>Inicio: {new Date(p.fecha_inicio).toLocaleDateString('es-ES')}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
                                            <Clock size={12} />
                                            <span>Fin: {new Date(p.fecha_fin).toLocaleDateString('es-ES')}</span>
                                        </div>
                                        {p.dias_restantes !== null && (
                                            <div className="text-[9px] font-black text-amber-600 uppercase tracking-wide">
                                                {p.dias_restantes} días restantes
                                            </div>
                                        )}
                                    </div>

                                    <div className={cn("px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest inline-block", tipoInfo.color)}>
                                        {tipoInfo.label}
                                    </div>

                                    <p className="text-[10px] text-slate-600 font-bold italic line-clamp-2">
                                        "{p.motivo}"
                                    </p>

                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={async () => {
                                                const socio = await getUsuario(Number(p.usuario_id));
                                                if (socio) await generatePauseCertificatePDF(p, socio);
                                            }}
                                            className="flex-1 bg-purple-100 hover:bg-purple-200 text-purple-600 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                        >
                                            <Download size={12} />
                                            PDF
                                        </button>
                                        <button
                                            onClick={() => handleFinalizarPausa(p)}
                                            className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-600 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                        >
                                            <Check size={12} />
                                            Finalizar
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400">
                        <Clock size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="font-black text-[11px] uppercase tracking-widest">
                            No hay pausas activas actualmente
                        </p>
                    </div>
                )}
            </div>

            {/* Formulario para nueva pausa */}
            {!showForm ? (
                <div className="bg-white border border-slate-100 p-10 rounded-[3rem] space-y-8 shadow-2xl shadow-blue-900/5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-marine uppercase tracking-tight flex items-center gap-2">
                            <Plus size={20} className="text-emerald-500" />
                            Nueva Pausa
                        </h2>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-marine transition-colors" size={20} />
                        <input
                            className="w-full bg-slate-50 border border-slate-100 p-5 pl-14 rounded-2xl font-black text-[13px] uppercase placeholder:text-slate-300 focus:outline-none focus:border-marine/30 transition-all"
                            placeholder="Buscar usuario por nombre, CI o Código..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {usuarios.length > 0 && (
                        <div className="space-y-2">
                            {usuarios.map(u => {
                                const tienePausa = tienePausaActiva(u.id);
                                return (
                                    <button
                                        key={u.id}
                                        onClick={() => {
                                            if (!tienePausa) {
                                                setSelected(u);
                                                setShowForm(true);
                                            }
                                        }}
                                        disabled={tienePausa}
                                        className={cn(
                                            "w-full flex justify-between items-center p-5 rounded-2xl border transition-all",
                                            tienePausa
                                                ? "bg-slate-100 border-slate-200 cursor-not-allowed opacity-50"
                                                : "bg-slate-50 border-slate-100 hover:bg-emerald-50 hover:border-emerald-200"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-marine rounded-xl text-white">
                                                <User size={20} />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-black text-slate-800 text-sm">{u.nombre}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                    CI: {u.ci} • Cod: {u.codigo} • Ramal: {u.tanque}
                                                </p>
                                            </div>
                                        </div>
                                        {tienePausa ? (
                                            <span className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">
                                                Con Pausa Activa
                                            </span>
                                        ) : (
                                            <span className="bg-emerald-100 text-emerald-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">
                                                Seleccionar
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {search.length > 2 && usuarios.length === 0 && (
                        <p className="text-center py-8 text-slate-400 font-black text-[11px] uppercase tracking-widest">
                            No se encontraron usuarios
                        </p>
                    )}
                </div>
            ) : (
                <form onSubmit={handleCrearPausa} className="bg-white border border-slate-100 p-10 rounded-[3.5rem] space-y-8 shadow-2xl shadow-blue-900/5 animate-in fade-in zoom-in duration-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-marine uppercase tracking-tighter">
                                Crear Pausa
                            </h2>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                {selected?.nombre}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setShowForm(false);
                                setSelected(null);
                            }}
                            className="p-3 hover:bg-slate-100 rounded-xl transition-all"
                        >
                            <XIcon size={24} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Fecha de Inicio *
                            </label>
                            <input
                                type="date"
                                required
                                className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-sm focus:outline-none focus:border-marine/30"
                                value={form.fecha_inicio}
                                onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Fecha de Fin *
                            </label>
                            <input
                                type="date"
                                required
                                className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-sm focus:outline-none focus:border-marine/30"
                                value={form.fecha_fin}
                                onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Tipo de Pausa *
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {TIPOS_PAUSA.map(tipo => (
                                <button
                                    key={tipo.value}
                                    type="button"
                                    onClick={() => setForm({ ...form, tipo_pausa: tipo.value })}
                                    className={cn(
                                        "p-4 rounded-2xl border-2 transition-all font-black text-sm uppercase tracking-widest",
                                        form.tipo_pausa === tipo.value
                                            ? tipo.color + " border-current shadow-lg"
                                            : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                                    )}
                                >
                                    {tipo.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Motivo *
                        </label>
                        <textarea
                            rows="3"
                            required
                            className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl font-bold text-sm focus:outline-none focus:border-marine/30"
                            placeholder="Describa el motivo de la pausa..."
                            value={form.motivo}
                            onChange={e => setForm({ ...form, motivo: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            Observaciones (Opcional)
                        </label>
                        <textarea
                            rows="2"
                            className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl font-bold text-sm focus:outline-none focus:border-marine/30"
                            placeholder="Información adicional..."
                            value={form.observaciones}
                            onChange={e => setForm({ ...form, observaciones: e.target.value })}
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="submit"
                            className="flex-1 bg-marine hover:bg-marine-light p-5 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-xl transition-all"
                        >
                            Crear Pausa
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowForm(false);
                                setSelected(null);
                            }}
                            className="px-8 bg-slate-100 hover:bg-slate-200 p-5 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-500 transition-all"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            )}

            <ToastContainer />
        </div>
    );
}
