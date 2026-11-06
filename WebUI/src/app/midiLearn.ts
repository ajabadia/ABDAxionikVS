/**
 * ABDAxionikVS — app/midiLearn.ts
 * Canonical N:M MIDI Learn & CC/NRPN mapping matrix (ABDShared): store,
 * drawer content, UI attach and host sync. Registers its drawer for
 * locale-change re-render.
 */
import {
  createMidiLearnStore,
  attachMidiLearnUI,
  createMidiLearnDrawerContent,
} from '@abdsynths/shared/components';
import { WebBridge } from '../bridge/WebBridge.js';
import { PARAM_DEFINITIONS } from '../generated/parameters.gen.js';
import type { AppCtx, MidiLearnStore } from './context.js';

export function setupMidiLearn(ctx: AppCtx): MidiLearnStore {
  const midiLearnParameters = PARAM_DEFINITIONS.map((p) => ({
    index: p.index,
    name: p.vstDisplay || p.key,
    group: p.group,
    key: p.key,
  }));

  const store = createMidiLearnStore({
    storageKey: 'abd.axionik.midiLearn.v1',
    onSyncToHost: (payload) => {
      WebBridge.send({
        type: 'MIDI_LEARN_SYNC',
        mappings: payload.mappings,
        learningTargetIndex: payload.learningTargetIndex,
        learningTargetKey: payload.learningTargetKey,
        learnMode: payload.learnMode,
      });
    },
    onApplyParam: (targetIndex, _targetKey, normVal) => {
      const def = PARAM_DEFINITIONS[targetIndex];
      const min = def ? def.min : 0;
      const max = def ? def.max : 127;
      const rawVal = Math.round(min + normVal * (max - min));
      WebBridge.setParam(targetIndex, rawVal);
    },
  });

  const openMidiLearnDrawer = (focusParamIndex = -1) => {
    const content = createMidiLearnDrawerContent({
      store,
      parameters: midiLearnParameters,
      focusParamIndex,
      synthName: 'ABDAxionikVS',
      onClose: () => ctx.drawerManager.close(),
    });
    ctx.drawerManager.openCustom('midi-learn-matrix', content);
  };

  attachMidiLearnUI({
    store,
    root: ctx.app,
    getParamMeta: (idx) => {
      const def = PARAM_DEFINITIONS[idx];
      return def
        ? { name: def.vstDisplay || def.key, group: def.group, key: def.key }
        : { name: `Parameter #${idx}`, group: 'Synth', key: `param_${idx}` };
    },
    onOpenDrawer: (focusIdx) => {
      openMidiLearnDrawer(focusIdx ?? -1);
    },
  });

  store.subscribe((st: any) => {
    ctx.navbar?.setMidiLearnState(Boolean(st.isLearning), st.mappings?.length ?? 0, st.learnRemainingSeconds ?? 0);
  });

  ctx.drawerReopen['midi-learn-matrix'] = () => openMidiLearnDrawer();
  return store;
}
