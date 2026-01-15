# Panel 1 — Bulto

## ¿Qué es el Panel de Bulto?
Es el módulo donde el usuario **define la unidad logística base** sobre la que se calculan pallets y transporte.

> “Antes de optimizar pallets o camiones, definimos qué es un bulto.”

---

## ¿Qué puede hacer el usuario?

### 1) Comparar escenarios (A / B / C)

El usuario no adivina: **compara alternativas reales**.

#### A · Snapshot actual del lote
- Usa los datos ya cargados en el sistema.
- Respeta:
  - unidades por bulto
  - cantidad de bultos
  - snapshot histórico
- Ideal para:
  - “¿Qué pasa si no cambio nada?”
- 👉 Escenario base (baseline).

#### B · Estándar del producto
- Ignora snapshots manuales.
- Usa:
  - `unidad_entra_por_bulto`
  - dimensiones estándar del producto
- Ideal para:
  - estandarización
  - operación repetible
  - catálogos bien definidos
- 👉 Escenario teórico / de catálogo.

#### C · Operativo (manual)
- El usuario define cómo trabajar hoy.
- Puede:
  - ajustar unidades por bulto
  - ajustar dimensiones del bulto (si aplica)
- Ideal para:
  - restricciones reales
  - campañas
  - proveedores específicos
- 👉 Escenario operativo real.

---

### 2) Ver impacto inmediato
Cada escenario muestra:
- total de unidades
- total de bultos
- detalle por producto:
  - unidades
  - bultos
  - unidades por bulto
  - dimensiones del bulto

Sin cálculos pesados: **solo definir la base**.

---

### 3) Elegir y aplicar
Al hacer clic en **“Aplicar bulto al workflow”**:

Conceptualmente:
> “Este es el bulto que vamos a usar para pallet y camión.”

Estado actual:
- se guarda en estado local (`bultoSnap`)
- queda marcado como aplicado

Evolución:
- alimenta el cálculo de pallet
- luego el de camión
- finalmente se guarda como parte del plan

---

## ¿Por qué esto es profesional?
- No obliga a un único camino.
- No pisa datos históricos.
- Separa claramente:
  - definición de unidad
  - optimización logística

Permite explicar:
> “Este pallet es bueno porque parte de este bulto.”

---

## Frase corta para clientes
> “El Panel de Bulto permite simular y elegir la unidad logística base antes de optimizar pallets y transporte.”


1) “Bulto global”

Es un default para todo el lote (para todos los SKU).

Si el usuario quiere probar “¿qué pasa si usamos CAJA-40x30x25 para todo?”, lo cambia una sola vez.

En tu snapshot C, eso alimenta bultoEmpresaIdGlobal.

2) “Bulto empresa (SKU)”

Es una excepción por producto.

Si un SKU necesita un bulto distinto (fragilidad, densidad, forma, marketing, etc.), lo cambiás solo para ese SKU.

En tu snapshot C, eso alimenta bultoEmpresaIdBySku[tipo_producto_id].

Regla de prioridad (la importante)

Para cada SKU, el bulto efectivo se elige así:

Si el SKU tiene selección propia → gana el bulto del SKU

Si no, se usa el bulto global → gana el global

Si tampoco hay global, cae al preferido / primero → fallback

En la UI, cuando te dice “Activo: CAJA-40x30x25” debajo del selector SKU, significa “este es el que realmente se está usando para ese SKU” según esa prioridad.
