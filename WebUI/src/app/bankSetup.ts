/**
 * ABDAxionikVS — app/bankSetup.ts
 * Bank + NeuronDB models/presets drawer: model assignment (slot or expanded
 * JSON/slug), preset loading with envelopes, and preset-object application.
 * The resynator triple sync goes through resynator.syncModel; the `[EXP]`
 * label stays manual (deliberately unprefixed display name).
 */
import { BankDrawer } from '../ui/BankDrawer.js';
import { getCanonicalModelName, getCanonicalPresetInfo } from '../ui/NeuronCatalogMetadata.js';
import { getParameterSetStickLabels } from '../ui/ParameterSets.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import type { AppCtx } from './context.js';
import { padSlot } from './resynatorUi.js';
import { applyLoadedPreset } from './presetApply.js';

export function createBankDrawer(ctx: AppCtx): BankDrawer {
  const bankDrawer = new BankDrawer(ctx.drawerManager, {
    onSelectModel: (slot, resynator) => {
      const targetR = resynator || ctx.state.targetResynatorForModelPick;
      const model = bankDrawer.getBank().models.find((m) => m.slot === slot);
      const modelName = model ? model.name : `Model #${padSlot(slot)}`;
      ctx.resynator?.syncModel(targetR, slot, modelName);

      // Actualizar dinámicamente las etiquetas mnAN de los 4 polos según el Parameter Set del modelo
      const parSet = model ? model.parameterSet : slot % 10;
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
      ctx.nukeDrawer?.syncAll();
      console.log(`[ABDAxionikVS] Assigned Model #${slot} (${modelName}, ParSet ${parSet}) to Resynator ${targetR}`);
    },
    onSelectExpandedModel: (entry, resynator) => {
      const targetR = resynator || ctx.state.targetResynatorForModelPick;
      const parSet = entry.parameterSet ?? 0;
      if (targetR === 1) {
        ctx.sticks.r1Scape?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'scape'));
        ctx.sticks.r1Sphere?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'sphere'));
      } else {
        ctx.sticks.r2Scape?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'scape'));
        ctx.sticks.r2Sphere?.setAllLayerLabels(getParameterSetStickLabels(parSet, 'sphere'));
      }
      if (entry.expandedJson) {
        WebBridge.loadExpandedModelJson(targetR, entry.expandedJson);
      } else {
        WebBridge.loadExpandedModelSlug(entry.slug, targetR);
      }
      ctx.resynator?.updateModelUI(targetR, 900 + targetR, `[EXP] ${entry.name}`);
      ctx.navbar?.setModelName(targetR, `[EXP] ${entry.name}`);
      ctx.nukeDrawer?.syncAll();
    },
    onSelectPreset: (slot, name) => {
      const pInfo = getCanonicalPresetInfo(slot);
      const displayName = name || pInfo.name;
      ctx.navbar?.setPresetName(`${padSlot(slot)} ${displayName}`);

      const r1Name = getCanonicalModelName(pInfo.r1Model);
      const r2Name = getCanonicalModelName(pInfo.r2Model);
      ctx.resynator?.syncModel(1, pInfo.r1Model, r1Name);
      ctx.resynator?.syncModel(2, pInfo.r2Model, r2Name);

      WebBridge.seedPresetSlotEnvelopes(slot);
      WebBridge.loadPresetSlot(slot);
      ctx.shapersPanel?.syncAll();
      ctx.nukeDrawer?.syncAll();
      ctx.topLcdBar?.setPresetInfo(slot, `${padSlot(slot)} ${displayName}`);
      ctx.topLcdBar?.refreshAll();
      console.log(`[ABDAxionikVS] Loaded Sound Preset #${slot} "${displayName}" (R1: #${pInfo.r1Model} ${r1Name}, R2: #${pInfo.r2Model} ${r2Name})`);
    },
    onConfigureNeuronDbFolder: () => {
      bankDrawer.promptConfigureFolder();
    },
    onSelectAxionikPreset: (preset) => {
      applyLoadedPreset(ctx, preset);
    },
  });
  ctx.bankDrawer = bankDrawer;
  return bankDrawer;
}
