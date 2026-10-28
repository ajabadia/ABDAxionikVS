import { WebBridge } from '../bridge/WebBridge.js';
import { AxionikNavbar } from '../ui/Navbar.js';
import { BankDrawer } from '../ui/BankDrawer.js';
import { TrajectoryStick2D } from '../ui/TrajectoryStick2D.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { getParameterSetStickLabels } from '../ui/ParameterSets.js';
import { getCanonicalModelName, MODEL_METADATA } from '../ui/NeuronCatalogMetadata.js';
import { BLENDER_ALGORITHMS } from '../ui/BlenderDrawer.js';

export interface BridgeHandlerDeps {
  navbar: AxionikNavbar;
  bankDrawer: BankDrawer;
  r1ScapeStick: TrajectoryStick2D | null;
  r1SphereStick: TrajectoryStick2D | null;
  r2ScapeStick: TrajectoryStick2D | null;
  r2SphereStick: TrajectoryStick2D | null;
  updateResynatorModelUI: (resynator: 1 | 2, slot: number, name?: string) => void;
  updateResySwitchButton: (resy: 1 | 2, enabled: boolean) => void;
  applyAllParamsToUI: (values: number[]) => void;
  curBlenderAlgoIdxRef: { value: number };
  curBlenderVal: HTMLElement | null;
  blenderSlider: HTMLInputElement | null;
  blenderVal: HTMLElement | null;
  slicerTypes: string[];
  curSlicerTypeIdxRef: { value: number };
  curSlicerTypeVal: HTMLElement | null;
  slicerDepthSlider: HTMLInputElement | null;
  slicerDepthVal: HTMLElement | null;
  slicerRateSlider: HTMLInputElement | null;
  slicerRateVal: HTMLElement | null;
  filterCutSlider: HTMLInputElement | null;
  filterCutVal: HTMLElement | null;
  filterResoSlider: HTMLInputElement | null;
  filterResoVal: HTMLElement | null;
  freqAlgoNames: string[];
  curFreqAlgoIdxRef: { value: number };
  curFreqVal: HTMLElement | null;
  timeAlgoNames: string[];
  curTimeAlgoIdxRef: { value: number };
  curTimeVal: HTMLElement | null;
}

export function setupBridgeMessageHandler(deps: BridgeHandlerDeps) {
  WebBridge.onMessage((msg) => {
    if (msg.type === 'BANK_CATALOG_SYNC') {
      deps.bankDrawer.syncCatalogFromHost(msg);
    } else if (msg.type === 'PRESET_LOADED') {
      if (typeof msg.name === 'string' && msg.name) {
        deps.navbar.setPresetName(msg.name);
      }
      const r1 = typeof msg.r1Model === 'number' ? msg.r1Model : 511;
      const r2 = typeof msg.r2Model === 'number' ? msg.r2Model : 511;
      const r1Name = getCanonicalModelName(r1);
      const r2Name = getCanonicalModelName(r2);
      deps.updateResynatorModelUI(1, r1, r1Name);
      deps.updateResynatorModelUI(2, r2, r2Name);
      deps.navbar.setModelName(1, `#${String(r1).padStart(3, '0')} ${r1Name}`);
      deps.navbar.setModelName(2, `#${String(r2).padStart(3, '0')} ${r2Name}`);

      if (Array.isArray(msg.values)) {
        deps.applyAllParamsToUI(msg.values);
      }
    } else if (msg.type === 'TELEMETRY') {
      if (typeof msg.activeVoices === 'number') deps.navbar.setVoices(msg.activeVoices);
      if (typeof msg.cpuUsage === 'number') deps.navbar.setCpuLoad(msg.cpuUsage);
    } else if (msg.type === 'PARAM_UPDATE') {
      const idx = msg.index;
      const val = msg.value;
      if (idx === ParamIdx.R1Switch) {
        deps.updateResySwitchButton(1, val > 0.5);
      } else if (idx === ParamIdx.R2Switch) {
        deps.updateResySwitchButton(2, val > 0.5);
      } else if (idx === ParamIdx.R1ModellIndex) {
        const slot = Math.round(val);
        const name = getCanonicalModelName(slot);
        deps.updateResynatorModelUI(1, slot, name);
        deps.navbar.setModelName(1, `#${String(slot).padStart(3, '0')} ${name}`);
        const meta = MODEL_METADATA[slot];
        const pSet = meta ? meta[0] : (slot % 10);
        deps.r1ScapeStick?.setAllLayerLabels(getParameterSetStickLabels(pSet, 'scape'));
        deps.r1SphereStick?.setAllLayerLabels(getParameterSetStickLabels(pSet, 'sphere'));
      } else if (idx === ParamIdx.R2ModellIndex) {
        const slot = Math.round(val);
        const name = getCanonicalModelName(slot);
        deps.updateResynatorModelUI(2, slot, name);
        deps.navbar.setModelName(2, `#${String(slot).padStart(3, '0')} ${name}`);
        const meta = MODEL_METADATA[slot];
        const pSet = meta ? meta[0] : (slot % 10);
        deps.r2ScapeStick?.setAllLayerLabels(getParameterSetStickLabels(pSet, 'scape'));
        deps.r2SphereStick?.setAllLayerLabels(getParameterSetStickLabels(pSet, 'sphere'));
      } else if (idx === ParamIdx.BlenderType) {
        deps.curBlenderAlgoIdxRef.value = Math.max(0, Math.min(BLENDER_ALGORITHMS.length - 1, Math.round(val)));
        if (deps.curBlenderVal) deps.curBlenderVal.textContent = BLENDER_ALGORITHMS[deps.curBlenderAlgoIdxRef.value].name;
      } else if (idx === ParamIdx.BlenderAmount && deps.blenderSlider) {
        deps.blenderSlider.value = String(val);
        if (deps.blenderVal) deps.blenderVal.textContent = String(val);
      } else if (idx === ParamIdx.SlicerSwitchType) {
        deps.curSlicerTypeIdxRef.value = Math.max(0, Math.min(deps.slicerTypes.length - 1, Math.round(val)));
        if (deps.curSlicerTypeVal) deps.curSlicerTypeVal.textContent = deps.slicerTypes[deps.curSlicerTypeIdxRef.value];
      } else if (idx === ParamIdx.SlicerDepth && deps.slicerDepthSlider) {
        deps.slicerDepthSlider.value = String(val);
        if (deps.slicerDepthVal) deps.slicerDepthVal.textContent = String(val);
      } else if (idx === ParamIdx.SlicerRate && deps.slicerRateSlider) {
        deps.slicerRateSlider.value = String(val);
        if (deps.slicerRateVal) deps.slicerRateVal.textContent = String(val);
      } else if (idx === ParamIdx.FilterFreq && deps.filterCutSlider) {
        deps.filterCutSlider.value = String(val);
        if (deps.filterCutVal) deps.filterCutVal.textContent = String(val);
      } else if (idx === ParamIdx.FilterReso && deps.filterResoSlider) {
        deps.filterResoSlider.value = String(val);
        if (deps.filterResoVal) deps.filterResoVal.textContent = (val / 127).toFixed(2);
      } else if (idx === ParamIdx.CurFreqFX) {
        deps.curFreqAlgoIdxRef.value = Math.max(0, Math.min(deps.freqAlgoNames.length - 1, Math.round(val)));
        if (deps.curFreqVal) deps.curFreqVal.textContent = deps.freqAlgoNames[deps.curFreqAlgoIdxRef.value];
      } else if (idx === ParamIdx.CurTimeFX) {
        deps.curTimeAlgoIdxRef.value = Math.max(0, Math.min(deps.timeAlgoNames.length - 1, Math.round(val)));
        if (deps.curTimeVal) deps.curTimeVal.textContent = deps.timeAlgoNames[deps.curTimeAlgoIdxRef.value];
      } else if (deps.r1ScapeStick && (idx === ParamIdx.R1L1Scape1Value || idx === ParamIdx.R1L2Scape1Value || idx === ParamIdx.R1L3Scape1Value)) {
        const layer = idx === ParamIdx.R1L1Scape1Value ? 0 : (idx === ParamIdx.R1L2Scape1Value ? 1 : 2);
        const norm = Math.max(0, Math.min(1, val / 127));
        deps.r1ScapeStick.setPosition(layer, norm, deps.r1ScapeStick.getCoordinates(layer).y, false);
      } else if (deps.r1ScapeStick && (idx === ParamIdx.R1L1Scape2Value || idx === ParamIdx.R1L2Scape2Value || idx === ParamIdx.R1L3Scape2Value)) {
        const layer = idx === ParamIdx.R1L1Scape2Value ? 0 : (idx === ParamIdx.R1L2Scape2Value ? 1 : 2);
        const norm = Math.max(0, Math.min(1, val / 127));
        deps.r1ScapeStick.setPosition(layer, deps.r1ScapeStick.getCoordinates(layer).x, norm, false);
      } else if (deps.r1SphereStick && (idx === ParamIdx.R1L1Sphere1Value || idx === ParamIdx.R1L2Sphere1Value || idx === ParamIdx.R1L3Sphere1Value)) {
        const layer = idx === ParamIdx.R1L1Sphere1Value ? 0 : (idx === ParamIdx.R1L2Sphere1Value ? 1 : 2);
        const norm = Math.max(0, Math.min(1, val / 127));
        deps.r1SphereStick.setPosition(layer, norm, deps.r1SphereStick.getCoordinates(layer).y, false);
      } else if (deps.r1SphereStick && (idx === ParamIdx.R1L1Sphere2Value || idx === ParamIdx.R1L2Sphere2Value || idx === ParamIdx.R1L3Sphere2Value)) {
        const layer = idx === ParamIdx.R1L1Sphere2Value ? 0 : (idx === ParamIdx.R1L2Sphere2Value ? 1 : 2);
        const norm = Math.max(0, Math.min(1, val / 127));
        deps.r1SphereStick.setPosition(layer, deps.r1SphereStick.getCoordinates(layer).x, norm, false);
      } else if (deps.r2ScapeStick && (idx === ParamIdx.R2L1Scape1Value || idx === ParamIdx.R2L2Scape1Value || idx === ParamIdx.R2L3Scape1Value)) {
        const layer = idx === ParamIdx.R2L1Scape1Value ? 0 : (idx === ParamIdx.R2L2Scape1Value ? 1 : 2);
        const norm = Math.max(0, Math.min(1, val / 127));
        deps.r2ScapeStick.setPosition(layer, norm, deps.r2ScapeStick.getCoordinates(layer).y, false);
      } else if (deps.r2ScapeStick && (idx === ParamIdx.R2L1Scape2Value || idx === ParamIdx.R2L2Scape2Value || idx === ParamIdx.R2L3Scape2Value)) {
        const layer = idx === ParamIdx.R2L1Scape2Value ? 0 : (idx === ParamIdx.R2L2Scape2Value ? 1 : 2);
        const norm = Math.max(0, Math.min(1, val / 127));
        deps.r2ScapeStick.setPosition(layer, deps.r2ScapeStick.getCoordinates(layer).x, norm, false);
      } else if (deps.r2SphereStick && (idx === ParamIdx.R2L1Sphere1Value || idx === ParamIdx.R2L2Sphere1Value || idx === ParamIdx.R2L3Sphere1Value)) {
        const layer = idx === ParamIdx.R2L1Sphere1Value ? 0 : (idx === ParamIdx.R2L2Sphere1Value ? 1 : 2);
        const norm = Math.max(0, Math.min(1, val / 127));
        deps.r2SphereStick.setPosition(layer, norm, deps.r2SphereStick.getCoordinates(layer).y, false);
      } else if (deps.r2SphereStick && (idx === ParamIdx.R2L1Sphere2Value || idx === ParamIdx.R2L2Sphere2Value || idx === ParamIdx.R2L3Sphere2Value)) {
        const layer = idx === ParamIdx.R2L1Sphere2Value ? 0 : (idx === ParamIdx.R2L2Sphere2Value ? 1 : 2);
        const norm = Math.max(0, Math.min(1, val / 127));
        deps.r2SphereStick.setPosition(layer, deps.r2SphereStick.getCoordinates(layer).x, norm, false);
      }
    }
  });
}
