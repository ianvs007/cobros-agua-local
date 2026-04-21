# 📘 Manual de Funcionalidades Avanzadas - Cobros Agua

## 📋 Índice

1. [Anulación de Recibos](#-anulación-de-recibos)
2. [Pausa de Cobros](#-pausa-de-cobros)
3. [Consideraciones Contables y Auditoría](#-consideraciones-contables-y-auditoría)
4. [Preguntas Frecuentes](#-preguntas-frecuentes)

---

## 🚫 Anulación de Recibos

### ¿Cuándo usar esta función?

La anulación de recibos debe utilizarse en los siguientes casos:

- **Error en digitación**: Se cobró un monto incorrecto
- **Pago duplicado**: El usuario pagó dos veces el mismo periodo
- **Error en el periodo**: Se aplicó el pago al mes equivocado
- **Solicitud del usuario**: El usuario solicita la anulación por algún motivo válido

### ⚠️ Importante - Proceso Irreversible

- **El recibo anulado NO se puede recuperar**
- **El número de correlativo NUNCA se reutiliza**
- **Queda registrado en auditoría con motivo y responsable**
- **El usuario volverá a aparecer como deudor del periodo anulado**

### 📝 Pasos para Anular un Recibo

1. **Navegar al módulo** "Anular Recibos" (solo ADMINISTRADOR)
2. **Buscar el recibo** por nombre, CI o código del usuario
3. **Seleccionar el recibo** a anular de la lista
4. **Confirmar la anulación**
5. **Seleccionar el motivo** de la anulación:
   - Error en digitación del recibo
   - Pago duplicado
   - Error en el monto cobrado
   - Error en el periodo
   - Solicitud del usuario
   - Otro
6. **Agregar observaciones** (opcional pero recomendado)
7. **Confirmar** la anulación

### 📊 Registro de Auditoría

Cada anulación genera un registro en la tabla `anulaciones` con:

| Campo | Descripción |
|-------|-------------|
| `pago_id` | ID del pago original |
| `correlativo` | Número de recibo (NUNCA se reutiliza) |
| `periodo` | Periodo que fue pagado y ahora se anula |
| `monto_anulado` | Monto total del recibo |
| `motivo` | Motivo seleccionado |
| `responsable_anulacion` | Usuario que realizó la anulación |
| `fecha_anulacion` | Fecha y hora exacta |
| `observaciones` | Detalles adicionales |

### 🔍 Reporte de Recibos Anulados

Para consultar el historial de anulaciones, ejecutar en Supabase:

```sql
SELECT * FROM v_recibos_anulados ORDER BY fecha_anulacion DESC;
```

---

## ⏸️ Pausa de Cobros

### ¿Cuándo usar esta función?

La pausa de cobros se utiliza para suspender temporalmente la facturación cuando:

- **🚫 Sin Agua**: El usuario no recibió el servicio por un periodo
- **✈️ Viaje**: El usuario estará ausente temporalmente
- **🏥 Salud**: Problemas médicos que impiden el pago o uso
- **📝 Otro**: Cualquier otra situación justificada

### 📋 Características

- **No genera deuda** durante el periodo de pausa
- **Fechas definidas**: Inicio y fin específicas
- **Máximo 180 días** (6 meses) por pausa
- **Registro de auditoría** con responsable que autoriza
- **Reanudación automática** al vencer la fecha de fin
- **Reanudación anticipada** manual si es necesario

### 📝 Pasos para Crear una Pausa

1. **Navegar al módulo** "Pausas" (solo ADMINISTRADOR)
2. **Buscar el usuario** por nombre, CI o código
3. **Verificar** que no tenga una pausa activa
4. **Seleccionar** el usuario
5. **Completar el formulario**:
   - Fecha de inicio
   - Fecha de fin (máximo 180 días)
   - Tipo de pausa (Sin Agua, Viaje, Salud, Otro)
   - Motivo detallado
   - Observaciones (opcional)
6. **Crear la pausa**

### 🔄 Finalizar Pausa Anticipadamente

1. Ubicar la pausa en la lista de "Pausas Activas"
2. Click en "Finalizar Pausa"
3. Confirmar la acción

### 📊 Registro de Pausas

Cada pausa genera un registro en la tabla `pausas_cobro` con:

| Campo | Descripción |
|-------|-------------|
| `usuario_id` | Usuario beneficiado |
| `fecha_inicio` | Inicio de la pausa |
| `fecha_fin` | Fin de la pausa |
| `tipo_pausa` | VIAJE, SALUD, SIN_AGUA, OTRO |
| `motivo` | Descripción detallada |
| `responsable_autoriza` | Administrador que autoriza |
| `estado` | ACTIVA, FINALIZADA, CANCELADA |

### 🔍 Consultar Pausas Activas

```sql
SELECT * FROM v_pausas_activas ORDER BY fecha_fin ASC;
```

### 💡 Ejemplo de Uso

**Caso**: El socio "Juan Perez" viajará por 3 meses (MARZO, ABRIL, MAYO 2026)

1. Crear pausa:
   - Fecha inicio: 2026-03-01
   - Fecha fin: 2026-05-31
   - Tipo: VIAJE
   - Motivo: "Viaje al extranjero por motivos laborales"

2. Durante la pausa:
   - El sistema NO calculará deuda para MARZO, ABRIL, MAYO
   - En el módulo de Cobros, estos meses aparecerán como "en pausa"
   - No se podrá cobrar estos periodos

3. Al finalizar (2026-06-01):
   - La pausa se marca automáticamente como "FINALIZADA"
   - El sistema vuelve a calcular deuda desde JUNIO 2026

---

## 📊 Consideraciones Contables y Auditoría

### Integridad de Datos

1. **Correlativos consecutivos**: Los números de recibo NUNCA se reutilizan, manteniendo la integridad de la secuencia contable.

2. **Auditoría completa**: Toda anulación queda registrada con:
   - Responsable
   - Motivo
   - Fecha y hora exacta
   - Monto afectado

3. **Trazabilidad**: Se puede rastrear el historial completo de cualquier recibo o usuario.

### Impacto en Reportes

- **Recibos anulados** NO se incluyen en los totales de recaudación
- **Periodos en pausa** NO aparecen como deuda pendiente
- **Reportes mensuales** muestran separadamente:
  - Recibos emitidos
  - Recibos anulados
  - Periodos en pausa

### Backup y Recuperación

- Las tablas `anulaciones` y `pausas_cobro` se incluyen en el backup automático
- Se recomienda exportar mensualmente el reporte de anulaciones

---

## ❓ Preguntas Frecuentes

### ¿Puedo revertir una anulación?

**No.** La anulación es irreversible por diseño. Si se necesita corregir, se debe crear un nuevo recibo con el correlativo siguiente.

### ¿Qué pasa si me equivoco al crear una pausa?

Puedes finalizar la pausa anticipadamente desde el módulo "Pausas" y crear una nueva con las fechas correctas.

### ¿Los periodos en pausa aparecen en el historial del usuario?

Sí, quedan registrados en el historial pero marcados como "en pausa" para diferenciarlos de los periodos impagos.

### ¿Puedo poner una pausa a todos los usuarios de un tanque?

No, las pausas son individuales. Debe crear una pausa por cada usuario afectado.

### ¿Hay límite de pausas por usuario?

No hay límite, pero cada pausa individual no puede exceder los 180 días.

### ¿Quién puede anular recibos?

Solo los usuarios con rol **ADMINISTRADOR** pueden acceder al módulo de anulación.

### ¿Quién puede crear pausas?

Solo los usuarios con rol **ADMINISTRADOR** pueden autorizar pausas de cobro.

---

## 📞 Soporte

Para consultas adicionales o reporte de errores, contactar al administrador del sistema.
