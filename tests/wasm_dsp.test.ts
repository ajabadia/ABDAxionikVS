import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('WebAssembly DSP Module (abdaxionikvs_dsp.wasm)', () => {
  const wasmPath = path.resolve(__dirname, '../WebUI/src/wasm/abdaxionikvs_dsp.wasm');

  it('exists and instantiates cleanly with AudioWorklet import stubs', async () => {
    expect(fs.existsSync(wasmPath)).toBe(true);
    const wasmBytes = fs.readFileSync(wasmPath);
    expect(wasmBytes.byteLength).toBeGreaterThan(50_000);

    let wasmMemory: WebAssembly.Memory | null = null;
    const getHeapU8 = () => (wasmMemory ? new Uint8Array(wasmMemory.buffer) : null);
    const getHeapU32 = () => (wasmMemory ? new Uint32Array(wasmMemory.buffer) : null);

    const envStubs: Record<string, (...args: number[]) => number | void> = {
      emscripten_notify_memory_growth: () => {},
      emscripten_resize_heap: (requestedSize: number) => {
        if (!wasmMemory) return 0;
        const currentBytes = wasmMemory.buffer.byteLength;
        if (requestedSize <= currentBytes) return 1;
        const pagesNeeded = Math.ceil((requestedSize - currentBytes) / 65536);
        try {
          wasmMemory.grow(pagesNeeded);
          return 1;
        } catch {
          return 0;
        }
      },
      _abort_js: () => {},
      abort: () => {},
      __assert_fail: () => {},
      __cxa_throw: () => {},
      __cxa_allocate_exception: () => 0,
      emscripten_memcpy_js: (dest: number, src: number, num: number) => {
        const heap = getHeapU8();
        if (heap) heap.copyWithin(dest, src, src + num);
      },
    };

    const wasiStubs: Record<string, (...args: number[]) => number> = {
      fd_close: () => 0,
      fd_write: (_fd: number, _iov: number, _iovcnt: number, pnum: number) => {
        const u32 = getHeapU32();
        if (u32 && pnum) u32[pnum >> 2] = 0;
        return 0;
      },
      fd_seek: () => 0,
      fd_read: () => 0,
      environ_sizes_get: (penvironCount: number, penvironBufSize: number) => {
        const u32 = getHeapU32();
        if (u32) {
          if (penvironCount) u32[penvironCount >> 2] = 0;
          if (penvironBufSize) u32[penvironBufSize >> 2] = 0;
        }
        return 0;
      },
      environ_get: () => 0,
      clock_time_get: () => 0,
      proc_exit: () => 0,
    };

    const makeNamespaceProxy = (known: Record<string, (...args: number[]) => number | void>) =>
      new Proxy(known, {
        get(target, prop: string) {
          if (prop in target) return target[prop];
          return () => 0;
        },
      });

    const instantiated = await WebAssembly.instantiate(wasmBytes, {
      env: makeNamespaceProxy(envStubs),
      wasi_snapshot_preview1: makeNamespaceProxy(wasiStubs),
    });

    const exports = instantiated.instance.exports as Record<string, any>;
    wasmMemory = exports.memory as WebAssembly.Memory;
    expect(wasmMemory).toBeDefined();

    if (typeof exports._initialize === 'function') {
      exports._initialize();
    } else if (typeof exports.__wasm_call_ctors === 'function') {
      exports.__wasm_call_ctors();
    }

    const handle = exports.axionik_create();
    expect(handle).toBeGreaterThan(0);
    exports.axionik_prepare(handle, 48000, 128);

    const outLPtr = exports.malloc(128 * 4);
    const outRPtr = exports.malloc(128 * 4);
    const peakLPtr = exports.malloc(4);
    const peakRPtr = exports.malloc(4);
    const activeVoicesPtr = exports.malloc(4);
    const cpuUsagePtr = exports.malloc(4);

    // Trigger MIDI note 60 (C4) and render several blocks
    exports.axionik_note_on(handle, 60, 0.9);

    let maxAbsL = 0;
    let maxAbsR = 0;
    for (let block = 0; block < 16; ++block) {
      exports.axionik_process(handle, outLPtr, outRPtr, 128);
      const heapF32 = new Float32Array(wasmMemory.buffer);
      const lOffset = outLPtr >> 2;
      const rOffset = outRPtr >> 2;
      for (let i = 0; i < 128; ++i) {
        const sL = Math.abs(heapF32[lOffset + i]);
        const sR = Math.abs(heapF32[rOffset + i]);
        if (sL > maxAbsL) maxAbsL = sL;
        if (sR > maxAbsR) maxAbsR = sR;
      }
    }

    expect(maxAbsL).toBeGreaterThan(1e-4);
    expect(maxAbsR).toBeGreaterThan(1e-4);

    // Verify telemetry while note 60 is active
    exports.axionik_get_telemetry(handle, peakLPtr, peakRPtr, activeVoicesPtr, cpuUsagePtr);
    const heap32 = new Int32Array(wasmMemory.buffer);
    const activeVoices = heap32[activeVoicesPtr >> 2];
    expect(activeVoices).toBeGreaterThanOrEqual(1);

    // Test loading synthetic model slot #12 in Resynator 1 (resynatorSlot=0) and rendering a new note
    const modelLoaded = exports.axionik_load_model_slot(handle, 0, 12);
    expect(modelLoaded).toBe(1);
    exports.axionik_note_on(handle, 64, 0.9);
    exports.axionik_process(handle, outLPtr, outRPtr, 128);

    // Test 6 simultaneous notes (> 3 notes) to ensure 12-voice polyphony without voice-stealing or clipping
    // (Note 64 is already active after axionik_load_model_slot reset; add 5 more notes: 60, 67, 71, 72, 76)
    exports.axionik_note_on(handle, 60, 0.9);
    exports.axionik_note_on(handle, 67, 0.9);
    exports.axionik_note_on(handle, 71, 0.9);
    exports.axionik_note_on(handle, 72, 0.9);
    exports.axionik_note_on(handle, 76, 0.9);
    exports.axionik_process(handle, outLPtr, outRPtr, 128);

    exports.axionik_get_telemetry(handle, peakLPtr, peakRPtr, activeVoicesPtr, cpuUsagePtr);
    const polyActiveVoices = new Int32Array(wasmMemory.buffer)[activeVoicesPtr >> 2];
    expect(polyActiveVoices).toBe(6);

    const polyHeapF32 = new Float32Array(wasmMemory.buffer);
    const lOff = outLPtr >> 2;
    for (let i = 0; i < 128; ++i) {
      expect(Number.isFinite(polyHeapF32[lOff + i])).toBe(true);
      expect(Math.abs(polyHeapF32[lOff + i])).toBeLessThanOrEqual(1.0);
    }

    exports.axionik_note_off(handle, 60);
    exports.axionik_note_off(handle, 64);
    exports.axionik_note_off(handle, 67);
    exports.axionik_note_off(handle, 71);
    exports.axionik_note_off(handle, 72);
    exports.axionik_note_off(handle, 76);
    exports.free(outLPtr);
    exports.free(outRPtr);
    exports.free(peakLPtr);
    exports.free(peakRPtr);
    exports.free(activeVoicesPtr);
    exports.free(cpuUsagePtr);
    exports.axionik_destroy(handle);
  });
});

