; NeuronVS.dll - callback de observador stModDest
; rango 0x100135d0..0x100135fb (44 B)
; instalado por FUN_1000be10 en params+0x70+i*0x18 (bucle de 6 controles)
; volcado con capstone desde NeuronVS.dll (no esta en NeuronVS_decompiled/INDEX.md)

  0x100135d0  8b44240c             mov      eax, dword ptr [esp + 0xc]
  0x100135d4  53                   push     ebx
  0x100135d5  56                   push     esi
  0x100135d6  57                   push     edi
  0x100135d7  8b30                 mov      esi, dword ptr [eax]
  0x100135d9  8b7804               mov      edi, dword ptr [eax + 4]
  0x100135dc  8b442410             mov      eax, dword ptr [esp + 0x10]
  0x100135e0  8b5cbe14             mov      ebx, dword ptr [esi + edi*4 + 0x14]
  0x100135e4  d94004               fld      dword ptr [eax + 4]
  0x100135e7  e8badd0000           call     0x100213a6
  0x100135ec  53                   push     ebx
  0x100135ed  8bce                 mov      ecx, esi
  0x100135ef  8944be14             mov      dword ptr [esi + edi*4 + 0x14], eax
  0x100135f3  e8e8feffff           call     0x100134e0
  0x100135f8  5f                   pop      edi
  0x100135f9  5e                   pop      esi
  0x100135fa  5b                   pop      ebx
  0x100135fb  c3                   ret      

; 18 instrucciones, fin en 0x100135fc
