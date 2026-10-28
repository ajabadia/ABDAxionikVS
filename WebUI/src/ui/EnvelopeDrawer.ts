/**
 * ABDAxionikVS — EnvelopeDrawer.ts
 * Dedicated slide-out drawer (50vw) for the comprehensive Envelope & Shaper System
 * of the Hartmann Neuron architecture (Hardware Manual pages 103–110).
 *
 * Implements:
 * 1. 4L/4T Multilevel Shaper Envelope ([242..255])
 *    - Real-time dynamic SVG curve visualizer
 *    - Levels 1..4 (-64..+63) & Times 1..4 (0..127)
 *    - Mode (NORM / REP), Free Type (2-ADSR / 4L4T), Master Depth & Velo Depth
 * 2. Free ADSR 1 & 2 Envelopes ([205..211, 235..241])
 *    - Dedicated ADSR knobs, modes, depths, and velocity depths
 * 3. Routing Matrix & Layer Status ([253, 255])
 *    - Shaper Status (AMP / RES / FREE)
 *    - Free Modulation Destinations: R1 Scape, R1 Sphere, R2 Scape, R2 Sphere, Blender, Filter
 *
 * 100% tokenized with @abdsynths/shared components and design tokens.
 */

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { Knob } from '@abdsynths/shared/components/knob.js';

export interface EnvelopeDrawerOptions {
  onClose: () => void;
  initialTab?: 'all' | '4l4t' | 'adsr' | 'routing';
}

const DEST_TARGETS = [
  { id: 0, name: '0: R1 Scape', desc: 'Resynator 1 Scape Contour envelope modulation' },
  { id: 1, name: '1: R1 Sphere', desc: 'Resynator 1 Sphere Contour envelope modulation' },
  { id: 2, name: '2: R2 Scape', desc: 'Resynator 2 Scape Contour envelope modulation' },
  { id: 3, name: '3: R2 Sphere', desc: 'Resynator 2 Sphere Contour envelope modulation' },
  { id: 4, name: '4: Blender', desc: 'Resynator 1 & 2 Fusion crossfade amount modulation' },
  { id: 5, name: '5: Filter', desc: 'Silver 24dB multimode filter cutoff frequency' },
];

export class EnvelopeDrawer {
  public static createContent(options: EnvelopeDrawerOptions): HTMLElement {
    const root = document.createElement('div');
    root.className = 'drawer-view-content';
    root.style.cssText = 'display: flex; flex-direction: column; gap: var(--space-4); height: 100%;';

    // ── Rehidratar parámetros 4L/4T ─────────────────────────────────
    let curType = Math.round(WebBridge.getParam(ParamIdx.FreeEnvType, 0));
    let curMode4L = Math.round(WebBridge.getParam(ParamIdx.TLFreeEnvMode, 0));
    const curDepth4L = Math.round(WebBridge.getParam(ParamIdx.TLFreeEnvDepth, 127));
    const curVelo4L = Math.round(WebBridge.getParam(ParamIdx.Free4Level4TimeVelocityDepth, 0));

    const curL1 = Math.round(WebBridge.getParam(ParamIdx.FreeEnvLevel1, 63));
    const curL2 = Math.round(WebBridge.getParam(ParamIdx.FreeEnvLevel2, 30));
    const curL3 = Math.round(WebBridge.getParam(ParamIdx.FreeEnvLevel3, 10));
    const curL4 = Math.round(WebBridge.getParam(ParamIdx.FreeEnvLevel4, 0));

    const curT1 = Math.round(WebBridge.getParam(ParamIdx.FreeEnvTime1, 20));
    const curT2 = Math.round(WebBridge.getParam(ParamIdx.FreeEnvTime2, 40));
    const curT3 = Math.round(WebBridge.getParam(ParamIdx.FreeEnvTime3, 60));
    const curT4 = Math.round(WebBridge.getParam(ParamIdx.FreeEnvTime4, 80));

    // ── Rehidratar parámetros Free ADSR 1 & 2 ──────────────────────
    const curS1A = Math.round(WebBridge.getParam(ParamIdx.R1FreeEnvA, 15));
    const curS1D = Math.round(WebBridge.getParam(ParamIdx.R1FreeEnvD, 45));
    const curS1S = Math.round(WebBridge.getParam(ParamIdx.R1FreeEnvS, 64));
    const curS1R = Math.round(WebBridge.getParam(ParamIdx.R1FreeEnvR, 30));
    const curS1Depth = Math.round(WebBridge.getParam(ParamIdx.R1FreeEnvDepth, 64));
    const curS1Velo = Math.round(WebBridge.getParam(ParamIdx.FreeADSR1VelocityDepth, 0));

    const curS2A = Math.round(WebBridge.getParam(ParamIdx.R2FreeEnvA, 25));
    const curS2D = Math.round(WebBridge.getParam(ParamIdx.R2FreeEnvD, 50));
    const curS2S = Math.round(WebBridge.getParam(ParamIdx.R2FreeEnvS, 50));
    const curS2R = Math.round(WebBridge.getParam(ParamIdx.R2FreeEnvR, 40));
    const curS2Depth = Math.round(WebBridge.getParam(ParamIdx.R2FreeEnvDepth, 64));
    const curS2Velo = Math.round(WebBridge.getParam(ParamIdx.FreeADSR2VelocityDepth, 0));

    // ── Rehidratar Routing & Status ────────────────────────────────
    let curStatus = Math.round(WebBridge.getParam(ParamIdx.Shaper12Status, 1));
    let curDest = Math.round(WebBridge.getParam(ParamIdx.ShaperResySelect, 1));

    // Status Pills HTML
    const statusItems = [
      { id: 0, label: 'AMP (Volume)' },
      { id: 1, label: 'RES (Par.Levels)' },
      { id: 2, label: 'FREE (Modulation)' },
    ];
    const statusPillsHtml = statusItems.map((s) => `
      <button type="button" class="btn btn-xs env-status-btn ${curStatus === s.id ? 'btn-primary active' : 'btn-outline'}" data-status-id="${s.id}">${s.label}</button>
    `).join('');

    // Type Pills HTML
    const typePillsHtml = `
      <div style="display: flex; gap: 2px;">
        <button type="button" class="btn btn-xs env-type-btn ${curType === 0 ? 'btn-primary active' : 'btn-outline'}" data-type-id="0">2 Independent ADSRs</button>
        <button type="button" class="btn btn-xs env-type-btn ${curType === 1 ? 'btn-primary active' : 'btn-outline'}" data-type-id="1">Combined 4 Levels / 4 Times</button>
      </div>
    `;

    // Cycle Mode Pills HTML
    const modePillsHtml = `
      <div style="display: flex; gap: 2px;">
        <button type="button" class="btn btn-xs env-mode-btn ${curMode4L === 0 ? 'btn-primary active' : 'btn-outline'}" data-mode-id="0">Normal (One-Shot)</button>
        <button type="button" class="btn btn-xs env-mode-btn ${curMode4L === 1 ? 'btn-primary active' : 'btn-outline'}" data-mode-id="1">Repeat (Loop LFO)</button>
      </div>
    `;

    // Destination Cards HTML
    const destItemsHtml = DEST_TARGETS.map((t) => {
      const active = t.id === curDest ? 'active' : '';
      return `
        <button type="button" class="btn btn-sm env-dest-card-btn ${active}" data-dest-id="${t.id}">
          <div style="font-weight: 700; font-size: 11px;">${t.name}</div>
          <div style="font-size: 9px; opacity: 0.75; font-weight: normal; margin-top: 2px;">${t.desc}</div>
        </button>
      `;
    }).join('');

    root.innerHTML = `
      <!-- Header -->
      <div class="drawer-header ndb-modal-header">
        <div class="drawer-title ndb-header-title">
          <span class="drawer-icon">${ICONS.layers}</span>
          <h2 style="font-size: 14px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">Envelopes & Shapers Master</h2>
          <span class="hud-pill ndb-badge">4L/4T & MATRIX [205..255]</span>
        </div>
        <div class="drawer-header-actions">
          <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-env-drawer" title="Close (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <!-- Navigation tabs bar -->
      <div class="ndb-browser-toolbar" style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); border-bottom: 1px solid var(--color-panel-border-dim, rgba(255,255,255,0.08)); padding-bottom: var(--space-2);">
        <div class="env-tabs-bar" style="display: flex; align-items: center; gap: var(--space-2);">
          <button type="button" class="btn btn-sm btn-primary active env-tab-btn" data-env-tab="all">All Controls</button>
          <button type="button" class="btn btn-sm btn-outline env-tab-btn" data-env-tab="4l4t">1. 4L/4T Curve</button>
          <button type="button" class="btn btn-sm btn-outline env-tab-btn" data-env-tab="adsr">2. Free ADSR 1 & 2</button>
          <button type="button" class="btn btn-sm btn-outline env-tab-btn" data-env-tab="routing">3. Matrix Routing</button>
        </div>
        <span class="hud-pill" style="font-size: 9px; color: var(--color-accent, #00c3ff);">Hartmann Neuron Architecture</span>
      </div>

      <!-- Scrollable content -->
      <div class="drawer-scroll-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-4); padding-right: 4px;">

        <!-- ── BLOQUE 1: 4L/4T MULTILEVEL ENVELOPE ─────────────────────── -->
        <section class="synth-panel-card" id="env-sec-4l4t" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="stick-label">4L/4T SHAPER CONTOUR</span>
              <span class="hud-pill" style="font-size: 8px;">LEVEL 1..4 & TIME 1..4</span>
            </div>
            <div style="display: flex; align-items: center; gap: var(--space-3);">
              <div style="display: flex; align-items: center; gap: var(--space-1);">
                <span style="font-size: 9px; color: var(--color-text-muted);">TYPE:</span>
                ${typePillsHtml}
              </div>
              <div style="display: flex; align-items: center; gap: var(--space-1);">
                <span style="font-size: 9px; color: var(--color-text-muted);">CYCLE:</span>
                ${modePillsHtml}
              </div>
            </div>
          </div>

          <!-- SVG Real-time Curve Visualizer -->
          <div style="background: rgba(0,0,0,0.4); border-radius: var(--radius-sm, 4px); padding: 8px; border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; font-size: 8.5px; color: var(--color-text-muted);">
              <span>START (L:0)</span>
              <span>STAGE 1</span>
              <span>STAGE 2</span>
              <span>STAGE 3</span>
              <span>RELEASE (STAGE 4)</span>
            </div>
            <svg id="env-4l4t-svg" width="100%" height="80" style="overflow: visible;">
              <defs>
                <linearGradient id="envGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="var(--color-accent, #00c3ff)" stop-opacity="0.35"/>
                  <stop offset="100%" stop-color="var(--color-accent, #00c3ff)" stop-opacity="0.02"/>
                </linearGradient>
              </defs>
              <line x1="0" y1="40" x2="100%" y2="40" stroke="rgba(255,255,255,0.1)" stroke-dasharray="3,3"/>
              <path id="env-4l4t-fill" d="" fill="url(#envGrad)"/>
              <path id="env-4l4t-stroke" d="" fill="none" stroke="var(--color-accent, #00c3ff)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle id="pt-1" cx="0" cy="40" r="4" fill="var(--color-accent-amber, #f59e0b)"/>
              <circle id="pt-2" cx="0" cy="40" r="4" fill="var(--color-accent-amber, #f59e0b)"/>
              <circle id="pt-3" cx="0" cy="40" r="4" fill="var(--color-accent-amber, #f59e0b)"/>
              <circle id="pt-4" cx="0" cy="40" r="4" fill="var(--color-accent-amber, #f59e0b)"/>
            </svg>
          </div>

          <!-- 4 Stages Grid -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); background: rgba(0,0,0,0.2); padding: 8px; border-radius: var(--radius-sm, 4px);">
            <!-- Stage 1 -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; border-right: 1px solid rgba(255,255,255,0.06);">
              <span style="font-size: 8.5px; font-weight: 700; color: var(--color-accent);">STAGE 1</span>
              <div style="display: flex; gap: 8px; justify-content: center; width: 100%;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-l1"></div>
                  <span class="stat-num" id="val-l1" style="font-size: 9px; color: var(--color-accent);">${curL1}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">LEVEL 1</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-t1"></div>
                  <span class="stat-num" id="val-t1" style="font-size: 9px; color: var(--color-accent);">${curT1}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">TIME 1</span>
                </div>
              </div>
            </div>

            <!-- Stage 2 -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; border-right: 1px solid rgba(255,255,255,0.06);">
              <span style="font-size: 8.5px; font-weight: 700; color: var(--color-accent);">STAGE 2</span>
              <div style="display: flex; gap: 8px; justify-content: center; width: 100%;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-l2"></div>
                  <span class="stat-num" id="val-l2" style="font-size: 9px; color: var(--color-accent);">${curL2}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">LEVEL 2</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-t2"></div>
                  <span class="stat-num" id="val-t2" style="font-size: 9px; color: var(--color-accent);">${curT2}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">TIME 2</span>
                </div>
              </div>
            </div>

            <!-- Stage 3 -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; border-right: 1px solid rgba(255,255,255,0.06);">
              <span style="font-size: 8.5px; font-weight: 700; color: var(--color-accent);">STAGE 3</span>
              <div style="display: flex; gap: 8px; justify-content: center; width: 100%;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-l3"></div>
                  <span class="stat-num" id="val-l3" style="font-size: 9px; color: var(--color-accent);">${curL3}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">LEVEL 3</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-t3"></div>
                  <span class="stat-num" id="val-t3" style="font-size: 9px; color: var(--color-accent);">${curT3}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">TIME 3</span>
                </div>
              </div>
            </div>

            <!-- Stage 4 -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
              <span style="font-size: 8.5px; font-weight: 700; color: var(--color-accent);">STAGE 4 (REL)</span>
              <div style="display: flex; gap: 8px; justify-content: center; width: 100%;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-l4"></div>
                  <span class="stat-num" id="val-l4" style="font-size: 9px; color: var(--color-accent);">${curL4}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">LEVEL 4</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-t4"></div>
                  <span class="stat-num" id="val-t4" style="font-size: 9px; color: var(--color-accent);">${curT4}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">TIME 4</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Master Depth & Velocity for 4L4T -->
          <div style="display: flex; justify-content: space-around; align-items: center; padding: 6px 12px; background: rgba(0,0,0,0.15); border-radius: var(--radius-sm, 4px);">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div id="mount-depth-4l"></div>
              <div style="display: flex; flex-direction: column;">
                <span class="stat-num" id="val-depth-4l" style="font-size: 11px; color: var(--color-accent); font-weight: 700;">${curDepth4L}</span>
                <span style="font-size: 8px; color: var(--color-text-muted); font-weight: 700;">MASTER 4L4T DEPTH [251]</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div id="mount-velo-4l"></div>
              <div style="display: flex; flex-direction: column;">
                <span class="stat-num" id="val-velo-4l" style="font-size: 11px; color: var(--color-accent); font-weight: 700;">${curVelo4L > 0 ? '+' + curVelo4L : curVelo4L}</span>
                <span style="font-size: 8px; color: var(--color-text-muted); font-weight: 700;">VELOCITY SENSITIVITY [252]</span>
              </div>
            </div>
          </div>
        </section>

        <!-- ── BLOQUE 2: FREE ADSR 1 & 2 ENVELOPES ─────────────────────── -->
        <section class="synth-panel-card" id="env-sec-adsr" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="stick-label">FREE ADSR 1 & 2</span>
              <span class="hud-pill" style="font-size: 8px;">TWO INDEPENDENT CURVES</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <!-- Free ADSR 1 -->
            <div style="background: rgba(0,0,0,0.25); border-radius: var(--radius-sm, 4px); padding: 8px; display: flex; flex-direction: column; gap: 6px; border: 1px solid rgba(255,255,255,0.06);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 10px; font-weight: 700; color: var(--color-accent);">SHAPER 1 FREE ADSR [205..211]</span>
                <span class="hud-pill" style="font-size: 8px;">R1 TARGETS</span>
              </div>
              <div style="display: flex; justify-content: space-around; align-items: center;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-s1-a"></div>
                  <span class="stat-num" id="val-s1-a" style="font-size: 8.5px; color: var(--color-accent);">${curS1A}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">ATTACK</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-s1-d"></div>
                  <span class="stat-num" id="val-s1-d" style="font-size: 8.5px; color: var(--color-accent);">${curS1D}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">DECAY</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-s1-s"></div>
                  <span class="stat-num" id="val-s1-s" style="font-size: 8.5px; color: var(--color-accent);">${curS1S}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">SUSTAIN</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-s1-r"></div>
                  <span class="stat-num" id="val-s1-r" style="font-size: 8.5px; color: var(--color-accent);">${curS1R}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">RELEASE</span>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.06);">
                <div style="display: flex; align-items: center; gap: 4px;">
                  <div id="mount-s1-depth"></div>
                  <span class="stat-num" id="val-s1-depth" style="font-size: 9px; color: var(--color-accent);">${curS1Depth}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">DEPTH</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <div id="mount-s1-velo"></div>
                  <span class="stat-num" id="val-s1-velo" style="font-size: 9px; color: var(--color-accent);">${curS1Velo > 0 ? '+' + curS1Velo : curS1Velo}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">VELO</span>
                </div>
              </div>
            </div>

            <!-- Free ADSR 2 -->
            <div style="background: rgba(0,0,0,0.25); border-radius: var(--radius-sm, 4px); padding: 8px; display: flex; flex-direction: column; gap: 6px; border: 1px solid rgba(255,255,255,0.06);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 10px; font-weight: 700; color: var(--color-accent);">SHAPER 2 FREE ADSR [235..241]</span>
                <span class="hud-pill" style="font-size: 8px;">R2 TARGETS</span>
              </div>
              <div style="display: flex; justify-content: space-around; align-items: center;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-s2-a"></div>
                  <span class="stat-num" id="val-s2-a" style="font-size: 8.5px; color: var(--color-accent);">${curS2A}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">ATTACK</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-s2-d"></div>
                  <span class="stat-num" id="val-s2-d" style="font-size: 8.5px; color: var(--color-accent);">${curS2D}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">DECAY</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-s2-s"></div>
                  <span class="stat-num" id="val-s2-s" style="font-size: 8.5px; color: var(--color-accent);">${curS2S}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">SUSTAIN</span>
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 2px;">
                  <div id="mount-s2-r"></div>
                  <span class="stat-num" id="val-s2-r" style="font-size: 8.5px; color: var(--color-accent);">${curS2R}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">RELEASE</span>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 4px; border-top: 1px solid rgba(255,255,255,0.06);">
                <div style="display: align-items: center; gap: 4px; display: flex;">
                  <div id="mount-s2-depth"></div>
                  <span class="stat-num" id="val-s2-depth" style="font-size: 9px; color: var(--color-accent);">${curS2Depth}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">DEPTH</span>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                  <div id="mount-s2-velo"></div>
                  <span class="stat-num" id="val-s2-velo" style="font-size: 9px; color: var(--color-accent);">${curS2Velo > 0 ? '+' + curS2Velo : curS2Velo}</span>
                  <span style="font-size: 7.5px; color: var(--color-text-muted);">VELO</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── BLOQUE 3: SHAPER STATUS & MODULATION ROUTING MATRIX ───── -->
        <section class="synth-panel-card" id="env-sec-routing" style="display: flex; flex-direction: column; gap: var(--space-3);">
          <div class="panel-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: var(--space-2);">
              <span class="stick-label">MODULATION ROUTING & STATUS</span>
              <span class="hud-pill" style="font-size: 8px;">DESTINATION MATRIX [253, 255]</span>
            </div>
          </div>

          <!-- Shaper Status -->
          <div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: var(--radius-sm, 4px); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-size: 10px; font-weight: 700; color: var(--color-accent);">GLOBAL SHAPER LAYER STATUS [253]</span>
              <span style="font-size: 8.5px; color: var(--color-text-muted);">Determines which envelope level is addressed by the physical console wheels</span>
            </div>
            <div style="display: flex; gap: 4px;">
              ${statusPillsHtml}
            </div>
          </div>

          <!-- Destination Target Buttons -->
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <span style="font-size: 9.5px; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase;">Free Envelope Modulation Destination [255]:</span>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2);">
              ${destItemsHtml}
            </div>
          </div>
        </section>

      </div>
    `;

    // ── Bind close button ──────────────────────────────────────────
    root.querySelector('#btn-close-env-drawer')?.addEventListener('click', () => {
      options.onClose();
    });

    // ── Direct Tab Switching ───────────────────────────────────────
    const showTab = (tabId: string) => {
      root.querySelectorAll<HTMLButtonElement>('.env-tab-btn').forEach((btn) => {
        const isActive = btn.dataset.envTab === tabId;
        btn.classList.toggle('active', isActive);
        btn.classList.toggle('btn-primary', isActive);
        btn.classList.toggle('btn-outline', !isActive);
      });

      const sec4l4t = root.querySelector('#env-sec-4l4t') as HTMLElement | null;
      const secAdsr = root.querySelector('#env-sec-adsr') as HTMLElement | null;
      const secRouting = root.querySelector('#env-sec-routing') as HTMLElement | null;

      if (sec4l4t) sec4l4t.style.display = (tabId === 'all' || tabId === '4l4t') ? 'flex' : 'none';
      if (secAdsr) secAdsr.style.display = (tabId === 'all' || tabId === 'adsr') ? 'flex' : 'none';
      if (secRouting) secRouting.style.display = (tabId === 'all' || tabId === 'routing') ? 'flex' : 'none';
    };

    root.querySelectorAll<HTMLButtonElement>('.env-tab-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tabId = btn.dataset.envTab || 'all';
        showTab(tabId);
      });
    });

    // Set initial tab
    showTab(options.initialTab || 'all');

    // ── Function to redraw SVG curve ───────────────────────────────
    let l1 = curL1, l2 = curL2, l3 = curL3, l4 = curL4;
    let t1 = curT1, t2 = curT2, t3 = curT3, t4 = curT4;

    const updateSvgCurve = () => {
      const svg = root.querySelector('#env-4l4t-svg') as SVGSVGElement | null;
      const strokePath = root.querySelector('#env-4l4t-stroke') as SVGPathElement | null;
      const fillPath = root.querySelector('#env-4l4t-fill') as SVGPathElement | null;
      if (!svg || !strokePath || !fillPath) return;

      const width = svg.clientWidth || 400;
      const height = 80;
      const midY = height / 2;

      // Normalize times so they sum to width
      const sumT = Math.max(1, t1 + t2 + t3 + t4);
      const x0 = 10;
      const availW = width - 20;
      const x1 = x0 + (t1 / sumT) * availW;
      const x2 = x1 + (t2 / sumT) * availW;
      const x3 = x2 + (t3 / sumT) * availW;
      const x4 = x3 + (t4 / sumT) * availW;

      // Levels (-64..+63 mapped to 0..height)
      const toY = (lvl: number) => midY - (lvl / 64) * (midY - 6);
      const y0 = midY;
      const y1 = toY(l1);
      const y2 = toY(l2);
      const y3 = toY(l3);
      const y4 = toY(l4);

      const d = `M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4}`;
      const dFill = `${d} L ${x4} ${height} L ${x0} ${height} Z`;

      strokePath.setAttribute('d', d);
      fillPath.setAttribute('d', dFill);

      const pt1 = root.querySelector('#pt-1');
      const pt2 = root.querySelector('#pt-2');
      const pt3 = root.querySelector('#pt-3');
      const pt4 = root.querySelector('#pt-4');
      pt1?.setAttribute('cx', String(x1)); pt1?.setAttribute('cy', String(y1));
      pt2?.setAttribute('cx', String(x2)); pt2?.setAttribute('cy', String(y2));
      pt3?.setAttribute('cx', String(x3)); pt3?.setAttribute('cy', String(y3));
      pt4?.setAttribute('cx', String(x4)); pt4?.setAttribute('cy', String(y4));
    };

    setTimeout(updateSvgCurve, 50);

    // ── Helper to mount a knob ─────────────────────────────────────
    const mountKnob = (
      mountId: string,
      valId: string,
      initialVal: number,
      min: number,
      max: number,
      paramIdx: number,
      onValChange?: (v: number) => void
    ) => {
      const mount = root.querySelector(mountId) as HTMLElement | null;
      const valEl = root.querySelector(valId);
      if (!mount) return null;

      const normInit = (initialVal - min) / (max - min);
      return new Knob(mount, {
        size: 34,
        value: Math.max(0, Math.min(1, normInit)),
        onChange: (normVal: number) => {
          const raw = Math.round(min + normVal * (max - min));
          WebBridge.setParam(paramIdx, raw);
          if (valEl) {
            valEl.textContent = raw > 0 && min < 0 ? `+${raw}` : String(raw);
          }
          onValChange?.(raw);
        },
      });
    };

    // ── Mount 4L4T Knobs ───────────────────────────────────────────
    mountKnob('#mount-l1', '#val-l1', curL1, -64, 63, ParamIdx.FreeEnvLevel1, (v) => { l1 = v; updateSvgCurve(); });
    mountKnob('#mount-t1', '#val-t1', curT1, 0, 127, ParamIdx.FreeEnvTime1, (v) => { t1 = v; updateSvgCurve(); });

    mountKnob('#mount-l2', '#val-l2', curL2, -64, 63, ParamIdx.FreeEnvLevel2, (v) => { l2 = v; updateSvgCurve(); });
    mountKnob('#mount-t2', '#val-t2', curT2, 0, 127, ParamIdx.FreeEnvTime2, (v) => { t2 = v; updateSvgCurve(); });

    mountKnob('#mount-l3', '#val-l3', curL3, -64, 63, ParamIdx.FreeEnvLevel3, (v) => { l3 = v; updateSvgCurve(); });
    mountKnob('#mount-t3', '#val-t3', curT3, 0, 127, ParamIdx.FreeEnvTime3, (v) => { t3 = v; updateSvgCurve(); });

    mountKnob('#mount-l4', '#val-l4', curL4, -64, 63, ParamIdx.FreeEnvLevel4, (v) => { l4 = v; updateSvgCurve(); });
    mountKnob('#mount-t4', '#val-t4', curT4, 0, 127, ParamIdx.FreeEnvTime4, (v) => { t4 = v; updateSvgCurve(); });

    mountKnob('#mount-depth-4l', '#val-depth-4l', curDepth4L, 0, 127, ParamIdx.TLFreeEnvDepth);
    mountKnob('#mount-velo-4l', '#val-velo-4l', curVelo4L, -64, 63, ParamIdx.Free4Level4TimeVelocityDepth);

    // ── Mount Free ADSR 1 Knobs ────────────────────────────────────
    mountKnob('#mount-s1-a', '#val-s1-a', curS1A, 0, 127, ParamIdx.R1FreeEnvA);
    mountKnob('#mount-s1-d', '#val-s1-d', curS1D, 0, 127, ParamIdx.R1FreeEnvD);
    mountKnob('#mount-s1-s', '#val-s1-s', curS1S, 0, 127, ParamIdx.R1FreeEnvS);
    mountKnob('#mount-s1-r', '#val-s1-r', curS1R, 0, 127, ParamIdx.R1FreeEnvR);
    mountKnob('#mount-s1-depth', '#val-s1-depth', curS1Depth, 0, 127, ParamIdx.R1FreeEnvDepth);
    mountKnob('#mount-s1-velo', '#val-s1-velo', curS1Velo, -64, 63, ParamIdx.FreeADSR1VelocityDepth);

    // ── Mount Free ADSR 2 Knobs ────────────────────────────────────
    mountKnob('#mount-s2-a', '#val-s2-a', curS2A, 0, 127, ParamIdx.R2FreeEnvA);
    mountKnob('#mount-s2-d', '#val-s2-d', curS2D, 0, 127, ParamIdx.R2FreeEnvD);
    mountKnob('#mount-s2-s', '#val-s2-s', curS2S, 0, 127, ParamIdx.R2FreeEnvS);
    mountKnob('#mount-s2-r', '#val-s2-r', curS2R, 0, 127, ParamIdx.R2FreeEnvR);
    mountKnob('#mount-s2-depth', '#val-s2-depth', curS2Depth, 0, 127, ParamIdx.R2FreeEnvDepth);
    mountKnob('#mount-s2-velo', '#val-s2-velo', curS2Velo, -64, 63, ParamIdx.FreeADSR2VelocityDepth);

    // ── Layer Status Buttons ───────────────────────────────────────
    root.querySelectorAll<HTMLButtonElement>('.env-status-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.statusId);
        curStatus = id;
        WebBridge.setParam(ParamIdx.Shaper12Status, id);
        root.querySelectorAll('.env-status-btn').forEach((b) => {
          const isAct = Number((b as HTMLButtonElement).dataset.statusId) === id;
          b.classList.toggle('active', isAct);
          b.classList.toggle('btn-primary', isAct);
          b.classList.toggle('btn-outline', !isAct);
        });
      });
    });

    // ── Type Buttons ───────────────────────────────────────────────
    root.querySelectorAll<HTMLButtonElement>('.env-type-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.typeId);
        curType = id;
        WebBridge.setParam(ParamIdx.FreeEnvType, id);
        root.querySelectorAll('.env-type-btn').forEach((b) => {
          const isAct = Number((b as HTMLButtonElement).dataset.typeId) === id;
          b.classList.toggle('active', isAct);
          b.classList.toggle('btn-primary', isAct);
          b.classList.toggle('btn-outline', !isAct);
        });
      });
    });

    // ── Cycle Mode Buttons ─────────────────────────────────────────
    root.querySelectorAll<HTMLButtonElement>('.env-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.modeId);
        curMode4L = id;
        WebBridge.setParam(ParamIdx.TLFreeEnvMode, id);
        root.querySelectorAll('.env-mode-btn').forEach((b) => {
          const isAct = Number((b as HTMLButtonElement).dataset.modeId) === id;
          b.classList.toggle('active', isAct);
          b.classList.toggle('btn-primary', isAct);
          b.classList.toggle('btn-outline', !isAct);
        });
      });
    });

    // ── Destination Card Buttons Click ─────────────────────────────
    root.querySelectorAll<HTMLButtonElement>('.env-dest-card-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.destId);
        curDest = id;
        WebBridge.setParam(ParamIdx.ShaperResySelect, id);
        root.querySelectorAll('.env-dest-card-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    return root;
  }
}
