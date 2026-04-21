import React, { useState, useEffect } from 'react';
import { AlertTriangle, Printer, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { cn } from '../utils/cn';
import { useToast } from '../utils/toast';
import { getUsuarios, getPagos, getPausas, getCondonaciones } from '../services/data';
import { calcularMoraSocio } from '../utils/debt';
import { supabase } from '../supabase';
import { monthNames } from '../utils/formatters';

/**
 * Formatea los meses pendientes agrupados por año.
 * Ej: "JULIO - DICIEMBRE 2025, ENERO - ABRIL 2026"
 */
const formatearMesesAgrupados = (mesesPendientes) => {
    if (!mesesPendientes || mesesPendientes.length === 0) return '';

    // Parsear cada mes a { mes, anio, idx }
    const parsed = mesesPendientes.map(m => {
        const parts = m.split(' ');
        const mesNombre = parts[0];
        const anio = parseInt(parts[1], 10);
        const idx = monthNames.indexOf(mesNombre);
        return { mesNombre, anio, idx };
    }).filter(p => p.idx !== -1 && !isNaN(p.anio));

    if (parsed.length === 0) return mesesPendientes.join(', ');

    // Agrupar por año
    const porAnio = {};
    parsed.forEach(p => {
        if (!porAnio[p.anio]) porAnio[p.anio] = [];
        porAnio[p.anio].push(p);
    });

    const anios = Object.keys(porAnio).sort((a, b) => a - b);
    const partes = anios.map(anio => {
        const meses = porAnio[anio].sort((a, b) => a.idx - b.idx);
        if (meses.length === 1) {
            return `${meses[0].mesNombre} ${anio}`;
        }
        return `${meses[0].mesNombre} - ${meses[meses.length - 1].mesNombre} ${anio}`;
    });

    return partes.join(', ');
};

export default function UsuariosDeudores() {
    const { success, error: notifyError, ToastContainer } = useToast();
    const [deudores, setDeudores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [page, setPage] = useState(0);
    const PER_PAGE = 50;

    useEffect(() => { cargarDeudores(); }, []);

    const cargarDeudores = async () => {
        setLoading(true);
        try {
            const [usuarios, pagos, pausas, condonaciones] = await Promise.all([
                getUsuarios(),
                getPagos(),
                getPausas(),
                getCondonaciones()
            ]);

            // Indexar pagos, pausas y condonaciones por usuario
            const pagosMap = {};
            (pagos || []).filter(p => p.estado !== 'ANULADO').forEach(p => {
                if (!pagosMap[p.usuario_id]) pagosMap[p.usuario_id] = [];
                pagosMap[p.usuario_id].push(p);
            });

            const pausasMap = {};
            (pausas || []).forEach(p => {
                if (!pausasMap[p.usuario_id]) pausasMap[p.usuario_id] = [];
                pausasMap[p.usuario_id].push(p);
            });

            const condMap = {};
            (condonaciones || []).forEach(c => {
                if (!condMap[c.usuario_id]) condMap[c.usuario_id] = [];
                condMap[c.usuario_id].push(c);
            });

            // Calcular deuda de cada usuario activo
            const lista = usuarios
                .filter(u => u.estado === 'ACTIVO')
                .map(u => {
                    const mora = calcularMoraSocio(
                        u.inicio_cobro,
                        pagosMap[u.id] || [],
                        u.tarifa || 10,
                        pausasMap[u.id] || [],
                        condMap[u.id] || []
                    );
                    const cantidadMeses = mora.mesesPendientes.length;
                    const montoAdeudado = cantidadMeses * (u.tarifa || 10);
                    return {
                        id: u.id,
                        nombre: u.nombre,
                        codigo: u.codigo,
                        inicio_cobro: u.inicio_cobro,
                        tarifa: u.tarifa || 10,
                        mesesPendientes: mora.mesesPendientes,
                        mesesAgrupados: formatearMesesAgrupados(mora.mesesPendientes),
                        cantidadMeses,
                        montoAdeudado
                    };
                })
                .filter(u => u.cantidadMeses > 0)
                .sort((a, b) => b.cantidadMeses - a.cantidadMeses);

            setDeudores(lista);
        } catch (err) {
            console.error('Error al cargar deudores:', err);
            notifyError('Error al cargar datos: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Filtrar por búsqueda
    const filtrados = deudores.filter(d => {
        if (!busqueda) return true;
        const term = busqueda.toUpperCase();
        return d.nombre.toUpperCase().includes(term) || d.codigo.includes(term);
    });

    const totalPages = Math.ceil(filtrados.length / PER_PAGE);
    const paginados = filtrados.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

    // Totales
    const totalMonto = filtrados.reduce((acc, d) => acc + d.montoAdeudado, 0);
    const totalMeses = filtrados.reduce((acc, d) => acc + d.cantidadMeses, 0);

    const generarPDF = async () => {
        try {
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter' });
            const { data: configArr } = await supabase.from('configuracion').select('*');
            const config = (configArr || []).reduce((acc, c) => ({ ...acc, [c.key]: c.value }), {});

            // Encabezado
            if (config.logo_b64) {
                try { doc.addImage(config.logo_b64, 'PNG', 10, 10, 25, 18); } catch (e) { }
            }
            doc.setFontSize(11); doc.setFont(undefined, 'bold');
            doc.text(config.razon_social || "SINDICATO TAQUIÑA", 40, 15);
            doc.setFontSize(8); doc.setFont(undefined, 'normal');
            doc.text(config.datos_afiliacion || "", 40, 20, { maxWidth: 120 });

            doc.setFontSize(14); doc.setFont(undefined, 'bold'); doc.setTextColor(180, 0, 0);
            doc.text("REPORTE DE USUARIOS DEUDORES", 108, 38, { align: 'center' });
            doc.setFontSize(9); doc.setTextColor(100, 100, 100); doc.setFont(undefined, 'normal');
            doc.text("Fecha: " + new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }), 108, 44, { align: 'center' });

            doc.setDrawColor(0); doc.line(10, 47, 205, 47);

            // Cabecera de tabla
            let y = 54;
            doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(30, 41, 59);
            doc.text("NOMBRE", 12, y);
            doc.text("COD.", 72, y);
            doc.text("MESES ADEUDADOS", 85, y);
            doc.text("CANT.", 170, y, { align: 'center' });
            doc.text("MONTO Bs.", 200, y, { align: 'right' });
            doc.setDrawColor(0); doc.line(10, y + 2, 205, y + 2);
            doc.setFont(undefined, 'normal');

            const datos = busqueda ? filtrados : deudores;
            datos.forEach((d, i) => {
                y = y + 6;
                if (y > 260) {
                    doc.addPage();
                    y = 20;
                    doc.setFontSize(8); doc.setFont(undefined, 'bold'); doc.setTextColor(30, 41, 59);
                    doc.text("NOMBRE", 12, y);
                    doc.text("COD.", 72, y);
                    doc.text("MESES ADEUDADOS", 85, y);
                    doc.text("CANT.", 170, y, { align: 'center' });
                    doc.text("MONTO Bs.", 200, y, { align: 'right' });
                    doc.line(10, y + 2, 205, y + 2);
                    doc.setFont(undefined, 'normal');
                    y += 6;
                }

                doc.setFontSize(7); doc.setTextColor(30, 41, 59);
                // Nombre - truncar si es muy largo
                const nombre = d.nombre.length > 30 ? d.nombre.substring(0, 28) + '..' : d.nombre;
                doc.text(nombre, 12, y);
                doc.text(d.codigo, 72, y);
                // Meses agrupados - truncar si es muy largo
                const mesesTexto = d.mesesAgrupados.length > 50 ? d.mesesAgrupados.substring(0, 48) + '..' : d.mesesAgrupados;
                doc.text(mesesTexto, 85, y, { maxWidth: 78 });
                doc.text(String(d.cantidadMeses), 170, y, { align: 'center' });
                doc.setFont(undefined, 'bold');
                doc.text(d.montoAdeudado.toFixed(2), 200, y, { align: 'right' });
                doc.setFont(undefined, 'normal');
                doc.setDrawColor(220); doc.line(10, y + 2, 205, y + 2);
            });

            // Totales
            y += 8;
            if (y > 260) { doc.addPage(); y = 20; }
            doc.setDrawColor(0); doc.line(10, y - 2, 205, y - 2);
            doc.setFontSize(9); doc.setFont(undefined, 'bold'); doc.setTextColor(180, 0, 0);
            doc.text("TOTAL DEUDORES: " + datos.length, 12, y);
            doc.text("TOTAL MESES: " + datos.reduce((a, d) => a + d.cantidadMeses, 0), 85, y);
            doc.text("Bs. " + datos.reduce((a, d) => a + d.montoAdeudado, 0).toFixed(2), 200, y, { align: 'right' });

            // Firmas
            const signY = doc.internal.pageSize.height - 20;
            doc.setDrawColor(0); doc.setTextColor(30, 41, 59);
            doc.setFontSize(8); doc.setFont(undefined, 'normal');
            doc.line(40, signY, 80, signY);
            doc.text("FIRMA RESPONSABLE", 60, signY + 5, { align: 'center' });
            doc.line(130, signY, 170, signY);
            doc.text("STRIO. HACIENDA", 150, signY + 5, { align: 'center' });

            doc.save(`Usuarios_Deudores_${new Date().toISOString().slice(0, 10)}.pdf`);
            success('PDF generado correctamente');
        } catch (err) {
            console.error('Error al generar PDF:', err);
            notifyError('Error al generar PDF: ' + err.message);
        }
    };

    return (
        <div className="flex flex-col gap-8 max-w-6xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-marine tracking-tight uppercase flex items-center gap-3">
                    <AlertTriangle size={32} className="text-red-500" />
                    Usuarios Deudores
                </h1>
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
                    Listado de socios con meses pendientes de pago
                </p>
            </div>

            {/* Barra de herramientas */}
            <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl flex flex-wrap items-center gap-4">
                <Search size={20} className="text-slate-400" />
                <input
                    type="text"
                    placeholder="BUSCAR POR NOMBRE O CODIGO..."
                    className="flex-1 min-w-[200px] bg-slate-50 border border-slate-100 p-3 rounded-xl text-[12px] font-black uppercase placeholder:text-slate-300 focus:outline-none focus:border-marine/30 transition-all"
                    value={busqueda}
                    onChange={e => { setBusqueda(e.target.value); setPage(0); }}
                />
                <button
                    onClick={generarPDF}
                    disabled={filtrados.length === 0}
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                >
                    <Printer size={14} /> Imprimir PDF
                </button>
            </div>

            {/* Tarjetas resumen */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Deudores</p>
                    <p className="text-3xl font-black text-red-500 mt-1">{filtrados.length}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Meses Adeudados</p>
                    <p className="text-3xl font-black text-amber-500 mt-1">{totalMeses}</p>
                </div>
                <div className="bg-white border border-slate-100 p-6 rounded-[2rem] shadow-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto Total Adeudado</p>
                    <p className="text-3xl font-black text-red-600 mt-1">Bs {totalMonto.toFixed(2)}</p>
                </div>
            </div>

            {/* Tabla */}
            <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-blue-900/5">
                {loading ? (
                    <p className="text-center py-12 text-slate-400 font-black text-[11px] uppercase tracking-widest animate-pulse">Cargando deudores...</p>
                ) : filtrados.length > 0 ? (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] border-b border-slate-100">
                                    <tr>
                                        <th className="p-5 pl-6">Nombre</th>
                                        <th className="p-5">Codigo</th>
                                        <th className="p-5">Meses Adeudados</th>
                                        <th className="p-5 text-center">Cant. Meses</th>
                                        <th className="p-5 text-right pr-6">Monto Bs.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 font-bold text-[12px] uppercase">
                                    {paginados.map(d => (
                                        <tr key={d.id} className="hover:bg-red-50/30 transition-colors">
                                            <td className="p-5 pl-6 font-black text-slate-700">{d.nombre}</td>
                                            <td className="p-5 text-slate-500">{d.codigo}</td>
                                            <td className="p-5 text-[11px] text-slate-600 max-w-[300px]">
                                                {d.mesesAgrupados}
                                            </td>
                                            <td className="p-5 text-center">
                                                <span className={cn(
                                                    "inline-block px-3 py-1 rounded-full text-[10px] font-black",
                                                    d.cantidadMeses >= 6 ? "bg-red-100 text-red-700" :
                                                    d.cantidadMeses >= 3 ? "bg-amber-100 text-amber-700" :
                                                    "bg-blue-100 text-blue-700"
                                                )}>
                                                    {d.cantidadMeses} {d.cantidadMeses === 1 ? 'MES' : 'MESES'}
                                                </span>
                                            </td>
                                            <td className="p-5 text-right pr-6 font-black text-red-600">
                                                Bs {d.montoAdeudado.toFixed(2)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Paginacion */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between p-5 border-t border-slate-100 bg-slate-50/30">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Pagina {page + 1} de {totalPages} ({filtrados.length} deudores)
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="p-2 rounded-lg bg-white border border-slate-200 disabled:opacity-30 hover:bg-slate-100 transition-all"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                        className="p-2 rounded-lg bg-white border border-slate-200 disabled:opacity-30 hover:bg-slate-100 transition-all"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-16 text-slate-400">
                        <AlertTriangle size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="font-black text-[11px] uppercase tracking-widest">
                            {busqueda ? 'No se encontraron deudores con ese criterio' : 'No hay usuarios con deuda pendiente'}
                        </p>
                    </div>
                )}
            </div>

            <ToastContainer />
        </div>
    );
}
