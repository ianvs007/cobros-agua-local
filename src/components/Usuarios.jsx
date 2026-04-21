import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Search, UserPlus, Trash2, Edit2, AlertCircle, History, Download, X, User } from 'lucide-react';
import { generateReceiptPDF, generatePauseCertificatePDF } from '../utils/pdf';
import { formatPeriodo } from '../utils/formatters';
import { cn } from '../utils/cn';
import { useToast } from '../utils/toast';
import { getUsuarios, getPagos, getPausas, getCondonaciones, getConfiguracion, getPagosByUsuario, getPausasByUsuario, getCondonacionesByUsuario, getAnulacionesByUsuario } from '../services/data';
import { calcularMoraSocio } from '../utils/debt';
import { useApp } from '../contexts/AppContext';

export default function Usuarios() {
    const { initialAction, setInitialAction } = useApp();
    // ── BUG FIX: Usar Toast en lugar de alert() ──
    const { success, error, warning, info, ToastContainer } = useToast();
    const [list, setList] = useState([]);
    const [page, setPage] = useState(0);
    const [show, setShow] = useState(false);
    const [history, setHistory] = useState(null); // Socio seleccionado para historial
    const [pagosHistory, setPagosHistory] = useState([]); // Pagos agrupados
    const [pausasHistory, setPausasHistory] = useState([]);
    const [condonacionesHistory, setCondonacionesHistory] = useState([]);
    const [anulacionesHistory, setAnulacionesHistory] = useState([]);
    const [historyTab, setHistoryTab] = useState('pagos');
    const [search, setSearch] = useState('');
    const [filterDebtors, setFilterDebtors] = useState(false);
    const [form, setForm] = useState({
        nombre: '', ci: '', codigo: '', tanque: '', tarifa: 10,
        inicio_cobro: new Date().toISOString().slice(0, 7),
        fecha_ingreso: '',
        motivo_estado: ''
    });

    useEffect(() => {
        const initModal = async () => {
            if (initialAction === 'open_modal') {
                const nextCode = await getNextCode();
                setForm({
                    nombre: '', ci: '', codigo: nextCode, tanque: '', tarifa: 10,
                    inicio_cobro: new Date().toISOString().slice(0, 7),
                    fecha_ingreso: '',
                    motivo_estado: ''
                });
                setShow(true);
                setInitialAction(null);
            }
        };
        initModal();
    }, [initialAction]);

    const getNextCode = async () => {
        const all = await getUsuarios();
        if (!all || all.length === 0) return '0001';
        const validCodes = all
            .filter(u => /^\d{4}$/.test(u.codigo))
            .map(u => parseInt(u.codigo));

        const max = validCodes.length > 0 ? Math.max(...validCodes) : 0;
        return String(max + 1).padStart(4, '0');
    };

    useEffect(() => { load(); setPage(0); }, [search, filterDebtors, initialAction]);

    const load = async () => {
        try {
            let localUsers = await getUsuarios();
            let localPagos = await getPagos();
            let localPausas = await getPausas();
            let localCondonaciones = await getCondonaciones();

            if (search) {
                const s = search.toUpperCase();
                localUsers = localUsers.filter(u => 
                    (u.nombre || '').toUpperCase().includes(s) || 
                    (u.ci || '').includes(s) || 
                    (u.codigo || '').includes(s)
                );
            }

            // Procesar datos para la UI
            const processUsers = (users, payments, pausas = [], condonacionesList = []) => {
                return users.map(socio => {
                    const pagosSocio = payments.filter(p => String(p.usuario_id) === String(socio.id));
                    const pausasSocio = pausas.filter(p => String(p.usuario_id) === String(socio.id));
                    const condonacionesSocio = condonacionesList.filter(c => String(c.usuario_id) === String(socio.id));
                    const { deuda, hayPausaActiva } = calcularMoraSocio(socio.inicio_cobro, pagosSocio, socio.tarifa, pausasSocio, condonacionesSocio);
                    return { ...socio, deuda, hayPausaActiva };
                });
            };

            const enriched = processUsers(localUsers, localPagos, localPausas, localCondonaciones);
            let filteredList = enriched;
            if (filterDebtors) {
                filteredList = enriched.filter(x => x.deuda > 0);
            }
            setList(filteredList.sort((a, b) => String(b.id).localeCompare(String(a.id))));

            const cfg = await getConfiguracion();
            const lastRec = cfg.find(c => c.key === 'ultimo_recibo')?.value || '0';
            setNextCorrelativo(String(parseInt(lastRec) + 1).padStart(4, '0'));

        } catch (err) {
        }
    };

    const save = async (e) => {
        e.preventDefault();
        try {
            // Validaciones básicas
            if (!form.nombre.trim() || !form.ci.trim() || !form.tanque.trim()) {
                warning('Por favor completa los campos obligatorios: Nombre, CI y Tanque/ramal.');
                return;
            }

            // BUG FIX #3: Validar formato de CI (solo números, longitud razonable)
            const ciLimpio = form.ci.trim().replace(/[^0-9]/g, '');
            if (ciLimpio.length < 5 || ciLimpio.length > 12) {
                warning('El CI debe contener solo números y tener entre 5 y 12 dígitos.');
                return;
            }

            const codigoFormateado = String(form.codigo).padStart(4, '0');

            // Verificar unicidad
            const { data: existeCodigo, error: checkError } = await supabase.from('usuarios')
                .select('id, nombre')
                .eq('codigo', codigoFormateado)
                .maybeSingle();

            if (checkError) {
                console.error('[SUPABASE] Error al verificar código:', checkError);
                error('Error de conexión al verificar duplicados: ' + checkError.message);
                return;
            }

            if (existeCodigo && existeCodigo.id !== form.id) {
                warning(`El código ${codigoFormateado} ya pertenece a ${existeCodigo.nombre}.`);
                return;
            }

            const data = {
                nombre: form.nombre.trim().toUpperCase(),
                ci: ciLimpio,
                codigo: codigoFormateado,
                tanque: form.tanque.trim().toUpperCase(),
                tarifa: parseFloat(form.tarifa) || 10,
                inicio_cobro: form.inicio_cobro,
                fecha_ingreso: form.fecha_ingreso || null,
                estado: form.estado || 'ACTIVO',
                motivo_estado: (form.estado !== 'ACTIVO') ? (form.motivo_estado || '').trim().toUpperCase() : ''
            };

            let res;
            if (form.id) {
                res = await supabase.from('usuarios').update(data).eq('id', form.id).select();
            } else {
                // Eliminar el .select() al final para probar si el 400 persiste
                res = await supabase.from('usuarios').insert([data]);
            }

            if (res.error) {
                console.error('[SUPABASE] Error en insert/update:', res.error);
                // Si es un error de RLS o permisos, avisar claramente
                if (res.error.code === '42501') {
                    throw new Error('No tienes permisos para registrar socios en la nube. Contacta al administrador.');
                }
                throw new Error(`Error en base de datos: ${res.error.message} (${res.error.code})`);
            }

            success(form.id ? 'Usuario actualizado correctamente' : 'Usuario registrado correctamente');

            setShow(false);
            setForm({
                nombre: '', ci: '', codigo: '', tanque: '', tarifa: 10,
                inicio_cobro: new Date().toISOString().slice(0, 7),
                fecha_ingreso: '',
                motivo_estado: ''
            });
            load();
        } catch (err) {
            console.error('[SISTEMA] Error crítico en save:', err);
            error('Fallo crítico al guardar: ' + (err.message || 'Error desconocido'));
            // Alerta de respaldo por si el Toast falla
            if (!confirm('Error: ' + err.message + '\n\n¿Quieres intentar recargar el sistema?')) {
                // El usuario decidió no recargar
            }
        }
    };

    const handleEdit = (u) => {
        setForm(u);
        setShow(true);
    };

    const handleDelete = async (id) => {
        if (confirm("¿Estás seguro de eliminar este usuario? Esta acción no se puede deshacer.")) {
            const { error: deleteError } = await supabase.from('usuarios').delete().eq('id', id);
            if (deleteError) {
                error('Error al eliminar: ' + deleteError.message);
                return;
            }
            success('Usuario eliminado correctamente');
            load();
        }
    };

    const openHistory = async (socio) => {
        const socioId = Number(socio.id);
        setHistoryTab('pagos');

        const [pagos, pausas, condonaciones, anulaciones] = await Promise.all([
            getPagosByUsuario(socioId),
            getPausasByUsuario(socioId),
            getCondonacionesByUsuario(socioId),
            getAnulacionesByUsuario(socioId)
        ]);

        // Pagos agrupados por correlativo
        const groups = (pagos || []).reduce((acc, p) => {
            if (!acc[p.correlativo]) acc[p.correlativo] = [];
            acc[p.correlativo].push(p);
            return acc;
        }, {});
        const sorted = Object.values(groups).sort((a, b) => b[0].correlativo - a[0].correlativo);
        setPagosHistory(sorted);

        // Pausas ordenadas por fecha
        setPausasHistory((pausas || []).sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || '')));

        // Condonaciones ordenadas por fecha
        setCondonacionesHistory((condonaciones || []).sort((a, b) => (b.fecha_condonacion || '').localeCompare(a.fecha_condonacion || '')));

        // Anulaciones ordenadas por fecha
        setAnulacionesHistory((anulaciones || []).sort((a, b) => (b.fecha_anulacion || '').localeCompare(a.fecha_anulacion || '')));

        setHistory(socio);
    };

    const rePrint = async (grupo) => {
        await generateReceiptPDF(grupo, history);
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-black text-marine tracking-tight uppercase">Usuarios Registrados</h1>
                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em] mt-1">Padrón de beneficiarios</p>
                </div>
                <button
                    onClick={async () => {
                        const nextCode = await getNextCode();
                        setForm({
                            nombre: '', ci: '', codigo: nextCode, tanque: '', tarifa: 10,
                            inicio_cobro: new Date().toISOString().slice(0, 7),
                            motivo_estado: ''
                        });
                        setShow(true);
                    }}
                    className="bg-marine hover:bg-marine-light px-8 py-4 rounded-2xl flex items-center gap-2 font-black text-[10px] shadow-xl shadow-marine/20 transition-all active:scale-95 text-white uppercase tracking-widest"
                >
                    <UserPlus size={18} /> NUEVO USUARIO
                </button>
            </div>

            <div className="flex gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-marine transition-colors" size={18} />
                    <input className="w-full bg-white border border-slate-100 p-5 pl-14 rounded-2xl text-[13px] font-bold focus:outline-none focus:border-marine/50 focus:ring-4 focus:ring-marine/5 transition-all uppercase placeholder:text-slate-300 shadow-sm" placeholder="Buscar por nombre, CI o Código..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <button
                    onClick={() => setFilterDebtors(!filterDebtors)}
                    className={cn(
                        "px-8 rounded-2xl flex items-center gap-2 font-black text-[10px] tracking-widest transition-all active:scale-95 border uppercase",
                        filterDebtors
                            ? "bg-red-50 border-red-100 text-red-500 shadow-lg shadow-red-500/5"
                            : "bg-white border-slate-100 text-slate-400 hover:text-marine hover:border-marine/20 shadow-sm shadow-blue-900/5"
                    )}
                >
                    <AlertCircle size={18} /> {filterDebtors ? "MOSTRANDO DEUDORES" : "VER DEUDORES"}
                </button>
            </div>

            <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-blue-900/5">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                        <tr><th className="p-6">Usuario / Identificación</th><th className="p-6">CI</th><th className="p-6">Tanque/ramal</th><th className="p-6">Tarifa</th><th className="p-6">Inicio Cobro</th><th className="p-6">F. Ingreso</th><th className="p-6">Estado</th><th className="p-6 text-right">Acción</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-[13px] uppercase">
                        {list.slice(page * 50, (page + 1) * 50).map(u => (
                            <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="p-6">
                                    <div className="flex flex-col">
                                        <span className="text-slate-800 font-black tracking-tight">{u.nombre}</span>
                                        <span className="text-[10px] text-marine font-black opacity-60">ID: {u.codigo}</span>
                                    </div>
                                </td>
                                <td className="p-6 text-slate-400 font-bold">{u.ci}</td>
                                <td className="p-6 text-slate-700 max-w-[120px] truncate" title={u.tanque}>№ {u.tanque}</td>
                                <td className="p-6 text-emerald-600 font-black">Bs {u.tarifa || 10}</td>
                                <td className="p-6 text-slate-400 font-black text-[10px]">{u.inicio_cobro || '2026-01'}</td>
                                <td className="p-6 text-slate-400 font-black text-[10px]">{u.fecha_ingreso ? new Date(u.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-ES') : '—'}</td>
                                <td className="p-6">
                                    <div className="flex flex-col gap-1.5">
                                        <span className={cn("px-2.5 py-1 rounded-lg text-[9px] w-fit font-black tracking-widest border",
                                            u.deuda > 0 ? "bg-red-50 text-red-500 border-red-100" : 
                                            u.hayPausaActiva ? "bg-amber-50 text-amber-600 border-amber-100" :
                                            "bg-emerald-50 text-emerald-600 border-emerald-100")}>
                                            {u.deuda > 0 ? `DEBE ${u.deuda} MESES` : u.hayPausaActiva ? 'EN PAUSA' : 'AL DÍA'}
                                        </span>
                                        <span className={cn("px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter w-fit border",
                                            u.estado === 'ACTIVO' ? "bg-slate-100 text-slate-400 border-slate-200" : "bg-orange-50 text-orange-600 border-orange-100")}
                                            title={u.motivo_estado || ''}>
                                            {u.estado}
                                        </span>
                                        {u.estado !== 'ACTIVO' && u.motivo_estado && (
                                            <span className="text-[8px] font-bold text-orange-400 italic mt-0.5" title={u.motivo_estado}>
                                                {u.motivo_estado.length > 20 ? u.motivo_estado.substring(0,20)+'...' : u.motivo_estado}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-6 text-right flex justify-end gap-3">
                                    <button onClick={() => openHistory(u)} title="Ver Historial" aria-label="Ver historial" className="p-3 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white rounded-xl transition-all shadow-sm"><History size={18} /></button>
                                    <button onClick={() => handleEdit(u)} title="Editar" aria-label="Editar usuario" className="p-3 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all shadow-sm"><Edit2 size={18} /></button>
                                    <button onClick={() => handleDelete(u.id)} title="Eliminar" aria-label="Eliminar usuario" className="p-3 bg-red-50 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all shadow-sm"><Trash2 size={18} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Paginación */}
            {list.length > 50 && (
                <div className="flex items-center justify-between mt-4 px-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {page * 50 + 1}–{Math.min((page + 1) * 50, list.length)} de {list.length}
                    </span>
                    <div className="flex gap-2">
                        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-all">
                            ← Anterior
                        </button>
                        <button disabled={(page + 1) * 50 >= list.length} onClick={() => setPage(p => p + 1)}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-all">
                            Siguiente →
                        </button>
                    </div>
                </div>
            )}

            {show && (
                <div role="dialog" aria-modal="true" className="fixed inset-0 bg-marine/40 backdrop-blur-md flex items-center justify-center p-6 z-50 overflow-y-auto">
                    <form onSubmit={save} className="bg-white p-12 rounded-[3.5rem] w-full max-w-lg space-y-8 my-auto shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50" />
                        <div className="flex justify-between items-center relative z-10">
                            <div>
                                <h2 className="text-2xl font-black uppercase tracking-tighter text-marine">{form.id ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Completa los datos del beneficiario</p>
                            </div>
                            <button type="button" onClick={() => setShow(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={24} className="text-slate-400" /></button>
                        </div>
                        <div className="space-y-6 relative z-10">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest">Nombre del Usuario</label>
                                <input required className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl text-[13px] font-black uppercase placeholder:text-slate-300 focus:outline-none focus:border-marine/30 transition-all" placeholder="Ej. Juan Perez" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest">Documento de Identidad (CI)</label>
                                <input required className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl text-[13px] font-black placeholder:text-slate-300 focus:outline-none focus:border-marine/30 transition-all" placeholder="Sin extensión (Ej. 7845122)" value={form.ci} onChange={e => setForm({ ...form, ci: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-tighter">Código</label>
                                    <input readOnly className="w-full bg-blue-50 border border-blue-100 p-5 rounded-2xl text-[13px] font-black text-marine shadow-inner text-center" value={form.codigo} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-tighter">Tanque/ramal №</label>
                                    <input required type="text" maxLength={45} className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl text-[13px] font-black text-center focus:outline-none focus:border-marine/30" placeholder="Ej. 1A Sector Sur" value={form.tanque} onChange={e => setForm({ ...form, tanque: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-tighter text-emerald-600">Tarifa Bs</label>
                                    <input required type="number" min="1" step="0.5" className="w-full bg-emerald-50 border border-emerald-100 p-5 rounded-2xl text-[13px] font-black text-emerald-600 focus:outline-none text-center" value={form.tarifa} onChange={e => setForm({ ...form, tarifa: parseFloat(e.target.value) || 10 })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest">Inicio de Cobros</label>
                                    <input required type="month" className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl text-[13px] font-black text-marine focus:outline-none transition-all uppercase" value={form.inicio_cobro} onChange={e => setForm({ ...form, inicio_cobro: e.target.value })} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest">Fecha de Ingreso</label>
                                    <input type="date" className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl text-[13px] font-black text-marine focus:outline-none transition-all uppercase" value={form.fecha_ingreso || ''} onChange={e => setForm({ ...form, fecha_ingreso: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest text-orange-600">Estado del Usuario</label>
                                    <select className="w-full bg-orange-50 border border-orange-100 p-5 rounded-2xl text-[13px] font-black text-orange-600 focus:outline-none transition-all uppercase appearance-none" value={form.estado || 'ACTIVO'} onChange={e => setForm({ ...form, estado: e.target.value })}>
                                        <option value="ACTIVO">ACTIVO</option>
                                        <option value="INACTIVO">INACTIVO</option>
                                        <option value="BAJA">DAR DE BAJA</option>
                                    </select>
                                </div>
                            </div>
                            {form.estado && form.estado !== 'ACTIVO' && (
                                <div className="space-y-1 animate-in fade-in slide-in-from-top-2">
                                    <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest text-orange-600">Motivo del Cambio de Estado</label>
                                    <input required type="text" maxLength={100} className="w-full bg-orange-50/50 border border-orange-100 p-5 rounded-2xl text-[13px] font-bold text-orange-700 focus:outline-none transition-all placeholder:text-orange-300" placeholder="Ej. Retiro de medidor, falta de pago prolongado..." value={form.motivo_estado || ''} onChange={e => setForm({ ...form, motivo_estado: e.target.value })} />
                                </div>
                            )}
                        </div>
                        <button 
                            type="submit"
                            className="w-full bg-marine hover:bg-marine-light py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-white shadow-xl shadow-marine/20 transition-all active:scale-95 z-10 relative"
                        >
                            Guardar Cambios
                        </button>
                    </form>
                </div>
            )}

            {history && (
                <div role="dialog" aria-modal="true" className="fixed inset-0 bg-marine/40 backdrop-blur-md flex items-center justify-center p-6 z-50">
                    <div className="bg-white p-10 rounded-[3rem] w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-40 h-40 bg-amber-50 rounded-full blur-3xl -ml-20 -mt-20 opacity-50" />
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl shadow-sm"><History size={24} /></div>
                                <div>
                                    <h2 className="text-xl font-black uppercase tracking-tighter text-slate-800">{history.nombre}</h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Historial Completo de Movimientos</p>
                                </div>
                            </div>
                            <button onClick={() => setHistory(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-all"><X size={24} className="text-slate-400" /></button>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 mb-4 relative z-10 flex-wrap">
                            {[
                                { id: 'pagos', label: 'Pagos', count: pagosHistory.length, color: 'emerald' },
                                { id: 'pausas', label: 'Pausas', count: pausasHistory.length, color: 'amber' },
                                { id: 'condonaciones', label: 'Condonaciones', count: condonacionesHistory.length, color: 'purple' },
                                { id: 'anulaciones', label: 'Anulaciones', count: anulacionesHistory.length, color: 'red' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setHistoryTab(tab.id)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
                                        historyTab === tab.id
                                            ? `bg-${tab.color}-50 text-${tab.color}-600 border-${tab.color}-200`
                                            : "bg-white text-slate-400 border-slate-100 hover:border-slate-200"
                                    )}
                                >
                                    {tab.label} ({tab.count})
                                </button>
                            ))}
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-3 custom-scrollbar relative z-10">
                            {/* TAB: PAGOS */}
                            {historyTab === 'pagos' && (
                                pagosHistory.length === 0
                                    ? <div className="text-center py-16 opacity-20 font-black text-xs uppercase tracking-[0.3em]">No hay pagos registrados</div>
                                    : pagosHistory.map((grupo, idx) => (
                                        <div key={idx} className="bg-slate-50/50 border border-slate-100 p-5 rounded-[1.5rem] flex items-center justify-between hover:bg-white hover:shadow-xl transition-all group">
                                            <div className="flex items-center gap-5">
                                                <div className="bg-white px-4 py-3 rounded-2xl shadow-sm border border-slate-100 text-center min-w-[70px]">
                                                    <p className="text-[8px] text-slate-400 font-black uppercase mb-1">Recibo</p>
                                                    <p className="text-sm font-black text-amber-600">#{String(grupo[0].correlativo).padStart(6, '0')}</p>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                                                            {grupo.length > 1
                                                                ? `${formatPeriodo(grupo[0].periodo)} AL ${formatPeriodo(grupo[grupo.length - 1].periodo)}`
                                                                : formatPeriodo(grupo[0].periodo)}
                                                        </p>
                                                        {grupo[0].estado === 'ANULADO' && (
                                                            <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[8px] font-black uppercase">ANULADO</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[9px] text-slate-400 font-black uppercase mt-1">
                                                        {new Date(grupo[0].fecha).toLocaleDateString('es-ES')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="text-[8px] text-slate-400 font-black uppercase">Monto</p>
                                                    <p className={cn("text-sm font-black tracking-tighter", grupo[0].estado === 'ANULADO' ? "text-red-400 line-through" : "text-emerald-600")}>
                                                        Bs {grupo.reduce((a, b) => a + (parseFloat(b.monto) || 0), 0).toFixed(2)}
                                                    </p>
                                                </div>
                                                {grupo[0].estado !== 'ANULADO' && (
                                                    <button onClick={() => rePrint(grupo)} className="bg-white hover:bg-amber-600 p-3 rounded-xl shadow-sm transition-all text-slate-400 hover:text-white" title="Descargar PDF">
                                                        <Download size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                            )}

                            {/* TAB: PAUSAS */}
                            {historyTab === 'pausas' && (
                                pausasHistory.length === 0
                                    ? <div className="text-center py-16 opacity-20 font-black text-xs uppercase tracking-[0.3em]">No hay pausas registradas</div>
                                    : pausasHistory.map(p => {
                                        const dias = Math.ceil((new Date(p.fecha_fin + 'T23:59:59') - new Date(p.fecha_inicio + 'T00:00:00')) / (1000 * 60 * 60 * 24)) + 1;
                                        return (
                                            <div key={p.id} className="bg-amber-50/30 border border-amber-100 p-5 rounded-[1.5rem] space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <span className={cn("px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                                                            p.estado === 'ACTIVA' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                                                        )}>{p.estado}</span>
                                                        <span className="text-[10px] font-black text-slate-600 uppercase">{p.tipo_pausa}</span>
                                                    </div>
                                                    <button onClick={async () => await generatePauseCertificatePDF(p, history)} className="bg-white hover:bg-purple-100 p-2 rounded-lg transition-all text-purple-500" title="Descargar PDF">
                                                        <Download size={14} />
                                                    </button>
                                                </div>
                                                <p className="text-[11px] font-black text-slate-700">
                                                    {new Date(p.fecha_inicio).toLocaleDateString('es-ES')} al {new Date(p.fecha_fin).toLocaleDateString('es-ES')} ({dias} dias)
                                                </p>
                                                <p className="text-[10px] text-slate-500 font-bold italic">"{p.motivo}"</p>
                                                <p className="text-[9px] text-slate-400 font-bold">Autorizado por: {p.responsable_autoriza}</p>
                                            </div>
                                        );
                                    })
                            )}

                            {/* TAB: CONDONACIONES */}
                            {historyTab === 'condonaciones' && (
                                condonacionesHistory.length === 0
                                    ? <div className="text-center py-16 opacity-20 font-black text-xs uppercase tracking-[0.3em]">No hay condonaciones registradas</div>
                                    : condonacionesHistory.map(c => (
                                        <div key={c.id} className="bg-purple-50/30 border border-purple-100 p-5 rounded-[1.5rem] space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">{c.tipo_condonacion}</span>
                                                <span className="text-[9px] font-bold text-slate-400">{new Date(c.fecha_condonacion).toLocaleDateString('es-ES')}</span>
                                            </div>
                                            <p className="text-[11px] font-black text-purple-700">
                                                Periodo: {c.periodo} - Monto: Bs {parseFloat(c.monto_condonado).toFixed(2)}
                                            </p>
                                            <p className="text-[10px] text-slate-500 font-bold italic">"{c.motivo}"</p>
                                            <p className="text-[9px] text-slate-400 font-bold">Autorizado por: {c.responsable_condonacion}</p>
                                        </div>
                                    ))
                            )}

                            {/* TAB: ANULACIONES */}
                            {historyTab === 'anulaciones' && (
                                anulacionesHistory.length === 0
                                    ? <div className="text-center py-16 opacity-20 font-black text-xs uppercase tracking-[0.3em]">No hay anulaciones registradas</div>
                                    : anulacionesHistory.map(a => (
                                        <div key={a.id} className="bg-red-50/30 border border-red-100 p-5 rounded-[1.5rem] space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest">{a.tipo_anulacion || 'ANULACION'}</span>
                                                <span className="text-[9px] font-bold text-slate-400">{new Date(a.fecha_anulacion).toLocaleDateString('es-ES')}</span>
                                            </div>
                                            <p className="text-[11px] font-black text-red-700">
                                                Recibo #{String(a.correlativo).padStart(6, '0')} - Periodo: {a.periodo} - Bs {parseFloat(a.monto_anulado).toFixed(2)}
                                            </p>
                                            <p className="text-[10px] text-slate-500 font-bold italic">"{a.motivo}"</p>
                                            <p className="text-[9px] text-slate-400 font-bold">Responsable: {a.responsable_anulacion}</p>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                </div>
            )}
            
            {/* ── BUG FIX: Toast Notifications ── */}
            <ToastContainer />
        </div>
    );
}
