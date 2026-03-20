// ============================================================
// Pilot Card — FlightRadar24-Style + Social Media Profile
// Beautiful card with hero image, route viz, stats, social links
// ============================================================

import type { EnrichedPilot, ExperienceLevel } from '@/types';
import { EXPERIENCE_LEVELS } from '@/types';
import { formatHours, formatEta } from '@/social/experience';

// ---- State ----

const PANEL_ID = 'pilot-card-panel';
let currentPanel: HTMLElement | null = null;
let currentPilotCid: number | null = null;
let closeCallback: (() => void) | null = null;

// ---- Public API ----

export function showPilotCard(pilot: EnrichedPilot, container: HTMLElement): void {
  if (currentPanel && currentPilotCid !== pilot.cid) closePilotCard();
  currentPilotCid = pilot.cid;

  if (!currentPanel) {
    currentPanel = document.createElement('div');
    currentPanel.id = PANEL_ID;
    Object.assign(currentPanel.style, {
      position: 'absolute', top: '12px', right: '56px', bottom: '12px',
      width: '360px', maxWidth: 'calc(100vw - 72px)',
      background: '#0f1329', border: '1px solid rgba(99,132,255,0.12)',
      borderRadius: '16px', overflowY: 'auto', overflowX: 'hidden',
      pointerEvents: 'auto', zIndex: '20',
      transform: 'translateX(110%)', opacity: '0',
      transition: 'transform 0.35s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    });
    container.appendChild(currentPanel);
  }

  currentPanel.innerHTML = renderCard(pilot);
  attachHandlers(currentPanel);

  requestAnimationFrame(() => {
    currentPanel!.style.transform = 'translateX(0)';
    currentPanel!.style.opacity = '1';
  });
}

export function closePilotCard(): void {
  if (!currentPanel) return;
  currentPanel.style.transform = 'translateX(110%)';
  currentPanel.style.opacity = '0';
  const p = currentPanel;
  setTimeout(() => p.remove(), 350);
  currentPanel = null;
  currentPilotCid = null;
  closeCallback?.();
}

export function onPilotCardClose(cb: () => void): void { closeCallback = cb; }
export function isPilotCardOpen(): boolean { return currentPanel !== null; }
export function getCurrentPilotCid(): number | null { return currentPilotCid; }

// ---- Card Renderer ----

function renderCard(p: EnrichedPilot): string {
  const exp = EXPERIENCE_LEVELS.find(l => l.level === p.experienceLevel) ?? EXPERIENCE_LEVELS[4];
  const aircraftImg = getAircraftHeroImage(p.flightPlan?.aircraft_short ?? '');
  const dep = p.flightPlan?.departure || '????';
  const arr = p.flightPlan?.arrival || '????';
  const progress = calcRouteProgress(p);
  const phaseColor = getPhaseColor(p.flightPhase);
  const phaseLabel = getPhaseLabel(p.flightPhase);

  return `
    <!-- Hero Image -->
    <div style="position:relative;height:140px;overflow:hidden;border-radius:16px 16px 0 0;">
      <div style="position:absolute;inset:0;background:linear-gradient(135deg, #1a1f4a 0%, #0d1232 50%, #131740 100%);"></div>
      <img src="${aircraftImg}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.25;"
           onerror="this.style.display='none'" />
      <div style="position:absolute;inset:0;background:linear-gradient(to top, #0f1329 0%, transparent 60%);"></div>

      <!-- Close button -->
      <button id="pc-close" style="position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:8px;
        background:rgba(0,0,0,0.4);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.1);
        color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;
        transition:all 0.2s;">✕</button>

      ${p.streaming.isLive ? `
        <div style="position:absolute;top:10px;left:12px;display:flex;align-items:center;gap:6px;
          padding:4px 10px;border-radius:20px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);
          backdrop-filter:blur(8px);">
          <span style="width:8px;height:8px;border-radius:50%;background:#ef4444;animation:pulse-live 2s infinite;"></span>
          <span style="font-size:11px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:0.5px;">LIVE</span>
        </div>
      ` : ''}

      <!-- Callsign + Aircraft -->
      <div style="position:absolute;bottom:12px;left:16px;right:16px;">
        <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:1px;text-shadow:0 2px 8px rgba(0,0,0,0.5);">
          ${p.callsign}
        </div>
        <div style="font-size:13px;color:#94a3b8;margin-top:2px;">
          ${p.flightPlan?.aircraft_short || 'Unknown'} &middot; ${p.flightPlan?.aircraft || ''}
        </div>
      </div>
    </div>

    <!-- Route Visualization -->
    <div style="padding:16px 16px 12px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#fff;">${dep}</div>
          <div style="font-size:10px;color:#5a6380;margin-top:1px;">DEP</div>
        </div>
        <div style="flex:1;position:relative;height:24px;">
          <div style="position:absolute;top:50%;left:0;right:0;height:2px;background:#1e2448;transform:translateY(-50%);border-radius:1px;"></div>
          <div style="position:absolute;top:50%;left:0;width:${progress}%;height:2px;background:${phaseColor};transform:translateY(-50%);border-radius:1px;transition:width 0.5s;"></div>
          <div style="position:absolute;top:50%;left:${progress}%;transform:translate(-50%,-50%);
            width:10px;height:10px;border-radius:50%;background:${phaseColor};border:2px solid #0f1329;
            box-shadow:0 0 8px ${phaseColor}40;"></div>
          <div style="position:absolute;left:0;top:50%;width:6px;height:6px;border-radius:50%;background:#5a6380;transform:translate(-50%,-50%);"></div>
          <div style="position:absolute;right:0;top:50%;width:6px;height:6px;border-radius:50%;background:#5a6380;transform:translate(50%,-50%);"></div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:20px;font-weight:800;color:#fff;">${arr}</div>
          <div style="font-size:10px;color:#5a6380;margin-top:1px;">ARR</div>
        </div>
      </div>
      <div style="display:flex;justify-content:center;align-items:center;gap:6px;margin-top:8px;">
        <span style="width:6px;height:6px;border-radius:50%;background:${phaseColor};"></span>
        <span style="font-size:11px;font-weight:600;color:${phaseColor};">${phaseLabel}</span>
        ${p.etaMinutes ? `<span style="font-size:11px;color:#5a6380;margin-left:4px;">· ETA ${formatEta(p.etaMinutes)}</span>` : ''}
      </div>
    </div>

    <div style="height:1px;margin:0 16px;background:rgba(99,132,255,0.08);"></div>

    <!-- Flight Data Grid -->
    <div style="padding:12px 16px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
      ${dataCell('ALT', formatAlt(p.altitude))}
      ${dataCell('SPD', p.groundspeed > 0 ? `${p.groundspeed} kts` : 'GND')}
      ${dataCell('HDG', `${p.heading.toString().padStart(3, '0')}°`)}
      ${dataCell('XPDR', p.transponder)}
      ${dataCell('RULES', p.flightPlan?.flight_rules === 'V' ? 'VFR' : 'IFR')}
      ${dataCell('FREQ', p.activeFrequency ? `${p.activeFrequency}` : '---')}
    </div>

    <div style="height:1px;margin:0 16px;background:rgba(99,132,255,0.08);"></div>

    <!-- Pilot Profile Section -->
    <div style="padding:14px 16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:10px;font-weight:600;color:#5a6380;text-transform:uppercase;letter-spacing:1px;">PILOT</div>
        <div style="display:flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;
          background:${exp.color}15;border:1px solid ${exp.color}30;">
          <span style="font-size:11px;">${getStars(p.experienceLevel)}</span>
          <span style="font-size:10px;font-weight:700;color:${exp.color};">${exp.label}</span>
        </div>
      </div>
      ${profileRow('Name', p.name || 'Anonymous')}
      ${profileRow('CID', String(p.cid))}
      ${profileRow('Rating', `${p.pilotRatingShort} — ${p.pilotRatingLong}`)}
      ${profileRow('Hours', formatHours(p.totalPilotHours))}
      ${profileRow('Online', formatLogon(p.logonTime))}
    </div>

    <div style="height:1px;margin:0 16px;background:rgba(99,132,255,0.08);"></div>

    <!-- Social Links -->
    <div style="padding:14px 16px;">
      <div style="font-size:10px;font-weight:600;color:#5a6380;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">SOCIAL</div>
      ${renderSocial(p)}
    </div>

    ${p.activeFrequency ? `
      <div style="height:1px;margin:0 16px;background:rgba(99,132,255,0.08);"></div>
      <div style="padding:14px 16px;">
        <div style="font-size:10px;font-weight:600;color:#5a6380;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">TUNED FREQUENCY</div>
        <div style="font-size:22px;font-weight:700;color:#4f8cff;font-family:monospace;">${p.activeFrequency} MHz</div>
      </div>
    ` : ''}
  `;
}

// ---- Components ----

function dataCell(label: string, value: string): string {
  return `<div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:10px 12px;text-align:center;">
    <div style="font-size:9px;color:#5a6380;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">${label}</div>
    <div style="font-size:15px;color:#e2e8f0;font-weight:700;margin-top:4px;font-family:monospace;">${value}</div>
  </div>`;
}

function profileRow(label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
    <span style="font-size:12px;color:#5a6380;">${label}</span>
    <span style="font-size:13px;color:#e2e8f0;font-weight:500;">${value}</span>
  </div>`;
}

function renderSocial(p: EnrichedPilot): string {
  const hasSocial = p.socialProfile?.twitch || p.socialProfile?.youtube || p.socialProfile?.instagram;
  const hasStream = p.streaming.platform !== 'none';

  if (!hasSocial && !hasStream) {
    return `<div style="font-size:12px;color:#3a4570;font-style:italic;">No social profiles linked</div>`;
  }

  let html = '';

  // LIVE streaming banner
  if (p.streaming.isLive) {
    html += `<a href="${p.streaming.streamUrl}" target="_blank" rel="noopener" style="
      display:flex;align-items:center;gap:10px;padding:12px;border-radius:12px;
      background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);
      text-decoration:none;margin-bottom:10px;transition:all 0.2s;cursor:pointer;">
      <div style="width:10px;height:10px;border-radius:50%;background:#ef4444;flex-shrink:0;"></div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:#ef4444;">LIVE on ${cap(p.streaming.platform)}</div>
        <div style="font-size:11px;color:#8892b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.streaming.title || 'Streaming now'}</div>
      </div>
      <div style="font-size:11px;color:rgba(239,68,68,0.7);flex-shrink:0;">${p.streaming.viewerCount} &#128064;</div>
    </a>`;
  }

  // Social buttons
  html += '<div style="display:flex;gap:8px;">';

  const twitch = p.socialProfile?.twitch || (p.streaming.platform === 'twitch' ? p.streaming.username : '');
  const youtube = p.socialProfile?.youtube || (p.streaming.platform === 'youtube' ? p.streaming.username : '');
  const instagram = p.socialProfile?.instagram;

  if (twitch) html += socialBtn('Twitch', `https://twitch.tv/${twitch}`, '#9146ff', twitchSvg());
  if (youtube) html += socialBtn('YouTube', `https://youtube.com/@${youtube}`, '#ff0000', youtubeSvg());
  if (instagram) html += socialBtn('Instagram', `https://instagram.com/${instagram}`, '#e1306c', instaSvg());

  html += '</div>';
  return html;
}

function socialBtn(name: string, url: string, color: string, icon: string): string {
  return `<a href="${url}" target="_blank" rel="noopener" title="${name}" style="
    display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:10px;
    background:${color}12;border:1px solid ${color}25;color:${color};
    text-decoration:none;transition:all 0.2s;cursor:pointer;">${icon}</a>`;
}

// ---- Helpers ----

function formatAlt(alt: number): string {
  if (alt >= 18000) return `FL${Math.round(alt / 100)}`;
  if (alt > 0) return `${alt.toLocaleString()}'`;
  return 'GND';
}

function calcRouteProgress(p: EnrichedPilot): number {
  if (!p.flightPlan?.departure || !p.flightPlan?.arrival) return 0;
  if (p.flightPhase === 'preflight' || p.flightPhase === 'ground') return 0;
  if (p.flightPhase === 'landed') return 100;
  if (p.etaMinutes !== null && p.distanceToDestination !== null) {
    const totalDist = p.distanceToDestination + (p.groundspeed * (Date.now() - new Date(p.logonTime).getTime()) / 3600000);
    if (totalDist > 0) return Math.min(95, Math.max(5, (1 - p.distanceToDestination / totalDist) * 100));
  }
  // Estimate from flight phase
  const phaseProgress: Record<string, number> = {
    departing: 10, climbing: 25, cruising: 50, descending: 70, arriving: 90,
  };
  return phaseProgress[p.flightPhase] ?? 50;
}

function getPhaseColor(phase: string): string {
  const colors: Record<string, string> = {
    preflight: '#6b7280', ground: '#94a3b8', departing: '#38bdf8',
    climbing: '#3b82f6', cruising: '#3b82f6', descending: '#f59e0b',
    arriving: '#f97316', landed: '#22c55e',
  };
  return colors[phase] ?? '#3b82f6';
}

function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    preflight: 'Preflight', ground: 'On Ground', departing: 'Departing',
    climbing: 'Climbing', cruising: 'Cruising', descending: 'Descending',
    arriving: 'Approaching', landed: 'Landed',
  };
  return labels[phase] ?? phase;
}

function getStars(level: ExperienceLevel): string {
  return { beginner: '☆', intermediate: '★', advanced: '★★', expert: '★★★', master: '◆' }[level];
}

function formatLogon(iso: string): string {
  if (!iso) return '--';
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (diff < 60) return `${diff}m ago`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
  } catch { return '--'; }
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

function getAircraftHeroImage(_type: string): string {
  // Transparent fallback — user can upload custom hero image via settings later
  return `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7`;
}

// ---- Event Handlers ----

function attachHandlers(panel: HTMLElement): void {
  panel.querySelector('#pc-close')?.addEventListener('click', closePilotCard);
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { closePilotCard(); document.removeEventListener('keydown', esc); }
  });
}

// ---- SVG Icons ----

function twitchSvg(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.71V3.43h11.43z"/></svg>`;
}

function youtubeSvg(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
}

function instaSvg(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`;
}
