# verify_sound_script_001.md

## fuente real inspeccionada
- ruta: `C:\Users\ajaba\Downloads\neuron\NeuronVS-db\NeuronDB\Sounds\001.sound\sound.script`
- contenido extraído esta sesión: txt in situ, no descompilado ni invertido
- herramienta usada: python `Path().read_text().splitlines()` sobre el archivo real

## cont Kent de la preset real 001.sound
- líneas totales en el archivo: 445
- líneas no vacías emitidas: 445
- formato observado: una clave por línea, separada con tabulador de su valor
- primero: `SoundVersionMajor\t2`
- último: `SoundMFXRevSpeed\t60`

## orden observado
- encabezado de versión:
  - SoundVersionMajor
  - SoundVersionMinor
  - SoundVersionBuild
- cabecera de sonido:
  - SoundPan
  - SoundPanKeyTrack
  - SoundNumVoices
- nombre:
  - SoundNameC00..SoundNameC15
- bloque R1:
  - R1ModellIndex, R1Switch, R1Type, R1ParamLevel, R1SelectStickPar, R1Volume, R1AmpLfoDepth, R1AmpKeyTrack, R1VolumeVelocityDepth, R1ModelSizeKeyTrack, R1ModelSizeOffset, R1Octave, R1Semi, R1Cents, R1PitchLfoDepth, R1PitchKeyTrack, R1FreeADSR1PitchDepth, R1FreeADSR2PitchDepth, R1Free4L4TPitchDepth, R1ModelVelocitySwitch
  - luego R1L1Sphere1Value, R1L1Sphere2Value, R1L1ContourSphere, R1L1Sphere1KeyTrack, R1L1Sphere2KeyTrack, R1L1Sphere1LfoDepth, R1L1Sphere2LfoDepth, R1L1Sphere1VelocityDepth, R1L1Sphere2VelocityDepth, R1L1SphereStickPlayback
  - luego R1L1Scape1Value, R1L1Scape2Value, R1L1ContourScape, R1L1Scape1KeyTrack, R1L1Scape2KeyTrack, R1L1Scape1LfoDepth, R1L1Scape2LfoDepth, R1L1Scape1VelocityDepth, R1L1Scape2VelocityDepth, R1L1ScapeStickPlayback
  - luego L2 con mismo patrón
  - luego L3 con mismo patrón
- bloque R2:
  - R2ModellIndex, R2Switch, R2Type, R2ParamLevel, R2SelectStickPar, R2Volume, R2AmpLfoDepth, R2AmpKeyTrack, R2VolumeVelocityDepth, R2ModelSizeKeyTrack, R2ModelSizeOffset, R2Octave, R2Semi, R2Cents, R2PitchLfoDepth, R2PitchKeyTrack, R2FreeADSR1PitchDepth, R2FreeADSR2PitchDepth, R2Free4L4TPitchDepth, R2ModelVelocitySwitch
  - luego R2L1/L2/L3 con el mismo patrón de esferas/scapes de stick
- envoltorios:
  - R1ResEnvA..R1ResEnvR, R1ResEnvMode, R1ParaEnvVelocityDepth, R1L1/L2/L3Scape/SphereEnvDepth, R1AmpEnvA..R1AmpEnvR, R1AmpEnvMode, R1FreeEnvA..R1FreeEnvR, R1FreeEnvMode, R1FreeEnvDepth, FreeADSR1VelocityDepth
  - R2ResEnvA..R2ResEnvR, R2ResEnvMode, R2ParaEnvVelocityDepth, R2L1/L2/L3Scape/SphereEnvDepth, R2AmpEnvA..R2AmpEnvR, R2AmpEnvMode, R2FreeEnvA..R2FreeEnvR, R2FreeEnvMode, R2FreeEnvDepth, FreeADSR2VelocityDepth, FreeEnvLevel1..4, FreeEnvTime1..4, TLFreeEnvMode, TLFreeEnvDepth, Free4Level4TimeVelocityDepth, Shaper12Status, FreeEnvType, ShaperResySelect
  - LFO: LFOSwitch, LFODepth, LFORate, LFODelay, LFOWaveForm
  - Blender, Slicer, Silver, FreqFX, EQ, CR, DS, RM, SW, DC, TimeFX, SS, LRD, FL, PH, CH, FilterEnvA..R, FilterEnvMode, FilterEnvDepth, FilterEnvVelocityDepth, Shaper3Status
- destinos:
  - AftertouchDest1..4, AftertouchDestDepth1..4
  - Controller1UpDest1..4, Controller1UpDestDepth1..4
  - Controller1DnDest1..4, Controller1DnDestDepth1..4
  - Controller2Dest1..4, Controller2DestDepth1..4
  - Controller3Dest1..4, Controller3DestDepth1..4
  - Controller4Dest1..4, Controller4DestDepth1..4
  - FootSwitchDest, PitchBendRange, AftertouchDest, AftertouchDepth, ModulationDest, ModulationDepth, BreathDest, BreathDepth, CC03Dest, CC03Depth, FootDest, FootDepth, ExpressionDest, ExpressionDepth
- knobs:
  - Knob1R1Select, Knob2R1Select, Knob3R1Select, Knob4R1Select, SlicerSwitchBackup
- MFX:
  - SoundMFXSwitch, SoundMFXDelaySwitch, SoundMFXDelayMix, SoundMFXDelayLTime, SoundMFXDelayRTime, SoundMFXDelayFeedback, SoundMFXDelayFdbkDamp, SoundMFXReverbSwitch, SoundMFXReverbMix, SoundMFXReverbRoom, SoundMFXRevDecayTime, SoundMFXRevDiffusion, SoundMFXRevHFDamp, SoundMFXRevDetune, SoundMFXRevSpeed

## concordancia con el registro 445 del CSV
- canon registrado: `C:\Users\ajaba\Downloads\neuron\NeuronVS_neurondb\sound_schema.csv`
- fila 001.sound en sounds.csv:
  - params = 445
  - script_bytes = 8909
  - script_sha256 = ece4860e9ebe9a9afda38bc45b36e9213532250569153381c6157e4f487bc411
  - stick_lines = 780, stick_bytes = 8580, stick_sha256 = 95c6674efb0ee048413cddd804f4ae15ed6c568ba1b88d254893f14f8c3cea92
- primer vistazo esta sesión: encabezado de archivo coincide con el esquema alfanuméricamente (SoundVersionMajor primero, SoundMFXRevSpeed último) y el recuento observable es 445
- concordancia actual: la forma de la preset real 001.sound coincide aquí con el esquema de 445 parámetros: misma longitud, mismo primeras/clave final, mismo orden de bloques, mismas familias R1/R2/LFO/Env/Dest/Knob/MFX
- no se verificó byte a byte aquí: solo se verificó estructura visible, principio y fin, y recuento de líneas no vacías
- lo que falta para estar conforme: comparar key-by-key y valor-by-valor del archivo real con las 445 filas de sound_schema.csv, y comprobar los bytes SHA256 y el recuento exacto del archivo frente a los valores de sounds.csv

## lo que esto resuelve
- la entrada de preset ya no es abstracta: tenemos un archivo real, su recuento, su orden, su inicio, su fin y la familia de claves que usa
- la distribución del banco de sonidos tiene su propio esquema de preset; no es idéntica numéricamente a la distribución del banco de modelos, pero el formato de fichero es el mismo estilo de texto por clave

## lo que queda pendiente aquí
- comprobar el 8909 bytes y el SHA256 del archivo real frente a sounds.csv
- comprobar si 001.sound tiene su propio .stickrec y si su firma coincide con 95c6674efb0ee048413cddd804f4ae15ed6c568ba1b88d254893f14f8c3cea92
- decidir si el “445” de preset, el “445” de modelo y el “445” de sonido son el mismo espacio de claves o tres espacios distintos con el mismo recuento numérico
