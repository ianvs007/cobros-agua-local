export const monthNames = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

export const formatPeriodo = (p) => {
    if (!p) return '';
    const pStr = String(p).toUpperCase().replace(/\s+DE\s+/g, ' ').trim();
    if (/^\d{4}-\d{2}$/.test(pStr)) {
        const [yyyy, mm] = pStr.split('-');
        return `${monthNames[parseInt(mm, 10) - 1]} ${yyyy}`;
    }
    return pStr;
};

export const parseToYYYYMM = (p) => {
    if (!p) return "";
    const pStr = String(p).toUpperCase().replace(/\s+DE\s+/g, ' ').trim();
    if (/^\d{4}-\d{2}$/.test(pStr)) return pStr;
    
    const partes = pStr.split(' ');
    if (partes.length === 2) {
        const idx = monthNames.indexOf(partes[0]);
        if (idx !== -1) {
            return `${partes[1]}-${String(idx + 1).padStart(2, '0')}`;
        }
    }
    return pStr;
};
