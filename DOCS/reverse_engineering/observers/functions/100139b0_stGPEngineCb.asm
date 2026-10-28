; NeuronVS.dll - callback de observador stGPEngineCb
; rango 0x100139b0..0x100139c9 (26 B)
; instalado por FUN_1000be10 en params+0xAB (observador 0x298, +0x14)
; volcado con capstone desde NeuronVS.dll (no esta en NeuronVS_decompiled/INDEX.md)

  0x100139b0  8b44240c             mov      eax, dword ptr [esp + 0xc]
  0x100139b4  8b00                 mov      eax, dword ptr [eax]
  0x100139b6  8b4808               mov      ecx, dword ptr [eax + 8]
  0x100139b9  8b10                 mov      edx, dword ptr [eax]
  0x100139bb  8b442404             mov      eax, dword ptr [esp + 4]
  0x100139bf  8b4004               mov      eax, dword ptr [eax + 4]
  0x100139c2  89848a88270000       mov      dword ptr [edx + ecx*4 + 0x2788], eax
  0x100139c9  c3                   ret      

; 8 instrucciones, fin en 0x100139ca
