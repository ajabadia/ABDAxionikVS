# Where the port currently falls short on input / ingestion

This is a working gap list, not a plan. It records the specific things the
port still does not do for turning an incoming audio source into something
NeuronVS can play, as of this session.

## What is implemented

- Preset parsing, writing, migration and the 445-key table are implemented.
- Scape and sphere loading for the two factory models in this workspace are
  implemented, including the chunk chain, sample base, frame bank and band
  slot indexing.
- NeuronDB discovery from an explicit path, NEURON_DB or the per-user
  location is implemented.

## What is not implemented

1. No importer for an arbitrary audio file into a NeutrinoObjects source.
   The factory model `000.model` uses NeutrinoObjects sources only, and this
   session did not find and run the code path that takes PCM/audio input and
   writes the matching source folder.

2. No writing of a new `.sound` preset into `Sounds/NNN.sound/sound.script`.
   The preset API reads and writes into a `SoundPreset` object, but the port
   has not verified creating a brand-new sound slot from scratch here.

3. No round-trip validation on a real shipped preset from this workspace.
   The preset code exists, but no shipped `sound.script` was parsed and
   re-saved here and compared byte-for-byte against the original.

4. No documented step that says what the user provides for a new sound:
   audio file, tuning, source selection, map scope fields, and which fields
   the engine actually reads.

5. No model authoring path. The port can load existing models, but there is
   no verified way to create a new `NNN.model` with its own `.scape`,
   `.sphere` and `map.script`.

6. The two `FB FF` words at `000001.scape` offset `260..263` have been seen
   but are not yet tied to a named interpretation in code or docs.

## Concrete next inspection before more code

- Inspect one concrete shipped sound preset here, for example `001.sound`,
  and validate its keys, line count and round-trip behavior.
- Inspect the NeutrinoObjects source folders referenced by `000.model` so the
  input side has a concrete shape to target.
- Inspect one concrete model that exercises the full map, for example
  `511.model`, including its source references if present, so the input
  contract is concrete rather than inferred.
- Decide whether we are documenting first or building an importer first; this
  document is the current default, since the input path is still unclear.
