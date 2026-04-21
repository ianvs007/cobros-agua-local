import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Users, CircleDollarSign, TrendingUp, AlertCircle, Plus, Receipt, Clock, ShieldOff } from 'lucide-react';
import { cn } from '../utils/cn';
import { useToast } from '../utils/toast';
import { calcularMoraSocio } from '../utils/debt';
import { getUsuarios, getPagos, getPausas, getCondonaciones } from '../services/data';
import { useApp } from '../contexts/AppContext';

export default function Dashboard() {
    const { operator, setActiveTab, setInitialAction } = useApp();
    const { error: notifyError, ToastContainer } = useToast();
    const [stats, setStats] = useState({ totalSocios: 0, recaudo: 0, deudores: 0, enPausa: 0, condonaciones: 0 });

    useEffect(() => {
        let isMounted = true;
        const abortController = new AbortController();

        const load = async () => {
            try {
                // 1. Lectura desde Supabase
                const socios = await getUsuarios();
                const p = await getPagos();
                const pausas = await getPausas();
                const condonacionesList = await getCondonaciones();

                if (!isMounted || abortController.signal.aborted) return;

                if (!socios || !p || !pausas) return;

                const now = new Date();
                const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                const sum = p
                    .filter(x => x.fecha && x.fecha.startsWith(mesActual) && x.estado === 'PAGADO')
                    .reduce((acc, curr) => acc + (parseFloat(curr.monto) || 0), 0);

                // Calcular deudores y pausas
                let deudoresCount = 0;
                let enPausaCount = 0;
                socios.forEach(socio => {
                    const pagosSocio = p.filter(pg => String(pg.usuario_id) === String(socio.id));
                    const pausasSocio = pausas.filter(pa => String(pa.usuario_id) === String(socio.id));
                    const condonacionesSocio = condonacionesList.filter(c => String(c.usuario_id) === String(socio.id));
                    const pagosValidos = pagosSocio.filter(pg => pg.estado === 'PAGADO');
                    const { deuda, hayPausaActiva } = calcularMoraSocio(socio.inicio_cobro, pagosValidos, socio.tarifa, pausasSocio, condonacionesSocio);

                    if (deuda > 0) {
                        deudoresCount++;
                    } else if (hayPausaActiva) {
                        enPausaCount++;
                    }
                });

                if (isMounted) {
                    setStats({ totalSocios: socios.length, recaudo: sum, deudores: deudoresCount, enPausa: enPausaCount, condonaciones: condonacionesList.length });
                }
            } catch (error) {
                console.error('Error loading dashboard:', error);
                notifyError('No se pudo cargar el resumen del dashboard.');
            }
        };

        load();

        // BUG FIX #4: Cleanup function para evitar memory leaks
        return () => {
            isMounted = false;
            abortController.abort();
        };
    }, []);

    const cards = [
        { title: 'USUARIOS', val: stats.totalSocios, icon: Users, color: 'text-blue-400' },
        { title: 'PERSONAS EN MORA', val: stats.deudores, icon: AlertCircle, color: 'text-red-400' },
        { title: 'EN PAUSA', val: stats.enPausa, icon: Clock, color: 'text-amber-400' },
        { title: 'CONDONACIONES', val: stats.condonaciones, icon: ShieldOff, color: 'text-purple-400' },
        { title: 'RECAUDO MES', val: `Bs ${stats.recaudo.toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-400' },
    ];

    return (
        <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black text-marine tracking-tight">Panel de Inicio</h1>
                <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">Resumen general de operaciones</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                {cards.map((c, i) => (
                    <div key={i} className="bg-white border border-slate-100 p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl shadow-blue-900/5 hover:scale-[1.02] transition-transform group cursor-default">
                        <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-marine transition-colors">{c.title}</p>
                            <h3 className="text-3xl font-black text-slate-800 mt-2 tracking-tighter">{c.val}</h3>
                        </div>
                        <div className={cn("p-5 rounded-3xl transition-colors",
                            c.title === 'USUARIOS' ? "bg-blue-50 text-blue-600" :
                            c.title === 'PERSONAS EN MORA' ? "bg-red-50 text-red-500" :
                            c.title === 'EN PAUSA' ? "bg-amber-50 text-amber-600" :
                            "bg-emerald-50 text-emerald-600"
                        )}>
                            <c.icon size={28} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-white border border-slate-100 p-10 rounded-[3rem] shadow-2xl shadow-blue-900/5">
                    <h2 className="text-sm font-black mb-8 flex items-center gap-3 text-marine uppercase tracking-widest">
                        <Plus className="text-sky-500" size={20} /> ACCESO RÁPIDO
                    </h2>
                    <div className="flex flex-col sm:flex-row gap-6">
                        {operator?.rol === 'ADMINISTRADOR' && (
                            <button
                                onClick={() => {
                                    setInitialAction('open_modal');
                                    setActiveTab('usuarios');
                                }}
                                className="flex-1 bg-slate-50 hover:bg-marine p-8 rounded-3xl transition-all text-left flex items-center gap-5 group border border-slate-100 hover:border-marine shadow-sm hover:shadow-xl hover:shadow-marine/20"
                            >
                                <div className="p-4 bg-white rounded-2xl shadow-sm text-marine group-hover:bg-white/20 group-hover:text-white transition-colors"><Users size={24} /></div>
                                <div>
                                    <p className="font-black text-[11px] uppercase tracking-wider text-slate-400 group-hover:text-white/60">Nuevo Usuario</p>
                                    <p className="text-[9px] font-black text-marine group-hover:text-white mt-1 opacity-50 uppercase tracking-tighter">Registro Directo</p>
                                </div>
                            </button>
                        )}
                        {operator?.rol === 'OPERADOR' && (
                            <button
                                onClick={() => setActiveTab('cobros')}
                                className="flex-1 bg-slate-50 hover:bg-emerald-600 p-8 rounded-3xl transition-all text-left flex items-center gap-5 group border border-slate-100 hover:border-emerald-600 shadow-sm hover:shadow-xl hover:shadow-emerald-600/20"
                            >
                                <div className="p-4 bg-white rounded-2xl shadow-sm text-emerald-600 group-hover:bg-white/20 group-hover:text-white transition-colors"><Receipt size={24} /></div>
                                <div>
                                    <p className="font-black text-[11px] uppercase tracking-wider text-slate-400 group-hover:text-white/60">Hacer Cobro</p>
                                    <p className="text-[9px] font-black text-emerald-600 group-hover:text-white mt-1 opacity-50 uppercase tracking-tighter">Recibo PDF</p>
                                </div>
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <ToastContainer />
        </div>
    );
}
