/**
 * ABDAxionikVS — app/drawerOpeners.ts
 * Every expanded-drawer opener in one place. Each opener registers itself in
 * ctx.drawerReopen so the locale-change handler can re-render whichever
 * drawer is currently open without closing it.
 */
import { ResynatorDrawer } from '../ui/ResynatorDrawer.js';
import { EffectsDrawer, type EffectsDrawerBlock } from '../ui/EffectsDrawer.js';
import { BlenderDrawer } from '../ui/BlenderDrawer.js';
import { MatrixDrawer } from '../ui/MatrixDrawer.js';
import { EnvelopeDrawer, type EnvelopeDrawerTab } from '../ui/EnvelopeDrawer.js';
import { SettingsDrawer } from '../ui/SettingsDrawer.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import { applyTheme, applyZoom } from './theme.js';
import { selectEngineMode } from './engineMode.js';
import type { AppCtx } from './context.js';

export interface DrawerOpeners {
  openR1Drawer: () => void;
  openR2Drawer: () => void;
  openEffectsDrawer: (initialBlock?: EffectsDrawerBlock) => void;
  openFilterDrawer: () => void;
  openSilverDrawer: () => void;
  openMasterFxDrawer: () => void;
  openBlenderDrawer: () => void;
  openMatrixDrawer: (initialTab?: 'all' | 'controllers' | 'macros' | 'free') => void;
  openEnvelopeDrawer: (initialTab?: EnvelopeDrawerTab, initialShaper?: 1 | 2) => void;
  openSettingsDrawer: () => void;
  reopenCurrentDrawer: () => void;
}

export function createDrawerOpeners(ctx: AppCtx): DrawerOpeners {
  const resynator = () => ctx.resynator;

  const openR1Drawer = () => {
    const content = ResynatorDrawer.createContent({
      resynator: 1,
      modelName: ctx.state.currentR1ModelName,
      parameterSet: resynator()?.modelParameterSet(WebBridge.getParam(ParamIdx.R1ModellIndex, 511)) ?? -1,
      onClose: () => ctx.drawerManager.close(),
      onSelectModel: (r) => {
        ctx.state.targetResynatorForModelPick = r;
        ctx.bankDrawer?.open('models', 'r1');
      },
    });
    ctx.drawerManager.openCustom('r1-expanded', content);
  };

  const openR2Drawer = () => {
    const content = ResynatorDrawer.createContent({
      resynator: 2,
      modelName: ctx.state.currentR2ModelName,
      parameterSet: resynator()?.modelParameterSet(WebBridge.getParam(ParamIdx.R2ModellIndex, 511)) ?? -1,
      onClose: () => ctx.drawerManager.close(),
      onSelectModel: (r) => {
        ctx.state.targetResynatorForModelPick = r;
        ctx.bankDrawer?.open('models', 'r2');
      },
    });
    ctx.drawerManager.openCustom('r2-expanded', content);
  };

  const openEffectsDrawer = (initialBlock: EffectsDrawerBlock = 'filter') => {
    const content = EffectsDrawer.createContent({
      initialBlock,
      onClose: () => ctx.drawerManager.close(),
    });
    ctx.drawerManager.openCustom('effects-rack', content);
  };

  const openFilterDrawer = () => openEffectsDrawer('filter');
  const openSilverDrawer = () => openEffectsDrawer('silver');
  const openMasterFxDrawer = () => openEffectsDrawer('master');

  const openBlenderDrawer = () => {
    const content = BlenderDrawer.createContent({
      onClose: () => ctx.drawerManager.close(),
    });
    ctx.drawerManager.openCustom('blender-expanded', content);
  };

  const openMatrixDrawer = (initialTab: 'all' | 'controllers' | 'macros' | 'free' = 'all') => {
    const content = MatrixDrawer.createContent({
      initialTab,
      onClose: () => ctx.drawerManager.close(),
    });
    ctx.drawerManager.openCustom('matrix-expanded', content);
  };

  const openEnvelopeDrawer = (initialTab: EnvelopeDrawerTab = '4l4t', initialShaper: 1 | 2 = 1) => {
    const content = EnvelopeDrawer.createContent({
      initialShaper,
      initialTab,
      onClose: () => ctx.drawerManager.close(),
    });
    ctx.drawerManager.openCustom('envelope-expanded', content);
  };

  const openSettingsDrawer = () => {
    const content = SettingsDrawer.createContent({
      onClose: () => ctx.drawerManager.close(),
      onConfigureFolder: (bank) => ctx.bankDrawer?.promptConfigureFolder(bank),
      onSelectEngineMode: (mode) => {
        selectEngineMode(ctx, mode);
      },
      onSelectTheme: (theme) => {
        applyTheme(ctx, theme);
      },
      onZoom: (zoom) => {
        applyZoom(ctx, zoom);
      },
      currentTheme: ctx.themeManager.getCurrentTheme(),
      currentZoom: ctx.state.currentZoom,
    });
    ctx.drawerManager.openCustom('settings-expanded', content);
  };

  ctx.drawerReopen['r1-expanded'] = openR1Drawer;
  ctx.drawerReopen['r2-expanded'] = openR2Drawer;
  ctx.drawerReopen['effects-rack'] = () => openEffectsDrawer();
  ctx.drawerReopen['blender-expanded'] = openBlenderDrawer;
  ctx.drawerReopen['matrix-expanded'] = () => openMatrixDrawer();
  ctx.drawerReopen['envelope-expanded'] = () => openEnvelopeDrawer();
  ctx.drawerReopen['settings-expanded'] = openSettingsDrawer;

  // Re-render the open drawer reactively on language change without closing it.
  const reopenCurrentDrawer = () => {
    const curId = ctx.drawerManager.getCurrentDrawerId();
    if (!curId) return;
    ctx.drawerReopen[curId]?.();
  };

  return {
    openR1Drawer,
    openR2Drawer,
    openEffectsDrawer,
    openFilterDrawer,
    openSilverDrawer,
    openMasterFxDrawer,
    openBlenderDrawer,
    openMatrixDrawer,
    openEnvelopeDrawer,
    openSettingsDrawer,
    reopenCurrentDrawer,
  };
}
