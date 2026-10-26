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

target_include_directories(abdaxionikvs_dsp PRIVATE
    "${CMAKE_CURRENT_LIST_DIR}/../Source"
    "${CMAKE_CURRENT_LIST_DIR}/../Source/DSP"
    "${CMAKE_CURRENT_LIST_DIR}/../Source/Generated"
)

target_link_libraries(abdaxionikvs_dsp PRIVATE
    ABDShared::DspCore
    ABDShared::SynthCore
    ABDShared::DspEffects
)

# Exportaciones Emscripten para AudioWorklet con HEAPF32
set_target_properties(abdaxionikvs_dsp PROPERTIES
    OUTPUT_NAME "abdaxionikvs_dsp"
    SUFFIX ".js"
    LINK_FLAGS "-s WASM=1 -s MODULARIZE=1 -s EXPORT_NAME='createAxionikDsp' -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPF32'] -s ALLOW_MEMORY_GROWTH=1 -O3"
)
