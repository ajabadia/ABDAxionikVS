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
import { BlenderDrawer } from '../WebUI/src/ui/BlenderDrawer.js';
import { BlenderPanel } from '../WebUI/src/ui/BlenderPanel.js';
import { ControllersPanel } from '../WebUI/src/ui/ControllersPanel.js';
import { EffectsDrawer } from '../WebUI/src/ui/EffectsDrawer.js';
import { EnvelopeMasterPanel } from '../WebUI/src/ui/EnvelopeMasterPanel.js';
import { EnvelopeDrawer } from '../WebUI/src/ui/EnvelopeDrawer.js';
import { FilterPanel } from '../WebUI/src/ui/FilterPanel.js';
import { MasterOutputPanel } from '../WebUI/src/ui/MasterOutputPanel.js';
import { MatrixDrawer, resolveParamIndexFromModDest } from '../WebUI/src/ui/MatrixDrawer.js';
import { NukeDrawer } from '../WebUI/src/ui/NukeDrawer.js';
import { ResynatorDrawer } from '../WebUI/src/ui/ResynatorDrawer.js';
import { SettingsDrawer } from '../WebUI/src/ui/SettingsDrawer.js';
import { ShapersPanel } from '../WebUI/src/ui/ShapersPanel.js';
import { SilverPanel } from '../WebUI/src/ui/SilverPanel.js';
import { TrajectoryStick2D } from '../WebUI/src/ui/TrajectoryStick2D.js';

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

/**
 * Superficies que se agarran para mover un parámetro. Los sticks entran como
 * `.stick-pad-circle`: un solo arrastre mueve dos ejes (dos parámetros).
 */
const DRAGGABLE_SELECTOR =
  '.abd-knob__dial, .abd-rotary-led__dial, .kbd-wheel-sprite, .shaper-handle-group, .stick-pad-circle';

/** Un pad de envolvente solo es arrastrable si dibujó sus zonas de agarre. */
function isDraggable(surface: Element): boolean {
  if (surface.classList.contains('shaper-handle-group')) {
    return surface.querySelector('.shaper-handle-hit') !== null;
  }
  return true;
}

/**
 * Controles arrastrables que NO gobiernan ningún parámetro del APVTS, así que
 * no pueden abrir gesto: el volumen master viaja por SET_MASTER_VOLUME y el
 * stick de Control 1 emite pitch bend / CC. Se comprueban aparte, más abajo.
 */
const NON_PARAM_SURFACES =
  '#master-vol-knob-mount, #ctrl1-stick-mount, #ctrl2-wheel-mount, #ctrl3-wheel-mount';

/** Etiqueta legible de una superficie, para que un fallo diga cuál es. */
function describeSurface(surface: Element): string {
  const container = surface.closest('[data-param-index]');
  const declared = container?.getAttribute('data-param-index');
  const id = container?.id || surface.closest('[id]')?.id || '';
  return `${surface.tagName.toLowerCase()}${id ? `#${id}` : ''}${declared ? ` [${declared}]` : ''}`;
}

describe('barrido de paneles y drawers montados', () => {
  it('todo control arrastrable de un parámetro abre su gesto y lo cierra', () => {
    const root = mount();
    new FilterPanel(root, {});
    new BlenderPanel(root, {});
    new EnvelopeMasterPanel(root, {});
    new SilverPanel(root, {});
    new ShapersPanel(root, {});
    new MasterOutputPanel(root);
    new ControllersPanel(root, {});
    new NukeDrawer(root, {});
    root.appendChild(MatrixDrawer.createContent({ onClose: () => {} }));
    root.appendChild(EnvelopeDrawer.createContent({ onClose: () => {}, initialTab: '4l4t' }));
    root.appendChild(BlenderDrawer.createContent({ onClose: () => {} }));
    root.appendChild(EffectsDrawer.createContent({ onClose: () => {}, initialBlock: 'silver' }));
    root.appendChild(ResynatorDrawer.createContent({ resynator: 1, modelName: 'TEST', onClose: () => {} }));
    root.appendChild(
      SettingsDrawer.createContent({
        onClose: () => {},
        onConfigureFolder: () => {},
        onSelectTheme: () => {},
        onZoom: () => {},
      }),
    );

    const surfaces = Array.from(root.querySelectorAll(DRAGGABLE_SELECTOR)).filter(
      (surface) => !surface.closest(NON_PARAM_SURFACES) && isDraggable(surface),
    );
    expect(surfaces.length).toBeGreaterThan(40);
    // Los sticks de Resynator (SCAPE/SPHERE), Silver y del <NUKE> están montados.
    expect(root.querySelectorAll('#silver-stick-mount .stick-pad-circle').length).toBe(1);
    expect(root.querySelectorAll('#nuke-central-stick-mount .stick-pad-circle').length).toBe(1);

    const withoutGesture: string[] = [];
    for (const surface of surfaces) {
      gestures = [];
      drag(surface);

      const opened = begins();
      if (opened.length === 0) {
        withoutGesture.push(describeSurface(surface));
        continue;
      }
      // Cierra exactamente lo que abrió, aunque sean varios (pad/stick/selector).
      expect(ends(), describeSurface(surface)).toEqual(opened);

      const declared = surface.closest('[data-param-index]')?.getAttribute('data-param-index');
      if (declared !== null && declared !== undefined) {
        expect(opened, describeSurface(surface)).toEqual([Number(declared)]);
      }
    }

    expect(withoutGesture).toEqual([]);
    expect(WebBridge.hasOpenGestures).toBe(false);
  });

  it('los controles sin parámetro del APVTS no abren gesto', () => {
    const root = mount();
    new MasterOutputPanel(root);
    new ControllersPanel(root, {});

    // Volumen master: viaja por SET_MASTER_VOLUME, no por el APVTS.
    const masterDial = root.querySelector('#master-vol-knob-mount .abd-rotary-led__dial');
    expect(masterDial, 'falta el mando de volumen master').not.toBeNull();
    drag(masterDial!);
    expect(begins()).toEqual([]);

    // Control 1: pitch bend y CC. Control 2 y 3: sendMidiCC.
    for (const selector of [
      '#ctrl1-stick-mount .stick-pad-circle',
      '#ctrl2-wheel-mount .kbd-wheel-sprite',
      '#ctrl3-wheel-mount .kbd-wheel-sprite',
    ]) {
      const surface = root.querySelector(selector);
      expect(surface, `falta ${selector}`).not.toBeNull();
      drag(surface!);
      expect(begins(), selector).toEqual([]);
    }

    expect(WebBridge.hasOpenGestures).toBe(false);
  });
});

describe('sticks 2D', () => {
  it('un arrastre del stick abre y cierra los dos ejes a la vez', () => {
    const root = mount();
    const params = [ParamIdx.R1L1Scape1Value, ParamIdx.R1L1Scape2Value];
    new TrajectoryStick2D(root, {
      label: 'SCAPE 1',
      numLayers: 3,
      ...gestureForGroup(params),
    });

    const pad = root.querySelector('.stick-pad-circle');
    expect(pad).not.toBeNull();
    drag(pad!);

    expect(begins()).toEqual(params);
    expect(ends()).toEqual(params);
    expect(WebBridge.hasOpenGestures).toBe(false);
  });

  it('un stick sin callbacks de gesto sigue moviendo su posición', () => {
    // El componente compartido es agnóstico: sin ganchos no inventa gestos.
    const root = mount();
    const positions: Array<[number, number]> = [];
    new TrajectoryStick2D(root, {
      label: 'SPHERE 1',
      numLayers: 3,
      onPositionChange: (layerIdx, coord) => positions.push([layerIdx, coord.x]),
    });

    drag(root.querySelector('.stick-pad-circle')!);

    expect(positions.length).toBeGreaterThan(0);
    expect(gestures).toEqual([]);
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

  it('el gesto del macro knob sigue al selector cuando cambia el destino', () => {
    const root = mount();
    const content = MatrixDrawer.createContent({ onClose: () => {} });
    root.appendChild(content);

    const dial = content.querySelector('#matrix-macro-knob-mount-0 .abd-knob__dial');
    const select = content.querySelector('#matrix-macro-select-0') as HTMLSelectElement | null;
    expect(dial, 'macro knob 0 sin montar').not.toBeNull();
    expect(select, 'selector del macro knob 0 sin montar').not.toBeNull();

    const newDestId = 20;
    const expected = resolveParamIndexFromModDest(newDestId);
    expect(expected).not.toBe(resolveParamIndexFromModDest(61));

    select!.value = String(newDestId);
    select!.dispatchEvent(new Event('change'));

    gestures = [];
    drag(dial!);
    expect(begins()).toEqual([expected]);
    expect(ends()).toEqual([expected]);
    expect(WebBridge.hasOpenGestures).toBe(false);
  });

  it('el gesto del orbe del <NUKE> sigue al destino vigente y a la capa activa', () => {
    const root = mount();
    new NukeDrawer(root, {});

    const pad = root.querySelector('#nuke-central-stick-mount .stick-pad-circle') as HTMLElement | null;
    expect(pad, 'orbe del <NUKE> sin montar').not.toBeNull();

    // Capa 1 (R1 · SPHERE): el par X/Y lo resuelve el propio drawer.
    const layer1 = [ParamIdx.R1L2Sphere1Value, ParamIdx.R1L2Sphere2Value];
    root.querySelector('#nuke-central-stick-mount [data-layer="1"]')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );

    gestures = [];
    drag(pad!);
    expect(begins()).toEqual(layer1);
    expect(ends()).toEqual(layer1);
    expect(WebBridge.hasOpenGestures).toBe(false);
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
