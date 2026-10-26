# Accuracy audit, current session

This is a literal count of what was checked against real files in this
session, versus what was only inferred or left as a gap.

## Verified against real files

- `000.model/000001.scape` first bytes, chunk chain, csAN size 100, mnAN
  names, fdAN pairs, sample base at file offset 0x104, and post-chain bytes
  `FB FF FD FF` at offset 260..263
- `000.model/000001.sphere` first bytes, chunk chain, psAN size 140, mnAN
  named slots, fdAN, header field stream, and first 48 bytes after the chain
  decoded as a frame header beginning with magic 1234
- `000.model/map.script` active scope 000 values: LowKey 0, HiKey 37,
  RootKey 36, LowSource 1, HiSource 1, Detune 0, Volume 0, Pan 0
- `000.model/map.script` has 128 scope groups, all present, only scope 000
  active
- `511.model/map.script` header MapVersionMajor 1, MapVersionMinor 1,
  MapVersionBuild 0, and active scope 000 with LowKey 0, HiKey 127, RootKey
  69, LowSource 1, HiSource 1
- `000.model` folder contents: six scape/sphere pairs, map.script,
  and MName
- `Models/` has 341 entries including 000 through 339 and 511
- `Sounds/001.sound/sound.script` line count 445 and first 24 keys including
  SoundVersionMajor 2, SoundVersionMinor 0, SoundVersionBuild 0, SoundNumVoices
  8, SoundNameC00..C15 decoded as "Rust", and R1ModellIndex 336, R1Switch 1
- `Sounds/` has 350 sound folders, most with 445-line scripts, three legacy
  ones with 444 lines: 011, 012, 023
- `000.model/000001.scape` post-chain bytes begin `00 00 FB FF` followed by
  `FD FF 00 00`
- `000.model/000001.sphere` post-chain bytes begin `D2 04 00 00`, i.e.
  little-endian 1234

## Not verified in this session

- The typed meaning of `FB FF FD FF` at 000001.scape offset 260..263
- Any source folder contents under NeutrinoObjects, if they exist
- Any model other than 000 and 511 at the file level beyond folder names and
  sizes
- Any sound preset other than the header of 001
- A full round-trip parse and resave of any real sound.script here
- A working build artifact or manifest re-validation in this session
- Any naming of the exact routine that writes a new NeutrinoObjects source
  from incoming audio

## Inferred but not file-verified

- That one sound maps to one model source in the way the product UI implies
- That `Lower` in the map means exactly one active voice per scope
- That the post-chain `FB FF FD FF` words belong to a specific typed table
  whose interpretation is documented somewhere

## Conclusion

This session closed real file-level facts for the factory model and one factory
sound header. It did not close the input-path question. The input side is still
documented as a gap, not a solved path.
