# 📘 Manual de Anulaciones con Reintegro - Cobros Agua

## 📋 Índice

1. [Descripción General](#-descripción-general)
2. [Tipos de Anulación](#-tipos-de-anulación)
3. [Proceso de Anulación](#-proceso-de-anulación)
4. [Reintegros](#-reintegros)
5. [Reporte para Asamblea](#-reporte-para-asamblea)
6. [Ejemplos de Uso](#-ejemplos-de-uso)

---

## 🎯 Descripción General

El sistema de anulaciones permite cancelar recibos ya pagados cuando ocurren situaciones especiales, con registro completo de auditoría y manejo de reintegros de dinero.

### Características Principales

- ✅ **4 tipos de anulación** con comportamiento diferente
- ✅ **Registro de auditoría** completo con motivo y responsable
- ✅ **Reintegros de dinero** cuando aplica
- ✅ **Reporte para asamblea** con totales y detalles
- ✅ **Exportación a CSV** para contabilidad

---

## 📝 Tipos de Anulación

### 1. 📝 ERROR_DIGITACION - Error en Digitación

**Cuándo usar**: El recibo se creó con datos incorrectos (monto, periodo, etc.)

**Comportamiento**:
- El usuario vuelve a aparecer como deudor del periodo
- No genera reintegro automático
- Se debe emitir un nuevo recibo con los datos correctos

**Ejemplo**:
```
Recibo original: ENERO 2026 - Bs 50 (monto incorrecto)
Anulación: ERROR_DIGITACION
Nuevo recibo: ENERO 2026 - Bs 10 (monto correcto)
```

---

### 2. 💵 PAGO_INDEBIDO - Usuario Pagó sin Deber

**Cuándo usar**: El usuario pagó un periodo que no debía porque no recibió el servicio o hubo un error en la facturación.

**Comportamiento**:
- **Genera reintegro** del dinero al usuario
- El periodo NO aparece como deuda (se marca como "no cobrable")
- Requiere número de recibo de reintegro (opcional, se puede completar después)

**Ejemplo**:
```
Usuario: Juan Perez
Pagó: FEBRERO 2026 - Bs 10
Motivo: No recibió agua por reparación de tubería
Anulación: PAGO_INDEBIDO
Reintegro: Bs 10 (monto completo)
Estado: Usuario NO debe FEBRERO 2026
```

---

### 3. 🔄 DUPLICADO - Pago Duplicado

**Cuándo usar**: El usuario pagó dos veces el mismo periodo por error.

**Comportamiento**:
- Se mantiene el primer pago como válido
- Se anula el segundo pago
- **Genera reintegro** del dinero duplicado
- El periodo queda como PAGADO (con el primer recibo)

**Ejemplo**:
```
Usuario: Maria Lopez
Recibo 1: MARZO 2026 - Bs 10 (válido)
Recibo 2: MARZO 2026 - Bs 10 (duplicado)
Anulación Recibo 2: DUPLICADO
Reintegro: Bs 10
Estado: MARZO 2026 sigue como PAGADO
```

---

### 4. 👤 SOLICITUD_USUARIO - Solicitud del Usuario

**Cuándo usar**: El usuario solicita la anulación por motivos personales.

**Comportamiento**:
- El usuario vuelve a aparecer como deudor
- No genera reintegro automático
- Requiere observaciones detalladas para asamblea

**Ejemplo**:
```
Usuario: Pedro Gomez
Solicita anular: ABRIL 2026
Motivo: "Estuvo de viaje y no usó el servicio"
Anulación: SOLICITUD_USUARIO
Estado: ABRIL 2026 aparece como deuda pendiente
```

---

## 🔄 Proceso de Anulación

### Paso a Paso

1. **Navegar a "Anular Recibos"** (solo ADMINISTRADOR)

2. **Buscar el recibo** por nombre, CI o código del usuario

3. **Seleccionar el recibo** de la lista

4. **Click en "Proceder con Anulación"**

5. **Completar formulario**:
   - **Tipo de Anulación** (obligatorio)
     - ERROR_DIGITACION
     - PAGO_INDEBIDO
     - DUPLICADO
     - SOLICITUD_USUARIO
   
   - **Motivo Detallado** (obligatorio)
     - Error al digitar el recibo
     - Error en el monto cobrado
     - Error en el periodo asignado
     - El usuario pagó dos veces el mismo periodo
     - Usuario olvidó que ya había pagado
     - No se recibió el servicio en ese periodo
     - Otro motivo
   
   - **Reintegro** (solo para PAGO_INDEBIDO o DUPLICADO)
     - Monto a devolver al usuario
     - Se muestra cálculo automático:
       - Monto original
       - Reintegro
       - No reintegrado
   
   - **Número de Recibo de Reintegro** (opcional)
     - Se puede completar después
   
   - **Observaciones** (opcional pero recomendado)
     - Detalles adicionales para asamblea

6. **Click en "Confirmar Anulación"**

7. **Verificar resultado**:
   - Toast de confirmación
   - El recibo desaparece de la lista de pagados
   - El usuario aparece como deudor (excepto PAGO_INDEBIDO)

---

## 💵 Reintegros

### ¿Cuándo hay reintegro?

| Tipo de Anulación | ¿Reintegro? | ¿Por qué? |
|-------------------|-------------|-----------|
| ERROR_DIGITACION | ❌ No | Se emite nuevo recibo correcto |
| PAGO_INDEBIDO | ✅ Sí | Usuario pagó sin deber |
| DUPLICADO | ✅ Sí | Pago repetido se devuelve |
| SOLICITUD_USUARIO | ⚠️ Configurable | Según decisión del administrador |

### Proceso de Reintegro

1. **Al momento de anular**:
   - Ingresar monto de reintegro
   - El sistema calcula automáticamente el saldo no reintegrado

2. **Registro del recibo de reintegro**:
   - Opcional al momento de anular
   - Se puede completar después desde el reporte

3. **Seguimiento**:
   - Los reintegros pendientes aparecen en el reporte
   - Se pueden filtrar por usuario o periodo

### Ejemplo de Cálculo

```
Recibo original: Bs 15.50
Reintegro ingresado: Bs 10.00
Saldo no reintegrado: Bs 5.50

Explicación: El usuario pagó Bs 15.50 indebidamente.
Se le devuelven Bs 10.00 en efectivo.
Los Bs 5.50 restantes se descuentan del próximo cobro.
```

---

## 📊 Reporte para Asamblea

### Acceso

- **Navegar a**: "Reporte Anulaciones" (solo ADMINISTRADOR)
- **Permisos**: Solo ADMINISTRADOR puede ver este reporte

### Características

#### 1. Filtro por Mes

- Selector de mes (YYYY-MM)
- Muestra todas las anulaciones del mes seleccionado

#### 2. Tarjetas de Totales

| Tarjeta | Información |
|---------|-------------|
| Total Anulaciones | Cantidad de recibos anulados |
| Monto Anulado | Suma total de los montos anulados |
| Reintegrado | Total devuelto a usuarios |
| No Reintegrado | Total pendiente de devolución |

#### 3. Reintegros Pendientes

- Lista de usuarios con reintegros pendientes
- Muestra monto pendiente
- Permite identificar casos prioritarios

#### 4. Tabla de Detalle

Columnas disponibles:
- Fecha de anulación
- Socio (nombre, código, CI)
- Periodo anulado
- Monto anulado
- Tipo de anulación (con ícono)
- Reintegro
- Motivo
- Responsable que autorizó

#### 5. Exportar a CSV

- Botón "Exportar CSV"
- Descarga archivo Excel/CSV con todo el detalle
- Incluye encabezado con nombre del reporte y mes
- Listo para presentar en asamblea

---

## 📝 Ejemplos de Uso

### Caso 1: Usuario Pagó sin Recibir Servicio

**Situación**: 
- Juan Perez pagó FEBRERO 2026 (Bs 10)
- No hubo agua por 15 días por reparación
- La asamblea aprobó no cobrar ese mes

**Proceso**:
1. Buscar recibo de Juan Perez - FEBRERO 2026
2. Click en "Anular"
3. Tipo: **PAGO_INDEBIDO**
4. Motivo: **No se recibió el servicio en ese periodo**
5. Reintegro: **Bs 10.00** (monto completo)
6. Observaciones: "Reparación tubería principal - 15 días sin servicio"
7. Confirmar

**Resultado**:
- ✅ Recibo anulado
- ✅ Juan Perez recibe Bs 10 de reintegro
- ✅ FEBRERO 2026 NO aparece como deuda
- ✅ Reporte para asamblea muestra la anulación

---

### Caso 2: Pago Duplicado

**Situación**:
- Maria Lopez pagó MARZO 2026 dos veces
- Primer pago: 01/03/2026 - Bs 10
- Segundo pago: 15/03/2026 - Bs 10 (duplicado)

**Proceso**:
1. Buscar segundo recibo de Maria Lopez - MARZO 2026
2. Click en "Anular"
3. Tipo: **DUPLICADO**
4. Motivo: **El usuario pagó dos veces el mismo periodo**
5. Reintegro: **Bs 10.00**
6. Recibo de reintegro: "0005678" (número del recibo de devolución)
7. Confirmar

**Resultado**:
- ✅ Segundo recibo anulado
- ✅ Primer recibo sigue válido
- ✅ Maria Lopez recibe Bs 10 de reintegro
- ✅ MARZO 2026 sigue como PAGADO

---

### Caso 3: Error en Monto

**Situación**:
- Pedro Gomez debía Bs 10 de ENERO 2026
- Por error se cobró Bs 50
- Usuario pagó Bs 50

**Proceso**:
1. Anular recibo original:
   - Tipo: **ERROR_DIGITACION**
   - Motivo: **Error en el monto cobrado**
   - Reintegro: **Bs 0** (no se devuelve aún)
   - Observaciones: "Se cobró Bs 50 en lugar de Bs 10"

2. Crear nuevo recibo correcto:
   - Ir a Cobros
   - Buscar Pedro Gomez
   - Cobrar ENERO 2026 - Bs 10

3. Devolver diferencia (opcional):
   - Tipo: **PAGO_INDEBIDO**
   - Motivo: **Error en el monto cobrado**
   - Reintegro: **Bs 40** (diferencia)

**Resultado**:
- ✅ Recibo incorrecto anulado
- ✅ Recibo correcto creado
- ✅ Usuario paga lo que debe

---

## 📋 Consideraciones Importantes

### Para el Administrador

1. **Verificar bien el tipo de anulación** antes de confirmar
2. **Completar observaciones detalladas** para asamblea
3. **Registrar el número de recibo de reintegro** cuando se devuelva dinero
4. **Revisar el reporte de reintegros pendientes** periódicamente

### Para la Asamblea

1. **Presentar reporte mensual** de anulaciones
2. **Justificar anulaciones por PAGO_INDEBIDO** (falta de servicio)
3. **Aprobar reintegros pendientes** de pago
4. **Archivar reporte CSV** para auditoría

### Para Contabilidad

1. **Exportar CSV mensual** de anulaciones
2. **Conciliar reintegros** con caja
3. **Verificar que cada anulación tenga motivo válido**
4. **Mantener archivo de respaldos** de reintegros

---

## 🔍 Preguntas Frecuentes

### ¿Se puede revertir una anulación?

**No.** La anulación es irreversible. Si se necesita corregir, se debe crear un nuevo recibo.

### ¿Qué pasa si me equivoco de tipo de anulación?

Debes contactar al administrador del sistema para que lo corrija directamente en la base de datos.

### ¿Los reintegros tienen vencimiento?

No, pero se recomienda procesarlos en el mismo mes de la anulación.

### ¿Quién puede ver el reporte de anulaciones?

Solo los usuarios con rol **ADMINISTRADOR**.

### ¿Se puede anular un recibo de meses anteriores?

Sí, no hay límite de tiempo para anular recibos.

### ¿El usuario queda como deudor después de una anulación?

Depende del tipo:
- **ERROR_DIGITACION**: ✅ Sí
- **PAGO_INDEBIDO**: ❌ No
- **DUPLICADO**: ❌ No (el primer pago sigue válido)
- **SOLICITUD_USUARIO**: ✅ Sí

---

**Fecha**: Marzo 2026  
**Versión**: 2.1.0  
**Estado**: ✅ Production Ready
