import React, { useState, useEffect } from 'react';
import { ShieldOff, Download, Calendar, FileText } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../utils/toast';
import { getCondonaciones, getUsuarios } from '../services/data';

export default function ReporteCondonaciones() {
    const { success, error: notifyError, ToastContainer } = useToast();
    const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7));
    const [resumen, setResumen] = useState([]);
    const [detalle, setDetalle] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => { cargarDatos(); }, [filtroMes]);

    const cargarDatos = async () => {
        if (!filtroMes) return;
        setLoading(true);
        try {
            const allCondonaciones = await getCondonaciones();
            const allUsuarios = await getUsuarios();
            const userMap = allUsuarios.reduce((acc, u) => ({ ...acc, [String(u.id)]: u }), {});

            // Resumen mensual
            const resumenMap = {};
            allCondonaciones.forEach(c => {
                if (!c.fecha_condonacion) return;
                const mesKey = c.fecha_condonacion.slice(0, 7);
                if (!resumenMap[mesKey]) {
                    resumenMap[mesKey] = {
                        mes: mesKey,
                        total: 0,
                        monto_total: 0,
                        insolvencia: 0,
                        fallecimiento: 0,
                        acuerdo_directiva: 0,
                        otro: 0
                    };
                }
                const r = resumenMap[mesKey];
                r.total++;
                r.monto_total += parseFloat(c.monto_condonado || 0);
                const tipo = (c.tipo_condonacion || 'OTRO').toUpperCase();
                if (tipo === 'INSOLVENCIA') r.insolvencia++;
                else if (tipo === 'FALLECIMIENTO') r.fallecimiento++;
                else if (tipo === 'ACUERDO_DIRECTIVA') r.acuerdo_directiva++;
                else r.otro++;
            });
            setResumen(Object.values(resumenMap).sort((a, b) => b.mes.localeCompare(a.mes)));

            // Detalle del mes filtrado
            const primerDia = `${filtroMes}-01`;
            const fechaD = new Date(primerDia);
            fechaD.setMonth(fechaD.getMonth() + 1);
            const ultimoDia = fechaD.toISOString().split('T')[0];

            const condonacionesMes = allCondonaciones.filter(c =>
                c.fecha_condonacion && c.fecha_condonacion >= primerDia && c.fecha_condonacion < ultimoDia
            );

            const detalleArr = condonacionesMes.map(c => {
                const socio = userMap[String(c.usuario_id)] || {};
                return {
                    ...c,
                    nombre_socio: socio.nombre || 'Desconocido',
                    codigo_socio: socio.codigo || '',
                    ci_socio: socio.ci || '',
                    fecha_formateada: new Date(c.fecha_condonacion).toLocaleDateString('es-ES')
                };
            }).sort((a, b) => (b.fecha_condonacion || '').localeCompare(a.fecha_condonacion || ''));

            setDetalle(detalleArr);
        } catch (err) {
            console.error('Error al cargar reporte:', err);
            notifyError('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const exportarCSV = () => {
        try {
            const headers = ['Fecha', 'Codigo', 'Socio', 'CI', 'Periodo Condonado', 'Monto', 'Tipo', 'Motivo', 'Responsable', 'Observaciones'];
            const rows = detalle.map(d => [
                d.fecha_formateada,
                d.codigo_socio,
                d.nombre_socio,
                d.ci_socio,
                d.periodo,
                parseFloat(d.monto_condonado).toFixed(2),
                d.tipo_condonacion,
                d.motivo,
                d.responsable_condonacion,
                d.observaciones || ''
            ]);

            const csvContent = [
                ['REPORTE DE CONDONACIONES - COBROS AGUA'],
                [`Mes: ${filtroMes}`],
                [],
                headers,
                ...rows
            ].map(row => row.join(',')).join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `condonaciones_${filtroMes}.csv`;
            link.click();
            success('Reporte exportado correctamente');
        } catch (err) {
            notifyError('Error al exportar: ' + err.message);
        }
    };

    const resumenMesActual = resumen.find(r => r.mes === filtroMes) || { total: 0, monto_total: 0, insolvencia: 0, fallecimiento: 0, acuerdo_directiva: 0, otro: 0 };

    return (
        <div className="flex flex-col gap-8 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-marine tracking-tight uppercase flex items-center gap-3">
                    <ShieldOff size={32} className="text-purple-500" />
                    Reporte de Condonaciones
                </h1>
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
                    Auditoria de deudas condonadas por resolucion administrativa
                </p>
            </div>

            {/* Filtro */}
            <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl flex flex-wrap items-center gap-4">
                <Calendar size={20} className="text-purple-500" />
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filtrar por mes:</label>
                <input
                    type="month"
                    className="bg-slate-50 border border-slate-100 p-3 rounded-xl font-black text-sm focus:outline-none focus:border-marine/30"
                    value={filtroMes}
                    onChange={e => setFiltroMes(e.target.value)}
                />
                <button
                    onClick={exportarCSV}
                    disabled={detalle.length === 0}
                    className="ml-auto flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                >
                    <Download size={14} /> Exportar CSV
                </button>
            </div>

            {/* Tarjetas resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Condonaciones</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{resumenMesActual.total}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto Condonado</p>
                    <p className="text-3xl font-black text-purple-600 mt-1">Bs {resumenMesActual.monto_total.toFixed(2)}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Por Insolvencia</p>
                    <p className="text-3xl font-black text-red-500 mt-1">{resumenMesActual.insolvencia}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Por Acuerdo</p>
                    <p className="text-3xl font-black text-blue-500 mt-1">{resumenMesActual.acuerdo_directiva}</p>
                </div>
            </div>

            {/* Resumen historico */}
            {resumen.length > 0 && (
                <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-900/5">
                    <h2 className="text-lg font-black text-marine uppercase tracking-tight mb-4 flex items-center gap-2">
                        <FileText size={18} className="text-purple-500" /> Resumen Historico
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px] font-bold">
                            <thead>
                                <tr className="border-b-2 border-slate-100">
                                    <th className="text-left p-3 text-slate-400 uppercase tracking-widest">Mes</th>
                                    <th className="text-center p-3 text-slate-400 uppercase tracking-widest">Total</th>
                                    <th className="text-center p-3 text-slate-400 uppercase tracking-widest">Insolvencia</th>
                                    <th className="text-center p-3 text-slate-400 uppercase tracking-widest">Fallecimiento</th>
                                    <th className="text-center p-3 text-slate-400 uppercase tracking-widest">Acuerdo</th>
                                    <th className="text-center p-3 text-slate-400 uppercase tracking-widest">Otro</th>
                                    <th className="text-right p-3 text-slate-400 uppercase tracking-widest">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {resumen.map(r => (
                                    <tr key={r.mes} className={cn("border-b border-slate-50 hover:bg-purple-50/30 transition-colors", r.mes === filtroMes && "bg-purple-50")}>
                                        <td className="p-3 font-black text-slate-700">{r.mes}</td>
                                        <td className="p-3 text-center text-slate-600">{r.total}</td>
                                        <td className="p-3 text-center text-red-500">{r.insolvencia}</td>
                                        <td className="p-3 text-center text-slate-500">{r.fallecimiento}</td>
                                        <td className="p-3 text-center text-blue-500">{r.acuerdo_directiva}</td>
                                        <td className="p-3 text-center text-amber-500">{r.otro}</td>
                                        <td className="p-3 text-right font-black text-purple-600">Bs {r.monto_total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detalle del mes */}
            <div className="bg-white border border-slate-100 p-8 rounded-[2.5rem] shadow-2xl shadow-blue-900/5">
                <h2 className="text-lg font-black text-marine uppercase tracking-tight mb-4">
                    Detalle - {filtroMes}
                </h2>

                {loading ? (
                    <p className="text-center py-8 text-slate-400 font-black text-[11px] uppercase tracking-widest animate-pulse">Cargando...</p>
                ) : detalle.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-[11px] font-bold">
                            <thead>
                                <tr className="border-b-2 border-slate-100">
                                    <th className="text-left p-3 text-slate-400 uppercase tracking-widest">Fecha</th>
                                    <th className="text-left p-3 text-slate-400 uppercase tracking-widest">Socio</th>
                                    <th className="text-left p-3 text-slate-400 uppercase tracking-widest">Periodo</th>
                                    <th className="text-right p-3 text-slate-400 uppercase tracking-widest">Monto</th>
                                    <th className="text-left p-3 text-slate-400 uppercase tracking-widest">Tipo</th>
                                    <th className="text-left p-3 text-slate-400 uppercase tracking-widest">Motivo</th>
                                    <th className="text-left p-3 text-slate-400 uppercase tracking-widest">Responsable</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detalle.map(d => (
                                    <tr key={d.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                        <td className="p-3 text-slate-600">{d.fecha_formateada}</td>
                                        <td className="p-3">
                                            <span className="font-black text-slate-700">{d.nombre_socio}</span>
                                            <span className="text-[9px] text-slate-400 ml-2">({d.codigo_socio})</span>
                                        </td>
                                        <td className="p-3 font-black text-marine">{d.periodo}</td>
                                        <td className="p-3 text-right font-black text-purple-600">Bs {parseFloat(d.monto_condonado).toFixed(2)}</td>
                                        <td className="p-3">
                                            <span className={cn("px-2 py-1 rounded-md text-[9px] font-black uppercase",
                                                d.tipo_condonacion === 'INSOLVENCIA' ? 'bg-red-50 text-red-600' :
                                                d.tipo_condonacion === 'FALLECIMIENTO' ? 'bg-slate-100 text-slate-600' :
                                                d.tipo_condonacion === 'ACUERDO_DIRECTIVA' ? 'bg-blue-50 text-blue-600' :
                                                'bg-amber-50 text-amber-600'
                                            )}>
                                                {d.tipo_condonacion}
                                            </span>
                                        </td>
                                        <td className="p-3 text-slate-600 max-w-[200px] truncate" title={d.motivo}>{d.motivo}</td>
                                        <td className="p-3 text-slate-500">{d.responsable_condonacion}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-400">
                        <ShieldOff size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="font-black text-[11px] uppercase tracking-widest">
                            No hay condonaciones registradas en este mes
                        </p>
                    </div>
                )}
            </div>

            <ToastContainer />
        </div>
    );
}
