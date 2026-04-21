import React, { useState, useEffect } from 'react';
import { FileText, Download, Filter, Calendar, DollarSign, Users, AlertCircle } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../utils/toast';
import { getAnulaciones, getUsuarios } from '../services/data';

/**
 * ReporteAnulaciones - Reporte de anulaciones para Asamblea
 * Lee desde Dexie (offline-first) en vez de vistas SQL de Supabase
 */
export default function ReporteAnulaciones() {
    const { success, error: notifyError, ToastContainer } = useToast();
    const [resumen, setResumen] = useState([]);
    const [detalle, setDetalle] = useState([]);
    const [reintegrosPendientes, setReintegrosPendientes] = useState([]);
    const [filtroMes, setFiltroMes] = useState('');
    const [loading, setLoading] = useState(true);

    // Obtener mes actual en formato YYYY-MM
    useEffect(() => {
        const now = new Date();
        setFiltroMes(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }, []);

    // Cargar datos
    useEffect(() => {
        cargarDatos();
    }, [filtroMes]);

    const cargarDatos = async () => {
        if (!filtroMes) return;
        setLoading(true);
        try {
            // Cargar datos base de Dexie
            const allAnulaciones = await getAnulaciones();
            const allUsuarios = await getUsuarios();
            const userMap = allUsuarios.reduce((acc, u) => ({ ...acc, [String(u.id)]: u }), {});

            // 1. Resumen mensual (equivale a v_reporte_asamblea_anulaciones)
            const resumenMap = {};
            allAnulaciones.forEach(a => {
                if (!a.fecha_anulacion) return;
                const mesKey = a.fecha_anulacion.slice(0, 7);
                if (!resumenMap[mesKey]) {
                    resumenMap[mesKey] = {
                        mes_anulacion: mesKey,
                        total_anulaciones: 0,
                        error_digitacion: 0,
                        pago_indebido: 0,
                        duplicado: 0,
                        solicitud_usuario: 0,
                        monto_total_anulado: 0,
                        monto_total_reintegrado: 0,
                        saldo_no_reintegrado: 0
                    };
                }
                const r = resumenMap[mesKey];
                r.total_anulaciones++;
                const tipo = (a.tipo_anulacion || 'ERROR_DIGITACION').toUpperCase();
                if (tipo === 'ERROR_DIGITACION') r.error_digitacion++;
                else if (tipo === 'PAGO_INDEBIDO') r.pago_indebido++;
                else if (tipo === 'DUPLICADO') r.duplicado++;
                else if (tipo === 'SOLICITUD_USUARIO') r.solicitud_usuario++;
                r.monto_total_anulado += parseFloat(a.monto_anulado || 0);
                r.monto_total_reintegrado += parseFloat(a.reintegro || 0);
                r.saldo_no_reintegrado += parseFloat(a.monto_anulado || 0) - parseFloat(a.reintegro || 0);
            });
            const resumenArr = Object.values(resumenMap).sort((a, b) => b.mes_anulacion.localeCompare(a.mes_anulacion));
            setResumen(resumenArr);

            // 2. Detalle del mes seleccionado (equivale a v_recibos_anulados filtrado)
            const primerDia = `${filtroMes}-01`;
            const fechaD = new Date(primerDia);
            fechaD.setMonth(fechaD.getMonth() + 1);
            const ultimoDia = fechaD.toISOString().split('T')[0];

            const anulacionesMes = allAnulaciones.filter(a =>
                a.fecha_anulacion && a.fecha_anulacion >= primerDia && a.fecha_anulacion < ultimoDia
            );

            // Agrupar por correlativo
            const grupos = {};
            anulacionesMes.forEach(item => {
                const socio = userMap[String(item.usuario_id)] || {};
                const key = item.correlativo || `temp-${item.id}`;
                if (!grupos[key]) {
                    grupos[key] = {
                        ...item,
                        periodos: [item.periodo],
                        monto_total: parseFloat(item.monto_anulado || 0),
                        reintegro_total: parseFloat(item.reintegro || 0),
                        nombre_socio: socio.nombre || 'Desconocido',
                        codigo_socio: socio.codigo || '',
                        ci_socio: socio.ci || '',
                        fecha_formateada: new Date(item.fecha_anulacion).toLocaleDateString('es-ES')
                    };
                } else {
                    if (!grupos[key].periodos.includes(item.periodo)) {
                        grupos[key].periodos.push(item.periodo);
                    }
                    grupos[key].monto_total += parseFloat(item.monto_anulado || 0);
                    grupos[key].reintegro_total += parseFloat(item.reintegro || 0);
                }
            });
            setDetalle(Object.values(grupos));

            // 3. Reintegros pendientes (equivale a v_reintegros_pendientes)
            const pendientes = allAnulaciones
                .filter(a => parseFloat(a.reintegro || 0) > 0 && (!a.recibo_reintegro || a.recibo_reintegro === ''))
                .map(a => {
                    const socio = userMap[String(a.usuario_id)] || {};
                    return {
                        ...a,
                        usuario_nombre: socio.nombre || 'Desconocido',
                        usuario_codigo: socio.codigo || '',
                        usuario_ci: socio.ci || ''
                    };
                })
                .sort((a, b) => (b.fecha_anulacion || '').localeCompare(a.fecha_anulacion || ''));
            setReintegrosPendientes(pendientes);

        } catch (err) {
            console.error('Error al cargar reporte:', err);
            notifyError('Error al cargar el reporte: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Calcular totales generales — Todo basado en 'detalle' (mes filtrado) para consistencia
    const totales = {
        totalAnulaciones: new Set(
            detalle.map(d => d.correlativo).filter(Boolean)
        ).size || detalle.length,
        montoTotalAnulado: detalle.reduce((acc, d) => acc + parseFloat(d.monto_total || 0), 0),
        montoTotalReintegrado: detalle.reduce((acc, d) => acc + parseFloat(d.reintegro_total || 0), 0),
        saldoNoReintegrado: detalle.reduce((acc, d) => acc + (parseFloat(d.monto_total || 0) - parseFloat(d.reintegro_total || 0)), 0),
    };

    // Exportar a CSV
    const exportarCSV = () => {
        try {
            const rows = detalle.map(d => [
                d.fecha_formateada,
                d.correlativo || 'S/N',
                d.codigo_socio,
                d.nombre_socio,
                d.ci_socio,
                d.periodos.join('; '),
                d.monto_total.toFixed(2),
                d.tipo_anulacion,
                d.reintegro_total.toFixed(2),
                (d.monto_total - d.reintegro_total).toFixed(2),
                d.motivo,
                d.responsable_anulacion,
                d.observaciones || ''
            ]);

            const headers = [
                'Fecha', 'Recibo', 'Código', 'Socio', 'CI', 'Periodos Anulados', 
                'Total Anulado', 'Tipo', 'Reintegro', 'Saldo Pendiente', 
                'Motivo', 'Responsable', 'Observaciones'
            ];

            const csvContent = [
                ['REPORTE DE ANULACIONES - COBROS AGUA'],
                [`Mes: ${filtroMes}`],
                [],
                headers,
                ...rows
            ].map(row => row.join(',')).join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `anulaciones_${filtroMes}.csv`;
            link.click();

            success('Reporte exportado exitosamente');
        } catch (err) {
            notifyError('Error al exportar: ' + err.message);
        }
    };

    // Formatear tipo de anulación para mostrar
    const formatoTipo = (tipo) => {
        const formatos = {
            'ERROR_DIGITACION': '📝 Error Digitación',
            'PAGO_INDEBIDO': '💵 Pago Indebido',
            'DUPLICADO': '🔄 Duplicado',
            'SOLICITUD_USUARIO': '👤 Solicitud Usuario'
        };
        return formatos[tipo] || tipo;
    };

    // Colores por tipo
    const colorTipo = (tipo) => {
        const colores = {
            'ERROR_DIGITACION': 'bg-blue-50 text-blue-600 border-blue-200',
            'PAGO_INDEBIDO': 'bg-emerald-50 text-emerald-600 border-emerald-200',
            'DUPLICADO': 'bg-amber-50 text-amber-600 border-amber-200',
            'SOLICITUD_USUARIO': 'bg-purple-50 text-purple-600 border-purple-200'
        };
        return colores[tipo] || 'bg-slate-50 text-slate-600 border-slate-200';
    };

    return (
        <div className="flex flex-col gap-8 max-w-7xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-marine tracking-tight uppercase flex items-center gap-3">
                    <FileText size={32} className="text-sky-500" />
                    Reporte de Anulaciones
                </h1>
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
                    Reporte para asamblea - Detalle de recibos anulados
                </p>
            </div>

            {/* Filtro de Mes */}
            <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl shadow-blue-900/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Calendar size={24} className="text-marine" />
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                                Filtrar por Mes
                            </label>
                            <input
                                type="month"
                                className="bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-sm focus:outline-none focus:border-marine/30"
                                value={filtroMes}
                                onChange={e => setFiltroMes(e.target.value)}
                            />
                        </div>
                    </div>
                    <button
                        onClick={exportarCSV}
                        disabled={detalle.length === 0}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg"
                    >
                        <Download size={18} />
                        Exportar CSV
                    </button>
                </div>
            </div>

            {/* Tarjetas de Totales */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl shadow-blue-900/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-blue-50 rounded-xl">
                            <FileText size={24} className="text-blue-600" />
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Anulaciones por Recibo</p>
                    <p className="text-3xl font-black text-slate-800 mt-1">{totales.totalAnulaciones}</p>
                </div>

                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl shadow-blue-900/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-red-50 rounded-xl">
                            <DollarSign size={24} className="text-red-600" />
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto Anulado</p>
                    <p className="text-3xl font-black text-red-600 mt-1">Bs {totales.montoTotalAnulado.toFixed(2)}</p>
                </div>

                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl shadow-blue-900/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-emerald-50 rounded-xl">
                            <DollarSign size={24} className="text-emerald-600" />
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reintegrado</p>
                    <p className="text-3xl font-black text-emerald-600 mt-1">Bs {totales.montoTotalReintegrado.toFixed(2)}</p>
                </div>

                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl shadow-blue-900/5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-3 bg-amber-50 rounded-xl">
                            <AlertCircle size={24} className="text-amber-600" />
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Reintegrado</p>
                    <p className="text-3xl font-black text-amber-600 mt-1">Bs {totales.saldoNoReintegrado.toFixed(2)}</p>
                </div>
            </div>

            {/* Reintegros Pendientes */}
            {reintegrosPendientes.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-[2rem]">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertCircle size={24} className="text-amber-600" />
                        <h3 className="font-black text-amber-800 text-lg uppercase">
                            Reintegros Pendientes ({reintegrosPendientes.length})
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {reintegrosPendientes.slice(0, 6).map(r => (
                            <div key={r.id} className="bg-white p-4 rounded-xl border border-amber-200">
                                <p className="font-black text-slate-800 text-sm">{r.usuario_nombre}</p>
                                <p className="text-[10px] text-slate-500 font-bold">Cod: {r.usuario_codigo} | {r.periodo}</p>
                                <p className="text-emerald-600 font-black text-lg mt-2">Bs {r.reintegro.toFixed(2)}</p>
                                <p className="text-[9px] text-amber-600 font-bold mt-1">{r.tipo_anulacion}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabla de Detalle */}
            <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-blue-900/5">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="font-black text-marine text-lg uppercase flex items-center gap-2">
                        <FileText size={20} className="text-sky-500" />
                        Detalle de Anulaciones - {filtroMes}
                    </h3>
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <div className="w-12 h-12 border-4 border-marine border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-400 font-black text-sm uppercase tracking-widest">Cargando...</p>
                    </div>
                ) : detalle.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4">Recibo</th>
                                    <th className="p-4">Socio</th>
                                    <th className="p-4">Periodos Anulados</th>
                                    <th className="p-4 text-right">Total Anulado</th>
                                    <th className="p-4">Tipo</th>
                                    <th className="p-4 text-right">Reintegro</th>
                                    <th className="p-4">Motivo</th>
                                    <th className="p-4">Responsable</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 font-bold text-[12px] uppercase">
                                {detalle.map(d => (
                                    <tr key={d.correlativo || d.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 text-slate-600">{d.fecha_formateada}</td>
                                        <td className="p-4">
                                            <span className="font-black text-marine">N° {d.correlativo}</span>
                                        </td>
                                        <td className="p-4">
                                            <div>
                                                <p className="font-black text-slate-800">{d.nombre_socio}</p>
                                                <p className="text-[9px] text-slate-400">Cod: {d.codigo_socio} | CI: {d.ci_socio}</p>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-600 font-bold text-[10px] max-w-[150px]">
                                            {d.periodos.join(', ')}
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="font-black text-red-600">Bs {d.monto_total.toFixed(2)}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border", colorTipo(d.tipo_anulacion))}>
                                                {formatoTipo(d.tipo_anulacion)}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            {d.reintegro_total > 0 ? (
                                                <span className="font-black text-emerald-600">Bs {d.reintegro_total.toFixed(2)}</span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-slate-600 max-w-[150px] truncate" title={d.motivo}>
                                            {d.motivo}
                                        </td>
                                        <td className="p-4 text-slate-500">{d.responsable_anulacion}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                        <p className="text-slate-400 font-black text-sm uppercase tracking-widest">
                            No hay anulaciones en este mes
                        </p>
                    </div>
                )}
            </div>

            <ToastContainer />
        </div>
    );
}
