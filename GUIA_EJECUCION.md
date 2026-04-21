# 📋 Guía Paso a Paso - Ejecutar Actualización en Supabase

## 🎯 Objetivo

Completar la actualización del sistema agregando la columna `estado` a la tabla `pagos`.

---

## 📝 Paso 1: Abrir Supabase SQL Editor

1. **Abrir el navegador** (Chrome, Edge, Firefox)

2. **Navegar a la URL**:
   ```
   https://goxjlpchrtedorxnsqqs.supabase.co
   ```

3. **Iniciar sesión** con tu cuenta de administrador de Supabase

---

## 📝 Paso 2: Navegar al SQL Editor

1. En el menú lateral izquierdo, hacer clic en **SQL Editor**

   ```
   📊 Authentication
   🔒 Storage
   📝 SQL Editor    ← Click aquí
   ⚡ Edge Functions
   ```

2. Hacer clic en el botón **"+ New query"** (arriba a la derecha)

   Se abrirá una nueva pestaña con un editor de código en blanco.

---

## 📝 Paso 3: Copiar el Script SQL

1. **Abrir el archivo** `completar_actualizacion.sql` en un editor de texto

2. **Seleccionar todo** el contenido (Ctrl+A / Cmd+A)

3. **Copiar** (Ctrl+C / Cmd+C)

---

## 📝 Paso 4: Pegar y Ejecutar

1. **Pegar** el contenido en el SQL Editor de Supabase (Ctrl+V / Cmd+V)

2. **Verificar** que el código se vea así:
   ```sql
   -- ====================================
   -- COMPLETAR ACTUALIZACIÓN - COBROS AGUA
   -- ====================================
   -- Este script completa la actualización...
   ```

3. **Hacer clic en el botón "Run"** 
   - O presionar **Ctrl+Enter** (Windows) / **Cmd+Enter** (Mac)

---

## 📝 Paso 5: Verificar Resultados

Después de ejecutar, deberías ver en la consola de resultados:

```
✅ ACTUALIZACIÓN COMPLETADA EXITOSAMENTE
====================================
📋 Tablas verificadas: usuarios, pagos, anulaciones, pausas_cobro
📊 Vistas verificadas: v_recibos_anulados, v_pausas_activas
🔧 Funciones verificadas: periodo_en_pausa
✅ Columna "estado" agregada a tabla "pagos"
 
🎉 El sistema está 100% sincronizado y listo para usar
====================================
```

### Tabla de Verificación

Deberías ver una tabla como esta:

| Columna | Tipo | Default |
|---------|------|---------|
| estado | text | 'PAGADO' |

### Conteo de Registros

También deberías ver:

| tabla | registros |
|-------|-----------|
| usuarios | 8 |
| pagos | 201 |
| anulaciones | 0 |
| pausas_cobro | 0 |

*(Los números pueden variar)*

---

## 📝 Paso 6: Verificar en el Editor de Tablas

1. **Navegar a Table Editor** en el menú lateral

2. **Seleccionar la tabla "pagos"**

3. **Verificar columnas** - Deberías ver:
   - ✅ id
   - ✅ usuario_id
   - ✅ monto
   - ✅ periodo
   - ✅ tipo
   - ✅ responsable
   - ✅ fecha
   - ✅ correlativo
   - ✅ **estado** ← Nueva columna
   - ✅ lectura_anterior
   - ✅ lectura_actual
   - ✅ cuota_ingreso
   - ✅ conexion
   - ✅ consumo_agua
   - ✅ proteccion
   - ✅ multa
   - ✅ asambleas
   - ✅ observaciones

4. **Hacer clic en la columna "estado"** para ver los valores
   - Todos los registros existentes deberían tener `'PAGADO'`

---

## 📝 Paso 7: Probar las Funcionalidades

### Prueba 1: Módulo de Anulación

1. **Abrir la aplicación** en el navegador
   ```
   http://localhost:3001
   ```
   *(o el puerto que uses)*

2. **Iniciar sesión** como ADMINISTRADOR

3. **Navegar a "Anular Recibos"** en el menú

4. **Buscar un usuario** con recibos pagados

5. **Verificar** que puedes seleccionar recibos

---

### Prueba 2: Módulo de Pausas

1. **Navegar a "Pausas"** en el menú

2. **Buscar un usuario**

3. **Crear una pausa de prueba**:
   - Fecha inicio: Hoy
   - Fecha fin: 30 días desde hoy
   - Tipo: Sin Agua
   - Motivo: "Prueba de sistema"

4. **Verificar** que la pausa aparece en "Pausas Activas"

---

### Prueba 3: Cálculo de Deuda con Pausa

1. **Navegar a "Cobros"**

2. **Buscar el usuario** con la pausa creada

3. **Verificar** que los meses en pausa NO aparecen como deuda

---

## ❌ Solución de Problemas

### Error: "relation 'configuracion' does not exist"

**Causa**: La tabla `configuracion` no existe

**Solución**:
1. Ejecutar primero el archivo `setup_supabase.sql`
2. O crear la tabla manualmente:
   ```sql
   CREATE TABLE IF NOT EXISTS configuracion (
       key TEXT PRIMARY KEY,
       value TEXT,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

### Error: "permission denied"

**Causa**: Usuario sin privilegios suficientes

**Solución**:
- Usar el rol `postgres` o un usuario con rol `ADMINISTRADOR`
- Verificar en Supabase → Settings → Users

### Error: "column 'estado' already exists"

**Causa**: El script ya se ejecutó anteriormente

**Solución**:
- Este error es INOFENSIVO
- El script usa `IF NOT EXISTS`, así que es seguro ignorarlo
- Continuar con la ejecución

### La aplicación no muestra los nuevos módulos

**Causa**: El frontend necesita recargarse

**Solución**:
1. Detener el servidor de desarrollo (Ctrl+C)
2. Volver a iniciar: `npm run dev`
3. Recargar el navegador (F5 o Ctrl+R)

---

## ✅ Checklist de Verificación

Marcar cada ítem completado:

- [ ] Abrí Supabase SQL Editor
- [ ] Copié el script `completar_actualizacion.sql`
- [ ] Ejecuté el script sin errores
- [ ] Verifiqué la columna `estado` en la tabla `pagos`
- [ ] Verifiqué las tablas `anulaciones` y `pausas_cobro`
- [ ] Verifiqué las vistas `v_recibos_anulados` y `v_pausas_activas`
- [ ] Reinicié el servidor de desarrollo
- [ ] Probé el módulo "Anular Recibos"
- [ ] Probé el módulo "Pausas"
- [ ] Verifiqué que el cálculo de deuda excluye pausas

---

## 📞 Soporte

Si encuentras algún problema:

1. **Revisar este documento** paso a paso
2. **Verificar la consola** del navegador (F12)
3. **Revisar los logs** de Supabase
4. **Contactar** al desarrollador

---

**Fecha**: Marzo 2026  
**Versión**: 2.0.0  
**Estado**: ✅ Listo para Producción
