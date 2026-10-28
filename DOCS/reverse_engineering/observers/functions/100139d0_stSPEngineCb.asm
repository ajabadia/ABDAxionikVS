; NeuronVS.dll - callback de observador stSPEngineCb
; rango 0x100139d0..0x10013a79 (170 B)
; instalado por FUN_1000be10 en params+0xB1+i*6 dwords (los 317 observadores restantes)
; volcado con capstone desde NeuronVS.dll (no esta en NeuronVS_decompiled/INDEX.md)

  0x100139d0  8b44240c             mov      eax, dword ptr [esp + 0xc]
  0x100139d4  8b4c2404             mov      ecx, dword ptr [esp + 4]
  0x100139d8  56                   push     esi
  0x100139d9  8b30                 mov      esi, dword ptr [eax]
  0x100139db  d94104               fld      dword ptr [ecx + 4]
  0x100139de  8b460c               mov      eax, dword ptr [esi + 0xc]
  0x100139e1  d9542410             fst      dword ptr [esp + 0x10]
  0x100139e5  85c0                 test     eax, eax
  0x100139e7  7c6d                 jl       0x10013a56
  0x100139e9  83f83e               cmp      eax, 0x3e
  0x100139ec  7f68                 jg       0x10013a56
  0x100139ee  8b16                 mov      edx, dword ptr [esi]
  0x100139f0  d99c827c010000       fstp     dword ptr [edx + eax*4 + 0x17c]
  0x100139f7  8b460c               mov      eax, dword ptr [esi + 0xc]
  0x100139fa  8b0e                 mov      ecx, dword ptr [esi]
  0x100139fc  50                   push     eax
  0x100139fd  e8defaffff           call     0x100134e0
  0x10013a02  8b4608               mov      eax, dword ptr [esi + 8]
  0x10013a05  3da4000000           cmp      eax, 0xa4
  0x10013a0a  752c                 jne      0x10013a38
  0x10013a0c  8b0e                 mov      ecx, dword ptr [esi]
  0x10013a0e  8b542410             mov      edx, dword ptr [esp + 0x10]
  0x10013a12  89510c               mov      dword ptr [ecx + 0xc], edx
  0x10013a15  8b4608               mov      eax, dword ptr [esi + 8]
  0x10013a18  8b0e                 mov      ecx, dword ptr [esi]
  0x10013a1a  8d8c818c270000       lea      ecx, [ecx + eax*4 + 0x278c]
  0x10013a21  d901                 fld      dword ptr [ecx]
  0x10013a23  dc1d009f0410         fcomp    qword ptr [0x10049f00]
  0x10013a29  dfe0                 fnstsw   ax
  0x10013a2b  f6c441               test     ah, 0x41
  0x10013a2e  7548                 jne      0x10013a78
  0x10013a30  8b542410             mov      edx, dword ptr [esp + 0x10]
  0x10013a34  5e                   pop      esi
  0x10013a35  8911                 mov      dword ptr [ecx], edx
  0x10013a37  c3                   ret      
  0x10013a38  3dc2000000           cmp      eax, 0xc2
  0x10013a3d  7539                 jne      0x10013a78
  0x10013a3f  8b06                 mov      eax, dword ptr [esi]
  0x10013a41  8b4c2410             mov      ecx, dword ptr [esp + 0x10]
  0x10013a45  894810               mov      dword ptr [eax + 0x10], ecx
  0x10013a48  8b5608               mov      edx, dword ptr [esi + 8]
  0x10013a4b  8b06                 mov      eax, dword ptr [esi]
  0x10013a4d  8d8c908c270000       lea      ecx, [eax + edx*4 + 0x278c]
  0x10013a54  ebcb                 jmp      0x10013a21
  0x10013a56  8b4608               mov      eax, dword ptr [esi + 8]
  0x10013a59  8b0e                 mov      ecx, dword ptr [esi]
  0x10013a5b  d99c818c270000       fstp     dword ptr [ecx + eax*4 + 0x278c]
  0x10013a62  8b36                 mov      esi, dword ptr [esi]
  0x10013a64  8b8e7c020000         mov      ecx, dword ptr [esi + 0x27c]
  0x10013a6a  8d968c270000         lea      edx, [esi + 0x278c]
  0x10013a70  52                   push     edx
  0x10013a71  6a00                 push     0
  0x10013a73  e8d8ca0200           call     0x10040550
  0x10013a78  5e                   pop      esi
  0x10013a79  c3                   ret      

; 55 instrucciones, fin en 0x10013a7a
