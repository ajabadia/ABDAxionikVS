# ============================================================================
# ABDAxionikVS — Lista compartida de fuentes DSP (anti-drift, single-source)
#
# Consumida por TODOS los builds que compilan el motor:
#   - CMakeLists.txt raiz (plugin nativo JUCE 9 Standalone + VST3, WebPilot, tests)
#   - wasm/CMakeLists.txt (build WebAssembly AudioWorklet)
#
# Regla estricta: Source/DSP/ NUNCA incluye cabeceras de JUCE.
# Las mismas fuentes compilan bit a bit identico en nativo y en WASM.
#
# Añadir aqui una fuente .cpp la incorpora automaticamente a nativo y WASM.
# Los ficheros de glue del host (Source/PluginProcessor.cpp, Source/PluginEditor.cpp,
# wasm/WasmBridge.cpp) NO van en esta lista: son especificos de cada artefacto.
# ============================================================================

set(AXIONIK_DSP_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP/DspEngineFacade.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP/Translator.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP/TranslatorHooks.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP/ParameterEngineBridge.cpp"
)

# Fuentes del artefacto Resynator v2 WASM (tools/resynator-wasm). El manifiesto
# `resynator-v2-abi.json` (lista `sources` + `engineHash`) se genera de ESTA lista:
# el tool no mantiene su propia copia. El .cpp es la fachada C-ABI; las cabeceras
# son la fuente de verdad del DSP y entran en el hash.
set(AXIONIK_RESYNATOR_WASM_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP/Extended/ResynatorV2Wasm.cpp"
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP/Extended/AxionikExpandedSynthesizer.h"
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP/Extended/AxionikExpandedModel.h"
)

# Directorios de inclusion que necesita cualquier consumidor del motor DSP.
set(AXIONIK_DSP_INCLUDE_DIRS
    "${CMAKE_CURRENT_LIST_DIR}/Source"
    "${CMAKE_CURRENT_LIST_DIR}/Source/DSP"
    "${CMAKE_CURRENT_LIST_DIR}/Source/Generated"
)

# Variante de motor (0=classic, 1=plus, 2=expanded). Definida aqui para que
# nativo y WASM compilen SIEMPRE la misma variante; si el consumidor ya la fijo
# en cache, se respeta su valor.
if(NOT DEFINED AXIONIK_TARGET_MODEL)
    set(AXIONIK_TARGET_MODEL 2 CACHE STRING
        "0=classic (100% legacy NeuronVS), 1=plus (4K upgraded), 2=expanded (Unified Spectral Surface v2)")
endif()

set(AXIONIK_DSP_COMPILE_DEFINITIONS "AXIONIK_TARGET_MODEL=${AXIONIK_TARGET_MODEL}")

# Aplica a un target todo lo que el motor DSP exige (fuentes aparte):
#   axionik_dsp_configure(<target>)            — consumidores con includes privados
#   axionik_dsp_configure(<target> INTERFACE)  — targets que reexportan el motor
function(axionik_dsp_configure target)
    set(scope PRIVATE)
    if(ARGC GREATER 1)
        set(scope ${ARGV1})
    endif()
    target_include_directories(${target} ${scope} ${AXIONIK_DSP_INCLUDE_DIRS})
    target_compile_features(${target} ${scope} cxx_std_20)
    target_compile_definitions(${target} ${scope} ${AXIONIK_DSP_COMPILE_DEFINITIONS})
endfunction()
