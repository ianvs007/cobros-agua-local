import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { ShieldOff, Search, User, AlertCircle, Check, X as XIcon, History } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../utils/toast';
import { searchUsuarios, getPagosByUsuario, getPausasByUsuario, getCondonacionesByUsuario } from '../services/data';
import { calcularMoraSocio, periodoEnPausa } from '../utils/debt';

const TIPOS_CONDONACION = [
    { value: 'INSOLVENCIA', label: 'Insolvencia Economica', color: 'bg-red-50 text-red-600 border-red-200' },
    { value: 'FALLECIMIENTO', label: 'Fallecimiento del Socio', color: 'bg-slate-50 text-slate-600 border-slate-200' },
    { value: 'ACUERDO_DIRECTIVA', label: 'Acuerdo de Directiva', color: 'bg-blue-50 text-blue-600 border-blue-200' },
    { value: 'OTRO', label: 'Otro Motivo', color: 'bg-amber-50 text-amber-600 border-amber-200' }
];

export default function CondonarDeuda() {
    const { success, error, warning, ToastContainer } = useToast();
    const [search, setSearch] = useState('');
    const [usuarios, setUsuarios] = useState([]);
    const [selected, setSelected] = useState(null);
    const [mesesPendientes, setMesesPendientes] = useState([]);
    const [mesesCondonados, setMesesCondonados] = useState([]);
    const [selectedMonths, setSelectedMonths] = useState(new Set());
    const [form, setForm] = useState({ motivo: '', tipo_condonacion: 'ACUERDO_DIRECTIVA', observaciones: '' });
    const [confirming, setConfirming] = useState(false);
    const [currentUser, setCurrentUser] = useState('ADMIN');

    useEffect(() => {
        const getUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                setCurrentUser(session.user.email?.split('@')[0] || 'ADMIN');
            }
        };
        getUser();
    }, []);

    // Buscar usuarios
    useEffect(() => {
        const fetchUsuarios = async () => {
            if (search.length < 2) { setUsuarios([]); return; }
            try {
                const results = await searchUsuarios(search);
                setUsuarios(results.slice(0, 10));
            } catch (err) {
                console.error('Error al buscar usuarios:', err);
            }
        };
        fetchUsuarios();
    }, [search]);

    // Al seleccionar usuario, calcular meses pendientes
    const handleSelectUser = async (u) => {
        setSelected(u);
        setSelectedMonths(new Set());
        setConfirming(false);
        try {
            const socioId = Number(u.id);
            const allPagos = await getPagosByUsuario(socioId);
            const pagosSocio = allPagos.filter(p => p.estado === 'PAGADO');
            const pausasSocio = (await getPausasByUsuario(socioId)).filter(p => p.estado === 'ACTIVA' || p.estado === 'FINALIZADA');
            const condonacionesSocio = await getCondonacionesByUsuario(socioId);

            const { mesesPendientes: pendientes, mesesCondonados: condonados } = calcularMoraSocio(
                u.inicio_cobro, pagosSocio, u.tarifa, pausasSocio, condonacionesSocio
            );

            // Filtrar meses que ya están cubiertos por pausa (evitar doble registro)
            const pendientesFiltrados = pendientes.filter(mes => !periodoEnPausa(mes, pausasSocio));

            setMesesPendientes(pendientesFiltrados);
            setMesesCondonados(condonados || []);
        } catch (err) {
            console.error('Error al calcular deuda:', err);
            setMesesPendientes([]);
            setMesesCondonados([]);
        }
    };

    const toggleMonth = (mes) => {
        setSelectedMonths(prev => {
            const next = new Set(prev);
            if (next.has(mes)) next.delete(mes); else next.add(mes);
            return next;
        });
    };

    const selectAll = () => {
        setSelectedMonths(new Set(mesesPendientes));
    };

    const deselectAll = () => {
        setSelectedMonths(new Set());
    };

    const handleCondonar = async () => {
        if (selectedMonths.size === 0) { warning('Seleccione al menos un mes a condonar'); return; }
        if (!form.motivo.trim()) { warning('El motivo es obligatorio'); return; }

        try {
            const condonacionesAGuardar = Array.from(selectedMonths).map(periodo => ({
                usuario_id: selected.id,
                periodo,
                monto_condonado: parseFloat(selected.tarifa) || 10,
                motivo: form.motivo.trim().toUpperCase(),
                tipo_condonacion: form.tipo_condonacion,
                responsable_condonacion: currentUser,
                fecha_condonacion: new Date().toISOString(),
                observaciones: form.observaciones?.trim().toUpperCase() || ''
            }));

            const { data: saved, error: insertErr } = await supabase
                .from('condonaciones')
                .insert(condonacionesAGuardar)
                .select();
            if (insertErr) throw insertErr;

            success(`${selectedMonths.size} mes(es) condonado(s) para ${selected.nombre}`);

            // Reset
            setForm({ motivo: '', tipo_condonacion: 'ACUERDO_DIRECTIVA', observaciones: '' });
            setSelectedMonths(new Set());
            setConfirming(false);
            setSelected(null);
            setSearch('');
            setUsuarios([]);
        } catch (err) {
            console.error('Error al condonar:', err);
            error('Error al procesar la condonacion: ' + (err.message || 'Error desconocido'));
        }
    };

    return (
        <div className="flex flex-col gap-8 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-marine tracking-tight uppercase flex items-center gap-3">
                    <ShieldOff size={32} className="text-purple-500" />
                    Condonar Deuda
                </h1>
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
                    Perdon de deuda por resolucion administrativa
                </p>
            </div>

            {/* Info */}
            <div className="bg-purple-50 border-2 border-purple-200 p-6 rounded-2xl flex items-start gap-4">
                <AlertCircle size={24} className="text-purple-600 shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-black text-purple-800 text-sm uppercase tracking-wide">
                        Condonacion / Perdon de Deuda
                    </h3>
                    <ul className="text-purple-700 text-xs mt-2 space-y-1 font-bold">
                        <li>- Permite perdonar meses impagos de forma permanente</li>
                        <li>- Los meses condonados ya NO aparecen como deuda pendiente</li>
                        <li>- Queda registro de auditoria: responsable, fecha y motivo</li>
                        <li>- El historial muestra que los meses fueron condonados (no se borran)</li>
                        <li>- Accion irreversible, requiere autorizacion de la directiva</li>
                    </ul>
                </div>
            </div>

            {!selected ? (
                /* Busqueda de usuario */
                <div className="bg-white border border-slate-100 p-10 rounded-[3rem] space-y-8 shadow-2xl shadow-blue-900/5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-marine uppercase tracking-tight flex items-center gap-2">
                            <Search size={20} className="text-purple-500" />
                            Buscar Socio
                        </h2>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-marine transition-colors" size={20} />
                        <input
                            className="w-full bg-slate-50 border border-slate-100 p-5 pl-14 rounded-2xl font-black text-[13px] uppercase placeholder:text-slate-300 focus:outline-none focus:border-marine/30 transition-all"
                            placeholder="Buscar por nombre, CI o codigo..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {usuarios.length > 0 && (
                        <div className="space-y-2">
                            {usuarios.map(u => (
                                <button
                                    key={u.id}
                                    onClick={() => handleSelectUser(u)}
                                    className="w-full flex justify-between items-center p-5 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-purple-50 hover:border-purple-200 transition-all"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-marine rounded-xl text-white">
                                            <User size={20} />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-black text-slate-800 text-sm">{u.nombre}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">
                                                CI: {u.ci} - Cod: {u.codigo} - Tarifa: Bs {u.tarifa}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="bg-purple-100 text-purple-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">
                                        Seleccionar
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}

                    {search.length > 2 && usuarios.length === 0 && (
                        <p className="text-center py-8 text-slate-400 font-black text-[11px] uppercase tracking-widest">
                            No se encontraron usuarios
                        </p>
                    )}
                </div>
            ) : (
                /* Formulario de condonacion */
                <div className="bg-white border border-slate-100 p-10 rounded-[3.5rem] space-y-8 shadow-2xl shadow-blue-900/5 animate-in fade-in zoom-in duration-500">
                    {/* Cabecera usuario */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-purple-100 rounded-2xl">
                                <User size={28} className="text-purple-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-marine uppercase tracking-tighter">{selected.nombre}</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    CI: {selected.ci} - Cod: {selected.codigo} - Tarifa: Bs {selected.tarifa} - Inicio: {selected.inicio_cobro}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => { setSelected(null); setSearch(''); setConfirming(false); }}
                            className="p-3 hover:bg-slate-100 rounded-xl transition-all"
                        >
                            <XIcon size={24} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Meses ya condonados */}
                    {mesesCondonados.length > 0 && (
                        <div className="bg-purple-50 border border-purple-100 p-5 rounded-2xl">
                            <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <History size={14} /> Meses ya condonados anteriormente
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {mesesCondonados.map(m => (
                                    <span key={m} className="bg-purple-200 text-purple-800 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase">
                                        {m}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Seleccion de meses pendientes */}
                    {mesesPendientes.length > 0 ? (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    Seleccione los meses a condonar ({mesesPendientes.length} pendientes)
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={selectAll} className="text-[9px] font-black text-purple-600 uppercase tracking-widest hover:underline">
                                        Seleccionar todos
                                    </button>
                                    <span className="text-slate-300">|</span>
                                    <button onClick={deselectAll} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:underline">
                                        Deseleccionar
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {mesesPendientes.map(mes => {
                                    const isSelected = selectedMonths.has(mes);
                                    return (
                                        <button
                                            key={mes}
                                            onClick={() => toggleMonth(mes)}
                                            className={cn(
                                                "p-4 rounded-2xl border-2 transition-all font-black text-sm uppercase tracking-wide text-center",
                                                isSelected
                                                    ? "bg-purple-100 border-purple-400 text-purple-700 shadow-lg shadow-purple-200/50"
                                                    : "bg-white border-slate-200 text-slate-500 hover:border-purple-200 hover:bg-purple-50/50"
                                            )}
                                        >
                                            {isSelected && <Check size={14} className="inline mr-1" />}
                                            {mes}
                                            <span className="block text-[9px] text-slate-400 mt-1">Bs {selected.tarifa}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedMonths.size > 0 && (
                                <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl text-center">
                                    <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">
                                        {selectedMonths.size} mes(es) seleccionado(s) - Monto a condonar: Bs {(selectedMonths.size * (parseFloat(selected.tarifa) || 10)).toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-400">
                            <ShieldOff size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="font-black text-[11px] uppercase tracking-widest">
                                Este socio no tiene meses pendientes de pago
                            </p>
                        </div>
                    )}

                    {/* Formulario */}
                    {selectedMonths.size > 0 && !confirming && (
                        <div className="space-y-6 border-t border-slate-100 pt-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    Tipo de Condonacion *
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {TIPOS_CONDONACION.map(tipo => (
                                        <button
                                            key={tipo.value}
                                            type="button"
                                            onClick={() => setForm({ ...form, tipo_condonacion: tipo.value })}
                                            className={cn(
                                                "p-4 rounded-2xl border-2 transition-all font-black text-[11px] uppercase tracking-widest",
                                                form.tipo_condonacion === tipo.value
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
                                    Motivo / Resolucion *
                                </label>
                                <textarea
                                    rows="3"
                                    className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl font-bold text-sm focus:outline-none focus:border-marine/30"
                                    placeholder="Ej. Resolucion de directiva N-012/2025, por insolvencia economica comprobada..."
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
                                    placeholder="Informacion adicional..."
                                    value={form.observaciones}
                                    onChange={e => setForm({ ...form, observaciones: e.target.value })}
                                />
                            </div>

                            <button
                                onClick={() => setConfirming(true)}
                                className="w-full bg-purple-600 hover:bg-purple-700 p-5 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-xl transition-all"
                            >
                                Confirmar Condonacion
                            </button>
                        </div>
                    )}

                    {/* Confirmacion final */}
                    {confirming && (
                        <div className="bg-red-50 border-2 border-red-200 p-8 rounded-2xl space-y-6 animate-in fade-in duration-300">
                            <div className="flex items-start gap-4">
                                <AlertCircle size={32} className="text-red-600 shrink-0" />
                                <div>
                                    <h3 className="font-black text-red-800 text-lg uppercase tracking-wide">
                                        Confirmar Condonacion
                                    </h3>
                                    <p className="text-red-700 text-xs mt-2 font-bold">
                                        Esta accion es <strong>IRREVERSIBLE</strong>. Se condonaran {selectedMonths.size} mes(es)
                                        por un monto total de Bs {(selectedMonths.size * (parseFloat(selected.tarifa) || 10)).toFixed(2)} para {selected.nombre}.
                                    </p>
                                    <p className="text-red-600 text-[10px] mt-2 font-bold uppercase tracking-widest">
                                        Meses: {Array.from(selectedMonths).join(', ')}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={handleCondonar}
                                    className="flex-1 bg-red-600 hover:bg-red-700 p-5 rounded-2xl font-black text-sm uppercase tracking-widest text-white shadow-xl transition-all flex items-center justify-center gap-2"
                                >
                                    <Check size={18} />
                                    Si, Condonar Definitivamente
                                </button>
                                <button
                                    onClick={() => setConfirming(false)}
                                    className="px-8 bg-slate-100 hover:bg-slate-200 p-5 rounded-2xl font-black text-sm uppercase tracking-widest text-slate-500 transition-all"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <ToastContainer />
        </div>
    );
}
