import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { X, Receipt, AlertTriangle, Search, FileX, Calendar, User } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../utils/toast';
import { formatPeriodo } from '../utils/formatters';
import { periodoEnPausa } from '../utils/debt';
import { searchUsuarios, getPagosByUsuarios, getPausasByUsuario } from '../services/data';

/**
 * 🚫 AnularRecibos - Módulo de anulación de recibos con auditoría completa
 * 
 * Características:
 * - Búsqueda de recibos pagados
 * - Motivo obligatorio de anulación
 * - Registro en tabla anulaciones (auditoría)
 * - El correlativo NUNCA se reutiliza
 * - Cambio de estado a ANULADO en pagos
 */
export default function AnularRecibos() {
    const { success, error, warning, info, ToastContainer } = useToast();
    const [search, setSearch] = useState('');
    const [recibos, setRecibos] = useState([]);
    const [selected, setSelected] = useState(null);
    const [motivo, setMotivo] = useState('');
    const [observaciones, setObservaciones] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [currentUser, setCurrentUser] = useState('ADMIN');
    const [tipoAnulacion, setTipoAnulacion] = useState('ERROR_DIGITACION');
    const [reintegro, setReintegro] = useState(0);
    const [reciboReintegro, setReciboReintegro] = useState('');

    // Obtener usuario actual desde sesión
    useEffect(() => {
        const getUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setCurrentUser(session.user.email?.split('@')[0] || 'ADMIN');
            }
        };
        getUser();
    }, []);

    // Buscar recibos pagados localmente
    useEffect(() => {
        const fetchRecibos = async () => {
            if (search.length < 2) {
                setRecibos([]);
                return;
            }

            try {
                const term = search.toUpperCase();
                
                // 1. Buscar usuarios en Supabase
                const usuarios = await searchUsuarios(term);

                if (!usuarios || usuarios.length === 0) {
                    setRecibos([]);
                    return;
                }

                const userIds = usuarios.map(u => u.id);
                const socioMap = usuarios.reduce((acc, s) => ({ ...acc, [s.id]: s }), {});

                // 2. Obtener pagos PAGADOS desde Supabase
                const allPagos = await getPagosByUsuarios(userIds);
                const pagos = allPagos.filter(p => p.estado === 'PAGADO');

                if (pagos) {
                    // AGRUPAR POR CORRELATIVO
                    const agrupados = pagos.reduce((acc, p) => {
                        const socio = socioMap[p.usuario_id];
                        const key = `${p.usuario_id}_${p.correlativo}`;
                        if (!acc[key]) {
                            acc[key] = {
                                id: p.id,
                                correlativo: p.correlativo,
                                usuario_id: p.usuario_id,
                                nombre: socio?.nombre,
                                codigo: socio?.codigo,
                                montoTotal: 0,
                                periodos: [],
                                fecha: p.fecha,
                                items: [],
                                periodosBajoPausa: [] // Flag para warning
                            };
                        }
                        acc[key].montoTotal += parseFloat(p.monto);
                        acc[key].periodos.push(p.periodo);
                        acc[key].items.push(p);
                        return acc;
                    }, {});

                    // Verificar si algún periodo del recibo está cubierto por pausa
                    for (const key of Object.keys(agrupados)) {
                        const grupo = agrupados[key];
                        const pausasUser = await getPausasByUsuario(Number(grupo.usuario_id));
                        const pausasValidas = pausasUser.filter(p => p.estado === 'ACTIVA' || p.estado === 'FINALIZADA');
                        grupo.periodosBajoPausa = grupo.periodos.filter(per => periodoEnPausa(per, pausasValidas));
                    }

                    setRecibos(Object.values(agrupados));
                }
            } catch (err) {
                console.error('Error al buscar recibos:', err);
            }
        };

        fetchRecibos();
    }, [search]);

    const handleAnular = async () => {
        if (!selected) return;

        if (!motivo.trim()) {
            warning('El motivo de anulación es obligatorio');
            return;
        }

        try {
            // VALIDACIÓN: ¿Es el último recibo de la cuenta?
            const { data: masRecientes, error: checkError } = await supabase.from('pagos')
                .select('correlativo')
                .eq('usuario_id', selected.usuario_id)
                .eq('estado', 'PAGADO')
                .gt('correlativo', selected.correlativo)
                .limit(1);

            if (checkError) throw checkError;

            if (masRecientes && masRecientes.length > 0) {
                warning(`No se puede anular. Existen recibos más recientes (N° ${masRecientes[0].correlativo}) para este usuario. Debe anularlos primero.`);
                return;
            }

            const reintegroTotal = parseFloat(reintegro) || 0;
            
            // 1. Registrar las anulaciones (una por cada mes/item del recibo)
            // Dividimos el reintegro proporcionalmente o lo asignamos al primer item? 
            // Para simplicidad contable, asignamos el reintegro total al primer registro y 0 a los demás, 
            // o lo guardamos en la tabla de anulaciones asociado al correlativo.
            
            const promesasAnulacion = selected.items.map(async (item, index) => {
                const anulacionData = {
                    pago_id: item.id,
                    usuario_id: item.usuario_id,
                    correlativo: item.correlativo,
                    periodo: item.periodo,
                    monto_anulado: item.monto,
                    motivo: motivo.trim().toUpperCase(),
                    tipo_anulacion: tipoAnulacion,
                    reintegro: index === 0 ? reintegroTotal : 0,
                    recibo_reintegro: index === 0 ? (reciboReintegro.trim().toUpperCase() || null) : null,
                    responsable_anulacion: currentUser,
                    observaciones: observaciones.trim().toUpperCase(),
                    fecha_anulacion: new Date().toISOString()
                };

                // Registrar auditoría en Supabase
                const { data: savedAnul, error: anulError } = await supabase.from('anulaciones').insert(anulacionData).select();
                if (anulError) throw anulError;

                // Actualizar estado del pago en Supabase
                const { error: updError } = await supabase.from('pagos')
                    .update({ estado: 'ANULADO' })
                    .eq('id', item.id);
                if (updError) throw updError;

            });

            await Promise.all(promesasAnulacion);

            let mensajeExito = `Recibo N° ${selected.correlativo} anulado con éxito (${selected.items.length} meses)`;
            if (reintegroTotal > 0) {
                mensajeExito += ` - Reintegro: Bs ${reintegroTotal.toFixed(2)}`;
            }
            
            success(mensajeExito);
            
            // Limpiar y recargar
            setMotivo('');
            setObservaciones('');
            setTipoAnulacion('ERROR_DIGITACION');
            setReintegro(0);
            setReciboReintegro('');
            setSelected(null);
            setConfirming(false);
            setSearch('');
            setRecibos([]);
        } catch (err) {
            console.error('Error al anular recibo:', err);
            error('Error al anular el recibo: ' + (err.message || 'Error desconocido'));
        }
    };

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-marine tracking-tight uppercase flex items-center gap-3">
                    <FileX size={32} className="text-red-500" />
                    Anular Recibos
                </h1>
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
                    Cancelación de recibos con registro de auditoría
                </p>
            </div>

            {/* Alerta informativa */}
            <div role="alert" className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl flex items-start gap-4">
                <AlertTriangle size={24} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-black text-amber-800 text-sm uppercase tracking-wide">
                        Importante - Proceso Irreversible
                    </h3>
                    <ul className="text-amber-700 text-xs mt-2 space-y-1 font-bold">
                        <li>• El recibo anulado NO se puede recuperar</li>
                        <li>• El número de correlativo NUNCA se reutiliza</li>
                        <li>• Queda registrado en auditoría con motivo y responsable</li>
                        <li>• El usuario volverá a aparecer como deudor del periodo anulado</li>
                    </ul>
                </div>
            </div>

            {!selected ? (
                <div className="bg-white border border-slate-100 p-10 rounded-[3rem] space-y-8 shadow-2xl shadow-blue-900/5">
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-marine transition-colors" size={20} />
                        <input
                            className="w-full bg-slate-50 border border-slate-100 p-5 pl-14 rounded-2xl font-black text-[13px] uppercase placeholder:text-slate-300 focus:outline-none focus:border-marine/30 transition-all"
                            placeholder="Buscar por nombre, CI o Código de usuario..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Recibos Pagados Encontrados
                        </h3>
                        {recibos.map(r => (
                            <button
                                key={r.id}
                                onClick={() => setSelected(r)}
                                className="w-full flex justify-between items-center p-5 rounded-2xl bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-200 transition-all group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-marine rounded-xl text-white">
                                        <Receipt size={20} />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-black text-slate-800 text-sm">
                                            {r.nombre || 'Usuario'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                                            Recibo N° {r.correlativo} • {r.periodos.length > 1 ? `${r.periodos[0]} - ${r.periodos[r.periodos.length-1]}` : r.periodos[0]}
                                        </p>
                                        {r.periodosBajoPausa && r.periodosBajoPausa.length > 0 && (
                                            <p className="text-[9px] text-amber-600 font-black mt-0.5">⚠️ Cobro durante pausa: {r.periodosBajoPausa.join(', ')}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <p className="font-black text-marine text-lg">Bs {r.montoTotal.toFixed(2)}</p>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase">
                                            {new Date(r.fecha).toLocaleDateString('es-ES')}
                                        </p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white transition-all">
                                        <X size={16} />
                                    </div>
                                </div>
                            </button>
                        ))}
                        {search.length > 2 && recibos.length === 0 && (
                            <p role="alert" className="text-center py-8 text-slate-400 font-black text-[11px] uppercase tracking-widest">
                                No se encontraron recibos pagados
                            </p>
                        )}
                    </div>
                </div>
            ) : confirming ? (
                <div className="bg-white border border-slate-100 p-10 rounded-[3rem] space-y-8 shadow-2xl shadow-blue-900/5">
                    <div role="alert" className="flex items-center gap-4 p-6 bg-red-50 border-2 border-red-200 rounded-2xl">
                        <AlertTriangle size={32} className="text-red-600 shrink-0" />
                        <div>
                            <h3 className="font-black text-red-800 text-lg uppercase">
                                Confirmar Anulación
                            </h3>
                            <p className="text-red-600 text-sm font-bold mt-1">
                                Esta acción no se puede deshacer
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recibo</span>
                            <span className="font-black text-marine text-lg">N° {selected.correlativo}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuario</span>
                            <span className="font-bold text-slate-700 text-sm">{selected.nombre}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Periodos ({selected.items.length})</span>
                            <span className="font-bold text-slate-700 text-xs text-right max-w-[200px]">{selected.periodos.join(', ')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto Total</span>
                            <span className="font-black text-emerald-600 text-lg">Bs {selected.montoTotal.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                                Tipo de Anulación *
                            </label>
                            <select
                                className="w-full bg-white border-2 border-red-200 p-4 rounded-xl font-bold text-sm focus:outline-none focus:border-red-400"
                                value={tipoAnulacion}
                                onChange={e => setTipoAnulacion(e.target.value)}
                            >
                                <option value="ERROR_DIGITACION">Error en digitación del recibo</option>
                                <option value="PAGO_INDEBIDO">Usuario pagó sin deber (pago indebido)</option>
                                <option value="DUPLICADO">Pago duplicado</option>
                                <option value="SOLICITUD_USUARIO">Solicitud del usuario</option>
                            </select>
                            <p className="text-[9px] text-slate-500 font-bold mt-1">
                                {tipoAnulacion === 'PAGO_INDEBIDO' 
                                    ? '💵 El usuario recibe reintegro del dinero'
                                    : tipoAnulacion === 'DUPLICADO'
                                    ? '🔄 Se mantiene el primer pago, se anula el repetido'
                                    : '📝 Se registrará en auditoría'}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                                Motivo Detallado *
                            </label>
                            <select
                                className="w-full bg-white border-2 border-red-200 p-4 rounded-xl font-bold text-sm focus:outline-none focus:border-red-400"
                                value={motivo}
                                onChange={e => setMotivo(e.target.value)}
                            >
                                <option value="">Seleccione un motivo...</option>
                                <option value="ERROR_DIGITACION">Error al digitar el recibo</option>
                                <option value="ERROR_MONTO">Error en el monto cobrado</option>
                                <option value="ERROR_PERIODO">Error en el periodo asignado</option>
                                <option value="PAGO_DUPLICADO">El usuario pagó dos veces el mismo periodo</option>
                                <option value="OLVIDO_PAGO">Usuario olvidó que ya había pagado</option>
                                <option value="SIN_SERVICIO">No se recibió el servicio en ese periodo</option>
                                <option value="OTRO">Otro motivo</option>
                            </select>
                        </div>

                        {(tipoAnulacion === 'PAGO_INDEBIDO' || tipoAnulacion === 'DUPLICADO') && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 bg-blue-50 p-4 rounded-xl border border-blue-200">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                                        💵 Monto de Reintegro (Bs)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full bg-white border-2 border-blue-300 p-4 rounded-xl font-black text-lg text-blue-700 focus:outline-none focus:border-blue-500"
                                        value={reintegro}
                                        onChange={e => setReintegro(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                    />
                                    <p className="text-[9px] text-blue-600 font-bold">
                                        Monto original: Bs {selected.montoTotal.toFixed(2)} | 
                                        Reintegro: <span className="font-black">Bs {(parseFloat(reintegro) || 0).toFixed(2)}</span> |
                                        No reintegrado: <span className="font-black">Bs {(selected.montoTotal - (parseFloat(reintegro) || 0)).toFixed(2)}</span>
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                                        Número de Recibo de Reintegro
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-white border-2 border-blue-300 p-4 rounded-xl font-bold text-sm focus:outline-none focus:border-blue-500"
                                        value={reciboReintegro}
                                        onChange={e => setReciboReintegro(e.target.value)}
                                        placeholder="Ej. 0001234"
                                    />
                                    <p className="text-[9px] text-blue-600 font-bold">
                                        Opcional - Se puede completar después
                                    </p>
                                </div>
                            </div>
                        )}

                        {motivo && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    Observaciones Adicionales (Opcional)
                                </label>
                                <textarea
                                    rows="3"
                                    className="w-full bg-white border border-slate-200 p-4 rounded-xl font-bold text-sm focus:outline-none focus:border-marine/30"
                                    placeholder="Detalles adicionales, explicación para asamblea, etc..."
                                    value={observaciones}
                                    onChange={e => setObservaciones(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={handleAnular}
                            disabled={!motivo}
                            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed p-5 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-xl transition-all"
                        >
                            Confirmar Anulación
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setConfirming(false);
                                setSelected(null);
                                setMotivo('');
                                setObservaciones('');
                            }}
                            className="px-8 bg-slate-100 hover:bg-slate-200 p-5 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-500 transition-all"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white border border-slate-100 p-10 rounded-[3rem] space-y-8 shadow-2xl shadow-blue-900/5">
                    <div className="text-center py-12">
                        <Receipt size={64} className="mx-auto text-marine mb-4" />
                        <h3 className="font-black text-slate-700 text-xl uppercase">
                            Recibo Seleccionado
                        </h3>
                        <p className="text-slate-400 text-sm font-bold mt-2">
                            Recibo N° {selected.correlativo} - {selected.periodos.length > 1 ? `${selected.periodos[0]} AL ${selected.periodos[selected.periodos.length-1]}` : selected.periodos[0]}
                        </p>
                        <button
                            onClick={() => setConfirming(true)}
                            className="mt-6 bg-red-600 hover:bg-red-700 px-12 py-4 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-xl transition-all inline-flex items-center gap-2"
                        >
                            <FileX size={18} />
                            Proceder con Anulación
                        </button>
                    </div>
                </div>
            )}

            <ToastContainer />
        </div>
    );
}
