/**
 * ABDAxionikVS — Hardware SysEx Dumps & Live SysEx Inspector Drawer
 * Cajón 50vw desde la derecha para recibir, enviar, inspeccionar y exportar/importar
 * dumps SysEx documentados del hardware Hartmann Neuron (0x00 0x20 0x50, Model 0x01):
 *   - Current Sound (0x10)
 *   - All Sounds (0x20)
 *   - All SetUps (0x30)
 *   - All Models (0x40)
 *
 * Integra el componente compartido LiveSysExInspector (@abdsynths/shared/components)
 * con resaltado reactivo de mutaciones byte a byte, Diff A/B y exportación/importación .syx.
 */

import { Knob, LiveSysExInspector } from '@abdsynths/shared/components';
import { WebBridge } from '../bridge/WebBridge.js';
import { ICONS } from './icons.js';
import { onLocaleChange, getLocale } from '../i18n/index.js';
import {
  HARDWARE_DUMP_META,
  HARTMANN_PARAM_COUNT,
  decodeHartmannSysExDump,
  encodeHartmannSysExDump,
  type HardwareDumpMode,
  type HardwareDumpPayload,
  type HardwareDumpsContracts,
  type HardwareHostEvent,
  type HardwareHostRequest,
  type HardwarePortStatus,
  type HardwareXferState,
  hardwareDumpMetaForModeAndDir,
} from './hardwareDumpsContracts.js';
import { DrawerManager } from './Drawers.js';

export interface HardwareDumpsDrawerCallbacks {
  onClose?: () => void;
  onApplyDecodedParams?: (params: number[], presetName: string) => void;
  getPresetName?: () => string;
}

interface HardwareDumpsDrawerState {
  portStatus: HardwarePortStatus;
  selectedMode: HardwareDumpMode;
  activeXfer: HardwareXferState | null;
  lastReceived: HardwareDumpPayload | null;
  pendingSend: HardwareDumpPayload | null;
  activity: string[];
}

const DEFAULT_PORT: HardwarePortStatus = {
  connected: false,
  name: null,
  deviceId: 0,
};

export interface HardwareDumpsI18nStrings {
  initActivity: string;
  scanPortActivity: string;
  statusLabel: string;
  statusIdle: string;
  activeModeLabel: string;
  bytesEstSuffix: string;
  encodingLabel: string;
  directionLabel: string;
  modeLabel: string;
  abortBtn: string;
  xferAbortedActivity: string;
  confirmTxTitle: string;
  preparedLabel: string;
  transmitTxBtn: string;
  applyLocalRxBtn: string;
  cancelBtn: string;
  importSyxTitle: string;
  requestRxTitle: string;
  prepareTxTitle: string;
  requestRxActivity: (mode: string) => string;
  applyToSynthBtn: string;
  resendTxBtn: string;
  discardBtn: string;
  importedActivity: (label: string, summary: string) => string;
  invalidDumpActivity: (len: number) => string;
  appliedParamsActivity: (count: number, name: string, checksumOk: boolean) => string;
  transmittingActivity: (mode: string, len: number) => string;
  confirmedTxActivity: (mode: string, len: number) => string;
  rxCompleteActivity: (mode: string, len: number) => string;
  txBlockActivity: (len: number, id: string) => string;
  rxBlockActivity: (len: number) => string;
}

export const HARDWARE_DUMPS_I18N: Record<'en' | 'es', HardwareDumpsI18nStrings> = {
  en: {
    initActivity: 'Hardware SysEx Dumps module initialized (Hartmann GmbH 00 20 50 01).',
    scanPortActivity: 'Requesting MIDI port status from host...',
    statusLabel: 'Status',
    statusIdle: 'Ready (Idle)',
    activeModeLabel: 'Active mode',
    bytesEstSuffix: 'bytes est.',
    encodingLabel: 'Encoding',
    directionLabel: 'Direction',
    modeLabel: 'Mode',
    abortBtn: 'Abort',
    xferAbortedActivity: 'SysEx transfer aborted by user.',
    confirmTxTitle: 'CONFIRM HARDWARE SYSEX TRANSMISSION',
    preparedLabel: 'Prepared',
    transmitTxBtn: 'Transmit to Hardware (TX)',
    applyLocalRxBtn: 'Apply to Local Synth (RX)',
    cancelBtn: 'Cancel',
    importSyxTitle: 'Import .syx file from disk and apply parameters',
    requestRxTitle: 'Request dump of selected mode from hardware',
    prepareTxTitle: 'Generate and transmit SysEx dump of selected mode',
    requestRxActivity: (mode) => `Requesting RX Dump (${mode}) from hardware...`,
    applyToSynthBtn: 'Apply to Synth',
    resendTxBtn: 'Resend (TX)',
    discardBtn: 'Discard',
    importedActivity: (label, summary) => `Loaded ${label}: ${summary}`,
    invalidDumpActivity: (len) => `Dump (${len} B) does not contain a decodable snddat[445] vector.`,
    appliedParamsActivity: (count, name, ok) =>
      `Applied ${count} parameters from SysEx "${name}" (Checksum ${ok ? 'OK' : 'WARN'}).`,
    transmittingActivity: (mode, len) => `Transmitting ${mode} dump (${len} B) to hardware...`,
    confirmedTxActivity: (mode, len) => `Confirmed TX transmission (${mode}, ${len} B).`,
    rxCompleteActivity: (mode, len) => `RX complete: ${mode}, ${len} bytes.`,
    txBlockActivity: (len, id) => `TX SysEx block (${len} B) -> ${id}`,
    rxBlockActivity: (len) => `RX SysEx block (${len} B)`,
  },
  es: {
    initActivity: 'Módulo Hardware SysEx Dumps inicializado (Hartmann GmbH 00 20 50 01).',
    scanPortActivity: 'Solicitando estado del puerto MIDI al host...',
    statusLabel: 'Estado',
    statusIdle: 'Listo (Idle)',
    activeModeLabel: 'Modo activo',
    bytesEstSuffix: 'bytes est.',
    encodingLabel: 'Codificación',
    directionLabel: 'Dirección',
    modeLabel: 'Modo',
    abortBtn: 'Cancelar',
    xferAbortedActivity: 'Transferencia SysEx cancelada por el usuario.',
    confirmTxTitle: 'CONFIRMAR TRANSMISIÓN SYSEX HARDWARE',
    preparedLabel: 'Preparado',
    transmitTxBtn: 'Transmitir al Hardware (TX)',
    applyLocalRxBtn: 'Aplicar al Synth Local (RX)',
    cancelBtn: 'Cancelar',
    importSyxTitle: 'Importar archivo .syx desde disco y aplicar parámetros',
    requestRxTitle: 'Solicitar volcado del modo seleccionado al hardware',
    prepareTxTitle: 'Generar y transmitir volcado SysEx del modo seleccionado',
    requestRxActivity: (mode) => `Solicitando RX Dump (${mode}) al hardware...`,
    applyToSynthBtn: 'Aplicar al Synth',
    resendTxBtn: 'Reenviar (TX)',
    discardBtn: 'Descartar',
    importedActivity: (label, summary) => `Cargado ${label}: ${summary}`,
    invalidDumpActivity: (len) => `El dump (${len} B) no contiene un vector snddat[445] decodificable.`,
    appliedParamsActivity: (count, name, ok) =>
      `Aplicados ${count} parámetros desde SysEx "${name}" (Checksum ${ok ? 'OK' : 'WARN'}).`,
    transmittingActivity: (mode, len) => `Transmitiendo dump ${mode} (${len} B) al hardware...`,
    confirmedTxActivity: (mode, len) => `Confirmado envío TX (${mode}, ${len} B).`,
    rxCompleteActivity: (mode, len) => `RX completo: ${mode}, ${len} bytes.`,
    txBlockActivity: (len, id) => `TX bloque SysEx (${len} B) -> ${id}`,
    rxBlockActivity: (len) => `RX bloque SysEx (${len} B)`,
  },
};

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class HardwareDumpsDrawer implements HardwareDumpsContracts {
  private callbacks: HardwareDumpsDrawerCallbacks;
  private drawerManager: DrawerManager;

  private state: HardwareDumpsDrawerState;
  private unreadCount: number = 0;
  private locale: 'en' | 'es' = 'en';

  private mainPanel: HTMLElement | null = null;
  private portPanel: HTMLElement | null = null;
  private xferPanel: HTMLElement | null = null;
  private receivedPanel: HTMLElement | null = null;
  private sendPanel: HTMLElement | null = null;
  private inspectorHostEl: HTMLElement | null = null;
  private activityPanel: HTMLElement | null = null;
  private fileInputEl: HTMLInputElement | null = null;
  private liveInspector: InstanceType<typeof LiveSysExInspector> | null = null;
  private unsubLocale: (() => void) | null = null;

  constructor(
    app: HTMLElement,
    callbacks: HardwareDumpsDrawerCallbacks = {},
    drawerManager?: DrawerManager,
    locale?: 'en' | 'es'
  ) {
    this.callbacks = callbacks;
    this.drawerManager = drawerManager ?? new DrawerManager(app);
    this.locale = locale ?? getLocale();
    this.state = {
      portStatus: { ...DEFAULT_PORT },
      selectedMode: 'current',
      activeXfer: null,
      lastReceived: null,
      pendingSend: null,
      activity: [HARDWARE_DUMPS_I18N[this.locale].initActivity],
    };
    this.mount();
    this.render();

    this.unsubLocale = onLocaleChange((newLoc) => {
      this.setLocale(newLoc);
    });
  }

  public setLocale(locale: 'en' | 'es'): void {
    if (this.locale === locale) return;
    this.locale = locale;
    this.render();
  }

  private get t(): HardwareDumpsI18nStrings {
    return HARDWARE_DUMPS_I18N[this.locale];
  }

  public isOpen(): boolean {
    return this.drawerManager.getCurrentDrawerId() === 'hardware-dumps';
  }

  public open(): void {
    this.refreshLiveInspector();
    this.drawerManager.openCustom('hardware-dumps', this.mainPanel!, () => {
      this.callbacks.onClose?.();
    });
    this.send({ type: 'HARDWARE_GET_PORT_STATUS' });
  }

  public close(): void {
    if (this.isOpen()) {
      this.drawerManager.close();
    }
  }

  public destroy(): void {
    if (this.unsubLocale) {
      this.unsubLocale();
      this.unsubLocale = null;
    }
  }

  public toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Re-empaqueta el Edit Buffer actual (445 parámetros) y actualiza el LiveSysExInspector
   * si el cajón está abierto, disparando el pulso visual en los bytes modificados.
   */
  public onParamUpdated(): void {
    if (!this.isOpen()) return;
    if (this.state.selectedMode === 'current') {
      this.refreshLiveInspector();
    }
  }

  public refreshLiveInspector(): void {
    if (!this.liveInspector) return;
    const dump = this.buildLiveDump(this.state.selectedMode);
    this.liveInspector.updateBuffer(dump.data);
  }

  private buildLiveDump(mode: HardwareDumpMode): HardwareDumpPayload {
    const params = new Array<number>(HARTMANN_PARAM_COUNT);
    for (let i = 0; i < HARTMANN_PARAM_COUNT; ++i) {
      params[i] = WebBridge.getParam(i, 0);
    }
    const presetName = this.callbacks.getPresetName?.() || '000 InitSound';
    return encodeHartmannSysExDump(
      mode,
      params,
      this.state.portStatus.deviceId,
      presetName,
    );
  }

  // ---------- Contracts ----------

  public onMessage(event: HardwareHostEvent): void {
    switch (event.type) {
      case 'HARDWARE_PORT_STATUS':
        this.setPortStatus(event.status);
        break;
      case 'HARDWARE_SYSEX_TX_START':
      case 'HARDWARE_SYSEX_TX_PROGRESS':
      case 'HARDWARE_SYSEX_RX_START':
      case 'HARDWARE_SYSEX_RX_PROGRESS':
        this.updateXfer(event);
        break;
      case 'HARDWARE_SYSEX_RX_COMPLETE':
        this.finishReceive(event);
        break;
      case 'HARDWARE_SYSEX_TX':
        this.addActivity(this.t.txBlockActivity(event.data.length, event.dumpId));
        break;
      case 'HARDWARE_SYSEX_RX':
        this.addActivity(this.t.rxBlockActivity(event.data.length));
        if (this.liveInspector) {
          this.liveInspector.updateBuffer(event.data);
        }
        break;
      default:
        console.warn('[HardwareDumpsDrawer] Unknown host event', event);
    }
  }

  public send(request: HardwareHostRequest): void {
    try {
      WebBridge.send(request as any);
    } catch (err) {
      console.warn('[HardwareDumpsDrawer] Error enviando al bridge', err);
    }
  }

  // ---------- UI ----------

  private mount(): void {
    this.mainPanel = document.createElement('div');
    this.mainPanel.className = 'hardware-dumps-panel';
    this.mainPanel.style.cssText = 'display:flex; flex-direction:column; height:100%; overflow:hidden;';
    this.mainPanel.innerHTML = `
      <div class="drawer-header">
        <div class="panel-caption" style="display:flex; align-items:center; gap:var(--space-2);">
          <span class="panel-badge">SYSEX</span>
          <span class="panel-title">HARDWARE SYSEX DUMPS &amp; LIVE INSPECTOR</span>
          <span class="panel-badge" style="opacity:0.75;">MMA 00 20 50 01</span>
        </div>
        <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-hw-dumps-close" title="Close (Esc)">${ICONS.close}</button>
      </div>

      <div class="drawer-body" style="flex:1 1 0%; min-height:0; overflow-y:auto; display:flex; flex-direction:column; gap:var(--space-3); padding:var(--space-3);">
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:var(--space-3); flex-shrink:0;">
          <section class="hw-dump-section" id="hw-port-section" style="flex-shrink:0;"></section>
          <section class="hw-dump-section" id="hw-xfer-section" style="flex-shrink:0;"></section>
        </div>
        <section class="hw-dump-section" id="hw-send-section" style="flex-shrink:0;"></section>
        <section class="hw-dump-section" id="hw-received-section" style="flex-shrink:0;"></section>
        <section class="hw-dump-section" id="hw-inspector-section" style="min-height:280px; flex-shrink:0;"></section>
        <section class="hw-dump-section" id="hw-activity-section" style="flex-shrink:0;"></section>
        <input type="file" id="hw-syx-file-input" accept=".syx,.mid,.bin" style="display:none;" />
      </div>
    `;

    this.mainPanel.querySelector('#btn-hw-dumps-close')?.addEventListener('click', () => this.close());

    this.portPanel = this.mainPanel.querySelector('#hw-port-section') as HTMLElement;
    this.xferPanel = this.mainPanel.querySelector('#hw-xfer-section') as HTMLElement;
    this.receivedPanel = this.mainPanel.querySelector('#hw-received-section') as HTMLElement;
    this.sendPanel = this.mainPanel.querySelector('#hw-send-section') as HTMLElement;
    this.inspectorHostEl = this.mainPanel.querySelector('#hw-inspector-section') as HTMLElement;
    this.activityPanel = this.mainPanel.querySelector('#hw-activity-section') as HTMLElement;
    this.fileInputEl = this.mainPanel.querySelector('#hw-syx-file-input') as HTMLInputElement;

    this.fileInputEl?.addEventListener('change', () => {
      const file = this.fileInputEl?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          this.handleImportedSyxBytes(new Uint8Array(reader.result), file.name);
        }
      };
      reader.readAsArrayBuffer(file);
      this.fileInputEl!.value = '';
    });

    if (this.inspectorHostEl) {
      const initialDump = this.buildLiveDump(this.state.selectedMode);
      this.liveInspector = new LiveSysExInspector({
        container: this.inspectorHostEl,
        title: 'HARTMANN NEURON 7-BIT SYSEX FRAME',
        floating: false,
        bytesPerRow: 16,
        initialBuffer: initialDump.data,
      });
    }
  }

  private render(): void {
    this.renderPort();
    this.renderXfer();
    this.renderSend();
    this.renderReceived();
    this.renderActivity();
  }

  private renderPort(): void {
    if (!this.portPanel) return;
    const status = this.state.portStatus;
    const connected = status?.connected ?? false;
    const name = status?.name ?? 'Local Edit Buffer / USB MIDI Standby';
    const deviceId = status?.deviceId ?? 0;

    this.portPanel.innerHTML = `
      <div class="drawer-section" style="height:100%; display:flex; flex-direction:column; justify-content:space-between; gap:var(--space-2);">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div class="drawer-section-title" style="margin:0;">${ICONS.midi} MIDI PORT &amp; DEVICE ID</div>
          <span class="panel-badge" style="color:${connected ? 'var(--color-accent-primary)' : 'var(--color-text-muted)'};">
            ${connected ? 'ONLINE' : 'LOCAL / STUB'}
          </span>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; gap:var(--space-3);">
          <div style="display:flex; flex-direction:column; gap:4px; font-size:11px;">
            <div><span style="color:var(--color-text-muted);">Port:</span> <strong>${escapeHtml(name)}</strong></div>
            <div><span style="color:var(--color-text-muted);">SysEx Header:</span> <code>F0 00 20 50 01 ${deviceId.toString(16).toUpperCase().padStart(2, '0')}</code></div>
            <div style="margin-top:4px;">
              <button type="button" class="btn btn-sm btn-secondary" id="btn-hw-refresh-port">${ICONS.refresh} Scan MIDI Port</button>
            </div>
          </div>
          <div id="hw-device-id-knob-host" style="display:flex; align-items:center; justify-content:center;"></div>
        </div>
      </div>
    `;

    this.portPanel.querySelector('#btn-hw-refresh-port')?.addEventListener('click', () => {
      this.addActivity(this.t.scanPortActivity);
      this.send({ type: 'HARDWARE_GET_PORT_STATUS' });
    });

    const knobHost = this.portPanel.querySelector('#hw-device-id-knob-host') as HTMLElement | null;
    if (knobHost) {
      new Knob(knobHost, {
        label: 'DEV ID',
        size: 38,
        value: deviceId / 127.0,
        format: (v: number) => `0x${Math.round(v * 127.0).toString(16).toUpperCase().padStart(2, '0')}`,
        onChange: (normVal: number) => {
          const nextId = Math.max(0, Math.min(127, Math.round(normVal * 127.0)));
          this.state.portStatus = { ...this.state.portStatus, deviceId: nextId };
          this.send({ type: 'HARDWARE_SET_DEVICE_ID', deviceId: nextId });
          this.refreshLiveInspector();
        },
      });
    }
  }

  private renderXfer(): void {
    if (!this.xferPanel) return;
    const xfer = this.state.activeXfer;
    if (!xfer?.active) {
      const meta = hardwareDumpMetaForModeAndDir(this.state.selectedMode, 'tx');
      this.xferPanel.innerHTML = `
        <div class="drawer-section" style="height:100%; display:flex; flex-direction:column; justify-content:space-between; gap:var(--space-2);">
          <div class="drawer-section-title" style="margin:0;">${ICONS.refresh} TRANSFER STATUS</div>
          <div style="font-size:11px; color:var(--color-text-muted); display:flex; flex-direction:column; gap:4px;">
            <div>${escapeHtml(this.t.statusLabel)}: <strong style="color:var(--color-text-primary);">${escapeHtml(this.t.statusIdle)}</strong></div>
            <div>${escapeHtml(this.t.activeModeLabel)}: <strong>${meta.label}</strong> (${meta.estimatedBytes ?? 1066} ${escapeHtml(this.t.bytesEstSuffix)})</div>
            <div>${escapeHtml(this.t.encodingLabel)}: <strong>7-bit Packed MSB-Index + Checksum</strong></div>
          </div>
        </div>
      `;
      return;
    }

    this.xferPanel.innerHTML = `
      <div class="drawer-section" style="height:100%; display:flex; flex-direction:column; justify-content:space-between; gap:var(--space-2);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div class="drawer-section-title" style="margin:0;">${ICONS.refresh} ACTIVE TRANSFER</div>
          <button type="button" class="btn btn-sm btn-secondary" id="btn-hw-cancel-xfer">${escapeHtml(this.t.abortBtn)}</button>
        </div>
        <div style="font-size:11px; display:flex; flex-direction:column; gap:4px;">
          <div>${escapeHtml(this.t.directionLabel)}: <strong>${xfer.direction === 'tx' ? 'TX (Synth <- Host)' : 'RX (Host <- Synth)'}</strong></div>
          <div>${escapeHtml(this.t.modeLabel)}: <strong>${xfer.mode}</strong> (${xfer.transferred} / ${xfer.total ?? '?'} B — ${xfer.percent}%)</div>
          <div style="height:6px; background:rgba(0,0,0,0.4); border-radius:3px; overflow:hidden; border:1px solid var(--color-border-subtle);">
            <div style="height:100%; width:${xfer.percent}%; background:var(--color-accent-primary); transition:width 120ms ease;"></div>
          </div>
        </div>
      </div>
    `;

    this.xferPanel.querySelector('#btn-hw-cancel-xfer')?.addEventListener('click', () => {
      this.state.activeXfer = null;
      this.send({ type: 'HARDWARE_FLUSH_ACTIVE_XFERS' });
      this.addActivity(this.t.xferAbortedActivity);
      this.renderXfer();
    });
  }

  private renderSend(): void {
    if (!this.sendPanel) return;
    const pending = this.state.pendingSend;
    if (pending) {
      this.sendPanel.innerHTML = `
        <div class="drawer-section" style="display:flex; flex-direction:column; gap:var(--space-2);">
          <div class="drawer-section-title" style="margin:0;">${ICONS.midi} ${escapeHtml(this.t.confirmTxTitle)}</div>
          <div style="font-size:11px; color:var(--color-text-secondary);">
            ${escapeHtml(this.t.preparedLabel)}: <strong>${escapeHtml(pending.summary ?? pending.mode)}</strong> (${pending.data.length} bytes)
          </div>
          <div style="display:flex; gap:var(--space-2);">
            <button type="button" class="btn btn-sm btn-primary" data-action="confirm-send">${escapeHtml(this.t.transmitTxBtn)}</button>
            <button type="button" class="btn btn-sm btn-secondary" data-action="apply-local">${escapeHtml(this.t.applyLocalRxBtn)}</button>
            <button type="button" class="btn btn-sm btn-secondary" data-action="cancel-send">${escapeHtml(this.t.cancelBtn)}</button>
          </div>
        </div>
      `;
      this.sendPanel.querySelector('[data-action="confirm-send"]')?.addEventListener('click', () => this.confirmSend(pending));
      this.sendPanel.querySelector('[data-action="apply-local"]')?.addEventListener('click', () => {
        this.applyDumpToLocalSynth(pending);
        this.state.pendingSend = null;
        this.renderSend();
      });
      this.sendPanel.querySelector('[data-action="cancel-send"]')?.addEventListener('click', () => {
        this.state.pendingSend = null;
        this.renderSend();
      });
      return;
    }

    const txModes = HARDWARE_DUMP_META.filter((m) => m.direction === 'tx');
    this.sendPanel.innerHTML = `
      <div class="drawer-section" style="display:flex; flex-direction:column; gap:var(--space-2);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:var(--space-2);">
          <div class="drawer-section-title" style="margin:0;">${ICONS.midi} SYSEX DUMP MODES (TX / RX / .SYX)</div>
          <div style="display:flex; gap:var(--space-2);">
            <button type="button" class="btn btn-sm btn-secondary" id="btn-hw-import-syx" title="${escapeHtml(this.t.importSyxTitle)}">
              ${ICONS.folder} Import .syx
            </button>
            <button type="button" class="btn btn-sm btn-secondary" id="btn-hw-request-rx" title="${escapeHtml(this.t.requestRxTitle)}">
              ${ICONS.refresh} Request RX Dump
            </button>
            <button type="button" class="btn btn-sm btn-primary" id="btn-hw-prepare-tx" title="${escapeHtml(this.t.prepareTxTitle)}">
              ${ICONS.midi} Prepare TX Dump
            </button>
          </div>
        </div>
        <div class="hw-dump-chips" id="hw-send-chips" style="display:grid; grid-template-columns:repeat(4, 1fr); gap:var(--space-2);">
          ${txModes
            .map((m) => {
              const active = m.mode === this.state.selectedMode;
              return `
                <button
                  type="button"
                  class="btn btn-sm ${active ? 'btn-primary active' : 'btn-secondary'} hw-send-chip"
                  data-mode="${m.mode}"
                  style="display:flex; flex-direction:column; align-items:center; padding:6px 8px; gap:2px;"
                >
                  <span style="font-weight:700;">${m.label}</span>
                  <span style="font-size:10px; opacity:0.75;">~${m.estimatedBytes ?? 1066} B</span>
                </button>
              `;
            })
            .join('')}
        </div>
      </div>
    `;

    this.sendPanel.querySelectorAll('.hw-send-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode') as HardwareDumpMode;
        this.state.selectedMode = mode;
        const dump = this.buildLiveDump(mode);
        this.state.pendingSend = dump;
        if (this.liveInspector) {
          this.liveInspector.updateBuffer(dump.data);
        }
        this.render();
      });
    });

    this.sendPanel.querySelector('#btn-hw-prepare-tx')?.addEventListener('click', () => {
      const dump = this.buildLiveDump(this.state.selectedMode);
      this.state.pendingSend = dump;
      if (this.liveInspector) {
        this.liveInspector.updateBuffer(dump.data);
      }
      this.renderSend();
    });

    this.sendPanel.querySelector('#btn-hw-request-rx')?.addEventListener('click', () => {
      const dump = this.buildLiveDump(this.state.selectedMode);
      this.addActivity(this.t.requestRxActivity(this.state.selectedMode));
      this.send({
        type: 'HARDWARE_TX_DUMP_REQUEST',
        dump,
        deviceId: this.state.portStatus.deviceId,
      });
    });

    this.sendPanel.querySelector('#btn-hw-import-syx')?.addEventListener('click', () => {
      this.fileInputEl?.click();
    });
  }

  private renderReceived(): void {
    if (!this.receivedPanel) return;
    const r = this.state.lastReceived;
    if (!r) {
      this.receivedPanel.innerHTML = '';
      this.receivedPanel.style.display = 'none';
      return;
    }
    this.receivedPanel.style.display = 'block';

    this.receivedPanel.innerHTML = `
      <div class="drawer-section" style="display:flex; justify-content:space-between; align-items:center; gap:var(--space-2); flex-wrap:wrap;">
        <div style="font-size:11px;">
          <span class="panel-badge">LAST RX / IMPORTED</span>
          <strong style="margin-left:6px;">${escapeHtml(r.summary ?? r.mode)}</strong>
          <span style="color:var(--color-text-muted); margin-left:6px;">(${r.data.length} bytes)</span>
        </div>
        <div style="display:flex; gap:var(--space-2);">
          <button type="button" class="btn btn-sm btn-primary" data-action="apply-rx">${escapeHtml(this.t.applyToSynthBtn)}</button>
          <button type="button" class="btn btn-sm btn-secondary" data-action="send" data-mode="${r.mode}">${escapeHtml(this.t.resendTxBtn)}</button>
          <button type="button" class="btn btn-sm btn-secondary" data-action="discard">${escapeHtml(this.t.discardBtn)}</button>
        </div>
      </div>
    `;

    this.receivedPanel.querySelector('[data-action="apply-rx"]')?.addEventListener('click', () => {
      this.applyDumpToLocalSynth(r);
    });
    this.receivedPanel.querySelector('[data-action="send"]')?.addEventListener('click', () => this.requestSend(r));
    this.receivedPanel.querySelector('[data-action="discard"]')?.addEventListener('click', () => {
      const discardId = r.id;
      this.state.lastReceived = null;
      this.send({ type: 'HARDWARE_DUMP_DISCARD', dumpId: discardId });
      this.renderReceived();
    });
  }

  private renderActivity(): void {
    if (!this.activityPanel) return;
    this.activityPanel.innerHTML = `
      <div class="drawer-section" style="display:flex; flex-direction:column; gap:var(--space-2);">
        <div class="drawer-section-title" style="margin:0;">${ICONS.terminal} SYSEX ACTIVITY LOG</div>
        <div class="hw-dump-activity" id="hw-activity-list" style="font-family:var(--font-mono, monospace); font-size:11px; max-height:110px; overflow-y:auto; display:flex; flex-direction:column; gap:2px; color:var(--color-text-secondary);">
          ${this.state.activity
            .slice(-12)
            .map((line) => `<div class="hw-dump-activity-line">${escapeHtml(line)}</div>`)
            .join('')}
        </div>
      </div>
    `;
  }

  private addActivity(line: string): void {
    const ts = new Date().toLocaleTimeString('es-ES', { hour12: false });
    this.state.activity.push(`[${ts}] ${line}`);
    if (this.state.activity.length > 40) {
      this.state.activity = this.state.activity.slice(-20);
    }
    this.renderActivity();
  }

  // ---------- Importación y aplicación de Dumps ----------

  public handleImportedSyxBytes(bytes: Uint8Array, sourceLabel: string = 'syx'): void {
    const decoded = decodeHartmannSysExDump(bytes);
    const payload: HardwareDumpPayload = {
      id: `import-${Date.now()}`,
      mode: decoded.mode ?? 'current',
      data: bytes,
      summary: decoded.valid
        ? decoded.summary
        : `Raw SysEx (${sourceLabel}) — ${bytes.length} B`,
    };
    this.state.lastReceived = payload;
    if (this.liveInspector) {
      this.liveInspector.updateBuffer(bytes);
    }
    this.renderReceived();
    this.addActivity(this.t.importedActivity(sourceLabel, payload.summary ?? payload.mode));
    if (decoded.valid && decoded.params) {
      this.applyDumpToLocalSynth(payload);
    }
  }

  private applyDumpToLocalSynth(dump: HardwareDumpPayload): void {
    const decoded = decodeHartmannSysExDump(dump.data);
    if (!decoded.valid || !decoded.params) {
      this.addActivity(this.t.invalidDumpActivity(dump.data.length));
      return;
    }

    for (let i = 0; i < decoded.params.length; ++i) {
      WebBridge.setParam(i, decoded.params[i]);
    }
    this.callbacks.onApplyDecodedParams?.(decoded.params, decoded.presetName);
    this.addActivity(
      this.t.appliedParamsActivity(decoded.params.length, decoded.presetName, decoded.checksumValid),
    );
  }

  // ---------- Acciones ----------

  private requestSend(dump: HardwareDumpPayload): void {
    this.addActivity(this.t.transmittingActivity(dump.mode, dump.data.length));
    this.send({
      type: 'HARDWARE_RX_DUMP_SEND_REQUEST',
      dump,
      deviceId: this.state.portStatus.deviceId,
    });
  }

  private confirmSend(dump: HardwareDumpPayload): void {
    this.addActivity(this.t.confirmedTxActivity(dump.mode, dump.data.length));
    this.state.pendingSend = null;
    if (this.liveInspector) {
      this.liveInspector.updateBuffer(dump.data);
    }
    this.renderSend();
    this.send({
      type: 'HARDWARE_RX_DUMP_SEND_REQUEST',
      dump,
      deviceId: this.state.portStatus.deviceId,
    });
  }

  private setPortStatus(status: HardwarePortStatus): void {
    this.state.portStatus = status;
    this.renderPort();
  }

  private updateXfer(event: HardwareHostEvent): void {
    const isTx = event.type.includes('TX');
    const mode = (event as any).mode as HardwareDumpMode | undefined;
    if (!mode) return;

    const existing = this.state.activeXfer;
    if (!existing || existing.mode !== mode || existing.direction !== (isTx ? 'tx' : 'rx')) {
      this.state.activeXfer = {
        active: true,
        direction: isTx ? 'tx' : 'rx',
        mode,
        transferred: 0,
        total: (event as any).totalBytes ?? null,
        percent: 0,
      };
    } else {
      const transferred =
        typeof (event as any).transferred === 'number' ? (event as any).transferred : existing.transferred;
      const total =
        typeof (event as any).total === 'number'
          ? (event as any).total
          : existing.total ??
            (typeof (event as any).totalBytes === 'number' ? (event as any).totalBytes : existing.total);
      const percent = total ? Math.round((transferred / total) * 100) : 0;
      this.state.activeXfer = {
        ...existing,
        transferred,
        total,
        percent,
      };
    }

    this.renderXfer();
  }

  private finishReceive(event: HardwareHostEvent & { type: 'HARDWARE_SYSEX_RX_COMPLETE' }): void {
    this.state.activeXfer = null;
    this.state.lastReceived = event.payload;
    if (this.liveInspector && event.payload?.data) {
      this.liveInspector.updateBuffer(event.payload.data);
    }
    this.renderXfer();
    this.renderReceived();
    this.addActivity(this.t.rxCompleteActivity(event.payload.mode, event.payload.data.length));
  }
}
