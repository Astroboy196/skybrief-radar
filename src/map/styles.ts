// ============================================================
// Map Style — CartoDB Dark Matter
// Professional, Free, No API key, All zoom levels
// ============================================================

import type { StyleSpecification } from 'maplibre-gl';

export function createDarkAviationStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'SkyBrief Radar V2',
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'carto-dark-layer',
        type: 'raster',
        source: 'carto-dark',
      },
    ],
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  };
}
