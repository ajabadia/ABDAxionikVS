/**
 * ABDAxionikVS — app/auxDrawers.ts
 * Slide-over drawers with their own mount point: NUKE remote, hardware
 * dumps inspector and calibration. Callbacks read ctx lazily; the NUKE
 * param path goes through the shared PARAM_UPDATE handler.
 */
import { NukeDrawer } from '../ui/NukeDrawer.js';
import { HardwareDumpsDrawer } from '../ui/HardwareDumpsDrawer.js';
import { CalibrationDrawer } from '../ui/CalibrationDrawer.js';
import { handleParamUpdate } from './paramUpdate.js';
import type { AppCtx } from './context.js';
import type { DrawerOpeners } from './drawerOpeners.js';
import { applyAllParamsToUI } from './presetApply.js';

export function setupAuxDrawers(ctx: AppCtx, openers: Pick<DrawerOpeners, 'openMatrixDrawer'>): void {
  ctx.hardwareDumpsDrawer = new HardwareDumpsDrawer(
    ctx.app,
    {
      getPresetName: () => ctx.state.currentPresetName,
      onApplyDecodedParams: (params, presetName) => {
        if (presetName) {
          ctx.state.currentPresetName = presetName;
          ctx.navbar?.setPresetName(presetName);
          ctx.topLcdBar?.setPresetInfo(0, presetName);
        }
        applyAllParamsToUI(ctx, params);
        ctx.controllersPanel?.updateLabels();
        ctx.silverPanel?.updateSilver();
        ctx.shapersPanel?.syncAll();
        ctx.nukeDrawer?.syncAll();
        ctx.topLcdBar?.refreshAll();
      },
    },
    ctx.drawerManager,
  );

  ctx.calibrationDrawer = new CalibrationDrawer(ctx.app, ctx.drawerManager);

  ctx.nukeDrawer = new NukeDrawer(ctx.app, {
    onToggleOpen: (open) => {
      if (open) {
        ctx.drawerManager.close();
      }
      ctx.navbar?.setNukeActive(open);
    },
    onEdit: () => {
      openers.openMatrixDrawer('macros');
    },
    onLocalParamChange: (idx, val) => {
      if (ctx.paramUpdate) {
        handleParamUpdate(idx, val, ctx.paramUpdate);
      }
      if (idx >= 363 && idx <= 428) {
        ctx.controllersPanel?.updateLabels();
      }
      if ((idx >= 271 && idx <= 278) || idx === 281 || idx === 282 || idx === 327 || idx === 328) {
        ctx.silverPanel?.updateSilver(idx);
      }
    },
  });
}
