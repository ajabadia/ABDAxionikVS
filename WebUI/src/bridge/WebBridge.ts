/**
 * ABDAxionikVS — WebBridge.ts
 * Comunicación bidireccional entre WebUI y C++ (WebView2) / WASM
 */

import { wasmBridge } from './BridgeWasm.js';

export type OutgoingBridgeMessage =
  | { type: 'PARAM_SET'; index: number; value: number }
  | { type: 'NOTE_ON'; note: number; velocity: number }
  | { type: 'NOTE_OFF'; note: number }
  | { type: 'ALL_NOTES_OFF' }
  | { type: 'PITCH_BEND'; value: number }
  | { type: 'MOD_WHEEL'; value: number }
  | { type: 'CHANNEL_PRESSURE'; value: number }
  | { type: 'LOAD_PRESET_SCRIPT'; script: string }
  | { type: 'LOAD_PRESET_SLOT'; slot: number }
  | { type: 'LOAD_MODEL_SLOT'; slot: number; resynator: 1 | 2 }
  | { type: 'SET_ENGINE_MODE'; mode: 'classic' | 'plus' | 'expanded' }
  | { type: 'LOAD_EXPANDED_MODEL_JSON'; resynator: 1 | 2; json: string }
  | { type: 'INIT_PRESET' }
  | { type: 'MIDI_CC'; cc: number; value: number }
  | { type: 'SET_MASTER_VOLUME'; volume: number }
  | { type: 'SET_ORACLE_CLIP_MODE'; enabled: boolean }
  | { type: 'SCAN_BANK' }
  | { type: 'UI_READY' }
  | { type: 'SEND_HARDWARE_DUMP'; target: 'HARDWARE_DUMP_CURRENT' | 'HARDWARE_DUMP_ALL_SOUNDS' | 'HARDWARE_DUMP_ALL_SETUPS' | 'HARDWARE_DUMP_ALL_MODELS' }
  | { type: 'HARDWARE_DUMP_RECEIVE'; target: string; data: number[] };

export type IncomingBridgeMessage =
  | { type: 'PARAM_UPDATE'; index: number; value: number }
  | { type: 'PRESET_LOADED'; name: string; r1Model: number; r2Model: number; values: number[] }
  | { type: 'TELEMETRY'; cpuUsage: number; activeVoices: number; peakL: number; peakR: number }
  | { type: 'BANK_CATALOG_SYNC'; [key: string]: unknown }
  | { type: 'HARDWARE_DUMP_RECEIVED'; target: string; raw: number[]; parsed: unknown };

export type BridgeMessage = OutgoingBridgeMessage | IncomingBridgeMessage | { type: string; [key: string]: any };

export type MessageHandler = (msg: BridgeMessage) => void;
export type LocalParamHandler = (index: number, value: number) => void;

class WebBridgeImpl {
  private handlers: Set<MessageHandler> = new Set();
  private localParamHandlers: Set<LocalParamHandler> = new Set();
  private isNative: boolean = false;
  private paramCache: Map<number, number> = new Map();
  private uiState: Map<string, any> = new Map();

  constructor() {
    this.seedDefaultEnvelopes();
    this.checkNative();
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => this.checkNative());
    }

    wasmBridge.onTelemetry((telemetry) => {
      if (!this.isNative) {
        this.notify(telemetry);
      }
    });

    wasmBridge.onReady(() => {
      if (!this.isNative) {
        for (const [idx, val] of this.paramCache.entries()) {
          wasmBridge.post({ type: 'PARAM_SET', index: idx, value: val });
        }
      }
    });
  }

  /**
   * Inicializa las 7 envolventes ADSR con perfiles musicales diferenciados y reales
   * (basados en 000.sound Symbiont y curvas canónicas por generador: R1 Amp, R1 Res,
   * R1 Free, R2 Amp, R2 Res, R2 Free y Silver Filter Env) para que nunca muestren
   * un valor clónico o estático antes de recibir el volcado nativo.
   */
  public seedDefaultEnvelopes(): void {
    const initialProfiles: Array<[number, [number, number, number, number]]> = [
      [200, [4, 28, 127, 50]],   // R1 AMP  [200..203]: ataque rápido, sustain máximo, cola media
      [182, [74, 84, 32, 57]],   // R1 RES  [182..185]: barrido progresivo de contorno (000.sound)
      [205, [32, 68, 54, 72]],   // R1 FREE [205..208]: envolvente libre de modulación 1
      [230, [18, 46, 108, 58]],  // R2 AMP  [230..233]: envolvente de capa secundaria / pad
      [212, [52, 76, 44, 63]],   // R2 RES  [212..215]: barrido esférico de Resynator 2
      [235, [60, 30, 88, 46]],   // R2 FREE [235..238]: envolvente libre de modulación 2
      [355, [65, 75, 79, 89]],   // FLT ENV [355..358]: envolvente del filtro Silver (000.sound)
    ];
    for (const [baseIdx, [a, d, s, r]] of initialProfiles) {
      if (!this.paramCache.has(baseIdx)) this.paramCache.set(baseIdx, a);
      if (!this.paramCache.has(baseIdx + 1)) this.paramCache.set(baseIdx + 1, d);
      if (!this.paramCache.has(baseIdx + 2)) this.paramCache.set(baseIdx + 2, s);
      if (!this.paramCache.has(baseIdx + 3)) this.paramCache.set(baseIdx + 3, r);
    }
  }

  /**
   * Actualiza de forma optimista/determinista los 7 generadores ADSR al cambiar de slot
   * de preset (en modo navegador/preview se mantiene; en modo nativo C++ lo sobreescribe
   * milisegundos después con el volcado exacto de PRESET_LOADED).
   */
  public seedPresetSlotEnvelopes(slot: number): void {
    if (slot <= 0) {
      this.paramCache.delete(200); this.paramCache.delete(201); this.paramCache.delete(202); this.paramCache.delete(203);
      this.paramCache.delete(182); this.paramCache.delete(183); this.paramCache.delete(184); this.paramCache.delete(185);
      this.paramCache.delete(205); this.paramCache.delete(206); this.paramCache.delete(207); this.paramCache.delete(208);
      this.paramCache.delete(230); this.paramCache.delete(231); this.paramCache.delete(232); this.paramCache.delete(233);
      this.paramCache.delete(212); this.paramCache.delete(213); this.paramCache.delete(214); this.paramCache.delete(215);
      this.paramCache.delete(235); this.paramCache.delete(236); this.paramCache.delete(237); this.paramCache.delete(238);
      this.paramCache.delete(355); this.paramCache.delete(356); this.paramCache.delete(357); this.paramCache.delete(358);
      this.seedDefaultEnvelopes();
      return;
    }
    const bases = [200, 182, 205, 230, 212, 235, 355];
    bases.forEach((baseIdx, envIdx) => {
      const seed = (slot * 37 + (envIdx + 1) * 53) & 0x7fffffff;
      const a = (seed * 13 + envIdx * 19) % 115;
      const d = 15 + ((seed * 29 + envIdx * 31) % 105);
      const s = envIdx === 0 || envIdx === 3 ? 75 + ((seed * 17) % 53) : 15 + ((seed * 41 + envIdx * 23) % 105);
      const r = 12 + ((seed * 59 + envIdx * 43) % 108);
      this.paramCache.set(baseIdx, a);
      this.paramCache.set(baseIdx + 1, d);
      this.paramCache.set(baseIdx + 2, s);
      this.paramCache.set(baseIdx + 3, r);
    });
  }

  private checkNative() {
    if (typeof window === 'undefined') return;
    if (this.isNative) return;
    const juce = (window as any).__JUCE__;
    if (juce?.backend) {
      this.isNative = true;
      juce.backend.addEventListener('event', (data: any) => {
        this.notify(data);
      });
      console.log('[WebBridge] Conectado a JUCE WebView2 backend (__JUCE__.backend).');
      return;
    }

    if (typeof (window as any).chrome?.webview?.postMessage === 'function') {
      this.isNative = true;
      (window as any).chrome.webview.addEventListener('message', (event: any) => {
        const data = event.data;
        this.notify(data);
      });
      console.log('[WebBridge] Conectado a chrome.webview nativo.');
    }
  }

  public clearCache(): void {
    this.paramCache.clear();
    this.seedDefaultEnvelopes();
  }

  public setParamInternal(index: number, value: number) {
    this.paramCache.set(index, value);
  }

  public escapeHtml(str: string): string {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public send(msg: BridgeMessage) {
    this.checkNative();
    const juce = (window as any).__JUCE__;
    if (juce?.backend?.emitEvent) {
      juce.backend.emitEvent('nativeEvent', msg);
    } else if (typeof (window as any).chrome?.webview?.postMessage === 'function') {
      (window as any).chrome.webview.postMessage(msg);
    } else {
      wasmBridge.post(msg as Record<string, unknown>);
      if ((import.meta as any).env?.DEV) {
        console.log('[WebBridge Dev OUT -> WASM]', msg);
      }
    }
  }

  public sendAny(msg: Record<string, unknown>) {
    this.send(msg as BridgeMessage);
  }

  public setParam(index: number, value: number) {
    this.paramCache.set(index, value);
    this.send({ type: 'PARAM_SET', index, value });
    for (const h of this.localParamHandlers) {
      try {
        h(index, value);
      } catch (err) {
        console.error('[WebBridge LocalParamHandler Error]', err);
      }
    }
  }

  public onLocalParamSet(handler: LocalParamHandler): () => void {
    this.localParamHandlers.add(handler);
    return () => this.localParamHandlers.delete(handler);
  }

  public getParam(index: number, defaultValue: number = 0): number {
    return this.paramCache.has(index) ? (this.paramCache.get(index) as number) : defaultValue;
  }

  /**
   * Snapshot of all cached parameters as a plain dictionary.
   * Values are copies of what is in this.paramCache; indexes not in
   * cache fall back to their default (0).
   */
  public getAllCachedParams(): Record<number, number> {
    const out: Record<number, number> = {};
    for (const [index, value] of this.paramCache.entries()) {
      out[index] = value;
    }
    return out;
  }

  public setUIState<T>(key: string, value: T): void {
    this.uiState.set(key, value);
  }

  public getUIState<T>(key: string, defaultValue: T): T {
    return this.uiState.has(key) ? (this.uiState.get(key) as T) : defaultValue;
  }

  public noteOn(note: number, velocity: number = 0.8) {
    this.send({ type: 'NOTE_ON', note, velocity });
  }

  public noteOff(note: number) {
    this.send({ type: 'NOTE_OFF', note });
  }

  public pitchBend(value: number) {
    this.send({ type: 'PITCH_BEND', value });
  }

  public modWheel(value: number) {
    this.send({ type: 'MOD_WHEEL', value });
  }

  public channelPressure(value: number) {
    this.send({ type: 'CHANNEL_PRESSURE', value });
  }

  public allNotesOff() {
    this.send({ type: 'ALL_NOTES_OFF' });
  }

  public loadPresetScript(script: string) {
    this.send({ type: 'LOAD_PRESET_SCRIPT', script });
  }

  public loadPresetSlot(slot: number) {
    this.send({ type: 'LOAD_PRESET_SLOT', slot });
  }

  public loadModelSlot(slot: number, resynator: 1 | 2) {
    this.send({ type: 'LOAD_MODEL_SLOT', slot, resynator });
  }

  public setEngineMode(mode: 'classic' | 'plus' | 'expanded') {
    this.setUIState('engineMode', mode);
    this.send({ type: 'SET_ENGINE_MODE', mode });
  }

  public loadExpandedModelJson(resynator: 1 | 2, json: string) {
    this.send({ type: 'LOAD_EXPANDED_MODEL_JSON', resynator, json });
  }

  public loadExpandedModelSlug(slug: string, resynator: 1 | 2) {
    this.send({ type: 'LOAD_EXPANDED_MODEL_SLUG', resynator, slug } as any);
  }

  public setBankFolderPath(bank: 'neuron' | 'axionik', path: string) {
    this.send({ type: 'SET_BANK_FOLDER_PATH', bank, path } as any);
  }

  public initPreset() {
    this.send({ type: 'INIT_PRESET' });
  }

  public sendMidiCC(cc: number, value: number) {
    this.send({ type: 'MIDI_CC', cc, value });
  }

  public setMasterVolume(volume: number) {
    const clamped = Math.max(0, Math.min(1, volume));
    this.setUIState('masterVolume', clamped);
    this.send({ type: 'SET_MASTER_VOLUME', volume: clamped });
  }

  public setOracleClipMode(enabled: boolean) {
    this.setUIState('oracleClipMode', enabled);
    this.send({ type: 'SET_ORACLE_CLIP_MODE', enabled });
  }

  public scanBank() {
    this.send({ type: 'SCAN_BANK' });
  }

  public sendHardwareDump(target: 'HARDWARE_DUMP_CURRENT' | 'HARDWARE_DUMP_ALL_SOUNDS' | 'HARDWARE_DUMP_ALL_SETUPS' | 'HARDWARE_DUMP_ALL_MODELS') {
    this.send({ type: 'SEND_HARDWARE_DUMP', target });
  }

  public onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  public notify(msg: BridgeMessage) {
    if (msg.type === 'PARAM_UPDATE' && typeof msg.index === 'number' && typeof msg.value === 'number') {
      this.paramCache.set(msg.index, msg.value);
    } else if (msg.type === 'PRESET_LOADED' && Array.isArray(msg.values)) {
      for (let i = 0; i < msg.values.length; ++i) {
        this.paramCache.set(i, msg.values[i]);
      }
    }
    for (const h of this.handlers) {
      try {
        h(msg);
      } catch (err) {
        console.error('[WebBridge Handler Error]', err);
      }
    }
  }
}

export const WebBridge = new WebBridgeImpl();
if (typeof window !== 'undefined') {
  (window as any).WebBridge = WebBridge;
}
