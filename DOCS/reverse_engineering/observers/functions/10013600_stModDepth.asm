; NeuronVS.dll - callback de observador stModDepth
; rango 0x10013600..0x1001361b (28 B)
; instalado por FUN_1000be10 en params+0x100+i*0x18 (bucle de 6 controles)
; volcado con capstone desde NeuronVS.dll (no esta en NeuronVS_decompiled/INDEX.md)

  0x10013600  8b44240c             mov      eax, dword ptr [esp + 0xc]
  0x10013604  8b542404             mov      edx, dword ptr [esp + 4]
  0x10013608  6aff                 push     -1
  0x1001360a  8b08                 mov      ecx, dword ptr [eax]
  0x1001360c  8b4004               mov      eax, dword ptr [eax + 4]
  0x1001360f  8b5204               mov      edx, dword ptr [edx + 4]
  0x10013612  8954812c             mov      dword ptr [ecx + eax*4 + 0x2c], edx
  0x10013616  e8c5feffff           call     0x100134e0
  0x1001361b  c3                   ret      

; 9 instrucciones, fin en 0x1001361c
