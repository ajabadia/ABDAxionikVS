/**
 * @vitest-environment jsdom
 *
 * Gesto de automatización del host desde la WebUI.
 *
 * Cada control arrastrable debe abrir el gesto del parámetro que gobierna al
 * agarrarlo y cerrarlo al soltarlo. Sin esa pareja el DAW graba un punto por
 * PARAM_SET (cientos por arrastre) y el undo no revierte el movimiento.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Knob, MultiStageShaperPad, Wheel } from '@abdsynths/shared/components';
import { WebBridge } from '../WebUI/src/bridge/WebBridge.js';
import { ParamIdx } from '../WebUI/src/constants/paramIndices.js';
import { gestureFor, gestureForGroup } from '../WebUI/src/ui/paramGesture.js';
import { BlenderPanel } from '../WebUI/src/ui/BlenderPanel.js';
import { EnvelopeMasterPanel } from '../WebUI/src/ui/EnvelopeMasterPanel.js';
import { EnvelopeDrawer } from '../WebUI/src/ui/EnvelopeDrawer.js';
import { FilterPanel } from '../WebUI/src/ui/FilterPanel.js';
import { MatrixDrawer, resolveParamIndexFromModDest } from '../WebUI/src/ui/MatrixDrawer.js';
import { NukeDrawer } from '../WebUI/src/ui/NukeDrawer.js';
import { ShapersPanel } from '../WebUI/src/ui/ShapersPanel.js';
import { SilverPanel } from '../WebUI/src/ui/SilverPanel.js';

type Gesture = { kind: 'begin' | 'end'; index: number };

const FREE_ENV_CONTOUR = [
  ParamIdx.FreeEnvTime1, ParamIdx.FreeEnvTime2, ParamIdx.FreeEnvTime3, ParamIdx.FreeEnvTime4,
  ParamIdx.FreeEnvLevel1, ParamIdx.FreeEnvLevel2, ParamIdx.FreeEnvLevel3, ParamIdx.FreeEnvLevel4,
];

let gestures: Gesture[] = [];
let restoreSpies: Array<() => void> = [];

const begins = () => gestures.filter((g) => g.kind === 'begin').map((g) => g.index);
const ends = () => gestures.filter((g) => g.kind === 'end').map((g) => g.index);

/** Evento de puntero: jsdom no siempre trae PointerEvent, pero el tipo importa. */
function firePointer(el: Element, type: string, init: MouseEventInit = {}) {
  const options = { bubbles: true, cancelable: true, ...init };
  const event =
    typeof PointerEvent !== 'undefined'
      ? new PointerEvent(type, { ...options, pointerId: 1 } as PointerEventInit)
      : new MouseEvent(type, options);
  el.dispatchEvent(event);
}

/** Agarra, mueve y suelta: el gesto completo de un arrastre real. */
function drag(el: Element) {
  firePointer(el, 'pointerdown', { clientX: 60, clientY: 60 });
  firePointer(el, 'pointermove', { clientX: 60, clientY: 30 });
  firePointer(el, 'pointerup', { clientX: 60, clientY: 30 });
}

beforeAll(() => {
  // El arrastre del pad captura el puntero; jsdom no lo implementa.
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
});

beforeEach(() => {
  gestures = [];
  // Se anota lo que SALE al host, no las llamadas internas: el puente absorbe
  // los begin/end duplicados (dos arrastres, o el cierre por captura del
  // pointerup además del propio control) y solo debe llegar una pareja.
  const sendSpy = vi.spyOn(WebBridge, 'send').mockImplementation((message) => {
    if (message.type === 'PARAM_GESTURE_BEGIN') gestures.push({ kind: 'begin', index: message.index });
    if (message.type === 'PARAM_GESTURE_END') gestures.push({ kind: 'end', index: message.index });
  });
  restoreSpies = [() => sendSpy.mockRestore()];
});

afterEach(() => {
  WebBridge.endAllGestures();
  for (const restore of restoreSpies) restore();
  restoreSpies = [];
  document.body.innerHTML = '';
});

function mount(html = ''): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
}

describe('paramGesture', () => {
  it('gestureFor abre y cierra exactamente su parámetro', () => {
    const gesture = gestureFor(ParamIdx.FilterFreq);
    gesture.onDragStart();
    gesture.onDragEnd();

    expect(gestures).toEqual([
      { kind: 'begin', index: ParamIdx.FilterFreq },
      { kind: 'end', index: ParamIdx.FilterFreq },
    ]);
    expect(WebBridge.hasOpenGestures).toBe(false);
  });

  it('gestureForGroup abre y cierra todos los parámetros del grupo', () => {
    const gesture = gestureForGroup(FREE_ENV_CONTOUR);
    gesture.onDragStart();
    expect(WebBridge.hasOpenGestures).toBe(true);
    gesture.onDragEnd();

    expect(begins()).toEqual(FREE_ENV_CONTOUR);
    expect(ends()).toEqual(FREE_ENV_CONTOUR);
    expect(WebBridge.hasOpenGestures).toBe(false);
  });
});

describe('controles arrastrables de @abdsynths/shared', () => {
  it('el Knob abre y cierra el gesto de su parámetro', () => {
    const host = mount();
    new Knob(host, { value: 0.5, ...gestureFor(ParamIdx.FilterFreq) });

    const dial = host.querySelector('.abd-knob__dial');
    expect(dial).not.toBeNull();
    drag(dial!);

    expect(begins()).toEqual([ParamIdx.FilterFreq]);
    expect(ends()).toEqual([ParamIdx.FilterFreq]);
  });

  it('la Wheel abre y cierra el gesto de su parámetro', () => {
    const host = mount();
    new Wheel(host, { type: 'mod', label: 'S1 A', ...gestureFor(ParamIdx.FilterReso) });

    const sprite = host.querySelector('.kbd-wheel-sprite');
    expect(sprite).not.toBeNull();
    drag(sprite!);

    expect(begins()).toEqual([ParamIdx.FilterReso]);
    expect(ends()).toEqual([ParamIdx.FilterReso]);
  });

  it('el pad MultiStage abre y cierra los ocho parámetros del contorno', () => {
    const host = mount();
    new MultiStageShaperPad(host, { editable: true, ...gestureForGroup(FREE_ENV_CONTOUR) });

    const handle = host.querySelector('.shaper-handle-group');
    expect(handle).not.toBeNull();
    drag(handle!);

    expect(begins()).toEqual(FREE_ENV_CONTOUR);
    expect(ends()).toEqual(FREE_ENV_CONTOUR);
  });
});

describe('barrido de los paneles montados', () => {
  it('todo control arrastrable abre el gesto de su parámetro y lo cierra', () => {
    const root = mount();
    new FilterPanel(root, {});
    new BlenderPanel(root, {});
    new EnvelopeMasterPanel(root, {});
    new SilverPanel(root, {});
    new ShapersPanel(root, {});

    const surfaces = Array.from(
      root.querySelectorAll('.abd-knob__dial, .kbd-wheel-sprite'),
    );
    expect(surfaces.length).toBeGreaterThan(20);

    const withoutGesture: string[] = [];
    for (const surface of surfaces) {
      gestures = [];
      drag(surface);

      const opened = begins();
      if (opened.length === 0) {
        withoutGesture.push(surface.className || surface.tagName);
        continue;
      }
      // Cierra exactamente lo que abrió, aunque sean varios (pad/selector).
      expect(ends()).toEqual(opened);

      const declared = surface.closest('[data-param-index]')?.getAttribute('data-param-index');
      if (declared !== null && declared !== undefined) {
        expect(opened).toEqual([Number(declared)]);
      }
    }

    expect(withoutGesture).toEqual([]);
    expect(WebBridge.hasOpenGestures).toBe(false);
  });
});

describe('controles cuyo parámetro depende de un selector', () => {
  it('los cuatro macro knobs del <NUKE> abren el gesto del destino elegido', () => {
    const root = mount();
    new NukeDrawer(root, {});

    // Destinos por defecto de los 4 mandos: 61, 56, 32, 62.
    const expected = [61, 56, 32, 62].map((destId) => resolveParamIndexFromModDest(destId));

    for (let knob = 1; knob <= 4; knob++) {
      const dial = root.querySelector(
        `#nuke-macro-knob-mount-${knob} .abd-knob__dial`,
      ) as HTMLElement | null;
      expect(dial, `macro knob ${knob} sin montar`).not.toBeNull();

      gestures = [];
      drag(dial!);
      expect(begins()).toEqual([expected[knob - 1]]);
      expect(ends()).toEqual([expected[knob - 1]]);
    }
  });

  it('los cuatro macro knobs del Matrix abren el gesto del destino elegido', () => {
    const root = mount();
    const content = MatrixDrawer.createContent({ onClose: () => {} });
    root.appendChild(content);

    const expected = [61, 56, 32, 62].map((destId) => resolveParamIndexFromModDest(destId));

    for (let knob = 0; knob < 4; knob++) {
      const dial = content.querySelector(
        `#matrix-macro-knob-mount-${knob} .abd-knob__dial`,
      ) as HTMLElement | null;
      expect(dial, `macro knob ${knob} sin montar`).not.toBeNull();

      gestures = [];
      drag(dial!);
      expect(begins()).toEqual([expected[knob]]);
      expect(ends()).toEqual([expected[knob]]);
    }
  });

  it('el pad 4L/4T del EnvelopeDrawer abre y cierra los ocho FreeEnv', () => {
    const root = mount();
    const content = EnvelopeDrawer.createContent({ onClose: () => {}, initialTab: '4l4t' });
    root.appendChild(content);

    const handle = content.querySelector(
      '#env-4l4t-pad-mount .shaper-handle-group',
    ) as HTMLElement | null;
    expect(handle).not.toBeNull();

    drag(handle!);
    expect(begins()).toEqual(FREE_ENV_CONTOUR);
    expect(ends()).toEqual(FREE_ENV_CONTOUR);
    expect(WebBridge.hasOpenGestures).toBe(false);
  });
});

describe('red de seguridad del puente', () => {
  it('cierra el gesto huérfano cuando el puntero se suelta fuera del control', () => {
    WebBridge.beginGesture(ParamIdx.FilterFreq);
    expect(WebBridge.hasOpenGestures).toBe(true);

    // El control nunca recibe su pointerup (arrastre que acaba fuera).
    document.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));

    expect(WebBridge.hasOpenGestures).toBe(false);
    expect(ends()).toContain(ParamIdx.FilterFreq);
  });

  it('no reenvía un end suelto ni abre dos veces el mismo gesto', () => {
    WebBridge.beginGesture(ParamIdx.FilterFreq);
    WebBridge.beginGesture(ParamIdx.FilterFreq);
    WebBridge.endGesture(ParamIdx.FilterFreq);
    WebBridge.endGesture(ParamIdx.FilterFreq);

    expect(begins()).toEqual([ParamIdx.FilterFreq]);
    expect(ends()).toEqual([ParamIdx.FilterFreq]);
  });
});
