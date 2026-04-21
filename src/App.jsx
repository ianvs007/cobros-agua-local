import React, { useState, useEffect } from 'react';
import {
  Home,
  Users,
  CircleDollarSign,
  BarChart3,
  Settings,
  LogOut,
  Droplets,
  Menu,
  X,
  Power,
  FileX,
  Clock,
  FileText,
  ShieldOff,
  AlertTriangle
} from 'lucide-react';
import { supabase } from './supabase';
import { cn } from './utils/cn';
import { useToast } from './utils/toast';
import Toast from './utils/toast';
import { verifyPassword } from './utils/crypto';
import { AppProvider } from './contexts/AppContext';
import { verificarSesion, iniciarSesion, cerrarSesion } from './services/session';

// Componentes internos
import Dashboard from './components/Dashboard';
import Usuarios from './components/Usuarios';
import Cobros from './components/Cobros';
import Reportes from './components/Reportes';
import Configuracion from './components/Configuracion';
import AnularRecibos from './components/AnularRecibos';
import PausasCobro from './components/PausasCobro';
import ReporteAnulaciones from './components/ReporteAnulaciones';
import CondonarDeuda from './components/CondonarDeuda';
import ReporteCondonaciones from './components/ReporteCondonaciones';
import UsuariosDeudores from './components/UsuariosDeudores';

export default function App() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [operator, setOperator] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [initialAction, setInitialAction] = useState(null);
  const [errorHeader, setErrorHeader] = useState(null);
  const [loginForm, setLoginForm] = useState({ usuario: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [showPasswordAlert, setShowPasswordAlert] = useState(false);
  
  // ── BUG FIX: Usar Toast en lugar de alert() ──
  const { success, error, warning, info, ToastContainer } = useToast();

  useEffect(() => {
    // Verificar conectividad con el servidor local
    fetch('/api/health').catch(() => {
      setErrorHeader('Error de conexión: No se puede conectar con el servidor local. Asegúrate de que el servidor esté corriendo.');
    });
  }, []);

  useEffect(() => {
    // Mecanismo de Heartbeat para cerrar la terminal si se cierra el navegador
    const hb = setInterval(() => {
      fetch('/api/heartbeat').catch(() => { });
    }, 5000);

    return () => clearInterval(hb);
  }, []);

  if (errorHeader) {
    return (
      <div className="h-screen w-full bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl max-w-sm">
          <h1 className="text-red-500 font-black uppercase text-sm mb-2">Error Crítico</h1>
          <p className="text-slate-400 text-xs font-bold">{errorHeader}</p>
          <button onClick={() => window.location.reload()} className="mt-6 bg-red-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase">Recargar Sistema</button>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'inicio', label: 'Inicio', icon: Home, component: Dashboard },
    { id: 'usuarios', label: 'Usuarios', icon: Users, component: Usuarios, roles: ['ADMINISTRADOR'] },
    { id: 'cobros', label: 'Cobros', icon: CircleDollarSign, component: Cobros, roles: ['OPERADOR'] },
    { id: 'pausas', label: 'Pausas', icon: Clock, component: PausasCobro, roles: ['ADMINISTRADOR'] },
    { id: 'condonar', label: 'Condonar', icon: ShieldOff, component: CondonarDeuda, roles: ['ADMINISTRADOR'] },
    { id: 'anular', label: 'Anular', icon: FileX, component: AnularRecibos, roles: ['ADMINISTRADOR'] },
    { id: 'deudores', label: 'Deudores', icon: AlertTriangle, component: UsuariosDeudores },
    { id: 'reportes', label: 'Reportes', icon: BarChart3, component: Reportes },
    { id: 'reporte-anulaciones', label: 'Rpt. Anulaciones', icon: FileText, component: ReporteAnulaciones, roles: ['ADMINISTRADOR'] },
    { id: 'reporte-condonaciones', label: 'Rpt. Condonaciones', icon: FileText, component: ReporteCondonaciones, roles: ['ADMINISTRADOR'] },
    { id: 'config', label: 'Ajustes', icon: Settings, component: Configuracion, roles: ['ADMINISTRADOR'] },
  ].filter(item => !item.roles || (operator && item.roles.includes(operator.rol)));

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const { data: user, error } = await supabase
        .from('operadores')
        .select('*')
        .eq('usuario', loginForm.usuario.trim())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          setLoginError('Usuario o contraseña incorrectos');
        } else {
          setLoginError('Error de conexión con el servidor');
        }
        return;
      }

      const passwordValid = user ? await verifyPassword(loginForm.password.trim(), user.password) : false;
      if (user && passwordValid) {
        // Verificar si la cuenta esta en uso en otra terminal
        const { ocupado, mensaje } = await verificarSesion(user.usuario);
        if (ocupado) {
          setLoginError(mensaje);
          return;
        }

        // Registrar sesion activa con heartbeat
        await iniciarSesion(user);
        setOperator(user);
        // Alerta si el password es el default (legacy sin hash)
        if (user.usuario === 'admin' && !user.password.includes(':')) {
          setShowPasswordAlert(true);
        }
      } else {
        setLoginError('Usuario o contraseña incorrectos');
      }
    } catch (err) {
      setLoginError('Error al iniciar sesión');
    }
  };


  if (!operator) {
    return (
      <div className="flex-1 bg-water-blank flex flex-col items-center justify-center text-slate-900 p-6 min-h-screen">
        <form onSubmit={handleLogin} className="bg-marine-light p-12 rounded-[3.5rem] shadow-2xl shadow-blue-900/10 border border-white/10 flex flex-col items-center gap-6 max-w-sm w-full relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-black/10 relative z-10 transition-transform group-hover:scale-110">
            <Droplets className="text-marine" size={48} />
          </div>
          <div className="relative z-10 text-center w-full">
            <h1 className="text-5xl font-black uppercase tracking-tighter text-white">SIGUA</h1>
            <p className="text-white/60 font-bold text-[8px] uppercase tracking-wider mt-2 px-4 leading-relaxed">
              Sistema Integral de Gestión de Usuarios de Agua Potable
            </p>
          </div>

          <div className="w-full space-y-4 relative z-10 mt-4">
            <div>
              <label className="text-[10px] font-black text-white/50 ml-1 uppercase tracking-widest">Usuario</label>
              <input
                type="text"
                required
                className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl font-black text-sm text-center uppercase focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20 text-white"
                placeholder="USUARIO"
                value={loginForm.usuario}
                onChange={e => setLoginForm({ ...loginForm, usuario: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-white/50 ml-1 uppercase tracking-widest">Contraseña</label>
              <input
                type="password"
                required
                className="w-full bg-white/10 border border-white/10 p-4 rounded-2xl font-black text-sm text-center focus:outline-none focus:border-white/30 transition-all placeholder:text-white/20 text-white"
                placeholder="••••••"
                value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>
          </div>

          {loginError && <p role="alert" className="text-red-300 font-bold text-[10px] uppercase tracking-widest text-center">{loginError}</p>}

          <button
            type="submit"
            className="w-full bg-white hover:bg-white/90 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-marine shadow-xl transition-all active:scale-95 z-10 mt-2"
          >
            Ingresar
          </button>
          
          <p className="text-white/40 font-black text-[10px] uppercase tracking-[0.2em] mt-4 relative z-10 text-center">
            Sindicato Agrario Taquiña
          </p>
        </form>
      </div>
    );
  }

  const ActiveComponent = menuItems.find(item => item.id === activeTab)?.component || Dashboard;

  return (
    <div className="flex h-screen w-full bg-water-blank text-slate-900 overflow-hidden font-sans">
      {/* Sidebar Fijo con estilo Marine */}
      <aside className={cn(
        "sidebar-bg-marine shadow-[10px_0_30px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col h-full z-20",
        isSidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center gap-3 border-b border-white/5 shrink-0">
          <div className="bg-white/20 p-2 rounded-xl shadow-inner">
            <Droplets className="text-white" size={20} />
          </div>
          {isSidebarOpen && <span className="font-black text-sm tracking-tight text-white uppercase">Sindicato Agua</span>}
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto mt-6 px-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all group",
                activeTab === item.id
                  ? "bg-white text-sidebar-active shadow-xl scale-[1.02]"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon size={20} className={cn(
                "transition-all",
                activeTab === item.id ? "text-sidebar-active" : "group-hover:scale-110 opacity-70 group-hover:opacity-100"
              )} />
              {isSidebarOpen && <span className="font-black text-[11px] uppercase tracking-[0.2em]">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 shrink-0">
          <div className={cn("flex items-center gap-3 p-4 rounded-2xl bg-white/5 mb-4 border border-white/5", !isSidebarOpen && "justify-center")}>
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-[10px] font-black text-white shadow-inner">AD</div>
            {isSidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black truncate text-white uppercase tracking-tight leading-none">{operator.usuario}</span>
                <span className="text-[9px] text-white/30 font-black uppercase tracking-widest mt-1">{operator.rol}</span>
              </div>
            )}
          </div>

          <button
            onClick={async () => {
              if (confirm("¿Desea apagar el sistema y cerrar la ventana?")) {
                await cerrarSesion();
                try {
                  await fetch('/api/shutdown');
                } catch (e) {

                }
                window.close();
                setTimeout(() => {
                  warning("Para cerrar totalmente, por favor cierre esta pestaña manualmente.");
                }, 500);
              }
            }}
            className={cn("w-full flex items-center gap-3 p-4 bg-red-500/10 text-red-100 hover:bg-red-500 hover:text-white rounded-2xl transition-all font-black text-[10px] uppercase tracking-[0.2em] border border-red-500/10", !isSidebarOpen && "justify-center")}
          >
            <Power size={18} />
            {isSidebarOpen && <span>APAGAR SISTEMA</span>}
          </button>
        </div>
      </aside>

      {/* Area Principal Clara */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white/50">
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0 shadow-sm z-10 font-bold">
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-all">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="flex items-center gap-4">
            <button onClick={async () => { await cerrarSesion(); setOperator(null); }} className="flex items-center gap-2 p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all border border-transparent hover:border-red-100">
              <LogOut size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Cerrar Sesión</span>
            </button>
            <div className="w-[1px] h-4 bg-slate-200" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <div className="w-[1px] h-4 bg-slate-200" />
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/50" />
              <span className="text-[9px] font-black uppercase tracking-tighter">Sistema Online</span>
            </div>
          </div>
        </header>

        {showPasswordAlert && (
          <div role="alert" className="bg-amber-100 border-x-0 border-y border-amber-200 p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700">
                <span className="font-black text-xs">!</span>
              </div>
              <div>
                <h3 className="text-[11px] font-black text-amber-800 uppercase tracking-widest">Advertencia de Seguridad</h3>
                <p className="text-[10px] text-amber-700/80 font-bold uppercase tracking-tight">Estás utilizando la contraseña por defecto. Ve a Configuración para cambiarla.</p>
              </div>
            </div>
            <button onClick={() => setShowPasswordAlert(false)} className="text-amber-700 hover:text-amber-900 bg-amber-200/50 hover:bg-amber-200 p-2 rounded-xl transition-all">
              <X size={16} />
            </button>
          </div>
        )}

        <section className="flex-1 overflow-y-auto p-8 bg-water-blank">
          <AppProvider operator={operator} setActiveTab={setActiveTab} initialAction={initialAction} setInitialAction={setInitialAction}>
            <ActiveComponent />
          </AppProvider>
        </section>
      </main>
      

      {/* ── BUG FIX: Toast Notifications Globales ── */}
      <ToastContainer />
    </div>
  );
}
