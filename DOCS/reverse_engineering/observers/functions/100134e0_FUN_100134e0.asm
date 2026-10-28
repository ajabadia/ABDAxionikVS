; NeuronVS.dll - combinador de la matriz de modulacion FUN_100134e0
; rango 0x100134e0..0x100135cc (237 B)
; lo llaman stModDest (0x100135d0), stModDepth (0x10013600) y FUN_10013490 (CC)
; volcado con capstone desde NeuronVS.dll (tambien en NeuronVS_decompiled/INDEX.md)

  0x100134e0  81ec00010000         sub      esp, 0x100
  0x100134e6  53                   push     ebx
  0x100134e7  55                   push     ebp
  0x100134e8  56                   push     esi
  0x100134e9  57                   push     edi
  0x100134ea  8d7914               lea      edi, [ecx + 0x14]
  0x100134ed  b301                 mov      bl, 1
  0x100134ef  8bf7                 mov      esi, edi
  0x100134f1  bd06000000           mov      ebp, 6
  0x100134f6  8b06                 mov      eax, dword ptr [esi]
  0x100134f8  8b942414010000       mov      edx, dword ptr [esp + 0x114]
  0x100134ff  3bd0                 cmp      edx, eax
  0x10013501  7502                 jne      0x10013505
  0x10013503  32db                 xor      bl, bl
  0x10013505  8b94817c010000       mov      edx, dword ptr [ecx + eax*4 + 0x17c]
  0x1001350c  83c604               add      esi, 4
  0x1001350f  4d                   dec      ebp
  0x10013510  89548414             mov      dword ptr [esp + eax*4 + 0x14], edx
  0x10013514  75e0                 jne      0x100134f6
  0x10013516  8d4144               lea      eax, [ecx + 0x44]
  0x10013519  be06000000           mov      esi, 6
  0x1001351e  8b50d0               mov      edx, dword ptr [eax - 0x30]
  0x10013521  d940e8               fld      dword ptr [eax - 0x18]
  0x10013524  d808                 fmul     dword ptr [eax]
  0x10013526  8d549414             lea      edx, [esp + edx*4 + 0x14]
  0x1001352a  83c004               add      eax, 4
  0x1001352d  4e                   dec      esi
  0x1001352e  d802                 fadd     dword ptr [edx]
  0x10013530  d91a                 fstp     dword ptr [edx]
  0x10013532  75ea                 jne      0x1001351e
  0x10013534  bd06000000           mov      ebp, 6
  0x10013539  8b07                 mov      eax, dword ptr [edi]
  0x1001353b  8b1485009e0410       mov      edx, dword ptr [eax*4 + 0x10049e00]
  0x10013542  8d3452               lea      esi, [edx + edx*2]
  0x10013545  d984f1b0020000       fld      dword ptr [ecx + esi*8 + 0x2b0]
  0x1001354c  8d34f1               lea      esi, [ecx + esi*8]
  0x1001354f  d8548414             fcom     dword ptr [esp + eax*4 + 0x14]
  0x10013553  8bb6b4020000         mov      esi, dword ptr [esi + 0x2b4]
  0x10013559  89742410             mov      dword ptr [esp + 0x10], esi
  0x1001355d  8d748414             lea      esi, [esp + eax*4 + 0x14]
  0x10013561  dfe0                 fnstsw   ax
  0x10013563  f6c441               test     ah, 0x41
  0x10013566  7417                 je       0x1001357f
  0x10013568  ddd8                 fstp     st(0)
  0x1001356a  d906                 fld      dword ptr [esi]
  0x1001356c  d85c2410             fcomp    dword ptr [esp + 0x10]
  0x10013570  dfe0                 fnstsw   ax
  0x10013572  f6c441               test     ah, 0x41
  0x10013575  7506                 jne      0x1001357d
  0x10013577  d9442410             fld      dword ptr [esp + 0x10]
  0x1001357b  eb02                 jmp      0x1001357f
  0x1001357d  d906                 fld      dword ptr [esi]
  0x1001357f  d99c918c270000       fstp     dword ptr [ecx + edx*4 + 0x278c]
  0x10013586  83c704               add      edi, 4
  0x10013589  4d                   dec      ebp
  0x1001358a  75ad                 jne      0x10013539
  0x1001358c  5f                   pop      edi
  0x1001358d  5e                   pop      esi
  0x1001358e  5d                   pop      ebp
  0x1001358f  84db                 test     bl, bl
  0x10013591  5b                   pop      ebx
  0x10013592  741c                 je       0x100135b0
  0x10013594  8b842404010000       mov      eax, dword ptr [esp + 0x104]
  0x1001359b  8b1485009e0410       mov      edx, dword ptr [eax*4 + 0x10049e00]
  0x100135a2  8b84817c010000       mov      eax, dword ptr [ecx + eax*4 + 0x17c]
  0x100135a9  8984918c270000       mov      dword ptr [ecx + edx*4 + 0x278c], eax
  0x100135b0  8d918c270000         lea      edx, [ecx + 0x278c]
  0x100135b6  8b897c020000         mov      ecx, dword ptr [ecx + 0x27c]
  0x100135bc  52                   push     edx
  0x100135bd  6a00                 push     0
  0x100135bf  e88ccf0200           call     0x10040550
  0x100135c4  81c400010000         add      esp, 0x100
  0x100135ca  c20400               ret      4

; 73 instrucciones, fin en 0x100135cd
