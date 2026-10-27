/**
 * Strava & Garmin Export Parser
 * Handles:
 * - Strava Export .ZIP archive (reads activities.csv or .gpx/.tcx files inside)
 * - Raw activities.csv
 * - Direct .gpx files (GPS Exchange Format)
 * - Direct .tcx files (Training Center XML)
 */
import JSZip from 'jszip';
import { SwimActivity } from '../types/swim.ts';
import { parseStravaCsv } from './swimCalculators.ts';

// Haversine formula to calculate distance between two GPS coordinates in meters
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Parse an individual GPX XML string into a SwimActivity
 */
export function parseGpxString(gpxText: string, filename: string = 'swim.gpx'): SwimActivity | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxText, 'text/xml');

    // Check if valid XML
    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length > 0) return null;

    const trkpts = xmlDoc.getElementsByTagName('trkpt');
    if (trkpts.length < 2) return null;

    let totalDistMeters = 0;
    let prevLat: number | null = null;
    let prevLon: number | null = null;
    let firstTime: Date | null = null;
    let lastTime: Date | null = null;
    let hrSum = 0;
    let hrCount = 0;
    let cadSum = 0;
    let cadCount = 0;

    for (let i = 0; i < trkpts.length; i++) {
      const pt = trkpts[i];
      const lat = parseFloat(pt.getAttribute('lat') || '');
      const lon = parseFloat(pt.getAttribute('lon') || '');
      if (isNaN(lat) || isNaN(lon)) continue;

      if (prevLat !== null && prevLon !== null) {
        const d = haversineDistance(prevLat, prevLon, lat, lon);
        // Filter out extreme GPS jumps (> 25m in 1 sec while swimming)
        if (d < 50) {
          totalDistMeters += d;
        }
      }
      prevLat = lat;
      prevLon = lon;

      const timeEl = pt.getElementsByTagName('time')[0];
      if (timeEl && timeEl.textContent) {
        const t = new Date(timeEl.textContent);
        if (!isNaN(t.getTime())) {
          if (!firstTime) firstTime = t;
          lastTime = t;
        }
      }

      // Check cadence extensions
      const cadEl = pt.getElementsByTagName('cad')[0] || pt.getElementsByTagName('ns3:cad')[0] || pt.getElementsByTagName('gpxtpx:cad')[0];
      if (cadEl && cadEl.textContent) {
        const c = parseInt(cadEl.textContent, 10);
        if (!isNaN(c) && c > 20 && c < 120) {
          cadSum += c;
          cadCount++;
        }
      }

      // Check heart rate extensions
      const hrEl = pt.getElementsByTagName('hr')[0] || pt.getElementsByTagName('ns3:hr')[0] || pt.getElementsByTagName('gpxtpx:hr')[0];
      if (hrEl && hrEl.textContent) {
        const h = parseInt(hrEl.textContent, 10);
        if (!isNaN(h) && h > 60 && h < 220) {
          hrSum += h;
          hrCount++;
        }
      }
    }

    if (totalDistMeters < 100) return null;

    const elapsedTime = firstTime && lastTime
      ? Math.max(0, Math.round((lastTime.getTime() - firstTime.getTime()) / 1000))
      : 0;
    const avgCadence = cadCount > 0 ? Math.round(cadSum / cadCount) : undefined;
    const avgHr = hrCount > 0 ? Math.round(hrSum / hrCount) : undefined;

    // Title from <name> tag or filename
    const nameEl = xmlDoc.getElementsByTagName('name')[0];
    const title = (nameEl && nameEl.textContent) ? nameEl.textContent.trim() : filename.replace(/\.gpx$/i, '');
    const dateStr = firstTime
      ? `${firstTime.getFullYear()}-${String(firstTime.getMonth() + 1).padStart(2, '0')}-${String(firstTime.getDate()).padStart(2, '0')}`
      : '';

    return {
      id: `gpx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: dateStr,
      startedAt: firstTime?.toISOString(),
      title: title || 'Travesía GPS Aguas Abiertas',
      type: 'unknown',
      distance: Math.round(totalDistMeters),
      elapsedTime,
      movingTime: 0,
      hasRecordedElapsedTime: elapsedTime > 0,
      hasRecordedMovingTime: false,
      pacePer100m: 0,
      averageCadence: avgCadence,
      hasRecordedCadence: cadCount > 0,
      avgHeartRate: avgHr,
      source: 'gpx',
    };
  } catch (err) {
    console.error('Error parsing GPX:', err);
    return null;
  }
}

/**
 * Parse an individual TCX XML string into a SwimActivity
 */
export function parseTcxString(tcxText: string, filename: string = 'swim.tcx'): SwimActivity | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(tcxText, 'text/xml');

    const parserError = xmlDoc.getElementsByTagName('parsererror');
    if (parserError.length > 0) return null;

    const trackpoints = xmlDoc.getElementsByTagName('Trackpoint');
    if (trackpoints.length < 2) return null;

    let totalDist = 0;
    let firstTime: Date | null = null;
    let lastTime: Date | null = null;
    let cadSum = 0;
    let cadCount = 0;
    let hrSum = 0;
    let hrCount = 0;

    for (let i = 0; i < trackpoints.length; i++) {
      const tp = trackpoints[i];
      const distEl = tp.getElementsByTagName('DistanceMeters')[0];
      if (distEl && distEl.textContent) {
        const d = parseFloat(distEl.textContent);
        if (!isNaN(d) && d > totalDist) totalDist = d;
      }

      const timeEl = tp.getElementsByTagName('Time')[0];
      if (timeEl && timeEl.textContent) {
        const t = new Date(timeEl.textContent);
        if (!isNaN(t.getTime())) {
          if (!firstTime) firstTime = t;
          lastTime = t;
        }
      }

      const cadEl = tp.getElementsByTagName('Cadence')[0];
      if (cadEl && cadEl.textContent) {
        const c = parseInt(cadEl.textContent, 10);
        if (!isNaN(c) && c > 20) {
          cadSum += c;
          cadCount++;
        }
      }

      const hrEl = tp.getElementsByTagName('Value')[0];
      if (hrEl && hrEl.textContent) {
        const h = parseInt(hrEl.textContent, 10);
        if (!isNaN(h) && h > 50 && h < 220) {
          hrSum += h;
          hrCount++;
        }
      }
    }

    if (totalDist < 100) return null;

    const elapsedTime = firstTime && lastTime
      ? Math.max(0, Math.round((lastTime.getTime() - firstTime.getTime()) / 1000))
      : 0;
    const avgCadence = cadCount > 0 ? Math.round(cadSum / cadCount) : undefined;

    const dateStr = firstTime
      ? `${firstTime.getFullYear()}-${String(firstTime.getMonth() + 1).padStart(2, '0')}-${String(firstTime.getDate()).padStart(2, '0')}`
      : '';
    const title = filename.replace(/\.tcx$/i, '') || 'Entrenamiento Natación Garmin';

    return {
      id: `tcx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: dateStr,
      startedAt: firstTime?.toISOString(),
      title,
      type: 'unknown',
      distance: Math.round(totalDist),
      elapsedTime,
      movingTime: 0,
      hasRecordedElapsedTime: elapsedTime > 0,
      hasRecordedMovingTime: false,
      pacePer100m: 0,
      averageCadence: avgCadence,
      hasRecordedCadence: cadCount > 0,
      avgHeartRate: hrCount > 0 ? Math.round(hrSum / hrCount) : undefined,
      source: 'tcx',
    };
  } catch (err) {
    console.error('Error parsing TCX:', err);
    return null;
  }
}

/**
 * Universal archive / multi-file parser
 * Handles Strava ZIP files, GPX files, TCX files, or CSV files
 */
export async function parseStravaExportFile(
  file: File,
  onProgress?: (status: string) => void
): Promise<{ activities: SwimActivity[]; summary: string }> {
  const fileName = String((file && file.name) || '').toLowerCase();

  // 1. Direct ZIP file from Strava bulk download
  if (fileName.endsWith('.zip')) {
    onProgress?.('Descomprimiendo archivo ZIP de Strava...');
    const zip = await JSZip.loadAsync(file);

    // First search for activities.csv (standard Strava root or subfolder file)
    let csvFile: JSZip.JSZipObject | null = null;
    const gpxFiles: JSZip.JSZipObject[] = [];
    const tcxFiles: JSZip.JSZipObject[] = [];

    zip.forEach((relativePath, zipEntry) => {
      const lower = String(relativePath || '').toLowerCase();
      if (lower.endsWith('activities.csv')) {
        csvFile = zipEntry;
      } else if (lower.endsWith('.gpx')) {
        gpxFiles.push(zipEntry);
      } else if (lower.endsWith('.tcx')) {
        tcxFiles.push(zipEntry);
      }
    });

    if (csvFile) {
      onProgress?.('activities.csv encontrado. Procesando catálogo de actividades...');
      const csvText = await (csvFile as JSZip.JSZipObject).async('text');
      const activities = parseStravaCsv(csvText);
      return {
        activities,
        summary: `Se procesó el archivo ZIP de Strava: se leyó activities.csv y se detectaron ${activities.length} sesiones de natación.`,
      };
    }

    // If no CSV file, try reading GPX/TCX tracks inside the zip
    if (gpxFiles.length > 0 || tcxFiles.length > 0) {
      onProgress?.(`Analizando ${gpxFiles.length + tcxFiles.length} archivos de ruta GPS en el ZIP...`);
      const parsedTracks: SwimActivity[] = [];

      for (const entry of gpxFiles.slice(0, 50)) { // parse up to 50 tracks
        const gpxText = await entry.async('text');
        const act = parseGpxString(gpxText, entry.name);
        if (act) parsedTracks.push(act);
      }

      for (const entry of tcxFiles.slice(0, 50)) {
        const tcxText = await entry.async('text');
        const act = parseTcxString(tcxText, entry.name);
        if (act) parsedTracks.push(act);
      }

      parsedTracks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return {
        activities: parsedTracks,
        summary: `Se procesó el archivo ZIP de Strava: se analizaron ${parsedTracks.length} sesiones de natación a partir de archivos de ruta GPX/TCX.`,
      };
    }

    throw new Error('El archivo ZIP no contiene un archivo activities.csv ni archivos de ruta GPX/TCX legibles.');
  }

  // 2. Direct CSV file
  if (fileName.endsWith('.csv') || fileName.endsWith('.txt')) {
    onProgress?.('Analizando archivo CSV...');
    const text = await file.text();
    const activities = parseStravaCsv(text);
    return {
      activities,
      summary: `Se importó el archivo CSV: se detectaron ${activities.length} sesiones de natación.`,
    };
  }

  // 3. Direct GPX file
  if (fileName.endsWith('.gpx')) {
    onProgress?.('Analizando archivo GPX...');
    const text = await file.text();
    const act = parseGpxString(text, file.name);
    if (!act) throw new Error('No se pudieron extraer datos de natación válidos del archivo GPX.');
    return {
      activities: [act],
      summary: `Se importó la sesión GPS: ${act.title} (${act.distance}m, ritmo ${act.pacePer100m}s/100m).`,
    };
  }

  // 4. Direct TCX file
  if (fileName.endsWith('.tcx')) {
    onProgress?.('Analizando archivo TCX...');
    const text = await file.text();
    const act = parseTcxString(text, file.name);
    if (!act) throw new Error('No se pudieron extraer datos de natación válidos del archivo TCX.');
    return {
      activities: [act],
      summary: `Se importó la sesión Garmin: ${act.title} (${act.distance}m).`,
    };
  }

  throw new Error('Formato no reconocido. Por favor, sube un archivo .zip de exportación de Strava, .csv, .gpx o .tcx.');
}
