import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, AlertTriangle, X } from 'lucide-react';

/**
 * Toast Notification Component
 */
const Toast = ({ message, type = 'info', onClose, duration = 4000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [onClose, duration]);

    const styles = {
        success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        error: 'bg-red-50 border-red-200 text-red-800',
        warning: 'bg-amber-50 border-amber-200 text-amber-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800'
    };

    const icons = {
        success: <CheckCircle size={18} className="text-emerald-600" />,
        error: <XCircle size={18} className="text-red-600" />,
        warning: <AlertTriangle size={18} className="text-amber-600" />,
        info: <AlertCircle size={18} className="text-blue-600" />
    };

    return (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg ${styles[type]} animate-slide-in max-w-sm`}>
            <div className="flex-shrink-0 mt-0.5">
                {icons[type]}
            </div>
            <p className="flex-1 text-sm font-medium leading-relaxed whitespace-pre-line">{message}</p>
            <button
                onClick={onClose}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
                <X size={16} />
            </button>
        </div>
    );
};

/**
 * Hook para mostrar notificaciones toast
 */
export const useToast = () => {
    const [toasts, setToasts] = React.useState([]);

    const addToast = (message, type = 'info', duration = 4000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, duration }]);
        return id;
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const success = (message, duration) => addToast(message, 'success', duration);
    const error = (message, duration) => addToast(message, 'error', duration);
    const warning = (message, duration) => addToast(message, 'warning', duration);
    const info = (message, duration) => addToast(message, 'info', duration);

    const ToastContainer = () => (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
            {toasts.map(toast => (
                <Toast
                    key={toast.id}
                    message={toast.message}
                    type={toast.type}
                    duration={toast.duration}
                    onClose={() => removeToast(toast.id)}
                />
            ))}
        </div>
    );

    return { addToast, success, error, warning, info, ToastContainer };
};

export default Toast;
