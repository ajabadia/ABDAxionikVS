/**
 * Guard de dirección del canal nativo → JS de JUCE WebView2 — ABDAxionikVS.
 *
 * Misma lógica **compartida** por toda la suite
 * (`ABDShared/Code/WebView2Bridge/testing/webviewBridgeDirection.js`): en JUCE 8
 * `window.__JUCE__.backend.emitEvent(...)` es el canal JS → nativo, así que escribirlo
 * desde C++ descarta el mensaje en silencio; el canal nativo → JS es
 * `WebBrowserComponent::emitEventIfBrowserIsVisible(eventId, obj)`.
 *
 * Este host no emite del C++ hacia el WebUI: la WebUI pide estado con los
 * `withNativeFunction(...)` y el C++ responde llamando a su propia API de página
 * (`window.WebBridge.notify(...)` sobre `evaluateJavascript`), que es un uso legítimo
 * de `evaluateJavascript`. Por eso `EMITTERS` va vacío: lo que el guard protege es que
 * nadie introduzca el canal equivocado y que un emisor nuevo no se cuele sin declarar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it, expect } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const sourceRoot = path.join(repoRoot, 'Source');

// En CI los repos hermanos se clonan fuera del workspace y se enlazan como
// `node_modules/@abdsynths/shared`; en local suele existir el checkout hermano.
const helperCandidates = [
  path.join(repoRoot, 'node_modules/@abdsynths/shared/Code/WebView2Bridge/testing/webviewBridgeDirection.js'),
  path.resolve(repoRoot, '..', 'ABDShared/Code/WebView2Bridge/testing/webviewBridgeDirection.js'),
  path.resolve(repoRoot, '..', 'ABDSharedCode/WebView2Bridge/testing/webviewBridgeDirection.js')
];
const helperPath = helperCandidates.find(candidate => fs.existsSync(candidate));

if (!helperPath) {
  throw new Error(`Guard compartido no encontrado. Probado: ${helperCandidates.join(', ')}`);
}

const { checkBridgeDirection, formatFindings } = await import(pathToFileURL(helperPath).href);

/** Este host no emite del C++ hacia el WebUI (solo responde a funciones nativas). */
const EMITTERS = [];

describe('canal nativo → JS del WebView2 — guard de dirección (JUCE 8)', () => {
  it('ningún fichero C++ usa el canal equivocado ni emite sin declararlo', () => {
    const result = checkBridgeDirection({ sourceRoot, emitters: EMITTERS });

    expect(result.scanned).toBeGreaterThan(0);
    expect(formatFindings(result)).toMatch(/^OK/);
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('el host del WebView es el editor y no hay emisores escondidos', () => {
    const result = checkBridgeDirection({ sourceRoot, emitters: EMITTERS });

    expect(result.webViewHosts).toContain('PluginEditor.cpp');
    expect(result.undeclaredEmitters).toEqual([]);
  });

  it('responde a la WebUI con su API de página, no con el canal de JUCE', () => {
    const editor = fs.readFileSync(path.join(sourceRoot, 'PluginEditor.cpp'), 'utf8');

    expect(editor).toContain('window.WebBridge.notify');
    expect(editor).not.toContain('backend.emitEvent');
  });
});
