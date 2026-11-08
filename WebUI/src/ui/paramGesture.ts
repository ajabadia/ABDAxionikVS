/**
 * ABDAxionikVS — paramGesture.ts
 *
 * Cableado único entre un control con arrastre (Knob, Slider, FilmstripFader,
 * RotaryLedKnob de `@abdsynths/shared/components`) y el gesto de automatización
 * del host.
 *
 * Los componentes compartidos son agnósticos al puente a propósito: exponen
 * `onDragStart` / `onDragEnd` y dejan que el host decida qué significan. Un
 * arrastre de 400 px emite cientos de `onChange` —y por tanto cientos de
 * PARAM_SET—, pero para el DAW es UN gesto: sin `beginChangeGesture` /
 * `endChangeGesture` graba un punto por paso y el undo no revierte el
 * movimiento completo.
 *
 * Uso:
 *   new Knob(el, { ...gestureFor(ParamIdx.FilterFreq), onChange: ... });
 */
import { WebBridge } from '../bridge/WebBridge.js';

export interface ParamGestureHandlers {
  onDragStart: () => void;
  onDragEnd: () => void;
}

/**
 * Devuelve los callbacks de gesto para el parámetro `index`, listos para
 * esparcir en las opciones de cualquier control arrastrable.
 */
export function gestureFor(index: number): ParamGestureHandlers {
  return {
    onDragStart: () => WebBridge.beginGesture(index),
    onDragEnd: () => WebBridge.endGesture(index),
  };
}

/**
 * Gestos para un control que gobierna VARIOS parametros a la vez (el pad de
 * una envolvente 4L/4T mueve ocho). El host empareja begin/end por parametro,
 * asi que se abren y se cierran todos: el arrastre entero cuenta como un unico
 * cambio en cada uno y el undo revierte el movimiento completo.
 */
export function gestureForGroup(indices: readonly number[]): ParamGestureHandlers {
  return {
    onDragStart: () => {
      for (const index of indices) WebBridge.beginGesture(index);
    },
    onDragEnd: () => {
      for (const index of indices) WebBridge.endGesture(index);
    },
  };
}
