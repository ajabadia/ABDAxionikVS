"""verify_observers.py - comprueba contra NeuronVS.dll el mapa de observadores de `params`.

Verifica, sin usar el descompilado como fuente (solo bytes del PE y capstone):

A. que `FUN_1000be10` contiene exactamente **335** llamadas a `FUN_100010a0` y que su
   conjunto de direcciones coincide con la columna `call_va` de
   `params_observers_map.csv`;
B. por fila, que en la ventana previa a la llamada hay un `lea reg,[ebp+obs_off]` con el
   `obs_offset_hex` de la fila, que ese offset cae en la rejilla `0x280 + k*0x18` y que
   solo `0x280` se repite (el observador de `R1ModellIndex`/`R2ModellIndex`);
C. por fila, que el registro de `snddat` enganchado es `snddat + snddat_index*0x28`
   (inmediato de un `add`/`lea` sobre la base de `snddat`);
D. por fila, que existe una tienda al campo `+0x14` del observador (donde vive el
   puntero de callback, ver `OBSERVER_CALLBACKS.md`);
E. que las tres primeras filas llevan los callbacks especiales del ctor
   (`0x10013620` en `+0x294` = observador `0x280`, `0x100139b0` en `+0x2ac` = observador
   `0x298`) y no el universal `0x100139d0`, y que las dos filas del bucle de control
   llevan los que el ctor instala de verdad (`0x100135d0` en `[reg+0x70]`, `0x10013600`
   en `[reg+0x100]`);
F. que la tabla de 63 destinos de modulacion en `.rdata:0x10049E00` (mas terminador 0)
   coincide con las columnas `mod_dest_idx` / `slot_in_p` / `table_10049e00_slot`;
G. que `snddat_key` es la clave `sound_schema.csv[n]` de `NeuronVS_neurondb/`;
H. que las 4 funciones de callback recuperadas existen, desensamblan sin huecos en el
   rango documentado y contienen las referencias que afirma `OBSERVER_CALLBACKS.md`;
I. que el ctor instala esos callbacks con los inmediatos esperados (1x `0x10013620`,
   1x `0x100139b0`, los 12 controles y el universal materializado una sola vez);J. la traza de `FUN_100134e0` (el combinador de la matriz de modulacion) contra su
   desensamblado: los tres registros de cada control, los 63 valores base, la tabla
   `0x10049E00` leida dos veces, la ventana de recorte `0x2B0+slot*0x18`, la rama del
   parametro que cambio sin comprobar el indice (y su escritura fuera del objeto cuando
   llega `-1`), y la llamada final al traductor;
K. que `min_val`/`max_val` de cada fila es el limite que el ctor escribe en el campo
   `+0x00`/`+0x04` del registro de 0x18 B (K1), que las unicas filas sin ventana son las
   dos de `0x280` (K2, 4 campos en blanco) y que la ventana de `0x298` es exactamente 400/480
   tanto en mapa como en el ctor (K3).

Uso:  python NeuronVS_observers/tools/verify_observers.py [-v]
Salida: un bloque OK/FAIL por comprobacion; codigo de salida 1 si algo falla.
"""
from __future__ import annotations

import csv
import pathlib
import re
import struct
import sys

HERE = pathlib.Path(__file__).resolve().parent
PKG = HERE.parent
ROOT = PKG.parent
sys.path.insert(0, str(ROOT / "_tools"))

import pe_read  # noqa: E402
from capstone import Cs, CS_ARCH_X86, CS_MODE_32  # noqa: E402

DLL = ROOT / "NeuronVS.dll"
MAP = PKG / "params_observers_map.csv"
SCHEMA = ROOT / "NeuronVS_neurondb" / "sound_schema.csv"
FUNCTIONS = ROOT / "NeuronVS_decompiled" / "functions.csv"

CTOR = 0x1000BE10
ATTACH = 0x100010A0
OBS_BASE = 0x280
OBS_STRIDE = 0x18
P_BASE = 0x278C
SNDDAT_STRIDE = 0x28
SNDDAT_COUNT = 445
MOD_TABLE = 0x10049E00
MOD_COUNT = 63
MATRIX = 0x100134E0
MATRIX_END = 0x100135CD        # 237 B hasta el `ret 4`, y un nop de relleno despues
MATRIX_NUMBERS = {0x14, 0x17C, 0x44, -0x30, -0x18, 0x2B0, 0x2B4, 0x278C, 0x27C,
                  MOD_TABLE, 6, 0x100, 0x104}
CTOR_CORE = 0x1001B140         # FUN_1001b140: el operator_new del objeto `params`
PARAMS_SIZE = 0x2CDC           # operator_new(0x2cdc)

# VA, rango documentado, clave y aserciones (mne/disp/inm/call) de cada callback
CALLBACKS = [
    (0x10013620, 0x100139AD, "ModelIndexChange (R1/R2ModellIndex)"),
    (0x100135D0, 0x100135FC, "stModDest (6 selectores de destino)"),
    (0x10013600, 0x1001361C, "stModDepth (6 profundidades)"),
    (0x100139B0, 0x100139CA, "stGPEngineCb (observador preliminar)"),
    (0x100139D0, 0x10013A7A, "stSPEngineCb (callback universal de parametros)"),
]
RECOVERED = [0x100135D0, 0x10013600, 0x100139B0, 0x100139D0]  # los 4 no extraidos antes

# referencias que OBSERVER_CALLBACKS.md afirma de cada callback
EXPECTED = {
    0x100139D0: {"disp": {0x17C, 0x278C, 0x0C, 0x10}, "calls": {0x100134E0, 0x10040550}},
    0x100135D0: {"disp": {0x14}, "calls": {0x100134E0}},
    0x10013600: {"disp": {0x2C}, "calls": {0x100134E0}},
    0x100139B0: {"disp": {0x2788}, "calls": set()},
}

INIT_RECORD = 0x10001010      # FUN_10001010: pone a cero el registro de 0x18 B
CONST_STORE = re.compile(r"dword ptr \[ebp(?: ([+-]) (0x[0-9a-f]+))?\]")
REGS32 = ("eax", "ebx", "ecx", "edx", "esi", "edi")

MD = Cs(CS_ARCH_X86, CS_MODE_32)
VERBOSE = "-v" in sys.argv[1:]

failures: list[str] = []


def check(name: str, ok: bool, detail: str) -> None:
    print(f"[{'OK ' if ok else 'FAIL'}] {name}: {detail}")
    if not ok:
        failures.append(name)


def text_section(pe):
    for name, vaddr, vsize, rawptr, rawsize in pe.sections:
        if name == ".text":
            return pe.image_base + vaddr, vsize
    raise SystemExit("sin seccion .text")


def func_range(name_addr: int) -> tuple[int, int]:
    rows = list(csv.reader(open(FUNCTIONS, encoding="utf-8")))[1:]
    addrs = sorted(int(r[1], 16) for r in rows if r[1].strip())
    for i, a in enumerate(addrs):
        if a == name_addr:
            return a, addrs[i + 1]
    raise SystemExit(f"VA {name_addr:#x} no esta en functions.csv")


def f32(bits: int) -> float:
    return struct.unpack("<f", struct.pack("<I", bits))[0]


def load_map():
    return list(csv.DictReader(open(MAP, newline="", encoding="utf-8")))


def load_schema():
    rows = list(csv.DictReader(open(SCHEMA, newline="", encoding="utf-8")))
    return {int(r["index"]): r["key"] for r in rows}


def read_bytes(pe, start: int, end: int) -> bytes:
    return pe.raw[pe.va2off(start):pe.va2off(start) + (end - start)]


NUMBER_RE = re.compile(r"(?P<sign>[-+])?\s*0x(?P<hex>[0-9a-fA-F]+)")
DECIMAL_RE = re.compile(r",\s*(?P<value>\d+)\b")


def operand_numbers(op_str: str) -> set[int]:
    """Numeros con signo de un operando: desplazamientos, inmediatos y direcciones."""
    out = set()
    for m in NUMBER_RE.finditer(op_str):
        value = int(m.group("hex"), 16)
        out.add(-value if m.group("sign") == "-" else value)
    for m in DECIMAL_RE.finditer(op_str):
        out.add(int(m.group("value")))
    return out


def call_target(pe, va: int):
    b = pe.raw[pe.va2off(va):pe.va2off(va) + 5]
    if len(b) < 5 or b[0] != 0xE8:
        return None
    return (va + 5 + struct.unpack_from("<i", b, 1)[0]) & 0xFFFFFFFF


def attach_sites(pe, start: int, end: int) -> list[int]:
    """Todas las llamadas E8 rel32 a ATTACH dentro del rango (barrido de bytes)."""
    buf = read_bytes(pe, start, end)
    out = []
    i = buf.find(b"\xe8")
    while i >= 0 and i + 5 <= len(buf):
        rel = struct.unpack_from("<i", buf, i + 1)[0]
        if (start + i + 5 + rel) & 0xFFFFFFFF == ATTACH:
            out.append(start + i)
        i = buf.find(b"\xe8", i + 1)
    return out


# ---------------------------------------------------------------- decodificadores
def lea_ebp_offsets(win: bytes) -> list[int]:
    """`8D <reg> <disp32>` con base EBP: `lea reg,[ebp+disp]`."""
    out = []
    for i in range(0, len(win) - 5):
        if win[i] == 0x8D and (win[i + 1] & 0xC7) == 0x85:
            out.append(struct.unpack_from("<i", win, i + 2)[0])
    return out


def imm_add_leas(win: bytes) -> list[int]:
    """Inmediatos de `add ecx,imm` (81 C1 id / 83 C1 ib) y `lea ecx,[r+imm]` (8D 8?)."""
    out = []
    for i in range(0, len(win) - 2):
        op, modrm = win[i], win[i + 1]
        mod = modrm >> 6
        rm = modrm & 7
        if op == 0x81 and modrm == 0xC1 and i + 6 <= len(win):
            out.append(struct.unpack_from("<I", win, i + 2)[0])
        elif op == 0x83 and modrm == 0xC1 and i + 3 <= len(win):
            out.append(struct.unpack_from("<b", win, i + 2)[0] & 0xFFFFFFFF)
        elif op == 0x8D and mod == 2 and rm == 1 and i + 6 <= len(win):   # lea ecx,[reg+disp32]
            out.append(struct.unpack_from("<I", win, i + 2)[0])
        elif op == 0x8D and mod == 1 and rm == 1 and i + 3 <= len(win):   # lea ecx,[reg+disp8]
            out.append(struct.unpack_from("<b", win, i + 2)[0] & 0xFFFFFFFF)
    return out


def mem_stores(win: bytes) -> list[tuple[int | None, int, int]]:
    """Tiendas con desplazamiento explicito: `C7 /0 disp id` y `89 /r disp ib/id`.

    Devuelve (disp, imm, va_rel) solo cuando el destino es `[reg+disp]` sin SIB.
    """
    out = []
    for i in range(0, len(win) - 9):
        op = win[i]
        if op not in (0xC7, 0x89):
            continue
        modrm = win[i + 1]
        mod = modrm >> 6
        reg = (modrm >> 3) & 7
        rm = modrm & 7
        if op == 0xC7 and reg != 0:
            continue
        p = i + 2
        if mod == 2 and rm != 4:
            disp = struct.unpack_from("<i", win, p)[0]
            p += 4
        elif mod == 1 and rm != 4:
            disp = struct.unpack_from("<b", win, p)[0]
            p += 1
        else:
            continue
        if p + 4 <= len(win):
            out.append((disp, struct.unpack_from("<I", win, p)[0], i))
    return out


def window(pe, va: int, back: int = 0x80) -> bytes:
    start = va - back
    return read_bytes(pe, start, va)


def near_store_loop(pe, va: int) -> bool:
    """¿La llamada vive dentro de un bucle? (salto hacia atras en los 0x100 bytes siguientes)"""
    buf = read_bytes(pe, va, va + 0x100)
    i = 0
    while i < len(buf) - 2:
        op = buf[i]
        if op in (0x70, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E, 0x7F, 0xEB):
            tgt = (va + i + 2 + struct.unpack_from("<b", buf, i + 1)[0]) & 0xFFFFFFFF
            if tgt < va:
                return True
        if op == 0x0F and buf[i + 1] in (0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F, 0xE9):
            tgt = (va + i + 6 + struct.unpack_from("<i", buf, i + 2)[0]) & 0xFFFFFFFF
            if tgt < va:
                return True
        i += 1
    return False


def disasm_range(pe, start: int, end: int):
    """Desensambla [start,end) desde el inicio exacto; devuelve (insns, ok_sin_huecos)."""
    buf = read_bytes(pe, start, end + 16)
    insns = []
    off = 0
    addr = start
    while addr < end and off < len(buf):
        got = list(MD.disasm(buf[off:off + 15], addr))
        if not got:
            return insns, False
        insns.append(got[0])
        off += got[0].size
        addr += got[0].size
    return insns, addr == end


def ctor_const_stores(pe, start: int, end: int):
    """Limites que el ctor escribe en el bloque de observadores de `params`.

    El ctor usa dos formas para el mismo campo: `c7 85 <disp32> <inm32>` y
    `89 85 <disp32> <reg>` con la constante cargada antes en el registro (un
    `mov edi, 0x3F800000` sirve para varias filas).  Se propaga la constante por
    los seis registros de 32 bits de forma lineal: ebx/esi/edi sobreviven a las
    llamadas (callee-saved de MSVC) y eax/ecx/edx no.  Devuelve
    `{disp: (bits, va, forma)}` con la ultima tienda de cada desplazamiento y
    `{disp: motivo}` para las que no se resuelven.
    """
    insns, clean = disasm_range(pe, start, end)
    if not clean:
        raise SystemExit(f"no se pudo desensamblar 0x{start:08X}..0x{end:08X} sin huecos")
    const: dict[str, int] = {}
    stores: dict[int, tuple[int, int, str]] = {}
    unresolved: dict[int, str] = {}
    clobbers = {"add", "sub", "and", "or", "xor", "imul", "shl", "shr", "sar", "inc",
                "dec", "neg", "not", "adc", "sbb", "lea", "movzx", "movsx", "pop",
                "xchg", "sete", "setne"}

    def disp_of(match) -> int:
        value = int(match.group(2), 16) if match.group(2) else 0
        return -value if match.group(1) == "-" else value

    for ins in insns:
        mnem, ops = ins.mnemonic, ins.op_str
        if mnem == "mov":
            dst, _, src = (part.strip() for part in ops.partition(","))
            if dst in REGS32:
                if src in REGS32:
                    if src in const:
                        const[dst] = const[src]
                    else:
                        const.pop(dst, None)
                else:
                    try:
                        const[dst] = int(src, 0)
                    except ValueError:
                        const.pop(dst, None)
                continue
            hit = CONST_STORE.search(dst)
            if hit:
                disp = disp_of(hit)
                if src in const:
                    stores[disp] = (const[src], ins.address, "reg")
                else:
                    try:
                        stores[disp] = (int(src, 0), ins.address, "imm")
                    except ValueError:
                        unresolved[disp] = f"{src} en 0x{ins.address:08X}"
            continue
        if mnem.startswith("fst"):
            hit = CONST_STORE.search(ops)
            if hit:
                unresolved[disp_of(hit)] = f"x87 en 0x{ins.address:08X}"
            continue
        if mnem in clobbers:
            target = ops.split(",")[0].strip()
            if target in REGS32:
                const.pop(target, None)
            continue
        if mnem == "call":
            for reg in ("eax", "ecx", "edx"):
                const.pop(reg, None)
    return stores, unresolved


# ---------------------------------------------------------------- comprobaciones
def main() -> int:
    pe = pe_read.PE(DLL)
    text_start, text_size = text_section(pe)
    ctor_start, ctor_end = func_range(CTOR)
    rows = load_map()
    schema = load_schema()

    # A. puntos de enganche
    sites = attach_sites(pe, ctor_start, ctor_end)
    csv_calls = [int(r["call_va"], 16) for r in rows]
    bad_calls = [hex(v) for v in csv_calls if call_target(pe, v) != ATTACH]
    check("A1 llamadas a FUN_100010a0 en FUN_1000be10", len(sites) == 335 and len(rows) == 335,
          f"{len(sites)} llamadas, {len(rows)} filas del mapa")
    check("A2 cada call_va del mapa es un E8->FUN_100010a0", not bad_calls,
          "todas validas" if not bad_calls else f"invalidas: {bad_calls[:8]}")
    check("A3 mismo conjunto de direcciones", sorted(sites) == sorted(csv_calls),
          "identicos" if sorted(sites) == sorted(csv_calls)
          else f"faltan {len(set(sites) - set(csv_calls))}, sobran {len(set(csv_calls) - set(sites))}")

    direct = [r for r in rows if r["obs_offset_hex"] != "loop"]
    loops = [r for r in rows if r["obs_offset_hex"] == "loop"]

    # desplazamientos destino de las tiendas `C7/89 [ebp+disp]` de todo el ctor:
    # es donde el ctor escribe los seis dwords de cada observador (min, max, ctx,
    # indice, mod_dest y callback)
    ctor_buf = read_bytes(pe, ctor_start, ctor_end)
    cb_stores = set()
    for i in range(len(ctor_buf) - 10):
        if ctor_buf[i] not in (0xC7, 0x89):
            continue
        modrm = ctor_buf[i + 1]
        if (modrm & 0xC7) not in (0x85, 0x45):   # [ebp+disp32] o [ebp+disp8]
            continue
        if modrm & 0xC0 == 0x40:
            cb_stores.add(struct.unpack_from("<b", ctor_buf, i + 2)[0])
        else:
            cb_stores.add(struct.unpack_from("<i", ctor_buf, i + 2)[0])

    # B/C/D. por fila
    bad_b, bad_c, bad_d = [], [], []
    offs = []
    for r in direct:
        va = int(r["call_va"], 16)
        off = int(r["obs_offset_hex"], 16)
        win = window(pe, va)
        offs.append(off)
        if off not in lea_ebp_offsets(win):
            bad_b.append((r["call_order"], hex(off)))
        cand = [x for x in imm_add_leas(win) if x % SNDDAT_STRIDE == 0 and 0 < x < SNDDAT_COUNT * SNDDAT_STRIDE]
        if r["snddat_index"] != "-1" and int(r["snddat_index"]) * SNDDAT_STRIDE not in cand:
            bad_c.append((r["call_order"], r["snddat_index"], [hex(x // SNDDAT_STRIDE) for x in cand[:4]]))
        if off + 0x14 not in cb_stores:
            bad_d.append((r["call_order"], hex(off + 0x14)))

    check("B1 lea [ebp+obs_off] en cada sitio", not bad_b, f"{len(direct) - len(bad_b)}/{len(direct)}"
          + ("" if not bad_b else f"  fallos: {bad_b[:6]}"))
    grid = [o for o in offs if (o - OBS_BASE) % OBS_STRIDE]
    dup = sorted({o for o in offs if offs.count(o) > 1})
    check("B2 rejilla 0x280+k*0x18 y limite < 0x278C",
          not grid and max(offs) < P_BASE,
          f"{len(set(offs))} offsets distintos, max {hex(max(offs))}"
          + (f", fuera de rejilla: {[hex(x) for x in grid[:4]]}" if grid else ""))
    check("B3 unico offset repetido: 0x280", dup == [OBS_BASE], f"repetidos: {[hex(x) for x in dup]}")

    for r in loops:
        va = int(r["call_va"], 16)
        check(f"C{'-' if near_store_loop(pe, va) else 'X'} fila {r['call_order']} es un bucle ({r['call_va']})",
              near_store_loop(pe, va), "salto hacia atras detectado" if near_store_loop(pe, va) else "sin bucle")
    check("C snddat_index = inmediato/0x28 en cada sitio", not bad_c, f"{len(direct) - len(bad_c)}/{len(direct)}"
          + ("" if not bad_c else f"  fallos: {bad_c[:6]}"))
    check("D tienda al campo callback (+0x14) de cada observador en el ctor", not bad_d,
          f"{len(direct) - len(bad_d)}/{len(direct)}"
          + ("" if not bad_d else f"  fallos: {bad_d[:6]}"))

    # E. callbacks especiales de las tres primeras filas (tiendas C7 85 disp32 inm32 del ctor)
    def callback_imm(field: int):
        pat = b"\xc7\x85" + struct.pack("<i", field)
        i = ctor_buf.find(pat)
        if i < 0:
            return None
        return struct.unpack_from("<I", ctor_buf, i + 6)[0]

    obs280_cb = callback_imm(0x294)
    obs298_cb = callback_imm(0x2AC)
    csv_cb = {hex(int(r["callback"], 16)) for r in rows[:3]}
    check("E1 observador 0x280 -> 0x10013620", obs280_cb == 0x10013620, f"inmediato {obs280_cb and hex(obs280_cb)}")
    check("E2 observador 0x298 -> 0x100139b0", obs298_cb == 0x100139B0, f"inmediato {obs298_cb and hex(obs298_cb)}")
    check("E3 el mapa ya trae esos callbacks", csv_cb == {"0x10013620", "0x100139b0"},
          f"callbacks de las 3 primeras filas: {sorted(csv_cb)}")
    # Las dos filas del bucle de 6: el ctor escribe los callbacks de control con
    # `mov dword ptr [reg + 0x70], 0x100135d0` (stModDest) y `[reg + 0x100],
    # 0x10013600` (stModDepth), con los campos +0x14 de los registros de 0x5C y
    # 0xEC (0x5C+0x14 = 0x70, 0xEC+0x14 = 0x100).
    loop_rows = [r for r in rows if r["obs_offset_hex"] == "loop"]
    installs = {0x100135D0: b"\xc7\x44\x2e\x70" + struct.pack("<I", 0x100135D0),
                0x10013600: b"\xc7\x84\x2e\x00\x01\x00\x00" + struct.pack("<I", 0x10013600)}
    found = {va: ctor_buf.find(pattern) for va, pattern in installs.items()}
    csv_loop = [hex(int(r["callback"], 16)) for r in loop_rows]
    check("E4 los callbacks de las filas 3 y 4 del mapa son los del bucle del ctor",
          len(loop_rows) == 2 and csv_loop == ["0x100135d0", "0x10013600"] and
          all(at >= 0 for at in found.values()),
          "mapa " + ", ".join(csv_loop) + "; ctor " +
          ", ".join(f"{hex(va)} en {hex(ctor_start + at)}" if at >= 0 else f"{hex(va)} AUSENTE"
                    for va, at in found.items()))

    # F. tabla de modulacion
    table = [pe.u32(MOD_TABLE + 4 * i) for i in range(MOD_COUNT + 3)]
    mod_rows = [r for r in rows if r["mod_dest_idx"] != "-1"]
    bad_f = []
    for r in mod_rows:
        idx = int(r["mod_dest_idx"])
        slot = int(r["slot_in_p"])
        tslot = int(r["table_10049e00_slot"])
        if not (idx <= MOD_COUNT - 1 and table[idx] == slot == tslot and table[idx] < 445):
            bad_f.append((r["call_order"], idx, slot, tslot, table[idx] if idx < len(table) else None))
    check("F1 tabla 0x10049E00 = 63 entradas + terminador", table[MOD_COUNT] == 0 and len(mod_rows) == MOD_COUNT,
          f"{len(mod_rows)} filas modulables, terminador {table[MOD_COUNT]}")
    check("F2 mod_dest_idx -> slot_in_p == tabla", not bad_f, f"{len(mod_rows) - len(bad_f)}/{len(mod_rows)}"
          + ("" if not bad_f else f"  fallos: {bad_f[:6]}"))

    # G. claves de snddat
    bad_g = [(r["call_order"], r["snddat_index"], r["snddat_key"], schema.get(int(r["snddat_index"])))
             for r in rows if r["snddat_index"] != "-1" and schema.get(int(r["snddat_index"])) != r["snddat_key"]]
    check("G1 snddat_key == sound_schema.csv[index]", not bad_g,
          f"{len(rows) - 2 - len(bad_g)}/{len(rows) - 2}" + ("" if not bad_g else f"  fallos: {bad_g[:5]}"))

    # H. los callbacks
    for va, end, label in CALLBACKS:
        insns, clean = disasm_range(pe, va, end)
        disps = set()
        calls = set()
        for t in insns:
            if t.mnemonic == "call" and t.op_str.startswith("0x"):
                calls.add(int(t.op_str, 16))
            if "+ 0x" in t.op_str:
                for tok in t.op_str.split("+"):
                    tok = tok.strip().split("]")[0].strip()
                    if tok.startswith("0x"):
                        try:
                            disps.add(int(tok, 16))
                        except ValueError:
                            pass
        check(f"H1 callback {va:08x} ({label})", clean and insns and insns[-1].mnemonic in ("ret", "retn", "jmp"),
              f"{len(insns)} instrucciones hasta {insns[-1].address + insns[-1].size:#x}, "
              f"ultima {insns[-1].mnemonic}")
        exp = EXPECTED.get(va)
        if exp:
            miss_d = {hex(x) for x in exp["disp"] if x not in disps}
            miss_c = {hex(x) for x in exp["calls"] if x not in calls}
            check(f"H2 referencias internas de {va:08x}", not miss_d and not miss_c,
                  "disps " + (", ".join(sorted(hex(x) for x in exp["disp"])))
                  + " y calls " + (", ".join(sorted(hex(x) for x in exp["calls"])) if exp["calls"] else "(ninguna)")
                  + (f"  faltan disps {sorted(miss_d)} calls {sorted(miss_c)}" if (miss_d or miss_c) else ""))

    # I. instalacion en el ctor
    buf = read_bytes(pe, ctor_start, ctor_end)
    counts = {hex(v): buf.count(struct.pack("<I", v)) for v in (0x10013620, 0x100139B0, 0x100135D0, 0x10013600, 0x100139D0)}
    check("I1 inmediato 0x10013620 en el ctor una sola vez", counts["0x10013620"] == 1, counts["0x10013620"])
    check("I2 inmediato 0x100139b0 en el ctor una sola vez", counts["0x100139b0"] == 1, counts["0x100139b0"])
    check("I3 los dos callbacks de control aparecen una sola vez",
          counts["0x100135d0"] == 1 and counts["0x10013600"] == 1,
          f"0x100135d0={counts['0x100135d0']} (bucle x6), 0x10013600={counts['0x10013600']} (bucle x6)")
    check("I4 el universal 0x100139d0 se materializa una sola vez", counts["0x100139d0"] == 1,
          f"{counts['0x100139d0']} aparicion(es) del inmediato (el ctor lo reutiliza desde un registro)")

    # J. la traza de FUN_100134e0
    insns, clean = disasm_range(pe, MATRIX, MATRIX_END)
    numbers: set[int] = set()
    calls: set[int] = set()
    table_reads = 0
    for t in insns:
        numbers |= operand_numbers(t.op_str)
        if t.mnemonic == "call" and t.op_str.startswith("0x"):
            calls.add(int(t.op_str, 16))
        if f"{MOD_TABLE:#x}" in t.op_str:
            table_reads += 1
    last = insns[-1]
    check("J1 FUN_100134e0 desensambla sin huecos hasta su `ret`",
          clean and last.mnemonic == "ret" and last.op_str == "4",
          f"{len(insns)} instrucciones, 0x{MATRIX:08x}..0x{last.address:08x}, ultima `{last.mnemonic} "
          f"{last.op_str}` (__thiscall con un argumento en la pila)")
    missing = sorted(MATRIX_NUMBERS - numbers)
    check("J2 registros de los seis controles, base de los 63 destinos, ventana y p", not missing,
          "0x14 destino, -0x30 sobre 0x44 valor, -0x18 sobre 0x44 profundidad, 0x17C base, "
          "0x2B0/0x2B4 ventana, 0x278C p, 0x27C holder, tabla y los seis del bucle"
          if not missing else f"faltan {[hex(x) for x in missing]}")
    stride = [t.op_str for t in insns if t.op_str == "esi, [edx + edx*2]"]
    window_ok = any("0x2b0" in t.op_str and "esi*8" in t.op_str for t in insns) and bool(stride)
    check("J3 la tabla se lee dos veces y la ventana es 0x2B0+slot*0x18",
          table_reads == 2 and window_ok,
          f"{table_reads} lecturas de 0x{MOD_TABLE:08X} (los seis destinos y el que cambio); "
          f"ventana por `lea esi,[edx+edx*2]` + `[ecx+esi*8+0x2B0]` = slot*0x18")
    pushes = [t.op_str for t in insns[-8:]]
    check("J4 termina en el traductor con (holder, 0, p)",
          calls == {0x10040550} and 0x27C in numbers and 0x278C in numbers,
          f"call {[hex(c) for c in sorted(calls)]}, `mov ecx,[ecx+0x27C]` y `push 0` / "
          f"`push params+0x278C` ({' / '.join(pushes)})")
    test_at = next(i for i, t in enumerate(insns) if t.mnemonic == "test" and t.op_str == "bl, bl")
    call_at = next(i for i, t in enumerate(insns) if t.mnemonic == "call")
    decisions = [(t.mnemonic, t.op_str) for t in insns[test_at:call_at]
                 if t.mnemonic == "cmp" or t.mnemonic.startswith("j")]
    check("J5 la rama del parametro que cambio no comprueba el indice",
          decisions == [("je", "0x100135b0")],
          "entre el destino que cambio y el traductor la unica decision es la de `bl` "
          f"({decisions}); el argumento se lee de `[esp+0x104]` y se usa tal cual")
    outside_read = pe.u32(MOD_TABLE - 4)
    write_at = P_BASE + outside_read * 4
    try:
        core_start, core_end = func_range(CTOR_CORE)
    except SystemExit:
        core_start, core_end = CTOR_CORE, CTOR_CORE + 0x900
    has_size = struct.pack("<I", PARAMS_SIZE) in read_bytes(pe, core_start, core_end)
    check("J6 con el indice -1 la misma rama escribe fuera del objeto `params`",
          outside_read == 0x1A8 and has_size and write_at > PARAMS_SIZE,
          f"tabla[-1] = 0x10049DFC = {outside_read} -> params+0x{write_at:X}, "
          f"y `params` es un operator_new(0x{PARAMS_SIZE:X}) de FUN_1001b140: 0x{write_at - PARAMS_SIZE:X} B "
          f"mas alla del final")

    # K. min_val/max_val de cada fila contra los limites del ctor
    init, init_clean = disasm_range(pe, INIT_RECORD, INIT_RECORD + 0x14)
    zeroes = [t.op_str.split("[ecx")[1].split("]")[0] for t in init
              if t.mnemonic == "mov" and t.op_str.endswith(", eax")]
    check("K0 el registro de 0x18 B nace a cero (FUN_10001010)",
          init_clean and init and init[0].mnemonic == "xor" and init[0].op_str == "eax, eax"
          and zeroes == ["", " + 4", " + 8", " + 0xc", " + 0x10", " + 0x14"],
          "`xor eax,eax` + seis `mov [ecx+d], eax`: sin tienda propia, min y max quedan en 0.0")

    limits, unresolved = ctor_const_stores(pe, ctor_start, ctor_end)
    bad_k: list[tuple[str, str, str, str]] = []
    blanks: list[tuple[int, int]] = []
    forms = {"imm": 0, "reg": 0}
    checked = implied = 0
    for r in rows:
        if r["obs_offset_hex"] == "loop":
            continue
        off = int(r["obs_offset_hex"], 16)
        for disp, col, field in ((off, "min_val", "min"), (off + 4, "max_val", "max")):
            text = r[col].strip()
            if not text:
                blanks.append((int(r["call_order"]), disp))
                continue
            checked += 1
            want = float(text)
            hit = limits.get(disp)
            if hit is None:
                if want != 0.0:
                    bad_k.append((r["snddat_key"], field, text,
                                  unresolved.get(disp, "sin tienda")))
                else:
                    implied += 1
                continue
            forms[hit[2]] += 1
            if f32(hit[0]) != want:
                bad_k.append((r["snddat_key"], field, text,
                              f"{f32(hit[0]):g} en 0x{hit[1]:08X} ({hit[2]})"))
    check("K1 min_val/max_val de cada fila = limite que escribe el ctor", not bad_k,
          f"{checked - len(bad_k)}/{checked} campos ({checked - implied} con tienda "
          f"[{forms['imm']} inmediata, {forms['reg']} por registro], {implied} por el cero inicial)"
          + ("" if not bad_k else f"  fallos: {bad_k[:6]}"))
    special_blanks = {0x280, 0x284}
    check("K2 las unicas filas sin ventana son las dos de 0x280: 4 campos",
          len(blanks) == 4 and all(disp in special_blanks for _, disp in blanks),
          f"{len(blanks)} campos en blanco: "
          + (", ".join(f"fila {n} +0x{disp:X}" for n, disp in blanks) if blanks else "ninguno"))

    r2_row = next((r for r in rows if r["call_order"] == "2"), None)
    k3_map_ok = (r2_row is not None and
                 r2_row["min_val"].strip() in ("400", "400.0") and
                 r2_row["max_val"].strip() in ("480", "480.0"))
    k3_ctor_ok = (0x298 in limits and 0x29C in limits and
                  f32(limits[0x298][0]) == 400.0 and f32(limits[0x29C][0]) == 480.0)
    check("K3 mapa 400/480 (fila 2, R2ModellIndex), ctor 0x298/0x29C = 400/480",
          k3_map_ok and k3_ctor_ok,
          f"mapa: {r2_row.get('min_val') if r2_row else 'None'}/{r2_row.get('max_val') if r2_row else 'None'} "
          f"(fila 2, R2ModellIndex); ctor 0x298/0x29C = "
          + (f"{f32(limits[0x298][0]):g}/{f32(limits[0x29C][0]):g}" if 0x298 in limits and 0x29C in limits else "sin tienda"))

    print()
    if failures:
        print(f"RESULTADO: {len(failures)} comprobacion(es) fallidas -> {failures}")
        return 1
    print("RESULTADO: todas las comprobaciones pasan contra NeuronVS.dll")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
