/**
 * ABDAxionikVS — Hardware SysEx Dumps contracts & Hartmann Neuron SysEx Codec
 * Interfaz JS del puente y codificador/decodificador 7-bit para los dumps documentados
 * del hardware Hartmann Neuron (Manufacturer ID: 0x00 0x20 0x50, Model ID: 0x01):
 *   - Current Sound (0x10)
 *   - All Sounds (0x20)
 *   - All SetUps (0x30)
 *   - All Models (0x40)
 *
 * Documentado en DOCS/reverse_engineering/SYSEX.md; el borrador original
 * (ABDShared/Docs/hw-sysex-contract.md) quedó archivado en _Deprecados/Docs/.
 */

/** Modos de dump documentados desde el manual del synth */
export type HardwareDumpMode =
  | 'current'
  | 'allSounds'
  | 'allSetUps'
  | 'allModels';

/** Dirección del flujo SysEx */
export type HardwareXferDirection = 'tx' | 'rx';

export interface HardwareDumpMeta {
  /** Modo del dump */
  mode: HardwareDumpMode;
  /** Nombre legible del modo */
  label: string;
  /** Dirección: TX = enviar al synth, RX = recibir del synth */
  direction: HardwareXferDirection;
  /** Tamaño estimado del dump (bytes), a título informativo */
  estimatedBytes: number | null;
}

export interface HardwareDumpPayload {
  /** ID único del dump en esta sesión */
  id: string;
  /** Modo del dump */
  mode: HardwareDumpMode;
  /** Payload SysEx como uint8 */
  data: Uint8Array;
  /** Breve descripción del contenido (parse de encabezados del dump cuando esté disponible) */
  summary: string | null;
}

export interface HardwareXferState {
  /** Si hay una transferencia activa */
  active: boolean;
  /** Dirección actual de la transferencia */
  direction: HardwareXferDirection | null;
  /** Modo del dump */
  mode: HardwareDumpMode | null;
  /** Bytes enviados o recibidos */
  transferred: number;
  /** Bytes totales estimados o conocidos */
  total: number | null;
  /** Porcentaje entero 0..100 */
  percent: number;
}

export interface HardwarePortStatus {
  /** Hay un puerto MIDI detectable/accesible */
  connected: boolean;
  /** Nombre del puerto detectado (o null) */
  name: string | null;
  /** Device ID detectado/predeterminado 0..127 */
  deviceId: number;
}

/** Mensajes que JS pide al host (JS -> nativo) */
export type HardwareHostRequest =
  | {
      type: 'HARDWARE_TX_DUMP_REQUEST';
      /** Dump que queremos solicitar o transmitir */
      dump: HardwareDumpPayload;
      /** Opcional: sobreescribir device id de destino */
      deviceId?: number;
    }
  | {
      type: 'HARDWARE_RX_DUMP_SEND_REQUEST';
      /** Dump que JS quiere enviar al synth */
      dump: HardwareDumpPayload;
      /** Opcional: sobreescribir device id de destino */
      deviceId?: number;
    }
  | { type: 'HARDWARE_DUMP_DISCARD'; dumpId: string }
  | { type: 'HARDWARE_FLUSH_ACTIVE_XFERS' }
  | { type: 'HARDWARE_SET_DEVICE_ID'; deviceId: number }
  | { type: 'HARDWARE_GET_PORT_STATUS' };

/** Mensajes que el host envía a JS (nativo -> JS) */
export type HardwareHostEvent =
  | { type: 'HARDWARE_PORT_STATUS'; status: HardwarePortStatus }
  | { type: 'HARDWARE_SYSEX_TX'; dumpId: string; data: Uint8Array }
  | { type: 'HARDWARE_SYSEX_RX'; data: Uint8Array }
  | {
      type: 'HARDWARE_SYSEX_TX_START';
      dumpId: string;
      mode: HardwareDumpMode;
      totalBytes: number;
    }
  | {
      type: 'HARDWARE_SYSEX_TX_PROGRESS';
      dumpId: string;
      mode: HardwareDumpMode;
      transferred: number;
      total: number;
    }
  | {
      type: 'HARDWARE_SYSEX_RX_START';
      mode: HardwareDumpMode;
      totalBytes: number;
    }
  | {
      type: 'HARDWARE_SYSEX_RX_PROGRESS';
      mode: HardwareDumpMode;
      transferred: number;
      total: number;
    }
  | {
      type: 'HARDWARE_SYSEX_RX_COMPLETE';
      mode: HardwareDumpMode;
      totalBytes: number;
      payload: HardwareDumpPayload;
    };

export interface HardwareDumpsContracts {
  /** Mensaje recibido del host */
  onMessage(event: HardwareHostEvent): void;
  /** Pedir al host algo */
  send(request: HardwareHostRequest): void;
}

/** Constantes canónicas MMA / Hartmann GmbH */
export const HARTMANN_MANUFACTURER_ID = [0x00, 0x20, 0x50] as const;
export const HARTMANN_MODEL_NEURON = 0x01;
export const HARTMANN_PARAM_COUNT = 445;

export const HARTMANN_DUMP_OPCODES: Record<HardwareDumpMode, number> = {
  current: 0x10,
  allSounds: 0x20,
  allSetUps: 0x30,
  allModels: 0x40,
};

export const HARDWARE_DUMP_META: HardwareDumpMeta[] = [
  {
    mode: 'current',
    label: 'Current Sound',
    direction: 'rx',
    estimatedBytes: 1066,
  },
  {
    mode: 'current',
    label: 'Current Sound',
    direction: 'tx',
    estimatedBytes: 1066,
  },
  {
    mode: 'allSounds',
    label: 'All Sounds',
    direction: 'rx',
    estimatedBytes: 213200,
  },
  {
    mode: 'allSounds',
    label: 'All Sounds',
    direction: 'tx',
    estimatedBytes: 213200,
  },
  {
    mode: 'allSetUps',
    label: 'All SetUps',
    direction: 'rx',
    estimatedBytes: 16384,
  },
  {
    mode: 'allSetUps',
    label: 'All SetUps',
    direction: 'tx',
    estimatedBytes: 16384,
  },
  {
    mode: 'allModels',
    label: 'All Models',
    direction: 'rx',
    estimatedBytes: 32768,
  },
  {
    mode: 'allModels',
    label: 'All Models',
    direction: 'tx',
    estimatedBytes: 32768,
  },
];

export function hardwareDumpMetaForModeAndDir(
  mode: HardwareDumpMode,
  direction: HardwareXferDirection,
): HardwareDumpMeta {
  return HARDWARE_DUMP_META.find(
    (m) => m.mode === mode && m.direction === direction,
  )!;
}

/**
 * Empaqueta bloques de 7 bytes de 8 bits en 8 bytes de 7 bits (MSB-first index byte).
 * Paridad bit a bit con abd::hw::SysExCodec::pack8to7 en C++.
 */
export function pack8to7(raw: Uint8Array): Uint8Array {
  const len = raw.length;
  const numGroups = Math.floor((len + 6) / 7);
  const out = new Uint8Array(len + numGroups);
  let outIdx = 0;

  for (let i = 0; i < len; i += 7) {
    let msbs = 0;
    const chunk = Math.min(7, len - i);
    for (let j = 0; j < chunk; ++j) {
      if ((raw[i + j] & 0x80) !== 0) {
        msbs |= 1 << j;
      }
    }
    out[outIdx++] = msbs & 0x7f;
    for (let j = 0; j < chunk; ++j) {
      out[outIdx++] = raw[i + j] & 0x7f;
    }
  }
  return out;
}

/**
 * Desempaqueta bloques de 8 bytes de 7 bits en 7 bytes de 8 bits.
 * Paridad bit a bit con abd::hw::SysExCodec::unpack7to8 en C++.
 */
export function unpack7to8(packed: Uint8Array): Uint8Array {
  const len = packed.length;
  const temp: number[] = [];

  for (let i = 0; i < len; i += 8) {
    const msbs = packed[i] & 0x7f;
    const chunk = Math.min(7, len - i - 1);
    for (let j = 0; j < chunk; ++j) {
      const b = (packed[i + 1 + j] & 0x7f) | (((msbs >> j) & 1) ? 0x80 : 0);
      temp.push(b);
    }
  }
  return new Uint8Array(temp);
}

/**
 * Calcula el checksum de 7 bits en complemento a dos (estándar MIDI SysEx):
 * (128 - (sum & 0x7F)) & 0x7F
 */
export function computeHartmannChecksum(payload7Bit: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < payload7Bit.length; ++i) {
    sum = (sum + (payload7Bit[i] & 0x7f)) & 0x7f;
  }
  return (128 - sum) & 0x7f;
}

/**
 * Codifica un dump SysEx canónico de Hartmann Neuron:
 * F0 00 20 50 01 [deviceId] [opcode] [subId] [packedPayload...] [checksum] F7
 */
export function encodeHartmannSysExDump(
  mode: HardwareDumpMode,
  params?: number[],
  deviceId: number = 0x00,
  presetName: string = '000 InitSound',
): HardwareDumpPayload {
  const safeDeviceId = Math.max(0, Math.min(127, Math.round(deviceId))) & 0x7f;
  const opcode = HARTMANN_DUMP_OPCODES[mode] ?? 0x10;
  const subId = 0x00;

  // Construir payload crudo de 8 bits (32 bytes nombre ASCII + 445 * int16 LE = 922 bytes)
  const rawLen = 32 + HARTMANN_PARAM_COUNT * 2;
  const raw = new Uint8Array(rawLen);

  const cleanName = (presetName || '000 InitSound').slice(0, 31);
  for (let i = 0; i < cleanName.length; ++i) {
    raw[i] = cleanName.charCodeAt(i) & 0x7f;
  }

  for (let i = 0; i < HARTMANN_PARAM_COUNT; ++i) {
    const val = params && i < params.length && Number.isFinite(params[i])
      ? Math.max(-32768, Math.min(32767, Math.round(params[i])))
      : 0;
    const u16 = val & 0xffff;
    raw[32 + i * 2] = u16 & 0xff;
    raw[32 + i * 2 + 1] = (u16 >> 8) & 0xff;
  }

  const packed = pack8to7(raw);
  const checksum = computeHartmannChecksum(packed);

  const frame = new Uint8Array(8 + packed.length + 2);
  frame[0] = 0xf0;
  frame[1] = HARTMANN_MANUFACTURER_ID[0];
  frame[2] = HARTMANN_MANUFACTURER_ID[1];
  frame[3] = HARTMANN_MANUFACTURER_ID[2];
  frame[4] = HARTMANN_MODEL_NEURON;
  frame[5] = safeDeviceId;
  frame[6] = opcode;
  frame[7] = subId;
  frame.set(packed, 8);
  frame[8 + packed.length] = checksum;
  frame[8 + packed.length + 1] = 0xf7;

  const meta = hardwareDumpMetaForModeAndDir(mode, 'tx');
  return {
    id: `${mode}-${Date.now()}`,
    mode,
    data: frame,
    summary: `Hartmann Neuron ${meta.label} (${cleanName}) — ${frame.length} B [Dev 0x${safeDeviceId.toString(16).toUpperCase().padStart(2, '0')}]`,
  };
}

export interface DecodedHartmannSysExDump {
  valid: boolean;
  mode: HardwareDumpMode | null;
  deviceId: number;
  presetName: string;
  params: number[] | null;
  checksumValid: boolean;
  summary: string;
}

/**
 * Decodifica y valida una trama SysEx de Hartmann Neuron.
 */
export function decodeHartmannSysExDump(data: Uint8Array): DecodedHartmannSysExDump {
  if (
    !data ||
    data.length < 10 ||
    data[0] !== 0xf0 ||
    data[data.length - 1] !== 0xf7 ||
    data[1] !== HARTMANN_MANUFACTURER_ID[0] ||
    data[2] !== HARTMANN_MANUFACTURER_ID[1] ||
    data[3] !== HARTMANN_MANUFACTURER_ID[2] ||
    data[4] !== HARTMANN_MODEL_NEURON
  ) {
    return {
      valid: false,
      mode: null,
      deviceId: 0,
      presetName: '',
      params: null,
      checksumValid: false,
      summary: 'Trama SysEx no perteneciente a Hartmann Neuron (00 20 50 01)',
    };
  }

  const deviceId = data[5] & 0x7f;
  const opcode = data[6] & 0x7f;
  let mode: HardwareDumpMode = 'current';
  if (opcode === HARTMANN_DUMP_OPCODES.allSounds) mode = 'allSounds';
  else if (opcode === HARTMANN_DUMP_OPCODES.allSetUps) mode = 'allSetUps';
  else if (opcode === HARTMANN_DUMP_OPCODES.allModels) mode = 'allModels';

  const packedPayload = data.subarray(8, data.length - 2);
  const expectedChecksum = computeHartmannChecksum(packedPayload);
  const actualChecksum = data[data.length - 2] & 0x7f;
  const checksumValid = expectedChecksum === actualChecksum;

  const raw = unpack7to8(packedPayload);
  let presetName = 'InitSound';
  let params: number[] | null = null;

  if (raw.length >= 32 + HARTMANN_PARAM_COUNT * 2) {
    let chars = '';
    for (let i = 0; i < 32; ++i) {
      const c = raw[i];
      if (c === 0) break;
      if (c >= 32 && c <= 126) chars += String.fromCharCode(c);
    }
    if (chars.trim().length > 0) {
      presetName = chars.trim();
    }

    params = new Array<number>(HARTMANN_PARAM_COUNT);
    for (let i = 0; i < HARTMANN_PARAM_COUNT; ++i) {
      const lo = raw[32 + i * 2];
      const hi = raw[32 + i * 2 + 1];
      let val = (hi << 8) | lo;
      if (val >= 0x8000) val -= 0x10000;
      params[i] = val;
    }
  }

  const meta = hardwareDumpMetaForModeAndDir(mode, 'rx');
  return {
    valid: true,
    mode,
    deviceId,
    presetName,
    params,
    checksumValid,
    summary: `Hartmann Neuron ${meta.label} (${presetName}) — ${data.length} B [Checksum ${checksumValid ? 'OK' : 'WARN'}]`,
  };
}

/** Genera un dump Hartmann Neuron válido (con los valores pasados o a cero) */
export function makeStubDump(
  mode: HardwareDumpMode,
  params?: number[],
  deviceId: number = 0,
  presetName: string = '000 InitSound',
): HardwareDumpPayload {
  return encodeHartmannSysExDump(mode, params, deviceId, presetName);
}
