import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Search, CircleDollarSign, Download, User, AlertCircle, Receipt } from 'lucide-react';
import { generateReceiptPDF } from '../utils/pdf';
import { formatPeriodo, parseToYYYYMM } from '../utils/formatters';
import { cn } from '../utils/cn';
import { calcularMoraSocio, periodoEnPausa } from '../utils/debt';
import { useToast } from '../utils/toast';
import { searchUsuarios, getPagosByUsuario, getPagosByUsuarios, getPausasByUsuario, getPausasByUsuarios, getCondonacionesByUsuario, getCondonacionesByUsuarios, getUsuario } from '../services/data';
import { useApp } from '../contexts/AppContext';

export default function Cobros() { // ── BUG FIX: Usar Toast en lugar de alert() ──
    const { operator } = useApp();
    const { success, error: notifyError, warning, info, ToastContainer } = useToast();
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState([]);
    const [sel, setSel] = useState(null);
    const [periodo, setPeriodo] = useState(new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase());
    const [deuda, setDeuda] = useState(0);
    const [hayPausa, setHayPausa] = useState(false);
    const [loading, setLoading] = useState(false);

    const [mesesAPagar, setMesesAPagar] = useState(1);
    const [mesesPendientes, setMesesPendientes] = useState([]);
    const [mesesEnPausa, setMesesEnPausa] = useState([]);

    // Campos de Cobro Detallado
    const [form, setForm] = useState({
        cuota_ingreso: 0,
        conexion: 0,
        consumo_agua: 0,
        proteccion: 0,
        multa: 0,
        asambleas: 0,
        observaciones: ''
    });

    // Sanitizar valores numéricos para evitar NaN
    const n = (v) => {
        const parsed = parseFloat(v);
        return isNaN(parsed) ? 0 : parsed;
    };

    const totalBs = (n(form.consumo_agua) * mesesAPagar) +
        n(form.cuota_ingreso) +
        n(form.conexion) +
        n(form.proteccion) +
        n(form.multa) +
        n(form.asambleas);

    const calcularDeuda = async (socio) => {
        try {
            // 1. Obtener pagos válidos desde Supabase
            const socioId = Number(socio.id);
            const allPagos = await getPagosByUsuario(socioId);
            const pagosSocio = allPagos.filter(p => p.estado === 'PAGADO');

            // 2. Obtener pausas desde Supabase (ACTIVA y FINALIZADA excluyen meses permanentemente)
            const allPausas = await getPausasByUsuario(socioId);
            const pausasSocio = allPausas.filter(p => p.estado === 'ACTIVA' || p.estado === 'FINALIZADA');

            // 3. Obtener condonaciones desde Supabase
            const condonacionesSocio = await getCondonacionesByUsuario(socioId);

            const { deuda, mesesPendientes, pagoSugerido, hayPausaActiva, mesesEnPausa: pausados } = calcularMoraSocio(socio.inicio_cobro, pagosSocio, socio.tarifa, pausasSocio, condonacionesSocio);

            // Generar meses futuros para pago adelantado (hasta 12 meses desde el siguiente al actual)
            const ahora = new Date();
            let futY = ahora.getFullYear();
            let futM = ahora.getMonth() + 2; // mes siguiente al actual (getMonth es 0-based)
            if (futM > 12) { futM = 1; futY++; }

            const pagadosNorm = new Set(pagosSocio.map(p => parseToYYYYMM(p.periodo)));
            const pausasAdel = pausasSocio.filter(p => p.estado === 'ACTIVA' || p.estado === 'FINALIZADA');

            const mesesFuturos = [];
            for (let i = 0; i < 12; i++) {
                const yyyymm = `${futY}-${String(futM).padStart(2, '0')}`;
                if (!pagadosNorm.has(yyyymm) && !periodoEnPausa(formatPeriodo(yyyymm), pausasAdel)) {
                    mesesFuturos.push(formatPeriodo(yyyymm));
                }
                futM++;
                if (futM > 12) { futM = 1; futY++; }
            }

            setMesesPendientes([...mesesPendientes, ...mesesFuturos]);
            setMesesEnPausa(pausados);
            setDeuda(deuda);
            setHayPausa(hayPausaActiva);
            setPeriodo(pagoSugerido);

            setMesesAPagar(1);

            // Buscar última lectura
            const pagosOrdenados = allPagos
                .filter(p => p.fecha)
                .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            const ultimoPago = pagosOrdenados[0] || null;

            setForm(prev => ({
                ...prev,
                lectura_anterior: n(ultimoPago?.lectura_actual),
                consumo_agua: n(socio.tarifa) || 10
            }));
        } catch (error) {
            console.error("Error al calcular deuda:", error);
            setDeuda(0);
            setMesesPendientes([]);
        }
    };

    useEffect(() => {
        if (sel) calcularDeuda(sel);
    }, [sel]);

    // Recalcular deuda cuando el componente se monta (captura pausas creadas en otro módulo)
    useEffect(() => {
        if (sel) calcularDeuda(sel);
    }, []);

    useEffect(() => {
        const fetchWithDebt = async () => {
            if (search.length > 1) {
                try {
                    // CARGA DESDE SUPABASE (Cloud-First)
                    const term = search.toUpperCase();
                    const allUsers = await searchUsuarios(term);

                    if (!allUsers || allUsers.length === 0) {
                        setUsers([]);
                        return;
                    }

                    const userIds = allUsers.map(u => u.id);
                    
                    // Obtener datos relacionados de Supabase
                    const [allPagos, allPausas, allCondonaciones] = await Promise.all([
                        getPagosByUsuarios(userIds),
                        getPausasByUsuarios(userIds),
                        getCondonacionesByUsuarios(userIds)
                    ]);

                    const pagosByUser = allPagos.reduce((acc, p) => {
                        const uid = String(p.usuario_id);
                        if (!acc[uid]) acc[uid] = [];
                        acc[uid].push(p);
                        return acc;
                    }, {});

                    const pausasByUser = allPausas.reduce((acc, p) => {
                        const uid = String(p.usuario_id);
                        if (!acc[uid]) acc[uid] = [];
                        acc[uid].push(p);
                        return acc;
                    }, {});

                    const condonacionesByUser = allCondonaciones.reduce((acc, c) => {
                        const uid = String(c.usuario_id);
                        if (!acc[uid]) acc[uid] = [];
                        acc[uid].push(c);
                        return acc;
                    }, {});

                    const enriched = allUsers.map(u => {
                        const uid = String(u.id);
                        const pagosSocio = (pagosByUser[uid] || []).filter(p => p.estado === 'PAGADO');
                        const pausasSocio = pausasByUser[uid] || [];
                        const condonacionesSocio = condonacionesByUser[uid] || [];
                        const { deuda, hayPausaActiva } = calcularMoraSocio(u.inicio_cobro, pagosSocio, u.tarifa, pausasSocio, condonacionesSocio);
                        return { ...u, deuda, hayPausaActiva };
                    });

                    setUsers(enriched);
                } catch (e) {
                    console.error("Error en búsqueda local:", e);
                }
            } else setUsers([]);
        };
        fetchWithDebt();
    }, [search]);


    const handleCobro = async (e) => {
        try {
            e.preventDefault();
            if (loading) return;
            setLoading(true);

            // Validar meses a pagar
            if (mesesAPagar <= 0) {
                warning('Selecciona al menos 1 mes.');
                return;
            }

            const sanitizedForm = {
                cuota_ingreso: n(form.cuota_ingreso),
                conexion: n(form.conexion),
                consumo_agua: n(form.consumo_agua),
                proteccion: n(form.proteccion),
                multa: n(form.multa),
                asambleas: n(form.asambleas),
                observaciones: form.observaciones
            };

            // ── VALIDACIÓN: Clampear meses a pagar al total de pendientes disponibles ──
            const mesesReales = Math.min(mesesAPagar, mesesPendientes.length);
            if (mesesReales <= 0) {
                warning('No hay meses pendientes por cobrar.');
                return;
            }

            const periodosAEvaluar = mesesPendientes.slice(0, mesesReales);
            
            // Verificar duplicados desde Supabase (consistente con calcularDeuda)
            const socioId = Number(sel.id);
            const pagosLocal = await getPagosByUsuario(socioId);
            const pagosExistentes = pagosLocal.filter(p =>
                periodosAEvaluar.includes(p.periodo) && p.estado === 'PAGADO'
            );

            if (pagosExistentes && pagosExistentes.length > 0) {
                const periodosDuplicados = pagosExistentes.map(p => p.periodo);
                warning(`Los siguientes meses ya fueron pagados: ${periodosDuplicados.join(', ')}`);
                return;
            }

            // ── VALIDACIÓN: Re-verificar estado del socio al momento del cobro ──
            const socioActualizado = await getUsuario(sel.id);
            if (socioActualizado && socioActualizado.estado !== 'ACTIVO') {
                warning(`Cobro bloqueado: el usuario está en estado ${socioActualizado.estado}. Finalice la pausa primero.`);
                return;
            }

            // ── VALIDACIÓN: Verificar que ningún periodo esté suspendido por pausa ──
            const pausasVigentes = await getPausasByUsuario(socioId);
            const pausasValidas = pausasVigentes.filter(p => p.estado === 'ACTIVA' || p.estado === 'FINALIZADA');
            const periodosBloqueados = periodosAEvaluar.filter(per => periodoEnPausa(per, pausasValidas));
            if (periodosBloqueados.length > 0) {
                warning(`Los siguientes meses están suspendidos por pausa y NO se pueden cobrar: ${periodosBloqueados.join(', ')}`);
                return;
            }

            // Obtener correlativo con lock optimista (retry si hay conflicto)
            let proximoCorr;
            for (let attempt = 0; attempt < 3; attempt++) {
                const { data: maxPago } = await supabase.from('pagos')
                    .select('correlativo')
                    .order('correlativo', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const { data: configData } = await supabase.from('configuracion')
                    .select('value')
                    .eq('key', 'ultimo_recibo')
                    .maybeSingle();

                const configCorrelativo = parseInt(configData?.value || 0, 10);
                const dbCorrelativo = maxPago?.correlativo || 0;
                const candidato = Math.max(configCorrelativo, dbCorrelativo) + 1;

                // Reservar con condición: solo actualiza si el valor no cambió
                const { error: lockErr } = await supabase.from('configuracion')
                    .update({ value: candidato.toString() })
                    .eq('key', 'ultimo_recibo')
                    .eq('value', Math.max(configCorrelativo, dbCorrelativo).toString());

                if (!lockErr) {
                    proximoCorr = candidato;
                    break;
                }
                // Si falló, otro operador reservó primero — reintentar
                if (attempt === 2) throw new Error('No se pudo reservar el número de recibo. Intente de nuevo.');
            }

            const pagosAGuardar = [];

            // Crear un pago individual por cada mes seleccionado
            for (let i = 0; i < mesesReales; i++) {
                const mesPeriodo = periodosAEvaluar[i];

                const montoIndividual = i === 0
                    ? sanitizedForm.consumo_agua + sanitizedForm.cuota_ingreso + sanitizedForm.conexion + sanitizedForm.proteccion + sanitizedForm.multa + sanitizedForm.asambleas
                    : sanitizedForm.consumo_agua;

                const individual = {
                    usuario_id: sel.id,
                    monto: montoIndividual,
                    periodo: mesPeriodo,
                    tipo: 'MENSUAL',
                    responsable: operator?.usuario.toUpperCase() || 'S/D',
                    fecha: new Date().toISOString(),
                    correlativo: proximoCorr,
                    observaciones: sanitizedForm.observaciones,
                    cuota_ingreso: i === 0 ? sanitizedForm.cuota_ingreso : 0,
                    conexion: i === 0 ? sanitizedForm.conexion : 0,
                    proteccion: i === 0 ? sanitizedForm.proteccion : 0,
                    multa: i === 0 ? sanitizedForm.multa : 0,
                    asambleas: i === 0 ? sanitizedForm.asambleas : 0,
                    consumo_agua: sanitizedForm.consumo_agua,
                    estado: 'PAGADO'
                };
                pagosAGuardar.push(individual);
            }

            // Correlativo ya reservado por el lock optimista arriba
            // Guardar todos en lote y obtener los datos con sus IDs
            const { data: savedPagos, error: insertError } = await supabase.from('pagos').insert(pagosAGuardar).select();
            
            if (insertError) {
                // Revertir el correlativo reservado si falla la inserción de pagos
                try {
                    await supabase.from('configuracion')
                        .update({ value: (proximoCorr - 1).toString() })
                        .eq('key', 'ultimo_recibo')
                        .eq('value', proximoCorr.toString());
                } catch { /* best-effort rollback */ }
                throw insertError;
            }

            await generateReceiptPDF(savedPagos || pagosAGuardar, sel);

            success('Cobro registrado exitosamente');
            setSel(null); setSearch('');
            setForm({ cuota_ingreso: 0, conexion: 0, consumo_agua: 0, proteccion: 0, multa: 0, asambleas: 0, observaciones: '' });
        } catch (err) {
            console.error("Error al registrar cobro:", err);
            notifyError("Error al procesar el cobro: " + (err.message || 'Error desconocido'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-marine tracking-tight uppercase">Módulo de Cobros</h1>
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">Gestión de pagos y emisión de recibos</p>
            </div>
            {!sel ? (
                <div className="bg-white border border-slate-100 p-10 rounded-[3rem] space-y-8 shadow-2xl shadow-blue-900/5">
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-marine transition-colors" size={20} />
                        <input className="w-full bg-slate-50 border border-slate-100 p-5 pl-14 rounded-2xl font-black text-[13px] uppercase placeholder:text-slate-300 focus:outline-none focus:border-marine/30 transition-all" placeholder="Buscar usuario por nombre, CI o Código..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {users.map(u => {
                            const noActivo = u.estado && u.estado !== 'ACTIVO';
                            return (
                            <button
                                key={u.id}
                                onClick={() => { if (!noActivo) setSel(u); else warning(`No se puede cobrar: usuario ${u.estado}${u.motivo_estado ? ' - ' + u.motivo_estado : ''}`); }}
                                className={cn(
                                    "flex justify-between items-center p-6 rounded-[1.8rem] border transition-all text-xs font-black uppercase group shadow-sm",
                                    noActivo
                                        ? "bg-slate-100 border-slate-200 cursor-not-allowed opacity-60"
                                        : "bg-slate-50 hover:bg-marine border-slate-100 hover:border-marine hover:shadow-xl hover:shadow-marine/20"
                                )}
                            >
                                <div className="flex flex-col text-left">
                                    <span className={cn("transition-colors text-[14px] tracking-tight", noActivo ? "text-slate-500" : "text-slate-800 group-hover:text-white")}>{u.nombre}</span>
                                    <span className="text-[10px] text-slate-400 group-hover:text-white/60 mt-1 max-w-[200px] truncate" title={u.tanque}>Tanque/ramal: {u.tanque} • CI: {u.ci} • Cod: {u.codigo}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {noActivo ? (
                                        <span className="bg-orange-50 text-orange-600 px-4 py-1.5 rounded-full text-[9px] border border-orange-100 font-black uppercase tracking-widest">{u.estado}</span>
                                    ) : u.deuda > 0 ? (
                                        <span className="bg-red-50 text-red-500 px-4 py-1.5 rounded-full text-[9px] border border-red-100 font-black group-hover:bg-white/10 group-hover:text-white group-hover:border-white/20 uppercase tracking-widest">DEBE {u.deuda} MESES</span>
                                    ) : u.hayPausaActiva ? (
                                        <span className="bg-amber-50 text-amber-600 px-4 py-1.5 rounded-full text-[9px] border border-amber-100 font-black group-hover:bg-white/10 group-hover:text-white group-hover:border-white/20 uppercase tracking-widest">EN PAUSA</span>
                                    ) : (
                                        <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-[9px] border border-emerald-100 font-black group-hover:bg-white/10 group-hover:text-white group-hover:border-white/20 uppercase tracking-widest">AL DÍA</span>
                                    )}
                                </div>
                            </button>
                            );
                        })}
                    </div>
                    {search.length > 0 && users.length === 0 && (
                        <div role="alert" className="text-center py-10 opacity-30 font-black text-[11px] uppercase tracking-[0.3em]">No se encontraron usuarios</div>
                    )}
                </div>
            ) : (
                <form onSubmit={handleCobro} className="bg-white border border-slate-100 p-10 rounded-[3.5rem] space-y-10 animate-in fade-in zoom-in duration-500 shadow-2xl shadow-blue-900/10">
                    {/* Alerta de pausa activa */}
                    {hayPausa && mesesPendientes.length === 0 && (
                        <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-2xl flex items-start gap-4">
                            <AlertCircle size={24} className="text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="font-black text-amber-800 text-sm uppercase tracking-wide">Socio con Pausa Activa</h3>
                                <p className="text-amber-700 text-xs mt-1 font-bold">Este socio tiene una pausa de cobros activa. No se generan periodos pendientes durante la pausa. Para cobrar, primero finalice la pausa desde el módulo de Pausas.</p>
                            </div>
                        </div>
                    )}
                    {mesesEnPausa.length > 0 && (
                        <div className="bg-purple-50 border-2 border-purple-200 p-5 rounded-2xl flex items-start gap-4">
                            <AlertCircle size={20} className="text-purple-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-black text-purple-700 text-[10px] uppercase tracking-widest">Meses Suspendidos por Pausa (no cobrables)</p>
                                <p className="text-purple-600 text-xs mt-1 font-bold">{mesesEnPausa.join(', ')}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col md:flex-row justify-between items-center bg-blue-50/50 p-8 rounded-[2.5rem] border border-blue-100 shadow-inner gap-6">
                        <div className="flex items-center gap-5">
                            <div className="p-5 bg-marine rounded-[1.8rem] text-white shadow-xl shadow-marine/30"><User size={32} /></div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter leading-none">{sel.nombre}</h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 flex flex-col md:flex-row md:items-center gap-2">
                                    <span className="bg-white px-2 py-0.5 rounded-md border border-slate-100 text-marine w-fit">COD: {sel.codigo}</span>
                                    <span className="truncate max-w-[150px]" title={sel.tanque}>TANQUE/RAMAL: {sel.tanque}</span>
                                    <span>TARIFA: BS {sel.tarifa}</span>
                                </p>
                            </div>
                        </div>
                        <div className="text-center md:text-right flex flex-col md:items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resumen de Deuda</span>
                            <div className={cn("px-5 py-1.5 rounded-full text-[10px] font-black border uppercase tracking-widest shadow-sm",
                                deuda > 0 ? "bg-red-50 text-red-500 border-red-200" : 
                                hayPausa ? "bg-amber-50 text-amber-600 border-amber-200" :
                                "bg-emerald-50 text-emerald-600 border-emerald-200")}>
                                {deuda > 0 ? `${deuda} meses pendientes` : 
                                 hayPausa ? 'Socio en Pausa' : 'Usuario al día'}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                        <div className="lg:col-span-2 space-y-6">
                            <h3 className="text-[11px] font-black text-marine uppercase tracking-[0.3em] flex items-center gap-2 mb-6"><Receipt size={18} className="text-sky-500" /> Detalle de Conceptos</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black opacity-40 uppercase ml-1 tracking-widest">Aporte Voluntario</label>
                                    <input type="number" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-[13px] focus:outline-none focus:border-marine/30 transition-all" value={form.cuota_ingreso} onChange={e => setForm({ ...form, cuota_ingreso: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black opacity-40 uppercase ml-1 tracking-widest">Conexión e Instalación</label>
                                    <input type="number" className="w-full bg-slate-50 border border-slate-100 p-4 rounded-2xl font-black text-[13px] focus:outline-none focus:border-marine/30 transition-all" value={form.conexion} onChange={e => setForm({ ...form, conexion: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black opacity-40 uppercase ml-1 tracking-widest text-emerald-600">Consumo Agua Potable</label>
                                    <input type="number" className="w-full bg-emerald-50 border border-emerald-100 p-4 rounded-2xl font-black text-[14px] text-emerald-600 focus:outline-none" value={form.consumo_agua} onChange={e => setForm({ ...form, consumo_agua: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black opacity-40 uppercase ml-1 tracking-widest text-sky-600">Protección Vertientes</label>
                                    <input type="number" className="w-full bg-sky-50 border border-sky-100 p-4 rounded-2xl font-black text-[13px] text-sky-600 focus:outline-none" value={form.proteccion} onChange={e => setForm({ ...form, proteccion: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black opacity-40 uppercase ml-1 tracking-widest text-red-500">Multa por Mora</label>
                                    <input type="number" className="w-full bg-red-50 border border-red-100 p-4 rounded-2xl font-black text-[13px] text-red-500 focus:outline-none" value={form.multa} onChange={e => setForm({ ...form, multa: e.target.value })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black opacity-40 uppercase ml-1 tracking-widest text-amber-600">Faltas y Trabajos</label>
                                    <input type="number" className="w-full bg-amber-50 border border-amber-100 p-4 rounded-2xl font-black text-[13px] text-amber-600 focus:outline-none" value={form.asambleas} onChange={e => setForm({ ...form, asambleas: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-1.5 pt-4">
                                <label className="text-[10px] font-black opacity-40 uppercase ml-1 tracking-widest">Observaciones de Cobro</label>
                                <textarea rows="2" className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl font-bold text-[13px] uppercase focus:outline-none focus:border-marine/30 transition-all" value={form.observaciones} onChange={e => setForm({ ...form, observaciones: e.target.value })} placeholder="Ej. Pago adelantado de meses..."></textarea>
                            </div>
                        </div>

                        <div className="space-y-8">
                            <div className="bg-slate-50 border border-slate-100 p-8 rounded-[2.5rem] space-y-6 shadow-sm">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 italic">
                                    <CircleDollarSign size={16} className="text-marine" /> Control de Periodos
                                </h3>

                                <div className="space-y-2">
                                    <label className="text-[9px] font-black opacity-40 uppercase ml-1 tracking-widest">Meses a Cancelar</label>
                                    <div className="flex gap-3">
                                        <input
                                            type="number"
                                            min="1"
                                            max={mesesPendientes.length || 1}
                                            className="flex-1 bg-white border border-slate-100 p-4 rounded-2xl font-black text-sm text-marine shadow-sm focus:outline-none focus:ring-4 focus:ring-marine/5 text-center"
                                            value={mesesAPagar}
                                            onChange={e => setMesesAPagar(parseInt(e.target.value) || 1)}
                                        />
                                        <div className="bg-marine/5 px-4 py-3 rounded-2xl flex items-center justify-center font-black text-[9px] text-marine border border-marine/10 uppercase tracking-tighter w-24">
                                            {deuda > 0 ? `${deuda} Pend.` : `${mesesPendientes.length} Disp.`}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[9px] font-black opacity-40 uppercase ml-1 tracking-widest">Mes(es) Seleccionados</label>
                                    <div className="w-full bg-white border border-slate-100 p-4 rounded-2xl font-black uppercase text-[10px] text-marine leading-relaxed shadow-sm">
                                        {mesesAPagar > 1
                                            ? `${mesesAPagar} MESES: ${mesesPendientes[0]} AL ${mesesPendientes[mesesAPagar - 1] || 'S/F'}`
                                            : mesesPendientes[0] || periodo}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-marine p-8 rounded-[2.5rem] shadow-2xl shadow-marine/40 text-center space-y-2 group overflow-hidden relative">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-white/20 transition-all" />
                                <p className="text-[11px] font-black text-white/50 uppercase tracking-widest leading-none relative z-10">Total a Cobrar</p>
                                <h2 className="text-4xl font-black text-white tracking-tighter relative z-10">Bs {totalBs.toFixed(2)}</h2>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    type="submit"
                                    disabled={loading || (hayPausa && mesesPendientes.length === 0)}
                                    className="w-full bg-marine hover:bg-marine-light disabled:bg-slate-300 disabled:cursor-not-allowed p-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] text-white shadow-xl shadow-marine/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                                >
                                    {loading ? 'Procesando...' : (hayPausa && mesesPendientes.length === 0) ? 'Cobro Bloqueado - Socio en Pausa' : <><Download size={18} /> Procesar Cobro</>}
                                </button>
                                <button type="button" onClick={() => setSel(null)} className="w-full bg-slate-50 hover:bg-slate-100 p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 transition-all border border-slate-100">
                                    Volver atrás
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            )}
            
            {/* ── BUG FIX: Toast Notifications ── */}
            <ToastContainer />
        </div>
    );
}
