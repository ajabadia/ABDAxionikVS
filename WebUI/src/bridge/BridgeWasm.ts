/**
 * ABDAxionikVS — BridgeWasm.ts
 * Conecta la WebUI con el motor C++20 real (DspEngineFacade) compilado a WebAssembly
 * mediante AudioWorkletNode cuando se ejecuta en modo navegador (fuera de JUCE WebView2).
 */

export interface WasmTelemetryPayload {
  type: 'TELEMETRY';
  cpuUsage: number;
  activeVoices: number;
  peakL: number;
  peakR: number;
}

export class BridgeWasm {
  private audioCtx: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private masterGain: GainNode | null = null;
  private isInitialized: boolean = false;
  private initPromise: Promise<boolean> | null = null;
  private pendingMessages: Array<Record<string, unknown>> = [];
  private telemetryCallback: ((telemetry: WasmTelemetryPayload) => void) | null = null;
  private onReadyCallback: (() => void) | null = null;
  private gestureAttached: boolean = false;

  constructor() {
    this.attachFirstGestureUnlock();
  }

  public get audioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public get ready(): boolean {
    return this.isInitialized;
  }

  public onTelemetry(cb: (telemetry: WasmTelemetryPayload) => void): void {
    this.telemetryCallback = cb;
  }

  public onReady(cb: () => void): void {
    this.onReadyCallback = cb;
  }

  private attachFirstGestureUnlock(): void {
    if (this.gestureAttached || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (typeof AudioCtx !== 'function') {
      return;
    }
    this.gestureAttached = true;

    const unlock = () => {
      const juce = (window as any).__JUCE__;
      const isNative = Boolean(juce?.backend || (window as any).chrome?.webview?.postMessage);
      if (isNative) {
        cleanup();
        return;
      }
      void this.initAudio();
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };

    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  public async initAudio(): Promise<boolean> {
    if (this.isInitialized) {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }
      return true;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    if (typeof window === 'undefined') {
      return false;
    }
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (typeof AudioCtx !== 'function') {
      return false;
    }

    this.initPromise = this.initAudioPipeline(AudioCtx);
    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async fetchFirstAvailable(urls: string[]): Promise<Response> {
    let lastErr: unknown = null;
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) return res;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error(`Failed to fetch any of: ${urls.join(', ')}`);
  }

  private async addWorkletModuleFirstAvailable(ctx: AudioContext, urls: string[]): Promise<void> {
    let lastErr: unknown = null;
    for (const url of urls) {
      try {
        await ctx.audioWorklet.addModule(url);
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error(`Failed to load worklet module from: ${urls.join(', ')}`);
  }

  private async initAudioPipeline(AudioCtx: typeof AudioContext): Promise<boolean> {
    const isDev = Boolean((import.meta as any).env?.DEV);
    try {
      this.audioCtx = new AudioCtx({ latencyHint: 'interactive' });
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }

      await this.addWorkletModuleFirstAvailable(this.audioCtx, [
        'src/wasm/axionikWorklet.js',
        'wasm/axionikWorklet.js',
        './src/wasm/axionikWorklet.js',
        './wasm/axionikWorklet.js',
      ]);

      const response = await this.fetchFirstAvailable([
        'src/wasm/abdaxionikvs_dsp.wasm',
        'wasm/abdaxionikvs_dsp.wasm',
        './src/wasm/abdaxionikvs_dsp.wasm',
        './wasm/abdaxionikvs_dsp.wasm',
      ]);
      const wasmBinary = await response.arrayBuffer();

      this.workletNode = new AudioWorkletNode(this.audioCtx, 'axionik-worklet-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });

      let resolveReady!: () => void;
      let rejectReady!: (err: Error) => void;
      const readyPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timed out waiting for Axionik WASM_READY'));
        }, 10000);
        resolveReady = () => {
          clearTimeout(timeout);
          resolve();
        };
        rejectReady = (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        };
      });

      this.workletNode.port.onmessage = (event: MessageEvent) => {
        const data = event.data;
        if (!data) return;
        if (data.type === 'WASM_READY') {
          if (isDev) {
            console.log('[BridgeWasm] ABDAxionikVS WASM engine ready @', data.sampleRate, 'Hz');
          }
          resolveReady();
        } else if (data.type === 'WASM_ERROR') {
          rejectReady(new Error(data.error || 'WASM initialization failed'));
        } else if (data.type === 'TELEMETRY' && this.telemetryCallback) {
          this.telemetryCallback(data as WasmTelemetryPayload);
        }
      };

      this.workletNode.port.postMessage({
        type: 'INIT_WASM',
        binary: wasmBinary,
        sampleRate: this.audioCtx.sampleRate,
        debug: isDev,
      });

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 1.0;
      this.workletNode.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);

      await readyPromise;
      this.isInitialized = true;
      this.onReadyCallback?.();
      this.flushPendingMessages();
      return true;
    } catch (err) {
      if (isDev) {
        console.warn('[BridgeWasm] WASM AudioWorklet initialization skipped or failed:', err);
      }
      this.isInitialized = false;
      try {
        this.workletNode?.disconnect();
        this.masterGain?.disconnect();
        await this.audioCtx?.close();
      } catch {
        // Ignore cleanup errors
      }
      this.workletNode = null;
      this.masterGain = null;
      this.audioCtx = null;
      return false;
    }
  }

  public post(msg: Record<string, unknown>): void {
    if (msg.type === 'NOTE_ON' && !this.isInitialized && !this.initPromise) {
      void this.initAudio();
    } else if (msg.type === 'NOTE_ON' && this.audioCtx && this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => {});
    }

    if (this.isInitialized && this.workletNode) {
      this.workletNode.port.postMessage(msg);
      return;
    }

    if (this.pendingMessages.length < 1024) {
      this.pendingMessages.push(msg);
    }
  }

  private flushPendingMessages(): void {
    if (!this.isInitialized || !this.workletNode || this.pendingMessages.length === 0) {
      return;
    }
    const queue = this.pendingMessages;
    this.pendingMessages = [];
    for (const msg of queue) {
      this.workletNode.port.postMessage(msg);
    }
  }
}

export const wasmBridge = new BridgeWasm();

