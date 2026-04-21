import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Building2, Database, Download, CheckCircle2, Image as ImageIcon, Trash2, Shield, UserPlus, Edit2, KeyRound, Upload, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { getConfiguracion, getOperadores } from '../services/data';
import { useToast } from '../utils/toast';
import Toast from '../utils/toast';
import { hashPassword } from '../utils/crypto';

export default function Configuracion() {
    // ── BUG FIX: Usar Toast en lugar de alert() ──
    const { success, error: notifyError, warning, info, ToastContainer } = useToast();
    const [data, setData] = useState({});
    const [saved, setSaved] = useState(false);
    const [importing, setImporting] = useState(false);
    
    // Estado local para el campo de afiliación (para escritura fluida)
    const [afiliacionLocal, setAfiliacionLocal] = useState('');
    const [afiliacionTimer, setAfiliacionTimer] = useState(null);

    // Operator CRUD state
    const [operadores, setOperadores] = useState([]);
    const [showOpForm, setShowOpForm] = useState(false);
    const [opForm, setOpForm] = useState({ id: null, usuario: '', nombre_completo: '', rol: 'OPERADOR', password: '' });
    const [opError, setOpError] = useState('');

    useEffect(() => { load(); loadOperadores(); }, []);
    
    // Sincronizar estado local con datos cargados
    useEffect(() => {
        if (data.datos_afiliacion !== undefined) {
            setAfiliacionLocal(data.datos_afiliacion || '');
        }
    }, [data.datos_afiliacion]);

    const loadOperadores = async () => {
        const ops = await getOperadores();
        setOperadores(ops);
    };

    const load = async () => {
        const configArr = await getConfiguracion();
        setData(configArr.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}));
    };

    // Función para guardar datos de afiliación con debounce (1 segundo)
    const updateAfiliacion = (valor) => {
        setAfiliacionLocal(valor);
        
        // Limpiar timer anterior
        if (afiliacionTimer) {
            clearTimeout(afiliacionTimer);
        }
        
        // Guardar después de 1 segundo sin escribir
        const timer = setTimeout(async () => {
            await supabase.from('configuracion').upsert({ key: 'datos_afiliacion', value: valor.toUpperCase() });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }, 1000);
        
        setAfiliacionTimer(timer);
    };

    const downloadCSVTemplate = () => {
        const headers = "Nombre del Socio,CI,Tanque/ramal,Tarifa,Inicio de Cobros (YYYY-MM)\n";
        const example = "JUAN PEREZ,1234567,1,10,2026-01\nMARIA GOMEZ,9876543,2,10.5,2026-02";
        const blob = new Blob([headers + example], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'plantilla_socios.csv'; a.click();
    };

    const handleCSVUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setImporting(true);
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim() !== '');
            if (lines.length <= 1) throw new Error("Archivo vacío o sin datos válidos");

            const dataToInsert = [];
            const { data: allUsers } = await supabase.from('usuarios').select('codigo');
            let maxCode = 0;
            const validCodes = (allUsers || []).filter(u => /^\d{4}$/.test(u.codigo)).map(u => parseInt(u.codigo));
            if (validCodes.length > 0) maxCode = Math.max(...validCodes);

            for (let i = 1; i < lines.length; i++) {
                const row = lines[i].split(',').map(s => s.trim());
                if (row.length < 5) continue;

                const [nombre, ci, tanqueStr, tarifaStr, inicioStr] = row;
                if (!nombre) continue;

                maxCode++;
                const newCode = String(maxCode).padStart(4, '0');

                dataToInsert.push({
                    nombre: nombre.toUpperCase(),
                    ci: (ci || '').replace(/[^0-9]/g, ''),
                    codigo: newCode,
                    tanque: tanqueStr || '1',
                    tarifa: parseFloat(tarifaStr) || 10,
                    inicio_cobro: (inicioStr && inicioStr.length === 7) ? inicioStr : new Date().toISOString().slice(0, 7),
                    estado: 'ACTIVO'
                });
            }

            if (dataToInsert.length > 0) {
                const { data: savedUsers, error } = await supabase.from('usuarios').insert(dataToInsert).select();
                if (error) throw error;
                success(`¡Se importaron ${dataToInsert.length} socios correctamente!`);
            } else {
                warning("No se encontraron registros válidos para importar en la plantilla.");
            }
        } catch (error) {
            console.error("Error importando CSV:", error);
            notifyError("Error al procesar el archivo CSV. Por favor, revisa el formato de la plantilla.");
        } finally {
            setImporting(false);
            e.target.value = ''; // Reset file input
        }
    };

    const update = async (key, value) => {
        await supabase.from('configuracion').upsert({ key, value });
        load(); setSaved(true); setTimeout(() => setSaved(false), 2000);
    };

    const backup = async () => {
        const { data: u } = await supabase.from('usuarios').select('*');
        const { data: p } = await supabase.from('pagos').select('*');
        const { data: c } = await supabase.from('configuracion').select('*');
        const { data: o } = await supabase.from('operadores').select('*');
        const { data: a } = await supabase.from('anulaciones').select('*');
        const { data: pa } = await supabase.from('pausas_cobro').select('*');
        const { data: co } = await supabase.from('condonaciones').select('*');
        const file = { u, p, c, o, a, pa, co, date: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = 'RESPALDO_MAESTRO_LOCAL.json'; link.click();
    };

    const restore = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        e.target.value = '';

        const confirm1 = window.confirm('⚠️ RESTAURAR RESPALDO\n\nEsto reemplazará TODOS los datos actuales con los del archivo de respaldo.\n\n- Usuarios\n- Pagos\n- Configuración\n- Operadores\n\n¿Estás seguro de continuar?');
        if (!confirm1) return;

        const confirm2 = window.confirm('⚠️ ÚLTIMA CONFIRMACIÓN\n\nLos datos actuales se perderán permanentemente.\nAsegúrate de haber exportado un respaldo antes.\n\n¿Confirmas la restauración?');
        if (!confirm2) return;

        try {
            const text = await file.text();
            const backup = JSON.parse(text);

            if (!backup.u || !backup.p || !backup.c || !backup.o) {
                notifyError('Archivo de respaldo inválido. Debe contener usuarios, pagos, configuración y operadores.');
                return;
            }

            // 1. Limpiar todas las tablas en orden (dependencias)
            await supabase.from('anulaciones').delete().not('id', 'is', null);
            await supabase.from('condonaciones').delete().not('id', 'is', null);
            await supabase.from('pausas_cobro').delete().not('id', 'is', null);
            await supabase.from('pagos').delete().not('id', 'is', null);
            await supabase.from('usuarios').delete().not('id', 'is', null);
            await supabase.from('configuracion').delete().not('key', 'is', null);
            await supabase.from('operadores').delete().not('id', 'is', null);

            // 2. Restaurar operadores
            if (backup.o && backup.o.length > 0) {
                const ops = backup.o.map(({ id, created_at, ...rest }) => rest);
                await supabase.from('operadores').insert(ops);
            }

            // 3. Restaurar configuración
            if (backup.c && backup.c.length > 0) {
                const configs = backup.c.map(({ created_at, ...rest }) => rest);
                for (const cfg of configs) {
                    await supabase.from('configuracion').upsert(cfg);
                }
            }

            // 4. Restaurar usuarios
            if (backup.u && backup.u.length > 0) {
                const users = backup.u.map(({ id, created_at, ...rest }) => rest);
                await supabase.from('usuarios').insert(users);
            }

            // 5. Restaurar pagos (necesitamos mapear usuario_id)
            if (backup.p && backup.p.length > 0) {
                // Obtener usuarios recién insertados para mapear IDs
                const { data: newUsers } = await supabase.from('usuarios').select('id, codigo');
                const oldUsers = backup.u || [];
                const idMap = {};
                for (const oldUser of oldUsers) {
                    const newUser = (newUsers || []).find(nu => nu.codigo === oldUser.codigo);
                    if (newUser) idMap[oldUser.id] = newUser.id;
                }

                const pagos = backup.p
                    .map(({ id, created_at, ...rest }) => ({
                        ...rest,
                        usuario_id: idMap[rest.usuario_id] || rest.usuario_id
                    }))
                    .filter(p => p.usuario_id);

                if (pagos.length > 0) {
                    // Insertar en lotes de 50
                    for (let i = 0; i < pagos.length; i += 50) {
                        await supabase.from('pagos').insert(pagos.slice(i, i + 50));
                    }
                }
            }

            // 6. Restaurar anulaciones si existen en el respaldo
            if (backup.a && backup.a.length > 0) {
                const { data: newUsers } = await supabase.from('usuarios').select('id, codigo');
                const oldUsers = backup.u || [];
                const idMap = {};
                for (const oldUser of oldUsers) {
                    const newUser = (newUsers || []).find(nu => nu.codigo === oldUser.codigo);
                    if (newUser) idMap[oldUser.id] = newUser.id;
                }
                const anulaciones = backup.a.map(({ id, created_at, ...rest }) => ({
                    ...rest,
                    usuario_id: idMap[rest.usuario_id] || rest.usuario_id
                }));
                for (let i = 0; i < anulaciones.length; i += 50) {
                    await supabase.from('anulaciones').insert(anulaciones.slice(i, i + 50));
                }
            }

            // 7. Restaurar pausas si existen
            if (backup.pa && backup.pa.length > 0) {
                const { data: newUsers } = await supabase.from('usuarios').select('id, codigo');
                const oldUsers = backup.u || [];
                const idMap = {};
                for (const oldUser of oldUsers) {
                    const newUser = (newUsers || []).find(nu => nu.codigo === oldUser.codigo);
                    if (newUser) idMap[oldUser.id] = newUser.id;
                }
                const pausas = backup.pa.map(({ id, created_at, ...rest }) => ({
                    ...rest,
                    usuario_id: idMap[rest.usuario_id] || rest.usuario_id
                }));
                for (let i = 0; i < pausas.length; i += 50) {
                    await supabase.from('pausas_cobro').insert(pausas.slice(i, i + 50));
                }
            }

            // 8. Restaurar condonaciones si existen
            if (backup.co && backup.co.length > 0) {
                const { data: newUsers } = await supabase.from('usuarios').select('id, codigo');
                const oldUsers = backup.u || [];
                const idMap = {};
                for (const oldUser of oldUsers) {
                    const newUser = (newUsers || []).find(nu => nu.codigo === oldUser.codigo);
                    if (newUser) idMap[oldUser.id] = newUser.id;
                }
                const condonaciones = backup.co.map(({ id, created_at, ...rest }) => ({
                    ...rest,
                    usuario_id: idMap[rest.usuario_id] || rest.usuario_id
                }));
                for (let i = 0; i < condonaciones.length; i += 50) {
                    await supabase.from('condonaciones').insert(condonaciones.slice(i, i + 50));
                }
            }

            success('Respaldo restaurado exitosamente. Se recomienda recargar el sistema.');
            load();
            loadOperadores();
        } catch (err) {
            console.error('Error al restaurar:', err);
            notifyError('Error al restaurar el respaldo: ' + (err.message || 'Formato inválido'));
        }
    };

    const resetProduccion = async () => {
        // Doble confirmación por seguridad
        const confirm1 = window.confirm('⚠️ ADVERTENCIA CRÍTICA\n\n¿Estás SEGURO de que quieres resetear la base de datos para producción?\n\nEsto eliminará:\n- TODOS los socios\n- TODOS los pagos\n- TODAS las anulaciones\n- TODAS las pausas\n\nSe mantendrán:\n- Operadores\n- Configuración\n\n¡ESTA ACCIÓN NO SE PUEDE DESHACER!');
        
        if (!confirm1) return;
        
        const confirm2 = window.confirm('⚠️ ÚLTIMA ADVERTENCIA\n\nEsta acción es IRREVERSIBLE.\n\nSolo continúa si:\n- Has exportado un respaldo\n- Estás seguro de que quieres empezar desde cero\n- Los códigos comenzarán desde 00001\n\n¿Confirmas que quieres proceder?');
        
        if (!confirm2) return;
        
        try {
            // Eliminar datos en orden (por dependencias)
            // 1. Eliminar anulaciones (depende de pagos)
            await supabase.from('anulaciones').delete().not('id', 'is', null);
            
            // 2. Eliminar pausas
            await supabase.from('pausas_cobro').delete().not('id', 'is', null);
            
            // 3. Eliminar pagos
            await supabase.from('pagos').delete().not('id', 'is', null);
            
            // 4. Eliminar usuarios (socios)
            await supabase.from('usuarios').delete().not('id', 'is', null);
            
            // 5. Resetear el correlativo de recibos a 0 (el próximo será 000001)
            await supabase.from('configuracion')
                .update({ value: '0' })
                .eq('key', 'ultimo_recibo');

            success('✅ Base de datos reseteada exitosamente para producción.\n\nLos recibos comenzarán desde 000001.');
            
            // Recargar datos
            load();
        } catch (error) {
            console.error('Error al resetear:', error);
            notifyError('Error al resetear la base de datos: ' + error.message);
        }
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            update('logo_b64', reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleOpSubmit = async (e) => {
        e.preventDefault();
        setOpError('');
        const { id, usuario, nombre_completo, rol, password } = opForm;

        if (!usuario.trim() || !nombre_completo.trim()) {
            setOpError('Campos incompletos');
            return;
        }

        try {
            if (id) {
                // Edit
                if (usuario === 'admin' && rol !== 'ADMINISTRADOR') {
                    setOpError('El administrador principal no puede perder su rol.');
                    return;
                }
                const updateData = { usuario: usuario.trim(), nombre_completo: nombre_completo.trim(), rol };
                if (password) updateData.password = await hashPassword(password);
                await supabase.from('operadores').update(updateData).eq('id', id);
            } else {
                // Create
                const { data: exists } = await supabase.from('operadores').select('id').eq('usuario', usuario.trim()).maybeSingle();
                if (exists) {
                    setOpError('El nombre de usuario ya existe.');
                    return;
                }
                const newOp = {
                    usuario: usuario.trim(),
                    nombre_completo: nombre_completo.trim(),
                    rol,
                    password: await hashPassword(password || '123')
                };
                const { data: savedOp } = await supabase.from('operadores').insert([newOp]).select();
            }
            setShowOpForm(false);
            loadOperadores();
        } catch (err) {
            setOpError('Error al guardar el operador.');
        }
    };

    const deleteOp = async (op) => {
        if (op.usuario === 'admin') {
            warning('El administrador principal no puede ser eliminado.');
            return;
        }
        if (window.confirm(`¿Estás seguro de eliminar al operador ${op.usuario}?`)) {
            await supabase.from('operadores').delete().eq('id', op.id);
            success('Operador eliminado correctamente');
            loadOperadores();
        }
    };

    const triggerEditOp = (op) => {
        setOpForm({ id: op.id, usuario: op.usuario, nombre_completo: op.nombre_completo, rol: op.rol, password: '' });
        setShowOpForm(true);
    };

    return (
        <div className="flex flex-col gap-10 max-w-2xl mx-auto">
            <div className="flex justify-between items-center">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black text-marine tracking-tight uppercase">Configuración</h1>
                    <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">Ajustes del sistema y seguridad</p>
                </div>
                {saved && (
                    <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase border border-emerald-100 flex items-center gap-2 animate-bounce">
                        <CheckCircle2 size={14} /> Guardado
                    </div>
                )}
            </div>

            <div className="bg-white border border-slate-100 p-10 rounded-[3.5rem] space-y-10 shadow-2xl shadow-blue-900/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-48 h-48 bg-blue-50 rounded-full blur-3xl -mr-24 -mt-24 opacity-50 transition-opacity group-hover:opacity-100" />
                <h2 className="text-[11px] font-black text-marine uppercase tracking-[0.3em] flex items-center gap-3 relative z-10">
                    <Building2 size={20} className="text-sky-500" /> Datos de la Entidad
                </h2>
                <div className="space-y-8 relative z-10">
                    <div className="flex flex-col items-center gap-6 p-8 border-2 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50 hover:bg-white hover:border-marine/20 transition-all group/logo">
                        {data.logo_b64 ? (
                            <div className="relative group">
                                <img src={data.logo_b64} alt="Logo" className="h-32 w-auto object-contain rounded-2xl shadow-2xl shadow-marine/10 bg-white p-2" />
                                <button
                                    onClick={() => update('logo_b64', '')}
                                    className="absolute -top-3 -right-3 p-2 bg-red-500 text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ) : (
                            <div className="w-32 h-32 flex items-center justify-center bg-white rounded-2xl border border-slate-100 shadow-inner">
                                <ImageIcon size={48} className="text-slate-200" />
                            </div>
                        )}
                        <label className="cursor-pointer bg-white border border-slate-200 hover:border-marine hover:text-marine px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm hover:shadow-xl hover:shadow-marine/10 active:scale-95">
                            {data.logo_b64 ? 'Cambiar Logo de Empresa' : 'Subir Logo Oficial'}
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        </label>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest">Razón Social o Nombre del Sindicato</label>
                        <input className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl font-black text-[13px] uppercase focus:outline-none focus:border-marine/30 transition-all placeholder:text-slate-300" placeholder="Ej. Sindicato Taquiña" value={data.razon_social || ''} onChange={e => update('razon_social', e.target.value.toUpperCase())} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest">Localidad y Ubicación</label>
                        <input className="w-full bg-slate-50 border border-slate-100 p-5 rounded-2xl font-black text-[13px] uppercase focus:outline-none focus:border-marine/30 transition-all placeholder:text-slate-300" placeholder="Ej. Cochabamba, Bolivia" value={data.direccion || ''} onChange={e => update('direccion', e.target.value.toUpperCase())} />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-marine uppercase tracking-widest">
                            Datos de Afiliación
                        </label>
                        <textarea
                            rows="3"
                            className="w-full bg-slate-50 border-2 border-marine/30 p-5 rounded-2xl font-bold text-[12px] focus:outline-none focus:border-marine/50 transition-all placeholder:text-slate-300"
                            placeholder="Ej. AFILIADO A LA F.S.T.C.C. - C.S.U.T.C.B. - C.O.B. - FEDECOR"
                            value={afiliacionLocal}
                            onChange={e => updateAfiliacion(e.target.value)}
                        />
                        <p className="text-[9px] text-slate-500 font-bold mt-1">
                            Esta información aparecerá en la parte superior de los recibos de pago. Se guarda automáticamente.
                        </p>
                    </div>
                </div>
            </div>

            {/* Gestión de Operadores */}
            <div className="bg-white border border-slate-100 p-10 rounded-[3.5rem] space-y-6 shadow-2xl shadow-blue-900/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-48 h-48 bg-purple-50 rounded-full blur-3xl -mr-24 -mt-24 opacity-50 transition-opacity group-hover:opacity-100" />
                <div className="flex items-center justify-between relative z-10">
                    <h2 className="text-[11px] font-black text-marine uppercase tracking-[0.3em] flex items-center gap-3">
                        <Shield size={20} className="text-purple-500" /> Cuentas de acceso
                    </h2>
                    <button
                        onClick={() => { setOpForm({ id: null, usuario: '', nombre_completo: '', rol: 'OPERADOR', password: '' }); setShowOpForm(true); }}
                        className="bg-marine hover:bg-marine-light text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-marine/20"
                    >
                        <UserPlus size={14} /> Nuevo
                    </button>
                </div>

                {showOpForm && (
                    <form role="dialog" onSubmit={handleOpSubmit} className="bg-slate-50 border border-slate-100 p-6 rounded-[2.5rem] space-y-4 relative z-10 animate-in fade-in slide-in-from-top-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest">Usuario (Login)</label>
                                <input className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-black text-[13px] focus:outline-none focus:border-marine/30 transition-all placeholder:text-slate-300" placeholder="Ej. jperez" value={opForm.usuario} onChange={e => setOpForm({ ...opForm, usuario: e.target.value })} disabled={opForm.usuario === 'admin'} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest">Nombre Completo</label>
                                <input className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-black text-[13px] uppercase focus:outline-none focus:border-marine/30 transition-all placeholder:text-slate-300" placeholder="Ej. Juan Perez" value={opForm.nombre_completo} onChange={e => setOpForm({ ...opForm, nombre_completo: e.target.value.toUpperCase() })} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest">Rol</label>
                                <select className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-black text-[13px] uppercase cursor-pointer focus:outline-none focus:border-marine/30 transition-all" value={opForm.rol} onChange={e => setOpForm({ ...opForm, rol: e.target.value })} disabled={opForm.usuario === 'admin'}>
                                    <option value="OPERADOR">Operador Normal</option>
                                    <option value="ADMINISTRADOR">Administrador</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black opacity-40 ml-1 uppercase tracking-widest">Contraseña {opForm.id ? '(Dejar en blanco para no cambiar)' : '(Por defecto: 123)'}</label>
                                <input type="password" className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-black text-[13px] focus:outline-none focus:border-marine/30 transition-all placeholder:text-slate-300" placeholder={opForm.id ? "••••••" : "123"} value={opForm.password} onChange={e => setOpForm({ ...opForm, password: e.target.value })} />
                            </div>
                        </div>
                        {opError && <p role="alert" className="text-red-500 font-bold text-[10px] uppercase tracking-widest ml-1">{opError}</p>}
                        <div className="flex gap-2 justify-end pt-2">
                            <button type="button" onClick={() => setShowOpForm(false)} className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-200/50 transition-all">Cancelar</button>
                            <button type="submit" className="bg-marine hover:bg-marine-light text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-marine/20 transition-all active:scale-95">Guardar Operador</button>
                        </div>
                    </form>
                )}

                <div className="space-y-2 relative z-10">
                    {operadores.map(op => (
                        <div key={op.id} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group/item">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-[1rem] bg-slate-100 flex items-center justify-center text-slate-400">
                                    {op.rol === 'ADMINISTRADOR' ? <Shield size={18} className="text-purple-500" /> : <div className="font-black text-sm uppercase">{op.usuario.substring(0, 2)}</div>}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-marine uppercase tracking-wider">{op.nombre_completo} <span className="text-slate-400 text-[10px] opacity-70">(@{op.usuario})</span></span>
                                    <span className={`text-[9px] font-black tracking-widest uppercase mt-0.5 ${op.rol === 'ADMINISTRADOR' ? 'text-purple-600' : 'text-sky-500'}`}>{op.rol}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <button onClick={() => triggerEditOp(op)} className="p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all" title="Editar" aria-label="Editar operador">
                                    <Edit2 size={16} />
                                </button>
                                {op.usuario !== 'admin' && (
                                    <button onClick={() => deleteOp(op)} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all" title="Eliminar" aria-label="Eliminar operador">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Seguridad de Datos */}
            <div className="bg-white border border-slate-100 p-10 rounded-[3.5rem] space-y-6 shadow-2xl shadow-blue-900/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50" />
                <h2 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.3em] flex items-center gap-3 relative z-10">
                    <Database size={20} className="text-emerald-500" /> Seguridad de Datos
                </h2>
                <div className="space-y-6 relative z-10">
                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-tight">
                        Se recomienda exportar una copia de seguridad semanalmente. El archivo contiene todos los datos del sistema.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={backup} className="w-full bg-emerald-50 hover:bg-emerald-600 text-emerald-600 hover:text-white border border-emerald-100 font-black p-5 rounded-[2rem] text-[11px] uppercase flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow-xl hover:shadow-emerald-500/20 active:scale-95">
                            <Download size={18} /> Exportar Respaldo
                        </button>
                        <label className="w-full cursor-pointer bg-amber-50 hover:bg-amber-600 text-amber-600 hover:text-white border border-amber-100 font-black p-5 rounded-[2rem] text-[11px] uppercase flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow-xl hover:shadow-amber-500/20 active:scale-95">
                            <UploadCloud size={18} /> Restaurar Respaldo
                            <input type="file" className="hidden" accept=".json" onChange={restore} />
                        </label>
                    </div>
                    <p className="text-[8px] font-bold text-slate-400 text-center">
                        ⚠️ La restauración reemplaza TODOS los datos actuales - Requiere doble confirmación
                    </p>
                </div>
            </div>

            {/* Resetear para Producción */}
            <div className="bg-white border border-red-200 p-10 rounded-[3.5rem] space-y-6 shadow-2xl shadow-red-900/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-40 h-40 bg-red-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50" />
                <h2 className="text-[11px] font-black text-red-600 uppercase tracking-[0.3em] flex items-center gap-3 relative z-10">
                    <Shield size={20} className="text-red-500" /> Zona de Peligro
                </h2>
                <div className="space-y-6 relative z-10">
                    <div className="bg-red-50 border border-red-200 p-4 rounded-2xl">
                        <p className="text-[10px] font-bold text-red-700 leading-relaxed uppercase tracking-tight mb-3">
                            ⚠️ RESETEAR PARA PRODUCCIÓN
                        </p>
                        <p className="text-[9px] font-bold text-red-600 leading-relaxed">
                            Esta opción elimina TODOS los datos de prueba y deja la base de datos lista para producción.
                        </p>
                        <ul className="text-[8px] font-bold text-red-500 mt-3 space-y-1 list-disc list-inside">
                            <li>Elimina: Socios, Pagos, Anulaciones, Pausas</li>
                            <li>Mantiene: Operadores, Configuración, Logo</li>
                            <li>Reinicia: Códigos desde 00001</li>
                        </ul>
                    </div>
                    <button 
                        onClick={resetProduccion} 
                        className="w-full bg-red-600 hover:bg-red-700 text-white border border-red-200 font-black p-5 rounded-[2rem] text-[11px] uppercase flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow-xl hover:shadow-red-500/20 active:scale-95"
                    >
                        <Shield size={18} /> Resetear para Producción
                    </button>
                    <p className="text-[8px] font-bold text-red-400 text-center">
                        ⚠️ ACCIÓN IRREVERSIBLE - REQUIERE DOBLE CONFIRMACIÓN
                    </p>
                </div>
            </div>

            {/* Importación Masiva */}
            <div className="bg-white border border-slate-100 p-10 rounded-[3.5rem] space-y-6 shadow-2xl shadow-blue-900/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50" />
                <h2 className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.3em] flex items-center gap-3 relative z-10">
                    <Upload size={20} className="text-indigo-500" /> Importación Masiva
                </h2>
                <div className="space-y-6 relative z-10">
                    <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-tight">
                        Importa una lista grande de socios desde un archivo Excel guardado como <span className="text-slate-600 font-extrabold">.CSV (Delimitado por comas)</span>. Utiliza la plantilla oficial para evitar errores.
                        <br /><span className="text-indigo-500 font-black mt-2 inline-block">⚠️ Formato para 'Inicio de Cobros': AAAA-MM (Ej. 2026-01)</span>
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={downloadCSVTemplate} className="w-full bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-black p-5 rounded-[2rem] text-[11px] uppercase flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow-xl hover:shadow-slate-500/10 active:scale-95">
                            <FileSpreadsheet size={18} /> Descargar Plantilla
                        </button>
                        <label className="w-full cursor-pointer bg-indigo-50 hover:bg-indigo-600 text-indigo-600 hover:text-white border border-indigo-100 font-black p-5 rounded-[2rem] text-[11px] uppercase flex items-center justify-center gap-3 transition-all shadow-sm hover:shadow-xl hover:shadow-indigo-500/20 active:scale-95">
                            {importing ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Upload size={18} />}
                            {importing ? 'Importando...' : 'Subir Archivo CSV'}
                            <input type="file" className="hidden" accept=".csv" onChange={handleCSVUpload} disabled={importing} />
                        </label>
                    </div>
                </div>
            </div>
            
            {/* ── BUG FIX: Toast Notifications ── */}
            <ToastContainer />
        </div >
    );
}
