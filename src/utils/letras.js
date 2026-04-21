export function numeroALetras(num) {
    if (isNaN(num) || num === null || num === undefined) return "CERO 00/100 BOLIVIANOS";

    const unidades = ['CERO', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = {
        11: 'ONCE', 12: 'DOCE', 13: 'TRECE', 14: 'CATORCE', 15: 'QUINCE',
        16: 'DIECISÉIS', 17: 'DIECISIETE', 18: 'DIECIOCHO', 19: 'DIECINUEVE',
        21: 'VEINTIUNO', 22: 'VEINTIDÓS', 23: 'VEINTITRÉS', 24: 'VEINTICUATRO', 25: 'VEINTICINCO',
        26: 'VEINTISÉIS', 27: 'VEINTISIETE', 28: 'VEINTIOCHO', 29: 'VEINTINUEVE'
    };
    const centenas = ['CIEN', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    function convertir(n) {
        if (n < 10) return unidades[n];
        if (n >= 11 && n <= 29) return especiales[n] || '';
        if (n < 100) {
            const d = Math.floor(n / 10);
            const u = n % 10;
            return decenas[d - 1] + (u > 0 ? ' Y ' + unidades[u] : '');
        }
        if (n === 100) return 'CIEN';
        if (n < 1000) {
            const c = Math.floor(n / 100);
            const resto = n % 100;
            return (c === 1 ? 'CIENTO' : centenas[c - 1]) + (resto > 0 ? ' ' + convertir(resto) : '');
        }
        if (n < 1000000) {
            const m = Math.floor(n / 1000);
            const resto = n % 1000;
            let mStr = m === 1 ? 'MIL' : convertir(m) + ' MIL';
            return mStr + (resto > 0 ? ' ' + convertir(resto) : '');
        }
        return String(n);
    }

    let entero = Math.floor(num);
    let decimales = Math.round((num - entero) * 100);

    if (decimales === 100) {
        entero += 1;
        decimales = 0;
    }

    const centavos = String(decimales).padStart(2, '0') + '/100 BOLIVIANOS';

    if (entero === 0) return 'CERO ' + centavos;
    return convertir(entero) + ' ' + centavos;
}
