// ============================================================
// Phase 11: Aircraft Icon System
// SVG aircraft silhouettes for MapLibre Symbol layers
// 13 categories, 6 color variants, dynamic sizing
// ============================================================

import type { Map as MaplibreMap } from 'maplibre-gl';
import type { AircraftCategory, FlightPhase, ExperienceLevel } from '@/types';

// ---- SVG Aircraft Silhouettes ----
// All icons are 64x64 viewBox, pointing NORTH (up)

const AIRCRAFT_SVGS: Record<AircraftCategory, string> = {
  'single-prop': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 8 L34 24 L44 38 L44 40 L34 36 L34 52 L40 56 L40 58 L32 56 L24 58 L24 56 L30 52 L30 36 L20 40 L20 38 L30 24 Z" fill="FILL_COLOR"/>
  </svg>`,

  'twin-prop': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 6 L34 22 L46 34 L46 37 L34 33 L34 50 L40 54 L40 57 L32 54 L24 57 L24 54 L30 50 L30 33 L18 37 L18 34 L30 22 Z" fill="FILL_COLOR"/>
    <circle cx="22" cy="30" r="2.5" fill="FILL_COLOR" opacity="0.7"/>
    <circle cx="42" cy="30" r="2.5" fill="FILL_COLOR" opacity="0.7"/>
  </svg>`,

  'business-jet': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 4 L34 20 L48 32 L48 34 L34 30 L34 50 L42 55 L42 57 L32 54 L22 57 L22 55 L30 50 L30 30 L16 34 L16 32 L30 20 Z" fill="FILL_COLOR"/>
  </svg>`,

  'regional-jet': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 4 L35 22 L50 33 L50 36 L35 31 L35 48 L43 53 L43 56 L32 52 L21 56 L21 53 L29 48 L29 31 L14 36 L14 33 L29 22 Z" fill="FILL_COLOR"/>
  </svg>`,

  'narrow-body': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 2 L35 18 L54 30 L54 33 L35 28 L35 48 L44 53 L44 56 L32 52 L20 56 L20 53 L29 48 L29 28 L10 33 L10 30 L29 18 Z" fill="FILL_COLOR"/>
  </svg>`,

  'wide-body': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 2 L36 16 L56 28 L56 32 L36 26 L36 46 L46 52 L46 56 L32 51 L18 56 L18 52 L28 46 L28 26 L8 32 L8 28 L28 16 Z" fill="FILL_COLOR"/>
  </svg>`,

  'jumbo': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 1 L36 14 L58 26 L58 30 L36 24 L36 44 L48 50 L48 55 L32 49 L16 55 L16 50 L28 44 L28 24 L6 30 L6 26 L28 14 Z" fill="FILL_COLOR"/>
    <ellipse cx="32" cy="10" rx="3" ry="6" fill="FILL_COLOR" opacity="0.5"/>
  </svg>`,

  'cargo': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 2 L36 16 L56 28 L56 32 L36 26 L36 46 L46 52 L46 56 L32 51 L18 56 L18 52 L28 46 L28 26 L8 32 L8 28 L28 16 Z" fill="FILL_COLOR"/>
    <rect x="29" y="8" width="6" height="18" rx="1" fill="FILL_COLOR" opacity="0.4"/>
  </svg>`,

  'helicopter': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <ellipse cx="32" cy="34" rx="6" ry="12" fill="FILL_COLOR"/>
    <line x1="32" y1="22" x2="32" y2="10" stroke="FILL_COLOR" stroke-width="2"/>
    <line x1="16" y1="10" x2="48" y2="10" stroke="FILL_COLOR" stroke-width="2.5"/>
    <path d="M32 46 L36 56 L28 56 Z" fill="FILL_COLOR" opacity="0.8"/>
    <line x1="26" y1="56" x2="38" y2="56" stroke="FILL_COLOR" stroke-width="1.5"/>
  </svg>`,

  'military-fighter': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 2 L35 16 L52 28 L50 30 L35 26 L36 42 L46 48 L44 50 L32 46 L20 50 L18 48 L28 42 L29 26 L14 30 L12 28 L29 16 Z" fill="FILL_COLOR"/>
  </svg>`,

  'military-transport': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 2 L36 18 L56 30 L56 34 L36 28 L36 46 L46 52 L46 56 L32 51 L18 56 L18 52 L28 46 L28 28 L8 34 L8 30 L28 18 Z" fill="FILL_COLOR"/>
    <rect x="29" y="6" width="6" height="20" rx="2" fill="FILL_COLOR" opacity="0.3"/>
  </svg>`,

  'general-aviation': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 8 L34 24 L44 38 L44 40 L34 36 L34 52 L40 56 L40 58 L32 56 L24 58 L24 56 L30 52 L30 36 L20 40 L20 38 L30 24 Z" fill="FILL_COLOR"/>
  </svg>`,

  'unknown': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <path d="M32 6 L35 22 L48 32 L48 34 L35 30 L35 50 L42 55 L42 57 L32 54 L22 57 L22 55 L29 50 L29 30 L16 34 L16 32 L29 22 Z" fill="FILL_COLOR"/>
  </svg>`,
};

// ---- Color Definitions ----

const PHASE_COLORS: Record<FlightPhase, string> = {
  preflight: '#6b7280',
  ground: '#94a3b8',
  departing: '#38bdf8',
  climbing: '#3b82f6',
  cruising: '#3b82f6',   // Blue like vatsim-radar
  descending: '#3b82f6',
  arriving: '#f59e0b',
  landed: '#94a3b8',
};

const STREAMING_COLOR = '#ef4444';

const BADGE_COLORS: Record<ExperienceLevel, string> = {
  beginner: '#22c55e',
  intermediate: '#3b82f6',
  advanced: '#a855f7',
  expert: '#eab308',
  master: '#06b6d4',
};

// ---- Icon Generation ----

/**
 * Generate a canvas image for a specific aircraft category + color combo.
 * Returns an ImageData that can be registered with MapLibre.
 */
function generateIcon(
  category: AircraftCategory,
  color: string,
  size: number = 64,
  badgeColor?: string,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Draw aircraft shape programmatically (sync — MapLibre addImage needs sync data)

  // Draw simplified aircraft shape
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  // Use the SVG path data directly parsed would be complex,
  // so we draw programmatically per category
  drawAircraftShape(ctx, category, size);

  // Draw experience badge dot
  if (badgeColor) {
    ctx.fillStyle = badgeColor;
    ctx.beginPath();
    ctx.arc(size * 0.75, size * 0.2, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    // White outline for badge
    ctx.strokeStyle = '#0a0e27';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  return canvas;
}

/**
 * Convert a canvas element to the ImageData format MapLibre expects.
 */
function canvasToImageData(canvas: HTMLCanvasElement): { width: number; height: number; data: Uint8Array } {
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return {
    width: canvas.width,
    height: canvas.height,
    data: new Uint8Array(imageData.data.buffer),
  };
}

/**
 * Draw aircraft shape programmatically on canvas.
 */
function drawAircraftShape(ctx: CanvasRenderingContext2D, category: AircraftCategory, size: number): void {
  const s = size / 64; // Scale factor
  ctx.beginPath();

  switch (category) {
    case 'jumbo':
    case 'wide-body':
    case 'cargo':
      // Wide body — broad wings
      ctx.moveTo(32*s, 2*s);
      ctx.lineTo(36*s, 16*s);
      ctx.lineTo(56*s, 28*s);
      ctx.lineTo(56*s, 32*s);
      ctx.lineTo(36*s, 26*s);
      ctx.lineTo(36*s, 46*s);
      ctx.lineTo(46*s, 52*s);
      ctx.lineTo(46*s, 56*s);
      ctx.lineTo(32*s, 51*s);
      ctx.lineTo(18*s, 56*s);
      ctx.lineTo(18*s, 52*s);
      ctx.lineTo(28*s, 46*s);
      ctx.lineTo(28*s, 26*s);
      ctx.lineTo(8*s, 32*s);
      ctx.lineTo(8*s, 28*s);
      ctx.lineTo(28*s, 16*s);
      break;

    case 'narrow-body':
    case 'regional-jet':
    case 'business-jet':
      // Medium — standard shape
      ctx.moveTo(32*s, 4*s);
      ctx.lineTo(35*s, 20*s);
      ctx.lineTo(52*s, 32*s);
      ctx.lineTo(52*s, 35*s);
      ctx.lineTo(35*s, 30*s);
      ctx.lineTo(35*s, 48*s);
      ctx.lineTo(43*s, 53*s);
      ctx.lineTo(43*s, 56*s);
      ctx.lineTo(32*s, 52*s);
      ctx.lineTo(21*s, 56*s);
      ctx.lineTo(21*s, 53*s);
      ctx.lineTo(29*s, 48*s);
      ctx.lineTo(29*s, 30*s);
      ctx.lineTo(12*s, 35*s);
      ctx.lineTo(12*s, 32*s);
      ctx.lineTo(29*s, 20*s);
      break;

    case 'helicopter':
      // Helicopter — oval body + rotor
      ctx.ellipse(32*s, 34*s, 6*s, 12*s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(16*s, 10*s);
      ctx.lineTo(48*s, 10*s);
      ctx.lineWidth = 2.5 * s;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(32*s, 22*s);
      ctx.lineTo(32*s, 10*s);
      ctx.lineWidth = 2 * s;
      ctx.stroke();
      // Tail
      ctx.beginPath();
      ctx.moveTo(32*s, 46*s);
      ctx.lineTo(36*s, 56*s);
      ctx.lineTo(28*s, 56*s);
      ctx.closePath();
      break;

    case 'military-fighter':
      // Fighter — swept wings, delta shape
      ctx.moveTo(32*s, 2*s);
      ctx.lineTo(35*s, 16*s);
      ctx.lineTo(52*s, 28*s);
      ctx.lineTo(50*s, 30*s);
      ctx.lineTo(35*s, 26*s);
      ctx.lineTo(36*s, 42*s);
      ctx.lineTo(46*s, 48*s);
      ctx.lineTo(44*s, 50*s);
      ctx.lineTo(32*s, 46*s);
      ctx.lineTo(20*s, 50*s);
      ctx.lineTo(18*s, 48*s);
      ctx.lineTo(28*s, 42*s);
      ctx.lineTo(29*s, 26*s);
      ctx.lineTo(14*s, 30*s);
      ctx.lineTo(12*s, 28*s);
      ctx.lineTo(29*s, 16*s);
      break;

    default:
      // Default GA / single prop / twin prop — small wings
      ctx.moveTo(32*s, 8*s);
      ctx.lineTo(34*s, 24*s);
      ctx.lineTo(44*s, 38*s);
      ctx.lineTo(44*s, 40*s);
      ctx.lineTo(34*s, 36*s);
      ctx.lineTo(34*s, 52*s);
      ctx.lineTo(40*s, 56*s);
      ctx.lineTo(40*s, 58*s);
      ctx.lineTo(32*s, 56*s);
      ctx.lineTo(24*s, 58*s);
      ctx.lineTo(24*s, 56*s);
      ctx.lineTo(30*s, 52*s);
      ctx.lineTo(30*s, 36*s);
      ctx.lineTo(20*s, 40*s);
      ctx.lineTo(20*s, 38*s);
      ctx.lineTo(30*s, 24*s);
      break;
  }

  ctx.closePath();
  ctx.fill();
}

// ---- Icon Registration ----

/**
 * Register all aircraft icons with the MapLibre map instance.
 * Generates icons for each category × color combo.
 */
export function registerAircraftIcons(map: MaplibreMap): void {
  const categories: AircraftCategory[] = [
    'single-prop', 'twin-prop', 'business-jet', 'regional-jet',
    'narrow-body', 'wide-body', 'jumbo', 'cargo',
    'helicopter', 'military-fighter', 'military-transport',
    'general-aviation', 'unknown',
  ];

  const phases: FlightPhase[] = [
    'preflight', 'ground', 'departing', 'climbing',
    'cruising', 'descending', 'arriving', 'landed',
  ];

  for (const category of categories) {
    // Phase-colored icons
    for (const phase of phases) {
      const id = `aircraft-${category}-${phase}`;
      const imageData = canvasToImageData(generateIcon(category, PHASE_COLORS[phase], 64));
      map.addImage(id, imageData, { sdf: false });
    }

    // Streaming icon (red)
    const streamId = `aircraft-${category}-streaming`;
    const streamImageData = canvasToImageData(generateIcon(category, STREAMING_COLOR, 64));
    map.addImage(streamId, streamImageData, { sdf: false });
  }

  console.log(`[Icons] Registered ${categories.length * (phases.length + 1)} aircraft icons`);
}

/**
 * Get the icon ID for a specific aircraft on the map.
 */
export function getAircraftIconId(
  category: AircraftCategory,
  phase: FlightPhase,
  isStreaming: boolean,
): string {
  if (isStreaming) return `aircraft-${category}-streaming`;
  return `aircraft-${category}-${phase}`;
}

/**
 * Get the icon size based on zoom level and aircraft category.
 */
export function getIconSizeExpression(): maplibregl.ExpressionSpecification {
  return [
    'interpolate', ['linear'], ['zoom'],
    2, 0.15,    // Tiny at world view
    4, 0.18,    // Very small at continental
    6, 0.22,    // Small at regional
    8, 0.28,    // Medium-small
    10, 0.35,   // Medium
    12, 0.45,   // Detail
    14, 0.55,   // Airport area
    18, 0.75,   // Runway level
  ] as any;
}

// ---- Exports for testing ----

export { PHASE_COLORS, STREAMING_COLOR, BADGE_COLORS, AIRCRAFT_SVGS };
