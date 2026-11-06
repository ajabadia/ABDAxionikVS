/**
 * ABDAxionikVS — app/navbarSetup.ts
 * Universal synth navbar: folder/zip/preset file flows, preset save dialog,
 * init sound, bank/nuke/matrix/midi/dumps/calibration/mfx/settings toggles,
 * engine-mode and theme fan-out. Preset-object application and factory reset
 * delegate to presetApply; the .axpreset file flow only adds engine-mode
 * normalization on top.
 */
import { AxionikNavbar } from '../ui/Navbar.js';
import { PresetSaveDialog } from '../ui/PresetSaveDialog.js';
import { downloadPresetFile, parsePresetFile, type AxionikPreset } from '../ui/PresetModel.js';
import { getCanonicalModelName } from '../ui/NeuronCatalogMetadata.js';
import { WebBridge } from '../bridge/WebBridge.js';
import { ParamIdx } from '../constants/paramIndices.js';
import type { AppCtx } from './context.js';
import type { DrawerOpeners } from './drawerOpeners.js';
import { applyTheme, applyZoom } from './theme.js';
import { normalizePresetEngineMode, selectEngineMode, toUiEngineMode } from './engineMode.js';
import { applyLoadedPreset, initSound } from './presetApply.js';

/** Hidden `<input type=file>` picker; removes itself after selection. */
function pickFile(accept: string, onFile: (file: File) => void): void {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = accept;
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.remove();
    if (file) onFile(file);
  });
  fileInput.click();
}

export function createNavbar(ctx: AppCtx, openers: DrawerOpeners): AxionikNavbar {
  const navbar = new AxionikNavbar(ctx.navContainer, {
    onConfigureFolder: () => {
      ctx.bankDrawer?.promptConfigureFolder();
    },
    onImportModelFolder: () => {
      ctx.bankDrawer?.promptConfigureFolder();
    },
    onImportModelZip: () => {
      pickFile('.zip,.modelzip', (file) => {
        console.log(`[ABDAxionikVS] Model package selected: ${file.name}`);
      });
    },
    onLoadPreset: () => {
      pickFile('.axpreset,.json', (file) => {
        void (async () => {
          try {
            const preset = parsePresetFile(await file.text());
            if (preset) {
              // 1. Ajustar modo del motor segun el preset (conserva los modelos cargados)
              if (preset.engineMode) {
                const uiMode = toUiEngineMode(normalizePresetEngineMode(preset.engineMode));
                WebBridge.setEngineMode(uiMode);
                ctx.navbar?.setEngineMode(uiMode);
                ctx.bankDrawer?.setEngineMode(uiMode);
              }
              // 2+3. Cargar modelos y snapshot (igual que pick de banco)
              applyLoadedPreset(ctx, preset, ' desde archivo .axpreset');
            } else {
              // Si no es un .axpreset v2, abrir el drawer de banco habitual
              ctx.bankDrawer?.open('presets', 'global');
            }
          } catch (err) {
            console.error('[ABDAxionikVS] Error al leer preset:', err);
            ctx.bankDrawer?.open('presets', 'global');
          }
        })();
      });
    },
    onSavePreset: () => {
      const currentName = ctx.navbar ? ctx.navbar.getPresetName() : '000 InitSound';
      const dialog = new PresetSaveDialog({
        currentPresetName: currentName,
        onSave: (name, category, author) => {
          const currentEngineMode = ctx.navbar?.getEngineMode() || 'classic';
          const targetEngineMode: 'classic' | 'plus' | 'extended' =
            currentEngineMode === 'expanded' ? 'extended' : currentEngineMode;

          const r1Model = Math.round(WebBridge.getParam(ParamIdx.R1ModellIndex, 511));
          const r2Model = Math.round(WebBridge.getParam(ParamIdx.R2ModellIndex, 511));
          const r1Name = getCanonicalModelName(r1Model);
          const r2Name = getCanonicalModelName(r2Model);
          const extendedState =
            targetEngineMode === 'extended'
              ? {
                  r1ModelName: ctx.state.currentR1ModelName,
                  r2ModelName: ctx.state.currentR2ModelName,
                }
              : {};

          const preset: AxionikPreset = {
            formatVersion: 2,
            meta: {
              name,
              category,
              author,
              date: new Date().toISOString(),
            },
            engineMode: targetEngineMode,
            models: {
              resynator1: { id: r1Model, name: r1Name },
              resynator2: { id: r2Model, name: r2Name },
            },
            parameters: WebBridge.getAllCachedParams(),
            extendedState,
          };

          WebBridge.savePreset(preset, targetEngineMode);

          if (!WebBridge.isHostConnected) {
            downloadPresetFile(preset);
          }

          ctx.bankDrawer?.registerUserPreset(preset);

          ctx.navbar?.setPresetName(name);
          ctx.topLcdBar?.setPresetInfo(0, name);
          console.log(`[ABDAxionikVS] Preset "${name}" guardado como .axpreset (engineMode: ${preset.engineMode})`);
        },
      });
      dialog.open();
    },
    onInitPreset: () => {
      initSound(ctx);
    },
    onToggleBank: () => {
      ctx.bankDrawer?.toggle('models', 'global');
    },
    onToggleNuke: () => {
      ctx.nukeDrawer?.toggle();
    },
    onToggleMatrix: () => {
      openers.openMatrixDrawer();
    },
    onToggleMidiLearn: () => {
      ctx.drawerReopen['midi-learn-matrix']?.();
    },
    onToggleHardwareDumps: () => {
      ctx.hardwareDumpsDrawer?.toggle();
    },
    onToggleCalibration: () => {
      ctx.calibrationDrawer?.toggle();
    },
    onToggleMfx: () => {
      openers.openMasterFxDrawer();
    },
    onToggleSettings: () => {
      openers.openSettingsDrawer();
    },
    onSelectPreset: () => {
      ctx.bankDrawer?.open('presets', 'global');
    },
    onSelectModel: (resynator) => {
      ctx.state.targetResynatorForModelPick = resynator;
      ctx.bankDrawer?.open('models', resynator === 1 ? 'r1' : 'r2');
    },
    onSelectEngineMode: (mode) => {
      selectEngineMode(ctx, mode);
    },
    onSelectTheme: (theme) => {
      applyTheme(ctx, theme);
    },
    onToggleTheme: () => {
      const nextTheme = ctx.themeManager.cycleTheme();
      ctx.navbar?.setTheme(nextTheme);
    },
    onZoom: (zoomLevel) => {
      applyZoom(ctx, zoomLevel);
    },
  });

  // Sincronizar estado inicial de tema y zoom en la Navbar
  navbar.setTheme(ctx.themeManager.getCurrentTheme());
  navbar.setZoom(ctx.state.currentZoom);

  ctx.navbar = navbar;
  return navbar;
}
