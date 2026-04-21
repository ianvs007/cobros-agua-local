import { jsPDF } from 'jspdf';
import { numeroALetras } from './letras';
import { supabase } from '../supabase';
import { formatPeriodo, monthNames, parseToYYYYMM } from './formatters';

const n = (v) => {
    const parsed = parseFloat(v);
    return isNaN(parsed) ? 0 : parsed;
};

const CUTOFF_YEAR = 2025;

export const generateReceiptPDF = async (pagos, socio) => {
    try {
        const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: [139.7, 215.9] });
        const { data: configArr } = await supabase.from('configuracion').select('*');
        const config = (configArr || []).reduce((acc, c) => ({ ...acc, [c.key]: c.value }), {});

        const primerPago = pagos[0];
        const ultimoPago = pagos[pagos.length - 1];

        let periodoTexto = "";
        if (pagos.length > 1) {
            // Si son pocos meses (hasta 4), los listamos todos con comas
            if (pagos.length <= 4) {
                periodoTexto = pagos.map(p => formatPeriodo(p.periodo)).join(", ");
            } else {
                // Si son muchos, mostramos el rango para no desbordar el diseño
                periodoTexto = `${formatPeriodo(primerPago.periodo)} HASTA ${formatPeriodo(ultimoPago.periodo)}`;
            }
        } else {
            periodoTexto = formatPeriodo(primerPago.periodo);
        }

        const montoCobrable = pagos.reduce((acc, p) => acc + n(p.monto), 0);

        // Encabezado
        doc.setTextColor(15, 23, 42);
        if (config.logo_b64) {
            try { doc.addImage(config.logo_b64, 'PNG', 10, 5, 20, 15); } catch (e) { }
        }
        doc.setFontSize(10); doc.text(config.razon_social || "SINDICATO TAQUIÑA", 32, 10);
        // Usar datos de afiliación configurables
        doc.setFontSize(7); doc.text(config.datos_afiliacion || "", 32, 14, { maxWidth: 100 });

        doc.setFontSize(14); doc.setTextColor(20, 50, 150);
        doc.text("RECIBO DE APORTE DE AGUA", 108, 25, { align: 'center' });

        doc.setTextColor(180, 0, 0); doc.setFontSize(11);
        doc.text("Nro. " + String(primerPago.correlativo).padStart(6, '0'), 205, 15, { align: 'right' });

        // Datos Principales
        doc.setTextColor(30, 41, 59); doc.setFontSize(10);
        doc.text("Usuario: " + (socio.nombre || "DESCONOCIDO"), 10, 33);

        let valorTanque = socio.tanque;
        if (valorTanque === undefined || valorTanque === null || valorTanque === '') {
            valorTanque = 'S/D';
        }
        let textoTanque = "Tanque/ramal: " + valorTanque;
        if (textoTanque.length > 30) textoTanque = textoTanque.substring(0, 27) + '...';
        doc.text(textoTanque, 205, 33, { align: 'right' });

        doc.setFontSize(9);
        doc.text("Aporte por: " + periodoTexto, 10, 39, { maxWidth: 195 });
        doc.line(10, 43, 205, 43);

        // Tabla de Conceptos
        const startY = 50;
        doc.setFontSize(9); doc.setFont(undefined, 'bold');
        doc.text("CONCEPTO", 15, startY); doc.text("IMPORTE (Bs.)", 100, startY, { align: 'right' });
        doc.setFont(undefined, 'normal');
        doc.line(10, startY + 2, 105, startY + 2);

        const items = [
            ["Aporte Voluntario", n(primerPago.cuota_ingreso)],
            ["Conexión e Instalación", n(primerPago.conexion)],
            ["Consumo Agua (" + pagos.length + " Meses)", n(primerPago.consumo_agua) * pagos.length],
            ["Protección de Vertientes", n(primerPago.proteccion)],
            ["Multa por Mora", n(primerPago.multa)],
            ["Falta a Asambleas y Trabajos", n(primerPago.asambleas)]
        ];

        items.forEach((item, i) => {
            const y = startY + 8 + (i * 7);
            doc.text(item[0], 15, y);
            doc.text(item[1].toFixed(2), 100, y, { align: 'right' });
            doc.setDrawColor(220); doc.line(10, y + 2, 105, y + 2);
        });

        // Totales e Información
        doc.setDrawColor(0); doc.setFont(undefined, 'bold');
        doc.setFontSize(10);
        const totalY = 110;
        doc.text("Total Bs.", 75, totalY);
        doc.setFillColor(240); doc.rect(90, totalY - 5, 20, 7, 'F');
        doc.text(montoCobrable.toFixed(2), 108, totalY, { align: 'right' });

        doc.setFontSize(9);
        doc.text("Son: " + numeroALetras(montoCobrable), 10, 122);
        
        // BUG FIX #9: Sanitizar observaciones para evitar XSS en PDF
        const observacionesSanitizadas = (primerPago.observaciones || '')
            .replace(/[<>]/g, '') // Eliminar caracteres de HTML
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, ''); // Eliminar caracteres de control
        doc.setFontSize(7); doc.text("Obs: " + observacionesSanitizadas, 10, 128, { maxWidth: 110 });

        // Tabla de Periodos Detallada (zona derecha: x=110 a x=205)
        const detX = 112;       // Inicio de la columna izquierda (labels)
        const detMontoX = 205;  // Alineacion derecha del monto
        const detMaxLabel = 60; // Ancho maximo del label en mm antes de truncar
        const pySection = 50;
        doc.setFontSize(8); doc.setFont(undefined, 'bold');
        doc.text("DETALLE DE PERIODOS", detX, pySection);
        doc.setDrawColor(180); doc.line(detX, pySection + 1, detMontoX, pySection + 1);
        doc.setFont(undefined, 'normal'); doc.setFontSize(7);

        // Agrupación de Periodos
        const lineItems = [];
        const groupedByYear = {};
        const currentSystemYear = new Date().getFullYear();

        pagos.forEach(p => {
            const normalized = parseToYYYYMM(p.periodo);
            if (!/^\d{4}-\d{2}$/.test(normalized)) {
                lineItems.push({ label: "• " + formatPeriodo(p.periodo), amount: n(p.consumo_agua) });
                return;
            }

            const [yearStr, monthStr] = normalized.split('-');
            const year = parseInt(yearStr, 10);
            const monthIdx = parseInt(monthStr, 10) - 1;

            if (year > CUTOFF_YEAR) {
                const monthName = monthNames[monthIdx];
                const label = year === currentSystemYear ? monthName : `${monthName} ${year}`;
                lineItems.push({ label: "• " + label, amount: n(p.consumo_agua) });
            } else {
                const yearKey = String(year);
                if (!groupedByYear[yearKey]) groupedByYear[yearKey] = [];
                groupedByYear[yearKey].push({ ...p, normalizedM: monthIdx });
            }
        });

        const pastYears = Object.keys(groupedByYear).sort();
        const groupedItems = pastYears.map(year => {
            const yearPayments = groupedByYear[year].sort((a, b) => a.normalizedM - b.normalizedM);
            const monthIndices = yearPayments.map(yp => yp.normalizedM);

            let monthLabel = "";
            const isContiguous = monthIndices.length > 1 &&
                                monthIndices.every((val, i) => i === 0 || val === monthIndices[i-1] + 1);

            if (monthIndices.length === 12) {
                monthLabel = "(ENE-DIC)";
            } else if (isContiguous) {
                // Usar abreviaturas para meses en agrupaciones para ahorrar espacio
                const abrev = (idx) => monthNames[idx].substring(0, 3);
                monthLabel = `(${abrev(monthIndices[0])}-${abrev(monthIndices[monthIndices.length - 1])})`;
            } else {
                const names = monthIndices.map(idx => monthNames[idx].substring(0, 3));
                monthLabel = `(${names.join(', ')})`;
            }

            const label = `• GEST. ${year} ${monthLabel}`;
            const amount = yearPayments.reduce((acc, current) => acc + n(current.consumo_agua), 0);
            return { label, amount };
        });

        const finalList = [...groupedItems, ...lineItems];

        finalList.forEach((item, i) => {
            const rowY = pySection + 5 + (i * 4.5);
            if (rowY < 125) {
                // Truncar label dinámicamente si excede el espacio disponible
                let label = item.label;
                while (doc.getTextWidth(label) > detMaxLabel && label.length > 5) {
                    label = label.slice(0, -3) + '..';
                }
                doc.text(label, detX, rowY);
                doc.text("Bs. " + item.amount.toFixed(2), detMontoX, rowY, { align: 'right' });
            }
        });

        // Firmas
        const signY = 135;
        doc.setDrawColor(0);
        doc.line(115, signY, 150, signY);
        doc.setFontSize(7); doc.text("FIRMA INTERESADO", 132.5, signY + 4, { align: 'center' });

        doc.line(165, signY, 200, signY);
        doc.setFontSize(7); doc.text("STRIO. HACIENDA", 182.5, signY + 4, { align: 'center' });

        doc.save(`Recibo_${primerPago.correlativo}.pdf`);
    } catch (e) {
        console.error("Error al generar PDF:", e);
        throw e;
    }
};

export const generateArqueoPDF = async (data, resumen, filtro, mode) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const { data: configArr } = await supabase.from('configuracion').select('*');
        const config = (configArr || []).reduce((acc, c) => ({ ...acc, [c.key]: c.value }), {});

        // Encabezado
        if (config.logo_b64) {
            try { doc.addImage(config.logo_b64, 'PNG', 10, 10, 25, 18); } catch (e) { }
        }
        doc.setFontSize(11); doc.setFont(undefined, 'bold');
        doc.text(config.razon_social || "SINDICATO TAQUIÑA", 40, 15);
        doc.setFontSize(8); doc.setFont(undefined, 'normal');
        doc.text(config.datos_afiliacion || "", 40, 20, { maxWidth: 100 });

        doc.setFontSize(14); doc.setFont(undefined, 'bold');
        doc.text("ARQUEO DE CAJA - REPORTE " + mode.toUpperCase(), 105, 35, { align: 'center' });
        doc.setFontSize(10);
        doc.text("Periodo: " + filtro, 105, 42, { align: 'center' });
        
        doc.line(10, 45, 200, 45);

        let startY = 55;
        doc.setFontSize(9);
        
        if (mode === 'diario') {
            // Tabla Detallada
            doc.setFont(undefined, 'bold');
            doc.text("Nro. Recibo", 12, startY);
            doc.text("Socio", 40, startY);
            doc.text("Periodo(s)", 110, startY);
            doc.text("Importe (Bs.)", 195, startY, { align: 'right' });
            doc.line(10, startY + 2, 200, startY + 2);
            doc.setFont(undefined, 'normal');

            data.forEach((item, i) => {
                const y = startY + 8 + (i * 7);
                // Si llegamos al final de la página, añadir nueva
                if (y > 270) {
                    doc.addPage();
                    startY = 20 - 8; // Reset startY
                }
                const currentRowY = startY + 8 + (i * 7);
                doc.text(String(item.correlativo).padStart(6, '0'), 12, currentRowY);
                doc.text(item.socio_nombre || "S/N", 40, currentRowY, { maxWidth: 65 });
                doc.text(item.periodo || "N/A", 110, currentRowY, { maxWidth: 50 });
                doc.text(parseFloat(item.monto).toFixed(2), 195, currentRowY, { align: 'right' });
                doc.setDrawColor(230);
                doc.line(10, currentRowY + 2, 200, currentRowY + 2);
            });
        } else {
            // Tabla Agrupada (Mensual o Anual)
            doc.setFont(undefined, 'bold');
            doc.text(mode === 'mensual' ? "Día" : "Mes", 15, startY);
            doc.text("Total Recaudado (Bs.)", 195, startY, { align: 'right' });
            doc.line(10, startY + 2, 200, startY + 2);
            doc.setFont(undefined, 'normal');

            data.forEach((item, i) => {
                const y = startY + 8 + (i * 7);
                if (y > 270) {
                    doc.addPage();
                    startY = 20 - 8;
                }
                const currentRowY = startY + 8 + (i * 7);
                doc.text(item.label, 15, currentRowY);
                doc.text(item.total.toFixed(2), 195, currentRowY, { align: 'right' });
                doc.setDrawColor(230);
                doc.line(10, currentRowY + 2, 200, currentRowY + 2);
            });
        }

        // Resumen Final
        const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : doc.internal.pageSize.height - 40;
        doc.setDrawColor(0);
        doc.line(10, finalY - 5, 200, finalY - 5);
        doc.setFontSize(11); doc.setFont(undefined, 'bold');
        doc.text("TOTAL RECAUDADO:", 115, finalY);
        doc.text("Bs. " + resumen.total.toFixed(2), 195, finalY, { align: 'right' });
        doc.setFontSize(9); doc.setFont(undefined, 'normal');
        doc.text("CANTIDAD DE RECIBOS/MOVIMIENTOS: " + resumen.count, 115, finalY + 7);

        // Firmas
        const signY = doc.internal.pageSize.height - 20;
        doc.line(40, signY, 80, signY);
        doc.text("FIRMA RESPONSABLE", 60, signY + 5, { align: 'center' });
        doc.line(130, signY, 170, signY);
        doc.text("STRIO. HACIENDA", 150, signY + 5, { align: 'center' });

        doc.save(`Reporte_${mode}_${filtro.replace(/\//g, '-')}.pdf`);
    } catch (e) {
        console.error("Error generating Arqueo PDF:", e);
    }
};

export const generatePauseCertificatePDF = async (pausa, socio) => {
    try {
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'letter' });
        const { data: configArr } = await supabase.from('configuracion').select('*');
        const config = (configArr || []).reduce((acc, c) => ({ ...acc, [c.key]: c.value }), {});

        // Encabezado
        if (config.logo_b64) {
            try { doc.addImage(config.logo_b64, 'PNG', 15, 10, 25, 18); } catch (e) { }
        }
        doc.setFontSize(12); doc.setFont(undefined, 'bold');
        doc.text(config.razon_social || "SINDICATO TAQUIÑA", 45, 18);
        doc.setFontSize(8); doc.setFont(undefined, 'normal');
        doc.text(config.datos_afiliacion || "", 45, 23, { maxWidth: 120 });

        doc.setFontSize(16); doc.setFont(undefined, 'bold'); doc.setTextColor(100, 50, 150);
        doc.text("CERTIFICADO DE PAUSA DE COBROS", 105, 42, { align: 'center' });

        doc.setDrawColor(100, 50, 150); doc.setLineWidth(0.5);
        doc.line(20, 46, 190, 46);

        // Datos del socio
        doc.setTextColor(30, 41, 59); doc.setFont(undefined, 'bold');
        doc.setFontSize(11);
        doc.text("DATOS DEL SOCIO", 20, 68);
        doc.setFont(undefined, 'normal'); doc.setFontSize(10);
        doc.line(20, 70, 190, 70);

        const socioData = [
            ["Nombre:", socio.nombre || 'S/D'],
            ["CI:", socio.ci || 'S/D'],
            ["Codigo:", socio.codigo || 'S/D'],
            ["Tanque/Ramal:", socio.tanque || 'S/D'],
            ["Tarifa Mensual:", `Bs ${socio.tarifa || 10}`]
        ];
        socioData.forEach((row, i) => {
            const y = 78 + (i * 7);
            doc.setFont(undefined, 'bold'); doc.text(row[0], 25, y);
            doc.setFont(undefined, 'normal'); doc.text(row[1], 70, y);
        });

        // Datos de la pausa
        doc.setFont(undefined, 'bold'); doc.setFontSize(11);
        doc.text("DETALLE DE LA PAUSA", 20, 118);
        doc.line(20, 120, 190, 120);
        doc.setFont(undefined, 'normal'); doc.setFontSize(10);

        const inicio = new Date(pausa.fecha_inicio + 'T00:00:00');
        const fin = new Date(pausa.fecha_fin + 'T23:59:59');
        const dias = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;

        const TIPOS = { SIN_AGUA: 'Sin Agua', VIAJE: 'Viaje', SALUD: 'Salud', OTRO: 'Otro' };

        const pausaData = [
            ["Tipo de Pausa:", TIPOS[pausa.tipo_pausa] || pausa.tipo_pausa],
            ["Fecha de Inicio:", inicio.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
            ["Fecha de Fin:", fin.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
            ["Duracion:", `${dias} dia(s)`],
            ["Motivo:", pausa.motivo || 'S/D'],
            ["Autorizado por:", pausa.responsable_autoriza || 'S/D'],
            ["Fecha Autorizacion:", pausa.fecha_autorizacion ? new Date(pausa.fecha_autorizacion).toLocaleDateString('es-ES') : 'S/D'],
            ["Observaciones:", pausa.observaciones || 'Ninguna']
        ];
        pausaData.forEach((row, i) => {
            const y = 128 + (i * 8);
            doc.setFont(undefined, 'bold'); doc.text(row[0], 25, y);
            doc.setFont(undefined, 'normal'); doc.text(String(row[1]), 75, y, { maxWidth: 110 });
        });

        // Meses afectados
        const mesesAfectados = [];
        let curDate = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
        const finMes = new Date(fin.getFullYear(), fin.getMonth(), 1);
        while (curDate <= finMes) {
            mesesAfectados.push(monthNames[curDate.getMonth()] + ' ' + curDate.getFullYear());
            curDate.setMonth(curDate.getMonth() + 1);
        }

        const mesY = 200;
        doc.setFont(undefined, 'bold'); doc.setFontSize(11);
        doc.text("MESES SUSPENDIDOS POR PAUSA", 20, mesY);
        doc.line(20, mesY + 2, 190, mesY + 2);
        doc.setFont(undefined, 'normal'); doc.setFontSize(10);

        doc.setFillColor(245, 240, 255);
        doc.roundedRect(20, mesY + 5, 170, 8 + (Math.ceil(mesesAfectados.length / 4) * 8), 3, 3, 'F');

        mesesAfectados.forEach((mes, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            doc.text("- " + mes, 25 + (col * 42), mesY + 12 + (row * 8));
        });

        // Nota legal
        const notaY = mesY + 20 + (Math.ceil(mesesAfectados.length / 4) * 8);
        doc.setFontSize(8); doc.setFont(undefined, 'italic');
        doc.setTextColor(100, 100, 100);
        doc.text("Los meses indicados quedan suspendidos del cobro de tarifa de agua de forma definitiva.", 20, notaY, { maxWidth: 170 });
        doc.text("Este certificado es un documento de respaldo para el socio y la organizacion.", 20, notaY + 5, { maxWidth: 170 });

        // Firmas
        const signY = 265;
        doc.setTextColor(30, 41, 59); doc.setFont(undefined, 'normal'); doc.setFontSize(8);
        doc.line(30, signY, 80, signY);
        doc.text("FIRMA INTERESADO", 55, signY + 5, { align: 'center' });
        doc.line(120, signY, 180, signY);
        doc.text("STRIO. HACIENDA", 150, signY + 5, { align: 'center' });

        doc.save(`Pausa_${socio.codigo || socio.id}_${pausa.fecha_inicio}.pdf`);
    } catch (e) {
        console.error("Error al generar PDF de pausa:", e);
        throw e;
    }
};
