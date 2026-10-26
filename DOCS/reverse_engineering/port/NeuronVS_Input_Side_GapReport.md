# NeuronVS input side, gap report

## Scope

This document describes the data that NeuronVS consumes, what the current
NeuronVS_port can already load, and what is still missing if the goal is to
turn an incoming audio source into something the engine can use.

It is a documentation surface, not a plan. It records concrete files,
concrete structs, concrete gaps.

## What NeuronVS consumes

At runtime the engine consumes three kinds of factory data:

1. Models in `Models/NNN.model/`
   - each folder contains `.scape`, `.sphere`, `map.script` and a `MName` file
   - `000.model` is the first example and has six scape/sphere pairs plus a map

2. Presets in `Sounds/NNN.sound/sound.script`
   - each preset is a `key<tab>value` script with 445 lines in schema order for
     most sounds, and 444 lines for a few legacy ones
   - the loader seeds every engine record with its default and resolves each key
     by name, so unknown keys are ignored and repeated keys keep the last value

3. Mapping tables that bind map scopes to model sources and key ranges
   - `map.script` is typed and placed alongside each model folder

So the input side is not a single monolithic stream. NeuronVS is built around
a bank of model folders, sound folders, and maps that connect them.

## What the port currently loads

The port already loads:

- `DataRoot` discovery from explicit path, `NEURON_DB`, or per-user location
- `Model` for an existing folder, including scape and sphere
- `Scape` with typed header `csAN`, names, fd pairs, and the int16 sample bank
  read from file offset `0x104`
- `Sphere` with typed header `psAN`, names, fd pairs, and the frame bank with
  band-slot indexing and frame magic check
- `SoundPreset` parsing, writing, migrations, and the `engineValue` rule
- `ParameterTable` for all 445 presets

That means the read side is already concrete for factory data. The port is not
merely theorizing about the format: it opens real files here.

## What the input side still lacks

1. No importer from a raw audio file into a `NeutrinoObjects` source.
   The factory model `000.model` uses `NeutrinoObjects` sources, and this
   session did not find or verify a code path that takes an arbitrary audio
   file and writes the corresponding source folder.

2. No authoring path for a new model folder.
   The port can load existing models, but there is no implemented step that
   produces a new `NNN.model` with its own scape, sphere, map, and MName.

3. No authoring path for a new sound preset into `Sounds/NNN.sound`.
   The preset object model exists, but there is no verified flow that creates a
   new sound slot in the bank from scratch here.

4. No evidenced mapping from a user-supplied tuned source into a map scope.
   The `map.script` contract is understood, but the step from "here is a new
   source" to "here is the scope that uses it" is not yet closed in the port.

5. One concrete binary-detail gap remains open:
   - in `000.model/000001.scape`, the bytes at file offset `260..263` are
     `FB FF FD FF`
   - that is downstream of the typed chunk chain, and the current docs do not
     yet name what it represents

## Concrete source-side facts already established

- `000.model/000001.scape` starts with `csAN` and has size `100`, names
  `Torsion HiTurbulNeutral LoTurbulWarm    Planar  Cold    Tubular Influenc...`,
  and fd pairs present at the expected offset
- `000.model/000001.sphere` starts with `psAN`, size `140`, and its mnAN slot
  names are `SmallBdy`, `Stringed`, `LargeBdy`, `Natural `, `StrTuneL`,
  `2SemiDwn`, `StrTuneH`, `2SemiUp `, `Dissolvd`, `LoFrictn`, `Coherent`,
  `HiFrictn`
- `000.model/map.script` has `MapVersionMajor 0`, `MapVersionMinor 9`,
  `MapVersionBuild 2`, and one active scope `000` with `LowKey 0`, `HiKey 37`,
  `RootKey 36`, `LowSource 1`, `HiSource 1`
- All 127 map voices exist, but only scope `000` is active in `000.model`
- `511.model/map.script` uses `MapVersionMajor 1`, `MapVersionMinor 1`,
  `MapVersionBuild 0` with scope `000` active and `LowKey 0`, `HiKey 127`,
  `RootKey 69`, `LowSource 1`, `HiSource 1`

These are real, file-backed facts, not guesses.

## What would make the input side concrete

Before claiming the input side is actionable, the next concrete steps are:

1. inspect one real sound preset from the bank here, e.g. `001.sound`, and
   validate its key set and line count against the 445 table
2. inspect the `NeutrinoObjects` source folders referenced by `000.model` so
   the source-side shape is documented from a real model
3. inspect one real model that uses a richer map, e.g. `511.model`, including
   its source references if present
4. decide whether the next move is documentation-first or importer-first

Until those are done, the input path is documented as present-but-unfinished,
not as solved.

## Bottom line

The port can read the factory input that NeuronVS ships with. It cannot yet
accept an incoming audio source and turn it into a usable NeutrinoObjects
source, a new sound, or a new model. That is the real input-side gap.
