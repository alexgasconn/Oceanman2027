# Plan de Implementación: Optimización Oceanman 14K Lago d'Orta

Consolidación de la interfaz para eliminar ruido visual, detección automática de travesías en aguas abiertas con métricas avanzadas (`moving_time`, `elapsed_time`, `moving_ratio`), y simulación precisa de avituallamientos y fatiga en las dos estaciones flotantes oficiales de la travesía.

---

## 1. Detección Inteligente de Aguas Abiertas y Cálculo de Moving Ratio

### Objetivos Técnicos:
- **Detección Automática por Palabras Clave**:
  - Palabras clave reconocidas: `"snl"`, `"aigues obertes"`, `"aguas abiertas"`, `"oncoswim"`, `"travesia"`, `"travessia"`.
  - Normalización sin distinción entre mayúsculas, minúsculas ni tildes (e.g. `travesía` -> `travesia`).
  - Detección en título de actividad, notas/descripción y tipo de deporte Strava (`Open Water Swimming` / `Swim`).
- **Separación Rigurosa entre Moving Time y Elapsed Time**:
  - Todos los ritmos base (min/100m) deben calcularse estrictamente utilizando `moving_time`.
  - Fórmula de calidad continua:
    $$\text{Moving Ratio} = \left(\frac{\text{Moving Time}}{\text{Elapsed Time}}\right) \times 100$$
  - Clasificación de la sesión por continuidad:
    - $\ge 90\%$: Nado continuo de resistencia (simulación de aguas abiertas / gran fondo).
    - $80\% - 89\%$: Series de fondo con descansos breves.
    - $< 80\%$: Entrenamiento fraccionado de técnica, series cortas o paradas frecuentes.

---

## 2. Reducción de Ruido y Consolidación en 3 Pestañas Clave

Reestructuración integral del header y vistas para eliminar redundancias:

1. **Pestaña 1: Oceanman 14K Readiness & Countdown**
   - Readiness Score de precisión (% de preparación para completar los 14 km).
   - 10 checks oficiales del reglamento de Lago d'Orta (volumen semanal, sesión más larga, tiradas continuas con moving ratio alto, boya obligatoria, etc.).
   - Resumen ejecutivo de métricas clave (volumen mensual, ritmo medio de fondo).

2. **Pestaña 2: Telemetría & Sesiones Strava**
   - Unificación de la lista de actividades importadas y el panel de análisis telemétrico.
   - Badge distintivo de aguas abiertas ("Aguas Abiertas / Travesía / SNL / Oncoswim").
   - Indicador visual del `moving_ratio` y desglose de tiempo en movimiento vs tiempo transcurrido (pausas).
   - Métricas de eficiencia: DPS (distancia por brazada), SWOLF y cadencia.

3. **Pestaña 3: Estrategia Lago d'Orta 14K (Visualización D3 & Simulador de Carrera)**
   - Visualización interactiva en D3 con perfil batimétrico y mapa de navegación del lago (de norte a sur).
   - Eliminación del selector genérico "Cada X min".
   - Modelo dinámico de pausa en las 2 estaciones flotantes oficiales:
     - **Estación 1 (Km 5.0 - Ronco)**: Corte oficial a las 2h 15m. Pausa estimada de hidratación y carbohidratos (30s – 75s según ritmo y nivel de intensidad).
     - **Estación 2 (Km 10.0 - Buccione)**: Corte oficial a las 4h 30m. Pausa estimada por fatiga acumulada y estrés térmico (60s – 150s).
   - Cálculo del **Tiempo Total Oficial** = $\text{Tiempo Neto de Nado} + \text{Pausa Estación 1} + \text{Pausa Estación 2}$.
   - Análisis de agotamiento: índice de glucógeno y buffer respecto al tiempo límite final de 6h 00m.

---

## 3. Plan de Modificaciones de Archivos

| Archivo | Acción | Descripción |
| :--- | :--- | :--- |
| `src/types/swim.ts` | Modificar | Añadir `elapsedTime`, `movingTime`, `movingRatio`, `isOpenWaterDetected`, `openWaterTrigger` a la interfaz `SwimActivity`. |
| `src/utils/swimCalculators.ts` | Modificar | Incorporar regex de detección de aguas abiertas, cálculo de `movingRatio`, asegurar ritmo basado en `moving_time`, y nueva función `calculateOrtaFeedPauses(...)`. |
| `src/components/Header.tsx` | Modificar | Reducir el menú de navegación a exactamente 3 botones limpios y coherentes. |
| `src/App.tsx` | Modificar | Adaptar el enrutador de pestañas al nuevo esquema consolidado de 3 vistas. |
| `src/components/ActivitiesListView.tsx` | Modificar | Integrar métricas de moving ratio, badges de detección de aguas abiertas y filtros directos. |
| `src/components/RaceCalculatorView.tsx` | Modificar | Eliminar slider de intervalo genérico y añadir la tarjeta de análisis detallado de las 2 estaciones de avituallamiento con pausas dinámicas y fatiga. |
| `src/utils/swimCalculators.test.ts` | Modificar | Añadir tests unitarios para detección de palabras clave, cálculo de moving ratio y simulación de pausas en Lago d'Orta. |

---

## 4. Criterios de Verificación

1. **Tests Unitarios**: Comprobar que palabras como `"SNL entrenamiento"`, `"Aigües obertes Cadaqués"`, `"Oncoswim 2024"`, `"Travesía Tabarca"` sean reconocidas como Open Water.
2. **Cálculo de Ritmo**: Verificar que el ritmo de natación use `moving_time` y que el `moving_ratio` refleje el % de continuidad.
3. **Pausas de Carrera**: Validar que la simulación de Lago d'Orta solo tenga las paradas en Km 5.0 y Km 10.0 con tiempos de parada y cortes oficiales exactos.
4. **Validación de Compilación**: Ejecutar `compile_applet` para garantizar cero errores de TypeScript y empaquetado.
