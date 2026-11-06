/**
 * ABDAxionikVS — app/dragDrop.ts
 * File drops onto the workspace: expanded-model JSON (expanded mode only),
 * legacy model files by slot prefix, preset scripts by name sniffing, and
 * model-package zips. Resynator sync funnels through resynator.syncModel.
 */
import { DragDropHandler } from '../ui/DragDropHandler.js';
import { getParameterSetStickLabels } from '../ui/ParameterSets.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import type { AppCtx } from './context.js';

export function createDragDrop(ctx: AppCtx): DragDropHandler {
  const handler = new DragDropHandler({
    onDropModel: async (file, targetR) => {
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.json') || lower.endsWith('.nmmodel')) {
        if (ctx.navbar?.getEngineMode() !== 'expanded') {
          handler.showToast(
            `[MODE MISMATCH] Classic/Plus mode only supports .model v1. Switch to EXPANDED for Resynator v2 models.`,
            4200
          );
          return;
        }
        try {
          const text = await file.text();
          WebBridge.loadExpandedModelJson(targetR, text);
        } catch (_err) {
          handler.showToast(`[PREFLIGHT ERROR] Could not read "${file.name}"`);
        }
        return;
      }
      const match = file.name.match(/^(\d{1,4})/);
      const slot = match ? parseInt(match[1], 10) : targetR === 1 ? 42 : 511;
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      ctx.resynator?.syncModel(targetR, slot, cleanName);

      const parSet = slot % 10;
      if (targetR === 1) {
        ctx.sticks.r1Scape?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'scape'));
        ctx.sticks.r1Sphere?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'sphere'));
        WebBridge.setParam(ParamIdx.R1ModellIndex, slot);
      } else {
        ctx.sticks.r2Scape?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'scape'));
        ctx.sticks.r2Sphere?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'sphere'));
        WebBridge.setParam(ParamIdx.R2ModellIndex, slot);
      }
      WebBridge.loadModelSlot(slot, targetR);
      console.log(`[ABDAxionikVS] DragDrop: Loaded model "${file.name}" to R${targetR} (Slot ${slot}, ParSet ${parSet})`);
    },
    onDropPreset: async (file) => {
      let presetName = file.name.replace(/\.[^/.]+$/, '');
      try {
        const text = await file.text();
        WebBridge.loadPresetScript(text);
        const lines = text.split('\n');
        for (const line of lines.slice(0, 30)) {
          const m = line.match(/(?:soundname|name|preset)\s*[:=]?\s*["']?([^"'\r\n]+)["']?/i);
          if (m && m[1].trim()) {
            presetName = m[1].trim();
            break;
          }
        }
      } catch (_err) {
        // En caso de preset binario / fxp, mantener nombre de fichero
      }
      ctx.navbar?.setPresetName(presetName);
      console.log(`[ABDAxionikVS] DragDrop: Loaded preset "${presetName}"`);
    },
    onDropZip: (file) => {
      console.log(`[ABDAxionikVS] DragDrop: Model package dropped "${file.name}"`);
    },
  });
  ctx.dragDropHandler = handler;
  return handler;
}
