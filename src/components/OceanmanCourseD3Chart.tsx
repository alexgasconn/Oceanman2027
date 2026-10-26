import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  Waves, 
  MapPin, 
  Anchor, 
  ShieldCheck, 
  Clock, 
  Compass, 
  Layers, 
  Sparkles, 
  ChevronRight,
  Info
} from 'lucide-react';
import { formatDuration, formatPace } from '../utils/swimCalculators.ts';

export interface CourseDataPoint {
  km: number;
  name: string;
  depthMeters: number; // Positive depth below surface
  surfaceElevMeters: number; // Lake Orta surface is 290m ASL
  lakebedElevMeters: number; // 290m - depthMeters
  isOfficialFeedStation?: boolean;
  officialFeedName?: string;
  isCutoffPoint?: boolean;
  cutoffSec?: number | null;
  cutoffStr?: string;
  notes?: string;
  waterCurrent?: string;
  // Geographic approximation coordinates in SVG space for the lake map
  mapX: number;
  mapY: number;
}

// Highly accurate geographic & bathymetric profile for Lake d'Orta 14 km route (Omegna -> Lido di Gozzano)
export const LAKE_ORTA_PROFILE: CourseDataPoint[] = [
  {
    km: 0.0,
    name: "Omegna (Piazza Salvo d'Acquisto)",
    depthMeters: 15,
    surfaceElevMeters: 290,
    lakebedElevMeters: 275,
    isCutoffPoint: true,
    cutoffStr: "Salida Oficial 09:30 AM",
    cutoffSec: 0,
    notes: "Punto de salida oficial. Aguas tranquilas en el extremo norte. Zona protegida del golfo de Omegna.",
    waterCurrent: "Corriente casi nula matinal",
    mapX: 180,
    mapY: 35
  },
  {
    km: 1.0,
    name: "Golfo de Bagnella",
    depthMeters: 38,
    surfaceElevMeters: 290,
    lakebedElevMeters: 252,
    notes: "Apertura del lago hacia el canal principal. Descenso gradual del lecho glaciar.",
    waterCurrent: "Aguas calmas",
    mapX: 195,
    mapY: 75
  },
  {
    km: 2.5,
    name: "Estrecho de Oira (Nonio)",
    depthMeters: 75,
    surfaceElevMeters: 290,
    lakebedElevMeters: 215,
    notes: "Paso entre las laderas rocosas occidentales de Nonio. Profundidad superando los 70 metros.",
    waterCurrent: "Ligera brisa de valle",
    mapX: 205,
    mapY: 135
  },
  {
    km: 4.0,
    name: "Canal Central hacia Ronco",
    depthMeters: 102,
    surfaceElevMeters: 290,
    lakebedElevMeters: 188,
    notes: "Zona abierta con boyas de orientación amarillas de alta visibilidad.",
    waterCurrent: "Brisa térmica suave",
    mapX: 210,
    mapY: 195
  },
  {
    km: 5.0,
    name: "Ronco · 1ª Estación Flotante & Corte 1",
    depthMeters: 112,
    surfaceElevMeters: 290,
    lakebedElevMeters: 178,
    isOfficialFeedStation: true,
    officialFeedName: "Estación Flotante #1 (Km 5.0)",
    isCutoffPoint: true,
    cutoffSec: 2 * 3600 + 15 * 60, // 2h 15m
    cutoffStr: "2h 15m (11:45 AM)",
    notes: "Plataforma oficial de la organización. Primer corte eliminatorio. Suministro oficial de agua mineral y geles de carbohidratos.",
    waterCurrent: "Zona de oleaje suave",
    mapX: 200,
    mapY: 245
  },
  {
    km: 6.5,
    name: "Frente a Pettenasco",
    depthMeters: 128,
    surfaceElevMeters: 290,
    lakebedElevMeters: 162,
    notes: "Aguas profundas cristalinas de origen glaciar. La orilla oriental queda a ~600m.",
    waterCurrent: "Oleaje térmico moderado",
    mapX: 220,
    mapY: 305
  },
  {
    km: 8.5,
    name: "Paso de Isola San Giulio & Pella",
    depthMeters: 143,
    surfaceElevMeters: 290,
    lakebedElevMeters: 147,
    notes: "Punto más emblemático y profundo de la prueba (-143m de abismo subacuático). Vistas panorámicas a la mística basílica de San Giulio.",
    waterCurrent: "Canal encajonado, viento cruzado",
    mapX: 215,
    mapY: 385
  },
  {
    km: 10.0,
    name: "Buccione · 2ª Estación Flotante & Corte 2",
    depthMeters: 62,
    surfaceElevMeters: 290,
    lakebedElevMeters: 228,
    isOfficialFeedStation: true,
    officialFeedName: "Estación Flotante #2 (Km 10.0)",
    isCutoffPoint: true,
    cutoffSec: 4 * 3600 + 30 * 60, // 4h 30m
    cutoffStr: "4h 30m (02:00 PM)",
    notes: "Segunda y última estación oficial de avituallamiento flotante. Último corte de seguridad antes del tramo decisivo.",
    waterCurrent: "Aguas más abrigadas del golfo sur",
    mapX: 225,
    mapY: 450
  },
  {
    km: 11.5,
    name: "Entrada a la Bahía de Lagna / Gozzano",
    depthMeters: 35,
    surfaceElevMeters: 290,
    lakebedElevMeters: 255,
    notes: "Reducción paulatina de la profundidad. El lecho arenoso y rocoso comienza a elevarse.",
    waterCurrent: "Aguas tranquilas",
    mapX: 215,
    mapY: 515
  },
  {
    km: 13.0,
    name: "Aproximación a Lido di Gozzano",
    depthMeters: 12,
    surfaceElevMeters: 290,
    lakebedElevMeters: 278,
    notes: "Canal delimitado por boyas rojas finales. Comienza a vislumbrarse el arco de meta en la playa.",
    waterCurrent: "Aguas poco profundas, temperatura sube ~0.5°C",
    mapX: 220,
    mapY: 580
  },
  {
    km: 14.0,
    name: "Playa Lido di Gozzano · Meta Oficial",
    depthMeters: 2,
    surfaceElevMeters: 290,
    lakebedElevMeters: 288,
    isCutoffPoint: true,
    cutoffSec: 6 * 3600, // 6h 00m
    cutoffStr: "6h 00m (03:30 PM)",
    notes: "Meta triunfal de los 14 km. Salida del agua a pie sobre la arena, campana de finisher y zona de recuperación.",
    waterCurrent: "Zona de orilla",
    mapX: 230,
    mapY: 630
  }
];

// Coastline coordinates for SVG rendering of Lake Orta
const LAKE_COASTLINE_EAST = [
  { x: 180, y: 35 },
  { x: 210, y: 55 },
  { x: 235, y: 100 },
  { x: 245, y: 160 },
  { x: 255, y: 220 },
  { x: 265, y: 280 }, // Pettenasco
  { x: 250, y: 340 },
  { x: 275, y: 390 }, // Orta peninsula
  { x: 255, y: 440 },
  { x: 250, y: 500 }, // Corconio / Buccione
  { x: 255, y: 560 },
  { x: 245, y: 610 },
  { x: 230, y: 630 }, // Lido di Gozzano
];

const LAKE_COASTLINE_WEST = [
  { x: 180, y: 35 },
  { x: 165, y: 70 },
  { x: 170, y: 120 }, // Nonio
  { x: 165, y: 180 },
  { x: 160, y: 240 }, // Ronco
  { x: 170, y: 300 },
  { x: 165, y: 370 }, // Pella
  { x: 175, y: 430 },
  { x: 180, y: 490 }, // San Maurizio / Lagna
  { x: 195, y: 550 },
  { x: 210, y: 600 },
  { x: 230, y: 630 },
];

interface OceanmanCourseD3ChartProps {
  targetPaceSec: number;
  effectivePaceSec: number;
  feedIntervalMin?: number;
  feedStopSec?: number;
  station1PauseSec?: number;
  station2PauseSec?: number;
  wetsuit: boolean;
  lakeCondition: 'calm' | 'light_chop' | 'headwind';
}

export const OceanmanCourseD3Chart: React.FC<OceanmanCourseD3ChartProps> = ({
  targetPaceSec,
  effectivePaceSec,
  feedIntervalMin = 45,
  feedStopSec = 45,
  station1PauseSec = 45,
  station2PauseSec = 90,
  wetsuit,
  lakeCondition,
}) => {
  const [viewMode, setViewMode] = useState<'profile' | 'map' | 'dual'>('dual');
  const [showAutonomousFeeds, setShowAutonomousFeeds] = useState<boolean>(true);
  const [showCutoffs, setShowCutoffs] = useState<boolean>(true);
  const [selectedMilestone, setSelectedMilestone] = useState<CourseDataPoint | null>(LAKE_ORTA_PROFILE[4]); // Default to feed 1

  const profileSvgRef = useRef<SVGSVGElement | null>(null);
  const mapSvgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Compute personal autonomous feed stops based on pace and feedIntervalMin
  const personalFeedStops = useMemo(() => {
    const stops: Array<{
      id: string;
      stopNumber: number;
      elapsedMin: number;
      km: number;
      clockTime: string;
      desc: string;
      suggestedCarbs: string;
    }> = [];

    const totalRaceSec = (14000 / 100) * effectivePaceSec;
    const totalMinutes = Math.floor(totalRaceSec / 60);
    const numStops = Math.floor(totalMinutes / feedIntervalMin);

    for (let i = 1; i <= numStops; i++) {
      const elapsedMin = i * feedIntervalMin;
      const elapsedSec = elapsedMin * 60;
      // Distance covered at effective pace
      const distanceM = Math.min(13900, Math.round((elapsedSec / effectivePaceSec) * 100));
      const km = Number((distanceM / 1000).toFixed(2));

      // Clock time starting at 09:30 AM
      const startMinutes = 9 * 60 + 30;
      const currentMin = startMinutes + elapsedMin;
      const h = Math.floor(currentMin / 60);
      const m = currentMin % 60;
      const clockTime = `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`;

      let suggestedCarbs = 'Gel de 30-40g Carbohidratos + 150ml Agua con electrolitos desde la boya';
      if (km >= 4.5 && km <= 5.5) {
        suggestedCarbs = '¡Coincide con Estación Flotante #1! Aprovecha para beber agua fresca en vaso y gel isotónico.';
      } else if (km >= 9.5 && km <= 10.5) {
        suggestedCarbs = '¡Coincide con Estación Flotante #2! Consume gel con cafeína (75-100mg) y sales concentradas.';
      } else if (i === 1) {
        suggestedCarbs = 'Primer aporte glucídico (Gel suave 30g HC) para mantener glucemia estable.';
      } else if (i >= 5) {
        suggestedCarbs = 'Gel de rápida absorción + pastilla de sal masticable para prevenir calambres musculares.';
      }

      stops.push({
        id: `feed-personal-${i}`,
        stopNumber: i,
        elapsedMin,
        km,
        clockTime,
        desc: `Parada #${i} en boya (${elapsedMin} min · ${km} km)`,
        suggestedCarbs,
      });
    }

    return stops;
  }, [effectivePaceSec, feedIntervalMin]);

  // Interpolation helper for bathymetry depth at any km
  const getDepthAtKm = (km: number) => {
    for (let i = 0; i < LAKE_ORTA_PROFILE.length - 1; i++) {
      const p1 = LAKE_ORTA_PROFILE[i];
      const p2 = LAKE_ORTA_PROFILE[i + 1];
      if (km >= p1.km && km <= p2.km) {
        const ratio = (km - p1.km) / (p2.km - p1.km);
        return p1.depthMeters + ratio * (p2.depthMeters - p1.depthMeters);
      }
    }
    return 15;
  };

  // ----------------------------------------------------
  // D3 RENDERING: ELEVATION & BATHYMETRIC PROFILE
  // ----------------------------------------------------
  useEffect(() => {
    if (!profileSvgRef.current) return;
    const svg = d3.select(profileSvgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const width = 800;
    const height = 340;
    const margin = { top: 35, right: 60, bottom: 50, left: 65 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear().domain([0, 14]).range([0, innerWidth]);
    // Depth: from 0m (lake surface, 290m ASL) down to 155m depth (135m ASL)
    const yScale = d3.scaleLinear().domain([0, 155]).range([0, innerHeight]);
    // Elevation scale for right axis
    const yElevScale = d3.scaleLinear().domain([290, 135]).range([0, innerHeight]);

    // Gradient definitions
    const defs = svg.append('defs');

    // Deep water bathymetric vertical gradient
    const waterGradient = defs.append('linearGradient')
      .attr('id', 'lake-water-grad')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    waterGradient.append('stop').attr('offset', '0%').attr('stop-color', '#0284c7').attr('stop-opacity', 0.65);
    waterGradient.append('stop').attr('offset', '40%').attr('stop-color', '#0369a1').attr('stop-opacity', 0.85);
    waterGradient.append('stop').attr('offset', '100%').attr('stop-color', '#082f49').attr('stop-opacity', 0.98);

    // Lakebed bedrock pattern/gradient
    const bedGradient = defs.append('linearGradient')
      .attr('id', 'lakebed-grad')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    bedGradient.append('stop').attr('offset', '0%').attr('stop-color', '#1e293b').attr('stop-opacity', 0.95);
    bedGradient.append('stop').attr('offset', '100%').attr('stop-color', '#0f172a').attr('stop-opacity', 1.0);

    // Grid lines
    const yTicks = [0, 30, 60, 90, 120, 143];
    g.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#334155')
      .attr('stroke-dasharray', '2,3')
      .attr('stroke-opacity', 0.5);

    // X axis grid
    const xTicks = [0, 2, 4, 6, 8, 10, 12, 14];
    g.append('g')
      .selectAll('line')
      .data(xTicks)
      .enter()
      .append('line')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#334155')
      .attr('stroke-dasharray', '2,4')
      .attr('stroke-opacity', 0.4);

    // Lakebed Area generator
    const lakebedArea = d3.area<CourseDataPoint>()
      .x(d => xScale(d.km))
      .y0(d => yScale(d.depthMeters))
      .y1(innerHeight)
      .curve(d3.curveMonotoneX);

    // Lake water Area generator
    const waterArea = d3.area<CourseDataPoint>()
      .x(d => xScale(d.km))
      .y0(0) // Lake surface
      .y1(d => yScale(d.depthMeters))
      .curve(d3.curveMonotoneX);

    // Lakebed Line generator
    const lakebedLine = d3.line<CourseDataPoint>()
      .x(d => xScale(d.km))
      .y(d => yScale(d.depthMeters))
      .curve(d3.curveMonotoneX);

    // Draw Water Mass
    g.append('path')
      .datum(LAKE_ORTA_PROFILE)
      .attr('fill', 'url(#lake-water-grad)')
      .attr('d', waterArea);

    // Draw Lakebed Rock Foundation
    g.append('path')
      .datum(LAKE_ORTA_PROFILE)
      .attr('fill', 'url(#lakebed-grad)')
      .attr('d', lakebedArea);

    // Draw Lakebed outline stroke
    g.append('path')
      .datum(LAKE_ORTA_PROFILE)
      .attr('fill', 'none')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 2.5)
      .attr('stroke-opacity', 0.8)
      .attr('d', lakebedLine);

    // Water Surface Line (290m ASL)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', '#06b6d4')
      .attr('stroke-width', 3)
      .attr('filter', 'drop-shadow(0 0 4px #06b6d4)');

    // Surface wave ripples
    const wavePoints: [number, number][] = [];
    for (let x = 0; x <= innerWidth; x += 15) {
      wavePoints.push([x, Math.sin(x * 0.15) * 2]);
    }
    const waveLine = d3.line<[number, number]>().x(d => d[0]).y(d => d[1]).curve(d3.curveBasis);
    g.append('path')
      .datum(wavePoints)
      .attr('fill', 'none')
      .attr('stroke', '#67e8f9')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.8)
      .attr('d', waveLine);

    // Surface Label (290m ASL)
    g.append('text')
      .attr('x', 6)
      .attr('y', -10)
      .attr('fill', '#38bdf8')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'ui-monospace, monospace')
      .text('Superficie del Lago d\'Orta · 290 m s.n.m.');

    // Max Depth Abyss Label at Km 8.5
    const abyssX = xScale(8.5);
    const abyssY = yScale(143);
    g.append('line')
      .attr('x1', abyssX)
      .attr('x2', abyssX)
      .attr('y1', abyssY - 25)
      .attr('y2', abyssY - 4)
      .attr('stroke', '#f43f5e')
      .attr('stroke-width', 1.5);

    g.append('circle')
      .attr('cx', abyssX)
      .attr('cy', abyssY)
      .attr('r', 4.5)
      .attr('fill', '#f43f5e')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5);

    g.append('text')
      .attr('x', abyssX)
      .attr('y', abyssY - 30)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fda4af')
      .attr('font-size', '9.5px')
      .attr('font-weight', 'bold')
      .text('Fosa Máx. -143m (Isola San Giulio)');

    // ----------------------------------------------------
    // STRATEGIC FEED STATIONS & CUT-OFFS (Km 5 & Km 10)
    // ----------------------------------------------------
    const officialStations = LAKE_ORTA_PROFILE.filter(p => p.isOfficialFeedStation);

    officialStations.forEach((station) => {
      const sx = xScale(station.km);
      const syBottom = yScale(station.depthMeters);

      // Beacon vertical dashed line
      g.append('line')
        .attr('x1', sx)
        .attr('x2', sx)
        .attr('y1', -18)
        .attr('y2', syBottom)
        .attr('stroke', '#10b981')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,3')
        .attr('stroke-opacity', 0.9);

      // Floating platform symbol on water surface
      const platformGroup = g.append('g')
        .attr('transform', `translate(${sx}, 0)`)
        .attr('cursor', 'pointer')
        .on('click', () => setSelectedMilestone(station));

      // Floating buoy badge
      platformGroup.append('rect')
        .attr('x', -32)
        .attr('y', -30)
        .attr('width', 64)
        .attr('height', 24)
        .attr('rx', 6)
        .attr('fill', '#064e3b')
        .attr('stroke', '#34d399')
        .attr('stroke-width', 1.5);

      platformGroup.append('text')
        .attr('x', 0)
        .attr('y', -14)
        .attr('text-anchor', 'middle')
        .attr('fill', '#a7f3d0')
        .attr('font-size', '9.5px')
        .attr('font-weight', 'bold')
        .attr('font-family', 'ui-monospace, monospace')
        .text(`FEED #${station.km === 5 ? '1' : '2'} (${station.km}K)`);

      // Anchor line to bottom
      platformGroup.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 5)
        .attr('fill', '#10b981')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1.5);

      // Floating station badge banner
      if (showCutoffs && station.cutoffStr) {
        platformGroup.append('text')
          .attr('x', 0)
          .attr('y', 18)
          .attr('text-anchor', 'middle')
          .attr('fill', '#fbbf24')
          .attr('font-size', '8.5px')
          .attr('font-weight', 'semibold')
          .text(`Corte: ${station.cutoffStr}`);
      }
    });

    // ----------------------------------------------------
    // PERSONAL AUTONOMOUS BUOY FEED STOPS
    // ----------------------------------------------------
    if (showAutonomousFeeds) {
      personalFeedStops.forEach((stop) => {
        // Skip if right on top of official feed stations to prevent overlap
        if (Math.abs(stop.km - 5.0) < 0.25 || Math.abs(stop.km - 10.0) < 0.25) return;
        const bx = xScale(stop.km);

        const buoyG = g.append('g')
          .attr('transform', `translate(${bx}, 0)`)
          .attr('cursor', 'pointer')
          .on('click', () => {
            setSelectedMilestone({
              km: stop.km,
              name: `Boya Personal · Parada #${stop.stopNumber}`,
              depthMeters: Math.round(getDepthAtKm(stop.km)),
              surfaceElevMeters: 290,
              lakebedElevMeters: 290 - Math.round(getDepthAtKm(stop.km)),
              notes: `${stop.suggestedCarbs} (Hora estimada: ${stop.clockTime})`,
              waterCurrent: "Avituallamiento autónomo en flotación",
              mapX: 0,
              mapY: 0
            });
          });

        // Pulsing buoy circle
        buoyG.append('circle')
          .attr('cx', 0)
          .attr('cy', -2)
          .attr('r', 4.5)
          .attr('fill', '#f59e0b')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.2);

        // Small tag
        buoyG.append('text')
          .attr('x', 0)
          .attr('y', -10)
          .attr('text-anchor', 'middle')
          .attr('fill', '#fcd34d')
          .attr('font-size', '8px')
          .attr('font-weight', 'bold')
          .text(`${stop.elapsedMin}'`);
      });
    }

    // ----------------------------------------------------
    // AXES
    // ----------------------------------------------------
    // Bottom X-Axis (Distance in Km)
    const xAxis = d3.axisBottom(xScale)
      .tickValues([0, 1, 2.5, 4, 5, 6.5, 8.5, 10, 11.5, 13, 14])
      .tickFormat(d => `${d}k`);

    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .attr('color', '#64748b')
      .call(g => g.select('.domain').attr('stroke', '#475569'))
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('font-size', '9.5px');

    // Left Y-Axis (Depth in meters)
    const yAxisLeft = d3.axisLeft(yScale)
      .tickValues([0, 30, 60, 90, 120, 143])
      .tickFormat(d => `-${d}m`);

    g.append('g')
      .call(yAxisLeft)
      .attr('color', '#64748b')
      .call(g => g.select('.domain').attr('stroke', '#475569'))
      .selectAll('text')
      .attr('fill', '#38bdf8')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('font-size', '9.5px');

    // Left Axis Label
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#0284c7')
      .attr('font-size', '10px')
      .attr('font-weight', 'semibold')
      .text('Profundidad Batimétrica (m)');

    // Right Y-Axis (Elevation ASL in meters)
    const yAxisRight = d3.axisRight(yElevScale)
      .tickValues([290, 260, 230, 200, 170, 147])
      .tickFormat(d => `${d}m`);

    g.append('g')
      .attr('transform', `translate(${innerWidth}, 0)`)
      .call(yAxisRight)
      .attr('color', '#64748b')
      .call(g => g.select('.domain').attr('stroke', '#475569'))
      .selectAll('text')
      .attr('fill', '#a78bfa')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('font-size', '9.5px');

    // Right Axis Label
    g.append('text')
      .attr('transform', 'rotate(90)')
      .attr('y', -48)
      .attr('x', innerHeight / 2)
      .attr('text-anchor', 'middle')
      .attr('fill', '#a78bfa')
      .attr('font-size', '10px')
      .attr('font-weight', 'semibold')
      .text('Altitud s.n.m. (m)');

    // Interactive Hover Tracking Bar
    const trackingLine = g.append('line')
      .attr('y1', -15)
      .attr('y2', innerHeight)
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3')
      .attr('opacity', 0);

    const trackingCircle = g.append('circle')
      .attr('r', 5)
      .attr('fill', '#38bdf8')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0);

    // Overlay for mouse events
    const overlay = g.append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair');

    overlay.on('mousemove', (event) => {
      const [mx] = d3.pointer(event);
      const km = Math.max(0, Math.min(14, xScale.invert(mx)));
      const depth = getDepthAtKm(km);
      const my = yScale(depth);

      trackingLine.attr('x1', mx).attr('x2', mx).attr('opacity', 1);
      trackingCircle.attr('cx', mx).attr('cy', my).attr('opacity', 1);

      // Find nearest landmark
      let nearest = LAKE_ORTA_PROFILE[0];
      let minDiff = 999;
      for (const p of LAKE_ORTA_PROFILE) {
        const diff = Math.abs(p.km - km);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = p;
        }
      }

      // Compute projected time to this km
      const splitSec = (km * 1000 / 100) * effectivePaceSec;
      const splitStr = formatDuration(splitSec);
      const startMinutes = 9 * 60 + 30;
      const totalMin = startMinutes + Math.floor(splitSec / 60);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      const clockStr = `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}`;

      if (tooltipRef.current) {
        tooltipRef.current.style.opacity = '1';
        tooltipRef.current.style.left = `${Math.min(innerWidth - 100, Math.max(80, mx + margin.left))}px`;
        tooltipRef.current.style.top = `${Math.max(10, my + margin.top - 80)}px`;
        tooltipRef.current.innerHTML = `
          <div class="font-mono text-cyan-400 font-bold">${km.toFixed(1)} km · ${clockStr} (${splitStr})</div>
          <div class="text-[11px] text-white font-semibold">${nearest.name}</div>
          <div class="text-[10px] text-slate-300">Profundidad: <strong>-${Math.round(depth)}m</strong> (Altitud: ${Math.round(290 - depth)}m s.n.m.)</div>
        `;
      }
    });

    overlay.on('mouseleave', () => {
      trackingLine.attr('opacity', 0);
      trackingCircle.attr('opacity', 0);
      if (tooltipRef.current) {
        tooltipRef.current.style.opacity = '0';
      }
    });

  }, [viewMode, effectivePaceSec, feedIntervalMin, showAutonomousFeeds, showCutoffs, personalFeedStops]);

  // ----------------------------------------------------
  // D3 RENDERING: 2D NAUTICAL COURSE MAP
  // ----------------------------------------------------
  useEffect(() => {
    if (!mapSvgRef.current) return;
    const svg = d3.select(mapSvgRef.current);
    svg.selectAll('*').remove();

    const width = 420;
    const height = 680;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g');

    // Defs & Gradients
    const defs = svg.append('defs');

    // Water surface pattern gradient
    const mapWaterGrad = defs.append('linearGradient')
      .attr('id', 'map-water-grad')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '100%');
    mapWaterGrad.append('stop').attr('offset', '0%').attr('stop-color', '#0284c7').attr('stop-opacity', 0.9);
    mapWaterGrad.append('stop').attr('offset', '50%').attr('stop-color', '#0369a1').attr('stop-opacity', 0.95);
    mapWaterGrad.append('stop').attr('offset', '100%').attr('stop-color', '#075985').attr('stop-opacity', 0.9);

    // Lake body polygon path generator
    // Combine east coast downwards, then west coast upwards
    const lakeContour = [
      ...LAKE_COASTLINE_EAST,
      ...LAKE_COASTLINE_WEST.slice().reverse()
    ];

    const lakeLineGen = d3.line<{ x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveCatmullRomClosed.alpha(0.5));

    // Surrounding Land Contours (Lake Orta valleys)
    g.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', '#090d16');

    // Topographic faint rings
    [1, 2, 3].forEach((ring) => {
      g.append('path')
        .datum(lakeContour)
        .attr('d', lakeLineGen)
        .attr('fill', 'none')
        .attr('stroke', '#1e293b')
        .attr('stroke-width', ring * 14)
        .attr('stroke-opacity', 0.25);
    });

    // Lake Body Polygon
    g.append('path')
      .datum(lakeContour)
      .attr('d', lakeLineGen)
      .attr('fill', 'url(#map-water-grad)')
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 2)
      .attr('filter', 'drop-shadow(0 0 10px rgba(2, 132, 199, 0.4))');

    // Isola San Giulio (The magical island in the lake center)
    const islandGroup = g.append('g')
      .attr('transform', 'translate(225, 385)')
      .attr('cursor', 'pointer')
      .on('click', () => {
        setSelectedMilestone(LAKE_ORTA_PROFILE[6]);
      });

    islandGroup.append('ellipse')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('rx', 14)
      .attr('ry', 22)
      .attr('fill', '#15803d')
      .attr('stroke', '#86efac')
      .attr('stroke-width', 1.5);

    islandGroup.append('text')
      .attr('x', 20)
      .attr('y', 4)
      .attr('fill', '#86efac')
      .attr('font-size', '9.5px')
      .attr('font-weight', 'bold')
      .text('Isola San Giulio');

    // Official Swim Navigation Line (Omegna -> Lido di Gozzano)
    const routePoints = LAKE_ORTA_PROFILE.map(p => ({ x: p.mapX, y: p.mapY }));
    const routeLineGen = d3.line<{ x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y)
      .curve(d3.curveCatmullRom.alpha(0.6));

    // Glowing track underlayer
    g.append('path')
      .datum(routePoints)
      .attr('d', routeLineGen)
      .attr('fill', 'none')
      .attr('stroke', '#06b6d4')
      .attr('stroke-width', 6)
      .attr('stroke-opacity', 0.25);

    // Main swim track dashed line
    g.append('path')
      .datum(routePoints)
      .attr('d', routeLineGen)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 2.5)
      .attr('stroke-dasharray', '6,4');

    // Swim navigation direction arrows
    [100, 200, 310, 420, 520].forEach((arrowY) => {
      g.append('polygon')
        .attr('points', `${205},${arrowY} ${213},${arrowY + 8} ${210},${arrowY + 8} ${210},${arrowY + 14} ${200},${arrowY + 14} ${200},${arrowY + 8} ${197},${arrowY + 8}`)
        .attr('fill', '#67e8f9')
        .attr('opacity', 0.7);
    });

    // ----------------------------------------------------
    // CHECKPOINTS & FEED STATIONS ON THE MAP
    // ----------------------------------------------------
    LAKE_ORTA_PROFILE.forEach((pt) => {
      const nodeG = g.append('g')
        .attr('transform', `translate(${pt.mapX}, ${pt.mapY})`)
        .attr('cursor', 'pointer')
        .on('click', () => setSelectedMilestone(pt));

      if (pt.isOfficialFeedStation) {
        // Official floating feed station
        nodeG.append('circle')
          .attr('r', 10)
          .attr('fill', '#065f46')
          .attr('stroke', '#34d399')
          .attr('stroke-width', 2.5)
          .attr('filter', 'drop-shadow(0 0 6px #10b981)');

        nodeG.append('circle')
          .attr('r', 4)
          .attr('fill', '#ffffff');

        // Label box
        nodeG.append('rect')
          .attr('x', pt.mapX > 210 ? -120 : 16)
          .attr('y', -12)
          .attr('width', 105)
          .attr('height', 24)
          .attr('rx', 4)
          .attr('fill', '#022c22')
          .attr('stroke', '#10b981')
          .attr('stroke-width', 1.2);

        nodeG.append('text')
          .attr('x', pt.mapX > 210 ? -67 : 68)
          .attr('y', 3)
          .attr('text-anchor', 'middle')
          .attr('fill', '#6ee7b7')
          .attr('font-size', '8.5px')
          .attr('font-weight', 'bold')
          .text(`FEED #${pt.km === 5 ? '1 (5K)' : '2 (10K)'}`);
      } else if (pt.km === 0) {
        // Start Omegna
        nodeG.append('circle')
          .attr('r', 7)
          .attr('fill', '#0284c7')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2);

        nodeG.append('text')
          .attr('x', -10)
          .attr('y', -12)
          .attr('text-anchor', 'end')
          .attr('fill', '#38bdf8')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .text('SALIDA (09:30 AM)');
      } else if (pt.km === 14) {
        // Finish Lido di Gozzano
        nodeG.append('circle')
          .attr('r', 8)
          .attr('fill', '#e11d48')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2);

        nodeG.append('text')
          .attr('x', 14)
          .attr('y', 4)
          .attr('fill', '#fda4af')
          .attr('font-size', '10px')
          .attr('font-weight', 'bold')
          .text('META (14.0 KM)');
      } else {
        // Intermediate waypoint dot
        nodeG.append('circle')
          .attr('r', 3.5)
          .attr('fill', '#0284c7')
          .attr('stroke', '#7dd3fc')
          .attr('stroke-width', 1);

        nodeG.append('text')
          .attr('x', pt.mapX > 210 ? 12 : -12)
          .attr('y', 3)
          .attr('text-anchor', pt.mapX > 210 ? 'start' : 'end')
          .attr('fill', '#94a3b8')
          .attr('font-size', '8px')
          .attr('font-family', 'ui-monospace, monospace')
          .text(`${pt.km}k`);
      }
    });

    // ----------------------------------------------------
    // COMPASS ROSE & MAP LEGEND
    // ----------------------------------------------------
    const compassG = g.append('g').attr('transform', 'translate(50, 60)');
    compassG.append('circle').attr('r', 18).attr('fill', '#0f172a').attr('stroke', '#334155').attr('stroke-width', 1.5);
    // North pointer
    compassG.append('polygon').attr('points', '0,-15 4,-2 0,0 -4,-2').attr('fill', '#ef4444');
    // South pointer
    compassG.append('polygon').attr('points', '0,15 4,2 0,0 -4,2').attr('fill', '#94a3b8');
    compassG.append('text').attr('x', 0).attr('y', -18).attr('text-anchor', 'middle').attr('fill', '#ef4444').attr('font-size', '9px').attr('font-weight', 'bold').text('N');
    compassG.append('text').attr('x', 0).attr('y', 26).attr('text-anchor', 'middle').attr('fill', '#94a3b8').attr('font-size', '8px').text('S');

    // Scale bar
    const scaleG = g.append('g').attr('transform', 'translate(30, 640)');
    scaleG.append('line').attr('x1', 0).attr('x2', 60).attr('y1', 0).attr('y2', 0).attr('stroke', '#e2e8f0').attr('stroke-width', 2);
    scaleG.append('line').attr('x1', 0).attr('x2', 0).attr('y1', -4).attr('y2', 4).attr('stroke', '#e2e8f0').attr('stroke-width', 2);
    scaleG.append('line').attr('x1', 60).attr('x2', 60).attr('y1', -4).attr('y2', 4).attr('stroke', '#e2e8f0').attr('stroke-width', 2);
    scaleG.append('text').attr('x', 30).attr('y', -6).attr('text-anchor', 'middle').attr('fill', '#cbd5e1').attr('font-size', '8.5px').text('~2.0 KM');

  }, [effectivePaceSec, showAutonomousFeeds]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Waves className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Perfil de Elevación Batimétrico & Mapa de Travesía</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  D3 Engine
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Visualización hidrográfica oficial del Lago d'Orta (14 KM): estaciones flotantes oficiales, avituallamiento autónomo en boya y batimetría hasta -143m.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setViewMode('dual')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              viewMode === 'dual'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Vista Dual
          </button>
          <button
            onClick={() => setViewMode('profile')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              viewMode === 'profile'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Perfil Batimétrico
          </button>
          <button
            onClick={() => setViewMode('map')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
              viewMode === 'map'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Mapa Náutico
          </button>
        </div>
      </div>

      {/* Layer Toggles & Feed Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAutonomousFeeds}
              onChange={(e) => setShowAutonomousFeeds(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow-sm"></span>
              <span>Avituallamiento Autónomo (Boya Personal · c/{feedIntervalMin}')</span>
            </span>
          </label>

          <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCutoffs}
              onChange={(e) => setShowCutoffs(e.target.checked)}
              className="accent-emerald-500 rounded"
            />
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-sm"></span>
              <span>Estaciones Flotantes Oficiales (Km 5 & Km 10)</span>
            </span>
          </label>
        </div>

        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
          <span>Lago d'Orta: 290m s.n.m.</span>
          <span>·</span>
          <span className="text-rose-400 font-bold">Fosa máx: -143m</span>
        </div>
      </div>

      {/* Main Charts Canvas Container */}
      <div className="relative">
        {/* Tooltip element for D3 hover tracking */}
        <div
          ref={tooltipRef}
          className="absolute z-20 pointer-events-none transition-all duration-75 bg-slate-950/95 border border-cyan-500/40 rounded-xl p-2.5 shadow-2xl backdrop-blur-md text-xs opacity-0"
          style={{ width: '220px' }}
        />

        {/* View Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Elevation Profile Panel */}
          {(viewMode === 'profile' || viewMode === 'dual') && (
            <div className={`${viewMode === 'dual' ? 'lg:col-span-8' : 'lg:col-span-12'} space-y-4`}>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2 px-2">
                  <span className="font-semibold text-slate-200">
                    Corte Longitudinal: Perfil de Elevación y Profundidad del Lecho Lacustre
                  </span>
                  <span className="text-[11px] text-cyan-400 font-mono">
                    Pasa el cursor por el perfil para inspeccionar
                  </span>
                </div>

                <div className="w-full overflow-x-auto">
                  <svg ref={profileSvgRef} className="w-full h-auto min-w-[550px]" />
                </div>
              </div>

              {/* Strategic Stations Quick Info Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Station 1 Card */}
                <div 
                  onClick={() => setSelectedMilestone(LAKE_ORTA_PROFILE[4])}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedMilestone?.km === 5.0
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Anchor className="w-3.5 h-3.5" />
                      <span>Estación Flotante #1 (Km 5.0 · Ronco)</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      Corte: 2h 15m
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Plataforma flotante con agua mineral y geles oficiales. Punto de control clave para evaluar ritmo sostenido y tolerancia al frío.
                  </p>
                </div>

                {/* Station 2 Card */}
                <div 
                  onClick={() => setSelectedMilestone(LAKE_ORTA_PROFILE[7])}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedMilestone?.km === 10.0
                      ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Anchor className="w-3.5 h-3.5" />
                      <span>Estación Flotante #2 (Km 10.0 · Buccione)</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                      Corte: 4h 30m
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Última estación oficial antes de los 4km finales. Ingesta obligatoria de sales y cafeína para evitar calambres musculares en el sprint final.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Nautical Map Panel */}
          {(viewMode === 'map' || viewMode === 'dual') && (
            <div className={`${viewMode === 'dual' ? 'lg:col-span-4' : 'lg:col-span-12'} space-y-4`}>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 relative overflow-hidden flex flex-col items-center">
                <div className="w-full flex items-center justify-between text-xs text-slate-400 mb-2 px-1">
                  <span className="font-semibold text-slate-200">
                    Carta Náutica del Lago (N → S)
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">
                    14 km directos
                  </span>
                </div>

                <div className="w-full max-w-[360px]">
                  <svg ref={mapSvgRef} className="w-full h-auto drop-shadow-md" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Milestone Detail Inspector Drawer */}
      {selectedMilestone && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-cyan-500/30 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold font-mono text-sm">
                {selectedMilestone.km.toFixed(1)} KM
              </span>
              <div>
                <h4 className="font-bold text-white text-sm">
                  {selectedMilestone.name}
                </h4>
                <span className="text-[11px] text-slate-400">
                  {selectedMilestone.isOfficialFeedStation ? '★ Estación Oficial de Avituallamiento Flotante' : 'Hito de Navegación del Lago'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 font-mono">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Profundidad</span>
                <span className="font-bold text-cyan-400">-{selectedMilestone.depthMeters} m</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block">Altitud Lecho</span>
                <span className="font-bold text-purple-400">{selectedMilestone.lakebedElevMeters} m s.n.m.</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-semibold block text-[10px] mb-1">Estrategia & Nutrición Recomendada:</span>
              <p className="text-slate-200 text-[11px] leading-relaxed">
                {selectedMilestone.notes}
              </p>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-semibold block text-[10px] mb-1">Condición Hidrológica:</span>
              <p className="text-slate-300 text-[11px]">
                {selectedMilestone.waterCurrent || 'Superficie lacustre estable.'}
              </p>
            </div>

            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-semibold block text-[10px] mb-1">Corte Oficial / Tiempo Estimado:</span>
              <p className="text-amber-400 font-mono font-bold text-[11px]">
                {selectedMilestone.cutoffStr || 'Sin corte eliminatorio en este punto'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
