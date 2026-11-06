/**
 * ABDAxionikVS — app/bridgeSubscriptions.ts
 * Inbound traffic: local param edits fan out through the shared PARAM_UPDATE
 * handler, and host messages (catalog, preset loads, telemetry, engine-mode
 * changes, expanded-model preflights, MIDI learn/activity, hardware dumps)
 * land on the panels that own them.
 */
import { WebBridge } from '../bridge/WebBridge.js';
import { getCanonicalModelName } from '../ui/NeuronCatalogMetadata.js';
import type { HardwareHostEvent } from '../ui/hardwareDumpsContracts.js';
import { handleParamUpdate } from './paramUpdate.js';
import type { AppCtx } from './context.js';
import { applyAllParamsToUI } from './presetApply.js';
import { normalizeHostCompileTarget, normalizeHostEngineMode } from './engineMode.js';

export function subscribeBridge(ctx: AppCtx): void {
  // Suscribir cambios locales de parámetros (cualquier knob/stick/selector o edición desde el propio LCD)
  WebBridge.onLocalParamSet((idx, val) => {
    if (ctx.paramUpdate) {
      handleParamUpdate(idx, val, ctx.paramUpdate);
    }
    ctx.topLcdBar?.onParamUpdated(idx, val, true);
    ctx.hardwareDumpsDrawer?.onParamUpdated();
    if (idx >= 363 && idx <= 428) {
      ctx.controllersPanel?.updateLabels();
    }
  });

  // Suscribir telemetría y actualización de parámetros del bridge nativo
  WebBridge.onMessage((msg) => {
    if (msg.type === 'BANK_CATALOG_SYNC') {
      // El payload viaja sin tipar por el bridge; se adapta a la forma que espera BankDrawer.
      ctx.bankDrawer?.syncCatalogFromHost(msg as Parameters<NonNullable<AppCtx['bankDrawer']>['syncCatalogFromHost']>[0]);
    } else if (msg.type === 'PRESET_LOADED') {
      if (typeof msg.name === 'string' && msg.name) {
        ctx.state.currentPresetName = msg.name;
        ctx.navbar?.setPresetName(msg.name);
        ctx.topLcdBar?.setPresetInfo(0, msg.name);
      }
      const r1 = typeof msg.r1Model === 'number' ? msg.r1Model : 511;
      const r2 = typeof msg.r2Model === 'number' ? msg.r2Model : 511;
      const r1Name = getCanonicalModelName(r1);
      const r2Name = getCanonicalModelName(r2);
      ctx.resynator?.syncModel(1, r1, r1Name);
      ctx.resynator?.syncModel(2, r2, r2Name);

      if (Array.isArray(msg.values)) {
        applyAllParamsToUI(ctx, msg.values);
      }
      ctx.controllersPanel?.updateLabels();
      ctx.silverPanel?.updateSilver();
      ctx.shapersPanel?.syncAll();
      ctx.nukeDrawer?.syncAll();
      ctx.topLcdBar?.refreshAll();
      ctx.hardwareDumpsDrawer?.refreshLiveInspector();
      ctx.navbar?.setHardwareDumpsUnread(ctx.hardwareDumpsDrawer?.getUnreadCount() ?? 0);
    } else if (msg.type === 'TELEMETRY') {
      if (typeof msg.activeVoices === 'number') {
        ctx.navbar?.setVoices(msg.activeVoices);
        ctx.topLcdBar?.setVoices(msg.activeVoices);
      }
      if (typeof msg.cpuUsage === 'number') ctx.navbar?.setCpuLoad(msg.cpuUsage);
    } else if (msg.type === 'PARAM_UPDATE') {
      if (ctx.paramUpdate) {
        handleParamUpdate(msg.index, msg.value, ctx.paramUpdate);
      }
      ctx.topLcdBar?.onParamUpdated(msg.index, msg.value, true);
      ctx.hardwareDumpsDrawer?.onParamUpdated();
      if (msg.index >= 363 && msg.index <= 428) {
        ctx.controllersPanel?.updateLabels();
      }
      if ((msg.index >= 271 && msg.index <= 278) || msg.index === 281 || msg.index === 282 || msg.index === 327 || msg.index === 328) {
        ctx.silverPanel?.updateSilver(msg.index);
        if (msg.index === 271) {
          ctx.silverPanel?.updateSilverToggle(msg.value > 0.5);
        }
      }
    } else if (msg.type === 'ENGINE_MODE_CHANGED') {
      const normMode = normalizeHostEngineMode(msg.mode);
      const normCompile = normalizeHostCompileTarget((msg as { compileTargetMode?: unknown }).compileTargetMode);
      ctx.navbar?.setEngineMode(normMode, normCompile);
      ctx.bankDrawer?.setEngineMode(normMode);
    } else if (msg.type === 'EXPANDED_MODEL_PREFLIGHT') {
      const rSlot: 1 | 2 = msg.resynator === 2 ? 2 : 1;
      if (msg.ok) {
        const mName = String(msg.modelName || 'Expanded Model');
        const adaptCount = Number(msg.adaptationsCount || 0);
        ctx.resynator?.updateModelUI(rSlot, 900 + rSlot, `[EXP] ${mName}`);
        ctx.navbar?.setModelName(rSlot, `[EXP] ${mName}`);
        ctx.dragDropHandler?.showToast(
          adaptCount > 0
            ? `[RESYNATOR ${rSlot} V2] Loaded "${mName}" (${adaptCount} adaptations applied)`
            : `[RESYNATOR ${rSlot} V2] Loaded "${mName}"`,
          3600
        );
      } else {
        const errText = String(msg.firstError || 'Preflight rejected model');
        ctx.dragDropHandler?.showToast(`[PREFLIGHT BLOCKED R${rSlot}] ${errText}`, 4800);
      }
    } else if (msg.type === 'MIDI_LEARN_STATE') {
      ctx.midiLearnStore?.syncFromHost(msg as any);
    } else if (msg.type === 'MIDI_ACTIVITY') {
      ctx.midiLearnStore?.recordActivity(msg as any);
    } else if (typeof msg.type === 'string' && msg.type.startsWith('HARDWARE_')) {
      ctx.hardwareDumpsDrawer?.onMessage(msg as unknown as HardwareHostEvent);
      if (msg.type === 'HARDWARE_RX_COMPLETE' && msg.count != null && typeof msg.count === 'number') {
        ctx.navbar?.setHardwareDumpsUnread(msg.count);
      }
    }
  });
}
