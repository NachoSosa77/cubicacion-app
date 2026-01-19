# Cubicación – Pallet (Simulación) | Test + conclusiones para cliente

## Objetivo
Validar el **flujo Pallet** en modo simulación: **previsualizar** el layout 3D (plan), **revisar métricas/advertencias**, y **guardar** el plan para continuar con Camión.

## Qué se está probando hoy
- UI: layout tipo **Opción A (métricas en 2 filas)** y visor 3D con altura fija.
- Funcional: botón **Ver plan / previsualizar** calcula el layout y habilita **Guardar plan**.
- Integración: al guardar, se obtiene un **PalletPlan ID** y queda habilitado el paso hacia **Camión**.

---

## Checklist operativo de prueba

### 1) Precondiciones
- Lote accesible (ej: `/cubicacion/pallet/<loteId>`).
- “Fuente bulto” definida:
  - **Con simulación aplicada**: muestra el título/candidateKey del bulto.
  - **Sin simulación aplicada**: usa lote original.

### 2) Configuración mínima
1. Seleccionar **Objetivo de cubicación** (cards):
   - Operativo/estable (recomendado)
   - Optimizar volumen
   - Cuidado del producto
2. Seleccionar **Tipo de pallet / contenedor**.
3. Seleccionar **Mezcla de productos** (permitir/no mezclar).

**Criterio OK:** no hay errores visuales, los selects actualizan estado, y no se duplican acciones principales.

### 3) Ver plan / previsualizar (cálculo)
1. Click en **“Ver plan / previsualizar”**.
2. Esperar estado de carga (“Calculando…”).
3. Confirmar que aparece:
   - Estado **“plan listo”** y badge **OK**.
   - **Métricas** (2 filas) con valores coherentes.
   - **Viewer 3D** renderizando el pallet.

**Criterio OK:** el visor 3D se ve siempre (altura fija del contenedor), y el plan refleja el objetivo elegido.

### 4) Validaciones rápidas de consistencia (sanity checks)
- **Bultos colocados** ≤ **Capacidad calculada**.
- **Ocupación total** y **ocupación volumen** entre 0% y 100%.
- **Peso total** (kg) > 0 cuando hay carga.
- **Pallets requeridos** ≥ 1 en escenarios con demanda > 0.
- Si hay **warnings**, se listan y no rompen UI.

### 5) Guardar plan
1. Click en **“Guardar plan”** (solo habilitado si hay resultado).
2. Confirmar:
   - Mensaje “Guardado OK”
   - **PalletPlan ID** visible
   - Acciones para abrir **Camión** (misma pestaña / nueva pestaña)

**Criterio OK:** se guarda una sola vez por click (sin duplicaciones) y el ID queda visible.

---

## Interpretación de métricas (para mostrar al cliente)
- **Bultos colocados**: cantidad de bultos efectivamente ubicados en el pallet.
- **Capacidad calculada**: capacidad máxima estimada para ese pallet con esas reglas.
- **Capas**: cantidad de capas generadas.
- **Ocupación volumen (altura usada)**: cuánto volumen de carga ocupa considerando la altura utilizada.
- **Ocupación total**: ocupación global del pallet respecto al volumen total de referencia.
- **Peso total**: peso estimado total de la carga en el pallet.
- **Volumen libre estimado**: volumen aproximado disponible luego del layout calculado.
- **Pallets requeridos (estimación)**: estimación de pallets necesarios (no cambia el cálculo del pallet #1, es informativo).

---

## Conclusiones de la prueba (completar)
- Objetivo seleccionado: `__________________`
- Contenedor (pallet): `__________________`
- Mezcla: `__________________`
- Fuente bulto (snap): `__________________`
- Resultado:
  - Bultos colocados: `____`
  - Capas: `____`
  - Ocupación volumen: `____%`
  - Ocupación total: `____%`
  - Peso total: `____ kg`
  - Pallets requeridos: `____`
- Advertencias relevantes (si aplica):
  - `- __________________`
  - `- __________________`
- Veredicto:
  - [ ] Aprobado para demo
  - [ ] Requiere ajustes (detalle): `__________________`

---

## Próximos pasos
1. Confirmar el layout y **Guardar plan** (PalletPlan ID).
2. Pasar a **Camión** con el plan guardado y validar:
   - lectura del plan,
   - ocupación en camión,
   - consistencia de unidades/bultos.
