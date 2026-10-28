/**
 * ABDAxionikVS — WebBridge.ts
 * Comunicación bidireccional entre WebUI y C++ (WebView2) / WASM
 */

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
  | { type: 'INIT_PRESET' }
  | { type: 'MIDI_CC'; cc: number; value: number }
  | { type: 'SET_MASTER_VOLUME'; volume: number }
  | { type: 'SET_ORACLE_CLIP_MODE'; enabled: boolean }
  | { type: 'SCAN_BANK' }
  | { type: 'UI_READY' };

export type IncomingBridgeMessage =
  | { type: 'PARAM_UPDATE'; index: number; value: number }
  | { type: 'PRESET_LOADED'; name: string; r1Model: number; r2Model: number; values: number[] }
  | { type: 'TELEMETRY'; cpuUsage: number; activeVoices: number; peakL: number; peakR: number }
  | { type: 'BANK_CATALOG_SYNC'; [key: string]: unknown };

export type BridgeMessage = OutgoingBridgeMessage | IncomingBridgeMessage | { type: string; [key: string]: any };

export type MessageHandler = (msg: BridgeMessage) => void;

class WebBridgeImpl {
  private handlers: Set<MessageHandler> = new Set();
  private isNative: boolean = false;
  private paramCache: Map<number, number> = new Map();
  private uiState: Map<string, any> = new Map();

  constructor() {
    this.checkNative();
    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => this.checkNative());
    }
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

  public send(msg: BridgeMessage) {
    this.checkNative();
    const juce = (window as any).__JUCE__;
    if (juce?.backend?.emitEvent) {
      juce.backend.emitEvent('nativeEvent', msg);
    } else if (typeof (window as any).chrome?.webview?.postMessage === 'function') {
      (window as any).chrome.webview.postMessage(msg);
    } else {
      // Dev mode telemetry / mock output
      if ((import.meta as any).env?.DEV) {
        console.log('[WebBridge Dev OUT]', msg);
      }
    }
  }

  public clearCache(): void {
    this.paramCache.clear();
  }

  public setParam(index: number, value: number) {
    this.paramCache.set(index, value);
    this.send({ type: 'PARAM_SET', index, value });
  }

  public getParam(index: number, defaultValue: number = 0): number {
    return this.paramCache.has(index) ? (this.paramCache.get(index) as number) : defaultValue;
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

  public setParamInternal(index: number, value: number) {
    this.paramCache.set(index, value);
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
