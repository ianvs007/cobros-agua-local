/**
 * Calcula la mora real de un socio (meses vencidos no pagados).
 * @param {string} inicio_cobro Formato 'YYYY-MM'
 * @param {Array} pagos Lista de pagos del socio
 * @param {number} tarifa Monto de la tarifa por mes
 * @param {Array} pausas Lista de pausas activas del socio (opcional)
 * @param {Array} condonaciones Lista de condonaciones del socio (opcional)
 * @returns {Object} { deuda, mesesPendientes, pagoSugerido, mesesEnPausa, mesesCondonados, hayPausaActiva, hayCondonaciones }
 */
import { monthNames, parseToYYYYMM } from './formatters';

const MESES_ES_ORDEN = monthNames;

/**
 * Normaliza un periodo (sea YYYY-MM o "MES AÑO") a un formato YYYY-MM estándar.
 */
const normalizarAYYYYMM = parseToYYYYMM;

/**
 * Convierte YYYY-MM a "MES AÑO"
 */
const toLegible = (yyyyMM) => {
    if (!/^\d{4}-\d{2}$/.test(yyyyMM)) return yyyyMM;
    const [y, m] = yyyyMM.split('-');
    return `${MESES_ES_ORDEN[parseInt(m, 10) - 1]} ${y}`;
};

/**
 * Calcula la mora real de un socio (meses vencidos no pagados).
 */
export const calcularMoraSocio = (inicio_cobro, pagos, tarifa = 10, pausas = [], condonaciones = []) => {
    const now = new Date();
    const hoyYYYYMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Normalizar inicio_cobro por si viene en formato texto
    const inicioNormalizado = normalizarAYYYYMM(inicio_cobro || '2026-01');
    const [startYear, startMonth] = (inicioNormalizado.split('-')).map(Number);
    
    // 1. Generar todos los periodos YYYY-MM desde el inicio hasta hoy (inclusive)
    const periodosTranscurridos = [];
    if (!isNaN(startYear) && !isNaN(startMonth)) {
        let curY = startYear;
        let curM = startMonth;

        while (true) {
            const curYYYYMM = `${curY}-${String(curM).padStart(2, '0')}`;
            periodosTranscurridos.push(curYYYYMM);
            
            if (curYYYYMM === hoyYYYYMM || curYYYYMM > hoyYYYYMM) break;
            
            curM++;
            if (curM > 12) {
                curM = 1;
                curY++;
            }
        }
    }

    // 2. Normalizar Pagos y Pausas a YYYY-MM
    const pagadosSet = new Set((pagos || []).map(p => normalizarAYYYYMM(p.periodo)).filter(Boolean));
    
    const mesesEnPausaYYYYMM = [];
    if (pausas && pausas.length > 0) {
        periodosTranscurridos.forEach(periodo => {
            const [anio, mesIndex1] = periodo.split('-').map(Number);
            const fechaMesInicio = new Date(anio, mesIndex1 - 1, 1, 0, 0, 0);
            const fechaMesFin = new Date(anio, mesIndex1, 0, 23, 59, 59);

            const enPausa = pausas.some(p => {
                if (!p.fecha_inicio || !p.fecha_fin) return false;
                // Pausas ACTIVA y FINALIZADA excluyen meses permanentemente
                if (p.estado !== 'ACTIVA' && p.estado !== 'FINALIZADA') return false;
                const inicioPausa = new Date(p.fecha_inicio + 'T00:00:00');
                const finPausa = new Date(p.fecha_fin + 'T23:59:59');
                return (inicioPausa <= fechaMesFin) && (finPausa >= fechaMesInicio);
            });

            if (enPausa) mesesEnPausaYYYYMM.push(periodo);
        });
    }
    const pausasSet = new Set(mesesEnPausaYYYYMM);

    // 2b. Normalizar Condonaciones a YYYY-MM
    const mesesCondonadosYYYYMM = (condonaciones || [])
        .map(c => normalizarAYYYYMM(c.periodo))
        .filter(Boolean);
    const condonacionesSet = new Set(mesesCondonadosYYYYMM);

    // 3. Calcular Pendientes (YYYY-MM que no están en pagos, pausas ni condonaciones)
    const pendientesYYYYMM = periodosTranscurridos.filter(p => !pagadosSet.has(p) && !pausasSet.has(p) && !condonacionesSet.has(p));

    // 4. Mora Real: solo los meses ANTERIORES al actual (el actual es deuda pero no mora vencida para bloqueo)
    // Opcional: si el cliente quiere que el actual TAMBIÉN cuente como mora, quitar el -1
    const debeMesActual = pendientesYYYYMM.includes(hoyYYYYMM);
    const moraReal = debeMesActual ? Math.max(0, pendientesYYYYMM.length - 1) : pendientesYYYYMM.length;

    // 5. Formatear para retorno (Legibles para la UI)
    const pendientesLegibles = pendientesYYYYMM.map(toLegible);
    const pausasLegibles = mesesEnPausaYYYYMM.map(toLegible);
    const condonadosLegibles = mesesCondonadosYYYYMM.map(toLegible);

    // Pago Sugerido: el primer pendiente, o el siguiente mes si está al día
    let sugerido = pendientesLegibles.length > 0 ? pendientesLegibles[0] : "";
    if (!sugerido) {
        const [hY, hM] = hoyYYYYMM.split('-').map(Number);
        let nextM = hM + 1;
        let nextY = hY;
        if (nextM > 12) { nextM = 1; nextY++; }
        sugerido = `${MESES_ES_ORDEN[nextM - 1]} ${nextY}`;
    }

    // hayPausaActiva: tiene pausas que cubren periodos (activas o finalizadas)
    const hayPausaActiva = (pausas || []).some(p => p.estado === 'ACTIVA');
    const hayCondonaciones = mesesCondonadosYYYYMM.length > 0;

    return {
        deuda: moraReal,
        mesesPendientes: pendientesLegibles,
        mesesEnPausa: pausasLegibles,
        mesesCondonados: condonadosLegibles,
        pagoSugerido: sugerido,
        hayPausaActiva,
        hayCondonaciones
    };
};

/**
 * Verifica si un periodo específico está en pausa.
 * Usa la misma lógica de superposición que calcularMoraSocio para consistencia.
 * @param {string} periodo Formato "ENERO 2026" o "YYYY-MM"
 * @param {Array} pausas Lista de pausas del usuario
 * @returns {boolean}
 */
export const periodoEnPausa = (periodo, pausas = []) => {
    if (!pausas || pausas.length === 0) return false;
    
    // Normalizar el periodo a YYYY-MM
    const periodoYYYYMM = normalizarAYYYYMM(periodo);
    if (!periodoYYYYMM) return false;

    const [anio, mesIndex1] = periodoYYYYMM.split('-').map(Number);
    const fechaMesInicio = new Date(anio, mesIndex1 - 1, 1, 0, 0, 0);
    const fechaMesFin = new Date(anio, mesIndex1, 0, 23, 59, 59); // último día del mes

    return pausas.some(p => {
        if (!p.fecha_inicio || !p.fecha_fin) return false;
        if (p.estado !== 'ACTIVA' && p.estado !== 'FINALIZADA') return false;
        const inicioPausa = new Date(p.fecha_inicio + 'T00:00:00');
        const finPausa = new Date(p.fecha_fin + 'T23:59:59');
        return (inicioPausa <= fechaMesFin) && (finPausa >= fechaMesInicio);
    });
};
