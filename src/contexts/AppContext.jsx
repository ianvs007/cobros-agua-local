import React, { createContext, useContext } from 'react';

const AppContext = createContext(null);

export function AppProvider({ children, operator, setActiveTab, initialAction, setInitialAction }) {
    return (
        <AppContext.Provider value={{ operator, setActiveTab, initialAction, setInitialAction }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp debe usarse dentro de <AppProvider>');
    return ctx;
}
