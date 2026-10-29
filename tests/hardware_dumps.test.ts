// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  HARTMANN_PARAM_COUNT,
  pack8to7,
  unpack7to8,
  computeHartmannChecksum,
  encodeHartmannSysExDump,
  decodeHartmannSysExDump,
  makeStubDump,
} from '../WebUI/src/ui/hardwareDumpsContracts.js';
import { HardwareDumpsDrawer } from '../WebUI/src/ui/HardwareDumpsDrawer.js';
import { DrawerManager } from '../WebUI/src/ui/Drawers.js';
import { WebBridge } from '../WebUI/src/bridge/WebBridge.js';
import { decodeSysExHeader } from '@abdsynths/shared/components';

describe('Hartmann Neuron Hardware SysEx Codec & Drawer', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    WebBridge.clearCache();
  });

  it('packs 8-bit bytes to 7-bit MIDI safe bytes and unpacks bit-for-bit', () => {
    const raw = new Uint8Array(256);
    for (let i = 0; i < 256; ++i) {
      raw[i] = i;
    }

    const packed = pack8to7(raw);
    // Every packed byte must have MSB === 0 (7-bit clean for MIDI SysEx)
    for (let i = 0; i < packed.length; ++i) {
      expect(packed[i] & 0x80).toBe(0);
    }

    const unpacked = unpack7to8(packed);
    expect(unpacked.length).toBe(raw.length);
    expect(Array.from(unpacked)).toEqual(Array.from(raw));
  });

  it('encodes and decodes all 445 signed int16 parameters with valid Hartmann header and checksum', () => {
    const params = new Array<number>(HARTMANN_PARAM_COUNT);
    for (let i = 0; i < HARTMANN_PARAM_COUNT; ++i) {
      // Include negative, zero, and positive signed 16-bit parameter values
      params[i] = ((i * 73) % 400) - 200;
    }

    const dump = encodeHartmannSysExDump('current', params, 0x1a, '042 Cyberneur');
    expect(dump.data[0]).toBe(0xf0);
    expect(dump.data[1]).toBe(0x00);
    expect(dump.data[2]).toBe(0x20);
    expect(dump.data[3]).toBe(0x50);
    expect(dump.data[4]).toBe(0x01);
    expect(dump.data[5]).toBe(0x1a);
    expect(dump.data[dump.data.length - 1]).toBe(0xf7);

    // Verify LiveSysExInspector header decoder recognizes Hartmann GmbH
    const headerMeta = decodeSysExHeader(dump.data);
    expect(headerMeta.valid).toBe(true);
    expect(headerMeta.manufacturer).toBe('Hartmann GmbH (0x00 0x20 0x50)');
    expect(headerMeta.model).toBe('Neuron / NeuronVS');
    expect(headerMeta.deviceId).toBe('0x1A');
    expect(headerMeta.hasEox).toBe(true);

    // Decode dump and verify all 445 parameters
    const decoded = decodeHartmannSysExDump(dump.data);
    expect(decoded.valid).toBe(true);
    expect(decoded.checksumValid).toBe(true);
    expect(decoded.mode).toBe('current');
    expect(decoded.deviceId).toBe(0x1a);
    expect(decoded.presetName).toBe('042 Cyberneur');
    expect(decoded.params).not.toBeNull();
    expect(decoded.params!.length).toBe(HARTMANN_PARAM_COUNT);
    expect(decoded.params).toEqual(params);
  });

  it('mounts HardwareDumpsDrawer with embedded LiveSysExInspector and imports .syx dumps', () => {
    const app = document.getElementById('app')!;
    const drawerManager = new DrawerManager(app);
    let appliedPreset = '';
    let appliedParams: number[] = [];

    const hwDrawer = new HardwareDumpsDrawer(
      app,
      {
        getPresetName: () => '007 NervePad',
        onApplyDecodedParams: (p, name) => {
          appliedParams = p;
          appliedPreset = name;
        },
      },
      drawerManager,
    );

    hwDrawer.open();
    expect(hwDrawer.isOpen()).toBe(true);
    expect(app.querySelector('.sysex-inspector')).not.toBeNull();

    // Mutate a parameter and verify live inspector updates
    WebBridge.setParam(24, 5);
    hwDrawer.onParamUpdated();

    // Test importing a SysEx dump and applying its 445 parameters
    const customParams = new Array<number>(HARTMANN_PARAM_COUNT).fill(0);
    customParams[0] = 64;
    customParams[24] = 3;
    customParams[272] = 110;
    const sampleSyx = makeStubDump('current', customParams, 0x05, '099 ImportedPatch');

    hwDrawer.handleImportedSyxBytes(sampleSyx.data, 'test.syx');
    expect(appliedPreset).toBe('099 ImportedPatch');
    expect(appliedParams.length).toBe(HARTMANN_PARAM_COUNT);
    expect(WebBridge.getParam(0)).toBe(64);
    expect(WebBridge.getParam(24)).toBe(3);
    expect(WebBridge.getParam(272)).toBe(110);

    hwDrawer.close();
    expect(hwDrawer.isOpen()).toBe(false);
  });
});
