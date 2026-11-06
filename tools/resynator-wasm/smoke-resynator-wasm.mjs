// Humo del artefacto resynator-v2 WASM: ABI + carga de modelo + render finito
// (+ documento grande: vigila el STACK_SIZE del build).
// Uso: node smoke-resynator-wasm.mjs <artefacto.js> <abiEsperada> <modelo.json> <grande.json>
// Exit 0 = VERDE (publicable). Cualquier fallo = ROJO (no se publica).
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const [jsPath, expectedAbiStr, fixturePath, largePath] = process.argv.slice(2);
const expectedAbi = Number(expectedAbiStr);

function fail(msg) {
  console.error(`[humo] ROJO: ${msg}`);
  process.exit(1);
}

const factory = (await import(pathToFileURL(jsPath).href)).default;
const mod = await factory();

const abi = mod.ccall('resynAbiVersion', 'number', [], []);
if (abi !== expectedAbi) fail(`ABI del artefacto=${abi}, esperada=${expectedAbi}.`);
console.log(`[humo] ABI ok (${abi}).`);

if (mod.ccall('resynCreate', 'number', ['number'], [44100]) !== 1) {
  fail('resynCreate devolvió != 1.');
}

const json = await readFile(fixturePath, 'utf8');
const loaded = mod.ccall(
  'resynLoadModel', 'number', ['string', 'number'],
  [json, Buffer.byteLength(json, 'utf8')]
);
if (loaded !== 1) {
  const errPtr = mod.ccall('resynLastError', 'number', [], []);
  fail(`resynLoadModel rechazó el fixture: ${mod.UTF8ToString(errPtr)}`);
}
console.log('[humo] modelo fixture cargado.');

mod.ccall('resynNoteOn', null, ['number', 'number'], [57, 0.8]);

const FRAMES = 44100;
const BLOCK = 512;
let peak = 0;
let hash = 0x811c9dc5;
const mixByte = (b) => {
  hash ^= b;
  hash = Math.imul(hash, 0x01000193) >>> 0;
};
for (let done = 0; done < FRAMES; done += BLOCK) {
  const n = Math.min(BLOCK, FRAMES - done);
  const ptr = mod.ccall('resynRenderBlock', 'number', ['number'], [n]);
  if (!ptr) fail('resynRenderBlock devolvió null.');
  const start = ptr / 4;
  for (let i = 0; i < n * 2; i++) {
    const v = mod.HEAPF32[start + i];
    if (!Number.isFinite(v)) fail(`muestra no finita en frame ${done}.`);
    const a = Math.abs(v);
    if (a > peak) peak = a;
  }
  const bytes = new Uint8Array(mod.HEAPU8.buffer, ptr, n * 2 * 4);
  for (let i = 0; i < bytes.length; i++) mixByte(bytes[i]);
}
mod.ccall('resynNoteOff', null, ['number'], [57]);
// Cola de release: debe seguir siendo finita.
for (let k = 0; k < 8; k++) {
  const ptr = mod.ccall('resynRenderBlock', 'number', ['number'], [BLOCK]);
  if (!ptr) fail('resynRenderBlock (cola) devolvió null.');
  const start = ptr / 4;
  for (let i = 0; i < BLOCK * 2; i++) {
    if (!Number.isFinite(mod.HEAPF32[start + i])) fail('muestra no finita en cola.');
  }
}

console.log(`[humo] 1s render ok. peak=${peak.toFixed(6)} fnv1a=${hash.toString(16).padStart(8, '0')}`);
if (peak < 1e-4) fail(`pico sospechosamente bajo (${peak}); ¿el fixture suena?`);

// Documento grande (extensiones + superficie + multi-muestra): con la pila WASM
// por defecto la carga aborta con `memory access out of bounds`. Si esto cae,
// revisar `-sSTACK_SIZE` en build-resynator-wasm.ps1, no el DSP.
if (!largePath) fail('falta el 4º argumento: el fixture grande.');
const bigJson = await readFile(largePath, 'utf8');
console.log(`[humo] documento grande: ${bigJson.length} bytes.`);
const bigLoaded = mod.ccall(
  'resynLoadModel', 'number', ['string', 'number'],
  [bigJson, Buffer.byteLength(bigJson, 'utf8')]
);
if (bigLoaded !== 1) {
  const errPtr = mod.ccall('resynLastError', 'number', [], []);
  fail(`el artefacto rechazó el documento grande: ${mod.UTF8ToString(errPtr)}`);
}
mod.ccall('resynNoteOn', null, ['number', 'number'], [60, 0.8]);
let bigPeak = 0;
for (let done = 0; done < 22050; done += BLOCK) {
  const ptr = mod.ccall('resynRenderBlock', 'number', ['number'], [BLOCK]);
  if (!ptr) fail('resynRenderBlock (grande) devolvió null.');
  const start = ptr / 4;
  for (let i = 0; i < BLOCK * 2; i++) {
    const v = mod.HEAPF32[start + i];
    if (!Number.isFinite(v)) fail('muestra no finita en el documento grande.');
    const a = Math.abs(v);
    if (a > bigPeak) bigPeak = a;
  }
}
mod.ccall('resynNoteOff', null, ['number'], [60]);
console.log(`[humo] documento grande ok. peak=${bigPeak.toFixed(6)}`);
if (bigPeak < 1e-4) fail(`el documento grande suena en silencio (${bigPeak}).`);
console.log('[humo] VERDE.');
