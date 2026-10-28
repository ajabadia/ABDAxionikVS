"""dump_callbacks.py - desensambla los callbacks de observador recuperados a `functions/*.asm`.

Las cinco rutinas de callback no aparecen en `NeuronVS_decompiled/INDEX.md` porque Ghidra
nunca las creo como funciones: solo se referencian por direccion, desde un registro que el
constructor de `params` materializa una vez y reutiliza (`FUN_1000be10`). El volcado sale
de los bytes del PE con capstone, sin depender del descompilado.

Se anade el volcado de `FUN_100134e0`, que si esta en el descompilado pero es el
combinador de la matriz: es el unico sitio donde los seis controles de ejecucion se juntan
con los 63 destinos, y la traza de `OBSERVER_CALLBACKS.md` lo cita instruccion a
instruccion.

Uso:  python NeuronVS_observers/tools/dump_callbacks.py
"""
from __future__ import annotations

import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
PKG = HERE.parent
ROOT = PKG.parent
sys.path.insert(0, str(ROOT / "_tools"))

import pe_read  # noqa: E402
from capstone import Cs, CS_ARCH_X86, CS_MODE_32  # noqa: E402

# (inicio, fin exclusivo, nombre, quien la instala, tipo)
CALLBACKS = [
    (0x10013620, 0x100139AD, "ModelIndexChange", "params+0xA5 (observador 0x280, +0x14)", "callback"),
    (0x100135D0, 0x100135FC, "stModDest", "params+0x70+i*0x18 (bucle de 6 controles)", "callback"),
    (0x10013600, 0x1001361C, "stModDepth", "params+0x100+i*0x18 (bucle de 6 controles)", "callback"),
    (0x100139B0, 0x100139CA, "stGPEngineCb", "params+0xAB (observador 0x298, +0x14)", "callback"),
    (0x100139D0, 0x10013A7A, "stSPEngineCb", "params+0xB1+i*6 dwords (los 317 observadores restantes)", "callback"),
    (0x100134E0, 0x100135CD, "FUN_100134e0",
     "stModDest (0x100135d0), stModDepth (0x10013600) y FUN_10013490 (CC)", "combinador"),
]


def main() -> int:
    pe = pe_read.PE(pe_read.DLL)
    md = Cs(CS_ARCH_X86, CS_MODE_32)
    out_dir = PKG / "functions"
    out_dir.mkdir(exist_ok=True)
    for start, end, name, installer, kind in CALLBACKS:
        buf = pe.raw[pe.va2off(start):pe.va2off(end)]
        if kind == "callback":
            title = f"; NeuronVS.dll - callback de observador {name}"
            note = f"; instalado por FUN_1000be10 en {installer}"
            origin = "; volcado con capstone desde NeuronVS.dll (no esta en NeuronVS_decompiled/INDEX.md)"
        else:
            title = f"; NeuronVS.dll - combinador de la matriz de modulacion {name}"
            note = f"; lo llaman {installer}"
            origin = "; volcado con capstone desde NeuronVS.dll (tambien en NeuronVS_decompiled/INDEX.md)"
        lines = [
            title,
            f"; rango {start:#010x}..{end - 1:#010x} ({(end - start)} B)",
            note,
            origin,
            "",
        ]
        addr, off, n = start, 0, 0
        while off < len(buf):
            got = list(md.disasm(buf[off:off + 15], addr))
            if not got:
                lines.append(f"  {addr:#010x}  ???")
                break
            t = got[0]
            lines.append(f"  {t.address:#010x}  {t.bytes.hex():<20} {t.mnemonic:<8} {t.op_str}")
            off += t.size
            addr += t.size
            n += 1
        lines.append("")
        lines.append(f"; {n} instrucciones, fin en {addr:#010x}")
        target = out_dir / f"{start:08x}_{name}.asm"
        target.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"{target.relative_to(ROOT)}: {n} instrucciones, {end - start} B")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
