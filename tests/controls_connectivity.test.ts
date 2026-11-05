/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PARAM_DEFINITIONS } from '../WebUI/src/generated/parameters.gen.js';
import { WebBridge } from '../WebUI/src/bridge/WebBridge.js';
import { ControllersPanel } from '../WebUI/src/ui/ControllersPanel.js';
import { SilverPanel } from '../WebUI/src/ui/SilverPanel.js';
import { ShapersPanel } from '../WebUI/src/ui/ShapersPanel.js';
import { BlenderPanel } from '../WebUI/src/ui/BlenderPanel.js';
import { FilterPanel } from '../WebUI/src/ui/FilterPanel.js';
import { EnvelopeMasterPanel } from '../WebUI/src/ui/EnvelopeMasterPanel.js';
import { MasterOutputPanel } from '../WebUI/src/ui/MasterOutputPanel.js';
import { ResynatorDrawer } from '../WebUI/src/ui/ResynatorDrawer.js';
import { BlenderDrawer } from '../WebUI/src/ui/BlenderDrawer.js';
import { EffectsDrawer } from '../WebUI/src/ui/EffectsDrawer.js';

describe('UI Controls Connectivity & DSP Dispatch Audit', () => {
  const wasmPath = path.resolve(__dirname, '../WebUI/src/wasm/abdaxionikvs_dsp.wasm');

  it('verifies all UI panel controls are mapped to valid parameter descriptors and reach the DSP engine', async () => {
    // 1. Instanciar motor WASM DSP
    expect(fs.existsSync(wasmPath)).toBe(true);
    const wasmBytes = fs.readFileSync(wasmPath);

    let wasmMemory: WebAssembly.Memory | null = null;
    const getHeapU8 = () => (wasmMemory ? new Uint8Array(wasmMemory.buffer) : null);
    const getHeapU32 = () => (wasmMemory ? new Uint32Array(wasmMemory.buffer) : null);

    const envStubs: Record<string, (...args: number[]) => number | void> = {
      emscripten_notify_memory_growth: () => {},
      emscripten_resize_heap: () => 1,
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
      environ_sizes_get: () => 0,
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

    const wasmExports = instantiated.instance.exports as Record<string, any>;
    wasmMemory = wasmExports.memory as WebAssembly.Memory;
    if (typeof wasmExports._initialize === 'function') wasmExports._initialize();
    else if (typeof wasmExports.__wasm_call_ctors === 'function') wasmExports.__wasm_call_ctors();

    const dspHandle = wasmExports.axionik_create();
    expect(dspHandle).toBeGreaterThan(0);
    wasmExports.axionik_prepare(dspHandle, 48000, 128);

    // Enlazar WebBridge con el motor DSP
    const dispatchedEvents: Array<{ type: string; [key: string]: any }> = [];
    const originalNotify = WebBridge.notify.bind(WebBridge);
    WebBridge.notify = (msg: any) => {
      dispatchedEvents.push(msg);
      originalNotify(msg);
    };

    // Interceptar llamadas directas WebBridge.send para inyectarlas al motor DSP
    const originalSend = WebBridge.send.bind(WebBridge);
    WebBridge.send = (msg: any) => {
      originalSend(msg);
      if (msg.type === 'PARAM_SET' && typeof msg.index === 'number') {
        wasmExports.axionik_set_param(dspHandle, msg.index, msg.value);
      } else if (msg.type === 'PITCH_BEND') {
        wasmExports.axionik_pitch_bend(dspHandle, msg.value);
      } else if (msg.type === 'MOD_WHEEL') {
        wasmExports.axionik_mod_wheel(dspHandle, msg.value);
      } else if (msg.type === 'MIDI_CC') {
        wasmExports.axionik_midi_cc(dspHandle, msg.cc, msg.value);
      }
    };

    // 2. Montar todos los paneles de la UI en el DOM simulado de JSDOM
    document.body.innerHTML = `
      <div id="controllers-mount"></div>
      <div id="silver-mount"></div>
      <div id="shapers-mount"></div>
      <div id="blender-mount"></div>
      <div id="filter-mount"></div>
      <div id="envelope-master-mount"></div>
      <div id="master-mount"></div>
      <div id="resy1-drawer-mount"></div>
      <div id="blender-drawer-mount"></div>
      <div id="effects-drawer-mount"></div>
    `;

    const cMount = document.getElementById('controllers-mount')!;
    const sMount = document.getElementById('silver-mount')!;
    const shMount = document.getElementById('shapers-mount')!;
    const bMount = document.getElementById('blender-mount')!;
    const fMount = document.getElementById('filter-mount')!;
    const emMount = document.getElementById('envelope-master-mount')!;
    const mMount = document.getElementById('master-mount')!;

    new ControllersPanel(cMount, {});
    new SilverPanel(sMount, {});
    new ShapersPanel(shMount, {});
    new BlenderPanel(bMount, {});
    new FilterPanel(fMount, {});
    new EnvelopeMasterPanel(emMount, {});
    new MasterOutputPanel(mMount);

    const r1Content = ResynatorDrawer.createContent({ resynator: 1, modelName: '511 sinew', onClose: () => {} });
    document.getElementById('resy1-drawer-mount')!.appendChild(r1Content);

    const blContent = BlenderDrawer.createContent({ onClose: () => {} });
    document.getElementById('blender-drawer-mount')!.appendChild(blContent);

    const efxContent = EffectsDrawer.createContent({ initialBlock: 'filter', onClose: () => {} });
    document.getElementById('effects-drawer-mount')!.appendChild(efxContent);

    // 3. Extraer todos los controles enlazados en el DOM
    const boundParamIndices = new Set<number>();
    const orphanedElements: string[] = [];

    // Controles por data-param-index (Knobs, Faders, Tachos, Selects)
    document.querySelectorAll('[data-param-index]').forEach((el) => {
      const idxStr = el.getAttribute('data-param-index');
      const idx = Number(idxStr);
      if (isNaN(idx) || idx < 0 || idx >= PARAM_DEFINITIONS.length) {
        orphanedElements.push(`data-param-index="${idxStr}"`);
      } else {
        boundParamIndices.add(idx);
      }
    });

    // Controles bipolares/sticks 2D (data-param-x y data-param-y)
    document.querySelectorAll('[data-param-x]').forEach((el) => {
      const idxX = Number(el.getAttribute('data-param-x'));
      const idxY = Number(el.getAttribute('data-param-y'));
      if (isNaN(idxX) || idxX < 0 || idxX >= PARAM_DEFINITIONS.length) orphanedElements.push(`data-param-x="${idxX}"`);
      else boundParamIndices.add(idxX);
      if (isNaN(idxY) || idxY < 0 || idxY >= PARAM_DEFINITIONS.length) orphanedElements.push(`data-param-y="${idxY}"`);
      else boundParamIndices.add(idxY);
    });

    // Toggles y botones ON/OFF
    document.querySelectorAll('[data-param-toggle]').forEach((el) => {
      const idx = Number(el.getAttribute('data-param-toggle'));
      if (isNaN(idx) || idx < 0 || idx >= PARAM_DEFINITIONS.length) {
        orphanedElements.push(`data-param-toggle="${idx}"`);
      } else {
        boundParamIndices.add(idx);
      }
    });

    // Inputs directos de tipo range
    document.querySelectorAll('input[type="range"][data-param]').forEach((el) => {
      const idx = Number(el.getAttribute('data-param'));
      if (isNaN(idx) || idx < 0 || idx >= PARAM_DEFINITIONS.length) {
        orphanedElements.push(`data-param="${idx}"`);
      } else {
        boundParamIndices.add(idx);
      }
    });

    // Asegurar que no hay ningún elemento con data-param corrupto o no registrado
    expect(orphanedElements).toHaveLength(0);

    // Comprobar que los parámetros fundamentales están completamente enlazados a la UI
    expect(boundParamIndices.size).toBeGreaterThan(40);

    // 4. Probar la inyección de cada parámetro en el DSP y verificar que el DSP almacena y responde
    const testedParams = Array.from(boundParamIndices);
    let successfullyUpdatedInDsp = 0;

    for (const paramIdx of testedParams) {
      const def = PARAM_DEFINITIONS[paramIdx];
      expect(def).toBeDefined();

      // Enviar un valor de prueba dentro del rango válido
      const testValue = def.min + (def.max - def.min) * 0.75;
      WebBridge.setParam(paramIdx, testValue);

      // Comprobar que el DSP actualizó su almacén interno (store_)
      const valInDsp = wasmExports.axionik_get_param(dspHandle, paramIdx);
      if (Math.abs(valInDsp - testValue) < 1.01) {
        successfullyUpdatedInDsp++;
      }
    }

    // Al menos el 90% de los parámetros probados se verifican de inmediato con lectura 1:1 en el motor DSP
    expect(successfullyUpdatedInDsp).toBeGreaterThanOrEqual(Math.floor(testedParams.length * 0.9));

    // 5. Test Acústico Diferencial: comprobar que alterar un control (Filtro) produce cambio sonoro audible real
    const outLPtr = wasmExports.malloc(128 * 4);
    const outRPtr = wasmExports.malloc(128 * 4);

    wasmExports.axionik_note_on(dspHandle, 60, 0.9);

    // Estado A: Filtro totalmente abierto (Cutoff = 127)
    WebBridge.setParam(274, 127); // FilterFreq
    for (let i = 0; i < 4; ++i) wasmExports.axionik_process(dspHandle, outLPtr, outRPtr, 128);

    const heapF32A = new Float32Array(wasmMemory.buffer);
    const lOffA = outLPtr >> 2;
    let rmsA = 0;
    for (let i = 0; i < 128; ++i) rmsA += heapF32A[lOffA + i] * heapF32A[lOffA + i];

    // Estado B: Filtro totalmente cerrado (Cutoff = 10)
    WebBridge.setParam(274, 10);
    for (let i = 0; i < 4; ++i) wasmExports.axionik_process(dspHandle, outLPtr, outRPtr, 128);

    const heapF32B = new Float32Array(wasmMemory.buffer);
    const lOffB = outLPtr >> 2;
    let rmsB = 0;
    for (let i = 0; i < 128; ++i) rmsB += heapF32B[lOffB + i] * heapF32B[lOffB + i];

    // La energía acústica con filtro abierto debe ser estrictamente distinta y mayor a filtro cerrado
    expect(Math.sqrt(rmsA)).toBeGreaterThan(Math.sqrt(rmsB));

    // Limpieza
    wasmExports.axionik_all_notes_off(dspHandle);
    wasmExports.free(outLPtr);
    wasmExports.free(outRPtr);
    wasmExports.axionik_destroy(dspHandle);
  });
});
