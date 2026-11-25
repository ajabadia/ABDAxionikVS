import { describe, expect, it, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

if (!globalThis.document) {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event;
}

import { WebBridge } from '../src/bridge/WebBridge.js';
import { ParamIdx } from '../src/constants/paramIndices.js';
import { NukeDrawer } from '../src/ui/NukeDrawer.js';

describe('NukeDrawer (Bloque C — PerformanceDeck adapter)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('mounts overlay PerformanceDeck with 4 macros, 6 controllers, XY stick and toolbar', () => {
    const parent = document.createElement('div');
    const onToggleOpen = vi.fn();
    const onEdit = vi.fn();
    const setSpy = vi.spyOn(WebBridge, 'setParam').mockImplementation(() => {});

    const drawer = new NukeDrawer(parent, { onToggleOpen, onEdit });
    expect(parent.querySelectorAll('[data-slot-card]')).toHaveLength(10);
    expect(parent.querySelector('#nuke-engine-pills')).not.toBeNull();
    expect(parent.querySelector('#nuke-domain-pills')).not.toBeNull();
    expect(parent.querySelector('#nuke-active-target-badge')).not.toBeNull();

    drawer.open();
    expect(drawer.isOpen()).toBe(true);
    expect(onToggleOpen).toHaveBeenCalledWith(true);

    (parent.querySelector('[data-act="edit"]') as HTMLElement)?.click();
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(parent.querySelector('.abd-perf-edit-bar')).toBeNull();

    drawer.toggle();
    expect(drawer.isOpen()).toBe(false);
    expect(onToggleOpen).toHaveBeenCalledWith(false);
    expect(setSpy).not.toHaveBeenCalled();
    drawer.destroy();
  });

  it('syncs host updates without echoing writes and switches stick target cleanly', () => {
    const parent = document.createElement('div');
    vi.spyOn(WebBridge, 'getParam').mockImplementation((idx, def = 0) => {
      if (idx === ParamIdx.SoundNumVoices) return 12;
      if (idx === ParamIdx.AftertouchScale) return -12;
      if (idx === ParamIdx.FilterFreq) return 80;
      return def;
    });
    const setSpy = vi.spyOn(WebBridge, 'setParam').mockImplementation(() => {});

    const drawer = new NukeDrawer(parent);
    expect(parent.querySelector('[data-el="v-val"]')?.textContent).toBe('012');
    expect(parent.querySelector('[data-val-slot="4"]')?.textContent).toBe('-12');
    expect(parent.querySelector('#nuke-macro-knob-mount-1')?.getAttribute('data-param-index')).toBe(String(ParamIdx.FilterFreq));
    expect(parent.querySelector('[data-val-slot="0"]')?.textContent).toBe('80');

    drawer.updateParam(ParamIdx.SoundNumVoices, 18);
    expect(parent.querySelector('[data-el="v-val"]')?.textContent).toBe('018');
    expect(setSpy).not.toHaveBeenCalled();

    (parent.querySelector('#nuke-engine-pills [data-engine="silver"]') as HTMLElement)?.click();
    expect(parent.querySelector('#nuke-active-target-badge')?.textContent).toBe('SILVER • FILTER');
    expect((parent.querySelector('#nuke-domain-group') as HTMLElement)?.style.pointerEvents).toBe('none');
    expect(parent.querySelector('#nuke-central-stick-mount')?.getAttribute('data-param-x')).toBe(String(ParamIdx.FilterFreq));
    drawer.destroy();
  });
});
