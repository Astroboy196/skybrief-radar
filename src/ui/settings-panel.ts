// ============================================================
// Phase 16: Social & Streaming UI — Settings Panel
// Slide-out settings for social media links, CID, preferences
// ============================================================

import { saveProfile, getProfile } from '@/social/profile-store';
import type { SocialProfile } from '@/types';

// ---- State ----

const PANEL_ID = 'settings-panel';
let currentPanel: HTMLElement | null = null;
let isOpen = false;

// ---- Panel Management ----

/**
 * Toggle the settings panel open/closed.
 */
export function toggleSettings(container: HTMLElement): void {
  if (isOpen) {
    closeSettings();
  } else {
    openSettings(container);
  }
}

export function openSettings(container: HTMLElement): void {
  if (currentPanel) return;

  currentPanel = document.createElement('div');
  currentPanel.id = PANEL_ID;
  Object.assign(currentPanel.style, {
    position: 'absolute', top: '12px', left: '56px', bottom: '12px',
    width: '320px', maxWidth: 'calc(100vw - 72px)',
    background: 'rgba(15,19,41,0.95)', backdropFilter: 'blur(20px)',
    border: '1px solid rgba(99,132,255,0.12)', borderRadius: '14px',
    overflowY: 'auto', overflowX: 'hidden', pointerEvents: 'auto',
    transform: 'translateX(-120%)', opacity: '0',
    transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), opacity 0.25s ease',
    zIndex: '20', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    color: '#e2e8f0', fontSize: '13px',
  });

  currentPanel.innerHTML = renderSettingsContent();

  container.appendChild(currentPanel);

  // Animate in
  requestAnimationFrame(() => {
    currentPanel!.style.transform = 'translateX(0)';
    currentPanel!.style.opacity = '1';
  });

  isOpen = true;

  // Attach handlers
  attachHandlers(currentPanel);

  // Keyboard close
  document.addEventListener('keydown', handleEscape);
}

export function closeSettings(): void {
  if (!currentPanel) return;

  currentPanel.style.transform = 'translateX(-100%)';
  currentPanel.style.opacity = '0';

  const panel = currentPanel;
  setTimeout(() => panel.remove(), 300);

  currentPanel = null;
  isOpen = false;
  document.removeEventListener('keydown', handleEscape);
}

export function isSettingsOpen(): boolean {
  return isOpen;
}

function handleEscape(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeSettings();
}

// ---- Content ----

function renderSettingsContent(): string {
  // Try to load existing profile
  const cidStr = localStorage.getItem('skybrief-radar-v2-my-cid') ?? '';
  const cid = parseInt(cidStr);
  const profile = cid ? getProfile(cid) : null;

  const S = 'width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(99,132,255,0.12);border-radius:8px;padding:8px 12px;color:#e2e8f0;font-size:13px;outline:none;';
  const divider = '<div style="height:1px;margin:0 16px;background:rgba(99,132,255,0.08);"></div>';
  const sectionTitle = (t: string) => `<div style="font-size:10px;font-weight:600;color:#5a6380;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">${t}</div>`;
  const label = (t: string) => `<div style="font-size:12px;color:#8892b0;margin-bottom:4px;">${t}</div>`;

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 16px 10px;">
      <div style="font-size:16px;font-weight:800;color:#e2e8f0;">Settings</div>
      <button id="settings-close" style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.08);color:#8892b0;cursor:pointer;display:flex;align-items:center;
        justify-content:center;font-size:16px;">✕</button>
    </div>

    ${divider}

    <div style="padding:14px 16px;">
      ${sectionTitle('VATSIM Identity')}
      ${label('VATSIM CID')}
      <input id="input-cid" type="number" placeholder="e.g. 1234567" value="${cidStr}" style="${S}" />
    </div>

    ${divider}

    <div style="padding:14px 16px;">
      ${sectionTitle('Social Media')}
      ${renderSocialInput('twitch', 'Twitch Username', profile?.twitch ?? '', 'e.g. pilotjoe', twitchInputIcon())}
      ${renderSocialInput('youtube', 'YouTube Handle', profile?.youtube ?? '', 'e.g. PilotChannel', youtubeInputIcon())}
      ${renderSocialInput('instagram', 'Instagram Username', profile?.instagram ?? '', 'e.g. pilot.joe', instagramInputIcon())}
    </div>

    ${divider}

    <div style="padding:14px 16px;">
      ${sectionTitle('Streaming')}
      ${label('Stream URL')}
      <input id="input-streamUrl" type="url" placeholder="https://twitch.tv/yourname" value="${profile?.streamUrl ?? ''}" style="${S}" />
    </div>

    ${divider}

    <div style="padding:14px 16px;">
      ${sectionTitle('About You')}
      ${label('Bio')}
      <textarea id="input-bio" rows="3" maxlength="500" placeholder="Tell other pilots about yourself..."
        style="${S}resize:none;">${profile?.bio ?? ''}</textarea>
      <div style="font-size:10px;color:#5a6380;text-align:right;margin-top:4px;">
        <span id="bio-count">${(profile?.bio ?? '').length}</span>/500
      </div>
    </div>

    <div style="padding:14px 16px;">
      <button id="settings-save" style="width:100%;padding:10px;border-radius:8px;background:#4f8cff;
        color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer;transition:all 0.2s;">
        Save Profile
      </button>
      <div id="save-feedback" style="margin-top:8px;font-size:11px;text-align:center;display:none;"></div>
    </div>
  `;
}

function renderSocialInput(id: string, label: string, value: string, placeholder: string, icon: string): string {
  return `
    <div style="margin-bottom:10px;">
      <label style="font-size:12px;color:#8892b0;display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        ${icon} ${label}
      </label>
      <input id="input-${id}" type="text" placeholder="${placeholder}" value="${value}"
        style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(99,132,255,0.12);
          border-radius:8px;padding:8px 12px;color:#e2e8f0;font-size:13px;outline:none;
          transition:border-color 0.2s;"
        onfocus="this.style.borderColor='rgba(79,140,255,0.4)'"
        onblur="this.style.borderColor='rgba(99,132,255,0.12)'" />
    </div>
  `;
}

// ---- Event Handlers ----

function attachHandlers(panel: HTMLElement): void {
  // Close button
  panel.querySelector('#settings-close')?.addEventListener('click', closeSettings);

  // Bio character count
  const bioInput = panel.querySelector('#input-bio') as HTMLTextAreaElement | null;
  bioInput?.addEventListener('input', () => {
    const count = panel.querySelector('#bio-count');
    if (count) count.textContent = String(bioInput.value.length);
  });

  // Save button
  panel.querySelector('#settings-save')?.addEventListener('click', () => {
    handleSave(panel);
  });
}

function handleSave(panel: HTMLElement): void {
  const cidInput = (panel.querySelector('#input-cid') as HTMLInputElement)?.value;
  const cid = parseInt(cidInput);

  if (!cid || cid < 1) {
    showFeedback(panel, 'Please enter a valid VATSIM CID', 'error');
    return;
  }

  const profile: SocialProfile = {
    cid,
    twitch: (panel.querySelector('#input-twitch') as HTMLInputElement)?.value || undefined,
    youtube: (panel.querySelector('#input-youtube') as HTMLInputElement)?.value || undefined,
    instagram: (panel.querySelector('#input-instagram') as HTMLInputElement)?.value || undefined,
    streamUrl: (panel.querySelector('#input-streamUrl') as HTMLInputElement)?.value || undefined,
    bio: (panel.querySelector('#input-bio') as HTMLTextAreaElement)?.value || undefined,
    updatedAt: Date.now(),
  };

  const result = saveProfile(profile);

  if (result.valid) {
    localStorage.setItem('skybrief-radar-v2-my-cid', String(cid));
    showFeedback(panel, 'Profile saved successfully!', 'success');
  } else {
    showFeedback(panel, result.errors.join('. '), 'error');
  }
}

function showFeedback(panel: HTMLElement, message: string, type: 'success' | 'error'): void {
  const el = panel.querySelector('#save-feedback') as HTMLElement | null;
  if (!el) return;

  el.className = `mt-2 text-xs text-center ${type === 'success' ? 'text-emerald-400' : 'text-red-400'}`;
  el.textContent = message;
  el.classList.remove('hidden');

  if (type === 'success') {
    setTimeout(() => el.classList.add('hidden'), 3000);
  }
}

// ---- Social Icons (small, for labels) ----

function twitchInputIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-twitch)">
    <path d="M11.64 5.93h1.43v4.28h-1.43m3.93-4.28H17v4.28h-1.43M7 2L3.43 5.57v12.86h4.28V22l3.58-3.57h2.85L20.57 12V2m-1.43 9.29-2.85 2.85h-2.86l-2.5 2.5v-2.5H7.71V3.43h11.43z"/>
  </svg>`;
}

function youtubeInputIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-youtube)">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>`;
}

function instagramInputIcon(): string {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-instagram)">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
  </svg>`;
}
