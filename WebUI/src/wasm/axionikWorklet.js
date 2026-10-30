/**
 * ABDAxionikVS — AudioWorkletProcessor (axionikWorklet.js)
 * Ejecuta el motor C++20 real (DspEngineFacade) compilado a WebAssembly
 * dentro del hilo de audio del navegador (AudioWorkletGlobalScope).
 */

class AxionikWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.isReady = false;
    this.wasm = null;
    this.engineHandle = 0;
    this.debug = false;
    this._renderNoticeSent = false;
    this._telemetryCounter = 0;

    // Vistas tipadas sobre la memoria lineal de WebAssembly
    this.HEAP8 = null;
    this.HEAPU8 = null;
    this.HEAP16 = null;
    this.HEAP32 = null;
    this.HEAPF32 = null;
    this.HEAPF64 = null;

    // Punteros pre-asignados en el heap de WASM
    this.outLPtr = 0;
    this.outRPtr = 0;
    this.peakLPtr = 0;
    this.peakRPtr = 0;
    this.activeVoicesPtr = 0;
    this.cpuUsagePtr = 0;
    this.scratchStrPtr = 0;
    this.scratchStrCap = 65536;

    this.port.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  _allocate(size) {
    if (this.wasm && typeof this.wasm.malloc === 'function') {
      return this.wasm.malloc(size);
    }
    return 0;
  }

  _writeUtf8ToScratch(str) {
    if (!this.scratchStrPtr || !this.HEAPU8) return 0;
    const text = String(str ?? '');
    const maxLen = Math.min(text.length, this.scratchStrCap - 1);
    if (this.HEAPU8.buffer !== this.wasm.memory.buffer) {
      this._updateMemoryViews();
    }
    for (let i = 0; i < maxLen; ++i) {
      this.HEAPU8[this.scratchStrPtr + i] = text.charCodeAt(i) & 0xff;
    }
    this.HEAPU8[this.scratchStrPtr + maxLen] = 0;
    return this.scratchStrPtr;
  }

  _updateMemoryViews() {
    const buf = this.wasm.memory.buffer;
    this.HEAP8 = new Int8Array(buf);
    this.HEAPU8 = new Uint8Array(buf);
    this.HEAP16 = new Int16Array(buf);
    this.HEAP32 = new Int32Array(buf);
    this.HEAPF32 = new Float32Array(buf);
    this.HEAPF64 = new Float64Array(buf);
  }

  handleMessage(data) {
    if (!data) return;

    if (data.type === 'INIT_WASM') {
      this.debug = data.debug === true;
      this.initWasmFromBinary(data.binary, data.sampleRate || sampleRate);
      return;
    }

    if (this.isReady && this.wasm && this.engineHandle) {
      this.handleAudioMessage(data);
    }
  }

  handleAudioMessage(data) {
    const h = this.engineHandle;
    switch (data.type) {
      case 'NOTE_ON':
        this.wasm.axionik_note_on(h, data.note | 0, Number(data.velocity ?? 0.8));
        break;
      case 'NOTE_OFF':
        this.wasm.axionik_note_off(h, data.note | 0);
        break;
      case 'ALL_NOTES_OFF':
        this.wasm.axionik_all_notes_off(h);
        break;
      case 'PARAM_SET':
        this.wasm.axionik_set_param(h, data.index | 0, Number(data.value ?? 0));
        break;
      case 'PARAM_SET_NORM':
        this.wasm.axionik_set_param_norm(h, data.index | 0, Number(data.value ?? 0));
        break;
      case 'PITCH_BEND':
        this.wasm.axionik_pitch_bend(h, Number(data.value ?? 0));
        break;
      case 'MOD_WHEEL':
        this.wasm.axionik_mod_wheel(h, Number(data.value ?? 0));
        break;
      case 'CHANNEL_PRESSURE':
        this.wasm.axionik_channel_pressure(h, Number(data.value ?? 0));
        break;
      case 'MIDI_CC':
        this.wasm.axionik_midi_cc(h, data.cc | 0, Number(data.value ?? 0));
        break;
      case 'SET_MASTER_VOLUME':
        this.wasm.axionik_set_master_volume(h, Number(data.volume ?? 0.85));
        break;
      case 'SET_ORACLE_CLIP_MODE':
        this.wasm.axionik_set_oracle_clip_mode(h, data.enabled ? 1 : 0);
        break;
      case 'INIT_PRESET':
        this.wasm.axionik_init_preset(h);
        break;
      case 'LOAD_PRESET_SLOT':
        this.wasm.axionik_load_preset_slot(h, data.slot | 0);
        break;
      case 'LOAD_PRESET_SCRIPT': {
        const ptr = this._writeUtf8ToScratch(data.script || '');
        if (ptr) {
          this.wasm.axionik_load_preset_script(h, ptr);
        }
        break;
      }
      case 'LOAD_MODEL_SLOT': {
        const resSlot = data.resynator === 2 ? 1 : 0;
        this.wasm.axionik_load_model_slot(h, resSlot, data.slot | 0);
        break;
      }
      case 'CALIBRATION_SET': {
        const ptr = this._writeUtf8ToScratch(data.id || '');
        if (ptr) {
          this.wasm.axionik_set_calibration(h, ptr, Number(data.value ?? 0));
        }
        break;
      }
      case 'CALIBRATION_RESET': {
        const ptr = this._writeUtf8ToScratch(data.id || '');
        if (ptr) {
          this.wasm.axionik_reset_calibration(h, ptr);
        }
        break;
      }
      case 'CALIBRATION_RESET_ALL':
        this.wasm.axionik_reset_all_calibration(h);
        break;
      default:
        break;
    }
  }

  async initWasmFromBinary(wasmBinary, sr) {
    try {
      const baseImports = {
        __cxa_throw: (ptr) => {
          console.error('[AxionikWorklet] C++ exception thrown (ptr=' + ptr + ')');
        },
        _abort_js: () => {
          console.error('[AxionikWorklet] WASM abort');
        },
        abort: () => {
          console.error('[AxionikWorklet] WASM abort()');
        },
        emscripten_notify_memory_growth: () => {
          this._updateMemoryViews();
        },
        emscripten_resize_heap: (requestedSize) => {
          const oldSize = this.HEAPU8 ? this.HEAPU8.length : 0;
          const pages = ((requestedSize - oldSize + 65535) / 65536) | 0;
          try {
            this.wasm.memory.grow(Math.max(1, pages));
            this._updateMemoryViews();
            return 1;
          } catch (e) {
            return 0;
          }
        },
        clock_time_get: (_clkId, _precision, ptime) => {
          if (this.HEAPU8 && ptime) {
            if (this.HEAPU8.buffer !== this.wasm.memory.buffer) {
              this._updateMemoryViews();
            }
            const ns = BigInt(Math.floor((currentTime || 0) * 1e9));
            const view = new DataView(this.wasm.memory.buffer);
            view.setBigUint64(ptime, ns, true);
          }
          return 0;
        },
        fd_write: () => 0,
        fd_close: () => 0,
        fd_seek: () => 0,
        fd_read: () => 0,
        environ_sizes_get: () => 0,
        environ_get: () => 0,
        proc_exit: () => 0,
      };

      const proxyHandler = {
        get(target, prop) {
          if (prop in target) return target[prop];
          return () => 0;
        },
      };

      const wasmImports = {
        env: new Proxy(baseImports, proxyHandler),
        wasi_snapshot_preview1: new Proxy(baseImports, proxyHandler),
      };

      const result = await WebAssembly.instantiate(wasmBinary, wasmImports);
      const instance = result.instance || result;
      this.wasm = instance.exports;

      if (!this.wasm || !this.wasm.memory) {
        throw new Error('WASM module does not export linear memory.');
      }

      if (typeof this.wasm.__wasm_call_ctors === 'function') {
        this.wasm.__wasm_call_ctors();
      } else if (typeof this.wasm._initialize === 'function') {
        this.wasm._initialize();
      }

      this._updateMemoryViews();

      this.engineHandle = this.wasm.axionik_create();
      if (!this.engineHandle) {
        throw new Error('axionik_create() returned null handle.');
      }

      this.wasm.axionik_prepare(this.engineHandle, sr, 128);

      this.outLPtr = this._allocate(512 * 4);
      this.outRPtr = this._allocate(512 * 4);
      this.peakLPtr = this._allocate(4);
      this.peakRPtr = this._allocate(4);
      this.activeVoicesPtr = this._allocate(4);
      this.cpuUsagePtr = this._allocate(4);
      this.scratchStrPtr = this._allocate(this.scratchStrCap);

      this._updateMemoryViews();
      this.isReady = true;
      this.port.postMessage({ type: 'WASM_READY', sampleRate: sr });
    } catch (err) {
      console.error('[AxionikWorklet] WASM init error:', err);
      this.port.postMessage({
        type: 'WASM_ERROR',
        error: err && err.message ? err.message : String(err),
      });
    }
  }

  process(inputs, outputs) {
    if (!this.isReady || !this.wasm || !this.engineHandle) return true;

    const output = outputs[0];
    if (!output || output.length === 0 || !output[0]) return true;

    const outL = output[0];
    const outR = output[1] || output[0];
    const numSamples = outL.length;

    if (this.HEAPF32.buffer !== this.wasm.memory.buffer) {
      this._updateMemoryViews();
    }

    this.wasm.axionik_process(this.engineHandle, this.outLPtr, this.outRPtr, numSamples);

    if (this.HEAPF32.buffer !== this.wasm.memory.buffer) {
      this._updateMemoryViews();
    }

    if (this.debug && !this._renderNoticeSent) {
      this._renderNoticeSent = true;
      this.port.postMessage({
        type: 'WASM_RENDERING',
        renderer: 'raw-wasm-cpp',
        blockSize: numSamples,
      });
    }

    const wasmHeapL = this.HEAPF32.subarray(
      this.outLPtr >> 2,
      (this.outLPtr >> 2) + numSamples
    );
    const wasmHeapR = this.HEAPF32.subarray(
      this.outRPtr >> 2,
      (this.outRPtr >> 2) + numSamples
    );

    outL.set(wasmHeapL);
    if (outR !== outL) {
      outR.set(wasmHeapR);
    }

    // Emitir telemetría periódicamente (~cada 12 bloques ≈ 35 ms a 44.1 kHz)
    if (++this._telemetryCounter >= 12) {
      this._telemetryCounter = 0;
      this.wasm.axionik_get_telemetry(
        this.engineHandle,
        this.peakLPtr,
        this.peakRPtr,
        this.activeVoicesPtr,
        this.cpuUsagePtr
      );
      const peakL = this.HEAPF32[this.peakLPtr >> 2] || 0;
      const peakR = this.HEAPF32[this.peakRPtr >> 2] || 0;
      const activeVoices = this.HEAP32[this.activeVoicesPtr >> 2] || 0;
      const cpuUsage = this.HEAPF32[this.cpuUsagePtr >> 2] || 0;

      this.port.postMessage({
        type: 'TELEMETRY',
        peakL,
        peakR,
        activeVoices,
        cpuUsage,
      });
    }

    return true;
  }
}

registerProcessor('axionik-worklet-processor', AxionikWorkletProcessor);

