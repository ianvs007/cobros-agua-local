import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Calendar, Receipt, TrendingUp, Printer, FileText, BarChart3, Clock, Search, AlertCircle } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../utils/toast';
import { generateArqueoPDF } from '../utils/pdf';
import { getPagos, getUsuarios } from '../services/data';
import { useApp } from '../contexts/AppContext';

export default function Reportes() {
    const { operator } = useApp();
    const { error: notifyError, success: notifySuccess, ToastContainer } = useToast();
    const [pagos, setPagos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('diario'); // diario, mensual, anual
    const [dia, setDia] = useState(new Date().toISOString().split('T')[0]);
    const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
    const [anio, setAnio] = useState(new Date().getFullYear().toString());
    const [search, setSearch] = useState('');

    useEffect(() => { load(); }, [mode, dia, mes, anio]);

    const load = async () => {
        setLoading(true);
        try {
            // 1. Cargar datos necesarios desde Supabase
            const allLocalPagos = await getPagos();
            const allLocalSocios = await getUsuarios();
            
            // Mapeo rápido de nombres de socios para evitar búsquedas repetitivas
            const socioMap = allLocalSocios.reduce((acc, s) => ({ ...acc, [String(s.id)]: s.nombre }), {});

            let filtered = allLocalPagos.filter(p => p.estado === 'PAGADO');

            // Si es operador, filtrar solo sus movimientos
            if (operator?.rol === 'OPERADOR') {
                filtered = filtered.filter(p => (p.responsable || '').toUpperCase() === (operator?.usuario || '').toUpperCase());
            }

            if (mode === 'diario') {
                filtered = filtered.filter(p => p.fecha && p.fecha.startsWith(dia));
            } else if (mode === 'mensual') {
                filtered = filtered.filter(p => p.fecha && p.fecha.startsWith(mes));
            } else {
                filtered = filtered.filter(p => p.fecha && p.fecha.startsWith(anio));
            }

            const formatted = filtered.map(p => ({
                ...p,
                socio: socioMap[String(p.usuario_id)] || 'Desconocido'
            }));

            setPagos(formatted);
        } catch (err) {
            console.error('Error en reportes local:', err);
            notifyError('No se pudo cargar el arqueo desde la base de datos local.');
        } finally {
            setLoading(false);
        }
    };

    const groupData = () => {
        if (mode === 'diario') {
            const groups = {};
            pagos.forEach(p => {
                const key = p.correlativo;
                if (!groups[key]) {
                    groups[key] = { 
                        ...p, 
                        periodos: [p.periodo],
                        montoTotal: 0 
                    };
                } else {
                    groups[key].periodos.push(p.periodo);
                }
                groups[key].montoTotal += parseFloat(p.monto) || 0;
            });
            return Object.values(groups).map(g => ({
                ...g,
                periodoDisplay: g.periodos.length > 1 
                    ? `${g.periodos[0]} - ${g.periodos[g.periodos.length - 1]}`
                    : g.periodos[0]
            })).sort((a, b) => a.correlativo - b.correlativo);
        }

        const groups = {};
        pagos.forEach(p => {
            let key = '';
            let label = '';
            if (mode === 'mensual') {
                key = p.fecha.split('T')[0];
                label = new Date(p.fecha).toLocaleDateString();
            } else {
                key = p.fecha.slice(0, 7);
                const [y, m] = key.split('-');
                const date = new Date(parseInt(y), parseInt(m) - 1);
                label = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }).toUpperCase();
            }
            if (!groups[key]) groups[key] = { label, total: 0, count: 0, key };
            groups[key].total += parseFloat(p.monto) || 0;
            groups[key].count += 1;
        });

        return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
    };

    const dataToShow = groupData();
    const filteredData = mode === 'diario' 
        ? dataToShow.filter(p => p.socio.toLowerCase().includes(search.toLowerCase()) || String(p.correlativo).includes(search))
        : dataToShow;

    const totalReporte = filteredData.reduce((acc, curr) => acc + (mode === 'diario' ? curr.montoTotal : curr.total), 0);
    const cantMovimientos = mode === 'diario' ? filteredData.length : filteredData.reduce((acc, curr) => acc + curr.count, 0);

    const handlePrint = async () => {
        try {
            const filtroDesc = mode === 'diario' ? dia : mode === 'mensual' ? mes : anio;
            const resumen = { total: totalReporte, count: cantMovimientos };
            
            const docData = mode === 'diario' ? filteredData.map(p => ({
                correlativo: p.correlativo,
                socio_nombre: p.socio,
                periodo: p.periodoDisplay,
                monto: p.montoTotal
            })) : filteredData;

            await generateArqueoPDF(docData, resumen, filtroDesc, mode);
            notifySuccess('Reporte generado correctamente.');
        } catch (e) {
            notifyError('Error al generar el PDF.');
        }
    };

    return (
        <div className="flex flex-col gap-8 pb-10">
            {/* Header y Filtros */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-black text-marine tracking-tight uppercase flex items-center gap-2">
                        <BarChart3 className="text-emerald-500" /> Arqueo de Caja
                    </h1>
                    <div className="flex gap-2 mt-3">
                        {['diario', 'mensual', 'anual'].map(m => {
                            if (operator?.rol === 'OPERADOR' && m !== 'diario') return null;
                            return (
                                <button 
                                    key={m}
                                    onClick={() => setMode(m)} 
                                    className={cn(
                                        "text-[10px] font-black uppercase tracking-widest px-5 py-2 rounded-full transition-all border outline-none", 
                                        mode === m ? "bg-marine text-white border-marine shadow-lg shadow-marine/20" : "bg-white text-slate-400 border-slate-100 hover:border-marine/30"
                                    )}
                                >
                                    {m}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-2xl group min-w-[200px] justify-center">
                        <Clock className="text-marine" size={18} />
                        {mode === 'diario' && (
                            <input 
                                type="date" 
                                className={cn("bg-transparent border-none font-bold text-marine text-[13px] focus:outline-none", operator?.rol === 'OPERADOR' && "opacity-50")} 
                                value={dia} 
                                onChange={e => setDia(e.target.value)} 
                                disabled={operator?.rol === 'OPERADOR'}
                            />
                        )}
                        {mode === 'mensual' && (
                            <input type="month" className="bg-transparent border-none font-bold text-marine text-[13px] focus:outline-none" value={mes} onChange={e => setMes(e.target.value)} />
                        )}
                        {mode === 'anual' && (
                            <input type="number" className="bg-transparent border-none font-bold text-marine text-[13px] focus:outline-none w-20 text-center" value={anio} onChange={e => setAnio(e.target.value)} />
                        )}
                    </div>
                    
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/10 active:scale-95 disabled:opacity-50"
                        disabled={loading || filteredData.length === 0}
                    >
                        <Printer size={16} /> Imprimir Reporte
                    </button>
                </div>
            </div>

            {/* Resumen Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 relative overflow-hidden group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">TOTAL RECAUDADO EN PERIODO</p>
                    <h3 className="text-4xl font-black text-emerald-600 tracking-tighter">Bs {totalReporte.toFixed(2)}</h3>
                    <TrendingUp className="absolute right-8 top-8 text-emerald-100" size={48} />
                </div>
                <div className="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-xl shadow-blue-900/5 relative overflow-hidden group">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">MOVIMIENTOS / RECIBOS</p>
                    <h3 className="text-4xl font-black text-marine tracking-tighter">{cantMovimientos}</h3>
                    <Receipt className="absolute right-8 top-8 text-blue-100" size={48} />
                </div>
            </div>

            {/* Tabla */}
            <div className="flex flex-col gap-4">
                {mode === 'diario' && (
                    <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input
                            className="w-full bg-white border border-slate-100 p-4 pl-14 rounded-2xl text-[13px] font-bold focus:outline-none focus:border-marine/30 transition-all uppercase placeholder:text-slate-300 shadow-sm"
                            placeholder="Buscar por socio o Nº recibo..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                )}

                <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-blue-900/5">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                            {mode === 'diario' ? (
                                <tr>
                                    <th className="p-6">Recibo</th>
                                    <th className="p-6">Socio</th>
                                    <th className="p-6">Periodo</th>
                                    <th className="p-6 text-right">Monto</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="p-6">{mode === 'mensual' ? 'Día' : 'Mes'}</th>
                                    <th className="p-6">Cant. Recibos</th>
                                    <th className="p-6 text-right">Total Recaudado</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-[13px] font-bold uppercase transition-all">
                            {loading ? (
                                <tr><td colSpan={10} className="p-20 text-center animate-pulse text-slate-300 font-black tracking-widest text-xs">Cargando datos...</td></tr>
                            ) : filteredData.length > 0 ? filteredData.map((item, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                    {mode === 'diario' ? (
                                        <>
                                            <td className="p-6">
                                                <span className="bg-blue-50 text-marine px-3 py-1 rounded-lg border border-blue-100 text-[11px] font-black">
                                                    #{String(item.correlativo).padStart(5, '0')}
                                                </span>
                                            </td>
                                            <td className="p-6 text-slate-700">{item.socio}</td>
                                            <td className="p-6 text-slate-400 font-black text-[11px]">{item.periodoDisplay}</td>
                                            <td className="p-6 text-right text-emerald-600 font-black">Bs {item.montoTotal.toFixed(2)}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="p-6 text-slate-700">{item.label}</td>
                                            <td className="p-6">
                                                <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px]">
                                                    {item.count} recibos
                                                </span>
                                            </td>
                                            <td className="p-6 text-right text-emerald-600 font-black">Bs {item.total.toFixed(2)}</td>
                                        </>
                                    )}
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={10} className="p-20 text-center opacity-30">
                                        <AlertCircle className="mx-auto mb-4" size={40} />
                                        <p className="font-black text-xs tracking-widest">No hay movimientos registrados</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <ToastContainer />
        </div>
    );
}
