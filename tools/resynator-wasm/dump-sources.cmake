# ============================================================================
# dump-sources.cmake — escribe las fuentes del artefacto Resynator v2 WASM
# (una por linea) leyendo la lista COMPARTIDA de DspSources.cmake.
#
# Lo consume tools/resynator-wasm/build-resynator-wasm.ps1 para compilar y para
# escribir el manifiesto (`sources` + `engineHash`), de modo que el tool no
# mantiene su propia copia de la lista.
#
# Escribe en fichero a proposito: `message()` de CMake sale por stderr, asi que
# capturar la lista de la salida del proceso es fragil.
#
# Uso: cmake -DAXIONIK_SOURCES_OUT=<fichero> -P tools/resynator-wasm/dump-sources.cmake
# ============================================================================

if(NOT DEFINED AXIONIK_SOURCES_OUT OR AXIONIK_SOURCES_OUT STREQUAL "")
    message(FATAL_ERROR
        "Falta -DAXIONIK_SOURCES_OUT=<fichero> (destino de la lista de fuentes).")
endif()

include("${CMAKE_CURRENT_LIST_DIR}/../../DspSources.cmake")

if(NOT DEFINED AXIONIK_RESYNATOR_WASM_SOURCES
   OR AXIONIK_RESYNATOR_WASM_SOURCES STREQUAL "")
    message(FATAL_ERROR
        "AXIONIK_RESYNATOR_WASM_SOURCES no esta definida en DspSources.cmake")
endif()

set(_dump "")
foreach(source IN LISTS AXIONIK_RESYNATOR_WASM_SOURCES)
    string(APPEND _dump "${source}\n")
endforeach()

file(WRITE "${AXIONIK_SOURCES_OUT}" "${_dump}")
