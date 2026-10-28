"""verify_matrix.py - comprueba el volcado de la matriz de modulacion del arnes.

`neuron_golden --matrix` (Win32) mueve los seis controles de ejecucion por MIDI y
comprueba en caliente que `p[tabla[d]] = recorte(base[d] + prof[c]*valor[c])`, que los
otros slots de `p` no se mueven, que la rama del parametro que cambio copia el valor sin
recortar y que el indice `-1` escribe fuera del objeto.  Este verificador lee ese log y lo
cruza con lo que el log no puede saber por si solo:

V1. el log esta completo y es coherente: `comprobaciones == OK + FAIL`, `fallos == FAIL`,
    sin ninguna linea `[NO ]`, y termina en `RESULTADO ... 0 fallos` (un log truncado no
    pasa por bueno);
V2. la tabla que el arnes lee del DLL en memoria es la de los bytes del PE
    (`.rdata:0x10049E00`, 64 dwords con terminador `0`);
V3. cada `dest -> slot` que el arnes ve en `params+0x14+c*4` coincide con
    `table_10049e00_slot` y con `slot_in_p` de `params_observers_map.csv`;
V4. cada ventana `[min, max]` que el arnes lee de `params+0x2B0+slot*0x18` coincide con
    las columnas `min_val`/`max_val` de la fila de ese destino (las 63 filas);
V5. los destinos que los presets enganchan caen en 0..62 y su clave de `snddat` sale de
    `sound_schema.csv`, para el resumen;
V6. el valor que la rama `-1` copia fuera del objeto es el campo callback del sexto
    registro de `stModDepth` (`0xEC + 5*0x18 + 0x14 = 0x178`), o sea su propia direccion
    `0x10013600`; el destino del write (`0x278C + tabla[-1]*4`) queda fuera del objeto de
    `0x2CDC` B y aterriza en `params+0x2E2C`;
V8. la consecuencia que el arnes ve en caliente: `ctx[3]` del bloque de contexto que el
    heap coloca en `params+0x2E20` es justo ese `+0x0C` del write, asi que el destino
    queda **desenganchado** (su observador escribe `p[slot]` por la rama sin matriz).
    Cada linea `M1b` del log tiene que declarar el mismo offset, el mismo valor y el
    `slot` que la tabla del PE le da a ese destino.

Uso:  python NeuronVS_observers/tools/verify_matrix.py [--log PATH] [-v]
      (el log por defecto es `NeuronVS_observers/matrix_runtime.log`, la evidencia del
      arnes; el -v lista los
      destinos que engancharon los presets del log)
Salida: un bloque OK/FAIL por comprobacion; codigo de salida 1 si algo falla.
"""
from __future__ import annotations

import argparse
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

DLL = ROOT / "NeuronVS.dll"
MAP = PKG / "params_observers_map.csv"
LOG = PKG / "matrix_runtime.log"
SCHEMA = ROOT / "NeuronVS_neurondb" / "sound_schema.csv"

MOD_TABLE = 0x10049E00
MOD_COUNT = 63
# El bloque de contexto que el heap coloca inmediatamente detras de `params`
# (0x2CDC B).  Su `+0x0C` es `ctx[3]` (el indice de destino del observador).
UNHOOK_CTX = 0x2E20
DEPTH_RECORD = 0xEC + 5 * 0x18 + 0x14        # params+0x178: callback del 6o stModDepth
ST_MOD_DEST = 0x100135D0
ST_MOD_DEPTH = 0x10013600
# `mov dword ptr [reg + 0x70], 0x100135d0` y `[reg + 0x100], 0x10013600`: los dos
# callbacks del bucle de 6 del ctor (campos +0x14 de los registros de 0x5C y 0xEC).
CTOR = 0x1000BE10
CTOR_END = 0x10013220
INSTALLS = {ST_MOD_DEST: b"\xc7\x44\x2e\x70" + struct.pack("<I", ST_MOD_DEST),
            ST_MOD_DEPTH: b"\xc7\x84\x2e\x00\x01\x00\x00" + struct.pack("<I", ST_MOD_DEPTH)}

RUN_RE = re.compile(r"^FUN_100134e0: params=")
RESULT_RE = re.compile(r"^RESULTADO: (\d+) comprobaciones, (\d+) fallos, (\d+) presets sin cargar$")
PRESET_RE = re.compile(r"^preset (\d{3}) (.+?) \((\w+)\)$")
TABLE_RE = re.compile(r"^\s+tabla 0x10049E00: ((?:\s*-?\d+)+)$")
CONTROL_RE = re.compile(
    r"^\s+control (\d) (.+?)\s+-> dest\s+(-?\d+) \| slot\s+(\d+) \| "
    r"ventana \[([-\d.e+]+), ([-\d.e+]+)\] \| base ([-\d.e+]+) \| prof ([-\d.e+]+) \| "
    r"valor ([-\d.e+]+)$")
M3_RE = re.compile(r"^\[OK \] preset \d{3} M3: .*\(0x([0-9A-F]{8})\)$")
M1B_RE = re.compile(
    r"^\[OK \] preset (\d{3}) M1b: base\[-1\] \(params\+0x178\) es el puntero a stModDepth "
    r"\(0x10013600\) que el ctor deja en su 6\.o registro; destinos desenganchados por el "
    r"write en params\+0x2E2C: (\d+)")
UNHOOK_RE = re.compile(
    r"\| dest (\d+) slot (\d+): ctx=params\+0x([0-9A-F]+), ctx\[3\]=([0-9A-F]{8}) = base\[-1\]")
M5_RE = re.compile(r"^\[OK \] preset \d{3} M5: FUN_100134e0\(params, \d+\) con base fuera de "
                   r"ventana copia el valor crudo en p\[(\d+)\] = ([-\d.e+]+) \(sin recortar\)")

failures: list[str] = []
checks = 0


def check(name: str, ok: bool, detail: str) -> None:
    global checks
    checks += 1
    print(f"[{'OK ' if ok else 'FAIL'}] {name}: {detail}")
    if not ok:
        failures.append(name)


def load_map() -> list[dict]:
    return list(csv.DictReader(open(MAP, newline="", encoding="utf-8")))


def load_schema() -> dict[int, str]:
    rows = list(csv.DictReader(open(SCHEMA, newline="", encoding="utf-8")))
    return {int(r["index"]): r["key"] for r in rows}


def parse_runs(text: str) -> list[dict]:
    """Separa el log en pasadas del arnes y extrae lo que se comprueba."""
    lines = text.splitlines()
    starts = [i for i, line in enumerate(lines) if RUN_RE.match(line)]
    runs = []
    for number, start in enumerate(starts):
        end = starts[number + 1] if number + 1 < len(starts) else len(lines)
        block = lines[start:end]
        run = {"lines": block, "presets": [], "table": None, "ok": 0, "no": 0,
               "result": None, "m3": set(), "m5": []}
        preset = None
        for line in block:
            if line.startswith("[OK "):
                run["ok"] += 1
            elif line.startswith("[NO "):
                run["no"] += 1
            m = RESULT_RE.match(line)
            if m:
                run["result"] = tuple(int(g) for g in m.groups())
            m = TABLE_RE.match(line)
            if m:
                run["table"] = [int(v) for v in m.group(1).split()]
            m = PRESET_RE.match(line)
            if m:
                preset = {"id": int(m.group(1)), "name": m.group(2), "method": m.group(3),
                          "controls": [], "m1": False}
                run["presets"].append(preset)
            m = CONTROL_RE.match(line)
            if m and preset is not None:
                preset["controls"].append({
                    "control": int(m.group(1)), "midi": m.group(2), "dest": int(m.group(3)),
                    "slot": int(m.group(4)), "min": float(m.group(5)), "max": float(m.group(6)),
                    "base": float(m.group(7)), "depth": float(m.group(8)),
                    "value": float(m.group(9))})
            if " M1: " in line and line.startswith("[OK "):
                preset["m1"] = True
            m = M3_RE.match(line)
            if m:
                run["m3"].add(int(m.group(1), 16))
            m = M5_RE.match(line)
            if m:
                run["m5"].append((int(m.group(1)), float(m.group(2))))
        runs.append(run)
    return runs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--log", default=str(LOG), help="log del arnes a comprobar")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    path = pathlib.Path(args.log)
    if not path.is_file():
        print(f"falta {path}; genera el log con neuron_golden --matrix")
        return 1
    text = path.read_text(encoding="utf-8", errors="replace")
    runs = parse_runs(text)
    check("V1a el log trae al menos una pasada de --matrix", bool(runs), f"{len(runs)} pasadas")
    if not runs:
        return 1
    for number, run in enumerate(runs, start=1):
        result = run["result"]
        expected_ok = result[0] - result[1] if result else None
        check(f"V1b pasada {number}: {len(run['presets'])} presets, lineas OK/FAIL coherentes",
              run["ok"] + run["no"] == expected_ok and
              run["presets"] and all(p["controls"] and p["m1"] for p in run["presets"]),
              f"{run['ok']} OK + {run['no']} FAIL = {run['ok'] + run['no']}, "
              f"el arnes dice {result[0] if result else '?'} comprobaciones"
              if result else "sin linea RESULTADO (log truncado)")
        check(f"V1c pasada {number}: ninguna comprobacion fallida",
              run["no"] == 0 and bool(result) and result[1] == 0 and result[2] == 0,
              f"RESULTADO {result}, {run['no']} lineas [NO ]" if result
              else "sin linea RESULTADO (log truncado)")

    pe = pe_read.PE(DLL)
    table = [pe.u32(MOD_TABLE + 4 * i) for i in range(MOD_COUNT + 1)]
    rows = load_map()
    schema = load_schema()
    by_dest = {int(r["mod_dest_idx"]): r for r in rows if r["mod_dest_idx"] != "-1"}
    ctor = pe.raw[pe.va2off(CTOR):pe.va2off(CTOR_END)]
    installed = {va: ctor.find(pattern) for va, pattern in INSTALLS.items()}

    check("V2 la tabla del log es la de los bytes del PE", all(
        run["table"][:MOD_COUNT + 1] == table[:MOD_COUNT + 1] for run in runs),
        f"0x{MOD_TABLE:08X}: {table[:4]}... {table[MOD_COUNT]} (terminador), "
        f"{len(by_dest)} filas de destino en el mapa")
    check("V2b el mapa de observadores conoce los 63 destinos", len(by_dest) == MOD_COUNT,
          f"{len(by_dest)}/{MOD_COUNT} filas con mod_dest_idx")

    bad_slot, bad_window, seen = [], [], set()
    for run in runs:
        for preset in run["presets"]:
            for control in preset["controls"]:
                dest, slot = control["dest"], control["slot"]
                seen.add(dest)
                row = by_dest.get(dest)
                if row is None or not (0 <= dest < MOD_COUNT) or slot != table[dest] or \
                        slot != int(row["slot_in_p"]) or slot != int(row["table_10049e00_slot"]):
                    bad_slot.append((preset["id"], dest, slot))
                    continue
                if abs(control["min"] - float(row["min_val"])) > 1e-6 or \
                        abs(control["max"] - float(row["max_val"])) > 1e-6:
                    bad_window.append((preset["id"], dest, control["min"], control["max"],
                                       row["min_val"], row["max_val"]))
    total = sum(len(p["controls"]) for run in runs for p in run["presets"])
    check("V3 dest -> slot del DLL == tabla del PE == columnas del mapa", not bad_slot,
          f"{total} enganches de control, {len(seen)} destinos distintos"
          + (f"  fallos: {bad_slot[:5]}" if bad_slot else ""))
    check("V4 la ventana de recorte del DLL == min_val/max_val del mapa", not bad_window,
          f"{total} ventanas leidas de params+0x2B0+slot*0x18"
          + (f"  fallos: {bad_window[:5]}" if bad_window else ""))

    unhook_at = 0x278C + pe.u32(MOD_TABLE - 4) * 4 - 0x0C   # 0x2E20: ctx = write - 0x0C
    m3_values = {value for run in runs for value in run["m3"]}
    check("V5 los destinos enganchados son 0..62 y tienen clave en el andamio",
          all(0 <= d < MOD_COUNT for d in seen) and
          all(schema.get(int(by_dest[d]["snddat_index"])) == by_dest[d]["snddat_key"]
              for d in seen),
          f"{len(seen)} destinos distintos enganchados: " +
          ", ".join(f"{d}={by_dest[d]['snddat_key']}" for d in sorted(seen)[:6])
          + (" ..." if len(seen) > 6 else ""))
    check("V6 la rama `-1` copia el callback del sexto stModDepth",
          m3_values == {ST_MOD_DEPTH} and all(at >= 0 for at in installed.values()) and
          DEPTH_RECORD == 0x178 and 0x100 + 5 * 0x18 == 0x178,
          f"params+0x178 = params+0x{0x100:X}+5*0x18 = 0x{DEPTH_RECORD:X}, el campo +0x14 del "
          f"sexto registro de stModDepth (bloque de 0xEC, registros de 0x18): el log trae "
          f"{sorted(hex(v) for v in m3_values)} y el ctor escribe {hex(ST_MOD_DEPTH)} en "
          f"[reg+0x100] y {hex(ST_MOD_DEST)} en [reg+0x70]")
    check("V6b el valor copiado queda fuera del objeto de 0x2CDC",
          0x278C + max(table[:MOD_COUNT]) * 4 <= 0x2CDC < 0x278C + pe.u32(MOD_TABLE - 4) * 4,
          f"p tiene 0x{0x2CDC - 0x278C:X} B (335 slots, maximo slot {max(table[:MOD_COUNT])}); "
          f"el -1 escribe en params+0x{0x278C + pe.u32(MOD_TABLE - 4) * 4:X}")
    check("V6c y ese destino es el bloque de contexto de UNHOOK_CTX",
          unhook_at == UNHOOK_CTX,
          f"params+0x{UNHOOK_CTX:X} = el bloque cuyo +0x0C (ctx[3]) recibe el valor")
    m5 = [entry for run in runs for entry in run["m5"]]
    check("V7 M5: los valores de la copia cruda estan por encima de su ventana",
          bool(m5) and all(value > 1.0 for _, value in m5),
          f"{len(m5)} presets, p[slot] = {sorted({v for _, v in m5})} (sin recortar)")

    # El unico fallo admisible de M1: el write fuera del objeto cae en el `+0x0C`
    # del bloque de contexto que el heap pone justo detras de `params`, o sea en
    # el `ctx[3]` (indice de destino) de ese observador, que queda desenganchado.
    ascii_expect = "%08X" % ST_MOD_DEPTH
    unhook_runs, unhooked, bad_unhook = [], [], []
    for run in runs:
        for line in run["lines"]:
            m = M1B_RE.match(line)
            if not m:
                continue
            found = UNHOOK_RE.findall(line)
            unhook_runs.append(int(m.group(1)))
            if not line.startswith("[OK ") or int(m.group(2)) != len(found):
                bad_unhook.append((int(m.group(1)), "la cuenta no cuadra", line))
            for dest, slot, offset, value in found:
                unhooked.append((int(m.group(1)), int(dest), int(slot), int(offset, 16), value))
    bad_detail = list(bad_unhook)
    for preset, dest, slot, offset, value in unhooked:
        if not (0 <= dest < MOD_COUNT) or slot != table[dest] or offset != unhook_at or \
                value.upper() != ascii_expect:
            bad_detail.append((preset, dest, slot, hex(offset), value))
    runs_with_m1b = [number for number, run in enumerate(runs, start=1)
                     if any(M1B_RE.match(line) for line in run["lines"])]
    check("V8 el desenganche de ctx[3] cae exactamente en el write de la rama -1",
          not bad_detail and len(runs_with_m1b) == len(runs),
          f"{len(unhook_runs)} presets con M1b ({len(unhooked)} destinos desenganchados en "
          f"{len({p for p, *_ in unhooked})} de ellos); el write "
          f"cae en params+0x{0x278C + pe.u32(MOD_TABLE - 4) * 4:X} y el bloque afectado esta en "
          f"params+0x{unhook_at:X} (+0x0C = 0x{unhook_at + 0x0C:X}); ctx[3] = 0x{ST_MOD_DEPTH:X}"
          + (f"  fallos: {bad_detail[:4]}" if bad_detail else ""))

    if args.verbose:
        for dest in sorted(seen):
            row = by_dest[dest]
            print(f"    dest {dest:2d} slot {table[dest]:3d} ventana "
                  f"[{row['min_val']}, {row['max_val']}] {row['snddat_key']}")

    print()
    if failures:
        print(f"RESULTADO: {len(failures)} comprobacion(es) fallidas -> {failures}")
        return 1
    presets = sum(len(run["presets"]) for run in runs)
    print(f"RESULTADO: {checks} comprobaciones, 0 fallos; {presets} presets, "
          f"{sum(run['ok'] for run in runs)} comprobaciones del arnes en el log")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
