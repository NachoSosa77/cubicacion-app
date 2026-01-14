# Simulación avanzada — Panel 2 (Pallet) — Resumen para cliente

## ¿Qué es el Panel 2 (Pallet)?
El Panel 2 es el módulo donde el usuario **palletiza** el lote (ya definido en “Bulto”) y obtiene:
- **layout 3D** del pallet,
- **métricas operativas** (capas, cajas por capa, peso, altura),
- **métricas de ocupación** (volumen usado y ocupación global),
- y la opción de **guardar** el plan para continuar al **Camión**.

En términos de negocio:
> “Acá el usuario ve cómo se conforma el pallet y elige el plan más conveniente antes de pasar al transporte.”

---

## ¿Qué puede hacer el usuario en este panel?
### 1) Seleccionar tipo de pallet / contenedor
El usuario elige el contenedor (pallet u otro tipo) y el sistema valida:
- que tenga dimensiones completas (largo/ancho/alto),
- límites operativos (peso máximo, altura útil si aplica).

Esto asegura que el cálculo sea consistente y aplicable.

---

### 2) Definir reglas de operación para el cálculo
El panel ofrece controles estándar de industria:
- **Mezcla de productos (mix policy)**
  - Permitir mezcla
  - No mezclar (1 SKU por pallet)
- **Objetivo de cubicación**
  - Operativo / estable
  - Optimizar volumen
  - Cuidado del producto

Esto habilita escenarios diferentes sin cambiar los datos base.

---

### 3) Activar “Modo simulación” (pallet parcial)
Permite simular un pallet “parcial”, limitando el cálculo por:
- **Bultos deseados** (objetivo de cantidad),
- **% ocupación deseada** (objetivo de llenado).

Importante: no cambia el “máximo teórico”, sino que permite comparar alternativas.

---

### 4) Previsualizar el resultado (3D + KPIs)
Al previsualizar, el usuario recibe:
- **Previsualización 3D** del pallet (layout)
- KPIs principales:
  - Bultos colocados (y capacidad calculada)
  - Capas y cajas por capa
  - Ocupación de volumen (según altura usada)
  - Ocupación total del pallet (referencia sobre volumen completo)
  - Peso total y altura usada
  - Volumen libre estimado
  - Estimación de pallets requeridos
- Advertencias (warnings) si hay restricciones o inconsistencias.

Esto transforma el proceso en una decisión informada, no “prueba y error”.

---

## A/B/C (Presets) — cómo se presenta “profesional” al cliente
En la versión V2, el Panel 2 se presenta con **presets A/B/C** que representan escenarios típicos:

- **A · Operativo estable (baseline)**
  - Busca un pallet “seguro” y repetible.
- **B · Optimizar volumen**
  - Busca mayor llenado / eficiencia volumétrica.
- **C · Cuidado del producto / simulación**
  - Prioriza restricciones operativas o límites por objetivos.

Nota: hoy los presets pueden operar como “reset y selección de escenario”.
En la integración completa, los presets **precargan parámetros** (mix/objetivo/simulación) y quedan trazables.

---

## ¿Qué se guarda cuando el usuario aprueba el plan?
Al guardar, se persiste un **Pallet Plan** con:
- el contenedor elegido,
- las reglas usadas (mix/objetivo/modo simulación),
- y el **layout completo** (pallets + placements + métricas),
para auditoría, reproducción y continuidad del workflow.

Luego el flujo continúa al Panel 3 (Camión).

---

## Frase “de venta” (para demo / cliente)
> “El Panel de Pallet convierte un lote en pallets reales: muestra layout 3D, métricas operativas y escenarios A/B/C para elegir el mejor plan antes de planificar transporte.”

