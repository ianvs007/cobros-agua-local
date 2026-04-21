# 🚀 Guía de Puesta en Producción

## 📋 Índice

1. [Reseteo para Producción](#-reseteo-para-producción)
2. [Pasos para Poner en Producción](#-pasos-para-poner-en-producción)
3. [Verificación Post-Reseteo](#-verificación-post-reseteo)
4. [Migración de Datos de Prueba](#-migración-de-datos-de-prueba)

---

## ⚠️ Reseteo para Producción

### ¿Cuándo Usar Esta Función?

Usa el botón **"Resetear para Producción"** cuando:

- ✅ Has terminado las pruebas del sistema
- ✅ Quieres comenzar desde cero con datos reales
- ✅ Los códigos deben comenzar desde 00001
- ✅ Has exportado un respaldo de los datos de prueba (opcional)

### ¿Qué Elimina?

| Elemento | ¿Se Elimina? | ¿Por qué? |
|----------|--------------|-----------|
| **Socios/Usuarios** | ✅ Sí | Son datos de prueba |
| **Pagos/Recibos** | ✅ Sí | Son datos de prueba |
| **Anulaciones** | ✅ Sí | Son registros de prueba |
| **Pausas de Cobro** | ✅ Sí | Son registros de prueba |
| **Operadores** | ❌ No | Necesarios para el sistema |
| **Configuración** | ❌ No | Incluye logo y datos de entidad |
| **Contraseñas** | ❌ No | Necesarias para login |

### ¿Qué Reinicia?

| Elemento | Valor Inicial |
|----------|---------------|
| **Códigos de Socio** | 0001 |
| **Correlativos de Recibo** | 1 |
| **IDs de Tablas** | Auto-incremento desde 1 |

---

## 🔧 Pasos para Poner en Producción

### Paso 1: Exportar Respaldo (Opcional pero Recomendado)

1. Ir a **Configuración** → **Seguridad de Datos**
2. Click en **"Exportar Respaldo Maestro (.JSON)"**
3. Guardar el archivo en una carpeta segura
4. Este archivo contiene TODOS los datos actuales

### Paso 2: Verificar Configuración

1. Ir a **Configuración** → **Datos de la Entidad**
2. Verificar que esté completo:
   - ✅ Razón Social
   - ✅ Localidad
   - ✅ Datos de Afiliación
   - ✅ Logo (opcional)

### Paso 3: Resetear para Producción

1. Ir a **Configuración** → **Zona de Peligro**
2. Click en **"Resetear para Producción"**
3. **Primera Confirmación**:
   ```
   ⚠️ ADVERTENCIA CRÍTICA
   ¿Estás SEGURO de que quieres resetear la base de datos?
   
   Esto eliminará:
   - TODOS los socios
   - TODOS los pagos
   - TODAS las anulaciones
   - TODAS las pausas
   
   Se mantendrán:
   - Operadores
   - Configuración
   
   ¡ESTA ACCIÓN NO SE PUEDE DESHACER!
   ```
4. Click en **Aceptar** (si estás seguro)

5. **Segunda Confirmación**:
   ```
   ⚠️ ÚLTIMA ADVERTENCIA
   Esta acción es IRREVERSIBLE.
   
   Solo continúa si:
   - Has exportado un respaldo
   - Estás seguro de que quieres empezar desde cero
   - Los códigos comenzarán desde 00001
   
   ¿Confirmas que quieres proceder?
   ```
6. Click en **Aceptar**

7. **Mensaje de Éxito**:
   ```
   ✅ Base de datos reseteada exitosamente para producción.
   
   Los códigos ahora comenzarán desde 00001.
   ```

### Paso 4: Verificar Post-Reseteo

1. Ir a **Usuarios**
2. Debería mostrar **0 usuarios** (vacío)
3. Ir a **Cobros**
4. Debería mostrar **0 recibos** (vacío)

### Paso 5: Comenzar a Registrar Datos Reales

1. **Registrar primer socio**:
   - Ir a **Usuarios** → **Nuevo Usuario**
   - El código debería ser **0001**
   - Completar datos del socio

2. **Primer cobro**:
   - Ir a **Cobros**
   - Buscar el socio registrado
   - El correlativo del recibo debería ser **1**

---

## ✅ Verificación Post-Reseteo

### Checklist de Verificación

Marcar cada ítem después del reseteo:

#### Base de Datos
- [ ] Tabla `usuarios` está vacía
- [ ] Tabla `pagos` está vacía
- [ ] Tabla `anulaciones` está vacía
- [ ] Tabla `pausas_cobro` está vacía

#### Configuración
- [ ] Operadores existen (admin y otros)
- [ ] Configuración de entidad se mantiene
- [ ] Logo de empresa se mantiene
- [ ] Datos de afiliación se mantienen

#### Códigos
- [ ] Próximo código de socio será 0001
- [ ] Próximo correlativo de recibo será 1

---

## 🔄 Migración de Datos de Prueba

### Escenario: Quieres mantener algunos datos

Si tienes datos de prueba que quieres conservar:

#### Opción A: Exportar e Importar Selectivo

1. **Antes de resetear**:
   - Exportar respaldo completo (.JSON)
   - Anotar socios que quieres mantener

2. **Resetear** para producción

3. **Después de resetear**:
   - Registrar manualmente los socios deseados
   - Usar importación CSV si son muchos

#### Opción B: No Resetear (Continuar con Datos)

Si los datos de prueba son mínimos:

1. **No resetear** la base de datos
2. **Eliminar manualmente** los socios de prueba:
   - Ir a **Usuarios**
   - Eliminar uno por uno los que no sirvan
3. **Comenzar a registrar** datos reales

---

## 📊 Flujo Recomendado para Producción

### Flujo Estándar

```
1. Pruebas del sistema (datos de prueba)
         ↓
2. Exportar respaldo completo
         ↓
3. Resetear para producción
         ↓
4. Verificar que esté vacío
         ↓
5. Configurar datos de entidad
         ↓
6. Registrar primer socio real (código 0001)
         ↓
7. Primer cobro real (correlativo 1)
         ↓
8. Comenzar operación normal
```

---

## ⚠️ Consideraciones Importantes

### Antes de Resetear

1. **VERIFICAR RESPALDO**:
   - ¿Exportaste un respaldo?
   - ¿Está guardado en lugar seguro?

2. **VERIFICAR CONFIGURACIÓN**:
   - ¿Los datos de entidad están completos?
   - ¿El logo está cargado?
   - ¿Los operadores están creados?

3. **VERIFICAR USUARIOS**:
   - ¿Hay algún socio que quieras mantener?
   - ¿Anótalo para registrar después?

### Después de Resetear

1. **NO SE PUEDE DESHACER**:
   - Los datos eliminados se perdieron para siempre
   - Solo se pueden recuperar desde el respaldo .JSON

2. **LOS CÓDIGOS COMIENZAN DESDE 0001**:
   - El primer socio tendrá código 0001
   - El primer recibo tendrá correlativo 1

3. **OPERADORES SE MANTIENEN**:
   - Puedes login inmediatamente
   - Las contraseñas no cambian

---

## 🆘 Solución de Problemas

### Problema: "No puedo resetear"

**Causa**: No tienes permisos de ADMINISTRADOR

**Solución**:
- Inicia sesión con usuario `admin`
- O con un usuario con rol `ADMINISTRADOR`

### Problema: "Los códigos no comienzan desde 0001"

**Causa**: Supabase mantiene la secuencia interna

**Solución**:
1. Ejecutar este SQL en Supabase SQL Editor:
   ```sql
   -- Resetear secuencia de usuarios
   ALTER SEQUENCE usuarios_id_seq RESTART WITH 1;
   
   -- Resetear secuencia de pagos
   ALTER SEQUENCE pagos_id_seq RESTART WITH 1;
   
   -- Resetear secuencia de anulaciones
   ALTER SEQUENCE anulaciones_id_seq RESTART WITH 1;
   ```

2. Verificar que el próximo usuario tendrá ID 1:
   ```sql
   SELECT last_value FROM usuarios_id_seq;
   -- Debería mostrar: 1
   ```

### Problema: "Eliminé todo pero los códigos siguen altos"

**Causa**: Las secuencias de auto-incremento no se resetean automáticamente

**Solución**: Ver arriba - ejecutar SQL de reseteo de secuencias

---

## 📞 Soporte

Para consultas adicionales sobre la puesta en producción:

1. Revisar este documento completo
2. Verificar checklist de verificación
3. Contactar al desarrollador

---

**Fecha**: Marzo 2026  
**Versión**: 2.1.0  
**Estado**: ✅ Production Ready

---

## 🎉 ¡Listo para Producción!

Después de seguir estos pasos, tu sistema estará **100% listo** para operar en producción con:

- ✅ Base de datos limpia
- ✅ Códigos comenzando desde 0001
- ✅ Configuración mantenida
- ✅ Operadores listos para usar

**¡A cobrar con confianza!** 💧
