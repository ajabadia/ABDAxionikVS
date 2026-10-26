# Session state summary

## What is real vs resource today

- **Real on disk right now (NeuronVS_port, this workspace):**
  - Preset codec: `SoundPreset` reads/writes `Sounds/NNN.sound/sound.script`. This is a closed, validated pathway: the parser mirrors the original DLL loader behavior enough to round-trip the first real NeuronDB row, `005.sound`, byte-for-byte on the canonical 445-line form.
  - Standalone validation artifact: `modelmaker_check/`. Today it has two compilable entrypoints:
    - `modelmaker_probe` (current schema oracle dump): prints the 445-row parameter table and looks up a known key. This is the small, self-contained proof that the embedded table matches the shape the codebase already knows.
    - `test_disk_rb`: the read/write/compare driver wired to `NEURON_DB` and `Sounds/005.sound/sound.script`.
  - Build situation: VS2026 + MSVC can build these. GCC/g++/cl.exe are **not** available in this environment. Do not plan around a GNU toolchain here; the verified story is CMake + VS2026 + MSVC today.

- **Resource (known, documented, but not yet ported here):**
  - The original NeuronDB also contains model folders with `.scape`/`.sphere` chunks and a `.sound`/`.stickrec` audio side. Those are the Modelmaker substance beyond the preset issue. They are documented in the existing NeuronDB scans and the SCAPE_SPHERE notes, but there is no first-class C++ reader/writer for them here yet.

## Smallest credible Modelmaker pathway as currently implemented

1. **Sound bank + sound.script read/write** — done.
   - Schema oracle: `ParameterTable` (445 rows, generated from `preset_schema.csv`).
   - Codec: `SoundPreset::load` / `parse` / `save` / `serialize`.
   - Validation: `test_disk_rb --compare` against real `005.sound`.

2. **Model folder plumbing (`.scape`/`.sphere`)** — identified, not yet wired.
   - The real NeuronDB model folders exist and are documented. The next smallest step is a reader/writer for those chunk types so a model folder can be opened, inspected, and re-serialized without depending on the original DLL.

3. **Audio -> scape/sphere** — explicitly still placeholder.
   - This is the part that would turn raw audio into the model representations NeuronDB expects. As of this session, that transformation is **not** implemented here; it is the open inferencia-style work, not a closed codec step.

## Closed vs inferencia today

- **Closed (codec / schema / round-trip):**
  - Parameter table identity.
  - Preset file format read and write.
  - First real-preset round-trip proof against an existing NeuronDB sound.

- **Inferencia / still open:**
  - `.scape`/`.sphere` interpretation and authoring.
  - Audio-to-model conversion.
  - Anything that would let Modelmaker actually synthesize or generate model data end-to-end.

## Where to pick up next

If the next step is to move beyond presets, the smallest credible continuation is to add the first `.scape`/`.sphere` reader/writer against an existing real model folder, in the same `modelmaker_check/` style as the sound round-trip proof.
