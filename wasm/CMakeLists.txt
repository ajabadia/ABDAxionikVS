cmake_minimum_required(VERSION 3.22)
project(ABDAxionikVS_WASM LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# ============================================================================
# ABDShared (WASM) — DspCore, SynthCore, DspEffects (sin JUCE)
# ============================================================================
if(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../../ABDShared/Code/CMakeLists.txt")
    set(ABDSHARED_CODE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../ABDShared/Code")
    message(STATUS "ABDShared (WASM): Usando repositorio canónico en ${ABDSHARED_CODE_DIR}")
elseif(EXISTS "${CMAKE_CURRENT_SOURCE_DIR}/../../ABDSharedCode/CMakeLists.txt")
    set(ABDSHARED_CODE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../../ABDSharedCode")
    message(STATUS "ABDShared (WASM): Usando repositorio en ${ABDSHARED_CODE_DIR}")
endif()

if(DEFINED ABDSHARED_CODE_DIR)
    set(ABDSHARED_BUILD_DSPCORE_TESTS OFF CACHE BOOL "" FORCE)
    set(ABDSHARED_BUILD_SYNTHCORE_TESTS OFF CACHE BOOL "" FORCE)
    set(ABDSHARED_BUILD_DSPEFFECTS_TESTS OFF CACHE BOOL "" FORCE)
    set(ABDSHARED_BUILD_AUTOUPDATER OFF CACHE BOOL "" FORCE)
    set(ABDSHARED_BUILD_HARDWAREDRIVERS OFF CACHE BOOL "" FORCE)
    set(ABDSHARED_BUILD_HARDWAREMIDIDETECT OFF CACHE BOOL "" FORCE)
    set(ABDSHARED_BUILD_AUDIOCOMPARATOR OFF CACHE BOOL "" FORCE)
    add_subdirectory("${ABDSHARED_CODE_DIR}" "${CMAKE_BINARY_DIR}/ABDShared_build")
endif()

# ============================================================================
# Lista única de fuentes DSP anti-drift (compartida con nativo)
# ============================================================================
include("${CMAKE_CURRENT_LIST_DIR}/../DspSources.cmake")

set(WASM_SOURCES
    ${AXIONIK_DSP_SOURCES}
    "${CMAKE_CURRENT_LIST_DIR}/WasmBridge.cpp"
)

add_executable(abdaxionikvs_dsp ${WASM_SOURCES})

# Directorios de inclusion, C++20 y variante de motor vienen del fichero compartido
axionik_dsp_configure(abdaxionikvs_dsp)

target_link_libraries(abdaxionikvs_dsp PRIVATE
    ABDShared::DspCore
    ABDShared::SynthCore
    ABDShared::DspEffects
)

# Exportaciones Emscripten para AudioWorklet con HEAPF32 y WebAssembly.instantiate directo
set_target_properties(abdaxionikvs_dsp PROPERTIES
    OUTPUT_NAME "abdaxionikvs_dsp"
    SUFFIX ".js"
    LINK_FLAGS "-s WASM=1 -s MALLOC=emmalloc -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=33554432 -s FILESYSTEM=0 -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','getValue','setValue','HEAPF32'] -s EXPORTED_FUNCTIONS=['_axionik_create','_axionik_destroy','_axionik_prepare','_axionik_reset','_axionik_process','_axionik_note_on','_axionik_note_off','_axionik_all_notes_off','_axionik_set_param','_axionik_set_param_norm','_axionik_get_param','_axionik_pitch_bend','_axionik_mod_wheel','_axionik_channel_pressure','_axionik_midi_cc','_axionik_set_master_volume','_axionik_set_oracle_clip_mode','_axionik_init_preset','_axionik_load_preset_slot','_axionik_load_preset_script','_axionik_load_model_slot','_axionik_set_calibration','_axionik_reset_calibration','_axionik_reset_all_calibration','_axionik_get_telemetry','_malloc','_free'] -O2"
)
