/**
 * ABDAxionikVS — app/keyboardStrip.ts
 * On-screen keyboard: note/pitch/mod/aftertouch/panic/sustain plumbing
 * straight into the bridge. Panel readouts resolve lazily through ctx.
 */
import { KeyboardStrip } from '../ui/KeyboardStrip.js';
import { WebBridge } from '../bridge/WebBridge.js';
import type { AppCtx } from './context.js';

export function setupKeyboardStrip(ctx: AppCtx, mount: HTMLElement): void {
  new KeyboardStrip(mount, {
    onNotePress: (midiNote, velocity) => {
      WebBridge.noteOn(midiNote, velocity ?? 0.85);
    },
    onNoteRelease: (midiNote) => {
      WebBridge.noteOff(midiNote);
      ctx.controllersPanel?.setAftertouchLevel(0);
    },
    onPitchBend: (val) => {
      WebBridge.pitchBend(val);
    },
    onModWheel: (val) => {
      WebBridge.modWheel(val);
    },
    onAftertouch: (val) => {
      const norm = val > 1.0 ? val / 127.0 : val;
      ctx.controllersPanel?.setAftertouchLevel(norm);
      WebBridge.channelPressure(Math.round(norm * 127));
    },
    onPanic: () => {
      ctx.controllersPanel?.setAftertouchLevel(0);
      WebBridge.allNotesOff();
    },
    onSustainChange: (active) => {
      const raw = active ? 127 : 0;
      ctx.controllersPanel?.setPedalLevel(active ? 1.0 : 0.0);
      WebBridge.sendMidiCC(64, raw);
      WebBridge.sendMidiCC(4, raw);
    },
  });
}
