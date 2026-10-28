// GENERADO por NeuronVS_port/tools/gen_translator.py — no editar a mano.
//
// Traduccion de `NeuronVS.dll!0x10040550`, el traductor de parametros.
//
// Copia el bloque de valores por slot (`p` = params+0x278C, 335 dwords) sobre
// el estado del motor (`e` = *(uint32_t**)engine, 13.948 B = 0x367C; e[N] es
// el dword N, byte N*4) antes de cada nota. No lee el preset: lee los valores
// ya recortados por `FUN_100134e0`; por eso el indice de `p` es un numero de
// slot y NO el indice de preset_schema.csv.
//
// ABI original: __thiscall(ECX = params+0x27C = motor) + dos argumentos de
// pila (`0` y `params+0x278C`). Aqui se expone como funcion libre.
//
// Convenios de la traduccion (ver docs/TRANSLATOR.md):
//   * cada sentencia del pseudocodigo aparece en el mismo orden;
//   * `f32_bits()` es la recarga float que Ghidra imprimia como `(float)`;
//   * 66 idiomas float->int se colapsan a `trunc_i32()`;
//   * 123 tiendas `FSTP dword ptr [esi+..]` se escriben con `f32_raw()`:
//     Ghidra las imprimia como `(uint)(...)`, que trunca;
//   * cada conversion aterriza en la variable que escribe su rama, no en la
//     del exponente (`uVar16`), que es la que Ghidra compara;
//   * `e[N]` direcciona dwords del estado: byte = N*4.

#include <cmath>

#include "Translator.h"
#include "AxionikParamIndices.h"

namespace abd::axionik {
using uint = uint32_t;
using undefined1 = uint8_t;
using undefined4 = uint32_t;
using byte = uint8_t;




static constexpr double k_1030e2c0 = 1e-08;
static constexpr double k_1030e2d0 = 1.0;
static constexpr float k_1030e2d8 = 0.0f;
static constexpr float k_1030e2dc = 1.0f;
static constexpr float k_1030e2e0 = 1.0f;
static constexpr float k_1030e2e4 = 882000.0f;
static constexpr double k_1030e2e8 = 1.0;
static constexpr double k_1030e2f8 = 1e-08;
static constexpr float k_1030e300 = 882000.0f;
static constexpr double k_1030e308 = 1.0;
static constexpr double k_1030e318 = 1e-08;
static constexpr float k_1030e320 = 882000.0f;
static constexpr double k_1030e328 = 1.0;
static constexpr double k_1030e338 = 1e-08;
static constexpr double k_1030e340 = 5e-06;
static constexpr double k_1030e348 = -5e-06;
static constexpr float k_1030e350 = 4.999999873689376e-06f;
static constexpr float k_1030e358 = 882000.0f;
static constexpr double k_1030e360 = 1.0;
static constexpr float k_1030e370 = 882000.0f;
static constexpr double k_1030e378 = 1.0;
static constexpr float k_1030e38c = 882000.0f;
static constexpr double k_1030e390 = 1.0;
static constexpr double k_1030e3a8 = 5e-06;
static constexpr float k_1030e3b0 = 4.999999873689376e-06f;
static constexpr float k_1030e3b8 = 882000.0f;
static constexpr double k_1030e3c0 = 1.0;
static constexpr double k_1030e3d8 = 0.0;
static constexpr double k_1030e3e8 = 0.0;
static constexpr float k_1030e3f8 = 0.0f;
static constexpr float k_1030e400 = 882000.0f;
static constexpr double k_1030e408 = 1.0;
static constexpr double k_1030e418 = 2.0;
static constexpr double k_1030e420 = 2.0;
static constexpr double k_1030e428 = 1.0;
static constexpr double k_1030e430 = 0.08333333333333333;
static constexpr double k_1030e438 = 0.5;
static constexpr double k_1030e440 = 0.5;
static constexpr double k_1030e448 = 0.5;
static constexpr double k_1030e450 = 0.5;
static constexpr double k_1030e458 = 0.5;
static constexpr float k_1030e460 = 2.0f;
static constexpr double k_1030e468 = 2.0;
static constexpr double k_1030e470 = 100.0;
static constexpr double k_1030e478 = 1200.0;
static constexpr double k_1030e480 = 0.0008333333333333334;
static constexpr float k_1030e4a0 = 1.0f;
static constexpr float k_1030e4a8 = 1.0f;
static constexpr float k_1030e4b0 = 1.0f;
static constexpr float k_1030e4b8 = 1.0f;
static constexpr float k_1030e4c0 = 1.0f;
static constexpr float k_1030e4c8 = 1.0f;
static constexpr double k_1030e4d0 = 0.5;
static constexpr double k_1030e4d8 = 127.0;
static constexpr double k_1030e4e0 = 1.0;
static constexpr double k_1030e4e8 = 0.0;
static constexpr double k_1030e4f0 = 0.007874015748031496;
static constexpr double k_1030e4f8 = 0.5;
static constexpr double k_1030e500 = 127.0;
static constexpr double k_1030e508 = 1.0;
static constexpr double k_1030e510 = 0.0;
static constexpr double k_1030e518 = 0.007874015748031496;
static constexpr double k_1030e520 = 1.0;
static constexpr double k_1030e528 = 1.0;
static constexpr double k_1030e530 = 0.5;
static constexpr double k_1030e538 = 127.0;
static constexpr double k_1030e540 = 1.0;
static constexpr double k_1030e548 = 0.0;
static constexpr double k_1030e550 = 0.007874015748031496;
static constexpr double k_1030e558 = 0.5;
static constexpr double k_1030e560 = 127.0;
static constexpr double k_1030e568 = 1.0;
static constexpr double k_1030e570 = 0.0;
static constexpr double k_1030e578 = 0.007874015748031496;
static constexpr double k_1030e580 = 1.0;
static constexpr double k_1030e588 = 1.0;
static constexpr double k_1030e590 = 0.5;
static constexpr double k_1030e598 = 127.0;
static constexpr double k_1030e5a0 = 1.0;
static constexpr double k_1030e5a8 = 0.0;
static constexpr double k_1030e5b0 = 0.007874015748031496;
static constexpr double k_1030e5b8 = 0.5;
static constexpr double k_1030e5c0 = 127.0;
static constexpr double k_1030e5c8 = 1.0;
static constexpr double k_1030e5d0 = 0.0;
static constexpr double k_1030e5d8 = 0.007874015748031496;
static constexpr double k_1030e5e0 = 1.0;
static constexpr double k_1030e5e8 = 1.0;
static constexpr double k_1030e5f0 = 0.5;
static constexpr double k_1030e5f8 = 127.0;
static constexpr double k_1030e600 = 1.0;
static constexpr double k_1030e608 = 0.0;
static constexpr double k_1030e610 = 0.007874015748031496;
static constexpr double k_1030e618 = 0.5;
static constexpr double k_1030e620 = 127.0;
static constexpr double k_1030e628 = 1.0;
static constexpr double k_1030e630 = 0.0;
static constexpr double k_1030e638 = 0.007874015748031496;
static constexpr double k_1030e640 = 1.0;
static constexpr double k_1030e648 = 1.0;
static constexpr double k_1030e650 = 0.5;
static constexpr double k_1030e658 = 127.0;
static constexpr double k_1030e660 = 1.0;
static constexpr double k_1030e668 = 0.0;
static constexpr double k_1030e670 = 0.007874015748031496;
static constexpr double k_1030e678 = 0.5;
static constexpr double k_1030e680 = 127.0;
static constexpr double k_1030e688 = 1.0;
static constexpr double k_1030e690 = 0.0;
static constexpr double k_1030e698 = 0.007874015748031496;
static constexpr double k_1030e6a0 = 1.0;
static constexpr double k_1030e6a8 = 1.0;
static constexpr double k_1030e6b0 = 0.5;
static constexpr double k_1030e6b8 = 127.0;
static constexpr double k_1030e6c0 = 1.0;
static constexpr double k_1030e6c8 = 0.0;
static constexpr double k_1030e6d0 = 0.007874015748031496;
static constexpr double k_1030e6d8 = 0.5;
static constexpr double k_1030e6e0 = 127.0;
static constexpr double k_1030e6e8 = 1.0;
static constexpr double k_1030e6f0 = 0.0;
static constexpr double k_1030e6f8 = 0.007874015748031496;
static constexpr double k_1030e700 = 1.0;
static constexpr double k_1030e708 = 1.0;
static constexpr float k_1030e710 = 882000.0f;
static constexpr double k_1030e718 = 1.0;
static constexpr float k_1030e72c = 882000.0f;
static constexpr double k_1030e730 = 1.0;
static constexpr double k_1030e748 = 5e-06;
static constexpr float k_1030e750 = 4.999999873689376e-06f;
static constexpr float k_1030e758 = 882000.0f;
static constexpr double k_1030e760 = 1.0;
static constexpr float k_1030e774 = 882000.0f;
static constexpr double k_1030e778 = 1.0;
static constexpr float k_1030e78c = 882000.0f;
static constexpr double k_1030e790 = 1.0;
static constexpr double k_1030e7a8 = 5e-06;
static constexpr float k_1030e7b0 = 4.999999873689376e-06f;
static constexpr float k_1030e7b8 = 882000.0f;
static constexpr double k_1030e7c0 = 1.0;
static constexpr float k_1030e7d4 = 882000.0f;
static constexpr double k_1030e7d8 = 1.0;
static constexpr float k_1030e7ec = 882000.0f;
static constexpr double k_1030e7f0 = 1.0;
static constexpr double k_1030e808 = 5e-06;
static constexpr float k_1030e810 = 4.999999873689376e-06f;
static constexpr float k_1030e818 = 882000.0f;
static constexpr double k_1030e820 = 1.0;
static constexpr double k_1030e838 = 0.5;
static constexpr double k_1030e840 = 0.5;
static constexpr double k_1030e848 = 0.5;
static constexpr double k_1030e850 = 0.5;
static constexpr double k_1030e858 = 0.5;
static constexpr float k_1030e860 = 2.0f;
static constexpr double k_1030e868 = 2.0;
static constexpr double k_1030e870 = 100.0;
static constexpr double k_1030e878 = 1200.0;
static constexpr double k_1030e880 = 0.0008333333333333334;
static constexpr float k_1030e8a0 = 1.0f;
static constexpr float k_1030e8a8 = 1.0f;
static constexpr float k_1030e8b0 = 1.0f;
static constexpr float k_1030e8b8 = 1.0f;
static constexpr float k_1030e8c0 = 1.0f;
static constexpr float k_1030e8c8 = 1.0f;
static constexpr double k_1030e8d0 = 0.5;
static constexpr double k_1030e8d8 = 127.0;
static constexpr double k_1030e8e0 = 1.0;
static constexpr double k_1030e8e8 = 0.0;
static constexpr double k_1030e8f0 = 0.007874015748031496;
static constexpr double k_1030e8f8 = 0.5;
static constexpr double k_1030e900 = 127.0;
static constexpr double k_1030e908 = 1.0;
static constexpr double k_1030e910 = 0.0;
static constexpr double k_1030e918 = 0.007874015748031496;
static constexpr double k_1030e920 = 1.0;
static constexpr double k_1030e928 = 1.0;
static constexpr double k_1030e930 = 0.5;
static constexpr double k_1030e938 = 127.0;
static constexpr double k_1030e940 = 1.0;
static constexpr double k_1030e948 = 0.0;
static constexpr double k_1030e950 = 0.007874015748031496;
static constexpr double k_1030e958 = 0.5;
static constexpr double k_1030e960 = 127.0;
static constexpr double k_1030e968 = 1.0;
static constexpr double k_1030e970 = 0.0;
static constexpr double k_1030e978 = 0.007874015748031496;
static constexpr double k_1030e980 = 1.0;
static constexpr double k_1030e988 = 1.0;
static constexpr double k_1030e990 = 0.5;
static constexpr double k_1030e998 = 127.0;
static constexpr double k_1030e9a0 = 1.0;
static constexpr double k_1030e9a8 = 0.0;
static constexpr double k_1030e9b0 = 0.007874015748031496;
static constexpr double k_1030e9b8 = 0.5;
static constexpr double k_1030e9c0 = 127.0;
static constexpr double k_1030e9c8 = 1.0;
static constexpr double k_1030e9d0 = 0.0;
static constexpr double k_1030e9d8 = 0.007874015748031496;
static constexpr double k_1030e9e0 = 1.0;
static constexpr double k_1030e9e8 = 1.0;
static constexpr double k_1030e9f0 = 0.5;
static constexpr double k_1030e9f8 = 127.0;
static constexpr double k_1030ea00 = 1.0;
static constexpr double k_1030ea08 = 0.0;
static constexpr double k_1030ea10 = 0.007874015748031496;
static constexpr double k_1030ea18 = 0.5;
static constexpr double k_1030ea20 = 127.0;
static constexpr double k_1030ea28 = 1.0;
static constexpr double k_1030ea30 = 0.0;
static constexpr double k_1030ea38 = 0.007874015748031496;
static constexpr double k_1030ea40 = 1.0;
static constexpr double k_1030ea48 = 1.0;
static constexpr double k_1030ea50 = 0.5;
static constexpr double k_1030ea58 = 127.0;
static constexpr double k_1030ea60 = 1.0;
static constexpr double k_1030ea68 = 0.0;
static constexpr double k_1030ea70 = 0.007874015748031496;
static constexpr double k_1030ea78 = 0.5;
static constexpr double k_1030ea80 = 127.0;
static constexpr double k_1030ea88 = 1.0;
static constexpr double k_1030ea90 = 0.0;
static constexpr double k_1030ea98 = 0.007874015748031496;
static constexpr double k_1030eaa0 = 1.0;
static constexpr double k_1030eaa8 = 1.0;
static constexpr double k_1030eab0 = 0.5;
static constexpr double k_1030eab8 = 127.0;
static constexpr double k_1030eac0 = 1.0;
static constexpr double k_1030eac8 = 0.0;
static constexpr double k_1030ead0 = 0.007874015748031496;
static constexpr double k_1030ead8 = 0.5;
static constexpr double k_1030eae0 = 127.0;
static constexpr double k_1030eae8 = 1.0;
static constexpr double k_1030eaf0 = 0.0;
static constexpr double k_1030eaf8 = 0.007874015748031496;
static constexpr double k_1030eb00 = 1.0;
static constexpr double k_1030eb08 = 1.0;
static constexpr float k_1030eb10 = 882000.0f;
static constexpr double k_1030eb18 = 1.0;
static constexpr float k_1030eb2c = 882000.0f;
static constexpr double k_1030eb30 = 1.0;
static constexpr double k_1030eb48 = 5e-06;
static constexpr float k_1030eb50 = 4.999999873689376e-06f;
static constexpr float k_1030eb58 = 882000.0f;
static constexpr double k_1030eb60 = 1.0;
static constexpr float k_1030eb74 = 882000.0f;
static constexpr double k_1030eb78 = 1.0;
static constexpr float k_1030eb8c = 882000.0f;
static constexpr double k_1030eb90 = 1.0;
static constexpr double k_1030eba8 = 5e-06;
static constexpr float k_1030ebb0 = 4.999999873689376e-06f;
static constexpr float k_1030ebb8 = 882000.0f;
static constexpr double k_1030ebc0 = 1.0;
static constexpr float k_1030ebd4 = 882000.0f;
static constexpr double k_1030ebd8 = 1.0;
static constexpr float k_1030ebec = 882000.0f;
static constexpr double k_1030ebf0 = 1.0;
static constexpr double k_1030ec08 = 5e-06;
static constexpr float k_1030ec10 = 4.999999873689376e-06f;
static constexpr float k_1030ec18 = 882000.0f;
static constexpr double k_1030ec20 = 1.0;
static constexpr double k_1030ec38 = 127.0;
static constexpr double k_1030ec40 = 127.0;
static constexpr double k_1030ec48 = 127.0;
static constexpr double k_1030ec50 = 127.0;
static constexpr double k_1030ec58 = 127.0;
static constexpr double k_1030ec60 = 127.0;
static constexpr double k_1030ec68 = 127.0;
static constexpr double k_1030ec70 = 127.0;
static constexpr double k_1030ec78 = 127.0;
static constexpr double k_1030ec80 = 127.0;
static constexpr double k_1030ec88 = 127.0;
static constexpr double k_1030ec90 = 127.0;
static constexpr double k_1030ec98 = 127.0;
static constexpr double k_1030eca0 = 127.0;
static constexpr double k_1030eca8 = 127.0;
static constexpr double k_1030ecb0 = 127.0;
static constexpr double k_1030ecb8 = 127.0;
static constexpr double k_1030ecc0 = 127.0;
static constexpr double k_1030ecc8 = 127.0;
static constexpr double k_1030ecd0 = 127.0;
static constexpr double k_1030ecd8 = 127.0;
static constexpr double k_1030ece0 = 127.0;
static constexpr double k_1030ece8 = 127.0;
static constexpr double k_1030ecf0 = 127.0;
static constexpr double k_1030ecf8 = 127.0;
static constexpr double k_1030ed00 = 127.0;
static constexpr double k_1030ed08 = 127.0;
static constexpr double k_1030ed10 = 127.0;
static constexpr double k_1030ed18 = 127.0;
static constexpr double k_1030ed20 = 127.0;
static constexpr double k_1030ed28 = 127.0;
static constexpr double k_1030ed30 = 127.0;
static constexpr double k_1030ed38 = 127.0;
static constexpr double k_1030ed40 = 127.0;
static constexpr double k_1030ed48 = 127.0;
static constexpr double k_1030ed50 = 127.0;
static constexpr double k_1030ed58 = 127.0;
static constexpr double k_1030ed60 = 127.0;
static constexpr double k_1030ed68 = 127.0;
static constexpr double k_1030ed70 = 127.0;
static constexpr double k_1030ed78 = 127.0;
static constexpr double k_1030ed80 = 127.0;
static constexpr double k_1030ed88 = 127.0;
static constexpr double k_1030ed90 = 127.0;
static constexpr double k_1030ed98 = 127.0;
static constexpr double k_1030eda0 = 127.0;
static constexpr double k_1030eda8 = 127.0;
static constexpr double k_1030edb0 = 127.0;
static constexpr double k_1030edb8 = 1.0;
static constexpr double k_1030edc8 = 1.0;

void translateParametersToEngine(uint32_t* engineState, const float* pFloat) {
    if (engineState == nullptr || pFloat == nullptr) return;
    const uint32_t* p = reinterpret_cast<const uint32_t*>(pFloat);
    uint32_t* e = engineState;
    
    char cVar13 = 0;
    double dVar18 = 0.0;
    double dVar19 = 0.0;
    double fVar1 = 0.0;
    double fVar11 = 0.0;
    double fVar12 = 0.0;
    double fVar17 = 0.0;
    double fVar2 = 0.0;
    double fVar3 = 0.0;
    double fVar4 = 0.0;
    double fVar5 = 0.0;
    double fVar6 = 0.0;
    double fVar7 = 0.0;
    double fVar8 = 0.0;
    uint32_t local_4c = 0;
    uint32_t local_54 = 0;
    char* pcVar10 = nullptr;
    uint32_t uVar14 = 0;
    uint32_t uVar15 = 0;
    uint32_t uVar16 = 0;


  
  if (e != nullptr) {
    // Puerta: el motor no se toca si no hay bloque de valores o si el
    // flag de traduccion (byte 0xD98) esta apagado.
    if ((p != nullptr) && ((char)e[0x366] != '\0')) {
      e[0x10] = *p;
      e[0x11] = p[abd::axionik::SlotIdx::SoundPanKeyTrack];
      e[9] = p[abd::axionik::SlotIdx::FreeADSR1VelocityDepth];
      e[10] = p[abd::axionik::SlotIdx::FreeADSR2VelocityDepth];
      e[0xb] = p[abd::axionik::SlotIdx::Free4Level4TimeVelocityDepth];
      e[0xc] = p[abd::axionik::SlotIdx::TLFreeEnvDepth];
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::TLFreeEnvMode]);
      uVar14 = trunc_i32(dVar19);
      e[0xd] = uVar14;
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::FilterEnvMode]);
      uVar14 = trunc_i32(dVar19);
      e[0xe] = uVar14;
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::FreeEnvType]);
      uVar14 = trunc_i32(dVar19);
      e[0xf] = uVar14;
      e[2] = p[abd::axionik::SlotIdx::PitchBendRange];
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::BlenderType]);
      uVar14 = trunc_i32(dVar19);
      *e = uVar14;
      fVar1 = f32_bits(p[abd::axionik::SlotIdx::BlenderAmount]);
      fVar2 = (float)k_1030e2c0;
      e[3] = p[abd::axionik::SlotIdx::BlenderAmount];
      if (fVar1 < fVar2) {
        e[3] = 0x322bcc77;
        fVar1 = f32_bits(e[3]);
      }
      e[4] = f32_raw(((float)k_1030e2d0 - fVar1));
      e[6] = p[abd::axionik::SlotIdx::BlenderFreeADSR1Depth];
      e[7] = p[abd::axionik::SlotIdx::BlenderFreeADSR2Depth];
      e[8] = p[abd::axionik::SlotIdx::BlenderFree4L4TDepth];
      e[5] = p[abd::axionik::SlotIdx::BlenderLfoDepth];
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::SilverSwitch]);
      uVar14 = trunc_i32(dVar19);
      e[1] = uVar14;
      fVar1 = k_1030e2d8;
      if (f32_bits(p[abd::axionik::SlotIdx::SilverL1Contour]) == k_1030e2dc) {
        fVar1 = k_1030e2e0;
      }
      e[0x13] = p[abd::axionik::SlotIdx::FilterKeyTrack];
      e[0x9e] = f32_raw((fVar1 * f32_bits(p[abd::axionik::SlotIdx::FilterEnvDepth])));
      e[0x9c] = p[abd::axionik::SlotIdx::FilterCutoffVelocityDepth];
      e[0x9d] = p[abd::axionik::SlotIdx::FilterLfoDepth];
      e[0x12] = p[abd::axionik::SlotIdx::FilterEnvVelocityDepth];
      e[0x9a] = p[abd::axionik::SlotIdx::FilterFreq];
      e[0x9b] = p[abd::axionik::SlotIdx::FilterReso];
      if (e[0xf] == 1) {
        fVar1 = f32_bits(p[abd::axionik::SlotIdx::FreeEnvLevel3]);
        fVar2 = f32_bits(p[abd::axionik::SlotIdx::FreeEnvTime1]);
        fVar3 = f32_bits(p[abd::axionik::SlotIdx::FreeEnvLevel1]);
        fVar4 = f32_bits(p[abd::axionik::SlotIdx::FreeEnvTime2]);
        fVar5 = f32_bits(p[abd::axionik::SlotIdx::FreeEnvLevel2]);
        fVar6 = f32_bits(p[abd::axionik::SlotIdx::FreeEnvTime3]);
        fVar7 = f32_bits(p[abd::axionik::SlotIdx::FreeEnvTime4]);
        fVar8 = f32_bits(p[abd::axionik::SlotIdx::FreeEnvLevel4]);
        if ((char)e[0x91] == '\0') {
          *(undefined1 *)(e + 0x91) = 1;
        }
        dVar19 = (double)(fVar2 * fVar2 * k_1030e2e4);
        uVar14 = trunc_i32(dVar19);
        if ((int)uVar14 < 1) {
          uVar14 = 1;
        }
        fVar12 = (float)k_1030e2e8;
        e[0x55] = uVar14;
        fVar2 = (float)k_1030e2f8;
        dVar19 = (double)(fVar4 * fVar4 * k_1030e300);
        e[0x56] = f32_raw((fVar12 / (float)(int)uVar14));
        e[0x58] = 4;
        e[0x59] = 0;
        e[0x5a] = 0;
        e[0x57] = f32_raw((fVar3 + fVar2));
        uVar14 = trunc_i32(dVar19);
        if ((int)uVar14 < 1) {
          uVar14 = 1;
        }
        fVar12 = (float)k_1030e308;
        e[0x5b] = uVar14;
        fVar4 = (float)k_1030e318;
        dVar19 = (double)(fVar6 * fVar6 * k_1030e320);
        e[0x5c] = f32_raw((fVar12 / (float)(int)uVar14));
        e[0x5d] = f32_raw((fVar5 + fVar4));
        e[0x5e] = 4;
        e[0x5f] = 0;
        e[0x60] = 0;
        uVar14 = trunc_i32(dVar19);
        if ((int)uVar14 < 1) {
          uVar14 = 1;
        }
        fVar5 = (float)k_1030e328;
        fVar4 = (float)k_1030e340;
        e[99] = f32_raw(((float)k_1030e338 + fVar1));
        e[0x61] = uVar14;
        e[0x65] = 0;
        e[0x62] = f32_raw((fVar5 / (float)(int)uVar14));
        e[100] = 4;
        e[0x66] = 0;
        if ((fVar8 < fVar4) && (k_1030e348 < (double)fVar8)) {
          fVar8 = k_1030e350;
        }
        fVar1 = fVar7 * fVar7 * k_1030e358;
        e[0x69] = f32_raw(fVar8);
        e[0x6c] = 0;
        e[0x6b] = 0;
        e[0x67] = 0;
        e[0x68] = 0;
        e[0x6a] = 2;
        dVar19 = (double)fVar1;
        uVar14 = trunc_i32(dVar19);
        if ((int)uVar14 < 0x80) {
          uVar14 = 0x80;
        }
        e[0x6f] = f32_raw((fVar3 + fVar2));
        fVar1 = (float)k_1030e360;
        e[0x6d] = uVar14;
        e[0x72] = e[0xd];
        e[0x70] = 3;
        e[0x71] = 0;
        e[0x6e] = f32_raw((fVar1 / (float)(int)uVar14));
      }
      fVar1 = f32_bits(p[abd::axionik::SlotIdx::FilterEnvA]);
      fVar2 = f32_bits(p[abd::axionik::SlotIdx::FilterEnvD]);
      fVar3 = f32_bits(p[abd::axionik::SlotIdx::FilterEnvS]);
      fVar4 = f32_bits(p[abd::axionik::SlotIdx::FilterEnvR]);
      if ((char)e[0x54] == '\0') {
        *(undefined1 *)(e + 0x54) = 1;
      }
      dVar19 = (double)(fVar1 * fVar1 * fVar1 * k_1030e370);
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 1) {
        uVar14 = 1;
      }
      e[0x18] = uVar14;
      fVar5 = (float)k_1030e378;
      e[0x1a] = 0x36a7c5ac;
      fVar1 = fVar2 * fVar2 * k_1030e38c;
      e[0x1b] = 4;
      dVar19 = (double)fVar1;
      e[0x1c] = 1;
      e[0x1d] = 0;
      e[0x19] = f32_raw((fVar5 / (float)(int)uVar14));
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 1) {
        uVar14 = 1;
      }
      e[0x1f] = f32_raw(((float)k_1030e390 / (float)(int)uVar14));
      fVar1 = (fVar3 + fVar3) - fVar3 * fVar3;
      e[0x1e] = uVar14;
      e[0x22] = 0;
      e[0x20] = 0x3f800000;
      e[0x23] = 0;
      fVar2 = (float)k_1030e3a8;
      e[0x21] = 4;
      if (fVar1 < fVar2) {
        fVar1 = k_1030e3b0;
      }
      e[0x26] = f32_raw(fVar1);
      fVar1 = fVar4 * fVar4 * k_1030e3b8;
      e[0x29] = 0;
      e[0x28] = 0;
      dVar19 = (double)fVar1;
      e[0x24] = 0;
      e[0x25] = 0;
      e[0x27] = 2;
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 0x80) {
        uVar14 = 0x80;
      }
      fVar1 = (float)k_1030e3c0;
      e[0x2e] = 0;
      e[0x2f] = e[0xe];
      e[0x2d] = 3;
      e[0x2a] = uVar14;
      e[0x2c] = 0;
      e[0x2b] = f32_raw((fVar1 / (float)(int)uVar14));
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::FilterType]);
      uVar14 = trunc_i32(dVar19);
      if (e[0x9f] != uVar14) {
        e[0xa0] = 1;
        dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::FilterType]);
        uVar14 = trunc_i32(dVar19);
        e[0x9f] = uVar14;
      }
      if ((float)k_1030e3d8 <= f32_bits(e[0x9a])) {
        if ((float)k_1030edc8 < f32_bits(e[0x9a])) {
          e[0x9a] = 0x3f800000;
        }
      }
      else {
        e[0x9a] = 0;
      }
      if ((float)k_1030e3e8 <= f32_bits(e[0x9b])) {
        if ((float)k_1030edb8 < f32_bits(e[0x9b])) {
          e[0x9b] = 0x3f800000;
        }
      }
      else {
        e[0x9b] = 0;
      }
      uVar14 = p[abd::axionik::SlotIdx::LFORate];
      uVar15 = p[abd::axionik::SlotIdx::LFODepth];
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::LFOWaveForm]);
      fVar1 = f32_bits(p[abd::axionik::SlotIdx::LFOSwitch]);
      fVar2 = f32_bits(p[abd::axionik::SlotIdx::LFODelay]);
      if ((char)e[0x99] == '\0') {
        *(undefined1 *)(e + 0x99) = 1;
      }
      local_54 = 0x3f800000;
      if (fVar2 < k_1030e3f8) {
        local_54 = 0xbf800000;
      }
      dVar18 = (double)(fVar2 * fVar2 * k_1030e400);
      local_4c = trunc_i32(dVar18);
      if ((int)local_4c < 1) {
        local_4c = 1;
      }
      dVar18 = (double)fVar1;
      uVar16 = trunc_i32(dVar18);
      e[0x92] = uVar16;
      e[0x93] = local_4c;
      fVar1 = (float)k_1030e408;
      e[0x96] = uVar14;
      e[0x97] = local_54;
      e[0x95] = uVar15;
      e[0x94] = f32_raw((fVar1 / (float)(int)local_4c));
      uVar14 = trunc_i32(dVar19);
      e[0x98] = uVar14;
      dVar18 = std::pow(k_1030e418,
                   (k_1030e420 * (double)f32_bits(e[0x369]) - k_1030e428) * k_1030e430 *
                   (double)f32_bits(e[2]));
      dVar19 = k_1030e438;
      e[0x36a] = f32_raw((float)dVar18);
      if (dVar19 <= (double)f32_bits(p[abd::axionik::SlotIdx::R1Switch])) {
        e[0xa1] = 1;
      }
      else {
        e[0xa1] = 0;
      }
      fVar1 = (float)k_1030e458;
      e[0x1a5] = f32_raw(((float)k_1030e448 * f32_bits(p[abd::axionik::SlotIdx::R1ModelSizeKeyTrack]) + (float)k_1030e440));
      e[0x1a6] = f32_raw((fVar1 * f32_bits(p[abd::axionik::SlotIdx::R1ModelSizeOffset]) + (float)k_1030e450));
      e[0x1a7] = p[abd::axionik::SlotIdx::R1ModelVelocitySwitch];
      e[0x1a8] = p[abd::axionik::SlotIdx::LFOWaveForm];
      e[0x1b7] = p[abd::axionik::SlotIdx::R1PitchLfoDepth];
      e[0x1b9] = p[abd::axionik::SlotIdx::R1AmpLfoDepth];
      fVar1 = f32_bits(p[abd::axionik::SlotIdx::R1Volume]);
      e[0xa3] = p[abd::axionik::SlotIdx::R1Volume];
      e[0xa4] = f32_raw((fVar1 * fVar1));
      e[0x1aa] = p[abd::axionik::SlotIdx::R1VolumeVelocityDepth];
      e[0x1ba] = p[abd::axionik::SlotIdx::R1AmpKeyTrack];
      e[0x1b8] = p[abd::axionik::SlotIdx::R1PitchKeyTrack];
      e[0x1be] = p[abd::axionik::SlotIdx::R1FreeADSR1PitchDepth];
      e[0x1bf] = p[abd::axionik::SlotIdx::R1FreeADSR2PitchDepth];
      e[0x1c0] = p[abd::axionik::SlotIdx::R1Free4L4TPitchDepth];
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::R1ResEnvMode]);
      uVar14 = trunc_i32(dVar19);
      e[0x1bb] = uVar14;
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::R1AmpEnvMode]);
      uVar14 = trunc_i32(dVar19);
      e[0x1bc] = uVar14;
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::R1FreeEnvMode]);
      uVar14 = trunc_i32(dVar19);
      e[0x1bd] = uVar14;
      dVar19 = k_1030e470;
      e[0xa5] = f32_raw((f32_bits(p[abd::axionik::SlotIdx::R1Octave]) - k_1030e460));
      e[0xa6] = p[abd::axionik::SlotIdx::R1Semi];
      dVar18 = k_1030e468;
      dVar19 = ((double)f32_bits(e[0xa5]) * k_1030e478 + dVar19 * (double)f32_bits(e[0xa6]) +
               (double)f32_bits(p[abd::axionik::SlotIdx::R1Cents])) * k_1030e480;
      e[0xa7] = p[abd::axionik::SlotIdx::R1Cents];
      dVar19 = std::pow(dVar18,dVar19);
      e[0x202] = 0;
      e[0x201] = 0;
      e[0xa2] = f32_raw((f32_bits(e[0x36b]) * f32_bits(e[0x36a]) * (float)dVar19));
      e[0x200] = 0;
      e[0x1ff] = 0;
      e[0x1fe] = 0;
      e[0x1fd] = 0;
      if (f32_bits(p[abd::axionik::SlotIdx::R1L1ContourScape]) == k_1030e4a0) {
        e[0x1fd] = 0x3f800000;
      }
      if (f32_bits(p[abd::axionik::SlotIdx::R1L1ContourSphere]) == k_1030e4a8) {
        e[0x1fe] = 0x3f800000;
      }
      if (f32_bits(p[abd::axionik::SlotIdx::R1L2ContourScape]) == k_1030e4b0) {
        e[0x1ff] = 0x3f800000;
      }
      if (f32_bits(p[abd::axionik::SlotIdx::R1L2ContourSphere]) == k_1030e4b8) {
        e[0x200] = 0x3f800000;
      }
      if (f32_bits(p[abd::axionik::SlotIdx::R1L3ContourScape]) == k_1030e4c0) {
        e[0x201] = 0x3f800000;
      }
      if (f32_bits(p[abd::axionik::SlotIdx::R1L3ContourSphere]) == k_1030e4c8) {
        e[0x202] = 0x3f800000;
      }
      e[0x1a9] = p[abd::axionik::SlotIdx::R1ParaEnvVelocityDepth];
      e[0x1ab] = f32_raw((f32_bits(e[0x1fd]) * f32_bits(p[abd::axionik::SlotIdx::R1L1Scape1EnvDepth])));
      e[0x1ac] = f32_raw((f32_bits(e[0x1fd]) * f32_bits(p[abd::axionik::SlotIdx::R1L1Scape2EnvDepth])));
      e[0x1ad] = f32_raw((f32_bits(e[0x1fe]) * f32_bits(p[abd::axionik::SlotIdx::R1L1Sphere1EnvDepth])));
      e[0x1ae] = f32_raw((f32_bits(e[0x1fe]) * f32_bits(p[abd::axionik::SlotIdx::R1L1Sphere2EnvDepth])));
      e[0x1af] = f32_raw((f32_bits(e[0x1ff]) * f32_bits(p[abd::axionik::SlotIdx::R1L2Scape1EnvDepth])));
      e[0x1b0] = f32_raw((f32_bits(e[0x1ff]) * f32_bits(p[abd::axionik::SlotIdx::R1L2Scape2EnvDepth])));
      e[0x1b1] = f32_raw((f32_bits(e[0x200]) * f32_bits(p[abd::axionik::SlotIdx::R1L2Sphere1EnvDepth])));
      e[0x1b2] = f32_raw((f32_bits(e[0x200]) * f32_bits(p[abd::axionik::SlotIdx::R1L2Sphere2EnvDepth])));
      e[0x1b3] = f32_raw((f32_bits(e[0x201]) * f32_bits(p[abd::axionik::SlotIdx::R1L3Scape1EnvDepth])));
      e[0x1b4] = f32_raw((f32_bits(e[0x201]) * f32_bits(p[abd::axionik::SlotIdx::R1L3Scape2EnvDepth])));
      e[0x1b5] = f32_raw((f32_bits(e[0x202]) * f32_bits(p[abd::axionik::SlotIdx::R1L3Sphere1EnvDepth])));
      e[0x1b6] = f32_raw((f32_bits(e[0x202]) * f32_bits(p[abd::axionik::SlotIdx::R1L3Sphere2EnvDepth])));
      e[0x1c1] = p[abd::axionik::SlotIdx::R1L1Scape1LfoDepth];
      e[0x1c2] = p[abd::axionik::SlotIdx::R1L1Scape2LfoDepth];
      e[0x1c3] = p[abd::axionik::SlotIdx::R1L1Sphere1LfoDepth];
      e[0x1c4] = p[abd::axionik::SlotIdx::R1L1Sphere2LfoDepth];
      e[0x1c5] = p[abd::axionik::SlotIdx::R1L2Scape1LfoDepth];
      e[0x1c6] = p[abd::axionik::SlotIdx::R1L2Scape2LfoDepth];
      e[0x1c7] = p[abd::axionik::SlotIdx::R1L2Sphere1LfoDepth];
      e[0x1c8] = p[abd::axionik::SlotIdx::R1L2Sphere2LfoDepth];
      e[0x1c9] = p[abd::axionik::SlotIdx::R1L3Scape1LfoDepth];
      e[0x1ca] = p[abd::axionik::SlotIdx::R1L3Scape2LfoDepth];
      e[0x1cb] = p[abd::axionik::SlotIdx::R1L3Sphere1LfoDepth];
      e[0x1cc] = p[abd::axionik::SlotIdx::R1L3Sphere2LfoDepth];
      e[0x1cd] = p[abd::axionik::SlotIdx::R1L1Scape1VelocityDepth];
      e[0x1ce] = p[abd::axionik::SlotIdx::R1L1Scape2VelocityDepth];
      e[0x1cf] = p[abd::axionik::SlotIdx::R1L1Sphere1VelocityDepth];
      e[0x1d0] = p[abd::axionik::SlotIdx::R1L1Sphere2VelocityDepth];
      e[0x1d1] = p[abd::axionik::SlotIdx::R1L2Scape1VelocityDepth];
      e[0x1d2] = p[abd::axionik::SlotIdx::R1L2Scape2VelocityDepth];
      e[0x1d3] = p[abd::axionik::SlotIdx::R1L2Sphere1VelocityDepth];
      e[0x1d4] = p[abd::axionik::SlotIdx::R1L2Sphere2VelocityDepth];
      e[0x1d5] = p[abd::axionik::SlotIdx::R1L3Scape1VelocityDepth];
      e[0x1d6] = p[abd::axionik::SlotIdx::R1L3Scape2VelocityDepth];
      e[0x1d7] = p[abd::axionik::SlotIdx::R1L3Sphere1VelocityDepth];
      e[0x1d8] = p[abd::axionik::SlotIdx::R1L3Sphere2VelocityDepth];
      e[0x1d9] = p[abd::axionik::SlotIdx::R1L1Scape1KeyTrack];
      dVar19 = k_1030e4d8;
      e[0x1da] = p[abd::axionik::SlotIdx::R1L1Scape2KeyTrack];
      e[0x1db] = p[abd::axionik::SlotIdx::R1L1Sphere1KeyTrack];
      e[0x1dc] = p[abd::axionik::SlotIdx::R1L1Sphere2KeyTrack];
      e[0x1dd] = p[abd::axionik::SlotIdx::R1L2Scape1KeyTrack];
      e[0x1de] = p[abd::axionik::SlotIdx::R1L2Scape2KeyTrack];
      e[0x1df] = p[abd::axionik::SlotIdx::R1L2Sphere1KeyTrack];
      e[0x1e0] = p[abd::axionik::SlotIdx::R1L2Sphere2KeyTrack];
      e[0x1e1] = p[abd::axionik::SlotIdx::R1L3Scape1KeyTrack];
      e[0x1e2] = p[abd::axionik::SlotIdx::R1L3Scape2KeyTrack];
      e[0x1e3] = p[abd::axionik::SlotIdx::R1L3Sphere1KeyTrack];
      e[0x1e4] = p[abd::axionik::SlotIdx::R1L3Sphere2KeyTrack];
      dVar18 = k_1030e500;
      dVar19 = dVar19 * (double)f32_bits(p[abd::axionik::SlotIdx::R1L1Scape1Value]) + k_1030e4d0;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e4e0 <= fVar17) {
        if ((long double)k_1030eda8 < fVar17) {
          fVar17 = (long double)k_1030edb0;
        }
      }
      else {
        fVar17 = (long double)k_1030e4e8;
      }
      e[0x1e5] = f32_raw((float)(fVar17 * (long double)k_1030e4f0));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R1L1Scape2Value]) + k_1030e4f8;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e508 <= fVar17) {
        if ((long double)k_1030ed98 < fVar17) {
          fVar17 = (long double)k_1030eda0;
        }
      }
      else {
        fVar17 = (long double)k_1030e510;
      }
      fVar1 = (float)k_1030e528;
      e[0x1e6] = f32_raw((float)(fVar17 * (long double)k_1030e518));
      fVar2 = (float)k_1030e520;
      e[0x1e8] = f32_raw((fVar1 - f32_bits(e[0x1e6])));
      e[0x1e7] = f32_raw((fVar2 - f32_bits(e[0x1e5])));
      dVar18 = k_1030e560;
      dVar19 = (double)(f32_bits(p[abd::axionik::SlotIdx::R1L2Scape1Value]) * (float)k_1030e538 + (float)k_1030e530);
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e540 <= fVar17) {
        if ((long double)k_1030ed88 < fVar17) {
          fVar17 = (long double)k_1030ed90;
        }
      }
      else {
        fVar17 = (long double)k_1030e548;
      }
      e[0x1e9] = f32_raw((float)(fVar17 * (long double)k_1030e550));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R1L2Scape2Value]) + k_1030e558;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e568 <= fVar17) {
        if ((long double)k_1030ed78 < fVar17) {
          fVar17 = (long double)k_1030ed80;
        }
      }
      else {
        fVar17 = (long double)k_1030e570;
      }
      fVar1 = (float)k_1030e588;
      e[0x1ea] = f32_raw((float)(fVar17 * (long double)k_1030e578));
      fVar2 = (float)k_1030e580;
      e[0x1ec] = f32_raw((fVar1 - f32_bits(e[0x1ea])));
      e[0x1eb] = f32_raw((fVar2 - f32_bits(e[0x1e9])));
      dVar18 = k_1030e5c0;
      dVar19 = (double)(f32_bits(p[abd::axionik::SlotIdx::R1L3Scape1Value]) * (float)k_1030e598 + (float)k_1030e590);
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e5a0 <= fVar17) {
        if ((long double)k_1030ed68 < fVar17) {
          fVar17 = (long double)k_1030ed70;
        }
      }
      else {
        fVar17 = (long double)k_1030e5a8;
      }
      e[0x1ed] = f32_raw((float)(fVar17 * (long double)k_1030e5b0));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R1L3Scape2Value]) + k_1030e5b8;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e5c8 <= fVar17) {
        if ((long double)k_1030ed58 < fVar17) {
          fVar17 = (long double)k_1030ed60;
        }
      }
      else {
        fVar17 = (long double)k_1030e5d0;
      }
      fVar11 = (long double)k_1030e5d8;
      fVar1 = (float)k_1030e5e0;
      e[0x1f0] = f32_raw(((float)k_1030e5e8 - f32_bits(e[0x1f0])));
      e[0x1ef] = f32_raw((fVar1 - f32_bits(e[0x1ed])));
      e[0x1ee] = f32_raw((float)(fVar17 * fVar11));
      dVar18 = k_1030e620;
      dVar19 = (double)(f32_bits(p[abd::axionik::SlotIdx::R1L1Sphere1Value]) * (float)k_1030e5f8 + (float)k_1030e5f0);
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e600 <= fVar17) {
        if ((long double)k_1030ed48 < fVar17) {
          fVar17 = (long double)k_1030ed50;
        }
      }
      else {
        fVar17 = (long double)k_1030e608;
      }
      e[0x1f1] = f32_raw((float)(fVar17 * (long double)k_1030e610));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R1L1Sphere2Value]) + k_1030e618;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e628 <= fVar17) {
        if ((long double)k_1030ed38 < fVar17) {
          fVar17 = (long double)k_1030ed40;
        }
      }
      else {
        fVar17 = (long double)k_1030e630;
      }
      fVar1 = (float)k_1030e648;
      e[0x1f2] = f32_raw((float)(fVar17 * (long double)k_1030e638));
      fVar2 = (float)k_1030e640;
      e[500] = f32_raw((fVar1 - f32_bits(e[0x1f2])));
      e[499] = f32_raw((fVar2 - f32_bits(e[0x1f1])));
      dVar18 = k_1030e680;
      dVar19 = (double)(f32_bits(p[abd::axionik::SlotIdx::R1L2Sphere1Value]) * (float)k_1030e658 + (float)k_1030e650);
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e660 <= fVar17) {
        if ((long double)k_1030ed28 < fVar17) {
          fVar17 = (long double)k_1030ed30;
        }
      }
      else {
        fVar17 = (long double)k_1030e668;
      }
      e[0x1f5] = f32_raw((float)(fVar17 * (long double)k_1030e670));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R1L2Sphere2Value]) + k_1030e678;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e688 <= fVar17) {
        if ((long double)k_1030ed18 < fVar17) {
          fVar17 = (long double)k_1030ed20;
        }
      }
      else {
        fVar17 = (long double)k_1030e690;
      }
      fVar1 = (float)k_1030e6a8;
      e[0x1f6] = f32_raw((float)(fVar17 * (long double)k_1030e698));
      fVar2 = (float)k_1030e6a0;
      e[0x1f8] = f32_raw((fVar1 - f32_bits(e[0x1f6])));
      e[0x1f7] = f32_raw((fVar2 - f32_bits(e[0x1f5])));
      dVar18 = k_1030e6e0;
      dVar19 = (double)(f32_bits(p[abd::axionik::SlotIdx::R1L3Sphere1Value]) * (float)k_1030e6b8 + (float)k_1030e6b0);
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e6c0 <= fVar17) {
        if ((long double)k_1030ed08 < fVar17) {
          fVar17 = (long double)k_1030ed10;
        }
      }
      else {
        fVar17 = (long double)k_1030e6c8;
      }
      e[0x1f9] = f32_raw((float)(fVar17 * (long double)k_1030e6d0));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R1L3Sphere2Value]) + k_1030e6d8;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e6e8 <= fVar17) {
        if ((long double)k_1030ecf8 < fVar17) {
          fVar17 = (long double)k_1030ed00;
        }
      }
      else {
        fVar17 = (long double)k_1030e6f0;
      }
      fVar1 = (float)k_1030e708;
      e[0x1fa] = f32_raw((float)(fVar17 * (long double)k_1030e6f8));
      fVar2 = (float)k_1030e700;
      e[0x1fc] = f32_raw((fVar1 - f32_bits(e[0x1fa])));
      e[0x1fb] = f32_raw((fVar2 - f32_bits(e[0x1f9])));
      fVar1 = f32_bits(p[abd::axionik::SlotIdx::R1AmpEnvA]);
      fVar2 = f32_bits(p[abd::axionik::SlotIdx::R1AmpEnvD]);
      fVar3 = f32_bits(p[abd::axionik::SlotIdx::R1AmpEnvS]);
      fVar4 = f32_bits(p[abd::axionik::SlotIdx::R1AmpEnvR]);
      if ((char)e[0xe8] == '\0') {
        *(undefined1 *)(e + 0xe8) = 1;
      }
      dVar19 = (double)(fVar1 * fVar1 * fVar1 * k_1030e710);
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 1) {
        uVar14 = 1;
      }
      e[0xac] = uVar14;
      fVar5 = (float)k_1030e718;
      e[0xae] = 0x36a7c5ac;
      fVar1 = fVar2 * fVar2 * k_1030e72c;
      e[0xaf] = 4;
      dVar19 = (double)fVar1;
      e[0xb0] = 1;
      e[0xb1] = 0;
      e[0xad] = f32_raw((fVar5 / (float)(int)uVar14));
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 1) {
        uVar14 = 1;
      }
      e[0xb3] = f32_raw(((float)k_1030e730 / (float)(int)uVar14));
      fVar1 = (fVar3 + fVar3) - fVar3 * fVar3;
      e[0xb2] = uVar14;
      e[0xb6] = 0;
      e[0xb4] = 0x3f800000;
      e[0xb7] = 0;
      fVar2 = (float)k_1030e748;
      e[0xb5] = 4;
      if (fVar1 < fVar2) {
        fVar1 = k_1030e750;
      }
      e[0xba] = f32_raw(fVar1);
      fVar1 = fVar4 * fVar4 * k_1030e758;
      e[0xbd] = 0;
      e[0xbc] = 0;
      dVar19 = (double)fVar1;
      e[0xb8] = 0;
      e[0xb9] = 0;
      e[0xbb] = 2;
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 0x80) {
        uVar14 = 0x80;
      }
      fVar1 = (float)k_1030e760;
      e[0xc2] = 0;
      e[0xc3] = e[0x1bc];
      e[0xc1] = 3;
      e[0xbe] = uVar14;
      e[0xc0] = 0;
      e[0xbf] = f32_raw((fVar1 / (float)(int)uVar14));
      fVar1 = f32_bits(p[abd::axionik::SlotIdx::R1ResEnvA]);
      fVar2 = f32_bits(p[abd::axionik::SlotIdx::R1ResEnvD]);
      fVar3 = f32_bits(p[abd::axionik::SlotIdx::R1ResEnvS]);
      fVar4 = f32_bits(p[abd::axionik::SlotIdx::R1ResEnvR]);
      if ((char)e[0x129] == '\0') {
        *(undefined1 *)(e + 0x129) = 1;
      }
      dVar19 = (double)(fVar1 * fVar1 * fVar1 * k_1030e774);
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 1) {
        uVar14 = 1;
      }
      e[0xed] = uVar14;
      fVar5 = (float)k_1030e778;
      e[0xef] = 0x36a7c5ac;
      fVar1 = fVar2 * fVar2 * k_1030e78c;
      e[0xf0] = 4;
      dVar19 = (double)fVar1;
      e[0xf1] = 1;
      e[0xf2] = 0;
      e[0xee] = f32_raw((fVar5 / (float)(int)uVar14));
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 1) {
        uVar14 = 1;
      }
      e[0xf4] = f32_raw(((float)k_1030e790 / (float)(int)uVar14));
      fVar1 = (fVar3 + fVar3) - fVar3 * fVar3;
      e[0xf3] = uVar14;
      e[0xf7] = 0;
      e[0xf5] = 0x3f800000;
      e[0xf8] = 0;
      fVar2 = (float)k_1030e7a8;
      e[0xf6] = 4;
      if (fVar1 < fVar2) {
        fVar1 = k_1030e7b0;
      }
      e[0xfb] = f32_raw(fVar1);
      fVar1 = fVar4 * fVar4 * k_1030e7b8;
      e[0xfe] = 0;
      e[0xfd] = 0;
      dVar19 = (double)fVar1;
      e[0xf9] = 0;
      e[0xfa] = 0;
      e[0xfc] = 2;
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 0x80) {
        uVar14 = 0x80;
      }
      fVar1 = (float)k_1030e7c0;
      e[0x103] = 0;
      e[0x104] = e[0x1bb];
      e[0x102] = 3;
      e[0xff] = uVar14;
      e[0x101] = 0;
      e[0x100] = f32_raw((fVar1 / (float)(int)uVar14));
      e[0x167] = p[abd::axionik::SlotIdx::R1FreeEnvDepth];
      if (e[0xf] == 0) {
        fVar1 = f32_bits(p[abd::axionik::SlotIdx::R1FreeEnvA]);
        fVar2 = f32_bits(p[abd::axionik::SlotIdx::R1FreeEnvD]);
        fVar3 = f32_bits(p[abd::axionik::SlotIdx::R1FreeEnvS]);
        fVar4 = f32_bits(p[abd::axionik::SlotIdx::R1FreeEnvR]);
        if ((char)e[0x1a4] == '\0') {
          *(undefined1 *)(e + 0x1a4) = 1;
        }
        dVar19 = (double)(fVar1 * fVar1 * fVar1 * k_1030e7d4);
        uVar14 = trunc_i32(dVar19);
        if ((int)uVar14 < 1) {
          uVar14 = 1;
        }
        e[0x168] = uVar14;
        fVar5 = (float)k_1030e7d8;
        e[0x16a] = 0x36a7c5ac;
        fVar1 = fVar2 * fVar2 * k_1030e7ec;
        e[0x16b] = 4;
        dVar19 = (double)fVar1;
        e[0x16c] = 1;
        e[0x16d] = 0;
        e[0x169] = f32_raw((fVar5 / (float)(int)uVar14));
        uVar14 = trunc_i32(dVar19);
        if ((int)uVar14 < 1) {
          uVar14 = 1;
        }
        e[0x16f] = f32_raw(((float)k_1030e7f0 / (float)(int)uVar14));
        fVar1 = (fVar3 + fVar3) - fVar3 * fVar3;
        e[0x16e] = uVar14;
        e[0x172] = 0;
        e[0x170] = 0x3f800000;
        e[0x173] = 0;
        fVar2 = (float)k_1030e808;
        e[0x171] = 4;
        if (fVar1 < fVar2) {
          fVar1 = k_1030e810;
        }
        e[0x176] = f32_raw(fVar1);
        fVar1 = fVar4 * fVar4 * k_1030e818;
        e[0x179] = 0;
        e[0x178] = 0;
        dVar19 = (double)fVar1;
        e[0x174] = 0;
        e[0x175] = 0;
        e[0x177] = 2;
        uVar14 = trunc_i32(dVar19);
        if ((int)uVar14 < 0x80) {
          uVar14 = 0x80;
        }
        fVar1 = (float)k_1030e820;
        e[0x17a] = uVar14;
        e[0x17f] = e[0x1bd];
        e[0x17c] = 0;
        e[0x17d] = 3;
        e[0x17e] = 0;
        e[0x17b] = f32_raw((fVar1 / (float)(int)uVar14));
      }
      if ((float)k_1030e838 <= f32_bits(p[abd::axionik::SlotIdx::R2Switch])) {
        e[0x203] = 1;
      }
      else {
        e[0x203] = 0;
      }
      fVar1 = (float)k_1030e858;
      e[0x307] = f32_raw(((float)k_1030e848 * f32_bits(p[abd::axionik::SlotIdx::R2ModelSizeKeyTrack]) + (float)k_1030e840));
      e[0x308] = f32_raw((fVar1 * f32_bits(p[abd::axionik::SlotIdx::R2ModelSizeOffset]) + (float)k_1030e850));
      e[0x309] = p[abd::axionik::SlotIdx::R2ModelVelocitySwitch];
      e[0x30a] = p[abd::axionik::SlotIdx::LFOWaveForm];
      e[0x319] = p[abd::axionik::SlotIdx::R2PitchLfoDepth];
      e[0x31b] = p[abd::axionik::SlotIdx::R2AmpLfoDepth];
      fVar1 = f32_bits(p[abd::axionik::SlotIdx::R2Volume]);
      e[0x205] = p[abd::axionik::SlotIdx::R2Volume];
      e[0x206] = f32_raw((fVar1 * fVar1));
      e[0x30c] = p[abd::axionik::SlotIdx::R2VolumeVelocityDepth];
      e[0x31c] = p[abd::axionik::SlotIdx::R2AmpKeyTrack];
      e[0x31a] = p[abd::axionik::SlotIdx::R2PitchKeyTrack];
      e[0x321] = p[abd::axionik::SlotIdx::R2FreeADSR2PitchDepth];
      e[0x321] = p[abd::axionik::SlotIdx::R2FreeADSR2PitchDepth];
      e[0x322] = p[abd::axionik::SlotIdx::R2Free4L4TPitchDepth];
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::R2ResEnvMode]);
      uVar14 = trunc_i32(dVar19);
      e[0x31d] = uVar14;
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::R2AmpEnvMode]);
      uVar14 = trunc_i32(dVar19);
      e[0x31e] = uVar14;
      dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::R2FreeEnvMode]);
      uVar14 = trunc_i32(dVar19);
      e[799] = uVar14;
      dVar19 = k_1030e870;
      e[0x207] = f32_raw((f32_bits(p[abd::axionik::SlotIdx::R2Octave]) - k_1030e860));
      e[0x208] = p[abd::axionik::SlotIdx::R2Semi];
      dVar18 = k_1030e868;
      dVar19 = ((double)f32_bits(e[0x207]) * k_1030e878 + dVar19 * (double)f32_bits(e[0x208])
               + (double)f32_bits(p[abd::axionik::SlotIdx::R2Cents])) * k_1030e880;
      e[0x209] = p[abd::axionik::SlotIdx::R2Cents];
      dVar19 = std::pow(dVar18,dVar19);
      e[0x364] = 0;
      e[0x363] = 0;
      e[0x204] = f32_raw((f32_bits(e[0x36b]) * f32_bits(e[0x36a]) * (float)dVar19));
      e[0x362] = 0;
      e[0x361] = 0;
      e[0x360] = 0;
      e[0x35f] = 0;
      if (f32_bits(p[abd::axionik::SlotIdx::R2L1ContourScape]) == k_1030e8a0) {
        e[0x35f] = 0x3f800000;
      }
      if (f32_bits(p[abd::axionik::SlotIdx::R2L1ContourSphere]) == k_1030e8a8) {
        e[0x360] = 0x3f800000;
      }
      if (f32_bits(p[abd::axionik::SlotIdx::R2L2ContourScape]) == k_1030e8b0) {
        e[0x361] = 0x3f800000;
      }
      if (f32_bits(p[abd::axionik::SlotIdx::R2L2ContourSphere]) == k_1030e8b8) {
        e[0x362] = 0x3f800000;
      }
      if (f32_bits(p[abd::axionik::SlotIdx::R2L3ContourScape]) == k_1030e8c0) {
        e[0x363] = 0x3f800000;
      }
      if (f32_bits(p[abd::axionik::SlotIdx::R2L3ContourSphere]) == k_1030e8c8) {
        e[0x364] = 0x3f800000;
      }
      e[0x30b] = p[abd::axionik::SlotIdx::R2ParaEnvVelocityDepth];
      e[0x30d] = f32_raw((f32_bits(e[0x35f]) * f32_bits(p[abd::axionik::SlotIdx::R2L1Scape1EnvDepth])));
      e[0x30e] = f32_raw((f32_bits(e[0x35f]) * f32_bits(p[abd::axionik::SlotIdx::R2L1Scape2EnvDepth])));
      e[0x30f] = f32_raw((f32_bits(e[0x360]) * f32_bits(p[abd::axionik::SlotIdx::R2L1Sphere1EnvDepth])));
      e[0x310] = f32_raw((f32_bits(e[0x360]) * f32_bits(p[abd::axionik::SlotIdx::R2L1Sphere2EnvDepth])));
      e[0x311] = f32_raw((f32_bits(e[0x361]) * f32_bits(p[abd::axionik::SlotIdx::R2L2Scape1EnvDepth])));
      e[0x312] = f32_raw((f32_bits(e[0x361]) * f32_bits(p[abd::axionik::SlotIdx::R2L2Scape2EnvDepth])));
      e[0x313] = f32_raw((f32_bits(e[0x362]) * f32_bits(p[abd::axionik::SlotIdx::R2L2Sphere1EnvDepth])));
      e[0x314] = f32_raw((f32_bits(e[0x362]) * f32_bits(p[abd::axionik::SlotIdx::R2L2Sphere2EnvDepth])));
      e[0x315] = f32_raw((f32_bits(e[0x363]) * f32_bits(p[abd::axionik::SlotIdx::R2L3Scape1EnvDepth])));
      e[0x316] = f32_raw((f32_bits(e[0x363]) * f32_bits(p[abd::axionik::SlotIdx::R2L3Scape2EnvDepth])));
      e[0x317] = f32_raw((f32_bits(e[0x364]) * f32_bits(p[abd::axionik::SlotIdx::R2L3Sphere1EnvDepth])));
      e[0x318] = f32_raw((f32_bits(e[0x364]) * f32_bits(p[abd::axionik::SlotIdx::R2L3Sphere2EnvDepth])));
      e[0x323] = p[abd::axionik::SlotIdx::R2L1Scape1LfoDepth];
      e[0x324] = p[abd::axionik::SlotIdx::R2L1Scape2LfoDepth];
      e[0x325] = p[abd::axionik::SlotIdx::R2L1Sphere1LfoDepth];
      e[0x326] = p[abd::axionik::SlotIdx::R2L1Sphere2LfoDepth];
      e[0x327] = p[abd::axionik::SlotIdx::R2L2Scape1LfoDepth];
      e[0x328] = p[abd::axionik::SlotIdx::R2L2Scape2LfoDepth];
      e[0x329] = p[abd::axionik::SlotIdx::R2L2Sphere1LfoDepth];
      e[0x32a] = p[abd::axionik::SlotIdx::R2L2Sphere2LfoDepth];
      e[0x32b] = p[abd::axionik::SlotIdx::R2L3Scape1LfoDepth];
      e[0x32c] = p[abd::axionik::SlotIdx::R2L3Scape2LfoDepth];
      e[0x32d] = p[abd::axionik::SlotIdx::R2L3Sphere1LfoDepth];
      e[0x32e] = p[abd::axionik::SlotIdx::R2L3Sphere2LfoDepth];
      e[0x32f] = p[abd::axionik::SlotIdx::R2L1Scape1VelocityDepth];
      e[0x330] = p[abd::axionik::SlotIdx::R2L1Scape2VelocityDepth];
      e[0x331] = p[abd::axionik::SlotIdx::R2L1Sphere1VelocityDepth];
      e[0x332] = p[abd::axionik::SlotIdx::R2L1Sphere2VelocityDepth];
      e[0x333] = p[abd::axionik::SlotIdx::R2L2Scape1VelocityDepth];
      e[0x334] = p[abd::axionik::SlotIdx::R2L2Scape2VelocityDepth];
      e[0x335] = p[abd::axionik::SlotIdx::R2L2Sphere1VelocityDepth];
      e[0x336] = p[abd::axionik::SlotIdx::R2L2Sphere2VelocityDepth];
      e[0x337] = p[abd::axionik::SlotIdx::R2L3Scape1VelocityDepth];
      e[0x338] = p[abd::axionik::SlotIdx::R2L3Scape2VelocityDepth];
      e[0x339] = p[abd::axionik::SlotIdx::R2L3Sphere1VelocityDepth];
      e[0x33a] = p[abd::axionik::SlotIdx::R2L3Sphere2VelocityDepth];
      e[0x33b] = p[abd::axionik::SlotIdx::R2L1Scape1KeyTrack];
      dVar19 = k_1030e8d8;
      e[0x33c] = p[abd::axionik::SlotIdx::R2L1Scape2KeyTrack];
      e[0x33d] = p[abd::axionik::SlotIdx::R2L1Sphere1KeyTrack];
      e[0x33e] = p[abd::axionik::SlotIdx::R2L1Sphere2KeyTrack];
      e[0x33f] = p[abd::axionik::SlotIdx::R2L2Scape1KeyTrack];
      e[0x340] = p[abd::axionik::SlotIdx::R2L2Scape2KeyTrack];
      e[0x341] = p[abd::axionik::SlotIdx::R2L2Sphere1KeyTrack];
      e[0x342] = p[abd::axionik::SlotIdx::R2L2Sphere2KeyTrack];
      e[0x343] = p[abd::axionik::SlotIdx::R2L3Scape1KeyTrack];
      e[0x344] = p[abd::axionik::SlotIdx::R2L3Scape2KeyTrack];
      e[0x345] = p[abd::axionik::SlotIdx::R2L3Sphere1KeyTrack];
      e[0x346] = p[abd::axionik::SlotIdx::R2L3Sphere2KeyTrack];
      dVar18 = k_1030e900;
      dVar19 = dVar19 * (double)f32_bits(p[abd::axionik::SlotIdx::R2L1Scape1Value]) + k_1030e8d0;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e8e0 <= fVar17) {
        if ((long double)k_1030ece8 < fVar17) {
          fVar17 = (long double)k_1030ecf0;
        }
      }
      else {
        fVar17 = (long double)k_1030e8e8;
      }
      e[0x347] = f32_raw((float)(fVar17 * (long double)k_1030e8f0));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R2L1Scape2Value]) + k_1030e8f8;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e908 <= fVar17) {
        if ((long double)k_1030ecd8 < fVar17) {
          fVar17 = (long double)k_1030ece0;
        }
      }
      else {
        fVar17 = (long double)k_1030e910;
      }
      fVar1 = (float)k_1030e928;
      e[0x348] = f32_raw((float)(fVar17 * (long double)k_1030e918));
      fVar2 = (float)k_1030e920;
      e[0x34a] = f32_raw((fVar1 - f32_bits(e[0x348])));
      e[0x349] = f32_raw((fVar2 - f32_bits(e[0x347])));
      dVar18 = k_1030e960;
      dVar19 = (double)(f32_bits(p[abd::axionik::SlotIdx::R2L2Scape1Value]) * (float)k_1030e938 + (float)k_1030e930);
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e940 <= fVar17) {
        if ((long double)k_1030ecc8 < fVar17) {
          fVar17 = (long double)k_1030ecd0;
        }
      }
      else {
        fVar17 = (long double)k_1030e948;
      }
      e[0x34b] = f32_raw((float)(fVar17 * (long double)k_1030e950));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R2L2Scape2Value]) + k_1030e958;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e968 <= fVar17) {
        if ((long double)k_1030ecb8 < fVar17) {
          fVar17 = (long double)k_1030ecc0;
        }
      }
      else {
        fVar17 = (long double)k_1030e970;
      }
      fVar1 = (float)k_1030e988;
      e[0x34c] = f32_raw((float)(fVar17 * (long double)k_1030e978));
      fVar2 = (float)k_1030e980;
      e[0x34e] = f32_raw((fVar1 - f32_bits(e[0x34c])));
      e[0x34d] = f32_raw((fVar2 - f32_bits(e[0x34b])));
      dVar18 = k_1030e9c0;
      dVar19 = (double)(f32_bits(p[abd::axionik::SlotIdx::R2L3Scape1Value]) * (float)k_1030e998 + (float)k_1030e990);
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e9a0 <= fVar17) {
        if ((long double)k_1030eca8 < fVar17) {
          fVar17 = (long double)k_1030ecb0;
        }
      }
      else {
        fVar17 = (long double)k_1030e9a8;
      }
      e[0x34f] = f32_raw((float)(fVar17 * (long double)k_1030e9b0));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R2L3Scape2Value]) + k_1030e9b8;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030e9c8 <= fVar17) {
        if ((long double)k_1030ec98 < fVar17) {
          fVar17 = (long double)k_1030eca0;
        }
      }
      else {
        fVar17 = (long double)k_1030e9d0;
      }
      fVar1 = (float)k_1030e9e8;
      e[0x350] = f32_raw((float)(fVar17 * (long double)k_1030e9d8));
      fVar2 = (float)k_1030e9e0;
      e[0x352] = f32_raw((fVar1 - f32_bits(e[0x350])));
      e[0x351] = f32_raw((fVar2 - f32_bits(e[0x34f])));
      dVar18 = k_1030ea20;
      dVar19 = (double)(f32_bits(p[abd::axionik::SlotIdx::R2L1Sphere1Value]) * (float)k_1030e9f8 + (float)k_1030e9f0);
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030ea00 <= fVar17) {
        if ((long double)k_1030ec88 < fVar17) {
          fVar17 = (long double)k_1030ec90;
        }
      }
      else {
        fVar17 = (long double)k_1030ea08;
      }
      e[0x353] = f32_raw((float)(fVar17 * (long double)k_1030ea10));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R2L1Sphere2Value]) + k_1030ea18;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030ea28 <= fVar17) {
        if ((long double)k_1030ec78 < fVar17) {
          fVar17 = (long double)k_1030ec80;
        }
      }
      else {
        fVar17 = (long double)k_1030ea30;
      }
      fVar1 = (float)k_1030ea48;
      e[0x354] = f32_raw((float)(fVar17 * (long double)k_1030ea38));
      fVar2 = (float)k_1030ea40;
      e[0x356] = f32_raw((fVar1 - f32_bits(e[0x354])));
      e[0x355] = f32_raw((fVar2 - f32_bits(e[0x353])));
      dVar18 = k_1030ea80;
      dVar19 = (double)(f32_bits(p[abd::axionik::SlotIdx::R2L2Sphere1Value]) * (float)k_1030ea58 + (float)k_1030ea50);
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030ea60 <= fVar17) {
        if ((long double)k_1030ec68 < fVar17) {
          fVar17 = (long double)k_1030ec70;
        }
      }
      else {
        fVar17 = (long double)k_1030ea68;
      }
      e[0x357] = f32_raw((float)(fVar17 * (long double)k_1030ea70));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R2L2Sphere2Value]) + k_1030ea78;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030ea88 <= fVar17) {
        if ((long double)k_1030ec58 < fVar17) {
          fVar17 = (long double)k_1030ec60;
        }
      }
      else {
        fVar17 = (long double)k_1030ea90;
      }
      fVar1 = (float)k_1030eaa8;
      e[0x358] = f32_raw((float)(fVar17 * (long double)k_1030ea98));
      fVar2 = (float)k_1030eaa0;
      e[0x35a] = f32_raw((fVar1 - f32_bits(e[0x358])));
      e[0x359] = f32_raw((fVar2 - f32_bits(e[0x357])));
      dVar18 = k_1030eae0;
      dVar19 = (double)(f32_bits(p[abd::axionik::SlotIdx::R2L3Sphere1Value]) * (float)k_1030eab8 + (float)k_1030eab0);
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030eac0 <= fVar17) {
        if ((long double)k_1030ec48 < fVar17) {
          fVar17 = (long double)k_1030ec50;
        }
      }
      else {
        fVar17 = (long double)k_1030eac8;
      }
      e[0x35b] = f32_raw((float)(fVar17 * (long double)k_1030ead0));
      dVar19 = dVar18 * (double)f32_bits(p[abd::axionik::SlotIdx::R2L3Sphere2Value]) + k_1030ead8;
      uVar14 = trunc_i32(dVar19);
      fVar17 = (long double)(int)uVar14;
      if ((long double)k_1030eae8 <= fVar17) {
        if ((long double)k_1030ec38 < fVar17) {
          fVar17 = (long double)k_1030ec40;
        }
      }
      else {
        fVar17 = (long double)k_1030eaf0;
      }
      fVar1 = (float)k_1030eb08;
      e[0x35c] = f32_raw((float)(fVar17 * (long double)k_1030eaf8));
      fVar2 = (float)k_1030eb00;
      e[0x35e] = f32_raw((fVar1 - f32_bits(e[0x35c])));
      e[0x35d] = f32_raw((fVar2 - f32_bits(e[0x35b])));
      fVar1 = f32_bits(p[abd::axionik::SlotIdx::R2AmpEnvA]);
      fVar2 = f32_bits(p[abd::axionik::SlotIdx::R2AmpEnvD]);
      fVar3 = f32_bits(p[abd::axionik::SlotIdx::R2AmpEnvS]);
      fVar4 = f32_bits(p[abd::axionik::SlotIdx::R2AmpEnvR]);
      if ((char)e[0x24a] == '\0') {
        *(undefined1 *)(e + 0x24a) = 1;
      }
      dVar19 = (double)(fVar1 * fVar1 * fVar1 * k_1030eb10);
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 1) {
        uVar14 = 1;
      }
      e[0x20e] = uVar14;
      fVar5 = (float)k_1030eb18;
      e[0x210] = 0x36a7c5ac;
      fVar1 = fVar2 * fVar2 * k_1030eb2c;
      e[0x211] = 4;
      dVar19 = (double)fVar1;
      e[0x212] = 1;
      e[0x213] = 0;
      e[0x20f] = f32_raw((fVar5 / (float)(int)uVar14));
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 1) {
        uVar14 = 1;
      }
      e[0x215] = f32_raw(((float)k_1030eb30 / (float)(int)uVar14));
      fVar1 = (fVar3 + fVar3) - fVar3 * fVar3;
      e[0x214] = uVar14;
      e[0x218] = 0;
      e[0x216] = 0x3f800000;
      e[0x219] = 0;
      fVar2 = (float)k_1030eb48;
      e[0x217] = 4;
      if (fVar1 < fVar2) {
        fVar1 = k_1030eb50;
      }
      e[0x21c] = f32_raw(fVar1);
      fVar1 = fVar4 * fVar4 * k_1030eb58;
      e[0x21f] = 0;
      e[0x21e] = 0;
      dVar19 = (double)fVar1;
      e[0x21a] = 0;
      e[0x21b] = 0;
      e[0x21d] = 2;
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 0x80) {
        uVar14 = 0x80;
      }
      fVar1 = (float)k_1030eb60;
      e[0x224] = 0;
      e[0x225] = e[0x31e];
      e[0x223] = 3;
      e[0x220] = uVar14;
      e[0x222] = 0;
      e[0x221] = f32_raw((fVar1 / (float)(int)uVar14));
      fVar1 = f32_bits(p[abd::axionik::SlotIdx::R2ResEnvA]);
      fVar2 = f32_bits(p[abd::axionik::SlotIdx::R2ResEnvD]);
      fVar3 = f32_bits(p[abd::axionik::SlotIdx::R2ResEnvS]);
      fVar4 = f32_bits(p[abd::axionik::SlotIdx::R2ResEnvR]);
      if ((char)e[0x28b] == '\0') {
        *(undefined1 *)(e + 0x28b) = 1;
      }
      dVar19 = (double)(fVar1 * fVar1 * fVar1 * k_1030eb74);
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 1) {
        uVar14 = 1;
      }
      e[0x24f] = uVar14;
      fVar5 = (float)k_1030eb78;
      e[0x251] = 0x36a7c5ac;
      fVar1 = fVar2 * fVar2 * k_1030eb8c;
      e[0x252] = 4;
      dVar19 = (double)fVar1;
      e[0x253] = 1;
      e[0x254] = 0;
      e[0x250] = f32_raw((fVar5 / (float)(int)uVar14));
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 1) {
        uVar14 = 1;
      }
      e[0x256] = f32_raw(((float)k_1030eb90 / (float)(int)uVar14));
      fVar1 = (fVar3 + fVar3) - fVar3 * fVar3;
      e[0x255] = uVar14;
      e[0x259] = 0;
      e[599] = 0x3f800000;
      e[0x25a] = 0;
      fVar2 = (float)k_1030eba8;
      e[600] = 4;
      if (fVar1 < fVar2) {
        fVar1 = k_1030ebb0;
      }
      e[0x25d] = f32_raw(fVar1);
      fVar1 = fVar4 * fVar4 * k_1030ebb8;
      e[0x260] = 0;
      e[0x25f] = 0;
      dVar19 = (double)fVar1;
      e[0x25b] = 0;
      e[0x25c] = 0;
      e[0x25e] = 2;
      uVar14 = trunc_i32(dVar19);
      if ((int)uVar14 < 0x80) {
        uVar14 = 0x80;
      }
      fVar1 = (float)k_1030ebc0;
      e[0x265] = 0;
      e[0x266] = e[0x31d];
      e[0x264] = 3;
      e[0x261] = uVar14;
      e[0x263] = 0;
      e[0x262] = f32_raw((fVar1 / (float)(int)uVar14));
      e[0x2c9] = p[abd::axionik::SlotIdx::R2FreeEnvDepth];
      if (e[0xf] == 0) {
        fVar1 = f32_bits(p[abd::axionik::SlotIdx::R2FreeEnvA]);
        fVar2 = f32_bits(p[abd::axionik::SlotIdx::R2FreeEnvD]);
        fVar3 = f32_bits(p[abd::axionik::SlotIdx::R2FreeEnvS]);
        fVar4 = f32_bits(p[abd::axionik::SlotIdx::R2FreeEnvR]);
        if ((char)e[0x306] == '\0') {
          *(undefined1 *)(e + 0x306) = 1;
        }
        dVar19 = (double)(fVar1 * fVar1 * fVar1 * k_1030ebd4);
        uVar14 = trunc_i32(dVar19);
        if ((int)uVar14 < 1) {
          uVar14 = 1;
        }
        e[0x2ca] = uVar14;
        fVar5 = (float)k_1030ebd8;
        e[0x2cc] = 0x36a7c5ac;
        fVar1 = fVar2 * fVar2 * k_1030ebec;
        e[0x2cd] = 4;
        dVar19 = (double)fVar1;
        e[0x2ce] = 1;
        e[0x2cf] = 0;
        e[0x2cb] = f32_raw((fVar5 / (float)(int)uVar14));
        uVar14 = trunc_i32(dVar19);
        if ((int)uVar14 < 1) {
          uVar14 = 1;
        }
        e[0x2d1] = f32_raw(((float)k_1030ebf0 / (float)(int)uVar14));
        fVar1 = (fVar3 + fVar3) - fVar3 * fVar3;
        e[0x2d0] = uVar14;
        e[0x2d4] = 0;
        e[0x2d2] = 0x3f800000;
        e[0x2d5] = 0;
        fVar2 = (float)k_1030ec08;
        e[0x2d3] = 4;
        if (fVar1 < fVar2) {
          fVar1 = k_1030ec10;
        }
        e[0x2d8] = f32_raw(fVar1);
        fVar1 = fVar4 * fVar4 * k_1030ec18;
        e[0x2db] = 0;
        e[0x2da] = 0;
        dVar19 = (double)fVar1;
        e[0x2d6] = 0;
        e[0x2d7] = 0;
        e[0x2d9] = 2;
        uVar14 = trunc_i32(dVar19);
        if ((int)uVar14 < 0x80) {
          uVar14 = 0x80;
        }
        fVar1 = (float)k_1030ec20;
        e[0x2dc] = uVar14;
        e[0x2e1] = e[799];
        e[0x2de] = 0;
        e[0x2df] = 3;
        e[0x2e0] = 0;
        e[0x2dd] = f32_raw((fVar1 / (float)(int)uVar14));
      }
      pcVar10 = (char *)(uintptr_t)e[0xd94];
      if (pcVar10 != nullptr && *pcVar10 != '\0') {
        *(uint *)(pcVar10 + 4) = p[abd::axionik::SlotIdx::SlicerSwitchType];
        dVar19 = (double)f32_bits(p[abd::axionik::SlotIdx::SlicerWaveForm]);
        uVar14 = trunc_i32(dVar19);
        *(uint *)(pcVar10 + 8) = uVar14;
        *(uint *)(pcVar10 + 0xc) = p[abd::axionik::SlotIdx::SlicerDepth];
        *(uint *)(pcVar10 + 0x10) = p[abd::axionik::SlotIdx::SlicerRate];
      }
      translateSubObject((void*)(uintptr_t)e[0xd95], p);
      cVar13 = validateEngineState(e);
      if (cVar13 != '\0') {
        *(undefined1 *)((uintptr_t)e + 0xd99) = 1;
      }
    }
    return;
  }
  return;
}

}  // namespace neuron
