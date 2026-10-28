import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { BLENDER_ALGORITHMS } from '../ui/BlenderDrawer.js';

export interface CentralControlsRefs {
  curBlenderAlgoIdx: number;
  curSlicerTypeIdx: number;
  curFreqAlgoIdx: number;
  curTimeAlgoIdx: number;
}

export function setupCentralControls() {
  const freqAlgoNames = ['EQ/Comp', 'Distortion', 'RingMod', 'Decimator', 'Sp-Warp'];
  const timeAlgoNames = ['St.Spread', 'L/R Delay', 'Flanger', 'Phaser', 'Chorus'];
  const slicerTypes = ['Off', '2D', '3D'];
  
  let curBlenderAlgoIdx = 0;
  const btnCycleBlender = document.getElementById('btn-cycle-blender-algo');
  const curBlenderVal = document.getElementById('cur-blender-algo-val');
  btnCycleBlender?.addEventListener('click', () => {
    curBlenderAlgoIdx = (curBlenderAlgoIdx + 1) % BLENDER_ALGORITHMS.length;
    if (curBlenderVal) curBlenderVal.textContent = BLENDER_ALGORITHMS[curBlenderAlgoIdx].name;
    WebBridge.setParam(ParamIdx.BlenderType, curBlenderAlgoIdx);
  });

  const blenderSlider = document.getElementById('blender-slider') as HTMLInputElement | null;
  const blenderVal = document.getElementById('blender-amount-val');
  blenderSlider?.addEventListener('input', () => {
    const val = parseFloat(blenderSlider.value);
    if (blenderVal) blenderVal.textContent = String(val);
    WebBridge.setParam(ParamIdx.BlenderAmount, val);
  });

  let curSlicerTypeIdx = 0;
  const btnCycleSlicer = document.getElementById('btn-cycle-slicer-type');
  const curSlicerTypeVal = document.getElementById('cur-slicer-type-val');
  btnCycleSlicer?.addEventListener('click', () => {
    curSlicerTypeIdx = (curSlicerTypeIdx + 1) % slicerTypes.length;
    if (curSlicerTypeVal) curSlicerTypeVal.textContent = slicerTypes[curSlicerTypeIdx];
    WebBridge.setParam(ParamIdx.SlicerSwitchType, curSlicerTypeIdx);
  });

  const slicerRateSlider = document.getElementById('slicer-rate-slider') as HTMLInputElement | null;
  const slicerRateVal = document.getElementById('slicer-rate-val');
  slicerRateSlider?.addEventListener('input', () => {
    const val = parseFloat(slicerRateSlider.value);
    if (slicerRateVal) slicerRateVal.textContent = String(val);
    WebBridge.setParam(ParamIdx.SlicerRate, val);
  });

  const slicerDepthSlider = document.getElementById('slicer-depth-slider') as HTMLInputElement | null;
  const slicerDepthVal = document.getElementById('slicer-depth-val');
  slicerDepthSlider?.addEventListener('input', () => {
    const val = parseFloat(slicerDepthSlider.value);
    if (slicerDepthVal) slicerDepthVal.textContent = String(val);
    WebBridge.setParam(ParamIdx.SlicerDepth, val);
  });

  const filterCutSlider = document.getElementById('filter-freq-slider') as HTMLInputElement | null;
  const filterCutVal = document.getElementById('filter-freq-val');
  filterCutSlider?.addEventListener('input', () => {
    const val = parseFloat(filterCutSlider.value);
    if (filterCutVal) filterCutVal.textContent = String(val);
    WebBridge.setParam(ParamIdx.FilterFreq, val);
  });

  const filterResoSlider = document.getElementById('filter-reso-slider') as HTMLInputElement | null;
  const filterResoVal = document.getElementById('filter-reso-val');
  filterResoSlider?.addEventListener('input', () => {
    const val = parseFloat(filterResoSlider.value);
    if (filterResoVal) filterResoVal.textContent = (val / 127).toFixed(2);
    WebBridge.setParam(ParamIdx.FilterReso, val);
  });

  let curFreqAlgoIdx = 2; // RingMod
  const btnCycleFreq = document.getElementById('btn-cycle-freqfx');
  const curFreqVal = document.getElementById('cur-freq-fx-val');
  btnCycleFreq?.addEventListener('click', () => {
    curFreqAlgoIdx = (curFreqAlgoIdx + 1) % freqAlgoNames.length;
    if (curFreqVal) curFreqVal.textContent = freqAlgoNames[curFreqAlgoIdx];
    WebBridge.setParam(ParamIdx.SilverSwitch, 1);
    WebBridge.setParam(ParamIdx.FreqFXSwitch, 1);
    WebBridge.setParam(ParamIdx.CurFreqFX, curFreqAlgoIdx);
  });

  let curTimeAlgoIdx = 4; // Chorus
  const btnCycleTime = document.getElementById('btn-cycle-timefx');
  const curTimeVal = document.getElementById('cur-time-fx-val');
  btnCycleTime?.addEventListener('click', () => {
    curTimeAlgoIdx = (curTimeAlgoIdx + 1) % timeAlgoNames.length;
    if (curTimeVal) curTimeVal.textContent = timeAlgoNames[curTimeAlgoIdx];
    WebBridge.setParam(ParamIdx.SilverSwitch, 1);
    WebBridge.setParam(ParamIdx.TimeFXSwitch, 1);
    WebBridge.setParam(ParamIdx.CurTimeFX, curTimeAlgoIdx);
  });

  return {
    freqAlgoNames,
    timeAlgoNames,
    slicerTypes,
    getCurBlenderAlgoIdx: () => curBlenderAlgoIdx,
    setCurBlenderAlgoIdx: (v: number) => { curBlenderAlgoIdx = v; },
    getCurSlicerTypeIdx: () => curSlicerTypeIdx,
    setCurSlicerTypeIdx: (v: number) => { curSlicerTypeIdx = v; },
    getCurFreqAlgoIdx: () => curFreqAlgoIdx,
    setCurFreqAlgoIdx: (v: number) => { curFreqAlgoIdx = v; },
    getCurTimeAlgoIdx: () => curTimeAlgoIdx,
    setCurTimeAlgoIdx: (v: number) => { curTimeAlgoIdx = v; },
    blenderSlider,
    blenderVal,
    slicerRateSlider,
    slicerRateVal,
    slicerDepthSlider,
    slicerDepthVal,
    filterCutSlider,
    filterCutVal,
    filterResoSlider,
    filterResoVal,
    curBlenderVal,
    curSlicerTypeVal,
    curFreqVal,
    curTimeVal,
  };
}
