/**
 * ABDAxionikVS — WebBridge.ts
 * Comunicación bidireccional entre WebUI y C++ (WebView2) / WASM
 */

export interface BridgeMessage {
  type: string;
  [key: string]: any;
}

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
      // Mock echo / dev telemetry
      // console.log('[WebBridge Mock OUT]', msg);
    }
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
