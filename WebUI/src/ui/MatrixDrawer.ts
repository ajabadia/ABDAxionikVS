/**
 * ABDAxionikVS — MatrixDrawer.ts
 * Dedicated slide-out drawer (50vw) for:
 * 1. The 4 <NUKE> Hardware Macro Knobs ([425..428]) with live rotary Knobs + target dropdowns (0..62)
 * 2. The 6 Real-Time Performance Controllers ([413..424]: <NUKE> & Panel Control 1..3) with bipolar Depth Knobs + target dropdowns (0..62)
 * 3. The 6 × 4 Free Controllers Matrix ([363..410])
 */

import { ICONS } from './icons.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { PARAM_DEFINITIONS } from '../generated/parameters.gen.js';
import { Knob } from '@abdsynths/shared/components';
import { pillSelectorHtml, bindPillSelector } from '@abdsynths/shared/components/pillSelector.js';
import { gestureFor } from './paramGesture.js';

export const MOD_SOURCES = [
  { id: 1, shortName: 'AFTERTOUCH', subLabel: 'Channel Pressure', name: 'Aftertouch (Channel Pressure)', destParam: 413, depthParam: 414, defaultDest: 61, defaultDepth: 40 },
  { id: 2, shortName: 'MODULATION', subLabel: 'Control 1 · CC 01', name: 'Control 1 · Modulation Wheel (MIDI CC 1)', destParam: 415, depthParam: 416, defaultDest: 59, defaultDepth: 55 },
  { id: 3, shortName: 'BREATH', subLabel: 'Control 2 · CC 02', name: 'Control 2 · Breath Controller (MIDI CC 2)', destParam: 417, depthParam: 418, defaultDest: 56, defaultDepth: 0 },
  { id: 4, shortName: 'CC 03', subLabel: 'Control 3 · CC 03', name: 'Control 3 · Continuous Controller 03 (MIDI CC 3)', destParam: 419, depthParam: 420, defaultDest: 57, defaultDepth: 0 },
  { id: 5, shortName: 'FOOT', subLabel: 'Foot Pedal · CC 04', name: 'Foot Pedal (MIDI CC 4)', destParam: 421, depthParam: 422, defaultDest: 14, defaultDepth: 0 },
  { id: 6, shortName: 'EXPRESSION', subLabel: 'Expression · CC 11', name: 'Expression Pedal (MIDI CC 11)', destParam: 423, depthParam: 424, defaultDest: 0, defaultDepth: 63 },
];

export const ALL_63_MOD_DESTINATIONS = [
  { id: 0, label: '0: R1 Volume [27]' },
  { id: 1, label: '1: R1 Semitones [34]' },
  { id: 2, label: '2: R1 L1 Scape X [52]' },
  { id: 3, label: '3: R1 L1 Scape Y [53]' },
  { id: 4, label: '4: R1 L1 Sphere X [42]' },
  { id: 5, label: '5: R1 L1 Sphere Y [43]' },
  { id: 6, label: '6: R1 L2 Scape X [72]' },
  { id: 7, label: '7: R1 L2 Scape Y [73]' },
  { id: 8, label: '8: R1 L2 Sphere X [62]' },
  { id: 9, label: '9: R1 L2 Sphere Y [63]' },
  { id: 10, label: '10: R1 L3 Scape X [92]' },
  { id: 11, label: '11: R1 L3 Scape Y [93]' },
  { id: 12, label: '12: R1 L3 Sphere X [82]' },
  { id: 13, label: '13: R1 L3 Sphere Y [83]' },
  { id: 14, label: '14: R2 Volume [107]' },
  { id: 15, label: '15: R2 Semitones [114]' },
  { id: 16, label: '16: R2 L1 Scape X [132]' },
  { id: 17, label: '17: R2 L1 Scape Y [133]' },
  { id: 18, label: '18: R2 L1 Sphere X [122]' },
  { id: 19, label: '19: R2 L1 Sphere Y [123]' },
  { id: 20, label: '20: R2 L2 Scape X [152]' },
  { id: 21, label: '21: R2 L2 Scape Y [153]' },
  { id: 22, label: '22: R2 L2 Sphere X [142]' },
  { id: 23, label: '23: R2 L2 Sphere Y [143]' },
  { id: 24, label: '24: R2 L3 Scape X [172]' },
  { id: 25, label: '25: R2 L3 Scape Y [173]' },
  { id: 26, label: '26: R2 L3 Sphere X [162]' },
  { id: 27, label: '27: R2 L3 Sphere Y [163]' },
  { id: 28, label: '28: R1 ResEnv Attack [182]' },
  { id: 29, label: '29: R1 ResEnv Decay [183]' },
  { id: 30, label: '30: R1 ResEnv Sustain [184]' },
  { id: 31, label: '31: R1 ResEnv Release [185]' },
  { id: 32, label: '32: R1 AmpEnv Attack [200]' },
  { id: 33, label: '33: R1 AmpEnv Decay [201]' },
  { id: 34, label: '34: R1 AmpEnv Sustain [202]' },
  { id: 35, label: '35: R1 AmpEnv Release [203]' },
  { id: 36, label: '36: R1 FreeEnv Attack [205]' },
  { id: 37, label: '37: R1 FreeEnv Decay [206]' },
  { id: 38, label: '38: R1 FreeEnv Sustain [207]' },
  { id: 39, label: '39: R1 FreeEnv Release [208]' },
  { id: 40, label: '40: R2 ResEnv Attack [212]' },
  { id: 41, label: '41: R2 ResEnv Decay [213]' },
  { id: 42, label: '42: R2 ResEnv Sustain [214]' },
  { id: 43, label: '43: R2 ResEnv Release [215]' },
  { id: 44, label: '44: R2 AmpEnv Attack [230]' },
  { id: 45, label: '45: R2 AmpEnv Decay [231]' },
  { id: 46, label: '46: R2 AmpEnv Sustain [232]' },
  { id: 47, label: '47: R2 AmpEnv Release [233]' },
  { id: 48, label: '48: R2 FreeEnv Attack [235]' },
  { id: 49, label: '49: R2 FreeEnv Decay [236]' },
  { id: 50, label: '50: R2 FreeEnv Sustain [237]' },
  { id: 51, label: '51: R2 FreeEnv Release [238]' },
  { id: 52, label: '52: FilterEnv Attack [355]' },
  { id: 53, label: '53: FilterEnv Decay [356]' },
  { id: 54, label: '54: FilterEnv Sustain [357]' },
  { id: 55, label: '55: FilterEnv Release [358]' },
  { id: 56, label: '56: Blender Amount [262]' },
  { id: 57, label: '57: Slicer Depth [268]' },
  { id: 58, label: '58: Slicer Rate [269]' },
  { id: 59, label: '59: LFO Depth [257]' },
  { id: 60, label: '60: LFO Rate [258]' },
  { id: 61, label: '61: Filter Cutoff [274]' },
  { id: 62, label: '62: Filter Resonance [275]' },
];

export const ALL_131_FREE_DESTINATIONS = [
  { id: 3000, label: '00: Off / None', paramIdx: null },
  { id: 3001, label: '01: Sound Pan [3]', paramIdx: 3 },
  { id: 3002, label: '02: LFO Depth [257]', paramIdx: 257 },
  { id: 3003, label: '03: LFO Rate [258]', paramIdx: 258 },
  { id: 3004, label: '04: LFO Delay [259]', paramIdx: 259 },
  { id: 3005, label: '05: R1 Volume [27]', paramIdx: 27 },
  { id: 3006, label: '06: R1 L1 Scape 1/3 [52]', paramIdx: 52 },
  { id: 3007, label: '07: R1 L1 Scape 2/4 [53]', paramIdx: 53 },
  { id: 3008, label: '08: R1 L1 Sphere 1/3 [42]', paramIdx: 42 },
  { id: 3009, label: '09: R1 L1 Sphere 2/4 [43]', paramIdx: 43 },
  { id: 3010, label: '10: R1 L2 Scape 1/3 [72]', paramIdx: 72 },
  { id: 3011, label: '11: R1 L2 Scape 2/4 [73]', paramIdx: 73 },
  { id: 3012, label: '12: R1 L2 Sphere 1/3 [62]', paramIdx: 62 },
  { id: 3013, label: '13: R1 L2 Sphere 2/4 [63]', paramIdx: 63 },
  { id: 3014, label: '14: R1 L3 Scape 1/3 [92]', paramIdx: 92 },
  { id: 3015, label: '15: R1 L3 Scape 2/4 [93]', paramIdx: 93 },
  { id: 3016, label: '16: R1 L3 Sphere 1/3 [82]', paramIdx: 82 },
  { id: 3017, label: '17: R1 L3 Sphere 2/4 [83]', paramIdx: 83 },
  { id: 3018, label: '18: R2 Volume [107]', paramIdx: 107 },
  { id: 3019, label: '19: R2 L1 Scape 1/3 [132]', paramIdx: 132 },
  { id: 3020, label: '20: R2 L1 Scape 2/4 [133]', paramIdx: 133 },
  { id: 3021, label: '21: R2 L1 Sphere 1/3 [122]', paramIdx: 122 },
  { id: 3022, label: '22: R2 L1 Sphere 2/4 [123]', paramIdx: 123 },
  { id: 3023, label: '23: R2 L2 Scape 1/3 [152]', paramIdx: 152 },
  { id: 3024, label: '24: R2 L2 Scape 2/4 [153]', paramIdx: 153 },
  { id: 3025, label: '25: R2 L2 Sphere 1/3 [142]', paramIdx: 142 },
  { id: 3026, label: '26: R2 L2 Sphere 2/4 [143]', paramIdx: 143 },
  { id: 3027, label: '27: R2 L3 Scape 1/3 [172]', paramIdx: 172 },
  { id: 3028, label: '28: R2 L3 Scape 2/4 [173]', paramIdx: 173 },
  { id: 3029, label: '29: R2 L3 Sphere 1/3 [162]', paramIdx: 162 },
  { id: 3030, label: '30: R2 L3 Sphere 2/4 [163]', paramIdx: 163 },
  { id: 3031, label: '31: Blender Amount [262]', paramIdx: 262 },
  { id: 3032, label: '32: Slicer Depth [268]', paramIdx: 268 },
  { id: 3033, label: '33: Slicer Rate [269]', paramIdx: 269 },
  { id: 3034, label: '34: Filter Cutoff [274]', paramIdx: 274 },
  { id: 3035, label: '35: Filter Resonance [275]', paramIdx: 275 },
  { id: 3036, label: '36: EQ LowShelf Gain [287]', paramIdx: 287 },
  { id: 3037, label: '37: EQ LowShelf Freq [288]', paramIdx: 288 },
  { id: 3038, label: '38: EQ LowShelf Slope [289]', paramIdx: 289 },
  { id: 3039, label: '39: EQ B1 Gain [291]', paramIdx: 291 },
  { id: 3040, label: '40: EQ B1 Freq [292]', paramIdx: 292 },
  { id: 3041, label: '41: EQ B1 Q [293]', paramIdx: 293 },
  { id: 3042, label: '42: EQ B2 Gain [295]', paramIdx: 295 },
  { id: 3043, label: '43: EQ B2 Freq [296]', paramIdx: 296 },
  { id: 3044, label: '44: EQ B2 Q [297]', paramIdx: 297 },
  { id: 3045, label: '45: EQ HighShelf Gain [299]', paramIdx: 299 },
  { id: 3046, label: '46: EQ HighShelf Freq [300]', paramIdx: 300 },
  { id: 3047, label: '47: EQ HighShelf Slope [301]', paramIdx: 301 },
  { id: 3048, label: '48: Comp Threshold [303]', paramIdx: 303 },
  { id: 3049, label: '49: Comp Out Gain [304]', paramIdx: 304 },
  { id: 3050, label: '50: Comp Responsiveness [305]', paramIdx: 305 },
  { id: 3051, label: '51: Dist In Drive [306]', paramIdx: 306 },
  { id: 3052, label: '52: Dist Prefilter [307]', paramIdx: 307 },
  { id: 3053, label: '53: Dist Out Vol [309]', paramIdx: 309 },
  { id: 3054, label: '54: RingMod Mix [310]', paramIdx: 310 },
  { id: 3055, label: '55: RingMod Speed [311]', paramIdx: 311 },
  { id: 3056, label: '56: RingMod Depth [312]', paramIdx: 312 },
  { id: 3057, label: '57: RingMod ModFreq [314]', paramIdx: 314 },
  { id: 3058, label: '58: RgMd XoverDelay [315]', paramIdx: 315 },
  { id: 3059, label: '59: RgMd XoverTime [316]', paramIdx: 316 },
  { id: 3060, label: '60: RgMd XDlFeedback [317]', paramIdx: 317 },
  { id: 3061, label: '61: Decim Mix [324]', paramIdx: 324 },
  { id: 3062, label: '62: Decim SH Factor [325]', paramIdx: 325 },
  { id: 3063, label: '63: Decim PreFltCutoff [326]', paramIdx: 326 },
  { id: 3064, label: '64: SpWarp Mix [318]', paramIdx: 318 },
  { id: 3065, label: '65: SpWarp Frequency [319]', paramIdx: 319 },
  { id: 3066, label: '66: SpWarp Tilt [320]', paramIdx: 320 },
  { id: 3067, label: '67: SpWarp Damping [321]', paramIdx: 321 },
  { id: 3068, label: '68: SpWarp Speed [322]', paramIdx: 322 },
  { id: 3069, label: '69: SpWarp Depth [323]', paramIdx: 323 },
  { id: 3070, label: '70: StereoSp ChanDly [331]', paramIdx: 331 },
  { id: 3071, label: '71: StereoSp Feedbk [332]', paramIdx: 332 },
  { id: 3072, label: '72: LR Delay Mix [333]', paramIdx: 333 },
  { id: 3073, label: '73: LR Delay Time [334]', paramIdx: 334 },
  { id: 3074, label: '74: LR Dly Feedback [335]', paramIdx: 335 },
  { id: 3075, label: '75: Flanger Mix [336]', paramIdx: 336 },
  { id: 3076, label: '76: Flanger Depth [337]', paramIdx: 337 },
  { id: 3077, label: '77: Flanger Speed [338]', paramIdx: 338 },
  { id: 3078, label: '78: Flanger Feedback [340]', paramIdx: 340 },
  { id: 3079, label: '79: Flanger StereoPh [341]', paramIdx: 341 },
  { id: 3080, label: '80: Phaser Mix [342]', paramIdx: 342 },
  { id: 3081, label: '81: Phaser Depth [343]', paramIdx: 343 },
  { id: 3082, label: '82: Phaser Speed [344]', paramIdx: 344 },
  { id: 3083, label: '83: Phaser Feedback [346]', paramIdx: 346 },
  { id: 3084, label: '84: Phaser StereoPh [347]', paramIdx: 347 },
  { id: 3085, label: '85: Chorus Mix [348]', paramIdx: 348 },
  { id: 3086, label: '86: Chorus Depth [349]', paramIdx: 349 },
  { id: 3087, label: '87: Chorus Speed [350]', paramIdx: 350 },
  { id: 3088, label: '88: Chorus Feedback [352]', paramIdx: 352 },
  { id: 3089, label: '89: Chorus StereoPh [353]', paramIdx: 353 },
  { id: 3090, label: '90: Chorus PreDelay [354]', paramIdx: 354 },
  { id: 3091, label: '91: S1 Resy Env Att [182]', paramIdx: 182 },
  { id: 3092, label: '92: S1 Resy Env Dec [183]', paramIdx: 183 },
  { id: 3093, label: '93: S1 Resy Env Sust [184]', paramIdx: 184 },
  { id: 3094, label: '94: S1 Resy Env Rel [185]', paramIdx: 185 },
  { id: 3095, label: '95: S1 Amp Env Att [200]', paramIdx: 200 },
  { id: 3096, label: '96: S1 Amp Env Dec [201]', paramIdx: 201 },
  { id: 3097, label: '97: S1 Amp Env Sust [202]', paramIdx: 202 },
  { id: 3098, label: '98: S1 Amp Env Rel [203]', paramIdx: 203 },
  { id: 3099, label: '99: S1 Free Env Att [205]', paramIdx: 205 },
  { id: 3100, label: '100: S1 Free Env Dec [206]', paramIdx: 206 },
  { id: 3101, label: '101: S1 Free Env Sust [207]', paramIdx: 207 },
  { id: 3102, label: '102: S1 Free Env Rel [208]', paramIdx: 208 },
  { id: 3103, label: '103: S1 Free Env Depth [210]', paramIdx: 210 },
  { id: 3104, label: '104: S2 Resy Env Att [212]', paramIdx: 212 },
  { id: 3105, label: '105: S2 Resy Env Dec [213]', paramIdx: 213 },
  { id: 3106, label: '106: S2 Resy Env Sust [214]', paramIdx: 214 },
  { id: 3107, label: '107: S2 Resy Env Rel [215]', paramIdx: 215 },
  { id: 3108, label: '108: S2 Amp Env Att [230]', paramIdx: 230 },
  { id: 3109, label: '109: S2 Amp Env Dec [231]', paramIdx: 231 },
  { id: 3110, label: '110: S2 Amp Env Sust [232]', paramIdx: 232 },
  { id: 3111, label: '111: S2 Amp Env Rel [233]', paramIdx: 233 },
  { id: 3112, label: '112: S2 Free Env Att [235]', paramIdx: 235 },
  { id: 3113, label: '113: S2 Free Env Dec [236]', paramIdx: 236 },
  { id: 3114, label: '114: S2 Free Env Sust [237]', paramIdx: 237 },
  { id: 3115, label: '115: S2 Free Env Rel [238]', paramIdx: 238 },
  { id: 3116, label: '116: S2 Free Env Depth [240]', paramIdx: 240 },
  { id: 3117, label: '117: Free Env Level 1 [242]', paramIdx: 242 },
  { id: 3118, label: '118: Free Env Time 1 [243]', paramIdx: 243 },
  { id: 3119, label: '119: Free Env Level 2 [244]', paramIdx: 244 },
  { id: 3120, label: '120: Free Env Time 2 [245]', paramIdx: 245 },
  { id: 3121, label: '121: Free Env Level 3 [246]', paramIdx: 246 },
  { id: 3122, label: '122: Free Env Time 3 [247]', paramIdx: 247 },
  { id: 3123, label: '123: Free Env Level 4 [248]', paramIdx: 248 },
  { id: 3124, label: '124: Free Env Time 4 [249]', paramIdx: 249 },
  { id: 3125, label: '125: LevelTime Env Depth [251]', paramIdx: 251 },
  { id: 3126, label: '126: Filter Env Att [355]', paramIdx: 355 },
  { id: 3127, label: '127: Filter Env Dec [356]', paramIdx: 356 },
  { id: 3128, label: '128: Filter Env Sust [357]', paramIdx: 357 },
  { id: 3129, label: '129: Filter Env Rel [358]', paramIdx: 358 },
  { id: 3130, label: '130: Filter Env Depth [360]', paramIdx: 360 },
];

export function getModDestinationLabel(destId: number): string {
  if (destId === 3000 || destId === undefined || destId === null) return 'Off';
  if (destId >= 3001 && destId <= 3130) {
    const foundFree = ALL_131_FREE_DESTINATIONS.find((d) => d.id === destId);
    if (foundFree) {
      return foundFree.label.replace(/^\d+:\s*/, '').replace(/\s*\[\d+\]$/, '');
    }
  }
  const normId = destId >= 3001 ? destId - 3001 : destId;
  const found = ALL_63_MOD_DESTINATIONS.find((d) => d.id === normId);
  if (!found) return 'Off';
  return found.label.replace(/^\d+:\s*/, '').replace(/\s*\[\d+\]$/, '');
}


/**
 * Extracts the authoritative snddat parameter index [0..444] from a 0..62 modulation destination ID.
 */
export function resolveParamIndexFromModDest(destId: number): number {
  const safeDest = Math.max(0, Math.min(62, Math.round(destId)));
  const entry = ALL_63_MOD_DESTINATIONS.find((d) => d.id === safeDest);
  if (entry) {
    const m = entry.label.match(/\[(\d+)\]$/);
    if (m) {
      return parseInt(m[1], 10);
    }
  }
  const fromDef = PARAM_DEFINITIONS.find((d) => d.modDestIdx === safeDest);
  return fromDef ? fromDef.index : ParamIdx.FilterFreq;
}

export const FREE_CONTROLLER_GROUPS = [
  { name: 'Aftertouch (Channel Pressure) — 4 Free Slots [363..370]', shortGroup: 'AFTERTOUCH', baseDest: 363, baseDepth: 367 },
  { name: 'Control 1 Stick Up (+Y / CC 01) — 4 Free Slots [371..378]', shortGroup: 'CTRL 1 UP', baseDest: 371, baseDepth: 375 },
  { name: 'Control 1 Stick Down (−Y) — 4 Free Slots [379..386]', shortGroup: 'CTRL 1 DOWN', baseDest: 379, baseDepth: 383 },
  { name: 'Control 2 Wheel (CC 02) — 4 Free Slots [387..394]', shortGroup: 'CTRL 2 WHEEL', baseDest: 387, baseDepth: 391 },
  { name: 'Control 3 Wheel (CC 03) — 4 Free Slots [395..402]', shortGroup: 'CTRL 3 WHEEL', baseDest: 395, baseDepth: 399 },
  { name: 'Controller 4 / Foot & Aux (CC 04) — 4 Free Slots [403..410]', shortGroup: 'CTRL 4 AUX', baseDest: 403, baseDepth: 407 },
];

export type MatrixTabId = 'all' | 'macros' | 'controllers' | 'free';

export interface MatrixDrawerOptions {
  onClose: () => void;
  initialTab?: MatrixTabId;
}

const MACRO_DEFAULTS = [61, 56, 32, 62]; // Knob 1..4 default destinations

function formatSignedDepth(val: number): string {
  const rounded = Math.round(val);
  const absStr = String(Math.abs(rounded)).padStart(2, '0');
  return rounded >= 0 ? `+${absStr}` : `-${absStr}`;
}

export class MatrixDrawer {
  static createContent(options: MatrixDrawerOptions): HTMLElement {
    const root = document.createElement('div');
    root.className = 'drawer-view-content';
    root.style.cssText = 'display: flex; flex-direction: column; height: 100%; box-sizing: border-box;';

    const buildCleanDestOptions = (selectedId: number) =>
      ALL_63_MOD_DESTINATIONS.map((d) => {
        const cleanLabel = d.label.replace(/^\d+:\s*/, '').replace(/\s*\[\d+\]$/, '');
        return `<option value="${d.id}" title="${d.label}" ${d.id === selectedId ? 'selected' : ''}>${cleanLabel}</option>`;
      }).join('');

    const buildFreeDestOptions = (selectedVal: number) => {
      const isOff = selectedVal === 3000 || selectedVal === 0 || selectedVal === undefined || selectedVal === null;
      let opts = `<option value="3000" ${isOff ? 'selected' : ''}>00: -- Off / None --</option>`;
      ALL_131_FREE_DESTINATIONS.forEach((d) => {
        if (d.id === 3000) return;
        const isSelected = selectedVal === d.id;
        opts += `<option value="${d.id}" title="${d.label}" ${isSelected ? 'selected' : ''}>${d.label}</option>`;
      });
      return opts;
    };

    const viewSectionItems = [
      { id: 'all', label: 'All Matrix' },
      { id: 'macros', label: '1. <NUKE> Macros & Controllers' },
      { id: 'controllers', label: '2. Controllers & Free Matrix' },
      { id: 'free', label: '3. Free Matrix 6×4' },
    ];
    const viewSectionHtml = pillSelectorHtml(viewSectionItems, options.initialTab || 'all', {
      id: 'matrix-view-section-pills',
      size: 'sm',
      attrName: 'data-view',
    });

    // 1. 4 <NUKE> Assignable Macro Knobs [425..428] (Knob + Value above <select>)
    let knobsHtml = '';
    for (let k = 0; k < 4; ++k) {
      const knobNum = k + 1;
      const selectParamId = 425 + k;
      const curTargetDest = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(selectParamId, MACRO_DEFAULTS[k]))));
      const targetParamIdx = resolveParamIndexFromModDest(curTargetDest);
      const def = PARAM_DEFINITIONS[targetParamIdx];
      const defVal = def ? def.defaultValue : 64;
      const curVal = Math.round(WebBridge.getParam(targetParamIdx, defVal));

      knobsHtml += `
        <div class="synth-panel-card nuke-ctrl-card" data-matrix-macro="${k}" style="padding: var(--space-2); display: flex; flex-direction: column; align-items: center; gap: 6px;">
          <div class="nuke-ctrl-header" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
            <span class="stick-label" style="font-size: 10px;">MACRO KNOB ${knobNum}</span>
            <span class="hud-pill stat-num" style="font-size: 8.5px;">[${selectParamId}]</span>
          </div>
          <div class="synth-knob-cell">
            <div id="matrix-macro-knob-mount-${k}"></div>
            <span class="synth-knob-num stat-num" id="matrix-macro-val-${k}">${curVal}</span>
            <span class="synth-knob-title">KNOB ${knobNum}</span>
          </div>
          <select class="btn btn-xs btn-outline abd-select__field matrix-macro-select" id="matrix-macro-select-${k}" data-macro-idx="${k}" data-param="${selectParamId}" style="width: 100%; height: 22px;" title="Macro Knob ${knobNum} Target Parameter [${selectParamId}]">
            ${buildCleanDestOptions(curTargetDest)}
          </select>
        </div>
      `;
    }

    // 2. 6 Real-Time Performance Controllers ([413..424]: <NUKE> bottom strip & Panel Control 1..3)
    let sourcesHtml = '';
    MOD_SOURCES.forEach((src, idx) => {
      const curDest = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(src.destParam, src.defaultDest))));
      const curDepth = Math.max(-64, Math.min(63, Math.round(WebBridge.getParam(src.depthParam, src.defaultDepth))));

      sourcesHtml += `
        <div class="synth-panel-card nuke-ctrl-card" data-matrix-ctrl="${idx}" style="padding: var(--space-2); display: flex; flex-direction: column; align-items: center; gap: 6px;">
          <div class="nuke-ctrl-header" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
            <span class="stick-label" style="font-size: 10px;" title="${src.name}">${src.shortName}</span>
            <span class="hud-pill stat-num" style="font-size: 8.5px;" title="${src.subLabel}">${src.subLabel}</span>
          </div>
          <div class="synth-knob-cell">
            <div id="matrix-ctrl-knob-mount-${idx}"></div>
            <span class="synth-knob-num stat-num" id="matrix-ctrl-depth-val-${idx}">${formatSignedDepth(curDepth)}</span>
            <span class="synth-knob-title">DEPTH</span>
          </div>
          <select class="btn btn-xs btn-outline abd-select__field src-dest-select" id="matrix-ctrl-dest-${idx}" data-ctrl-idx="${idx}" data-param="${src.destParam}" style="width: 100%; height: 22px;" title="${src.name} Destination [${src.destParam}]">
            ${buildCleanDestOptions(curDest)}
          </select>
        </div>
      `;
    });

    // 3. 6x4 Free Controllers [363..410] (Same card + bipolar Knob + <select> aesthetic)
    let freeCtrlHtml = '';
    FREE_CONTROLLER_GROUPS.forEach((grp, gIdx) => {
      let slotsHtml = '';
      for (let s = 0; s < 4; ++s) {
        const destIdx = grp.baseDest + s;
        const dpIdx = grp.baseDepth + s;
        const curDestVal = Math.round(WebBridge.getParam(destIdx, 3000));
        const curDp = Math.max(-64, Math.min(63, Math.round(WebBridge.getParam(dpIdx, 0))));
        slotsHtml += `
          <div class="synth-panel-card nuke-ctrl-card" data-free-slot="${gIdx}-${s}" style="padding: var(--space-2); display: flex; flex-direction: column; align-items: center; gap: 6px;">
            <div class="nuke-ctrl-header" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
              <span class="stick-label" style="font-size: 10px;">SLOT ${s + 1}</span>
              <span class="hud-pill stat-num" style="font-size: 8.5px;">[${destIdx}/${dpIdx}]</span>
            </div>
            <div class="synth-knob-cell">
              <div id="matrix-free-knob-mount-${gIdx}-${s}"></div>
              <span class="synth-knob-num stat-num" id="matrix-free-depth-val-${gIdx}-${s}">${formatSignedDepth(curDp)}</span>
              <span class="synth-knob-title">DEPTH</span>
            </div>
            <select class="btn btn-xs btn-outline abd-select__field src-dest-select" data-param="${destIdx}" style="width: 100%; height: 22px;" title="${grp.name} · Slot ${s + 1} Destination [${destIdx}]">
              ${buildFreeDestOptions(curDestVal)}
            </select>
          </div>
        `;
      }
      freeCtrlHtml += `
        <div class="synth-panel-card" style="padding: var(--space-2) var(--space-3); display: flex; flex-direction: column; gap: 6px;">
          <span class="panel-caption" style="font-size: 10px; color: var(--color-accent); font-weight: 700;">${grp.name}</span>
          <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2);">
            ${slotsHtml}
          </div>
        </div>
      `;
    });

    root.innerHTML = `
      <div class="drawer-header ndb-modal-header" style="flex-wrap: wrap; gap: var(--space-2);">
        <div class="drawer-title ndb-header-title" style="flex: 1; min-width: 240px;">
          <span class="drawer-icon">${ICONS.matrix}</span>
          <span class="ndb-title-text">&lt;NUKE&gt; MACROS, CONTROLLERS &amp; MODULATION MATRIX</span>
          <span class="panel-badge ndb-badge">[363..428]</span>
        </div>
        <button type="button" class="btn btn-close-drawer ndb-close-btn" id="btn-close-matrix-drawer" title="Close (Esc)">${ICONS.close}</button>
      </div>

      <!-- Barra de navegación por pestañas (View Section) -->
      <div style="padding: var(--space-2) var(--space-4); border-bottom: 1px solid var(--color-panel-border-dim); background: var(--color-panel-surface); display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="hud-label" style="font-size: 11px;">VIEW SECTION:</span>
          ${viewSectionHtml}
        </div>
        <span class="hud-pill" style="font-size: 9px; opacity: 0.7;">63 MOD DESTINATIONS</span>
      </div>

      <div class="drawer-scroll-body" id="matrix-scroll-body" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-3); padding: var(--space-3) var(--space-4);">
        <!-- Bloque 1: 4 <NUKE> Assignable Macro Knobs ([425..428]) -->
        <section id="block-macro-knobs" style="display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700; font-size: 11px; letter-spacing: 0.5px;">
              1. &lt;NUKE&gt; REMOTE — 4 ASSIGNABLE MACRO KNOBS ([425..428])
            </span>
            <span class="hud-label" style="font-size: 9.5px; opacity: 0.85;">
              Direct rotary control &amp; target parameter assignment (KNOB 1..4 in &lt;NUKE&gt;)
            </span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-2);">
            ${knobsHtml}
          </div>
        </section>

        <!-- Bloque 2: 6 Real-Time Performance Controllers (<NUKE> Bottom Console & Panel Control 1..3 [413..424]) -->
        <section id="block-midi-controls" style="display: flex; flex-direction: column; gap: var(--space-2);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
            <span class="panel-caption" style="color: var(--color-accent); font-weight: 700; font-size: 11px; letter-spacing: 0.5px;">
              2. REAL-TIME PERFORMANCE CONTROLLERS — &lt;NUKE&gt; &amp; PANEL CONTROL 1..3 ([413..424])
            </span>
            <span class="hud-label" style="font-size: 9.5px; opacity: 0.85;">
              Bipolar modulation depth (-64..+63) &amp; target destination (0..62)
            </span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2);">
            ${sourcesHtml}
          </div>
        </section>

        <!-- Bloque 3: Free Controllers Matrix ([363..410]) -->
        <section id="block-free-controllers" style="display: flex; flex-direction: column; gap: var(--space-2);">
          <div class="panel-caption" style="color: var(--color-accent); font-weight: 700; font-size: 11px; letter-spacing: 0.5px;">
            3. FREE CONTROLLERS MODULATION MATRIX (6 × 4 SLOTS, [363..410])
          </div>
          <div style="display: flex; flex-direction: column; gap: var(--space-2);">
            ${freeCtrlHtml}
          </div>
        </section>
      </div>
    `;

    root.querySelector('#btn-close-matrix-drawer')?.addEventListener('click', () => {
      options.onClose();
    });

    // Mount the 4 Macro Knobs (KNOB 1..4) and wire their <select> dropdowns
    const macroKnobs: (Knob | null)[] = [null, null, null, null];
    const syncMacroKnobCard = (k: number) => {
      const selectParamId = 425 + k;
      const curDestId = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(selectParamId, MACRO_DEFAULTS[k]))));
      const targetParamIdx = resolveParamIndexFromModDest(curDestId);
      const mountEl = root.querySelector(`#matrix-macro-knob-mount-${k}`) as HTMLElement | null;
      mountEl?.setAttribute('data-param-index', String(targetParamIdx));
      const def = PARAM_DEFINITIONS[targetParamIdx];
      const min = def ? def.min : 0;
      const max = def ? def.max : 127;
      const defVal = def ? def.defaultValue : 64;
      const curVal = Math.round(WebBridge.getParam(targetParamIdx, defVal));
      const norm = max > min ? Math.max(0, Math.min(1, (curVal - min) / (max - min))) : 0.5;
      macroKnobs[k]?.setValue(norm, false);
      const valEl = root.querySelector(`#matrix-macro-val-${k}`);
      if (valEl) valEl.textContent = String(curVal);
    };

    for (let k = 0; k < 4; ++k) {
      const knobNum = k + 1;
      const selectParamId = 425 + k;
      const mountEl = root.querySelector(`#matrix-macro-knob-mount-${k}`) as HTMLElement | null;
      const selectEl = root.querySelector(`#matrix-macro-select-${k}`) as HTMLSelectElement | null;

      if (mountEl) {
        let gestureParam = -1;
        macroKnobs[k] = new Knob(mountEl, {
          size: 38,
          value: 0.5,
          label: `KNOB ${knobNum}`,
          // El destino lo decide el selector de al lado: el gesto se abre sobre el
          // parámetro que el mando gobierna cuando se agarra.
          onDragStart: () => {
            const destId = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(selectParamId, MACRO_DEFAULTS[k]))));
            // Se cierra el parametro agarrado, aunque el selector cambie a mitad.
            gestureParam = resolveParamIndexFromModDest(destId);
            WebBridge.beginGesture(gestureParam);
          },
          onDragEnd: () => {
            if (gestureParam >= 0) WebBridge.endGesture(gestureParam);
          },
          onChange: (normVal: number) => {
            const curDestId = Math.max(0, Math.min(62, Math.round(WebBridge.getParam(selectParamId, MACRO_DEFAULTS[k]))));
            const targetParamIdx = resolveParamIndexFromModDest(curDestId);
            const def = PARAM_DEFINITIONS[targetParamIdx];
            const min = def ? def.min : 0;
            const max = def ? def.max : 127;
            const rawVal = Math.round(min + normVal * (max - min));
            const valEl = root.querySelector(`#matrix-macro-val-${k}`);
            if (valEl) valEl.textContent = String(rawVal);
            WebBridge.setParam(targetParamIdx, rawVal);
          },
        });
        syncMacroKnobCard(k);
      }

      if (selectEl) {
        selectEl.addEventListener('change', () => {
          const newDestId = parseInt(selectEl.value || '0', 10);
          WebBridge.setParam(selectParamId, newDestId);
          syncMacroKnobCard(k);
        });
      }
    }

    // Mount the 6 Performance Controller Bipolar Depth Knobs ([414, 416, 418, 420, 422, 424])
    MOD_SOURCES.forEach((src, idx) => {
      const mountEl = root.querySelector(`#matrix-ctrl-knob-mount-${idx}`) as HTMLElement | null;
      const valEl = root.querySelector(`#matrix-ctrl-depth-val-${idx}`) as HTMLElement | null;
      if (mountEl) {
        mountEl.setAttribute('data-param-index', String(src.depthParam));
        const initDepth = Math.max(-64, Math.min(63, Math.round(WebBridge.getParam(src.depthParam, src.defaultDepth))));
        const initNorm = Math.max(0, Math.min(1, (initDepth + 64) / 127.0));
        new Knob(mountEl, {
          size: 38,
          value: initNorm,
          bipolar: true,
          ...gestureFor(src.depthParam),
          onChange: (normVal: number) => {
            const rawDepth = Math.max(-64, Math.min(63, Math.round(normVal * 127.0 - 64.0)));
            if (valEl) valEl.textContent = formatSignedDepth(rawDepth);
            WebBridge.setParam(src.depthParam, rawDepth);
          },
        });
      }
    });

    // Mount the 24 (6x4) Free Controller Bipolar Depth Knobs ([367..370, 375..378, 383..386, 391..394, 399..402, 407..410])
    FREE_CONTROLLER_GROUPS.forEach((grp, gIdx) => {
      for (let s = 0; s < 4; ++s) {
        const dpIdx = grp.baseDepth + s;
        const mountEl = root.querySelector(`#matrix-free-knob-mount-${gIdx}-${s}`) as HTMLElement | null;
        const valEl = root.querySelector(`#matrix-free-depth-val-${gIdx}-${s}`) as HTMLElement | null;
        if (mountEl) {
          mountEl.setAttribute('data-param-index', String(dpIdx));
          const initDepth = Math.max(-64, Math.min(63, Math.round(WebBridge.getParam(dpIdx, 0))));
          const initNorm = Math.max(0, Math.min(1, (initDepth + 64) / 127.0));
          new Knob(mountEl, {
            size: 38,
            value: initNorm,
            bipolar: true,
            ...gestureFor(dpIdx),
            onChange: (normVal: number) => {
              const rawDepth = Math.max(-64, Math.min(63, Math.round(normVal * 127.0 - 64.0)));
              if (valEl) valEl.textContent = formatSignedDepth(rawDepth);
              WebBridge.setParam(dpIdx, rawDepth);
            },
          });
        }
      }
    });

    // Destination selects for 6 Performance Controllers & 6x4 Free Matrix
    root.querySelectorAll('.src-dest-select').forEach((sel) => {
      sel.addEventListener('change', (e) => {
        const target = e.currentTarget as HTMLSelectElement;
        const paramId = parseInt(target.getAttribute('data-param') || '0', 10);
        const destId = parseInt(target.value, 10);
        WebBridge.setParam(paramId, destId);
      });
    });

    // ── Filtro / Navegación por pestañas (View Section) ─────
    const blockMidi = root.querySelector('#block-midi-controls') as HTMLElement | null;
    const blockMacros = root.querySelector('#block-macro-knobs') as HTMLElement | null;
    const blockFree = root.querySelector('#block-free-controllers') as HTMLElement | null;
    const viewSectionContainer = root.querySelector('#matrix-view-section-pills') as HTMLElement | null;
    const scrollContainer = root.querySelector('#matrix-scroll-body') as HTMLElement | null;

    const setFilter = (mode: MatrixTabId, doScroll = false) => {
      const viewPills = viewSectionContainer?.querySelectorAll('[data-view]');
      viewPills?.forEach((p) => p.classList.toggle('active', p.getAttribute('data-view') === mode));

      if (mode === 'all') {
        if (blockMacros) blockMacros.style.display = 'flex';
        if (blockMidi) blockMidi.style.display = 'flex';
        if (blockFree) blockFree.style.display = 'flex';
      } else if (mode === 'macros') {
        // Dedicated <NUKE> tab: shows BOTH the 4 <NUKE> Macro Knobs AND the 6 <NUKE> Performance Controllers!
        if (blockMacros) blockMacros.style.display = 'flex';
        if (blockMidi) blockMidi.style.display = 'flex';
        if (blockFree) blockFree.style.display = 'none';
      } else if (mode === 'controllers') {
        // Front-panel CONTROLLERS box is governed by both the 6 Performance Controllers ([413..424]) and the 6×4 Free Matrix ([363..410])
        if (blockMacros) blockMacros.style.display = 'none';
        if (blockMidi) blockMidi.style.display = 'flex';
        if (blockFree) blockFree.style.display = 'flex';
      } else if (mode === 'free') {
        if (blockMacros) blockMacros.style.display = 'none';
        if (blockMidi) blockMidi.style.display = 'none';
        if (blockFree) blockFree.style.display = 'flex';
      }

      if (doScroll && scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    };

    if (viewSectionContainer) {
      bindPillSelector(viewSectionContainer, (viewId) => {
        setFilter(viewId as MatrixTabId, viewId !== 'all');
      }, 'data-view');
    }

    if (options.initialTab) {
      setFilter(options.initialTab, true);
    }

    return root;
  }
}
