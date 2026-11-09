/**
 * ABDAxionikVS — paramGesture.ts
 *
 * El cableado del gesto vive en `@abdsynths/shared/components/paramGesture.js`,
 * igual para toda la familia: un arrastre es UN gesto para el DAW. Este
 * fichero sólo le entrega el puente de ABDAxionik, así que los sitios de
 * llamada no cambian:
 *
 *   new Knob(el, { ...gestureFor(ParamIdx.FilterFreq), onChange: ... });
 *
 * El porqué (begin/end por parámetro, y por qué un control de varios
 * parámetros los abre todos) está documentado en el módulo compartido.
 */
import { createParamGestures } from '@abdsynths/shared/components/paramGesture.js';
import { WebBridge } from '../bridge/WebBridge.js';

export type { ParamGestureHandlers } from '@abdsynths/shared/components/paramGesture.js';

export const { gestureFor, gestureForGroup } = createParamGestures(WebBridge);
