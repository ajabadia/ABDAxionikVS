/**
 * ABDAxionikVS — ejecuta el guard de dirección del canal WebView2 sobre `Source/`.
 *
 * En JUCE 8 hay dos canales y van en direcciones opuestas:
 *   - nativo → JS: `WebBrowserComponent::emitEventIfBrowserIsVisible(eventId, obj)`
 *     (el único que dispara los `window.__JUCE__.backend.addEventListener(...)`).
 *   - JS → nativo: `window.__JUCE__.backend.emitEvent(eventId, obj)`.
 *
 * Escribir el segundo desde C++ (típicamente con `evaluateJavascript`) no llega a
 * ningún listener del WebUI y **se descarta en silencio**.
 *
 * Este host no emite del C++ hacia el WebUI: la WebUI pide estado con los
 * `withNativeFunction(...)` y el C++ responde llamando a su propia API de página
 * (`window.WebBridge.notify(...)` sobre `evaluateJavascript`), que es un uso legítimo
 * de `evaluateJavascript`. Por eso `EMITTERS` va vacío: lo que el guard protege es que
 * nadie introduzca el canal equivocado y que un emisor nuevo no se cuele sin declarar.
 *
 * Corre con `node` pelado (no con vitest) para que el guard no dependa del estado del
 * suite de la WebUI: el job `bridge-guard` del CI lo lanza por separado.
 *
 * Uso:  node Tests/webviewBridgeDirectionTest.mjs
 *       (ABD_SHARED_ROOT permite apuntar al checkout de ABDShared en CI)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');
const sourceRoot = path.join(repoRoot, 'Source');

// En CI el repo hermano se clona fuera del workspace y se apunta con
// ABD_SHARED_ROOT; en local suele existir el checkout hermano o el enlace de npm.
const helperCandidates = [
  process.env.ABD_SHARED_ROOT &&
    path.join(process.env.ABD_SHARED_ROOT, 'Code/WebView2Bridge/testing/webviewBridgeDirection.js'),
  path.join(repoRoot, 'node_modules/@abdsynths/shared/Code/WebView2Bridge/testing/webviewBridgeDirection.js'),
  path.resolve(repoRoot, '..', 'ABDShared/Code/WebView2Bridge/testing/webviewBridgeDirection.js'),
  path.resolve(repoRoot, '..', 'ABDSharedCode/WebView2Bridge/testing/webviewBridgeDirection.js')
].filter(Boolean);

const helperPath = helperCandidates.find(candidate => fs.existsSync(candidate));

if (!helperPath) {
  console.error(`[guard webview2] no encuentro el guard compartido. Probado:\n  ${helperCandidates.join('\n  ')}`);
  process.exit(1);
}

const { checkBridgeDirection, formatFindings } = await import(pathToFileURL(helperPath).href);

/** Este host no emite del C++ hacia el WebUI (solo responde a funciones nativas). */
const EMITTERS = [];

const result = checkBridgeDirection({ sourceRoot, emitters: EMITTERS });

console.log(`[guard webview2] ${result.scanned} fuentes C++ revisados en Source/`);
console.log(`[guard webview2] ${formatFindings(result)}`);
console.log(
  `[guard webview2] hosts detectados: ${result.webViewHosts.join(', ') || '(ninguno)'}` +
    ` | emisores: ${EMITTERS.join(', ') || '(ninguno)'}`
);

// Si el árbol escaneado no es el esperado, el verde no significaría nada.
if (!result.webViewHosts.includes('PluginEditor.cpp')) {
  console.error('[guard webview2] no detecté PluginEditor.cpp como host: ¿se está escaneando Source/?');
  process.exit(1);
}

process.exit(result.ok ? 0 : 1);
