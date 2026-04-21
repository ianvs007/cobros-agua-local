# 🔄 Actualización del Sistema - Anulación y Pausas

## 📋 Resumen de Cambios

Esta actualización agrega dos funcionalidades críticas al sistema de cobros de agua:

1. **🚫 Anulación de Recibos** - Cancelación de recibos con auditoría completa
2. **⏸️ Pausa de Cobros** - Suspensión temporal de facturación por viaje, salud, falta de agua

---

## 🗄️ Paso 1: Actualizar Base de Datos

### Ejecutar el Script SQL

1. Abrir Supabase Studio: https://goxjlpchrtedorxnsqqs.supabase.co
2. Navegar a **SQL Editor**
3. Copiar y pegar el contenido del archivo `actualizar_esquema.sql`
4. Ejecutar el script completo

El script creará:

- ✅ Tabla `anulaciones` (auditoría de recibos anulados)
- ✅ Tabla `pausas_cobro` (suspensiones temporales)
- ✅ Campo `estado` en `pagos` (PAGADO/ANULADO)
- ✅ Vista `v_recibos_anulados`
- ✅ Vista `v_pausas_activas`
- ✅ Función `periodo_en_pausa()`
- ✅ Función `calcular_mora_con_pausas()`

### Verificar Instalación

Ejecutar estas consultas para verificar:

```sql
-- Verificar tablas creadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('anulaciones', 'pausas_cobro');

-- Verificar vistas
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('v_recibos_anulados', 'v_pausas_activas');

-- Verificar columna en pagos
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'pagos' AND column_name = 'estado';
```

---

## 💻 Paso 2: Actualizar Código Frontend

### Archivos Nuevos

Los siguientes archivos ya fueron creados en `src/components/`:

- ✅ `AnularRecibos.jsx` - Módulo de anulación
- ✅ `PausasCobro.jsx` - Módulo de pausas

### Archivos Modificados

- ✅ `src/utils/debt.js` - Actualizado para excluir periodos en pausa
- ✅ `src/App.jsx` - Agregadas nuevas rutas de navegación

---

## 🚀 Paso 3: Probar las Funcionalidades

### Prueba 1: Crear Pausa de Cobro

1. Iniciar sesión como **ADMIN**
2. Navegar a **Pausas**
3. Buscar un usuario de prueba
4. Crear pausa:
   - Fecha inicio: Hoy
   - Fecha fin: 30 días desde hoy
   - Tipo: Sin Agua
   - Motivo: "Prueba de sistema"
5. Verificar que aparezca en "Pausas Activas"

### Prueba 2: Verificar Cálculo de Deuda

1. Navegar a **Cobros**
2. Buscar el mismo usuario de la prueba anterior
3. Verificar que los meses en pausa NO aparecen como deuda

### Prueba 3: Anular Recibo

1. Navegar a **Anular Recibos**
2. Buscar un usuario con recibos pagados
3. Seleccionar un recibo
4. Anular con motivo: "Error en digitación"
5. Verificar que el recibo ahora aparece como anulado

### Prueba 4: Verificar Auditoría

En Supabase SQL Editor, ejecutar:

```sql
-- Ver recibo anulado
SELECT * FROM v_recibos_anulados LIMIT 1;

-- Ver pausa activa
SELECT * FROM v_pausas_activas LIMIT 1;
```

---

## 📊 Paso 4: Capacitación de Usuarios

### Para Administradores

1. Leer el `MANUAL_FUNCIONALIDADES.md`
2. Comprender el impacto contable de las anulaciones
3. Establecer políticas de cuándo autorizar pausas

### Para Operadores

1. Mostrar el nuevo menú "Anular Recibos" y "Pausas"
2. Explicar que solo ADMINISTRADOR puede acceder
3. Demostrar el flujo completo de cada función

---

## 🔧 Solución de Problemas

### Error: "La tabla anulaciones no existe"

**Solución**: Ejecutar nuevamente el script `actualizar_esquema.sql`

### Error: "periodo_en_pausa no es una función"

**Solución**: Verificar que el script SQL se ejecutó completamente

### El módulo de Pausas no carga usuarios

**Solución**: 
1. Verificar que los usuarios tengan estado 'ACTIVO'
2. Revisar la consola del navegador para errores

### La deuda no excluye los periodos en pausa

**Solución**:
1. Verificar que la pausa tenga estado 'ACTIVA'
2. Verificar que las fechas sean correctas
3. Recargar la página

---

## 📈 Métricas de la Actualización

| Elemento | Cantidad |
|----------|----------|
| Nuevas tablas | 2 |
| Nuevas vistas | 2 |
| Nuevas funciones | 2 |
| Nuevos componentes | 2 |
| Archivos modificados | 2 |
| Líneas de código SQL | ~250 |
| Líneas de código React | ~600 |

---

## 📞 Soporte Post-Actualización

Si encuentra algún problema:

1. Revisar este documento paso a paso
2. Verificar la consola del navegador (F12)
3. Revisar los logs de Supabase
4. Contactar al desarrollador

---

## ✅ Checklist de Instalación

- [ ] Script SQL ejecutado exitosamente
- [ ] Tablas `anulaciones` y `pausas_cobro` creadas
- [ ] Vistas `v_recibos_anulados` y `v_pausas_activas` creadas
- [ ] Campo `estado` agregado a `pagos`
- [ ] Archivos frontend actualizados
- [ ] Navegación en App.jsx actualizada
- [ ] Pruebas de funcionalidad completadas
- [ ] Manual leído por administradores
- [ ] Backup de base de datos realizado

---

**Fecha de actualización**: Marzo 2026  
**Versión**: 2.0.0  
**Estado**: ✅ Production Ready
