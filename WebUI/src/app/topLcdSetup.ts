/**
 * ABDAxionikVS — app/topLcdSetup.ts
 * Fixed top LCD console (Phase C): preset/model shortcuts into the bank and
 * drawers, preset-slot loading with envelopes, and a second factory-init
 * entry point shared with the navbar.
 */
import { TopLcdBar } from '../ui/TopLcdBar.js';
import { getCanonicalModelName, getCanonicalPresetInfo } from '../ui/NeuronCatalogMetadata.js';
import { WebBridge } from '../bridge/WebBridge.js';
import type { AppCtx } from './context.js';
import type { DrawerOpeners } from './drawerOpeners.js';
import { padSlot } from './resynatorUi.js';
import { initSound } from './presetApply.js';

export function setupTopLcdBar(ctx: AppCtx, openers: DrawerOpeners): void {
  ctx.topLcdBar = new TopLcdBar(ctx.lcdBarContainer, {
    onOpenBankPresets: () => ctx.bankDrawer?.open('presets', 'global'),
    onOpenBankModels: (resynator) => {
      ctx.state.targetResynatorForModelPick = resynator;
      ctx.bankDrawer?.open('models', resynator === 1 ? 'r1' : 'r2');
    },
    onOpenR1Drawer: openers.openR1Drawer,
    onOpenR2Drawer: openers.openR2Drawer,
    onOpenBlenderDrawer: openers.openBlenderDrawer,
    onOpenSilverDrawer: openers.openSilverDrawer,
    onOpenEnvelopeDrawer: () => openers.openEnvelopeDrawer(),
    onOpenMatrixDrawer: () => openers.openMatrixDrawer(),
    onSelectPresetSlot: (slot) => {
      const pInfo = getCanonicalPresetInfo(slot);
      ctx.navbar?.setPresetName(`${padSlot(slot)} ${pInfo.name}`);
      ctx.topLcdBar?.setPresetInfo(slot, `${padSlot(slot)} ${pInfo.name}`);
      const r1Name = getCanonicalModelName(pInfo.r1Model);
      const r2Name = getCanonicalModelName(pInfo.r2Model);
      ctx.resynator?.syncModel(1, pInfo.r1Model, r1Name);
      ctx.resynator?.syncModel(2, pInfo.r2Model, r2Name);
      WebBridge.seedPresetSlotEnvelopes(slot);
      WebBridge.loadPresetSlot(slot);
      ctx.shapersPanel?.syncAll();
      ctx.nukeDrawer?.syncAll();
      ctx.topLcdBar?.refreshAll();
    },
    onInitSound: () => {
      initSound(ctx);
    },
    onSelectAdsrTarget: (shaper, mode) => {
      ctx.shapersPanel?.selectEnvelopeTarget(shaper, mode);
    },
  });
}
