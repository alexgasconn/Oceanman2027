import { SwimActivity } from '../types/swim.ts';
import { calculateDPS, calculateSWOLF, calculateStrokeIndex } from '../utils/swimCalculators.ts';

function createSwim(
  id: string,
  date: string,
  title: string,
  type: 'pool' | 'open_water',
  distance: number,
  paceSec: number, // pace in seconds per 100m
  cadence: number, // SPM
  avgHr: number,
  waterTemp: number,
  hasWetsuit: boolean,
  notes?: string
): SwimActivity {
  const movingTime = Math.round((distance / 100) * paceSec);
  const elapsedTime = Math.round(movingTime * (type === 'open_water' ? 1.06 : 1.18));
  const movingRatio = Number(((movingTime / elapsedTime) * 100).toFixed(1));
  const speedMps = distance / movingTime;
  const dps = calculateDPS(speedMps, cadence);
  const swolf = calculateSWOLF(paceSec, dps, type === 'open_water' ? 50 : 25);
  const strokeIndex = calculateStrokeIndex(speedMps, dps);

  const elevationHigh = type === 'open_water' ? 18.4 : 0.0;
  const elevationLow = type === 'open_water' ? 2.2 : 0.0;

  // Generate realistic kilometer splits
  const kmCount = Math.max(1, Math.floor(distance / 1000));
  const splits = [];
  for (let k = 1; k <= kmCount; k++) {
    // slight drift over distance: fatigue factor
    const drift = (k - 1) * 0.8;
    const splitPace = Math.round(paceSec + (k === 1 ? -1 : drift));
    splits.push({
      km: k,
      paceSec: splitPace,
      cadenceSpm: cadence + (k % 2 === 0 ? 1 : -1),
      heartRate: avgHr + Math.min(15, k * 2),
      swolf: swolf + Math.round(drift / 2),
    });
  }

  return {
    id,
    date,
    title,
    type,
    distance,
    elapsedTime,
    movingTime,
    movingRatio,
    elevationHigh,
    elevationLow,
    isOpenWaterDetected: type === 'open_water',
    openWaterTrigger: type === 'open_water' ? `Aguas Abiertas (Elev: ${elevationHigh.toFixed(0)}m / ${elevationLow.toFixed(0)}m)` : 'Piscina (Elev: 0m)',
    pacePer100m: paceSec,
    averageCadence: cadence,
    totalStrokes: Math.round((movingTime / 60) * cadence),
    dps,
    swolf,
    strokeIndex,
    avgHeartRate: avgHr,
    maxHeartRate: avgHr + 14,
    calories: Math.round((distance / 100) * (type === 'open_water' ? 32 : 28)),
    poolLength: type === 'pool' ? 50 : null,
    waterTemp,
    hasWetsuit,
    notes,
    source: 'demo',
    splits,
  };
}

/**
 * 42 comprehensive swim sessions reflecting a dedicated marathon swimmer preparing for Oceanman 14K
 */
export const ULTRA_SWIMMER_ACTIVITIES: SwimActivity[] = [
  // Recent weeks (October 2026)
  createSwim('act-42', '2026-10-22', 'Test 10K Ultrafondo Lago Banyoles (Simulación Oceanman)', 'open_water', 10000, 97, 63, 142, 19.0, true, 'Excelente test de ritmo constante. Avituallamiento cada 35 min con gel de 40g.'),
  createSwim('act-41', '2026-10-19', 'Series Umbral 10x400m c/ 5:45 (Piscina 50m)', 'pool', 4500, 92, 67, 154, 27.0, false, 'Consistencia brutal en 6:05-6:08 por 400m. Buen agarre de codo.'),
  createSwim('act-40', '2026-10-16', 'Travesía Matinal Costa Brava (Tossa - Cala Pola)', 'open_water', 6200, 96, 62, 138, 19.5, true, 'Mar algo rizado en cabos. Trabajo intensivo de avistamiento cada 6 brazadas.'),
  createSwim('act-39', '2026-10-13', 'Recuperación Activa & Técnica Patada/Pull', 'pool', 3200, 104, 60, 126, 27.5, false, 'Trabajo de hipoxia y deslizamiento.'),
  createSwim('act-38', '2026-10-10', 'SNL Tirada Fondo Aeróbico Embalse de Sau', 'open_water', 7500, 98, 63, 139, 18.5, true, 'Sesión SNL: condiciones muy similares al Lago d\'Orta: agua dulce calma y fresca.'),
  createSwim('act-37', '2026-10-06', 'Bloque CSS: 400m + 200m Max + 20x100m ritmo', 'pool', 4000, 90, 68, 158, 27.0, false, 'Test CSS: 400m en 5:52 (1:28/100m), 200m en 2:48 (1:24/100m). CSS actual = 1:32/100m.'),
  
  // September 2026
  createSwim('act-36', '2026-09-29', 'Travesía Larga Sitges - Vilanova', 'open_water', 8200, 99, 62, 141, 21.0, true, 'Corriente de popa en primeros 4km, luego contracorriente suave.'),
  createSwim('act-35', '2026-09-25', 'Piscina Olímpica: Pirámide 200-400-800-400-200', 'pool', 4200, 93, 66, 149, 27.0, false, 'Foco en mantener DPS por encima de 1.85m en fatiga.'),
  createSwim('act-34', '2026-09-21', 'Oncoswim Tramo Solidario Platja Llarga', 'open_water', 5000, 98, 63, 135, 21.5, true, 'Ritmo de crucero sostenible con apoyo de embarcaciones.'),
  createSwim('act-33', '2026-09-17', 'Intervalos 16x150m palas + pull buoy', 'pool', 3800, 91, 64, 146, 27.0, false, 'Potencia de dorsal y tracción.'),
  createSwim('act-32', '2026-09-12', 'Aigües Obertes Cadaqués - Port Lligat', 'open_water', 8000, 98, 63, 140, 22.0, true, 'Sesión de aigües obertes simulando fatiga acumulada.'),
  createSwim('act-31', '2026-09-07', 'Volumen Aeróbico Piscina', 'pool', 4000, 95, 65, 137, 27.0, false, 'Ritmo constante Z2.'),
  createSwim('act-30', '2026-09-02', 'Travessia Illes Medes (Estartit)', 'open_water', 5500, 101, 61, 139, 20.0, true, 'Fondo rocoso y agua cristalina. Sensaciones magníficas.'),

  // August 2026
  createSwim('act-29', '2026-08-28', 'Test 12.000m Ultra Marathon Swim Embalse', 'open_water', 12000, 100, 62, 143, 23.0, true, 'EL gran hito: 12km sin parar excepto 4 paradas de avituallamiento de 40 seg. Completado en 3h 20m.'),
  createSwim('act-28', '2026-08-24', 'Descarga activa 3000m técnica y relajación', 'pool', 3000, 106, 59, 122, 27.0, false, 'Trabajo de relajación escapular.'),
  createSwim('act-27', '2026-08-19', 'Aguas Abiertas Begur: Aiguablava a Sa Tuna', 'open_water', 6800, 99, 62, 140, 22.5, true, 'Paso por acantilados, oleaje moderado.'),
  createSwim('act-26', '2026-08-14', 'Series Lactato 8x200m ritmo Z4', 'pool', 3600, 89, 70, 162, 27.0, false, 'Velocidad punta y tolerancia ácida.'),
  createSwim('act-25', '2026-08-09', 'Nado Nocturno Seguro con Boya Iluminada', 'open_water', 4200, 102, 60, 133, 23.0, true, 'Orientación visual en oscuridad, preparación mental.'),
  createSwim('act-24', '2026-08-04', 'Fondo Puro 5000m Piscina sin viraje flip', 'pool', 5000, 96, 64, 138, 27.0, false, 'Viraje abierto tocando pared para simular nado sin impulso.'),

  // July 2026
  createSwim('act-23', '2026-07-30', 'Travesía Illes Medes (Estartit)', 'open_water', 5200, 97, 63, 140, 22.0, true, 'Reserva marina con corriente lateral en el canal.'),
  createSwim('act-22', '2026-07-25', 'Entreno Umbral 5x800m', 'pool', 4500, 93, 66, 151, 27.0, false, 'Series largas de umbral anaeróbico.'),
  createSwim('act-21', '2026-07-20', 'Mar Plana Sant Pol de Mar', 'open_water', 6000, 99, 62, 137, 23.5, false, 'Nado sin neopreno (skin swim) para sensibilidad táctil.'),
  createSwim('act-20', '2026-07-15', 'Técnica de rolido y batido 2 tiempos', 'pool', 3200, 102, 61, 129, 27.0, false, 'Consumo mínimo de glucógeno mediante batido 2T.'),
  createSwim('act-19', '2026-07-09', 'Travesía Calella de Palafrugell', 'open_water', 4800, 98, 63, 136, 22.0, true, 'Pacing excelente y ritmo constante.'),
  createSwim('act-18', '2026-07-03', 'Series 30x100m c/ 1:35 en piscina 50m', 'pool', 4000, 91, 68, 155, 27.0, false, 'Ritmo de competición clavado.'),

  // June 2026 (1 year out from Oceanman)
  createSwim('act-17', '2026-06-27', 'Test 1 Año para Oceanman 14K (Lago)', 'open_water', 7000, 101, 61, 140, 20.0, true, 'Evaluación inicial a 12 meses vista del lago d\'Orta.'),
  createSwim('act-16', '2026-06-22', 'Piscina Aeróbica 4k', 'pool', 4000, 96, 65, 139, 27.0, false, 'Fondo continuo.'),
  createSwim('act-15', '2026-06-16', 'Aguas Abiertas Salou', 'open_water', 5000, 100, 62, 136, 21.0, true, 'Nado en grupo con drafting.'),
  createSwim('act-14', '2026-06-10', 'Test CSS Trimestral', 'pool', 3500, 91, 67, 157, 27.0, false, 'CSS: 1:34/100m.'),
  createSwim('act-13', '2026-06-03', 'Fondo Z2 con palas medianas', 'pool', 3800, 94, 63, 138, 27.0, false, 'Buenas sensaciones de agarre.'),

  // Earlier base training (Spring 2026)
  createSwim('act-12', '2026-05-27', 'Primera Salida Aguas Abiertas Primavera', 'open_water', 3800, 104, 60, 135, 17.0, true, 'Agua fría 17°C, aclimatación neopreno 4mm.'),
  createSwim('act-11', '2026-05-20', 'Piscina 4000m resistencia aeróbica', 'pool', 4000, 97, 64, 141, 27.0, false, 'Trabajo de cadencia constante.'),
  createSwim('act-10', '2026-05-12', 'Series 12x200m progresivas', 'pool', 3600, 93, 67, 150, 27.0, false, 'De 3:15 a 3:00.'),
  createSwim('act-09', '2026-05-04', 'Recuperación & Deslizamiento DPS', 'pool', 2800, 105, 58, 124, 27.0, false, 'Foco en DPS > 1.90m.'),
  createSwim('act-08', '2026-04-26', 'Piscina Fondo 4500m', 'pool', 4500, 98, 64, 140, 27.0, false, 'Bloque de carga de volumen.'),
  createSwim('act-07', '2026-04-18', 'Intervalos 20x100m ritmo carrera', 'pool', 3200, 92, 68, 153, 27.0, false, 'Umbral anaeróbico.'),
  createSwim('act-06', '2026-04-10', 'Sesión Técnica Batido 2T y Respiración 3:1', 'pool', 3000, 103, 60, 128, 27.0, false, 'Respiración simétrica.'),
  createSwim('act-05', '2026-03-30', 'Piscina Fondo 5000m continuo', 'pool', 5000, 99, 63, 142, 27.0, false, 'Construcción de base invernal.'),
  createSwim('act-04', '2026-03-20', 'Series de fuerza acuática con esponjas', 'pool', 3400, 96, 65, 148, 27.0, false, 'Resistencia al avance.'),
  createSwim('act-03', '2026-03-11', 'Test CSS Inicial', 'pool', 3000, 95, 66, 156, 27.0, false, 'CSS inicial: 1:37/100m.'),
  createSwim('act-02', '2026-03-02', 'Volumen Aeróbico Base', 'pool', 3500, 101, 63, 137, 27.0, false, 'Arranque del ciclo anual.'),
  createSwim('act-01', '2026-02-20', 'Retorno a los entrenos tras pretemporada', 'pool', 2500, 106, 61, 130, 27.0, false, 'Adaptación neuromuscular.'),
];

/**
 * A smaller intermediate progression profile for testing profile switching
 */
export const INTERMEDIATE_SWIMMER_ACTIVITIES: SwimActivity[] = [
  createSwim('int-06', '2026-10-18', 'Piscina 3000m Fondo', 'pool', 3000, 114, 62, 144, 27.0, false, 'Ritmo 1:54/100m.'),
  createSwim('int-05', '2026-10-14', 'Series 10x100m c/ 2:10', 'pool', 2500, 110, 65, 152, 27.0, false, 'Buenas series.'),
  createSwim('int-04', '2026-10-09', 'Primera Travesía Playa Bogatell', 'open_water', 3200, 118, 59, 147, 20.0, true, 'Sensación de fatiga al final.'),
  createSwim('int-03', '2026-10-03', 'Piscina 2500m Técnica', 'pool', 2500, 120, 58, 135, 27.0, false, 'Poco a poco mejorando agarre.'),
  createSwim('int-02', '2026-09-28', 'Tirada 4000m Piscina', 'pool', 4000, 116, 61, 143, 27.0, false, 'Mayor distancia hasta la fecha.'),
  createSwim('int-01', '2026-09-20', 'Series Variadas 2000m', 'pool', 2000, 112, 64, 149, 27.0, false, 'Arranque preparación.'),
];

export const SAMPLE_STRAVA_CSV_CONTENT = `Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Moving Time,Distance,Elevation High,Elevation Low,Elevation Gain,Average Heart Rate,Max Heart Rate,Calories
10982711,"2026-10-22 08:30:00","Test 10K Ultrafondo Lago Banyoles (Simulación Oceanman)",Swim,10500,9700,10000,175.4,172.0,5.0,142,156,3200
10972412,"2026-10-19 19:15:00","Series Umbral 10x400m c/ 5:45 (Piscina 50m)",Swim,4800,4140,4500,0.0,0.0,0.0,154,168,1260
10951239,"2026-10-16 09:00:00","Travesía Matinal Costa Brava (Tossa - Cala Pola)",Swim,6400,5950,6200,14.8,0.5,12.0,138,150,1980
10930194,"2026-10-13 18:30:00","Recuperación Activa & Técnica Deslizamiento",Swim,3500,3320,3200,0.0,0.0,0.0,126,138,890
10919283,"2026-10-10 10:00:00","Tirada Fondo Aeróbico Embalse de Sau",Swim,7800,7350,7500,420.2,418.0,4.0,139,152,2400
10901122,"2026-10-08 07:00:00","Rodaje Suave en Bicicleta (Descarga)",Ride,5400,5100,32000,150.0,40.0,320.0,118,135,720
10892834,"2026-10-06 19:00:00","Bloque CSS: 400m + 200m Max + 20x100m",Swim,4200,3600,4000,0.0,0.0,0.0,158,172,1120
10871294,"2026-09-29 08:30:00","Travesía Larga Sitges - Vilanova",Swim,8600,8120,8200,12.4,0.0,8.0,141,155,2620
10850123,"2026-09-25 19:30:00","Piscina Olímpica: Pirámide 200-400-800-400-200",Swim,4500,3900,4200,0.0,0.0,0.0,149,163,1180
10829102,"2026-09-21 09:15:00","Nado Continuo Z2 Platja Llarga",Swim,5200,4900,5000,16.2,1.2,10.0,135,148,1600
10809182,"2026-08-28 07:30:00","Test 12.000m Ultra Marathon Swim Embalse",Swim,12800,12000,12000,310.5,308.0,6.0,143,158,3840`;
