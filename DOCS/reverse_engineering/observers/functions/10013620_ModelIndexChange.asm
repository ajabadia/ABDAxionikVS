; NeuronVS.dll - callback de observador ModelIndexChange
; rango 0x10013620..0x100139ac (909 B)
; instalado por FUN_1000be10 en params+0xA5 (observador 0x280, +0x14)
; volcado con capstone desde NeuronVS.dll (no esta en NeuronVS_decompiled/INDEX.md)

  0x10013620  81ec98000000         sub      esp, 0x98
  0x10013626  8b8424a4000000       mov      eax, dword ptr [esp + 0xa4]
  0x1001362d  53                   push     ebx
  0x1001362e  55                   push     ebp
  0x1001362f  56                   push     esi
  0x10013630  8b18                 mov      ebx, dword ptr [eax]
  0x10013632  57                   push     edi
  0x10013633  6a00                 push     0
  0x10013635  895c2430             mov      dword ptr [esp + 0x30], ebx
  0x10013639  8b8b78020000         mov      ecx, dword ptr [ebx + 0x278]
  0x1001363f  8bab7c020000         mov      ebp, dword ptr [ebx + 0x27c]
  0x10013645  896c2424             mov      dword ptr [esp + 0x24], ebp
  0x10013649  8b11                 mov      edx, dword ptr [ecx]
  0x1001364b  8b8c24b4000000       mov      ecx, dword ptr [esp + 0xb4]
  0x10013652  8954241c             mov      dword ptr [esp + 0x1c], edx
  0x10013656  e865defeff           call     0x100014c0
  0x1001365b  e846dd0000           call     0x100213a6
  0x10013660  8bcd                 mov      ecx, ebp
  0x10013662  8bf8                 mov      edi, eax
  0x10013664  e807350300           call     0x10046b70
  0x10013669  e85271ffff           call     0x1000a7c0
  0x1001366e  89442410             mov      dword ptr [esp + 0x10], eax
  0x10013672  8b8424b0000000       mov      eax, dword ptr [esp + 0xb0]
  0x10013679  bee0250510           mov      esi, 0x100525e0
  0x1001367e  8b00                 mov      eax, dword ptr [eax]
  0x10013680  8a10                 mov      dl, byte ptr [eax]
  0x10013682  8aca                 mov      cl, dl
  0x10013684  3a16                 cmp      dl, byte ptr [esi]
  0x10013686  751c                 jne      0x100136a4
  0x10013688  84c9                 test     cl, cl
  0x1001368a  7414                 je       0x100136a0
  0x1001368c  8a5001               mov      dl, byte ptr [eax + 1]
  0x1001368f  8aca                 mov      cl, dl
  0x10013691  3a5601               cmp      dl, byte ptr [esi + 1]
  0x10013694  750e                 jne      0x100136a4
  0x10013696  83c002               add      eax, 2
  0x10013699  83c602               add      esi, 2
  0x1001369c  84c9                 test     cl, cl
  0x1001369e  75e0                 jne      0x10013680
  0x100136a0  33c0                 xor      eax, eax
  0x100136a2  eb05                 jmp      0x100136a9
  0x100136a4  1bc0                 sbb      eax, eax
  0x100136a6  83d8ff               sbb      eax, -1
  0x100136a9  8b9424ac000000       mov      edx, dword ptr [esp + 0xac]
  0x100136b0  33c9                 xor      ecx, ecx
  0x100136b2  85c0                 test     eax, eax
  0x100136b4  d902                 fld      dword ptr [edx]
  0x100136b6  0f95c1               setne    cl
  0x100136b9  894c241c             mov      dword ptr [esp + 0x1c], ecx
  0x100136bd  e8e4dc0000           call     0x100213a6
  0x100136c2  8b742410             mov      esi, dword ptr [esp + 0x10]
  0x100136c6  50                   push     eax
  0x100136c7  8bce                 mov      ecx, esi
  0x100136c9  e84271ffff           call     0x1000a810
  0x100136ce  57                   push     edi
  0x100136cf  8bce                 mov      ecx, esi
  0x100136d1  e8fa70ffff           call     0x1000a7d0
  0x100136d6  85c0                 test     eax, eax
  0x100136d8  0f84ad020000         je       0x1001398b
  0x100136de  8b8c24b0000000       mov      ecx, dword ptr [esp + 0xb0]
  0x100136e5  c744243034000000     mov      dword ptr [esp + 0x30], 0x34
  0x100136ed  c1e705               shl      edi, 5
  0x100136f0  81c7385f0510         add      edi, 0x10055f38
  0x100136f6  c744243435000000     mov      dword ptr [esp + 0x34], 0x35
  0x100136fe  897904               mov      dword ptr [ecx + 4], edi
  0x10013701  8b4c241c             mov      ecx, dword ptr [esp + 0x1c]
  0x10013705  85c9                 test     ecx, ecx
  0x10013707  c744243848000000     mov      dword ptr [esp + 0x38], 0x48
  0x1001370f  c744243c49000000     mov      dword ptr [esp + 0x3c], 0x49
  0x10013717  c74424405c000000     mov      dword ptr [esp + 0x40], 0x5c
  0x1001371f  c74424445d000000     mov      dword ptr [esp + 0x44], 0x5d
  0x10013727  c74424782a000000     mov      dword ptr [esp + 0x78], 0x2a
  0x1001372f  c744247c2b000000     mov      dword ptr [esp + 0x7c], 0x2b
  0x10013737  c78424800000003e000000 mov      dword ptr [esp + 0x80], 0x3e
  0x10013742  c78424840000003f000000 mov      dword ptr [esp + 0x84], 0x3f
  0x1001374d  c784248800000052000000 mov      dword ptr [esp + 0x88], 0x52
  0x10013758  c784248c00000053000000 mov      dword ptr [esp + 0x8c], 0x53
  0x10013763  c744244884000000     mov      dword ptr [esp + 0x48], 0x84
  0x1001376b  c744244c85000000     mov      dword ptr [esp + 0x4c], 0x85
  0x10013773  c744245098000000     mov      dword ptr [esp + 0x50], 0x98
  0x1001377b  c744245499000000     mov      dword ptr [esp + 0x54], 0x99
  0x10013783  c7442458ac000000     mov      dword ptr [esp + 0x58], 0xac
  0x1001378b  c744245cad000000     mov      dword ptr [esp + 0x5c], 0xad
  0x10013793  c74424607a000000     mov      dword ptr [esp + 0x60], 0x7a
  0x1001379b  c74424647b000000     mov      dword ptr [esp + 0x64], 0x7b
  0x100137a3  c74424688e000000     mov      dword ptr [esp + 0x68], 0x8e
  0x100137ab  c744246c8f000000     mov      dword ptr [esp + 0x6c], 0x8f
  0x100137b3  c7442470a2000000     mov      dword ptr [esp + 0x70], 0xa2
  0x100137bb  c7442474a3000000     mov      dword ptr [esp + 0x74], 0xa3
  0x100137c3  750a                 jne      0x100137cf
  0x100137c5  8d542430             lea      edx, [esp + 0x30]
  0x100137c9  8d742478             lea      esi, [esp + 0x78]
  0x100137cd  eb08                 jmp      0x100137d7
  0x100137cf  8d542448             lea      edx, [esp + 0x48]
  0x100137d3  8d742460             lea      esi, [esp + 0x60]
  0x100137d7  8d8c2490000000       lea      ecx, [esp + 0x90]
  0x100137de  c784249000000000000000 mov      dword ptr [esp + 0x90], 0
  0x100137e9  2bca                 sub      ecx, edx
  0x100137eb  2bf2                 sub      esi, edx
  0x100137ed  c784249400000001000000 mov      dword ptr [esp + 0x94], 1
  0x100137f8  c784249800000004000000 mov      dword ptr [esp + 0x98], 4
  0x10013803  c784249c00000005000000 mov      dword ptr [esp + 0x9c], 5
  0x1001380e  c78424a000000008000000 mov      dword ptr [esp + 0xa0], 8
  0x10013819  c78424a400000009000000 mov      dword ptr [esp + 0xa4], 9
  0x10013824  89542414             mov      dword ptr [esp + 0x14], edx
  0x10013828  894c2424             mov      dword ptr [esp + 0x24], ecx
  0x1001382c  89742428             mov      dword ptr [esp + 0x28], esi
  0x10013830  c744241006000000     mov      dword ptr [esp + 0x10], 6
  0x10013838  eb04                 jmp      0x1001383e
  0x1001383a  8b4c2424             mov      ecx, dword ptr [esp + 0x24]
  0x1001383e  8b0c11               mov      ecx, dword ptr [ecx + edx]
  0x10013841  8b12                 mov      edx, dword ptr [edx]
  0x10013843  8b742418             mov      esi, dword ptr [esp + 0x18]
  0x10013847  8d1492               lea      edx, [edx + edx*4]
  0x1001384a  8d34d6               lea      esi, [esi + edx*8]
  0x1001384d  8b948804020000       mov      edx, dword ptr [eax + ecx*4 + 0x204]
  0x10013854  895614               mov      dword ptr [esi + 0x14], edx
  0x10013857  8d14c8               lea      edx, [eax + ecx*8]
  0x1001385a  03d1                 add      edx, ecx
  0x1001385c  8dba34020000         lea      edi, [edx + 0x234]
  0x10013862  81c246020000         add      edx, 0x246
  0x10013868  897e04               mov      dword ptr [esi + 4], edi
  0x1001386b  895608               mov      dword ptr [esi + 8], edx
  0x1001386e  8b7e04               mov      edi, dword ptr [esi + 4]
  0x10013871  8bea                 mov      ebp, edx
  0x10013873  8a1f                 mov      bl, byte ptr [edi]
  0x10013875  8ad3                 mov      dl, bl
  0x10013877  3a5d00               cmp      bl, byte ptr [ebp]
  0x1001387a  751c                 jne      0x10013898
  0x1001387c  84d2                 test     dl, dl
  0x1001387e  7414                 je       0x10013894
  0x10013880  8a5f01               mov      bl, byte ptr [edi + 1]
  0x10013883  8ad3                 mov      dl, bl
  0x10013885  3a5d01               cmp      bl, byte ptr [ebp + 1]
  0x10013888  750e                 jne      0x10013898
  0x1001388a  83c702               add      edi, 2
  0x1001388d  83c502               add      ebp, 2
  0x10013890  84d2                 test     dl, dl
  0x10013892  75df                 jne      0x10013873
  0x10013894  33d2                 xor      edx, edx
  0x10013896  eb05                 jmp      0x1001389d
  0x10013898  1bd2                 sbb      edx, edx
  0x1001389a  83daff               sbb      edx, -1
  0x1001389d  85d2                 test     edx, edx
  0x1001389f  7507                 jne      0x100138a8
  0x100138a1  c7460840510510       mov      dword ptr [esi + 8], 0x10055140
  0x100138a8  8b542428             mov      edx, dword ptr [esp + 0x28]
  0x100138ac  8b742414             mov      esi, dword ptr [esp + 0x14]
  0x100138b0  8b1432               mov      edx, dword ptr [edx + esi]
  0x100138b3  8b742418             mov      esi, dword ptr [esp + 0x18]
  0x100138b7  8d1492               lea      edx, [edx + edx*4]
  0x100138ba  8d34d6               lea      esi, [esi + edx*8]
  0x100138bd  8b9488a0020000       mov      edx, dword ptr [eax + ecx*4 + 0x2a0]
  0x100138c4  895614               mov      dword ptr [esi + 0x14], edx
  0x100138c7  8d5150               lea      edx, [ecx + 0x50]
  0x100138ca  8d3cd0               lea      edi, [eax + edx*8]
  0x100138cd  03d7                 add      edx, edi
  0x100138cf  895604               mov      dword ptr [esi + 4], edx
  0x100138d2  8d94c890020000       lea      edx, [eax + ecx*8 + 0x290]
  0x100138d9  8d4c1152             lea      ecx, [ecx + edx + 0x52]
  0x100138dd  894e08               mov      dword ptr [esi + 8], ecx
  0x100138e0  8b5604               mov      edx, dword ptr [esi + 4]
  0x100138e3  8bf9                 mov      edi, ecx
  0x100138e5  8a1a                 mov      bl, byte ptr [edx]
  0x100138e7  8acb                 mov      cl, bl
  0x100138e9  3a1f                 cmp      bl, byte ptr [edi]
  0x100138eb  751c                 jne      0x10013909
  0x100138ed  84c9                 test     cl, cl
  0x100138ef  7414                 je       0x10013905
  0x100138f1  8a5a01               mov      bl, byte ptr [edx + 1]
  0x100138f4  8acb                 mov      cl, bl
  0x100138f6  3a5f01               cmp      bl, byte ptr [edi + 1]
  0x100138f9  750e                 jne      0x10013909
  0x100138fb  83c202               add      edx, 2
  0x100138fe  83c702               add      edi, 2
  0x10013901  84c9                 test     cl, cl
  0x10013903  75e0                 jne      0x100138e5
  0x10013905  33c9                 xor      ecx, ecx
  0x10013907  eb05                 jmp      0x1001390e
  0x10013909  1bc9                 sbb      ecx, ecx
  0x1001390b  83d9ff               sbb      ecx, -1
  0x1001390e  85c9                 test     ecx, ecx
  0x10013910  7507                 jne      0x10013919
  0x10013912  c7460840510510       mov      dword ptr [esi + 8], 0x10055140
  0x10013919  8b542414             mov      edx, dword ptr [esp + 0x14]
  0x1001391d  8b4c2410             mov      ecx, dword ptr [esp + 0x10]
  0x10013921  83c204               add      edx, 4
  0x10013924  49                   dec      ecx
  0x10013925  89542414             mov      dword ptr [esp + 0x14], edx
  0x10013929  894c2410             mov      dword ptr [esp + 0x10], ecx
  0x1001392d  0f8507ffffff         jne      0x1001383a
  0x10013933  8b7c241c             mov      edi, dword ptr [esp + 0x1c]
  0x10013937  8b6c2420             mov      ebp, dword ptr [esp + 0x20]
  0x1001393b  33f6                 xor      esi, esi
  0x1001393d  8d5804               lea      ebx, [eax + 4]
  0x10013940  8b03                 mov      eax, dword ptr [ebx]
  0x10013942  85c0                 test     eax, eax
  0x10013944  741e                 je       0x10013964
  0x10013946  8b4828               mov      ecx, dword ptr [eax + 0x28]
  0x10013949  8b5024               mov      edx, dword ptr [eax + 0x24]
  0x1001394c  51                   push     ecx
  0x1001394d  8b4820               mov      ecx, dword ptr [eax + 0x20]
  0x10013950  52                   push     edx
  0x10013951  8b5018               mov      edx, dword ptr [eax + 0x18]
  0x10013954  51                   push     ecx
  0x10013955  8b481c               mov      ecx, dword ptr [eax + 0x1c]
  0x10013958  52                   push     edx
  0x10013959  8b5014               mov      edx, dword ptr [eax + 0x14]
  0x1001395c  8b4008               mov      eax, dword ptr [eax + 8]
  0x1001395f  51                   push     ecx
  0x10013960  52                   push     edx
  0x10013961  50                   push     eax
  0x10013962  eb0e                 jmp      0x10013972
  0x10013964  6a00                 push     0
  0x10013966  6a00                 push     0
  0x10013968  6a00                 push     0
  0x1001396a  6a00                 push     0
  0x1001396c  6a00                 push     0
  0x1001396e  6a00                 push     0
  0x10013970  6a00                 push     0
  0x10013972  56                   push     esi
  0x10013973  57                   push     edi
  0x10013974  8bcd                 mov      ecx, ebp
  0x10013976  e855070300           call     0x100440d0
  0x1001397b  46                   inc      esi
  0x1001397c  83c304               add      ebx, 4
  0x1001397f  81fe80000000         cmp      esi, 0x80
  0x10013985  7cb9                 jl       0x10013940
  0x10013987  8b5c242c             mov      ebx, dword ptr [esp + 0x2c]
  0x1001398b  8bcd                 mov      ecx, ebp
  0x1001398d  e8ee9d0200           call     0x1003d780
  0x10013992  81c38c270000         add      ebx, 0x278c
  0x10013998  8bcd                 mov      ecx, ebp
  0x1001399a  53                   push     ebx
  0x1001399b  6a00                 push     0
  0x1001399d  e8aecb0200           call     0x10040550
  0x100139a2  5f                   pop      edi
  0x100139a3  5e                   pop      esi
  0x100139a4  5d                   pop      ebp
  0x100139a5  5b                   pop      ebx
  0x100139a6  81c498000000         add      esp, 0x98
  0x100139ac  c3                   ret      

; 242 instrucciones, fin en 0x100139ad
