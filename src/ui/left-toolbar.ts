// ============================================================
// Phase 1.1: Left Toolbar
// Settings, Weather Radar, SIGMETs, Animation, Layer Toggles
// ============================================================

import type { Map as MaplibreMap } from 'maplibre-gl';
import {
  toggleRadar, toggleSigmets, toggleRadarAnimation,
  setRadarOpacity, isRadarVisible, isSigmetVisible, isRadarAnimating,
} from '@/map/layers/weather';
import { setAircraftVisible } from '@/map/layers/aircraft';
import { setAtcVisible } from '@/map/layers/atc';
import { setSectorsVisible } from '@/map/layers/sectors';
import { toggleSettings } from './settings-panel';

// ---- State ----

let aircraftVisible = true;
let atcVisible = true;
let sectorsVisible = true;

// ---- Create Toolbar ----

export function createLeftToolbar(map: MaplibreMap, overlay: HTMLElement): void {
  const toolbar = document.createElement('div');
  toolbar.id = 'left-toolbar';
  Object.assign(toolbar.style, {
    position: 'absolute', top: '60px', left: '12px',
    display: 'flex', flexDirection: 'column', gap: '6px',
    zIndex: '15', pointerEvents: 'auto',
  });

  // ---- Settings ----
  toolbar.appendChild(toolBtn('btn-settings', 'Settings', settingsIcon(), () => {
    toggleSettings(overlay);
  }));

  toolbar.appendChild(separator());

  // ---- Layer Toggles ----
  toolbar.appendChild(toolBtn('btn-aircraft', 'Toggle Aircraft', aircraftIcon(), () => {
    aircraftVisible = !aircraftVisible;
    setAircraftVisible(map, aircraftVisible);
    updateBtnState('btn-aircraft', aircraftVisible);
  }, true));

  toolbar.appendChild(toolBtn('btn-atc', 'Toggle ATC Labels', atcIcon(), () => {
    atcVisible = !atcVisible;
    setAtcVisible(map, atcVisible);
    updateBtnState('btn-atc', atcVisible);
  }, true));

  toolbar.appendChild(toolBtn('btn-sectors', 'Toggle Sectors', sectorIcon(), () => {
    sectorsVisible = !sectorsVisible;
    setSectorsVisible(map, sectorsVisible);
    updateBtnState('btn-sectors', sectorsVisible);
  }, true));

  toolbar.appendChild(separator());

  // ---- Weather ----
  toolbar.appendChild(toolBtn('btn-radar', 'Precipitation Radar', radarIcon(), () => {
    toggleRadar(map);
    updateBtnState('btn-radar', isRadarVisible());
    updateOpacitySlider();
  }));

  toolbar.appendChild(toolBtn('btn-sigmet', 'SIGMETs / AIRMETs', sigmetIcon(), () => {
    toggleSigmets(map);
    updateBtnState('btn-sigmet', isSigmetVisible());
  }));

  toolbar.appendChild(toolBtn('btn-animate', 'Animate Radar', playIcon(), () => {
    toggleRadarAnimation(map);
    const btn = document.getElementById('btn-animate');
    if (btn) btn.innerHTML = isRadarAnimating() ? pauseIcon() : playIcon();
    updateBtnState('btn-animate', isRadarAnimating());
  }));

  // ---- Opacity Slider (hidden until radar active) ----
  const slider = document.createElement('div');
  slider.id = 'radar-opacity-wrap';
  Object.assign(slider.style, {
    display: 'none', padding: '4px',
    background: 'rgba(15,19,41,0.9)', borderRadius: '8px',
    border: '1px solid rgba(99,132,255,0.12)',
  });
  slider.innerHTML = `
    <input id="radar-opacity" type="range" min="0" max="100" value="50"
      style="width:36px;height:80px;writing-mode:vertical-lr;direction:rtl;
        accent-color:#4f8cff;cursor:pointer;appearance:auto;" />
  `;
  toolbar.appendChild(slider);

  // Slider event
  setTimeout(() => {
    const input = document.getElementById('radar-opacity') as HTMLInputElement | null;
    input?.addEventListener('input', () => {
      setRadarOpacity(map, parseInt(input.value) / 100);
    });
  }, 100);

  overlay.appendChild(toolbar);
}

function updateOpacitySlider(): void {
  const wrap = document.getElementById('radar-opacity-wrap');
  if (wrap) wrap.style.display = isRadarVisible() ? 'block' : 'none';
}

// ---- Button Factory ----

function toolBtn(id: string, title: string, icon: string, onClick: () => void, activeByDefault = false): HTMLElement {
  const btn = document.createElement('button');
  btn.id = id;
  btn.title = title;
  btn.innerHTML = icon;
  Object.assign(btn.style, {
    width: '38px', height: '38px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.2s',
    border: '1px solid rgba(99,132,255,0.12)',
    background: activeByDefault ? 'rgba(79,140,255,0.12)' : 'rgba(15,19,41,0.9)',
    color: activeByDefault ? '#4f8cff' : '#5a6380',
  });
  btn.addEventListener('click', onClick);
  btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'rgba(79,140,255,0.3)'; });
  btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'rgba(99,132,255,0.12)'; });
  return btn;
}

function updateBtnState(id: string, active: boolean): void {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.style.background = active ? 'rgba(79,140,255,0.12)' : 'rgba(15,19,41,0.9)';
  btn.style.color = active ? '#4f8cff' : '#5a6380';
}

function separator(): HTMLElement {
  const sep = document.createElement('div');
  Object.assign(sep.style, { width: '24px', height: '1px', margin: '2px auto', background: 'rgba(99,132,255,0.1)' });
  return sep;
}

// ---- SVG Icons (20x20) ----

function settingsIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/></svg>`;
}

function aircraftIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`;
}

function atcIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M2 12h6m8 0h6"/><circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4"/></svg>`;
}

function sectorIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
}

function radarIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/>
    <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/></svg>`;
}

function sigmetIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
}

function playIcon(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,3 20,12 6,21"/></svg>`;
}

function pauseIcon(): string {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>`;
}
